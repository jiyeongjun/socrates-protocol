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
  removeLegacySessionStartHookDocuments,
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

async function buildFetchAssetMap() {
  return new Map([
    ["reference/skill-layout.json", await readFile(path.join(repoRoot, "reference/skill-layout.json"), "utf8")],
    [".agents/skills/socrates/SKILL.md", await readFile(path.join(repoRoot, ".agents/skills/socrates/SKILL.md"), "utf8")],
    [".agents/skills/socrates/agents/openai.yaml", await readFile(path.join(repoRoot, ".agents/skills/socrates/agents/openai.yaml"), "utf8")],
    [".agents/skills/socrates/references/artifact-recovery.md", await readFile(path.join(repoRoot, ".agents/skills/socrates/references/artifact-recovery.md"), "utf8")],
    [".agents/skills/socrates/references/protected-surfaces.md", await readFile(path.join(repoRoot, ".agents/skills/socrates/references/protected-surfaces.md"), "utf8")],
    [".agents/skills/socrates/references/clarification.md", await readFile(path.join(repoRoot, ".agents/skills/socrates/references/clarification.md"), "utf8")],
    [".agents/skills/socrates/references/verify-repair.md", await readFile(path.join(repoRoot, ".agents/skills/socrates/references/verify-repair.md"), "utf8")],
    [".agents/skills/socrates/references/context-file.md", await readFile(path.join(repoRoot, ".agents/skills/socrates/references/context-file.md"), "utf8")],
    [".claude/skills/socrates/SKILL.md", await readFile(path.join(repoRoot, ".claude/skills/socrates/SKILL.md"), "utf8")],
    [".claude/skills/socrates/references/artifact-recovery.md", await readFile(path.join(repoRoot, ".claude/skills/socrates/references/artifact-recovery.md"), "utf8")],
    [".claude/skills/socrates/references/protected-surfaces.md", await readFile(path.join(repoRoot, ".claude/skills/socrates/references/protected-surfaces.md"), "utf8")],
    [".claude/skills/socrates/references/clarification.md", await readFile(path.join(repoRoot, ".claude/skills/socrates/references/clarification.md"), "utf8")],
    [".claude/skills/socrates/references/verify-repair.md", await readFile(path.join(repoRoot, ".claude/skills/socrates/references/verify-repair.md"), "utf8")],
    [".claude/skills/socrates/references/context-file.md", await readFile(path.join(repoRoot, ".claude/skills/socrates/references/context-file.md"), "utf8")],
    [".claude/agents/socrates-explore.md", await readFile(path.join(repoRoot, ".claude/agents/socrates-explore.md"), "utf8")],
    [".claude/agents/socrates-plan.md", await readFile(path.join(repoRoot, ".claude/agents/socrates-plan.md"), "utf8")],
    [".claude/agents/socrates-verify.md", await readFile(path.join(repoRoot, ".claude/agents/socrates-verify.md"), "utf8")],
    [".codex/hooks/session_start_socrates_context.mjs", await readFile(path.join(repoRoot, ".codex/hooks/session_start_socrates_context.mjs"), "utf8")],
    [".codex/hooks/stop_socrates_clarifying.mjs", await readFile(path.join(repoRoot, ".codex/hooks/stop_socrates_clarifying.mjs"), "utf8")],
    ["reference/hook-utils.mjs", await readFile(path.join(repoRoot, "reference/hook-utils.mjs"), "utf8")],
    ["reference/context-doc.mjs", await readFile(path.join(repoRoot, "reference/context-doc.mjs"), "utf8")],
    ["reference/context-doc-helper-core.mjs", await readFile(path.join(repoRoot, "reference/context-doc-helper-core.mjs"), "utf8")],
    ["reference/context-doc-helper.mjs", await readFile(path.join(repoRoot, "reference/context-doc-helper.mjs"), "utf8")],
    ["reference/stop-clarifying-core.mjs", await readFile(path.join(repoRoot, "reference/stop-clarifying-core.mjs"), "utf8")],
  ]);
}

function buildContextDoc({
  version = 2,
  status = "clarifying",
  clarifyingPhase = status === "clarifying" ? "needs_question" : null,
  task = "Clarify retry policy",
  knowns = ['  - "Production service"'],
  unknowns = ['  - "Retry scope"'],
  nextQuestion = "Which failures should remain retryable?",
} = {}) {
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
knowns:
${knowns.join("\n")}
${unknownsFrontmatter}
${nextQuestionFrontmatter}
${clarifyingPhaseFrontmatter ? `${clarifyingPhaseFrontmatter}\n` : ""}decisions: []
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
${status}
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

function runNodeCli(scriptPath, args, cwd) {
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

function runShellHook(command, payload, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("/bin/zsh", ["-lc", command], {
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
          matcher: "startup|resume|clear|compact",
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
    matcher: "startup|resume|clear|compact",
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
          matcher: "startup|resume|clear|compact",
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
    matcher: "startup|resume|clear|compact",
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
          matcher: "startup|resume|clear|compact",
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
    matcher: "startup|resume|clear|compact",
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
    matcher: "startup|resume|clear|compact",
    handler: {
      type: "command",
      command: "echo startup",
    },
  });

  assert.equal(merged.hooks.SessionStart.length, 2);
  assert.equal(merged.hooks.SessionStart[0].matcher, "compact");
  assert.equal(merged.hooks.SessionStart[1].matcher, "startup|resume|clear|compact");
});

test("removeSessionStartHookDocument removes only the matching Socrates handler", () => {
  const initial = {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume|clear|compact",
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
    matcher: "startup|resume|clear|compact",
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
          matcher: "startup|resume|clear|compact",
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
    matcher: "startup|resume|clear|compact",
    handler: {
      type: "command",
      command: "echo socrates",
    },
  });

  assert.deepEqual(updated, {});
});

