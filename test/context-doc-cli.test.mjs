import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createState, renderContextDoc } from "../reference/context-doc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(repoRoot, "scripts", "context-doc.mjs");

function runCli(args, cwd = repoRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
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
  });
}

test("context-doc doctor reports repairable drift", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-context-cli-doctor-"));
  const target = path.join(root, "SOCRATES_CONTEXT.md");

  await writeFile(
    target,
    `---
version: 2
status: "clarifying"
task: "Design delete flow"
knowns:
  - "Production system"
unknowns:
  - "Retention obligations"
next_question: "What retained data is legally required?"
clarifying_phase: "needs_question"
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Different task

## What Socrates Knows
- Production system

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

  const result = await runCli(["doctor", "--file", target]);
  assert.equal(result.code, 2);
  assert.match(result.stdout, /^REPAIR /);
  assert.match(result.stdout, /reason=body_mismatch/);
  assert.match(result.stdout, /source=frontmatter/);
});

test("context-doc repair rewrites a repairable file into version 2 canonical form", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-context-cli-repair-"));
  const target = path.join(root, "SOCRATES_CONTEXT.md");

  await writeFile(
    target,
    `---
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
Different task

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

  const result = await runCli(["repair", "--file", target]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Repaired /);
  assert.match(result.stdout, /source=frontmatter/);

  const next = await readFile(target, "utf8");
  assert.match(next, /^---\nversion: 2\nstatus: "clarifying"/);
  assert.match(next, /clarifying_phase: "needs_question"/);
  assert.match(next, /## Task\nClarify retry policy/);
});

test("context-doc repair fails clearly for unrepairable docs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-context-cli-unrepairable-"));
  const target = path.join(root, "SOCRATES_CONTEXT.md");

  await writeFile(
    target,
    `## Task
Broken
`,
    "utf8"
  );

  const result = await runCli(["repair", "--file", target]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^Could not repair /);
  assert.match(result.stderr, /reason=missing_frontmatter/);
});

test("context-doc doctor exits 0 for canonical files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-context-cli-canonical-"));
  const target = path.join(root, "SOCRATES_CONTEXT.md");

  await writeFile(
    target,
    renderContextDoc(
      createState({
        task: "Clarify retry policy",
        knowns: ["Production service"],
        unknowns: ["Retry scope"],
        next_question: "Which failures should remain retryable?",
        decisions: [],
        updated_at: "2026-03-29T00:00:00.000Z",
      })
    ),
    "utf8"
  );

  const result = await runCli(["doctor", "--file", target]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^OK /);
  assert.match(result.stdout, /status=clarifying/);
});

test("context-doc doctor exits 1 for unrepairable files", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "socrates-context-cli-doctor-unrepairable-")
  );
  const target = path.join(root, "SOCRATES_CONTEXT.md");

  await writeFile(
    target,
    `## Task
Broken
`,
    "utf8"
  );

  const result = await runCli(["doctor", "--file", target]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^UNREPAIRABLE /);
  assert.match(result.stderr, /reason=missing_frontmatter/);
});

test("context-doc helper requires an explicit command", async () => {
  const result = await runCli([]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Specify a command: doctor or repair/);
});
