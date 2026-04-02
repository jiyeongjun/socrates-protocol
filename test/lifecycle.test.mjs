import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DOC_FILENAME,
  analyzeContextDoc,
  askToDeleteIncompleteDoc,
  askToRepairDoc,
  createState,
  getClarifyingQuestionGate,
  markQuestionAsked,
  readContextDoc,
  deleteContextDoc,
  handleDocOptIn,
  handleTaskCompletion,
  maybeStartSharedContext,
  runLifecycleFixture,
  startExecution,
  updateForClarification,
  writeContextDoc,
} from "../reference/context-doc.mjs";

test("fast-path tasks do not request shared context docs", () => {
  const result = maybeStartSharedContext({
    isFastPath: true,
    needsSharedContext: false,
  });

  assert.deepEqual(result, { action: "no_doc_needed" });
});

test("context-heavy tasks ask to create SOCRATES_CONTEXT.md first", () => {
  const result = maybeStartSharedContext({
    needsSharedContext: true,
    existingDoc: null,
  });

  assert.equal(result.action, "ask_create_doc");
  assert.match(result.message, /SOCRATES_CONTEXT\.md/);
});

test("existing doc with different task asks whether to replace it", () => {
  const result = maybeStartSharedContext({
    needsSharedContext: true,
    existingDoc: "Prior task",
    sameTask: false,
  });

  assert.equal(result.action, "ask_replace_doc");
});

test("doc opt-in decline retries once and then warns", () => {
  assert.equal(
    handleDocOptIn({ accepted: false, attempt: 1 }).action,
    "retry_doc_opt_in"
  );
  assert.equal(
    handleDocOptIn({ accepted: false, attempt: 2 }).action,
    "warn_continue_without_doc"
  );
});

test("clarification updates keep status clarifying until unknowns are resolved", () => {
  const initial = createState({
    task: "Design billing retry flow",
    knowns: ["Production billing system"],
    unknowns: ["Retry scope", "Duplicate charge handling"],
    next_question: "Which failures should remain retryable?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const next = updateForClarification(initial, {
    knowns: [...initial.knowns, "Retries must be idempotent"],
    unknowns: ["Duplicate charge handling"],
    next_question: "How should duplicate charges be prevented?",
    updated_at: "2026-03-29T00:05:00.000Z",
  });

  assert.equal(next.status, "clarifying");
  assert.equal(next.clarifying_phase, "needs_question");
  assert.deepEqual(next.unknowns, ["Duplicate charge handling"]);
});

test("clarification updates become ready when no unknowns remain", () => {
  const initial = createState({
    task: "Design billing retry flow",
    knowns: ["Production billing system"],
    unknowns: ["Retry scope"],
    next_question: "Which failures should remain retryable?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const next = updateForClarification(initial, {
    knowns: [...initial.knowns, "Only network timeouts remain retryable"],
    unknowns: [],
    next_question: null,
    decisions: ["Retry only on network timeouts with idempotency keys."],
    updated_at: "2026-03-29T00:10:00.000Z",
  });

  assert.equal(next.status, "ready");
  assert.equal(next.clarifying_phase, null);
});