test("removeLegacySessionStartHookDocuments removes Socrates from legacy matchers only", () => {
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
        {
          matcher: "startup|resume|clear|compact",
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

  const updated = removeLegacySessionStartHookDocuments(initial, {
    matcher: "startup|resume|clear|compact",
    legacyMatchers: ["startup|resume"],
    handler: {
      type: "command",
      command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"',
    },
  });

  assert.equal(updated.hooks.SessionStart.length, 2);
  assert.equal(updated.hooks.SessionStart[0].matcher, "startup|resume");
  assert.equal(updated.hooks.SessionStart[0].hooks.length, 1);
  assert.equal(updated.hooks.SessionStart[0].hooks[0].command, "echo existing");
  assert.equal(updated.hooks.SessionStart[1].matcher, "startup|resume|clear|compact");
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
    "v0.3.1",
  ]);

  assert.equal(parsed.platform, "both");
  assert.equal(parsed.scope, "repo");
  assert.equal(parsed.targetRepo, "/tmp/example");
  assert.equal(parsed.version, "v0.3.1");
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
    readFile(
      path.join(
        root,
        ".agents",
        "skills",
        "socrates",
        "references",
        "artifact-recovery.md"
      ),
      "utf8"
    )
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(
      path.join(
        root,
        ".claude",
        "skills",
        "socrates",
        "references",
        "context-file.md"
      ),
      "utf8"
    )
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "agents", "socrates-explore.md"), "utf8")
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
              matcher: "startup|resume|clear|compact",
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
              matcher: "startup|resume|clear|compact",
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
        `node ${JSON.stringify(path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs"))}`
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
    readFile(
      path.join(
        fakeHome,
        ".codex",
        "skills",
        "socrates",
        "references",
        "artifact-recovery.md"
      ),
      "utf8"
    )
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
      "v0.3.1",
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
  assert.equal(settings.hooks.SessionStart[1].matcher, "startup|resume|clear|compact");
});

test("install migrates legacy Socrates session-start matcher without duplicating the handler", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-legacy-session-start-"));
  await writeJson(path.join(root, ".claude", "settings.json"), {
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
  assert.equal(settings.hooks.SessionStart[0].matcher, "startup|resume");
  assert.equal(settings.hooks.SessionStart[0].hooks.length, 1);
  assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "echo existing");
  assert.equal(settings.hooks.SessionStart[1].matcher, "startup|resume|clear|compact");
  assert.equal(settings.hooks.SessionStart[1].hooks.length, 1);
  assert.equal(
    settings.hooks.SessionStart[1].hooks[0].command,
    'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"'
  );
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
    readFile(path.join(root, ".codex", "hooks", "_socrates_stop_clarifying_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "hooks", "_socrates_stop_clarifying_core.mjs"), "utf8")
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

  await assertMissing(path.join(root, ".claude", "skills", "socrates", "SKILL.md"));
  await assertMissing(path.join(root, ".claude", "agents", "socrates-explore.md"));
  await assertMissing(
    path.join(root, ".claude", "hooks", "session_start_socrates_context.mjs")
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

  await assertMissing(path.join(root, ".agents", "skills", "socrates", "SKILL.md"));
  await assertMissing(
    path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs")
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

  await assertMissing(path.join(root, ".agents", "skills", "socrates", "SKILL.md"));
  await assertMissing(
    path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs")
  );
});

test("install falls back to fetch when local source assets are unavailable", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-fetch-"));
  const originalFetch = globalThis.fetch;
  const requested = [];
  const assetMap = await buildFetchAssetMap();

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

  assert.equal(requested.length, 13);
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "hooks.json"), "utf8")
  );
});

test("install falls back to fetch for stop-hook assets when requested", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-fetch-stop-hook-"));
  const originalFetch = globalThis.fetch;
  const requested = [];
  const assetMap = await buildFetchAssetMap();

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
      features: ["stop-hook"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requested.length, 15);
  await assert.doesNotReject(() =>
    readFile(
      path.join(fakeHome, ".codex", "hooks", "_socrates_stop_clarifying_core.mjs"),
      "utf8"
    )
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "hooks", "stop_socrates_clarifying.mjs"), "utf8")
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
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "_socrates_stop_clarifying_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "_socrates_context_doc_helper_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "socrates_context_doc_helper.mjs"), "utf8")
  );
});

