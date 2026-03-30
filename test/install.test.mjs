import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  installSocrates,
  mergeCodexHooksFeature,
  mergeSessionStartHookDocument,
  parseArgs,
  removeSessionStartHookDocument,
  uninstallSocrates,
} from "../scripts/install.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function assertMissing(target) {
  await assert.rejects(() => access(target));
}

async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2), "utf8");
}

function buildContextDoc({
  task = "Clarify retry policy",
  knowns = ['  - "Production service"'],
  unknowns = ['  - "Retry scope"'],
  nextQuestion = "Which failures should remain retryable?",
} = {}) {
  const unknownsFrontmatter =
    unknowns.length === 0 ? "unknowns: []" : `unknowns:\n${unknowns.join("\n")}`;
  const nextQuestionFrontmatter =
    nextQuestion === null ? "next_question: null" : `next_question: ${JSON.stringify(nextQuestion)}`;
  const nextQuestionBody = nextQuestion ?? "None.";

  return `---
version: 1
status: "clarifying"
task: ${JSON.stringify(task)}
knowns:
${knowns.join("\n")}
${unknownsFrontmatter}
${nextQuestionFrontmatter}
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
${task}

## What Socrates Knows
- Production service

## What Socrates Still Needs
${unknowns.length === 0 ? "- None." : "- Retry scope"}

## Next Question
${nextQuestionBody}

## Fixed Decisions
- None.

## Status
clarifying
`;
}

function runNodeScript(scriptPath, payload, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
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

test("mergeSessionStartHookDocument appends the Socrates handler without removing existing hooks", () => {
  const initial = {
    permissions: {
      allow: ["Read"],
    },
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: "echo existing",
            },
          ],
        },
      ],
      Notification: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: "echo notify",
            },
          ],
        },
      ],
    },
  };

  const merged = mergeSessionStartHookDocument(initial, {
    matcher: "startup|resume",
    handler: {
      type: "command",
      command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"',
    },
  });

  assert.deepEqual(merged.permissions, initial.permissions);
  assert.deepEqual(merged.hooks.Notification, initial.hooks.Notification);
  assert.equal(merged.hooks.SessionStart[0].hooks.length, 2);
});

test("mergeSessionStartHookDocument reuses an existing identical handler without duplication", () => {
  const initial = {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"',
            },
          ],
        },
      ],
    },
  };

  const merged = mergeSessionStartHookDocument(initial, {
    matcher: "startup|resume",
    handler: {
      type: "command",
      command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"',
    },
  });

  assert.equal(merged.hooks.SessionStart[0].hooks.length, 1);
});

test("mergeSessionStartHookDocument treats missing statusMessage as equivalent for the same handler", () => {
  const initial = {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: 'node "/tmp/session_start_socrates_context.mjs"',
            },
          ],
        },
      ],
    },
  };

  const merged = mergeSessionStartHookDocument(initial, {
    matcher: "startup|resume",
    handler: {
      type: "command",
      command: 'node "/tmp/session_start_socrates_context.mjs"',
      statusMessage: "Loading Socrates shared context",
    },
  });

  assert.equal(merged.hooks.SessionStart[0].hooks.length, 1);
});

test("mergeSessionStartHookDocument adds a separate group for a different matcher", () => {
  const initial = {
    hooks: {
      SessionStart: [
        {
          matcher: "compact",
          hooks: [
            {
              type: "command",
              command: "echo compact",
            },
          ],
        },
      ],
    },
  };

  const merged = mergeSessionStartHookDocument(initial, {
    matcher: "startup|resume",
    handler: {
      type: "command",
      command: "echo startup",
    },
  });

  assert.equal(merged.hooks.SessionStart.length, 2);
  assert.equal(merged.hooks.SessionStart[0].matcher, "compact");
  assert.equal(merged.hooks.SessionStart[1].matcher, "startup|resume");
});

test("removeSessionStartHookDocument removes only the matching Socrates handler", () => {
  const initial = {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: "echo existing",
            },
            {
              type: "command",
              command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"',
            },
          ],
        },
      ],
      Notification: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: "echo notify",
            },
          ],
        },
      ],
    },
  };

  const updated = removeSessionStartHookDocument(initial, {
    matcher: "startup|resume",
    handler: {
      type: "command",
      command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"',
    },
  });

  assert.equal(updated.hooks.SessionStart[0].hooks.length, 1);
  assert.equal(updated.hooks.SessionStart[0].hooks[0].command, "echo existing");
  assert.deepEqual(updated.hooks.Notification, initial.hooks.Notification);
});

