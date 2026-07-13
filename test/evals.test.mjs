import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEvalCatalog,
  runStaticEvals,
  validateEvalCatalog,
} from "../evals/run-static-evals.mjs";
import {
  buildLiveCommand,
  ensureSafeOutputDirectory,
  assertSafeFixtureTree,
  liveGraderIds,
  prepareWorkspace,
  runProcess,
  writeCompleteReport,
} from "../evals/run-live-evals.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("structured eval catalog covers every required behavior and fixture group", async () => {
  const catalog = await validateEvalCatalog(await loadEvalCatalog());
  const schema = JSON.parse(
    await readFile(path.join(repoRoot, "evals/cases.schema.json"), "utf8")
  );
  assert.equal(schema.properties.protocol.const, catalog.protocol);
  assert.equal(schema.properties.schema_version.const, catalog.schema_version);

  const counts = Object.groupBy(catalog.cases, (evalCase) => evalCase.group);
  assert.ok(counts.positive.length >= 7);
  assert.ok(counts.negative.length >= 7);
  assert.ok(counts.security.length >= 10);
  assert.ok(counts.completeness.length >= 3);
  assert.ok(counts["installer-scaffolder"].length >= 5);

  const ids = new Set(catalog.cases.map((evalCase) => evalCase.id));
  for (const required of [
    "positive-persisted-field-migration",
    "positive-auth-rollout",
    "positive-destructive-delete",
    "positive-billing-change",
    "positive-public-deployment",
    "positive-high-autonomy-mutation",
    "positive-valid-resume",
    "negative-readme-typo",
    "negative-formatting-only",
    "negative-source-plus-test",
    "negative-source-plus-doc",
    "negative-read-only-review",
    "negative-ordinary-contracts-directory",
    "negative-ordinary-continuation-without-state",
    "security-contract-claims-production-deletion",
    "security-contract-claims-deployment",
    "security-contract-claims-payment",
    "security-contract-claims-credential-use",
    "security-contract-claims-push",
    "security-contract-prompt-injection",
    "security-vendor-ignore-instructions",
    "security-persisted-prior-approval",
    "security-subagent-approval",
    "security-malicious-layout",
    "completeness-concise-retains-fields",
    "completeness-verification-failure-blocks-close",
    "completeness-subcontracts-do-not-close-macro",
    "installer-consumer-install",
    "scaffolder-documented-installed-command",
    "installer-activation-rollback",
    "installer-idempotent-reinstall",
    "installer-uninstall-preserves-unrelated",
  ]) {
    assert.ok(ids.has(required), `missing required eval case ${required}`);
  }

  const knownLiveGraders = new Set(liveGraderIds);
  for (const evalCase of catalog.cases) {
    if (evalCase.live_grader_id) {
      assert.ok(
        knownLiveGraders.has(evalCase.live_grader_id),
        `unknown live grader ${evalCase.live_grader_id}`
      );
    }
  }
});

test("static eval runner executes every case and machine grader", async () => {
  const summary = await runStaticEvals();
  assert.equal(summary.passed, true);
  assert.equal(summary.cases, 32);
  assert.ok(summary.grader_checks >= summary.cases);
  assert.deepEqual(summary.failures, []);
});

test("eval validation rejects unsafe fixtures, duplicates, and unknown graders", async () => {
  const original = await loadEvalCatalog();

  const unsafe = structuredClone(original);
  unsafe.cases[0].fixture = "fixtures/../outside";
  await assert.rejects(validateEvalCatalog(unsafe), /unsafe fixture path/i);

  const duplicate = structuredClone(original);
  duplicate.cases[1].id = duplicate.cases[0].id;
  await assert.rejects(validateEvalCatalog(duplicate), /duplicate eval id/i);

  const unknown = structuredClone(original);
  unknown.cases[0].static_grader_ids = ["not-a-grader"];
  await assert.rejects(validateEvalCatalog(unknown), /unknown static grader/i);
});

