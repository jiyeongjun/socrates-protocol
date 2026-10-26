import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runProcess, parseHostOutput, ensureSafeOutputDirectory } from "./run-live-evals.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const alignmentModels = { codex: "gpt-6-astra", claude: "claude-fable-5-1" };

// Prompts and acceptance code are held by the evaluator, never mounted in the workspace.
export const scenarios = [
  {
    id: "batch-alignment", fixture: "batch-invitations",
    turns: [
      { prompt: "Add inviteMany(emails) to the inviter. Align the intended behavior with me before implementing.", mutation: false },
      { prompt: "Decisions: emails is an array of valid strings; validation is out of scope. Process sequentially in input order, calling send once for every occurrence including repeated strings. Keep earlier successes if a send rejects, continue to later inputs, and return one object per input: {email,status:'sent'} or {email,status:'failed',error:err.message}. Send rejects with Error objects. No retries, rollback, parallelism, normalization, persistence, or new dependencies. Empty input returns []. Preserve the existing invite API and sent array semantics. Show the concrete agreement and the interaction/failure flow for review.", mutation: false },
      { prompt: "Correction: within each inviteMany call, skip every later occurrence of an exactly equal email string, even if the first occurrence failed. Return {email,status:'duplicate'} for each skipped occurrence. Deduplication resets on every call. Case and whitespace remain significant. Everything else stays as stated. Show the corrected agreement and diagram for my final review before coding.", mutation: false },
      { prompt: "I confirm the corrected agreement, including duplicates after a failed first attempt and resetting deduplication per call. Implement that scope now and verify it.", mutation: true },
    ],
    acceptance: `
import assert from 'node:assert/strict';
import { createInviter } from './inviter.mjs';
const calls=[]; let active=0; let maxActive=0;
const api=createInviter(async email=>{calls.push(email); active++; maxActive=Math.max(maxActive,active); await new Promise(r=>setTimeout(r,2)); active--; if(email==='bad') throw new Error('delivery failed');});
assert.deepEqual(await api.inviteMany(['a','bad','a','bad','b']),[
 {email:'a',status:'sent'},{email:'bad',status:'failed',error:'delivery failed'},
 {email:'a',status:'duplicate'},{email:'bad',status:'duplicate'},{email:'b',status:'sent'}]);
assert.deepEqual(calls,['a','bad','b']); assert.equal(maxActive,1);
assert.deepEqual(api.sent,['a','b']);
assert.deepEqual(await api.inviteMany([]),[]);
assert.deepEqual(await api.inviteMany(['a','A',' a']),['a','A',' a'].map(email=>({email,status:'sent'})));
assert.deepEqual(calls,['a','bad','b','a','A',' a']);
assert.deepEqual(await api.invite('a'),{email:'a',status:'sent'});
const before=[...api.sent]; await assert.rejects(()=>api.invite('bad'),/delivery failed/); assert.deepEqual(api.sent,before);
assert.deepEqual(await api.inviteMany(['bad','bad']),[{email:'bad',status:'failed',error:'delivery failed'},{email:'bad',status:'duplicate'}]);
console.log('PASS: partial failure, ordering, sequential execution, duplicates after failure, reset, exact strings, empty input, legacy success/failure');
`,
  },
  {
    id: "contradictory-intent", fixture: "batch-invitations",
    turns: [{ prompt: "Align this change before coding: inviteMany must send all emails concurrently for speed, and no send may start before the previous send has finished. Both are required. Keep the current invite method. Work out the design with me.", mutation: false }],
  },
  {
    id: "specified-edit", fixture: "batch-invitations",
    turns: [{ prompt: "In inviter.mjs, change only the successful return value of invite(email) from {email,status:'sent'} to {email,status:'delivered'}. Preserve send calls, sent array behavior and error propagation. This exact change is approved; implement it now.", mutation: true }],
    acceptance: `import assert from 'node:assert/strict'; import {createInviter} from './inviter.mjs'; const calls=[]; const api=createInviter(async e=>{calls.push(e);if(e==='bad')throw new Error('failed');}); assert.deepEqual(await api.invite('a'),{email:'a',status:'delivered'}); assert.deepEqual(api.sent,['a']); await assert.rejects(()=>api.invite('bad'),/failed/); assert.deepEqual(api.sent,['a']); assert.deepEqual(calls,['a','bad']); console.log('PASS: specified edit and preserved behavior');`,
  },
  {
    id: "learning-repair",
    turns: [{ prompt: "캐시는 원본 데이터가 바뀌면 아무 신호나 확인 없이도 즉시 그 변경을 알아차린다고 이해했어. 내 이해를 확인해줘.", mutation: false }],
  },
  {
    id: "guided-continuation",
    turns: [
      { prompt: "Use Socrates for this one learning objective. Complete code: function beforeStop(xs) { const out=[]; for (const x of xs) { if (x === 'STOP') return out; out.push(x); } return out; } I think ['a','STOP','b'] is returned unchanged because the loop visits all elements. Explain the stopping rule with a small flow. Then ask me to apply it to ['STOP','b'], leaving that answer to me.", mutation: false },
      { prompt: "For ['STOP','b'], it returns an empty array: the first item matches STOP, so return exits before pushing that item or visiting b. This was our only learning objective; briefly assess my answer and finish.", mutation: false },
    ],
  },
  {
    id: "learning-opt-out",
    turns: [{ prompt: "데이터베이스 트랜잭션의 원자성을 간단히 설명해줘. 질문이나 퀴즈 없이 답만 줘.", mutation: false }],
  },
];

