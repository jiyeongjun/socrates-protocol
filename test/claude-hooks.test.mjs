import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const hookPath = path.join(
  repoRoot,
  ".claude",
  "hooks",
  "session_start_socrates_context.mjs"
);

function runHook(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath], {
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
      if (code !== 0) {
        reject(new Error(`hook exited with code ${code}: ${stderr}`));
        return;
      }

      resolve(stdout.trim());
    });

    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}

function runIsolatedHookWithoutDependencies(sourceHookPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-missing-deps-"));
      const isolatedHookPath = path.join(root, path.basename(sourceHookPath));
      await copyFile(sourceHookPath, isolatedHookPath);

      const child = spawn(process.execPath, [isolatedHookPath], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
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
    } catch (error) {
      reject(error);
    }
  });
}

test("Claude session-start hook emits no output when no context doc exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-none-"));

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "startup",
  });

  assert.equal(output, "");
});

test("Claude session-start hook fails silent when bundled dependencies are missing", async () => {
  const result = await runIsolatedHookWithoutDependencies(hookPath);

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("Claude session-start hook injects context when a Socrates doc exists above cwd", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-doc-"));
  const nested = path.join(root, "apps", "web");
  await mkdir(nested, { recursive: true });
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `---
version: 2
status: "clarifying"
task: "Clarify retry policy"
knowns:
  - "Production service"
unknowns:
  - "Retry scope"
next_question: "Which failures should remain retryable?"
clarifying_phase: "needs_question"
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
`,
    "utf8"
  );

  const output = await runHook({
    cwd: nested,
    hook_event_name: "SessionStart",
    source: "resume",
  });

  assert.match(output, /SOCRATES_CONTEXT\.md/);
  assert.match(output, /canonical persisted state/);
  assert.match(output, /clarifying_phase/);
  assert.match(output, /flip clarifying_phase to awaiting_user_answer/);
});

test("Claude session-start hook injects context on clear when a Socrates doc exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-clear-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `---
version: 2
status: "clarifying"
task: "Clear recovery task"
knowns:
  - "One fact"
unknowns:
  - "One unknown"
next_question: "What remains?"
clarifying_phase: "needs_question"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Clear recovery task

## What Socrates Knows
- One fact

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "clear",
  });

  assert.match(output, /SOCRATES_CONTEXT\.md/);
});

test("Claude session-start hook does not cross the nearest git root boundary", async () => {
  const monorepo = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-git-root-"));
  const nestedRepo = path.join(monorepo, "apps", "service");
  const nestedCwd = path.join(nestedRepo, "src");
  await mkdir(path.join(nestedRepo, ".git"), { recursive: true });
  await mkdir(nestedCwd, { recursive: true });
  await writeFile(
    path.join(monorepo, "SOCRATES_CONTEXT.md"),
    `---
version: 2
status: "clarifying"
task: "Parent repo task"
knowns:
  - "One fact"
unknowns:
  - "One unknown"
next_question: "What remains?"
clarifying_phase: "needs_question"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Parent repo task

## What Socrates Knows
- One fact

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: nestedCwd,
    hook_event_name: "SessionStart",
    source: "resume",
  });

  assert.equal(output, "");
});

test("Claude session-start hook stays silent for unrelated markdown files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-ignore-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    "# Not a Socrates context doc\n",
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "startup",
  });

  assert.equal(output, "");
});

test("Claude session-start hook injects context on compact when a Socrates doc exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-source-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `---
version: 2
status: "clarifying"
task: "Clarify retries"
knowns:
  - "One fact"
unknowns:
  - "One unknown"
next_question: "What remains?"
clarifying_phase: "needs_question"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Clarify retries

## What Socrates Knows
- One fact

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "compact",
  });

  assert.match(output, /SOCRATES_CONTEXT\.md/);
});

test("Claude session-start hook points canonical legacy Socrates docs to normalization guidance", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-legacy-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `---
version: 1
status: "clarifying"
task: "Legacy recovery task"
knowns:
  - "One fact"
unknowns:
  - "One unknown"
next_question: "What remains?"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Legacy recovery task

## What Socrates Knows
- One fact

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "resume",
  });

  assert.match(output, /legacy version 1 shared context file/);
  assert.match(output, /canonical version 2 format/);
  assert.match(output, /repair --file/);
});

test("Claude session-start hook ignores unsupported session sources", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-unsupported-source-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `---
version: 1
status: "clarifying"
task: "Clarify retries"
knowns:
  - "One fact"
unknowns:
  - "One unknown"
next_question: "What remains?"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Clarify retries

## What Socrates Knows
- One fact

## What Socrates Still Needs
- One unknown

## Next Question
What remains?

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "turn_end",
  });

  assert.equal(output, "");
});

test("Claude session-start hook points malformed Socrates docs to repair guidance", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-claude-hook-malformed-"));
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

## Task
Broken

## What Socrates Knows
- None.

## What Socrates Still Needs
- None.

## Next Question
None.

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "startup",
  });

  assert.match(output, /malformed shared context file/);
  assert.match(output, /normalize SOCRATES_CONTEXT\.md to the canonical version 2 format/);
  assert.match(output, /context-doc\.mjs|socrates_context_doc_helper\.mjs/);
  assert.match(output, /not auto-repairable|manual/);
});

test("Claude session-start hook points body-only malformed Socrates docs to repair guidance", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "socrates-claude-hook-body-only-malformed-")
  );
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `# Socrates Context

## Task
Broken

## What Socrates Knows
- One fact

## What Socrates Still Needs
- One unknown

## Next Question
None.

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "startup",
  });

  assert.match(output, /malformed shared context file/);
  assert.match(output, /normalize SOCRATES_CONTEXT\.md to the canonical version 2 format/);
  assert.match(output, /context-doc\.mjs|socrates_context_doc_helper\.mjs/);
  assert.match(output, /not auto-repairable|manual/);
});

test("Claude session-start hook points title-less body-only malformed Socrates docs to repair guidance", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "socrates-claude-hook-title-less-body-only-malformed-")
  );
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `## Task
Broken

## What Socrates Knows
- One fact

## What Socrates Still Needs
- One unknown

## Next Question
None.

## Fixed Decisions
- None.

## Status
clarifying
`,
    "utf8"
  );

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "startup",
  });

  assert.match(output, /malformed shared context file/);
  assert.match(output, /normalize SOCRATES_CONTEXT\.md to the canonical version 2 format/);
  assert.match(output, /context-doc\.mjs|socrates_context_doc_helper\.mjs/);
  assert.match(output, /not auto-repairable|manual/);
});

test("Claude session-start hook points title-less partial body-only Socrates docs to repair guidance", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "socrates-claude-hook-title-less-partial-body-only-malformed-")
  );
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), "## Task\nBroken\n", "utf8");

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "startup",
  });

  assert.match(output, /malformed shared context file/);
  assert.match(output, /normalize SOCRATES_CONTEXT\.md to the canonical version 2 format/);
  assert.doesNotMatch(output, /repair --file/);
  assert.match(output, /not auto-repairable|rewritten or replaced manually/);
});

test("Claude session-start hook stays silent when stdin is invalid", async () => {
  const child = spawn(process.execPath, [hookPath], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`hook exited with code ${code}`));
        return;
      }
      resolve();
    });

    child.stdin.end("not json\n");
  });

  assert.equal(stdout.trim(), "");
});
