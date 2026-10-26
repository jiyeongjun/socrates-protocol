import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildGroundedCommand, modelMatrix } from './run-grounded-evals.mjs';
import { parseTranscript } from './run-alignment-evals.mjs';
import { ensureSafeOutputDirectory, runProcess } from './run-live-evals.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = '.claude/skills/socrates';
const requiredSkillFiles = ['SKILL.md', ...['guided-learning', 'implementation-alignment', 'visual-explanations', 'audience-calibration'].map(n => `references/${n}.md`)];
const reviewReference = 'references/response-review.md';
const skillFiles = [...requiredSkillFiles, reviewReference];
const reviewerPolicyPath = 'reference/skill-references/response-review.md';

export function buildNativeResponseCommand({ model, effort, cwd, input, reviewerPrompt, env = process.env }) {
  if (env.SOCRATES_NATIVE_REVIEW_MODEL && env.SOCRATES_NATIVE_REVIEW !== '1') throw new Error('SOCRATES_NATIVE_REVIEW_MODEL requires SOCRATES_NATIVE_REVIEW=1');
  if (env.SOCRATES_NATIVE_REVIEW_MODEL && !reviewerPrompt?.trim()) throw new Error('Explicit reviewer requires the canonical reviewer policy prompt');
  const command = buildGroundedCommand({ host: 'claude', model, effort, cwd, input, env });
  const allowed = env.SOCRATES_NATIVE_REVIEW === '1' ? 'Read,Agent,TaskOutput' : 'Read';
  command.args[command.args.indexOf('--tools') + 1] = allowed;
  command.args.push('--allowedTools', allowed);
  if (env.SOCRATES_NATIVE_REVIEW_MODEL) command.args.push('--agents', JSON.stringify({ 'socrates-reviewer': {
    description: 'Read-only review of a Socrates draft before the final response.',
    prompt: reviewerPrompt,
    tools: [], model: env.SOCRATES_NATIVE_REVIEW_MODEL,
  } }));
  return command;
}

export async function snapshotSkillBundle(sourceRoot, destination) {
  await cp(path.join(sourceRoot, skillDir), destination, { recursive: true, dereference: true });
  const hashes = await Promise.all(skillFiles.map(async p => {
    try { return [p, createHash('sha256').update(await readFile(path.join(destination, p))).digest('hex')]; }
    catch (error) {
      if (p === reviewReference && error.code === 'ENOENT') return null; // Historical bundles predate this reference.
      throw error;
    }
  }));
  return Object.fromEntries(hashes.filter(Boolean));
}

function returnedText(result) {
  if (typeof result.content === 'string') return result.content;
  return (Array.isArray(result.content) ? result.content : [])
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text).join('\n');
}

const contentOf = event => Array.isArray(event.message?.content) ? event.message.content : [];
const isParent = event => !event.parent_tool_use_id;
const field = (text, name) => text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim();
function findingsText(text) {
  if (typeof text !== 'string') return '';
  const value = text.trim();
  // Completion provenance is checked separately. These are transport/status messages, not findings.
  return !value || /Async agent launched successfully|agent is working in the background|^output_file:/i.test(value) ||
    /^(?:done|completed|success|ok)[.!]?$/i.test(value) ? '' : value;
}

export function auditNativeModels(events, parentModel, reviewerModel = parentModel) {
  const modelOf = event => event.message?.model ?? (event.type === 'system' ? event.model : null);
  const parentModelEvidence = [...new Set(events.filter(isParent).map(modelOf).filter(Boolean))];
  const reviewerModelEvidence = [...new Set(events.filter(event => !isParent(event)).map(modelOf).filter(Boolean))];
  return { parentModelEvidence, reviewerModelEvidence,
    parentModelMatches: parentModelEvidence.length > 0 && parentModelEvidence.every(model => model === parentModel),
    reviewerModelMatches: reviewerModelEvidence.length ? reviewerModelEvidence.every(model => model === reviewerModel) : null };
}

