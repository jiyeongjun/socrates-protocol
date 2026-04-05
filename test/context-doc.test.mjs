import test from "node:test";
import assert from "node:assert/strict";
import {
  CLARIFYING_PHASES,
  ContextDocError,
  CURRENT_VERSION,
  FIXED_HEADINGS,
  LEGACY_VERSION,
  analyzeContextDoc,
  createState,
  getClarifyingQuestionGate,
  getContextDocRepairPlan,
  getTurnContinuationGate,
  markQuestionAsked,
  parseContextDoc,
  renderContextDoc,
  startExecution,
  updateForClarification,
} from "../reference/context-doc.mjs";

test("renderContextDoc renders version 3 frontmatter without execution micro-state", () => {
  const state = createState({
    task: "Design account deletion API",
    knowns: ["Production SaaS", "GDPR-compliant"],
    unknowns: ["Deletion semantics", "Retention obligations"],
    next_question:
      "Should deletion be hard delete, soft delete, or async delete with a grace period?",
    decisions: ["Keep one shared context file only when needed."],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const output = renderContextDoc(state);
  assert.equal(
    output,
    `---
version: 3
status: "clarifying"
task: "Design account deletion API"
knowns:
  - "Production SaaS"
  - "GDPR-compliant"
unknowns:
  - "Deletion semantics"
  - "Retention obligations"
next_question: "Should deletion be hard delete, soft delete, or async delete with a grace period?"
clarifying_phase: "needs_question"
decisions:
  - "Keep one shared context file only when needed."
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Design account deletion API

## What Socrates Knows
- Production SaaS
- GDPR-compliant

## What Socrates Still Needs
- Deletion semantics
- Retention obligations

## Next Question
Should deletion be hard delete, soft delete, or async delete with a grace period?

## Fixed Decisions
- Keep one shared context file only when needed.

## Status
clarifying
`
  );
});

test("parseContextDoc round-trips rendered version 3 output", () => {
  const original = createState({
    status: "ready",
    task: "Clarify retry policy",
    knowns: ["Retries only for idempotent operations"],
    unknowns: [],
    next_question: null,
    decisions: ["Do not create a shared context doc on fast-path tasks."],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const rendered = renderContextDoc(original);
  const parsed = parseContextDoc(rendered);
  assert.deepEqual(parsed.state, original);
});

test("parseContextDoc rejects legacy version 1 docs as non-canonical", () => {
  const legacy = `---
version: 1
status: "clarifying"
task: "Clarify retry policy"
knowns:
  - "Production service"
unknowns:
  - "Retry scope"
next_question: "Which failures should remain retryable?"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Clarify retry policy

## What Socrates Knows
- Production service

## What Socrates Still Needs
- Retry scope

## Next Question
Which failures should remain retryable?

## Fixed Decisions
- None.

## Status
clarifying
`;

  assert.throws(
    () => parseContextDoc(legacy),
    (error) =>
      error instanceof ContextDocError && error.code === "invalid_version"
  );
});

test("renderContextDoc handles empty lists and null next_question", () => {
  const state = createState({
    status: "ready",
    task: "Rename API_HOST",
    knowns: ["The rename crosses a compatibility boundary."],
    unknowns: [],
    next_question: null,
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const output = renderContextDoc(state);
  assert.match(output, /unknowns: \[\]/);
  assert.match(output, /clarifying_phase: null/);
  assert.match(output, /decisions: \[\]/);
  assert.match(output, /## Next Question\nNone\./);
  assert.match(output, /## Fixed Decisions\n- None\./);
  assert.doesNotMatch(output, /workflow_phase/);
  assert.doesNotMatch(output, /handoff_question/);
  assert.doesNotMatch(output, /repair_attempts/);
  assert.doesNotMatch(output, /evaluation_attempts/);
});

test("createState rejects invalid status", () => {
  assert.throws(
    () =>
      createState({
        status: "done",
        task: "Invalid state",
      }),
    (error) =>
      error instanceof ContextDocError && error.code === "invalid_status"
  );
});

test("parseContextDoc rejects clarifying states with an explicit null phase", () => {
  assert.throws(
    () =>
      parseContextDoc(`---
version: 3
status: "clarifying"
task: "Broken"
knowns: []
unknowns:
  - "One unknown"
next_question: "What remains?"
clarifying_phase: null
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Broken

## What Socrates Knows
- None.

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`),
    (error) =>
      error instanceof ContextDocError &&
      error.code === "invalid_status_shape"
  );
});

test("analyzeContextDoc accepts rendered docs with fixed headings and trailing notes", () => {
  const rendered = `${renderContextDoc(
    createState({
      task: "Inspect auth retry behavior",
      knowns: ["There is only one auth module."],
      unknowns: ["Which failures should remain retryable?"],
      next_question: "Which failures should remain retryable?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  )}\n## Notes\n- user-added note\n`;

  const analysis = analyzeContextDoc(rendered);
  assert.equal(analysis.ok, true);
  for (const heading of FIXED_HEADINGS) {
    assert.match(rendered, new RegExp(`## ${heading}`));
  }
});

test("analyzeContextDoc rejects required body drift from canonical frontmatter", () => {
  const rendered = renderContextDoc(
    createState({
      task: "Design delete flow",
      knowns: ["Production system"],
      unknowns: ["Retention obligations"],
      next_question: "What retained data is legally required?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  ).replace("## Task\nDesign delete flow", "## Task\nDifferent task");

  const analysis = analyzeContextDoc(rendered);
  assert.equal(analysis.ok, false);
  assert.equal(analysis.reason, "body_mismatch");
});

test("analyzeContextDoc accepts canonical docs without a trailing newline", () => {
  const rendered = renderContextDoc(
    createState({
      task: "Trailing newline tolerance",
      knowns: ["One fact"],
      unknowns: ["One unknown"],
      next_question: "What remains?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  ).slice(0, -1);

  const analysis = analyzeContextDoc(rendered);
  assert.equal(analysis.ok, true);
});

test("parseContextDoc accepts CRLF frontmatter delimiters", () => {
  const rendered = renderContextDoc(
    createState({
      task: "CRLF task",
      knowns: ["One fact"],
      unknowns: ["One unknown"],
      next_question: "What remains?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  ).replace(/\n/g, "\r\n");

  const parsed = parseContextDoc(rendered);
  assert.equal(parsed.state.task, "CRLF task");
});

test("parseContextDoc rejects docs without a closing frontmatter delimiter", () => {
  assert.throws(
    () =>
      parseContextDoc(`---
version: 3
status: "clarifying"
task: "Broken"
knowns: []
unknowns:
  - "One unknown"
next_question: "What remains?"
clarifying_phase: "needs_question"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
`),
    (error) =>
      error instanceof ContextDocError &&
      error.code === "missing_frontmatter_end"
  );
});

test("parseContextDoc rejects invalid frontmatter lines", () => {
  assert.throws(
    () =>
      parseContextDoc(`---
version: 3
status "clarifying"
task: "Broken"
knowns: []
unknowns:
  - "One unknown"
next_question: "What remains?"
clarifying_phase: "needs_question"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Broken

## What Socrates Knows
- None.

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`),
    (error) =>
      error instanceof ContextDocError &&
      error.code === "invalid_frontmatter_line"
  );
});

test("parseContextDoc rejects empty string entries in arrays", () => {
  assert.throws(
    () =>
      parseContextDoc(`---
version: 3
status: "clarifying"
task: "Broken"
knowns:
  - "Valid"
  - ""
unknowns:
  - "One unknown"
next_question: "What remains?"
clarifying_phase: "needs_question"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Broken

## What Socrates Knows
- Valid
- 

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`),
    (error) =>
      error instanceof ContextDocError && error.code === "invalid_knowns"
  );
});

test("render and parse support quoted strings and escaped newlines", () => {
  const state = createState({
    task: 'Clarify "quoted" retry policy',
    knowns: ['Line one\nLine two', "Backslash \\\\ path"],
    unknowns: ['What does "safe" mean here?'],
    next_question: 'Should "safe" mean idempotent-only retries?\nAnswer with one rule.',
    decisions: ['Keep "quoted" values as-is.'],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const rendered = renderContextDoc(state);
  const parsed = parseContextDoc(rendered);
  assert.deepEqual(parsed.state, state);
});

test("getContextDocRepairPlan rebuilds the canonical body from valid frontmatter", () => {
  const drifted = renderContextDoc(
    createState({
      task: "Design delete flow",
      knowns: ["Production system"],
      unknowns: ["Retention obligations"],
      next_question: "What retained data is legally required?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  ).replace("## Task\nDesign delete flow", "## Task\nDifferent task");

  const plan = getContextDocRepairPlan(drifted);
  assert.equal(plan.action, "repair");
  assert.equal(plan.reason, "body_mismatch");
  assert.equal(plan.source, "frontmatter");
  assert.match(plan.markdown, /^---\nversion: 3\nstatus: "clarifying"/);
  assert.match(plan.markdown, /clarifying_phase: "needs_question"/);
  assert.match(plan.markdown, /## Task\nDesign delete flow/);
  assert.doesNotMatch(plan.markdown, /workflow_phase/);
});

test("getContextDocRepairPlan repairs current-version docs with extra frontmatter keys", () => {
  const drifted = renderContextDoc(
    createState({
      task: "Repair frontmatter drift",
      knowns: ["One fact"],
      unknowns: ["One unknown"],
      next_question: "What remains?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  ).replace(
    "decisions: []",
    'workflow_phase: "needs_evaluation"\ndecisions: []'
  );

  const plan = getContextDocRepairPlan(drifted);
  assert.equal(plan.action, "repair");
  assert.equal(plan.reason, "frontmatter_drift");
  assert.doesNotMatch(plan.markdown, /workflow_phase/);
});

test("getContextDocRepairPlan marks canonical legacy docs as repairable", () => {
  const legacy = `---
version: ${LEGACY_VERSION}
status: "clarifying"
task: "Clarify retry policy"
knowns:
  - "Production service"
unknowns:
  - "Retry scope"
next_question: "Which failures should remain retryable?"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Clarify retry policy

## What Socrates Knows
- Production service

## What Socrates Still Needs
- Retry scope

## Next Question
Which failures should remain retryable?

## Fixed Decisions
- None.

## Status
clarifying
`;

  const plan = getContextDocRepairPlan(legacy);
  assert.equal(plan.action, "repair");
  assert.equal(plan.reason, "legacy_version");
  assert.equal(plan.source, "frontmatter");
  assert.match(plan.markdown, /^---\nversion: 3\nstatus: "clarifying"/);
  assert.doesNotMatch(plan.markdown, /workflow_phase/);
});

test("getContextDocRepairPlan reports body-only docs as unrepairable", () => {
  const bodyOnly = `## Task
Clarify retry policy

## What Socrates Knows
- Production service

## What Socrates Still Needs
- Retry scope

## Next Question
Which failures should remain retryable?

## Fixed Decisions
- None.

## Status
clarifying
`;

  const plan = getContextDocRepairPlan(bodyOnly);
  assert.equal(plan.action, "unrepairable");
  assert.equal(plan.reason, "missing_frontmatter");
});

test("markQuestionAsked transitions clarifying work to awaiting_user_answer", () => {
  const initial = createState({
    task: "Clarify retry policy",
    knowns: ["Production service"],
    unknowns: ["Retry scope"],
    next_question: "Which failures should remain retryable?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const next = markQuestionAsked(initial, "2026-03-29T00:05:00.000Z");
  assert.equal(next.clarifying_phase, "awaiting_user_answer");
  assert.equal(getClarifyingQuestionGate(next).action, "allow");
});

test("updateForClarification resets clarifying work back to needs_question", () => {
  const awaiting = markQuestionAsked(
    createState({
      task: "Clarify retry policy",
      knowns: ["Production service"],
      unknowns: ["Retry scope"],
      next_question: "Which failures should remain retryable?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    }),
    "2026-03-29T00:05:00.000Z"
  );

  const next = updateForClarification(awaiting, {
    knowns: ["Production service", "Retries must be idempotent"],
    unknowns: ["Duplicate charge handling"],
    next_question: "How should duplicate charges be prevented?",
    updated_at: "2026-03-29T00:10:00.000Z",
  });

  assert.equal(next.status, "clarifying");
  assert.equal(next.clarifying_phase, "needs_question");
});

test("updateForClarification becomes ready when no unknowns remain", () => {
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

test("markQuestionAsked rejects non-clarifying states", () => {
  const ready = createState({
    status: "ready",
    task: "Clarified retry policy",
    knowns: ["Only network timeouts remain retryable"],
    unknowns: [],
    next_question: null,
    decisions: ["Retry only on network timeouts with idempotency keys."],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  assert.throws(
    () => markQuestionAsked(ready, "2026-03-29T00:05:00.000Z"),
    (error) =>
      error instanceof ContextDocError && error.code === "invalid_transition"
  );
});

test("updateForClarification preserves awaiting_user_answer when only decisions change", () => {
  const awaiting = markQuestionAsked(
    createState({
      task: "Clarify retry policy",
      knowns: ["Production service"],
      unknowns: ["Retry scope"],
      next_question: "Which failures should remain retryable?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    }),
    "2026-03-29T00:05:00.000Z"
  );

  const next = updateForClarification(awaiting, {
    decisions: ["Retry decisions must stay backward-compatible."],
    updated_at: "2026-03-29T00:10:00.000Z",
  });

  assert.equal(next.status, "clarifying");
  assert.equal(next.clarifying_phase, "awaiting_user_answer");
  assert.equal(next.next_question, "Which failures should remain retryable?");
});

test("updateForClarification ignores explicit awaiting_user_answer when a new question is introduced", () => {
  const awaiting = markQuestionAsked(
    createState({
      task: "Clarify retry policy",
      knowns: ["Production service"],
      unknowns: ["Retry scope"],
      next_question: "Which failures should remain retryable?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    }),
    "2026-03-29T00:05:00.000Z"
  );

  const next = updateForClarification(awaiting, {
    unknowns: ["Duplicate charge handling"],
    next_question: "How should duplicate charges be prevented?",
    clarifying_phase: "awaiting_user_answer",
    updated_at: "2026-03-29T00:10:00.000Z",
  });

  assert.equal(next.status, "clarifying");
  assert.equal(next.clarifying_phase, "needs_question");
  assert.deepEqual(getClarifyingQuestionGate(next), {
    action: "continue",
    next_question: "How should duplicate charges be prevented?",
  });
});

test("startExecution transitions ready work to executing", () => {
  const ready = createState({
    status: "ready",
    task: "Clarified retry policy",
    knowns: ["Only network timeouts remain retryable"],
    unknowns: [],
    next_question: null,
    decisions: ["Retry only on network timeouts with idempotency keys."],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const next = startExecution(ready, "2026-03-29T00:05:00.000Z");
  assert.equal(next.status, "executing");
  assert.equal(next.clarifying_phase, null);
  assert.equal(next.updated_at, "2026-03-29T00:05:00.000Z");
});

test("startExecution rejects non-ready states", () => {
  const clarifying = createState({
    task: "Clarify retry policy",
    knowns: ["Production service"],
    unknowns: ["Retry scope"],
    next_question: "Which failures should remain retryable?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  assert.throws(
    () => startExecution(clarifying, "2026-03-29T00:05:00.000Z"),
    (error) =>
      error instanceof ContextDocError && error.code === "invalid_transition"
  );
});

test("clarifying gates only block while a question still needs asking", () => {
  const needsQuestion = createState({
    task: "Clarify retry policy",
    knowns: ["Production service"],
    unknowns: ["Retry scope"],
    next_question: "Which failures should remain retryable?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  assert.deepEqual(CLARIFYING_PHASES, [
    "needs_question",
    "awaiting_user_answer",
  ]);
  assert.equal(CURRENT_VERSION, 3);
  assert.deepEqual(getClarifyingQuestionGate(needsQuestion), {
    action: "continue",
    next_question: "Which failures should remain retryable?",
  });
  assert.deepEqual(getTurnContinuationGate(needsQuestion), {
    action: "continue",
    kind: "clarifying_question",
    next_question: "Which failures should remain retryable?",
  });
});

test("getTurnContinuationGate allows ready and executing states", () => {
  const ready = createState({
    status: "ready",
    task: "Clarified retry policy",
    knowns: ["Only network timeouts remain retryable"],
    unknowns: [],
    next_question: null,
    decisions: ["Retry only on network timeouts with idempotency keys."],
    updated_at: "2026-03-29T00:00:00.000Z",
  });
  const executing = startExecution(ready, "2026-03-29T00:05:00.000Z");

  assert.deepEqual(getTurnContinuationGate(ready), {
    action: "allow",
    kind: null,
    next_question: null,
  });
  assert.deepEqual(getTurnContinuationGate(executing), {
    action: "allow",
    kind: null,
    next_question: null,
  });
});