test("repo-scoped Codex hook commands run from hooks.json outside git repos", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-codex-command-repo-"));
  await writeFile(path.join(root, "SOCRATES_CONTEXT.md"), buildContextDoc(), "utf8");

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
    features: ["stop-hook"],
  });

  const hooks = JSON.parse(
    await readFile(path.join(root, ".codex", "hooks.json"), "utf8")
  );
  const sessionCommand = hooks.hooks.SessionStart[0].hooks[0].command;
  const stopCommand = hooks.hooks.Stop[0].hooks[0].command;

  assert.equal(
    sessionCommand,
    `node ${JSON.stringify(path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs"))}`
  );
  assert.equal(
    stopCommand,
    `node ${JSON.stringify(path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs"))}`
  );

  const sessionResult = await runShellHook(
    sessionCommand,
    {
      cwd: root,
      hook_event_name: "SessionStart",
      source: "resume",
    },
    root
  );
  const stopResult = await runShellHook(
    stopCommand,
    {
      cwd: root,
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message:
        "I summarized the retry policy and retry scope and I am ready to implement retries now.",
    },
    root
  );

  assert.equal(sessionResult.code, 0);
  assert.equal(
    JSON.parse(sessionResult.stdout).hookSpecificOutput.hookEventName,
    "SessionStart"
  );
  assert.equal(stopResult.code, 2);
  assert.match(stopResult.stderr, /SOCRATES_CONTEXT\.md/);
});

test("repo install produces a self-contained context-doc helper", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-helper-repo-"));
  const malformedDocPath = path.join(root, "SOCRATES_CONTEXT.md");
  await writeFile(
    malformedDocPath,
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
`,
    "utf8"
  );

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  const doctor = await runNodeCli(
    path.join(root, ".codex", "hooks", "socrates_context_doc_helper.mjs"),
    ["doctor", "--file", malformedDocPath],
    root
  );

  assert.equal(doctor.code, 1);
  assert.match(doctor.stderr, /UNREPAIRABLE/);
});

test("repo-installed context-doc helper can repair a repairable doc", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-helper-repairable-"));
  const repairableDocPath = path.join(root, "SOCRATES_CONTEXT.md");
  await writeFile(
    repairableDocPath,
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

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  const repair = await runNodeCli(
    path.join(root, ".codex", "hooks", "socrates_context_doc_helper.mjs"),
    ["repair", "--file", repairableDocPath],
    root
  );

  assert.equal(repair.code, 0);
  assert.match(repair.stdout, /^Repaired /);
  assert.match(repair.stdout, /source=frontmatter/);

  const repaired = await readFile(repairableDocPath, "utf8");
  assert.match(repaired, /^---\nversion: 2\nstatus: "clarifying"/);
  assert.match(repaired, /clarifying_phase: "needs_question"/);
  assert.match(repaired, /## Task\nClarify retry policy/);
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
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "hooks", "_socrates_stop_clarifying_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".claude", "hooks", "_socrates_stop_clarifying_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".claude", "hooks", "_socrates_context_doc_helper_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".claude", "hooks", "socrates_context_doc_helper.mjs"), "utf8")
  );
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
  await assertMissing(
    path.join(
      root,
      ".agents",
      "skills",
      "socrates",
      "references",
      "artifact-recovery.md"
    )
  );
  await assertMissing(path.join(root, ".claude", "skills", "socrates", "SKILL.md"));
  await assertMissing(
    path.join(
      root,
      ".claude",
      "skills",
      "socrates",
      "references",
      "context-file.md"
    )
  );
  await assertMissing(path.join(root, ".claude", "agents", "socrates-explore.md"));
  await assertMissing(path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs"));
  await assertMissing(path.join(root, ".codex", "hooks", "_socrates_context_doc_helper_core.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "_socrates_context_doc_helper_core.mjs"));
  await assertMissing(path.join(root, ".codex", "hooks", "_socrates_stop_clarifying_core.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "_socrates_stop_clarifying_core.mjs"));
  await assertMissing(path.join(root, ".codex", "hooks", "socrates_context_doc_helper.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "socrates_context_doc_helper.mjs"));
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
  await assert.doesNotReject(() =>
    readFile(
      path.join(
        root,
        ".claude",
        "agents",
        "socrates-plan.md"
      ),
      "utf8"
    )
  );
  await assertMissing(path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "stop_socrates_clarifying.mjs"));
  await assertMissing(path.join(root, ".codex", "hooks", "_socrates_stop_clarifying_core.mjs"));
  await assertMissing(path.join(root, ".claude", "hooks", "_socrates_stop_clarifying_core.mjs"));
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "_socrates_context_doc_helper_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "hooks", "socrates_context_doc_helper.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "hooks", "_socrates_context_doc_helper_core.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "hooks", "socrates_context_doc_helper.mjs"), "utf8")
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
  await assertMissing(path.join(root, ".claude", "agents", "socrates-explore.md"));
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
