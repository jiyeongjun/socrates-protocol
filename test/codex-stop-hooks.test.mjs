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
  ".codex",
  "hooks",
  "stop_socrates_clarifying.mjs"
);

function buildDoc({
  status = "clarifying",
  nextQuestion = "Which failures should remain retryable?",
  unknowns = ['  - "Retry scope"'],
  bodyUnknowns = "- Retry scope",
} = {}) {
  const unknownsFrontmatter =
    unknowns.length === 0 ? "unknowns: []" : `unknowns:\n${unknowns.join("\n")}`;
  const nextQuestionFrontmatter =
    nextQuestion === null ? "next_question: null" : `next_question: ${JSON.stringify(nextQuestion)}`;
  const nextQuestionBody = nextQuestion ?? "None.";

  return `---
version: 1
status: ${JSON.stringify(status)}
task: "Clarify retry policy"
knowns:
  - "Production service"
${unknownsFrontmatter}
${nextQuestionFrontmatter}
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
Clarify retry policy

## What Socrates Knows
- Production service

## What Socrates Still Needs
${unknowns.length === 0 ? "- None." : bodyUnknowns}

## Next Question
${nextQuestionBody}

## Fixed Decisions
- None.

## Status
${status}
`;
}

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
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}

function runIsolatedHookWithoutDependencies(sourceHookPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-missing-deps-"));
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

test("Codex stop hook stays silent when no context doc exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-none-"));
  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "I am done.",
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
});

test("Codex stop hook fails silent when bundled dependencies are missing", async () => {
  const result = await runIsolatedHookWithoutDependencies(hookPath);

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("Codex stop hook continues when clarifying context is relevant", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-hit-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "I summarized the retry policy and the retry scope, and I am ready to implement retries now.",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /SOCRATES_CONTEXT\.md/);
  assert.match(result.stderr, /Ask this next load-bearing question:/);
});

test("Codex stop hook does not cross the nearest git root boundary", async () => {
  const monorepo = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-git-root-"));
  const nestedRepo = path.join(monorepo, "apps", "service");
  const nestedCwd = path.join(nestedRepo, "src");
  await mkdir(path.join(nestedRepo, ".git"), { recursive: true });
  await mkdir(nestedCwd, { recursive: true });
  await writeFile(path.join(monorepo, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: nestedCwd,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "I summarized the retry policy and the retry scope, and I am ready to implement retries now.",
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
});

test("Codex stop hook stays silent when the task is already ready", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-ready-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    buildDoc({
      status: "ready",
      nextQuestion: null,
      unknowns: [],
    }),
    "utf8"
  );

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "I finalized the retry policy.",
  });

  assert.equal(result.code, 0);
});

test("Codex stop hook stays silent when already continued once", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-loop-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: true,
    last_assistant_message: "Retry policy and retry scope are ready.",
  });

  assert.equal(result.code, 0);
});

test("Codex stop hook stays silent when the assistant already asked the next question", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-asked-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Which failures should remain retryable?",
  });

  assert.equal(result.code, 0);
});

test("Codex stop hook stays silent for unrelated assistant messages", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-unrelated-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "The weather in Seoul looks clear today.",
  });

  assert.equal(result.code, 0);
});