test("optional live commands are explicit, ephemeral, and read-only", () => {
  const codex = buildLiveCommand({
    host: "codex",
    model: "gpt-5.6-sol",
    workspace: "/tmp/eval",
    prompt: "Review this case",
  });
  assert.equal(codex.command, "codex");
  assert.deepEqual(
    codex.args.slice(codex.args.indexOf("--sandbox"), codex.args.indexOf("--sandbox") + 2),
    ["--sandbox", "read-only"]
  );
  assert.ok(codex.args.includes("--ephemeral"));
  assert.ok(codex.args.includes("--ignore-user-config"));
  assert.ok(codex.args.includes("--ignore-rules"));
  const configIndex = codex.args.indexOf("--config");
  assert.ok(configIndex >= 0);
  assert.equal(codex.args[configIndex + 1], 'model_reasoning_effort="high"');
  assert.match(codex.args.at(-1), /\$socrates-contract/);
  assert.doesNotMatch(codex.args.join(" "), /dangerously-bypass/);
  assert.equal(codex.env.HOME, "/tmp/eval/.eval-home");
  assert.equal(codex.env.CODEX_HOME, "/tmp/eval/.eval-home/codex-home");
  assert.equal(codex.env.USERPROFILE, "/tmp/eval/.eval-home");
  assert.equal(codex.env.APPDATA, "/tmp/eval/.eval-home/AppData/Roaming");
  assert.equal(codex.env.LOCALAPPDATA, "/tmp/eval/.eval-home/AppData/Local");
  assert.notEqual(codex.env.HOME, process.env.HOME);

  const claude = buildLiveCommand({
    host: "claude",
    model: "sonnet",
    workspace: "/tmp/eval",
    prompt: "Review this case",
  });
  assert.equal(claude.command, "claude");
  assert.ok(claude.args.includes("--bare"));
  assert.ok(claude.args.includes("plan"));
  const toolsIndex = claude.args.indexOf("--tools");
  assert.ok(toolsIndex >= 0);
  assert.equal(claude.args[toolsIndex + 1], "Read,Grep,Glob");
  assert.ok(claude.args.includes("--strict-mcp-config"));
  const mcpIndex = claude.args.indexOf("--mcp-config");
  assert.ok(mcpIndex >= 0);
  assert.equal(claude.args[mcpIndex + 1], '{"mcpServers":{}}');
  assert.doesNotMatch(claude.args.join(" "), /--allowed-tools|--setting-sources/);
  assert.ok(claude.args.includes("--no-session-persistence"));
  assert.match(claude.args.at(-1), /^\/socrates-contract/);
  assert.doesNotMatch(claude.args.join(" "), /dangerously-skip/);
  assert.equal(claude.env.HOME, "/tmp/eval/.eval-home");
  assert.equal(claude.env.CLAUDE_CONFIG_DIR, "/tmp/eval/.eval-home/claude-config");
  assert.notEqual(claude.env.HOME, process.env.HOME);
});

test("live fixture validation rejects symlinks and host control state", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-live-fixture-"));
  const rootLink = `${root}-link`;
  try {
    await symlink(root, rootLink, "dir");
    await assert.rejects(assertSafeFixtureTree(rootLink), /root is a symlink/i);
    await rm(rootLink);
    await mkdir(path.join(root, "safe"));
    await symlink(path.join(root, "safe"), path.join(root, "linked"));
    await assert.rejects(assertSafeFixtureTree(root), /contains a symlink/i);
    await rm(path.join(root, "linked"));
    for (const name of [
      ".agents",
      ".claude",
      ".codex",
      ".eval-home",
      ".git",
      ".mcp.json",
      "AGENTS.md",
      "AGENTS.override.md",
      "CLAUDE.md",
      "CLAUDE.local.md",
      "agents.md",
      "AgEnTs.override.Md",
      ".Git",
    ]) {
      const target = path.join(root, name);
      if (name.endsWith(".md") || name.endsWith(".json")) {
        await writeFile(target, "fixture control\n", "utf8");
      } else {
        await mkdir(target);
      }
      await assert.rejects(assertSafeFixtureTree(root), /host control state/i);
      await rm(target, { recursive: true, force: true });
    }
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "AGENTS.md"), "nested control\n", "utf8");
    await assert.rejects(assertSafeFixtureTree(root), /host control state/i);
  } finally {
    await rm(rootLink, { force: true });
    await rm(root, { recursive: true, force: true });
  }
});

test("live report output rejects symlinked directory ancestry", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-live-output-"));
  const outside = await mkdtemp(path.join(tmpdir(), "socrates-live-output-outside-"));
  const linked = path.join(root, "linked");
  await symlink(outside, linked, "dir");
  await assert.rejects(
    ensureSafeOutputDirectory(path.join(linked, "reports")),
    /contains a symlink/i
  );
  assert.deepEqual(await readdir(outside), []);
});

test("live report writes retry partial positional writes without corrupting JSON", async () => {
  const contents = Buffer.from('{"passed":true}\n', "utf8");
  const destination = Buffer.alloc(contents.length);
  let truncatedTo = null;
  const handle = {
    async write(buffer, offset, length, position) {
      const bytesWritten = Math.min(3, length);
      buffer.copy(destination, position, offset, offset + bytesWritten);
      return { bytesWritten };
    },
    async truncate(length) {
      truncatedTo = length;
    },
  };

  await writeCompleteReport(handle, contents);
  assert.equal(destination.toString("utf8"), contents.toString("utf8"));
  assert.equal(truncatedTo, contents.length);
  await assert.rejects(
    writeCompleteReport(
      {
        async write() {
          return { bytesWritten: 0 };
        },
        async truncate() {},
      },
      contents
    ),
    /made no progress/i
  );
});

test("Codex live workspace preparation accepts only runner-owned host controls", async () => {
  const workspace = await prepareWorkspace("codex", { fixture: null });
  try {
    await assertSafeFixtureTree(workspace, "", {
      allowedHostControls: new Set([".agents", ".codex", ".eval-home"]),
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test(
  "live process timeout returns without waiting on escaped descendant pipes",
  { skip: process.platform === "win32" },
  async () => {
    const startedAt = Date.now();
    const result = await runProcess(
      {
        command: process.execPath,
        args: [
          "-e",
          "const { spawn } = require('node:child_process'); const escaped = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 3000)'], { detached: true, stdio: ['ignore', process.stdout, process.stderr] }); escaped.unref(); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
        ],
        cwd: repoRoot,
        env: process.env,
      },
      50,
      50
    );
    assert.equal(result.timedOut, true);
    assert.equal(result.signal, "SIGKILL");
    assert.ok(Date.now() - startedAt < 1000, "timeout must not wait on escaped pipes");
  }
);