test("markQuestionAsked moves clarifying state into awaiting_user_answer", () => {
  const initial = createState({
    task: "Clarify migration strategy",
    knowns: ["Public API rename"],
    unknowns: ["Cutover strategy"],
    next_question: "Should this be a hard cutover or compatibility transition?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const next = markQuestionAsked(initial, "2026-03-29T00:01:00.000Z");

  assert.equal(next.clarifying_phase, "awaiting_user_answer");
  assert.equal(getClarifyingQuestionGate(next).action, "allow");
});

test("execution start sets executing status", () => {
  const ready = createState({
    status: "ready",
    task: "Finalize rename policy",
    knowns: ["Compatibility transition is required"],
    unknowns: [],
    next_question: null,
    decisions: ["Keep both names during rollout."],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const executing = startExecution(ready, "2026-03-29T00:15:00.000Z");
  assert.equal(executing.status, "executing");
});

test("execution start rejects clarifying states with unresolved unknowns", () => {
  const clarifying = createState({
    task: "Unresolved task",
    knowns: ["One known"],
    unknowns: ["One unknown"],
    next_question: "What is still missing?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  assert.throws(
    () => startExecution(clarifying, "2026-03-29T00:15:00.000Z"),
    (error) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "invalid_transition"
  );
});

test("successful completion deletes SOCRATES_CONTEXT.md", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-success-"));
  const state = createState({
    task: "Design account deletion API",
    knowns: ["Production SaaS"],
    unknowns: ["Retention obligations"],
    next_question: "What data must be retained after deletion?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const filePath = await writeContextDoc(root, state);
  const action = handleTaskCompletion({ success: true });

  assert.equal(action.action, "delete_doc");
  await deleteContextDoc(root);
  await assert.rejects(() => readFile(filePath, "utf8"));
});

test("write/read/delete context doc round-trips through file I/O", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-io-"));
  const state = createState({
    task: "I/O round-trip",
    knowns: ["One fact"],
    unknowns: ["One open point"],
    next_question: "What remains?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  await writeContextDoc(root, state);
  const markdown = await readContextDoc(root);
  const analysis = analyzeContextDoc(markdown);
  assert.equal(analysis.ok, true);

  await deleteContextDoc(root);
  await assert.rejects(() => readContextDoc(root));
});

test("incomplete completion asks whether to delete the doc", () => {
  assert.deepEqual(handleTaskCompletion({ success: false }), askToDeleteIncompleteDoc());
  assert.equal(
    handleTaskCompletion({ success: false, deleteConfirmed: false }).action,
    "keep_doc"
  );
  assert.equal(
    handleTaskCompletion({ success: false, deleteConfirmed: true }).action,
    "delete_doc"
  );
});

test("repair prompt is used for malformed docs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-repair-"));
  const docPath = path.join(root, DOC_FILENAME);
  await writeFile(
    docPath,
    `---
version: 1
status: "clarifying"
task: "Broken"
knowns: []
unknowns: []
next_question: null
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Broken
`,
    "utf8"
  );

  const analysis = analyzeContextDoc(await readFile(docPath, "utf8"));
  assert.equal(analysis.ok, false);
  assert.deepEqual(askToRepairDoc(), {
    action: "ask_repair_doc",
    message: "Should I normalize SOCRATES_CONTEXT.md to the canonical version 2 format?",
  });
});

test("runLifecycleFixture executes the planned lifecycle sequence", () => {
  const initial = createState({
    task: "Clarify migration strategy",
    knowns: ["Public API rename"],
    unknowns: ["Cutover strategy"],
    next_question: "Should this be a hard cutover or compatibility transition?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const run = runLifecycleFixture({
    initialState: initial,
    steps: [
      { type: "maybe_start", needsSharedContext: true, existingDoc: null },
      { type: "doc_opt_in", accepted: true, attempt: 1 },
      { type: "question_asked", updated_at: "2026-03-29T00:02:00.000Z" },
      {
        type: "clarify",
        patch: {
          knowns: ["Public API rename", "Backward compatibility is required"],
          unknowns: [],
          next_question: null,
          decisions: ["Use a compatibility transition."],
          updated_at: "2026-03-29T00:05:00.000Z",
        },
      },
      { type: "start_execution", updated_at: "2026-03-29T00:10:00.000Z" },
      { type: "complete", success: true },
    ],
  });

  assert.equal(run.outputs[0].action, "ask_create_doc");
  assert.equal(run.outputs[1].action, "create_or_update_doc");
  assert.equal(run.outputs[2].state.clarifying_phase, "awaiting_user_answer");
  assert.equal(run.outputs[3].state.status, "ready");
  assert.equal(run.outputs[4].state.status, "executing");
  assert.equal(run.outputs[5].action, "delete_doc");
});