test("removeSessionStartHookDocument removes empty SessionStart sections after cleanup", () => {
  const initial = {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: "echo socrates",
            },
          ],
        },
      ],
    },
  };

  const updated = removeSessionStartHookDocument(initial, {
    matcher: "startup|resume",
    handler: {
      type: "command",
      command: "echo socrates",
    },
  });

  assert.deepEqual(updated, {});
});

test("parseArgs accepts the recommended repo install shape", () => {
  const parsed = parseArgs([
    "--platform",
    "both",
    "--scope",
    "repo",
    "--target-repo",
    "/tmp/example",
    "--version",
    "v0.2.2",
  ]);

  assert.equal(parsed.platform, "both");
  assert.equal(parsed.scope, "repo");
  assert.equal(parsed.targetRepo, "/tmp/example");
  assert.equal(parsed.version, "v0.2.2");
});

test("parseArgs accepts optional stop-hook features", () => {
  const parsed = parseArgs([
    "--mode",
    "install",
    "--platform",
    "both",
    "--scope",
    "global",
    "--feature",
    "stop-hook",
  ]);

  assert.deepEqual(parsed.features, ["stop-hook"]);
});

test("parseArgs accepts --enable-codex-hooks for Codex installs", () => {
  const parsed = parseArgs([
    "--platform",
    "codex",
    "--scope",
    "global",
    "--enable-codex-hooks",
  ]);

  assert.equal(parsed.enableCodexHooks, true);
});

test("parseArgs rejects invalid combinations", () => {
  assert.throws(() => parseArgs(["--platform", "nope"]), /--platform must be one of/);
  assert.throws(() => parseArgs(["--scope", "repo"]), /--target-repo is required/);
  assert.throws(() => parseArgs(["--scope", "planet"]), /--scope must be one of/);
  assert.throws(() => parseArgs(["--mode", "destroy"]), /--mode must be one of/);
  assert.throws(() => parseArgs(["--feature", "mystery"]), /--feature must be one of/);
  assert.throws(
    () => parseArgs(["--platform", "claude", "--enable-codex-hooks"]),
    /requires --platform codex or --platform both/
  );
  assert.throws(
    () => parseArgs(["--mode", "uninstall", "--platform", "codex", "--enable-codex-hooks"]),
    /can only be used with --mode install/
  );
});

test("mergeCodexHooksFeature appends a features section when absent", () => {
  assert.equal(
    mergeCodexHooksFeature("[sandbox]\nmode = \"workspace-write\"\n"),
    "[sandbox]\nmode = \"workspace-write\"\n\n[features]\ncodex_hooks = true\n"
  );
});

test("mergeCodexHooksFeature updates an existing features section in place", () => {
  assert.equal(
    mergeCodexHooksFeature("[features]\ncodex_hooks = false\nverbose = true\n"),
    "[features]\ncodex_hooks = true\nverbose = true\n"
  );
});

test("fresh repo install writes both platforms from an empty directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-fresh-repo-"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  const codexHooks = JSON.parse(
    await readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  const claudeSettings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );

  assert.equal(codexHooks.hooks.SessionStart.length, 1);
  assert.equal(codexHooks.hooks.SessionStart[0].hooks.length, 1);
  assert.equal(claudeSettings.hooks.SessionStart.length, 1);
  assert.equal(claudeSettings.hooks.SessionStart[0].hooks.length, 1);
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".agents", "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assertMissing(path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "stop_socrates_clarifying.mjs"));
});

