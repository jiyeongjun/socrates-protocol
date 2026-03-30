#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_VERSION = "v0.2.1";
const DEFAULT_MODE = "install";
const REPO_SLUG = "jiyeongjun/socrates-protocol";
const OPTIONAL_FEATURES = ["stop-hook"];
const SESSION_START_MATCHER = "startup|resume";
// Stop hooks do not expose a source matcher, so the installer registers the
// group broadly and leaves the Socrates-specific gating to the script itself.
const STOP_MATCH_ALL = "";
const CODEX_HOOK_STATUS = "Loading Socrates shared context";
const CODEX_STOP_HOOK_STATUS = "Checking Socrates clarification state";

const ASSETS = {
  codexSkill: ".agents/skills/socrates/SKILL.md",
  codexAgent: ".agents/skills/socrates/agents/openai.yaml",
  codexHookScript: ".codex/hooks/session_start_socrates_context.mjs",
  codexStopHookScript: ".codex/hooks/stop_socrates_clarifying.mjs",
  claudeSkill: ".claude/skills/socrates/SKILL.md",
  claudeHookScript: ".claude/hooks/session_start_socrates_context.mjs",
  claudeStopHookScript: ".claude/hooks/stop_socrates_clarifying.mjs",
  hookUtils: "reference/hook-utils.mjs",
  contextDoc: "reference/context-doc.mjs",
};

