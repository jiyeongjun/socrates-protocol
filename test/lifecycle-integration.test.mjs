import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  askToRepairDoc,
  createState,
  deleteContextDoc,
  handleDocOptIn,
  handleTaskCompletion,
  markQuestionAsked,
  maybeStartSharedContext,
  startExecution,
  updateForClarification,
  writeContextDoc,
} from "../reference/context-doc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const runtimes = {
  codex: {
    sessionStartScript: path.join(
      repoRoot,
      ".codex",
      "hooks",
      "session_start_socrates_context.mjs"
    ),
    stopScript: path.join(
      repoRoot,
      ".codex",
      "hooks",
      "stop_socrates_clarifying.mjs"
    ),
    extractSessionContext(output) {
      if (!output.stdout.trim()) {
        return "";
      }
      return JSON.parse(output.stdout).hookSpecificOutput.additionalContext;
    },
  },
  claude: {
    sessionStartScript: path.join(
      repoRoot,
      ".claude",
      "hooks",
      "session_start_socrates_context.mjs"
    ),
    stopScript: path.join(
      repoRoot,
      ".claude",
      "hooks",
      "stop_socrates_clarifying.mjs"
    ),
    extractSessionContext(output) {
      return output.stdout.trim();
    },
  },
};

function runScript(scriptPath, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}

async function runSessionStart(runtimeName, cwd, source = "resume") {
  const runtime = runtimes[runtimeName];
  const result = await runScript(runtime.sessionStartScript, {
    cwd,
    hook_event_name: "SessionStart",
    source,
  });

  return {
    ...result,
    context: runtime.extractSessionContext(result),
  };
}

async function runStop(runtimeName, cwd, lastAssistantMessage, stopHookActive = false) {
  const runtime = runtimes[runtimeName];
  return runScript(runtime.stopScript, {
    cwd,
    hook_event_name: "Stop",
    stop_hook_active: stopHookActive,
    last_assistant_message: lastAssistantMessage,
  });
}

