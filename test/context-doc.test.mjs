import test from "node:test";
import assert from "node:assert/strict";
import {
  ContextDocError,
  FIXED_HEADINGS,
  analyzeContextDoc,
  createState,
  parseContextDoc,
  renderContextDoc,
} from "../reference/context-doc.mjs";

test("renderContextDoc renders stable YAML frontmatter and fixed headings", () => {
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
version: 1
status: "clarifying"
task: "Design account deletion API"
knowns:
  - "Production SaaS"
  - "GDPR-compliant"
unknowns:
  - "Deletion semantics"
  - "Retention obligations"
next_question: "Should deletion be hard delete, soft delete, or async delete with a grace period?"
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

test("parseContextDoc round-trips rendered output", () => {
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
  assert.match(output, /decisions: \[\]/);
  assert.match(output, /## Next Question\nNone\./);
  assert.match(output, /## Fixed Decisions\n- None\./);
});

test("validateState rejects invalid status", () => {
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

test("analyzeContextDoc accepts rendered docs with fixed headings", () => {
  const rendered = renderContextDoc(
    createState({
      task: "Inspect auth retry behavior",
      knowns: ["There is only one auth module."],
      unknowns: ["Which failures should remain retryable?"],
      next_question: "Which failures should remain retryable?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  );

  const analysis = analyzeContextDoc(rendered);
  assert.equal(analysis.ok, true);
  for (const heading of FIXED_HEADINGS) {
    assert.match(rendered, new RegExp(`## ${heading}`));
  }
});

test("analyzeContextDoc tolerates extra body notes while keeping frontmatter canonical", () => {
  const rendered = renderContextDoc(
    createState({
      task: "Design delete flow",
      knowns: ["Production system"],
      unknowns: ["Retention obligations"],
      next_question: "What retained data is legally required?",
      decisions: [],
      updated_at: "2026-03-29T00:00:00.000Z",
    })
  ).replace(
    "## Status\nclarifying\n",
    "## Status\nclarifying\n\n## Notes\n- user-added note\n"
  );

  const analysis = analyzeContextDoc(rendered);
  assert.deepEqual(analysis.ok, true);
});

test("analyzeContextDoc rejects required section drift from canonical frontmatter", () => {
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

test("analyzeContextDoc reports malformed frontmatter", () => {
  const malformed = `---
version: 1
status: clarifying
task: "Broken"
---

# Socrates Context
`;

  const analysis = analyzeContextDoc(malformed);
  assert.equal(analysis.ok, false);
  assert.equal(analysis.reason, "invalid_string");
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

test("createState rejects an empty task", () => {
  assert.throws(
    () =>
      createState({
        task: "   ",
      }),
    (error) =>
      error instanceof ContextDocError && error.code === "invalid_task"
  );
});

test("render and parse support quoted strings and escaped newlines", () => {
  const state = createState({
    task: 'Clarify "quoted" retry policy',
    knowns: ['Line one\nLine two', 'Backslash \\\\ path'],
    unknowns: ['What does "safe" mean here?'],
    next_question: 'Should "safe" mean idempotent-only retries?\nAnswer with one rule.',
    decisions: ['Keep "quoted" values as-is.'],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const rendered = renderContextDoc(state);
  const parsed = parseContextDoc(rendered);
  assert.deepEqual(parsed.state, state);
});

test("renderContextDoc handles long knowns lists", () => {
  const knowns = Array.from({ length: 25 }, (_, index) => `Known fact ${index + 1}`);
  const state = createState({
    task: "Long-list task",
    knowns,
    unknowns: ["One remaining unknown"],
    next_question: "What is the last missing decision?",
    decisions: [],
    updated_at: "2026-03-29T00:00:00.000Z",
  });

  const output = renderContextDoc(state);
  assert.equal((output.match(/Known fact/g) ?? []).length, knowns.length * 2);
  assert.match(output, /Known fact 25/);
});
