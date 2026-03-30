import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const hookPath = path.join(
  repoRoot,
  ".codex",
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

test("session-start hook emits no output when no context doc exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-hook-none-"));

  const output = await runHook({
    cwd: root,
    hook_event_name: "SessionStart",
    source: "startup",
  });

  assert.equal(output, "");
});

test("session-start hook injects context when a Socrates doc exists above cwd", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-hook-doc-"));
  const nested = path.join(root, "packages", "api");
  await mkdir(nested, { recursive: true });
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    `---
version: 1
status: "clarifying"
task: "Design account deletion API"
knowns:
  - "Production SaaS"
unknowns:
  - "Retention obligations"
next_question: "What retained data is legally required?"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Design account deletion API

## What Socrates Knows
- Production SaaS

## What Socrates Still Needs
- Retention obligations

## Next Question
What retained data is legally required?

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
  const parsed = JSON.parse(output);

  assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(parsed.hookSpecificOutput.additionalContext, /SOCRATES_CONTEXT\.md/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /canonical persisted state/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /ask the next load-bearing question before implementation/);
});

test("session-start hook does not cross the nearest git root boundary", async () => {
  const monorepo = await mkdtemp(path.join(tmpdir(), "socrates-hook-git-root-"));
  const nestedRepo = path.join(monorepo, "apps", "service");
  const nestedCwd = path.join(nestedRepo, "src");
  await mkdir(path.join(nestedRepo, ".git"), { recursive: true });
  await mkdir(nestedCwd, { recursive: true });
  await writeFile(
    path.join(monorepo, "SOCRATES_CONTEXT.md"),
    `---
version: 1
status: "clarifying"
task: "Parent repo task"
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

test("session-start hook stays silent for unrelated markdown files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-hook-ignore-"));
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

test("session-start hook ignores unsupported session sources", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-hook-source-"));
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
    source: "clear",
  });

  assert.equal(output, "");
});

test("session-start hook stays silent for malformed Socrates docs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-hook-malformed-"));
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

  assert.equal(output, "");
});

test("session-start hook stays silent when stdin is invalid", async () => {
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