for (const runtimeName of Object.keys(runtimes)) {
  test(`${runtimeName} lifecycle stays inactive on fast-path tasks`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), `socrates-${runtimeName}-fast-`));
    const decision = maybeStartSharedContext({
      isFastPath: true,
      needsSharedContext: false,
    });

    assert.deepEqual(decision, { action: "no_doc_needed" });

    const session = await runSessionStart(runtimeName, root, "startup");
    assert.equal(session.context, "");

    const stop = await runStop(
      runtimeName,
      root,
      "I wrote the helper directly because the task was explicit."
    );
    assert.equal(stop.code, 0);
    assert.equal(stop.stderr, "");
  });

  test(`${runtimeName} clarifying lifecycle keeps prompting until ready, then cleans up`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), `socrates-${runtimeName}-clarifying-`));

    const start = maybeStartSharedContext({
      needsSharedContext: true,
      existingDoc: null,
    });
    assert.equal(start.action, "ask_create_doc");

    const optIn = handleDocOptIn({ accepted: true, attempt: 1 });
    assert.equal(optIn.action, "create_or_update_doc");

    const clarifying = createState({
      task: "Clarify retry policy",
      knowns: ["Production service", "Retries must be idempotent"],
      unknowns: ["Retry scope"],
      next_question: "Which failures should remain retryable?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    });

    await writeContextDoc(root, clarifying);

    const session = await runSessionStart(runtimeName, root, "resume");
    assert.match(session.context, /SOCRATES_CONTEXT\.md/);
    assert.match(session.context, /canonical persisted state/);
    assert.match(session.context, /clarifying_phase/);

    const stopWhileClarifying = await runStop(
      runtimeName,
      root,
      "I have enough context now and will implement the retry change."
    );
    assert.equal(stopWhileClarifying.code, 2);
    assert.match(stopWhileClarifying.stderr, /Ask this next load-bearing question:/);
    assert.match(
      stopWhileClarifying.stderr,
      /Which failures should remain retryable\?/
    );
    assert.match(stopWhileClarifying.stderr, /awaiting_user_answer/);

    const stopAfterQuestionWithoutStateUpdate = await runStop(
      runtimeName,
      root,
      "Which failures should remain retryable?"
    );
    assert.equal(stopAfterQuestionWithoutStateUpdate.code, 2);
    assert.match(
      stopAfterQuestionWithoutStateUpdate.stderr,
      /awaiting_user_answer/
    );

    const awaitingUserAnswer = markQuestionAsked(
      clarifying,
      "2026-03-29T00:05:00.000Z"
    );
    await writeContextDoc(root, awaitingUserAnswer);

    const stopWhileAwaitingUser = await runStop(
      runtimeName,
      root,
      "Which failures should remain retryable?"
    );
    assert.equal(stopWhileAwaitingUser.code, 0);
    assert.equal(stopWhileAwaitingUser.stderr, "");

    const ready = updateForClarification(awaitingUserAnswer, {
      knowns: [...awaitingUserAnswer.knowns, "Only network timeouts remain retryable"],
      unknowns: [],
      next_question: null,
      decisions: ["Retry only network timeouts with idempotency keys."],
      updated_at: "2026-03-29T00:10:00.000Z",
    });
    await writeContextDoc(root, ready);

    const stopWhenReady = await runStop(
      runtimeName,
      root,
      "I finalized the retry policy and can move to implementation."
    );
    assert.equal(stopWhenReady.code, 0);
    assert.equal(stopWhenReady.stderr, "");

    const executing = startExecution(ready, "2026-03-29T00:15:00.000Z");
    await writeContextDoc(root, executing);

    const stopWhenExecuting = await runStop(
      runtimeName,
      root,
      "I started implementing the retry policy."
    );
    assert.equal(stopWhenExecuting.code, 0);

    const completion = handleTaskCompletion({ success: true });
    assert.equal(completion.action, "delete_doc");
    await deleteContextDoc(root);

    const sessionAfterDelete = await runSessionStart(runtimeName, root, "resume");
    assert.equal(sessionAfterDelete.context, "");
  });

  test(`${runtimeName} stays inactive when shared context is declined twice`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), `socrates-${runtimeName}-decline-`));
    const start = maybeStartSharedContext({
      needsSharedContext: true,
      existingDoc: null,
    });
    assert.equal(start.action, "ask_create_doc");

    const retry = handleDocOptIn({ accepted: false, attempt: 1 });
    assert.equal(retry.action, "retry_doc_opt_in");

    const warn = handleDocOptIn({ accepted: false, attempt: 2 });
    assert.equal(warn.action, "warn_continue_without_doc");

    const session = await runSessionStart(runtimeName, root, "resume");
    assert.equal(session.context, "");

    const stop = await runStop(
      runtimeName,
      root,
      "I answered directly without any persisted Socrates context."
    );
    assert.equal(stop.code, 0);
    assert.equal(stop.stderr, "");
  });

  test(`${runtimeName} malformed persisted context points to repair and keeps stop inactive`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), `socrates-${runtimeName}-malformed-`));
    await writeFile(
      path.join(root, "SOCRATES_CONTEXT.md"),
      `---
version: 1
status: clarifying
task: "Broken"
knowns: []
unknowns: []
next_question: null
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context
`,
      "utf8"
    );

    assert.deepEqual(askToRepairDoc(), {
      action: "ask_repair_doc",
      message: "Should I normalize SOCRATES_CONTEXT.md to the canonical version 2 format?",
    });

    const session = await runSessionStart(runtimeName, root, "resume");
    assert.match(session.context, /normalize SOCRATES_CONTEXT\.md to the canonical version 2 format/);
    assert.match(session.context, /context-doc\.mjs|socrates_context_doc_helper\.mjs/);

    const stop = await runStop(
      runtimeName,
      root,
      "I summarized the retry policy and am ready to implement."
    );
    assert.equal(stop.code, 0);
    assert.equal(stop.stderr, "");
  });
}