export function auditNativeReviews(tools, events, { allowReview = false, reviewRequired = false, expectedReviewerModel } = {}) {
  const errors = [];
  const attempts = [];
  const entries = events.flatMap((event, index) => contentOf(event)
    .filter(block => block.type === 'tool_result').map(block => ({ event, index, block })));
  const finalResult = events.findLastIndex(event => isParent(event) && event.type === 'result');
  const finalAnswer = events.findLastIndex((event, index) => index < finalResult && isParent(event) &&
    event.type === 'assistant' && contentOf(event).some(block => block.type === 'text' && block.text?.trim()));
  const answerIndex = finalAnswer < 0 ? finalResult : finalAnswer;
  const matchingResults = id => typeof id === 'string' ? entries.filter(entry => isParent(entry.event) && entry.block.tool_use_id === id) : [];
  const callIndex = id => events.findIndex(event => isParent(event) && event.type === 'assistant' &&
    contentOf(event).some(block => block.type === 'tool_use' && block.id === id));
  const fail = (tool, reason) => errors.push({ toolUseId: tool.id, reason });
  if (allowReview) for (const tool of tools.filter(tool => tool.name === 'Agent')) {
    const startIndex = callIndex(tool.id);
    const matching = matchingResults(tool.id);
    if (startIndex < 0 || matching.length !== 1 || matching[0].index <= startIndex || matching[0].block.is_error) {
      fail(tool, 'Missing, ambiguous, out-of-order or failed Agent result');
      continue;
    }
    const launch = matching[0];
    const metadata = launch.event.tool_use_result ?? {};
    const launchText = returnedText(launch.block);
    const taskId = metadata.agentId ?? launchText.match(/\bagentId:\s*([^\s(]+)/)?.[1];
    const attempt = { toolUseId: tool.id, taskId, input: tool.input, launched: true, completed: false,
      requestedModel: tool.input?.model ?? 'inherit', resolvedModels: [], effortEvidence: 'unavailable',
      reviewerToolAudit: 'unavailable', completionSources: [] };
    attempts.push(attempt);
    if (metadata.resolvedModel) attempt.resolvedModels.push(metadata.resolvedModel);
    const nested = events.filter(event => event.parent_tool_use_id === tool.id);
    attempt.resolvedModels.push(...nested.map(event => event.message?.model).filter(Boolean));
    const nestedTools = nested.flatMap(contentOf).filter(block => block.type === 'tool_use');
    if (nestedTools.length) fail(tool, `Reviewer used tools or delegated: ${nestedTools.map(block => block.name).join(',')}`);
    if (nested.length) attempt.reviewerToolAudit = 'no-tools-in-observed-nested-events';
    const completed = [];
    function completion(index, source, status, text, reportedToolUses) {
      if (['failed', 'error', 'killed', 'cancelled'].includes(status)) fail(tool, `Reviewer completion reports ${status}`);
      if (reportedToolUses > 0) fail(tool, 'Reviewer completion reports tool use');
      if (reportedToolUses === 0) attempt.reviewerToolAudit = 'reported-zero-tools; observed-nested-events-also-audited';
      const findings = findingsText(text);
      if (status === 'completed' && findings && index >= launch.index && index < answerIndex) {
        completed.push({ index, source, response: findings });
      }
    }
    if (metadata.status === 'completed' && !metadata.isAsync) {
      completion(launch.index, 'Agent', metadata.status, returnedText(launch.block));
    }
    for (const [index, event] of events.entries()) {
      if (!isParent(event)) continue;
      if (event.type === 'system' && event.subtype === 'task_notification' && taskId &&
          event.task_id === taskId && event.tool_use_id === tool.id) {
        completion(index, 'task_notification', event.status, event.summary, event.usage?.tool_uses);
      }
      // Some hosts deliver completion as a user message. Require the envelope and both exact IDs;
      // its summary is usually status metadata, so only the explicit result carries findings.
      if (event.type === 'user') for (const block of contentOf(event)) {
        if (block.type !== 'text') continue;
        const notice = field(block.text ?? '', 'task-notification');
        if (notice && taskId && field(notice, 'task-id') === taskId && field(notice, 'tool-use-id') === tool.id) {
          completion(index, 'user-task-notification', field(notice, 'status'), field(notice, 'result'));
        }
      }
    }
    for (const wait of tools.filter(t => t.name === 'TaskOutput' && t.input?.task_id === taskId && taskId)) {
      const results = matchingResults(wait.id);
      if (results.length !== 1 || results[0].block.is_error || results[0].index <= callIndex(wait.id)) continue;
      const result = results[0];
      const data = result.event.tool_use_result;
      if (data?.retrieval_status === 'success' && data.task?.task_id === taskId) {
        completion(result.index, 'TaskOutput', data.task.status, data.task.output);
      } else {
        const text = returnedText(result.block);
        if (field(text, 'retrieval_status') === 'success' && field(text, 'task_id') === taskId) {
          completion(result.index, 'TaskOutput', field(text, 'status'), field(text, 'output'));
        }
      }
    }
    attempt.resolvedModels = [...new Set(attempt.resolvedModels)];
    attempt.modelMatches = attempt.resolvedModels.length ? attempt.resolvedModels.every(model => model === expectedReviewerModel) : null;
    if (expectedReviewerModel && attempt.modelMatches === false) fail(tool, 'Reviewer resolved model differs from the explicitly expected reviewer model');
    if (completed.length) {
      attempt.completed = true;
      attempt.completionSources = completed.map(({ source, index }) => ({ source, index }));
      attempt.response = completed.at(-1).response;
    }
  }
  if (allowReview) for (const tool of tools.filter(tool => tool.name === 'TaskOutput')) {
    const matching = matchingResults(tool.id);
    if (callIndex(tool.id) < 0 || matching.length !== 1 || matching[0].block.is_error || matching[0].index <= callIndex(tool.id)) {
      fail(tool, 'Missing, ambiguous, out-of-order or failed TaskOutput result');
    } else if (!attempts.some(attempt => attempt.taskId && attempt.taskId === tool.input?.task_id)) {
      fail(tool, 'TaskOutput does not refer to a launched reviewer');
    }
  }
  const reviews = attempts.filter(attempt => attempt.completed);
  return { reviewAttempts: attempts, reviews, reviewErrors: errors, reviewPerformed: reviews.length > 0,
    reviewRequired, requiredReviewMet: !reviewRequired || reviews.length > 0,
    reviewAuditLimitations: 'Completion provenance and observed tool/model telemetry only; findings correctness and application require semantic review. Missing effort or nested telemetry is not proof of inheritance or no tool use.' };
}

export async function auditSkillReads(tools, workspace, events = [], options = {}) {
  const { allowReview = false } = options;
  const allowedRoot = await realpath(path.join(workspace, skillDir));
  const results = events.flatMap(event => event.type === 'user' && Array.isArray(event.message?.content)
    ? event.message.content.filter(block => block.type === 'tool_result') : []);
  const reads = [];
  const unexpected = [];
  const readErrors = [];
  let skillLoaded = false;
  const nestedToolIds = new Set(events.filter(event => event.parent_tool_use_id).flatMap(contentOf)
    .filter(block => block.type === 'tool_use').map(block => block.id));
  for (const tool of tools) {
    if (allowReview && nestedToolIds.has(tool.id)) {
      unexpected.push(`reviewer:${tool.name}`);
      continue;
    }
    if (allowReview && ['Agent', 'TaskOutput'].includes(tool.name)) {
      continue;
    }
    if (tool.name !== 'Read' || typeof tool.input?.file_path !== 'string') {
      unexpected.push(tool.name ?? 'unknown tool');
      continue;
    }
    try {
      const target = await realpath(path.resolve(workspace, tool.input.file_path));
      const relative = path.relative(allowedRoot, target).split(path.sep).join('/');
      if (!skillFiles.includes(relative)) {
        unexpected.push(tool.input.file_path);
        continue;
      }
      const matching = results.filter(result => typeof tool.id === 'string' && result.tool_use_id === tool.id);
      if (matching.length !== 1 || matching[0].is_error) {
        readErrors.push({ path: relative, reason: matching.length !== 1 ? 'Missing or ambiguous tool result' : 'Read returned an error' });
        continue;
      }
      const sourceLines = (await readFile(target, 'utf8')).replace(/\r\n/g, '\n').split('\n');
      // Claude may number the empty segment after a terminal newline, or omit it.
      // All preceding lines, including meaningful blank lines, remain required.
      const requiredLines = sourceLines.length - (sourceLines.at(-1) === '' ? 1 : 0);
      const numbered = [...returnedText(matching[0]).matchAll(/^\s*(\d+)\t([^\n\r]*)\r?$/gm)]
        .map(match => ({ line: Number(match[1]), text: match[2] }));
      const validContent = numbered.length > 0 && numbered.every((entry, index) =>
        entry.line >= 1 && entry.line <= sourceLines.length && sourceLines[entry.line - 1] === entry.text &&
        (index === 0 || entry.line === numbered[index - 1].line + 1));
      if (!validContent) {
        readErrors.push({ path: relative, reason: 'Read result does not match numbered source lines' });
        continue;
      }
      reads.push(relative);
      if (tool === tools[0] && relative === 'SKILL.md') {
        skillLoaded = numbered[0].line === 1 && numbered.length >= requiredLines;
        if (!skillLoaded) readErrors.push({ path: relative, reason: 'First skill read did not return the complete file' });
      }
    } catch { unexpected.push(tool.input.file_path); }
  }
  return { reads, unexpected, readErrors, skillLoaded, ...auditNativeReviews(tools, events, options) };
}

export async function runNativeResponseEvals(env = process.env) {
  if (env.SOCRATES_LIVE_EVAL !== '1') throw new Error('Set SOCRATES_LIVE_EVAL=1 to authorize model calls');
  const sourceRoot = path.resolve(env.SOCRATES_NATIVE_SOURCE_ROOT ?? root);
  const caseFile = path.resolve(env.SOCRATES_NATIVE_CASE_FILE ?? path.join(root, 'evals/grounded-learning-cases.json'));
  const caseSource = await readFile(caseFile, 'utf8');
  const cases = JSON.parse(caseSource);
  if (!Array.isArray(cases) || !cases.length || cases.some(c => !c || typeof c.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(c.id) || typeof c.prompt !== 'string' || !c.prompt.trim() || (c.reviewRequired !== undefined && typeof c.reviewRequired !== 'boolean')) || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('Invalid or duplicate case definitions');
  const ids = env.SOCRATES_NATIVE_CASES?.split(',');
  const selected = ids ? cases.filter(c => ids.includes(c.id)) : cases;
  if (!selected.length || (ids && (new Set(ids).size !== ids.length || ids.length !== selected.length))) throw new Error('Unknown or duplicate cases');
  const configs = env.SOCRATES_NATIVE_MODEL
    ? [{ model: env.SOCRATES_NATIVE_MODEL, effort: env.SOCRATES_NATIVE_EFFORT }]
    : modelMatrix.filter(c => c.host === 'claude');
  // Deliberately use this evaluator checkout's policy for both source arms, not sourceRoot's policy.
  const reviewerPrompt = env.SOCRATES_NATIVE_REVIEW_MODEL ? await readFile(path.join(root, reviewerPolicyPath), 'utf8') : undefined;
  for (const c of configs) buildNativeResponseCommand({ ...c, cwd: root, input: '', reviewerPrompt, env });
  const concurrency = Number(env.SOCRATES_NATIVE_CONCURRENCY ?? 3);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1–4');
  const output = path.resolve(env.SOCRATES_NATIVE_OUTPUT ?? path.join(root, '.socrates-eval-results'));
  await ensureSafeOutputDirectory(output);
  const runDir = await mkdtemp(path.join(output, 'native-response-'));
  const snapshot = path.join(runDir, 'skill-snapshot');
  const hashes = await snapshotSkillBundle(sourceRoot, snapshot);
  const reviewToolEnabled = env.SOCRATES_NATIVE_REVIEW === '1';
  const reviewerModel = env.SOCRATES_NATIVE_REVIEW_MODEL ?? null;
  const report = { runAt: new Date().toISOString(), skillHashes: hashes, caseSha256: createHash('sha256').update(caseSource).digest('hex'), configs, reviewToolEnabled, reviewerModel,
    reviewerPromptSource: reviewerPrompt ? reviewerPolicyPath : null,
    reviewerPromptSha256: reviewerPrompt ? createHash('sha256').update(reviewerPrompt).digest('hex') : null,
    reviewerModelPolicy: reviewerModel ? 'Explicitly selected separate reviewer model; not a same-model sample.' : 'Inherit the exact requested parent model; observed deviations fail execution.',
    reviewerEffortEvidence: 'unavailable unless exposed by reviewer telemetry; parent CLI effort is not reviewer evidence',
    methodology: `Fresh Claude CLI context and temporary workspace per case. One preserved skill snapshot is hashed and copied into every workspace. The first tool read must return the complete SKILL.md; the model selects reference files. Tools: ${reviewToolEnabled ? 'Read, Agent, TaskOutput' : 'Read'}. Every read path and its successful numbered tool-result content are audited against the copied skill files. Reviewer launches do not count as completed findings; findings must arrive before the final answer. Required review compliance is separate from execution and semantic success. Expected criteria are withheld. This tests explicit file loading, not automatic skill discovery.`,
    status: 'running', results: [] };
  if (reviewerPrompt) await writeFile(path.join(runDir, 'reviewer-policy.md'), reviewerPrompt, { mode: 0o600 });
  await writeFile(path.join(runDir, 'manifest.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  const jobs = configs.flatMap(config => selected.map(c => ({ config, c })));
  let cursor = 0;
  const failed = new Set();
  async function worker() {
    while (cursor < jobs.length) {
      const { config, c } = jobs[cursor++];
      const key = `${config.model}-${config.effort}`;
      const id = `${key}-${c.id}`;
      if (failed.has(key)) {
        report.results.push({ id, ...config, caseId: c.id, executionOk: false, skipped: 'Prior execution failed; no fallback or automatic retry.' });
        continue;
      }
      const workspace = await mkdtemp(path.join(tmpdir(), 'socrates-native-response-'));
      try {
        await cp(snapshot, path.join(workspace, skillDir), { recursive: true });
        const reviewerInstruction = reviewerModel ? `\nAvailable native reviewer: socrates-reviewer; reviewer model explicitly selected as ${reviewerModel}. Use it if the skill calls for independent review. Set Agent subagent_type to socrates-reviewer and omit the Agent model parameter: the configured reviewer already selects the exact model.\n` : '';
        const input = `Use Socrates at ${skillDir}/SKILL.md to respond to the request below. Read SKILL.md first and follow its reference-routing instructions. Use the evidence supplied in the request. Do not modify files. Respond directly to the user.${reviewerInstruction}\n\nUSER REQUEST:\n${c.prompt}\n`;
        await writeFile(path.join(runDir, `${id}.prompt.txt`), input, { mode: 0o600 });
        const processResult = await runProcess(buildNativeResponseCommand({ ...config, cwd: workspace, input, reviewerPrompt, env }), 300000);
        const parsed = parseTranscript('claude', processResult.stdout);
        const events = processResult.stdout.split('\n').flatMap(s => { try { return [JSON.parse(s)]; } catch { return []; } });
        const reviewRequired = reviewToolEnabled && (c.reviewRequired ?? !['minimum-equivalent', 'invalid-premise'].includes(c.id));
        const audit = await auditSkillReads(parsed.tools, workspace, events, { allowReview: reviewToolEnabled, reviewRequired, expectedReviewerModel: reviewerModel ?? config.model });
        const denials = events.flatMap(e => e.permission_denials ?? []);
        const modelAudit = auditNativeModels(events, config.model, reviewerModel ?? config.model);
        const executionOk = processResult.code === 0 && !processResult.error && !processResult.timedOut && !parsed.failed && !!parsed.response.trim() && modelAudit.parentModelMatches && modelAudit.reviewerModelMatches !== false && audit.skillLoaded && !audit.unexpected.length && !audit.readErrors.length && !audit.reviewErrors.length && !denials.length;
        const result = { id, ...config, reviewerModel: reviewerModel ?? config.model, caseId: c.id, executionOk, response: parsed.response, sessionId: parsed.sessionId, modelEvidence: parsed.modelEvidence, ...modelAudit, ...audit, permissionDenials: denials, process: processResult, semanticReview: 'pending' };
        await writeFile(path.join(runDir, `${id}.json`), JSON.stringify(result, null, 2), { mode: 0o600 });
        report.results.push(result);
        if (!executionOk) failed.add(key);
        console.log(`${id}: execution=${executionOk ? 'PASS' : 'FAIL'} reads=${audit.reads.join(',')} reviews=${audit.reviews.length}`);
      } catch (e) {
        failed.add(key);
        report.results.push({ id, ...config, caseId: c.id, executionOk: false, error: e.message });
      } finally {
        try { await rm(workspace, { recursive: true, force: true }); }
        catch (e) {
          failed.add(key);
          const result = report.results.find(r => r.id === id);
          if (result) { result.executionOk = false; result.cleanupError = e.message; }
        }
      }
    }
  }
  console.log(`Report directory: ${runDir}; ${jobs.length} fresh cases`);
  await Promise.all(Array.from({ length: concurrency }, worker));
  report.status = report.results.every(r => r.executionOk) ? 'completed' : 'execution-failed';
  await writeFile(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Report: ${runDir}/report.json; semantic review required`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runNativeResponseEvals().then(r => { if (r.status !== 'completed') process.exitCode = 1; }).catch(e => { console.error(e.message); process.exitCode = 1; });
}