export function parseArgs(argv) {
  const options = {
    mode: DEFAULT_MODE,
    platform: "both",
    scope: "global",
    targetRepo: null,
    sourceRoot: inferLocalSourceRoot(),
    version: DEFAULT_VERSION,
    features: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--mode":
        options.mode = requireValue(current, next);
        index += 1;
        break;
      case "--platform":
        options.platform = requireValue(current, next);
        index += 1;
        break;
      case "--scope":
        options.scope = requireValue(current, next);
        index += 1;
        break;
      case "--target-repo":
        options.targetRepo = requireValue(current, next);
        index += 1;
        break;
      case "--source-root":
        options.sourceRoot = requireValue(current, next);
        index += 1;
        break;
      case "--version":
        options.version = requireValue(current, next);
        index += 1;
        break;
      case "--feature":
        options.features.push(...parseFeatureValue(requireValue(current, next)));
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  validateArgs(options);
  return options;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseFeatureValue(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateArgs(options) {
  if (!["install", "uninstall"].includes(options.mode)) {
    throw new Error("--mode must be one of: install, uninstall");
  }

  if (!["codex", "claude", "both"].includes(options.platform)) {
    throw new Error("--platform must be one of: codex, claude, both");
  }

  if (!["global", "repo"].includes(options.scope)) {
    throw new Error("--scope must be one of: global, repo");
  }

  if (options.scope === "repo" && !options.targetRepo) {
    throw new Error("--target-repo is required when --scope repo is used");
  }

  const invalidFeatures = (options.features ?? []).filter(
    (feature) => !OPTIONAL_FEATURES.includes(feature)
  );
  if (invalidFeatures.length > 0) {
    throw new Error(
      `--feature must be one of: ${OPTIONAL_FEATURES.join(", ")}`
    );
  }
}

function inferLocalSourceRoot() {
  if (!import.meta.url.startsWith("file:")) {
    return null;
  }

  const scriptPath = fileURLToPath(import.meta.url);
  const candidate = path.resolve(path.dirname(scriptPath), "..");
  return existsSync(path.join(candidate, ASSETS.codexSkill)) ? candidate : null;
}

export async function installSocrates(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  validateArgs(options);

  const summary = [];
  const assetLoader = createAssetLoader(options);
  const platforms = resolvePlatforms(options.platform);

  for (const platform of platforms) {
    if (platform === "codex") {
      summary.push(...(await installCodex(options, assetLoader)));
      continue;
    }

    if (platform === "claude") {
      summary.push(...(await installClaude(options, assetLoader)));
    }
  }

  return summary;
}

export async function uninstallSocrates(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  validateArgs(options);

  const summary = [];
  const platforms = resolvePlatforms(options.platform);

  for (const platform of platforms) {
    if (platform === "codex") {
      summary.push(...(await uninstallCodex(options)));
      continue;
    }

    if (platform === "claude") {
      summary.push(...(await uninstallClaude(options)));
    }
  }

  return summary;
}

function normalizeOptions(rawOptions) {
  return {
    mode: rawOptions.mode ?? DEFAULT_MODE,
    platform: rawOptions.platform ?? "both",
    scope: rawOptions.scope ?? "global",
    targetRepo:
      rawOptions.targetRepo === undefined ? null : rawOptions.targetRepo,
    sourceRoot:
      rawOptions.sourceRoot === undefined ? inferLocalSourceRoot() : rawOptions.sourceRoot,
    version: rawOptions.version ?? DEFAULT_VERSION,
    homeDir: rawOptions.homeDir ?? homedir(),
    features: [...new Set(rawOptions.features ?? [])],
  };
}

function resolvePlatforms(platform) {
  if (platform === "both") {
    return ["codex", "claude"];
  }
  return [platform];
}

function createAssetLoader(options) {
  return async function loadAsset(relativePath) {
    if (options.sourceRoot) {
      try {
        const localPath = path.join(options.sourceRoot, relativePath);
        return await readFile(localPath, "utf8");
      } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    const url =
      `https://raw.githubusercontent.com/${REPO_SLUG}/${options.version}/${relativePath}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${relativePath} from ${url}`);
    }
    return response.text();
  };
}

async function installCodex(options, loadAsset) {
  const {
    repoInstall,
    skillPath,
    agentPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    stopHookScriptPath,
    hooksConfigPath,
  } = getCodexTargets(options);

  await writeTextFile(skillPath, await loadAsset(ASSETS.codexSkill));
  await writeTextFile(agentPath, await loadAsset(ASSETS.codexAgent));
  await writeTextFile(hookScriptPath, await loadAsset(ASSETS.codexHookScript));
  await writeTextFile(hookUtilsPath, await loadAsset(ASSETS.hookUtils));
  await writeTextFile(hookContextDocPath, await loadAsset(ASSETS.contextDoc));

  const hookConfig = await readJsonFileOrDefault(hooksConfigPath, {});
  let merged = mergeSessionStartHookDocument(hookConfig, {
    matcher: SESSION_START_MATCHER,
    handler: {
      type: "command",
      command: repoInstall
        ? 'node "$(git rev-parse --show-toplevel)/.codex/hooks/session_start_socrates_context.mjs"'
        : `node ${JSON.stringify(hookScriptPath)}`,
      statusMessage: CODEX_HOOK_STATUS,
    },
  });

  if (options.features.includes("stop-hook")) {
    await writeTextFile(
      stopHookScriptPath,
      await loadAsset(ASSETS.codexStopHookScript)
    );
    merged = mergeStopHookDocument(merged, {
      matcher: STOP_MATCH_ALL,
      handler: {
        type: "command",
        command: repoInstall
          ? 'node "$(git rev-parse --show-toplevel)/.codex/hooks/stop_socrates_clarifying.mjs"'
          : `node ${JSON.stringify(stopHookScriptPath)}`,
        statusMessage: CODEX_STOP_HOOK_STATUS,
      },
    });
  }

  await writeJsonFile(hooksConfigPath, merged);

  return [
    skillPath,
    agentPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    ...(options.features.includes("stop-hook") ? [stopHookScriptPath] : []),
    hooksConfigPath,
  ];
}

async function installClaude(options, loadAsset) {
  const {
    repoInstall,
    skillPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    stopHookScriptPath,
    settingsPath,
  } =
    getClaudeTargets(options);

  await writeTextFile(skillPath, await loadAsset(ASSETS.claudeSkill));
  await writeTextFile(
    hookScriptPath,
    await loadAsset(ASSETS.claudeHookScript)
  );
  await writeTextFile(hookUtilsPath, await loadAsset(ASSETS.hookUtils));
  await writeTextFile(hookContextDocPath, await loadAsset(ASSETS.contextDoc));

  const settings = await readJsonFileOrDefault(settingsPath, {});
  let merged = mergeSessionStartHookDocument(settings, {
    matcher: SESSION_START_MATCHER,
    handler: {
      type: "command",
      command: repoInstall
        ? 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"'
        : `node ${JSON.stringify(hookScriptPath)}`,
    },
  });

  if (options.features.includes("stop-hook")) {
    await writeTextFile(
      stopHookScriptPath,
      await loadAsset(ASSETS.claudeStopHookScript)
    );
    merged = mergeStopHookDocument(merged, {
      matcher: STOP_MATCH_ALL,
      handler: {
        type: "command",
        command: repoInstall
          ? 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/stop_socrates_clarifying.mjs"'
          : `node ${JSON.stringify(stopHookScriptPath)}`,
      },
    });
  }

  await writeJsonFile(settingsPath, merged);

  return [
    skillPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    ...(options.features.includes("stop-hook") ? [stopHookScriptPath] : []),
    settingsPath,
  ];
}

async function uninstallCodex(options) {
  const {
    repoInstall,
    skillPath,
    agentPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    stopHookScriptPath,
    hooksConfigPath,
  } = getCodexTargets(options);

  const removeOptionalOnly = options.features.length > 0;

  if (!removeOptionalOnly) {
    await deleteFile(skillPath);
    await deleteFile(agentPath);
    await deleteFile(hookScriptPath);
    await deleteFile(hookUtilsPath);
    await deleteFile(hookContextDocPath);
  }
  if (options.features.includes("stop-hook") || !removeOptionalOnly) {
    await deleteFile(stopHookScriptPath);
  }

  const hookConfig = await readJsonFileIfExists(hooksConfigPath);
  if (hookConfig !== null) {
    let updated = hookConfig;
    if (!removeOptionalOnly) {
      updated = removeSessionStartHookDocument(updated, {
        matcher: SESSION_START_MATCHER,
        handler: {
          type: "command",
          command: repoInstall
            ? 'node "$(git rev-parse --show-toplevel)/.codex/hooks/session_start_socrates_context.mjs"'
            : `node ${JSON.stringify(hookScriptPath)}`,
          statusMessage: CODEX_HOOK_STATUS,
        },
      });
    }
    if (options.features.includes("stop-hook") || !removeOptionalOnly) {
      updated = removeStopHookDocument(updated, {
        matcher: STOP_MATCH_ALL,
        handler: {
          type: "command",
          command: repoInstall
            ? 'node "$(git rev-parse --show-toplevel)/.codex/hooks/stop_socrates_clarifying.mjs"'
            : `node ${JSON.stringify(stopHookScriptPath)}`,
          statusMessage: CODEX_STOP_HOOK_STATUS,
        },
      });
    }
    await writeJsonFileOrDelete(hooksConfigPath, updated);
  }

  return [
    skillPath,
    agentPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    stopHookScriptPath,
    hooksConfigPath,
  ];
}

async function uninstallClaude(options) {
  const {
    repoInstall,
    skillPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    stopHookScriptPath,
    settingsPath,
  } =
    getClaudeTargets(options);

  const removeOptionalOnly = options.features.length > 0;

  if (!removeOptionalOnly) {
    await deleteFile(skillPath);
    await deleteFile(hookScriptPath);
    await deleteFile(hookUtilsPath);
    await deleteFile(hookContextDocPath);
  }
  if (options.features.includes("stop-hook") || !removeOptionalOnly) {
    await deleteFile(stopHookScriptPath);
  }

  const settings = await readJsonFileIfExists(settingsPath);
  if (settings !== null) {
    let updated = settings;
    if (!removeOptionalOnly) {
      updated = removeSessionStartHookDocument(updated, {
        matcher: SESSION_START_MATCHER,
        handler: {
          type: "command",
          command: repoInstall
            ? 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"'
            : `node ${JSON.stringify(hookScriptPath)}`,
        },
      });
    }
    if (options.features.includes("stop-hook") || !removeOptionalOnly) {
      updated = removeStopHookDocument(updated, {
        matcher: STOP_MATCH_ALL,
        handler: {
          type: "command",
          command: repoInstall
            ? 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/stop_socrates_clarifying.mjs"'
            : `node ${JSON.stringify(stopHookScriptPath)}`,
        },
      });
    }
    await writeJsonFileOrDelete(settingsPath, updated);
  }

  return [
    skillPath,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    stopHookScriptPath,
    settingsPath,
  ];
}

function getCodexTargets(options) {
  const root =
    options.scope === "repo"
      ? path.resolve(options.targetRepo)
      : path.join(options.homeDir, ".codex");
  const repoInstall = options.scope === "repo";

  return {
    repoInstall,
    skillPath: repoInstall
      ? path.join(root, ".agents", "skills", "socrates", "SKILL.md")
      : path.join(root, "skills", "socrates", "SKILL.md"),
    agentPath: repoInstall
      ? path.join(root, ".agents", "skills", "socrates", "agents", "openai.yaml")
      : path.join(root, "skills", "socrates", "agents", "openai.yaml"),
    hookScriptPath: repoInstall
      ? path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs")
      : path.join(root, "hooks", "session_start_socrates_context.mjs"),
    hookUtilsPath: repoInstall
      ? path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs")
      : path.join(root, "hooks", "_socrates_hook_utils.mjs"),
    hookContextDocPath: repoInstall
      ? path.join(root, ".codex", "hooks", "_socrates_context_doc.mjs")
      : path.join(root, "hooks", "_socrates_context_doc.mjs"),
    stopHookScriptPath: repoInstall
      ? path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs")
      : path.join(root, "hooks", "stop_socrates_clarifying.mjs"),
    hooksConfigPath: repoInstall
      ? path.join(root, ".codex", "hooks.json")
      : path.join(root, "hooks.json"),
  };
}

function getClaudeTargets(options) {
  const root =
    options.scope === "repo"
      ? path.resolve(options.targetRepo)
      : path.join(options.homeDir, ".claude");
  const repoInstall = options.scope === "repo";

  return {
    repoInstall,
    skillPath: repoInstall
      ? path.join(root, ".claude", "skills", "socrates", "SKILL.md")
      : path.join(root, "skills", "socrates", "SKILL.md"),
    hookScriptPath: repoInstall
      ? path.join(root, ".claude", "hooks", "session_start_socrates_context.mjs")
      : path.join(root, "hooks", "session_start_socrates_context.mjs"),
    hookUtilsPath: repoInstall
      ? path.join(root, ".claude", "hooks", "_socrates_hook_utils.mjs")
      : path.join(root, "hooks", "_socrates_hook_utils.mjs"),
    hookContextDocPath: repoInstall
      ? path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs")
      : path.join(root, "hooks", "_socrates_context_doc.mjs"),
    stopHookScriptPath: repoInstall
      ? path.join(root, ".claude", "hooks", "stop_socrates_clarifying.mjs")
      : path.join(root, "hooks", "stop_socrates_clarifying.mjs"),
    settingsPath: repoInstall
      ? path.join(root, ".claude", "settings.json")
      : path.join(root, "settings.json"),
  };
}

export function mergeSessionStartHookDocument(document, { matcher, handler }) {
  return mergeHookDocument(document, {
    eventName: "SessionStart",
    matcher,
    handler,
  });
}

export function mergeStopHookDocument(document, { matcher, handler }) {
  return mergeHookDocument(document, {
    eventName: "Stop",
    matcher,
    handler,
  });
}

function mergeHookDocument(document, { eventName, matcher, handler }) {
  if (!isPlainObject(document)) {
    throw new Error("Existing config must be a JSON object");
  }

  const next = structuredClone(document);

  if (next.hooks === undefined) {
    next.hooks = {};
  }
  if (!isPlainObject(next.hooks)) {
    throw new Error("The existing hooks field must be a JSON object");
  }

  const groups = next.hooks[eventName];
  if (groups === undefined) {
    next.hooks[eventName] = [];
  } else if (!Array.isArray(groups)) {
    throw new Error(`The existing ${eventName} hook list must be an array`);
  }

  let group = next.hooks[eventName].find(
    (entry) => isPlainObject(entry) && (entry.matcher ?? "") === matcher
  );

  if (!group) {
    group = {
      matcher,
      hooks: [],
    };
    next.hooks[eventName].push(group);
  }

  if (!Array.isArray(group.hooks)) {
    throw new Error(`The matched ${eventName} hook group must contain a hooks array`);
  }

  if (!group.hooks.some((entry) => hookEquals(entry, handler))) {
    group.hooks.push(handler);
  }

  return next;
}

export function removeSessionStartHookDocument(document, { matcher, handler }) {
  return removeHookDocument(document, {
    eventName: "SessionStart",
    matcher,
    handler,
  });
}

export function removeStopHookDocument(document, { matcher, handler }) {
  return removeHookDocument(document, {
    eventName: "Stop",
    matcher,
    handler,
  });
}

function removeHookDocument(document, { eventName, matcher, handler }) {
  if (!isPlainObject(document)) {
    throw new Error("Existing config must be a JSON object");
  }

  const next = structuredClone(document);

  if (next.hooks === undefined) {
    return next;
  }
  if (!isPlainObject(next.hooks)) {
    throw new Error("The existing hooks field must be a JSON object");
  }

  const groups = next.hooks[eventName];
  if (groups === undefined) {
    return next;
  }
  if (!Array.isArray(groups)) {
    throw new Error(`The existing ${eventName} hook list must be an array`);
  }

  next.hooks[eventName] = groups.flatMap((group) => {
    if (!isPlainObject(group)) {
      throw new Error(`Each ${eventName} hook group must be a JSON object`);
    }

    if ((group.matcher ?? "") !== matcher) {
      return [group];
    }

    if (!Array.isArray(group.hooks)) {
      throw new Error(`The matched ${eventName} hook group must contain a hooks array`);
    }

    const filteredHooks = group.hooks.filter((entry) => !hookEquals(entry, handler));
    if (filteredHooks.length === 0) {
      return [];
    }

    return [
      {
        ...group,
        hooks: filteredHooks,
      },
    ];
  });

  if (next.hooks[eventName].length === 0) {
    delete next.hooks[eventName];
  }
  if (Object.keys(next.hooks).length === 0) {
    delete next.hooks;
  }

  return next;
}

function hookEquals(left, right) {
  const leftStatusMessage =
    isPlainObject(left) && typeof left.statusMessage === "string"
      ? left.statusMessage
      : null;
  const rightStatusMessage =
    typeof right.statusMessage === "string" ? right.statusMessage : null;

  return (
    isPlainObject(left) &&
    left.type === right.type &&
    left.command === right.command &&
    (
      leftStatusMessage === rightStatusMessage ||
      leftStatusMessage === null ||
      rightStatusMessage === null
    )
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJsonFileOrDefault(target, fallback) {
  const parsed = await readJsonFileIfExists(target);
  return parsed === null ? structuredClone(fallback) : parsed;
}

async function readJsonFileIfExists(target) {
  try {
    const contents = await readFile(target, "utf8");
    const parsed = JSON.parse(contents);
    if (!isPlainObject(parsed)) {
      throw new Error(`${target} must contain a top-level JSON object`);
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeTextFile(target, contents) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
}

async function writeJsonFile(target, value) {
  await writeTextFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonFileOrDelete(target, value) {
  if (isPlainObject(value) && Object.keys(value).length === 0) {
    await deleteFile(target);
    return;
  }

  await writeJsonFile(target, value);
}

async function deleteFile(target) {
  await rm(target, { force: true });
}

export function renderHelp() {
  return `Socrates installer

Usage:
  node install.mjs --mode install --platform both --scope global --version ${DEFAULT_VERSION}
  node install.mjs --mode install --platform both --scope repo --target-repo /absolute/path --version ${DEFAULT_VERSION}
  node install.mjs --mode uninstall --platform both --scope global

Options:
  --mode install|uninstall
  --platform codex|claude|both
  --scope global|repo
  --target-repo /absolute/path
  --source-root /absolute/path/to/local/repo
  --version git-ref-or-tag
  --feature ${OPTIONAL_FEATURES.join("|")}
`;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help) {
    process.stdout.write(renderHelp());
    return;
  }

  const changed =
    options.mode === "uninstall"
      ? await uninstallSocrates(options)
      : await installSocrates(options);
  const verb = options.mode === "uninstall" ? "Removed Socrates from" : "Installed Socrates to";
  process.stdout.write(`${verb}:\n${changed.map((entry) => `- ${entry}`).join("\n")}\n`);
}

const isStdinModule = process.argv[1] === "-";
const isFileModule =
  process.argv[1] &&
  import.meta.url.startsWith("file:") &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isStdinModule || isFileModule) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
