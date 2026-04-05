import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { CURRENT_VERSION, createState, renderContextDoc } from "../reference/context-doc.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const hookPath = path.join(
  repoRoot,
  ".codex",
  "hooks",
  "stop_socrates_clarifying.mjs"
);

function buildDoc({
  version = CURRENT_VERSION,
  status = "clarifying",
  clarifyingPhase = status === "clarifying" ? "needs_question" : null,
  task = "Clarify retry policy",
  knowns = ['  - "Production service"'],
  bodyKnowns = "- Production service",
  nextQuestion = "Which failures should remain retryable?",
  unknowns = ['  - "Retry scope"'],
  bodyUnknowns = "- Retry scope",
} = {}) {
  if (version === CURRENT_VERSION) {
    return renderContextDoc(
      createState({
        status,
        clarifying_phase: clarifyingPhase,
        task,
        knowns: knowns.map((entry) => JSON.parse(entry.slice(4))),
        unknowns: unknowns.map((entry) => JSON.parse(entry.slice(4))),
        next_question: nextQuestion,
        decisions: [],
        updated_at: "2026-03-29T00:00:00.000Z",
      })
    );
  }

  const knownsFrontmatter =
    knowns.length === 0 ? "knowns: []" : `knowns:\n${knowns.join("\n")}`;
  const unknownsFrontmatter =
    unknowns.length === 0 ? "unknowns: []" : `unknowns:\n${unknowns.join("\n")}`;
  const nextQuestionFrontmatter =
    nextQuestion === null ? "next_question: null" : `next_question: ${JSON.stringify(nextQuestion)}`;
  const clarifyingPhaseFrontmatter =
    version >= 2
      ? clarifyingPhase === null
        ? "clarifying_phase: null"
        : `clarifying_phase: ${JSON.stringify(clarifyingPhase)}`
      : null;
  const nextQuestionBody = nextQuestion ?? "None.";

  return `---
version: ${version}
status: ${JSON.stringify(status)}
task: ${JSON.stringify(task)}
${knownsFrontmatter}
${unknownsFrontmatter}
${nextQuestionFrontmatter}
${clarifyingPhaseFrontmatter ? `${clarifyingPhaseFrontmatter}\n` : ""}decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
${task}

## What Socrates Knows
${knowns.length === 0 ? "- None." : bodyKnowns}

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

test("Codex stop hook continues while clarifying_phase still needs a question", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-hit-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "I have enough context now and will implement the retry change.",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /SOCRATES_CONTEXT\.md/);
  assert.match(result.stderr, /Ask this next load-bearing question:/);
});

test("Codex stop hook continues for current-task handoffs with enough-context phrasing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-enough-context-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "I have enough context now and will implement the change.",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /Which failures should remain retryable/);
});

test("Codex stop hook stays silent for legacy version 1 docs until normalized", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-legacy-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    buildDoc({ version: 1 }),
    "utf8"
  );

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Which failures should remain retryable?",
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
});

test("Codex stop hook continues for related Korean clarifying tasks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-korean-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    buildDoc({
      task: "결제 재시도 정책 정리",
      knowns: ['  - "프로덕션 결제 시스템"'],
      bodyKnowns: "- 프로덕션 결제 시스템",
      nextQuestion: "어떤 실패만 재시도 가능해야 하나요?",
      unknowns: ['  - "재시도 가능 실패 범위"'],
      bodyUnknowns: "- 재시도 가능 실패 범위",
    }),
    "utf8"
  );

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "결제 재시도 정책 구현으로 넘어가겠습니다.",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /어떤 실패만 재시도 가능해야 하나요/);
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
    last_assistant_message: "I summarized the retry policy and can implement it now.",
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
      clarifyingPhase: null,
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

test("Codex stop hook stays silent while executing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-executing-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    buildDoc({
      status: "executing",
      clarifyingPhase: null,
      nextQuestion: null,
      unknowns: [],
    }),
    "utf8"
  );

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "The patch is done.",
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
});

test("Codex stop hook keeps intervening when already continued once but state is unchanged", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-loop-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: true,
    last_assistant_message: "Retry policy and retry scope are ready.",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /awaiting_user_answer/);
});

test("Codex stop hook continues even when the assistant draft is blank", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-blank-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /Which failures should remain retryable/);
});

test("Codex stop hook stays silent while awaiting_user_answer", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-awaiting-user-"));
  await writeFile(
    path.join(root, "SOCRATES_CONTEXT.md"),
    buildDoc({ clarifyingPhase: "awaiting_user_answer" }),
    "utf8"
  );

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Which failures should remain retryable?",
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
});

test("Codex stop hook keeps intervening until the exact next question is persisted as awaiting_user_answer", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-question-already-asked-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "Which failures should remain retryable?",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /awaiting_user_answer/);
});

test("Codex stop hook keeps intervening for colon lead-ins until the doc state changes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-question-leadin-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "Before I continue: Which failures should remain retryable?",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /awaiting_user_answer/);
});

test("Codex stop hook keeps intervening for comma lead-ins until the doc state changes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-question-comma-leadin-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "Before I continue, which failures should remain retryable?",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /awaiting_user_answer/);
});

test("Codex stop hook keeps intervening when the next question is followed by implementation text", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-question-followup-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "Which failures should remain retryable? Once I know that, I will implement it.",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /awaiting_user_answer/);
});

test("Codex stop hook continues until the stale clarifying doc is replaced or cleaned up", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-stale-doc-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "I renamed a README heading in an unrelated docs task.",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /Which failures should remain retryable/);
});

test("Codex stop hook keeps intervening for meta references to the next question", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-meta-question-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildDoc(), "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message:
      "I still need to ask: Which failures should remain retryable?",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /Which failures should remain retryable/);
});

test("Codex stop hook stays silent for malformed docs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-codex-stop-malformed-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), "## Task\nBroken\n", "utf8");

  const result = await runHook({
    cwd: root,
    hook_event_name: "Stop",
    stop_hook_active: false,
    last_assistant_message: "I will implement now.",
  });

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
});
