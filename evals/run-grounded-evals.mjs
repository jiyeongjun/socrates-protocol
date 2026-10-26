import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runProcess, ensureSafeOutputDirectory } from './run-live-evals.mjs';
import { parseTranscript } from './run-alignment-evals.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const modelMatrix = [
  ...['gpt-6-luna', 'gpt-6-sol', 'gpt-6-astra'].map(model => ({ host: 'codex', model })),
  ...['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'].map(model => ({ host: 'claude', model })),
].flatMap(config => ['low', 'high'].map(effort => ({ ...config, effort })));

export function buildGroundedCommand({ host, model, effort, cwd, input, env = process.env }) {
  if (!['claude', 'codex'].includes(host)) throw new Error('Unknown host');
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new Error('Unsupported effort');
  const childEnv = { ...env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
  delete childEnv.CLAUDECODE;
  const args = host === 'claude'
    ? ['--print', '--model', model, '--effort', effort, '--output-format', 'stream-json', '--verbose',
       '--tools', '', '--setting-sources', '', '--settings', '{"disableAllHooks":true,"autoMemoryEnabled":false}',
       '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-chrome']
    : ['exec', '--model', model, '-c', `model_reasoning_effort="${effort}"`, '--json',
       '--sandbox', 'read-only', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check',
       '--ephemeral', '-c', 'web_search="disabled"', '-c', 'approval_policy="never"', '-'];
  return { command: env[`SOCRATES_GROUNDED_${host.toUpperCase()}_BIN`] ?? host, args, cwd, env: childEnv, input };
}

export async function runGroundedEvals(env = process.env) {
  if (env.SOCRATES_LIVE_EVAL !== '1') throw new Error('Set SOCRATES_LIVE_EVAL=1 to authorize model calls');
  const cases = JSON.parse(await readFile(path.join(root, 'evals/grounded-learning-cases.json'), 'utf8'));
  const selectedIds = env.SOCRATES_GROUNDED_CASES?.split(',').map(s => s.trim());
  const selected = selectedIds ? cases.filter(c => selectedIds.includes(c.id)) : cases;
  if (!selected.length || (selectedIds && new Set(selectedIds).size !== selectedIds.length) || (selectedIds && selected.length !== selectedIds.length)) throw new Error('Unknown or duplicate cases');
  const configs = env.SOCRATES_GROUNDED_MODEL
    ? [{ host: env.SOCRATES_GROUNDED_HOST, model: env.SOCRATES_GROUNDED_MODEL, effort: env.SOCRATES_GROUNDED_EFFORT }]
    : env.SOCRATES_GROUNDED_HOST ? modelMatrix.filter(c => c.host === env.SOCRATES_GROUNDED_HOST) : modelMatrix;
  if (!configs.length) throw new Error('Unknown host');
  // Validate host and effort syntax; account/model availability is established by execution.
  for (const config of configs) buildGroundedCommand({ ...config, cwd: root, input: '', env });
  const concurrency = Number(env.SOCRATES_GROUNDED_CONCURRENCY ?? 3);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1–4');
  const output = path.resolve(env.SOCRATES_GROUNDED_OUTPUT ?? path.join(root, '.socrates-eval-results'));
  await ensureSafeOutputDirectory(output);
  const runDir = await mkdtemp(path.join(output, 'grounded-'));
  const skillPaths = ['reference/skill-body.md', ...['guided-learning', 'implementation-alignment', 'visual-explanations', 'audience-calibration'].map(n => `reference/skill-references/${n}.md`)];
  const sources = await Promise.all(skillPaths.map(async p => ({ path: p, text: await readFile(path.join(root, p), 'utf8') })));
  const bundle = sources.map(s => `--- ${s.path} ---\n${s.text}`).join('\n\n');
  const versions = {};
  for (const host of new Set(configs.map(c => c.host))) {
    const version = await runProcess({ command: env[`SOCRATES_GROUNDED_${host.toUpperCase()}_BIN`] ?? host, args: ['--version'], cwd: root, env }, 10000);
    if (version.code !== 0 || version.error || version.timedOut) throw new Error(`Cannot run ${host}`);
    versions[host] = version.stdout.trim();
  }
  const report = {
    runAt: new Date().toISOString(), versions, configs,
    skillHashes: Object.fromEntries(sources.map(s => [s.path, createHash('sha256').update(s.text).digest('hex')])),
    methodology: 'Each case uses a fresh native CLI invocation and empty temporary workspace. Skill and references are supplied inline; grader criteria are omitted from prompts. Prior lesson turns are supplied as a vignette, not an actual resumed session. Native account authentication is retained. Claude tools/hooks/MCP are disabled; Codex is read-only with user config ignored, but read access and global skill discovery remain possible. Tool use invalidates a response-only case. This measures response behavior under explicit skill instructions, not discovery, durable state, or a causal skill/control advantage. A completed execution is not a semantic pass.',
    semanticReview: 'pending', status: 'running', results: [],
  };
  await writeFile(path.join(runDir, 'manifest.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  const jobs = configs.flatMap(config => selected.map(c => ({ config, c })));
  const failedConfigs = new Set();
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const { config, c } = jobs[cursor++];
      const configKey = `${config.host}-${config.model}-${config.effort}`;
      const id = `${configKey}-${c.id}`;
      if (failedConfigs.has(configKey)) {
        report.results.push({ id, ...config, caseId: c.id, executionOk: false, skipped: 'Earlier execution failed for this configuration; no automatic fallback or retry.' });
        continue;
      }
      const workspace = await mkdtemp(path.join(tmpdir(), 'socrates-grounded-'));
      try {
        const input = `Apply the supplied Socrates skill to the user's request. All necessary source and references are included below. Do not use tools or access external resources. Respond directly to the user, not with an evaluation report.\n\n${bundle}\n\n--- USER REQUEST ---\n${c.prompt}\n`;
        await writeFile(path.join(runDir, `${id}.prompt.txt`), input, { mode: 0o600 });
        const invocation = buildGroundedCommand({ ...config, cwd: workspace, input, env });
        const processResult = await runProcess(invocation, 300000);
        const parsed = parseTranscript(config.host, processResult.stdout);
        const events = processResult.stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
        const denials = events.flatMap(e => e.permission_denials ?? []);
        const modelMatches = config.host === 'claude' ? parsed.modelEvidence.length > 0 && parsed.modelEvidence.every(m => m === config.model) : null;
        const toolUsed = config.host === 'claude' ? parsed.tools.length > 0 : parsed.tools.some(t => ['command_execution', 'file_change', 'mcp_tool_call', 'web_search'].includes(t.type));
        const executionOk = processResult.code === 0 && !processResult.error && !processResult.timedOut && !parsed.failed && !!parsed.response.trim() && denials.length === 0 && modelMatches !== false && !toolUsed;
        const result = { id, ...config, caseId: c.id, executionOk, sessionId: parsed.sessionId, modelEvidence: parsed.modelEvidence,
          response: parsed.response, criteria: c.criteria, tools: parsed.tools, toolUsed, modelMatches, permissionDenials: denials, process: processResult, semanticReview: 'pending' };
        await writeFile(path.join(runDir, `${id}.json`), JSON.stringify(result, null, 2), { mode: 0o600 });
        report.results.push(result);
        if (!executionOk) failedConfigs.add(configKey);
        console.log(`${id}: execution=${executionOk ? 'PASS' : 'FAIL'} ${Math.round(processResult.wallTimeMs / 1000)}s`);
      } catch (error) {
        failedConfigs.add(configKey);
        report.results.push({ id, ...config, caseId: c.id, executionOk: false, error: error.message, semanticReview: 'pending' });
        console.error(`${id}: execution=FAIL ${error.message}`);
      } finally {
        try { await rm(workspace, { recursive: true, force: true }); }
        catch (error) {
          failedConfigs.add(configKey);
          const result = report.results.find(r => r.id === id);
          if (result) { result.executionOk = false; result.cleanupError = error.message; }
        }
      }
    }
  }
  console.log(`Report directory: ${runDir}; ${jobs.length} fresh cases, concurrency ${concurrency}`);
  await Promise.all(Array.from({ length: concurrency }, worker));
  report.status = report.results.every(r => r.executionOk) ? 'completed' : 'execution-failed';
  await writeFile(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Report: ${runDir}/report.json; semantic review required`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runGroundedEvals().then(r => { if (r.status !== 'completed') process.exitCode = 1; }).catch(e => { console.error(e.message); process.exitCode = 1; });
}