export function parseTranscript(host, stdout) {
  const events = stdout.split(/\r?\n/).filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  if (host === "codex") {
    return {
      response: parseHostOutput(host, stdout).response,
      sessionId: events.find(e => e.type === "thread.started")?.thread_id,
      failed: !events.some(e => e.type === "turn.completed") || events.some(e => e.type === "turn.failed" || e.type === "error"),
      tools: events.filter(e => e.type === "item.completed" && e.item?.type !== "agent_message").map(e => e.item),
      modelEvidence: [], // CLI event stream does not always expose resolved model identity.
    };
  }
  const result = events.findLast(e => e.type === "result");
  return {
    response: result?.result ?? "",
    sessionId: result?.session_id ?? events.find(e => e.session_id)?.session_id,
    failed: !result || Boolean(result.is_error),
    tools: events.flatMap(e => e.type === "assistant" ? e.message?.content ?? [] : []).filter(e => e.type === "tool_use"),
    modelEvidence: [...new Set(events.map(e => e.message?.model ?? (e.type === "system" ? e.model : null)).filter(Boolean))],
  };
}

export function buildAlignmentCommand({ host, model, workspace, prompt, sessionId, env = process.env }) {
  if (!Object.hasOwn(alignmentModels, host)) throw new Error(`Unknown host: ${host}`);
  const effort = env.SOCRATES_ALIGNMENT_EFFORT ?? (host === "codex" ? "medium" : "high");
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) throw new Error("Unsupported alignment effort");
  const source = host === "codex" ? ".agents" : ".claude";
  const input = sessionId ? prompt : `Use the Socrates skill at ${source}/skills/socrates/SKILL.md for this request. Read its applicable references.\n${prompt}\nWork only in this temporary project. Do not access external services, install packages, or use other skills.`;
  const childEnv = { ...env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" };
  // Keep the existing account authentication. Do not copy or print credentials.
  delete childEnv.CLAUDECODE;
  const args = host === "codex"
    ? ["exec", ...(sessionId ? ["resume", sessionId] : ["--sandbox", "workspace-write"]),
      "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--json", "--model", model,
      "-c", 'approval_policy="never"', "-c", 'sandbox_mode="workspace-write"',
      "-c", 'web_search="disabled"', "-c", `model_reasoning_effort="${effort}"`, "-"]
    : ["--print", "--setting-sources", "", "--settings", '{"disableAllHooks":true,"autoMemoryEnabled":false}',
      "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--no-chrome", "--permission-mode", "acceptEdits",
      "--tools", "Read,Grep,Glob,Edit,Write,Skill,Bash", "--allowedTools", "Bash(node *)",
      "--output-format", "stream-json", "--verbose", "--model", model, "--effort", effort,
      ...(sessionId ? ["--resume", sessionId] : [])];
  return { command: env[`SOCRATES_ALIGNMENT_${host.toUpperCase()}_BIN`] ?? host, args, cwd: workspace, env: childEnv, input };
}

export async function snapshot(workspace, relative = "") {
  const files = {};
  for (const entry of await readdir(path.join(workspace, relative), { withFileTypes: true })) {
    if (!relative && entry.name === ".git") continue;
    if (relative === ".claude" && entry.name !== "skills") continue;
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) files[name] = "SYMLINK";
    else if (entry.isDirectory()) Object.assign(files, await snapshot(workspace, name));
    else files[name] = createHash("sha256").update(await readFile(path.join(workspace, name))).digest("hex");
  }
  return files;
}

export function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(name => before[name] !== after[name]).sort();
}