test("repo install merges hooks and remains idempotent across reruns", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-repo-"));
  await mkdir(path.join(root, ".codex"), { recursive: true });
  await mkdir(path.join(root, ".claude"), { recursive: true });

  await writeFile(
    path.join(root, ".codex", "hooks.json"),
    JSON.stringify(
      {
        hooks: {
          SessionStart: [
            {
              matcher: "startup|resume",
              hooks: [
                {
                  type: "command",
                  command: "echo existing codex",
                },
              ],
            },
          ],
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "echo pretool",
                },
              ],
            },
          ],
        },
      },
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    path.join(root, ".claude", "settings.json"),
    JSON.stringify(
      {
        permissions: {
          allow: ["Read"],
        },
        hooks: {
          SessionStart: [
            {
              matcher: "startup|resume",
              hooks: [
                {
                  type: "command",
                  command: "echo existing claude",
                },
              ],
            },
          ],
        },
      },
      null,
      2
    ),
    "utf8"
  );

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  const codexHooks = JSON.parse(
    await readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  const claudeSettings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );

  assert.equal(codexHooks.hooks.PreToolUse.length, 1);
  assert.equal(codexHooks.hooks.SessionStart.length, 1);
  assert.equal(codexHooks.hooks.SessionStart[0].hooks.length, 2);
  assert.equal(
    codexHooks.hooks.SessionStart[0].hooks.filter(
      (entry) =>
        entry.command ===
        'node "$(git rev-parse --show-toplevel)/.codex/hooks/session_start_socrates_context.mjs"'
    ).length,
    1
  );

  assert.deepEqual(claudeSettings.permissions, { allow: ["Read"] });
  assert.equal(claudeSettings.hooks.SessionStart.length, 1);
  assert.equal(claudeSettings.hooks.SessionStart[0].hooks.length, 2);
  assert.equal(
    claudeSettings.hooks.SessionStart[0].hooks.filter(
      (entry) =>
        entry.command ===
        'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"'
    ).length,
    1
  );

  await assert.doesNotReject(() =>
    readFile(
      path.join(root, ".agents", "skills", "socrates", "agents", "openai.yaml"),
      "utf8"
    )
  );
  await assert.doesNotReject(() =>
    readFile(
      path.join(root, ".claude", "hooks", "session_start_socrates_context.mjs"),
      "utf8"
    )
  );
});

test("global install writes into the provided home directory", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-home-"));

  await installSocrates({
    platform: "codex",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
  });

  const hooks = JSON.parse(
    await readFile(path.join(fakeHome, ".codex", "hooks.json"), "utf8")
  );

  assert.equal(
    hooks.hooks.SessionStart[0].hooks[0].command,
    `node ${JSON.stringify(path.join(fakeHome, ".codex", "hooks", "session_start_socrates_context.mjs"))}`
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "hooks", "_socrates_hook_utils.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "hooks", "_socrates_context_doc.mjs"), "utf8")
  );
});

test("install can enable Codex hooks in config.toml", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-enable-hooks-"));

  await installSocrates({
    platform: "codex",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
    enableCodexHooks: true,
  });

  const config = await readFile(path.join(fakeHome, ".codex", "config.toml"), "utf8");
  assert.match(config, /\[features\]/);
  assert.match(config, /codex_hooks = true/);
});

test("importing install.mjs from a stdin module does not auto-run the installer", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-import-stdin-"));
  const child = spawn(
    process.execPath,
    ["--input-type=module", "-"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: fakeHome,
      },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`stdin import failed: ${stderr}`));
        return;
      }
      resolve();
    });

    child.stdin.end('import "./scripts/install.mjs";\nconsole.log("import ok");\n');
  });

  assert.match(stdout, /import ok/);
  await assertMissing(path.join(fakeHome, ".codex", "skills", "socrates", "SKILL.md"));
  await assertMissing(path.join(fakeHome, ".claude", "skills", "socrates", "SKILL.md"));
});

test("stdin install runs only when SOCRATES_INSTALL_RUN is set", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-stdin-run-"));
  const script = await readFile(path.join(repoRoot, "scripts", "install.mjs"), "utf8");

  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-",
      "--platform",
      "codex",
      "--scope",
      "global",
      "--source-root",
      repoRoot,
      "--version",
      "v0.2.2",
      "--enable-codex-hooks",
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: fakeHome,
        SOCRATES_INSTALL_RUN: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`stdin install failed: ${stderr}`));
        return;
      }
      resolve();
    });

    child.stdin.end(script);
  });

  assert.match(stdout, /Installed Socrates to:/);
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "skills", "socrates", "SKILL.md"), "utf8")
  );
  const config = await readFile(path.join(fakeHome, ".codex", "config.toml"), "utf8");
  assert.match(config, /codex_hooks = true/);
});

