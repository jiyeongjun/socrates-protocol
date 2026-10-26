import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildAlignmentCommand, changedFiles, parseTranscript, runAlignmentEvals, snapshot } from "../evals/run-alignment-evals.mjs";

test("alignment snapshot detects creation, modification, and deletion without counting host state", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "socrates-snapshot-test-"));
  try {
    await mkdir(path.join(dir, ".claude"));
    await writeFile(path.join(dir, ".claude", "state"), "before");
    await writeFile(path.join(dir, "a.mjs"), "before");
    await writeFile(path.join(dir, "deleted.mjs"), "before");
    const before = await snapshot(dir);
    await writeFile(path.join(dir, ".claude", "state"), "after");
    await writeFile(path.join(dir, "a.mjs"), "after");
    await writeFile(path.join(dir, "created.mjs"), "new");
    await rm(path.join(dir, "deleted.mjs"));
    assert.deepEqual(changedFiles(before, await snapshot(dir)), ["a.mjs", "created.mjs", "deleted.mjs"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("transcripts retain actual tool calls and session identity and flag API errors", () => {
  const codex = parseTranscript("codex", [
    { type: "thread.started", thread_id: "session-a" },
    { type: "item.completed", item: { type: "file_change", changes: [{ path: "x" }] } },
    { type: "item.completed", item: { type: "agent_message", text: "Done" } },
    { type: "turn.completed" },
  ].map(JSON.stringify).join("\n"));
  assert.equal(codex.sessionId, "session-a");
  assert.equal(codex.response, "Done");
  assert.equal(codex.failed, false);
  assert.equal(parseTranscript("codex", "partial unstructured output").failed, true);
  assert.equal(parseTranscript("codex", '{"type":"thread.started","thread_id":"partial"}').failed, true);
  assert.equal(codex.tools[0].type, "file_change");
  assert.equal(parseTranscript("codex", '{"type":"turn.failed"}').failed, true);
  const claude = parseTranscript("claude", [
    { type: "assistant", message: { model: "model-id", content: [{ type: "tool_use", name: "Edit", input: { file_path: "x" } }] } },
    { type: "result", session_id: "session-b", is_error: true, result: "Authentication failed" },
  ].map(JSON.stringify).join("\n"));
  assert.equal(claude.failed, true);
  assert.equal(claude.sessionId, "session-b");
  assert.equal(claude.tools[0].name, "Edit");
  assert.deepEqual(claude.modelEvidence, ["model-id"]);
  assert.equal(parseTranscript("claude", "not json").failed, true);
});

test("writable evaluation resumes exact sessions and retains normal host boundaries", () => {
  const options = { model: "test-model", workspace: "/tmp/fixture", prompt: "approved scope", env: {} };
  const initial = buildAlignmentCommand({ ...options, host: "codex" });
  assert.ok(initial.args.includes("workspace-write"));
  const resumed = buildAlignmentCommand({ ...options, host: "codex", sessionId: "the-session" });
  assert.deepEqual(resumed.args.slice(0, 3), ["exec", "resume", "the-session"]);
  assert.ok(!resumed.args.includes("--ephemeral"));
  const claude = buildAlignmentCommand({ ...options, host: "claude", sessionId: "another-session" });
  assert.equal(claude.args[claude.args.indexOf("--resume") + 1], "another-session");
  assert.deepEqual(JSON.parse(claude.args[claude.args.indexOf("--mcp-config") + 1]), { mcpServers: {} });
  for (const command of [initial, resumed, claude]) {
    assert.ok(!command.args.some(arg => arg.startsWith("--dangerously-")));
    assert.ok(!command.args.includes("--fallback-model"));
  }
});

test("alignment evaluation rejects missing opt-in and invalid selection before any model call", async () => {
  await assert.rejects(runAlignmentEvals({}), /authorize model calls/);
  await assert.rejects(runAlignmentEvals({ SOCRATES_LIVE_EVAL: "1", SOCRATES_ALIGNMENT_HOST: "unknown" }), /must be codex or claude/);
  await assert.rejects(runAlignmentEvals({ SOCRATES_LIVE_EVAL: "1", SOCRATES_ALIGNMENT_HOST: "codex", SOCRATES_ALIGNMENT_CASES: "unknown" }), /Unknown or duplicate alignment case/);
});