export async function runAlignmentEvals(env = process.env) {
  if (env.SOCRATES_LIVE_EVAL !== "1") throw new Error("Set SOCRATES_LIVE_EVAL=1 to authorize model calls");
  const host = env.SOCRATES_ALIGNMENT_HOST;
  if (!Object.hasOwn(alignmentModels, host)) throw new Error("SOCRATES_ALIGNMENT_HOST must be codex or claude");
  const model = env.SOCRATES_ALIGNMENT_MODEL ?? alignmentModels[host];
  const ids = env.SOCRATES_ALIGNMENT_CASES?.split(",");
  const selected = ids ? scenarios.filter(s => ids.includes(s.id)) : scenarios;
  if (!selected.length || (ids && (selected.length !== ids.length || ids.length !== new Set(ids).size))) throw new Error("Unknown or duplicate alignment case IDs");
  const output = path.resolve(env.SOCRATES_ALIGNMENT_OUTPUT ?? path.join(repo, ".socrates-eval-results"));
  await ensureSafeOutputDirectory(output);
  const cli = env[`SOCRATES_ALIGNMENT_${host.toUpperCase()}_BIN`] ?? host;
  const version = await runProcess({ command: cli, args: ["--version"], cwd: repo, env }, 10000);
  if (version.code !== 0 || version.timedOut || version.error) throw new Error(`Cannot run ${cli}: ${version.error ?? version.stderr}`);
  const sourceRoot = host === "codex" ? ".agents" : ".claude";
  const skillHashes = await snapshot(path.join(repo, sourceRoot, "skills/socrates"));
  const reportFile = path.join(output, `alignment-${host}-${Date.now()}.json`);
  const report = {
    runAt: new Date().toISOString(), host, requestedModel: model, effort: env.SOCRATES_ALIGNMENT_EFFORT ?? (host === "codex" ? "medium" : "high"), cliVersion: version.stdout.trim(), skillHashes, selectedCases: selected.map(s => s.id), status: "running",
    isolation: "Fresh temp workspaces; native account auth retained; Codex user config/rules ignored; Claude setting sources/hooks/MCP disabled. Global skill discovery may remain; explicit local skill path is used. CLI sessions are retained for multi-turn continuation.",
    evaluation: "File snapshots and independent acceptance tests are mechanical evidence. Review raw tool traces for attempted edits, requirement/diagram consistency, and question quality; no semantic pass is inferred from regex or absence of a diff.",
    cases: [],
  };
  const save = () => writeFile(reportFile, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await save();
  let executionFailed = false;
  for (const scenario of selected) {
    const workspace = await mkdtemp(path.join(tmpdir(), `socrates-alignment-${host}-`));
    const result = { id: scenario.id, workspace, turns: [], acceptance: null, error: null };
    report.cases.push(result);
    try {
      if (scenario.fixture) await cp(path.join(repo, "evals/fixtures", scenario.fixture), workspace, { recursive: true });
      const source = host === "codex" ? ".agents" : ".claude";
      const skillPath = path.join(workspace, source, "skills/socrates");
      await mkdir(path.dirname(skillPath), { recursive: true });
      await cp(path.join(repo, source, "skills/socrates"), skillPath, { recursive: true });
      result.skillHashes = await snapshot(skillPath);
      const initial = await snapshot(workspace);
      let sessionId;
      for (const [index, turn] of scenario.turns.entries()) {
        const before = await snapshot(workspace);
        const invocation = buildAlignmentCommand({ host, model, workspace, prompt: turn.prompt, sessionId, env });
        await writeFile(path.join(workspace, ".eval-prompt.txt"), invocation.input, { mode: 0o600 });
        const processResult = await runProcess(invocation, 300000);
        await rm(path.join(workspace, ".eval-prompt.txt"));
        const parsed = parseTranscript(host, processResult.stdout);
        const after = await snapshot(workspace);
        const changed = changedFiles(before, after);
        const processOk = processResult.code === 0 && !processResult.timedOut && !processResult.error && !parsed.failed && Boolean(parsed.response);
        result.turns.push({ index: index + 1, prompt: turn.prompt, expectedMutation: turn.mutation, changedFiles: changed,
          mutationCheck: turn.mutation ? changed.length > 0 : changed.length === 0, processOk,
          response: parsed.response, tools: parsed.tools, modelEvidence: parsed.modelEvidence,
          process: processResult });
        await save();
        process.stdout.write(`${host} ${scenario.id} turn ${index + 1}: process=${processOk} changed=${changed.join(",") || "none"}\n`);
        if (!processOk) {
          executionFailed = true;
          throw new Error("Model turn failed; remaining cases not run. Inspect the report before retrying.");
        }
        if (!turn.mutation && changed.length) throw new Error("Mutation before confirmation");
        sessionId = parsed.sessionId ?? sessionId;
        if (!sessionId && index < scenario.turns.length - 1) throw new Error("Missing session ID; refusing to fabricate continuity");
      }
      if (scenario.acceptance) {
        // Send hidden acceptance code to Node as an argument only after model work has ended.
        result.acceptance = await runProcess({ command: process.execPath, args: ["--input-type=module", "-e", scenario.acceptance], cwd: workspace, env: process.env }, 30000);
      }
      result.changedFiles = changedFiles(initial, await snapshot(workspace));
      result.artifacts = {};
      for (const name of result.changedFiles) {
        try { result.artifacts[name] = await readFile(path.join(workspace, name), "utf8"); } catch { result.artifacts[name] = null; }
      }
    } catch (error) { result.error = error.message; }
    finally {
      await rm(workspace, { recursive: true, force: true });
      result.workspaceRemoved = true;
      await save();
    }
    if (executionFailed) break;
  }
  report.status = executionFailed ? "execution-failed" : "completed";
  report.mechanicalPassed = report.cases.length === selected.length && report.cases.every(c => !c.error && c.turns.every(t => t.processOk && t.mutationCheck) && (!c.acceptance || (c.acceptance.code === 0 && !c.acceptance.timedOut && !c.acceptance.error)));
  report.semanticReview = "pending";
  await save();
  process.stdout.write(`Report: ${reportFile}\nMechanical checks: ${report.mechanicalPassed ? "PASS" : "FAIL"}; semantic review required\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runAlignmentEvals().then(report => { if (!report.mechanicalPassed) process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
