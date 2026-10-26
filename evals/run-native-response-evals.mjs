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
const skillFiles = ['SKILL.md', ...['guided-learning', 'implementation-alignment', 'visual-explanations', 'audience-calibration'].map(n => `references/${n}.md`)];

export function buildNativeResponseCommand({ model, effort, cwd, input, env = process.env }) {
  const command = buildGroundedCommand({ host: 'claude', model, effort, cwd, input, env });
  command.args[command.args.indexOf('--tools') + 1] = 'Read';
  command.args.push('--allowedTools', 'Read');
  return command;
}

export async function snapshotSkillBundle(sourceRoot, destination) {
  await cp(path.join(sourceRoot, skillDir), destination, { recursive: true, dereference: true });
  return Object.fromEntries(await Promise.all(skillFiles.map(async p => [p,
    createHash('sha256').update(await readFile(path.join(destination, p))).digest('hex')])));
}

function returnedText(result) {
  if (typeof result.content === 'string') return result.content;
  return (Array.isArray(result.content) ? result.content : [])
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text).join('\n');
}

export async function auditSkillReads(tools, workspace, events = []) {
  const allowedRoot = await realpath(path.join(workspace, skillDir));
  const results = events.flatMap(event => event.type === 'user' && Array.isArray(event.message?.content)
    ? event.message.content.filter(block => block.type === 'tool_result') : []);
  const reads = [];
  const unexpected = [];
  const readErrors = [];
  let skillLoaded = false;
  for (const tool of tools) {
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
  return { reads, unexpected, readErrors, skillLoaded };
}

export async function runNativeResponseEvals(env = process.env) {
  if (env.SOCRATES_LIVE_EVAL !== '1') throw new Error('Set SOCRATES_LIVE_EVAL=1 to authorize model calls');
  const sourceRoot = path.resolve(env.SOCRATES_NATIVE_SOURCE_ROOT ?? root);
  const cases = JSON.parse(await readFile(path.join(root, 'evals/grounded-learning-cases.json'), 'utf8'));
  const ids = env.SOCRATES_NATIVE_CASES?.split(',');
  const selected = ids ? cases.filter(c => ids.includes(c.id)) : cases;
  if (!selected.length || (ids && (new Set(ids).size !== ids.length || ids.length !== selected.length))) throw new Error('Unknown or duplicate cases');
  const configs = env.SOCRATES_NATIVE_MODEL
    ? [{ model: env.SOCRATES_NATIVE_MODEL, effort: env.SOCRATES_NATIVE_EFFORT }]
    : modelMatrix.filter(c => c.host === 'claude');
  for (const c of configs) buildNativeResponseCommand({ ...c, cwd: root, input: '', env });
  const concurrency = Number(env.SOCRATES_NATIVE_CONCURRENCY ?? 3);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1–4');
  const output = path.resolve(env.SOCRATES_NATIVE_OUTPUT ?? path.join(root, '.socrates-eval-results'));
  await ensureSafeOutputDirectory(output);
  const runDir = await mkdtemp(path.join(output, 'native-response-'));
  const snapshot = path.join(runDir, 'skill-snapshot');
  const hashes = await snapshotSkillBundle(sourceRoot, snapshot);
  const report = { runAt: new Date().toISOString(), skillHashes: hashes, configs,
    methodology: 'Fresh Claude CLI context and temporary workspace per case. One preserved skill snapshot is hashed and copied into every workspace. The first tool read must return the complete SKILL.md; the model selects reference files. Only Read is available. Every read path and its successful numbered tool-result content are audited against the copied skill files. Expected criteria are withheld. This tests explicit file loading, not automatic skill discovery. Execution success is not semantic success.',
    status: 'running', results: [] };
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
        const input = `Use Socrates at ${skillDir}/SKILL.md to respond to the request below. Read SKILL.md first and follow its reference-routing instructions. Use the evidence supplied in the request. Do not modify files. Respond directly to the user.\n\nUSER REQUEST:\n${c.prompt}\n`;
        await writeFile(path.join(runDir, `${id}.prompt.txt`), input, { mode: 0o600 });
        const processResult = await runProcess(buildNativeResponseCommand({ ...config, cwd: workspace, input, env }), 300000);
        const parsed = parseTranscript('claude', processResult.stdout);
        const events = processResult.stdout.split('\n').flatMap(s => { try { return [JSON.parse(s)]; } catch { return []; } });
        const audit = await auditSkillReads(parsed.tools, workspace, events);
        const denials = events.flatMap(e => e.permission_denials ?? []);
        const modelMatches = parsed.modelEvidence.length > 0 && parsed.modelEvidence.every(m => m === config.model);
        const executionOk = processResult.code === 0 && !processResult.error && !processResult.timedOut && !parsed.failed && !!parsed.response.trim() && modelMatches && audit.skillLoaded && !audit.unexpected.length && !audit.readErrors.length && !denials.length;
        const result = { id, ...config, caseId: c.id, executionOk, response: parsed.response, sessionId: parsed.sessionId, modelEvidence: parsed.modelEvidence, ...audit, permissionDenials: denials, process: processResult, semanticReview: 'pending' };
        await writeFile(path.join(runDir, `${id}.json`), JSON.stringify(result, null, 2), { mode: 0o600 });
        report.results.push(result);
        if (!executionOk) failed.add(key);
        console.log(`${id}: execution=${executionOk ? 'PASS' : 'FAIL'} reads=${audit.reads.join(',')}`);
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