test("install preserves other Codex config entries when enabling hooks", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-enable-hooks-merge-"));
  await mkdir(path.join(fakeHome, ".codex"), { recursive: true });
  await writeFile(
    path.join(fakeHome, ".codex", "config.toml"),
    "[features]\nverbose = true\ncodex_hooks = false\n\n[sandbox]\nmode = \"workspace-write\"\n",
    "utf8"
  );

  await installSocrates({
    platform: "codex",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
    enableCodexHooks: true,
  });

  const config = await readFile(path.join(fakeHome, ".codex", "config.toml"), "utf8");
  assert.match(config, /verbose = true/);
  assert.match(config, /codex_hooks = true/);
  assert.match(config, /\[sandbox\]\nmode = "workspace-write"/);
});

test("codex-only install does not create Claude files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-codex-only-"));

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  await assertMissing(path.join(root, ".claude", "settings.json"));
});

test("claude-only install does not create Codex files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-claude-only-"));

  await installSocrates({
    platform: "claude",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );
  await assertMissing(path.join(root, ".codex", "hooks.json"));
});

test("install preserves unrelated top-level config when hooks key is absent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-preserve-"));
  await writeJson(path.join(root, ".claude", "settings.json"), {
    permissions: {
      allow: ["Read", "Bash(ls:*)"],
    },
  });

  await installSocrates({
    platform: "claude",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  const settings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );

  assert.deepEqual(settings.permissions, {
    allow: ["Read", "Bash(ls:*)"],
  });
  assert.equal(settings.hooks.SessionStart.length, 1);
});

test("install appends to a different SessionStart matcher without rewriting it", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-compact-"));
  await writeJson(path.join(root, ".claude", "settings.json"), {
    hooks: {
      SessionStart: [
        {
          matcher: "compact",
          hooks: [
            {
              type: "command",
              command: "echo compact",
            },
          ],
        },
      ],
    },
  });

  await installSocrates({
    platform: "claude",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  const settings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );

  assert.equal(settings.hooks.SessionStart.length, 2);
  assert.equal(settings.hooks.SessionStart[0].matcher, "compact");
  assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "echo compact");
  assert.equal(settings.hooks.SessionStart[1].matcher, "startup|resume");
});

test("install adds stop hooks only when explicitly requested", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-stop-"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
    features: ["stop-hook"],
  });

  const codexHooks = JSON.parse(
    await readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  const claudeSettings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );

  assert.equal(codexHooks.hooks.Stop.length, 1);
  assert.equal(codexHooks.hooks.Stop[0].hooks.length, 1);
  assert.equal(claudeSettings.hooks.Stop.length, 1);
  assert.equal(claudeSettings.hooks.Stop[0].hooks.length, 1);
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "hooks", "stop_socrates_clarifying.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs"), "utf8")
  );
});

test("install fails fast when an existing config file contains invalid JSON", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-invalid-json-"));
  await mkdir(path.join(root, ".claude"), { recursive: true });
  await writeFile(path.join(root, ".claude", "settings.json"), "{not json", "utf8");

  await assert.rejects(
    () =>
      installSocrates({
        platform: "claude",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /Unexpected token|JSON/
  );
});

test("install fails when hooks has an invalid schema", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-invalid-schema-"));
  await writeJson(path.join(root, ".codex", "hooks.json"), {
    hooks: [],
  });

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /hooks field must be a JSON object/
  );
});

test("install fails when SessionStart exists but is not an array", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-invalid-sessionstart-"));
  await writeJson(path.join(root, ".codex", "hooks.json"), {
    hooks: {
      SessionStart: {},
    },
  });

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
    }),
    /SessionStart hook list must be an array/
  );
});

test("install falls back to fetch when local source assets are unavailable", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-fetch-"));
  const originalFetch = globalThis.fetch;
  const requested = [];
  const assetMap = new Map([
    [".agents/skills/socrates/SKILL.md", await readFile(path.join(repoRoot, ".agents/skills/socrates/SKILL.md"), "utf8")],
    [".agents/skills/socrates/agents/openai.yaml", await readFile(path.join(repoRoot, ".agents/skills/socrates/agents/openai.yaml"), "utf8")],
    [".codex/hooks/session_start_socrates_context.mjs", await readFile(path.join(repoRoot, ".codex/hooks/session_start_socrates_context.mjs"), "utf8")],
    [".codex/hooks/stop_socrates_clarifying.mjs", await readFile(path.join(repoRoot, ".codex/hooks/stop_socrates_clarifying.mjs"), "utf8")],
    ["reference/hook-utils.mjs", await readFile(path.join(repoRoot, "reference/hook-utils.mjs"), "utf8")],
    ["reference/context-doc.mjs", await readFile(path.join(repoRoot, "reference/context-doc.mjs"), "utf8")],
  ]);

  globalThis.fetch = async (url) => {
    requested.push(String(url));
    const prefix = "https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v-test/";
    const relativePath = String(url).startsWith(prefix)
      ? String(url).slice(prefix.length)
      : null;

    if (!relativePath || !assetMap.has(relativePath)) {
      return {
        ok: false,
        text: async () => "",
      };
    }

    return {
      ok: true,
      text: async () => assetMap.get(relativePath),
    };
  };

  try {
    await installSocrates({
      platform: "codex",
      scope: "global",
      sourceRoot: path.join(fakeHome, "missing-source-root"),
      homeDir: fakeHome,
      version: "v-test",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requested.length, 5);
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "hooks.json"), "utf8")
  );
});

test("repo install produces self-contained hook scripts for both runtimes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-self-contained-repo-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildContextDoc(), "utf8");

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
    features: ["stop-hook"],
  });

  const codexSession = await runNodeScript(
    path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs"),
    {
      cwd: root,
      hook_event_name: "SessionStart",
      source: "resume",
    },
    root
  );
  const claudeSession = await runNodeScript(
    path.join(root, ".claude", "hooks", "session_start_socrates_context.mjs"),
    {
      cwd: root,
      hook_event_name: "SessionStart",
      source: "resume",
    },
    root
  );
  const codexStop = await runNodeScript(
    path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs"),
    {
      cwd: root,
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message:
        "I summarized the retry policy and retry scope and I am ready to implement retries now.",
    },
    root
  );
  const claudeStop = await runNodeScript(
    path.join(root, ".claude", "hooks", "stop_socrates_clarifying.mjs"),
    {
      cwd: root,
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message:
        "I summarized the retry policy and retry scope and I am ready to implement retries now.",
    },
    root
  );

  assert.equal(JSON.parse(codexSession.stdout).hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(claudeSession.stdout, /SOCRATES_CONTEXT\.md/);
  assert.equal(codexStop.code, 2);
  assert.equal(claudeStop.code, 2);
});

test("global install produces self-contained hook scripts for both runtimes", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-self-contained-home-"));
  const workspace = await mkdtemp(path.join(tmpdir(), "socrates-install-self-contained-workspace-"));
  await writeFile(path.join(workspace, "SOCRATES_CONTEXT.md"), buildContextDoc(), "utf8");

  await installSocrates({
    platform: "both",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
    features: ["stop-hook"],
  });

  const codexSession = await runNodeScript(
    path.join(fakeHome, ".codex", "hooks", "session_start_socrates_context.mjs"),
    {
      cwd: workspace,
      hook_event_name: "SessionStart",
      source: "resume",
    },
    workspace
  );
  const claudeSession = await runNodeScript(
    path.join(fakeHome, ".claude", "hooks", "session_start_socrates_context.mjs"),
    {
      cwd: workspace,
      hook_event_name: "SessionStart",
      source: "resume",
    },
    workspace
  );
  const codexStop = await runNodeScript(
    path.join(fakeHome, ".codex", "hooks", "stop_socrates_clarifying.mjs"),
    {
      cwd: workspace,
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message:
        "I summarized the retry policy and retry scope and I am ready to implement retries now.",
    },
    workspace
  );
  const claudeStop = await runNodeScript(
    path.join(fakeHome, ".claude", "hooks", "stop_socrates_clarifying.mjs"),
    {
      cwd: workspace,
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message:
        "I summarized the retry policy and retry scope and I am ready to implement retries now.",
    },
    workspace
  );

  assert.equal(JSON.parse(codexSession.stdout).hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(claudeSession.stdout, /SOCRATES_CONTEXT\.md/);
  assert.equal(codexStop.code, 2);
  assert.equal(claudeStop.code, 2);
});

test("install surfaces fetch failures when an asset cannot be downloaded", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-fetch-fail-"));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    text: async () => "",
  });

  try {
    await assert.rejects(
      () =>
        installSocrates({
          platform: "codex",
          scope: "global",
          sourceRoot: path.join(fakeHome, "missing-source-root"),
          homeDir: fakeHome,
          version: "v-missing",
        }),
      /Failed to download/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reinstall updates stale installed files back to the tracked contents", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-update-"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  const staleSkillPath = path.join(root, ".claude", "skills", "socrates", "SKILL.md");
  const staleHookPath = path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs");
  await writeFile(staleSkillPath, "stale skill\n", "utf8");
  await writeFile(staleHookPath, "stale hook\n", "utf8");

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  assert.equal(
    await readFile(staleSkillPath, "utf8"),
    await readFile(path.join(repoRoot, ".claude", "skills", "socrates", "SKILL.md"), "utf8")
  );
  assert.equal(
    await readFile(staleHookPath, "utf8"),
    await readFile(path.join(repoRoot, ".codex", "hooks", "session_start_socrates_context.mjs"), "utf8")
  );
});

test("uninstall removes Socrates files and deletes empty config files on a clean install", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-clean-"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await uninstallSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
  });

  await assertMissing(path.join(root, ".codex", "hooks.json"));
  await assertMissing(path.join(root, ".claude", "settings.json"));
  await assertMissing(path.join(root, ".agents", "skills", "socrates", "SKILL.md"));
  await assertMissing(path.join(root, ".claude", "skills", "socrates", "SKILL.md"));
  await assertMissing(path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs"));
});

test("feature uninstall removes stop-hook only and keeps the base install", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-stop-only-"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
    features: ["stop-hook"],
  });

  await uninstallSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    features: ["stop-hook"],
  });

  const codexHooks = JSON.parse(
    await readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  const claudeSettings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );

  assert.equal(codexHooks.hooks.SessionStart.length, 1);
  assert.equal(claudeSettings.hooks.SessionStart.length, 1);
  assert.equal(codexHooks.hooks.Stop, undefined);
  assert.equal(claudeSettings.hooks.Stop, undefined);
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".agents", "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assertMissing(path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "stop_socrates_clarifying.mjs"));
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs"), "utf8")
  );
});

test("uninstall preserves unrelated hooks and settings while removing Socrates entries only", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-preserve-"));

  await writeJson(path.join(root, ".codex", "hooks.json"), {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: "echo existing codex",
            },
          ],
        },
      ],
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: "echo pretool",
            },
          ],
        },
      ],
    },
  });

  await writeJson(path.join(root, ".claude", "settings.json"), {
    permissions: {
      allow: ["Read"],
    },
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume",
          hooks: [
            {
              type: "command",
              command: "echo existing claude",
            },
          ],
        },
      ],
      Notification: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: "echo notify",
            },
          ],
        },
      ],
    },
  });

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await uninstallSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
  });

  const codexHooks = JSON.parse(
    await readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  const claudeSettings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );

  assert.equal(codexHooks.hooks.SessionStart.length, 1);
  assert.equal(codexHooks.hooks.SessionStart[0].hooks.length, 1);
  assert.equal(codexHooks.hooks.SessionStart[0].hooks[0].command, "echo existing codex");
  assert.equal(codexHooks.hooks.PreToolUse.length, 1);

  assert.deepEqual(claudeSettings.permissions, { allow: ["Read"] });
  assert.equal(claudeSettings.hooks.SessionStart.length, 1);
  assert.equal(claudeSettings.hooks.SessionStart[0].hooks.length, 1);
  assert.equal(claudeSettings.hooks.SessionStart[0].hooks[0].command, "echo existing claude");
  assert.equal(claudeSettings.hooks.Notification.length, 1);

  await assertMissing(path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "session_start_socrates_context.mjs"));
  await assertMissing(path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs"));
});

test("platform-specific uninstall removes only the requested platform", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-partial-"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await uninstallSocrates({
    platform: "claude",
    scope: "repo",
    targetRepo: root,
  });

  await assertMissing(path.join(root, ".claude", "settings.json"));
  await assertMissing(path.join(root, ".claude", "skills", "socrates", "SKILL.md"));
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".agents", "skills", "socrates", "SKILL.md"), "utf8")
  );
});

test("uninstall is idempotent when Socrates is already absent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-idempotent-"));

  await assert.doesNotReject(() =>
    uninstallSocrates({
      platform: "both",
      scope: "repo",
      targetRepo: root,
    })
  );
});

test("uninstall fails on invalid existing config schema", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-invalid-"));
  await writeJson(path.join(root, ".claude", "settings.json"), {
    hooks: [],
  });

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "claude",
        scope: "repo",
        targetRepo: root,
      }),
    /hooks field must be a JSON object/
  );
});
