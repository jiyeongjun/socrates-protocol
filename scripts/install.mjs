#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_VERSION = "v0.4.1";
const DEFAULT_MODE = "install";
const REPO_SLUG = "jiyeongjun/socrates-protocol";
const OPTIONAL_FEATURES = ["stop-hook"];
const SESSION_START_MATCHER = "startup|resume|clear|compact";
const LEGACY_SESSION_START_MATCHERS = ["startup|resume"];
// Stop hooks do not expose a source matcher, so the installer registers the
// group broadly and leaves the Socrates-specific gating to the script itself.
const STOP_MATCH_ALL = "";
const CODEX_HOOK_STATUS = "Loading Socrates shared context";
const CODEX_STOP_HOOK_STATUS = "Checking Socrates clarification state";

function buildRelativeAssetMap(baseDir, names) {
  return Object.fromEntries(
    names.map((name) => [name, `${baseDir}/${name}`])
  );
}

function buildNodeCommand(scriptPath) {
  return `node ${JSON.stringify(scriptPath)}`;
}

const ASSETS = {
  skillLayout: "reference/skill-layout.json",
  modelPolicy: "reference/model-policy.json",
  codexSkill: ".agents/skills/socrates/SKILL.md",
  codexAgent: ".agents/skills/socrates/agents/openai.yaml",
  codexModelPolicy: ".agents/skills/socrates/model-policy.json",
  codexReferencesDir: ".agents/skills/socrates/references",
  codexHookScript: ".codex/hooks/session_start_socrates_context.mjs",
  codexStopHookScript: ".codex/hooks/stop_socrates_clarifying.mjs",
  claudeSkill: ".claude/skills/socrates/SKILL.md",
  claudeModelPolicy: ".claude/skills/socrates/model-policy.json",
  claudeReferencesDir: ".claude/skills/socrates/references",
  claudeAgentsDir: ".claude/agents",
  claudeHookScript: ".claude/hooks/session_start_socrates_context.mjs",
  claudeStopHookScript: ".claude/hooks/stop_socrates_clarifying.mjs",
  hookUtils: "reference/hook-utils.mjs",
  contextDoc: "reference/context-doc.mjs",
  contextDocHelperCore: "reference/context-doc-helper-core.mjs",
  contextDocHelper: "reference/context-doc-helper.mjs",
  stopClarifyingCore: "reference/stop-clarifying-core.mjs",
};

export function listReleaseAssetPaths(skillLayout) {
  const codexReferenceAssets = buildRelativeAssetMap(
    ASSETS.codexReferencesDir,
    skillLayout.skillReferences
  );
  const claudeReferenceAssets = buildRelativeAssetMap(
    ASSETS.claudeReferencesDir,
    skillLayout.skillReferences
  );
  const claudeAgentAssets = buildRelativeAssetMap(
    ASSETS.claudeAgentsDir,
    skillLayout.claudeAgents
  );

  return [
    "scripts/install.mjs",
    ASSETS.skillLayout,
    ASSETS.modelPolicy,
    ASSETS.codexSkill,
    ASSETS.codexAgent,
    ASSETS.codexModelPolicy,
    ...Object.values(codexReferenceAssets),
    ASSETS.claudeSkill,
    ASSETS.claudeModelPolicy,
    ...Object.values(claudeReferenceAssets),
    ...Object.values(claudeAgentAssets),
    ASSETS.codexHookScript,
    ASSETS.codexStopHookScript,
    ASSETS.claudeHookScript,
    ASSETS.claudeStopHookScript,
    ASSETS.hookUtils,
    ASSETS.contextDoc,
    ASSETS.contextDocHelperCore,
    ASSETS.contextDocHelper,
    ASSETS.stopClarifyingCore,
  ];
}

export function parseArgs(argv) {
  const options = {
    mode: DEFAULT_MODE,
    platform: "both",
    scope: "global",
    targetRepo: null,
    sourceRoot: inferLocalSourceRoot(),
    version: DEFAULT_VERSION,
    features: [],
    enableCodexHooks: false,
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
      case "--enable-codex-hooks":
        options.enableCodexHooks = true;
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

  if (options.enableCodexHooks) {
    if (options.mode !== "install") {
      throw new Error("--enable-codex-hooks can only be used with --mode install");
    }
    if (!["codex", "both"].includes(options.platform)) {
      throw new Error(
        "--enable-codex-hooks requires --platform codex or --platform both"
      );
    }
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
  const skillLayout = await loadSkillLayout(assetLoader);
  const platforms = resolvePlatforms(options.platform);

  for (const platform of platforms) {
    if (platform === "codex") {
      summary.push(...(await installCodex(options, assetLoader, skillLayout)));
      continue;
    }

    if (platform === "claude") {
      summary.push(...(await installClaude(options, assetLoader, skillLayout)));
    }
  }

  if (options.enableCodexHooks) {
    summary.push(await enableCodexHooks(options));
  }

  return summary;
}

export async function uninstallSocrates(rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  validateArgs(options);

  const summary = [];
  const assetLoader = createAssetLoader(options);
  const skillLayout = await loadSkillLayout(assetLoader);
  const platforms = resolvePlatforms(options.platform);

  for (const platform of platforms) {
    if (platform === "codex") {
      summary.push(...(await uninstallCodex(options, skillLayout)));
      continue;
    }

    if (platform === "claude") {
      summary.push(...(await uninstallClaude(options, skillLayout)));
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
    enableCodexHooks: rawOptions.enableCodexHooks ?? false,
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

async function installCodex(options, loadAsset, skillLayout) {
  const {
    repoInstall,
    skillPath,
    agentPath,
    modelPolicyPath,
    referencePaths,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    stopHookCorePath,
    stopHookScriptPath,
    hooksConfigPath,
  } = getCodexTargets(options, skillLayout);
  const referenceAssets = buildRelativeAssetMap(
    ASSETS.codexReferencesDir,
    skillLayout.skillReferences
  );

  const hookConfig = await readJsonFileOrDefault(hooksConfigPath, {});
  let merged = mergeSessionStartHookDocument(hookConfig, {
    matcher: SESSION_START_MATCHER,
    handler: {
      type: "command",
      command: buildNodeCommand(hookScriptPath),
      statusMessage: CODEX_HOOK_STATUS,
    },
  });
  merged = removeLegacySessionStartHookDocuments(merged, {
    matcher: SESSION_START_MATCHER,
    legacyMatchers: LEGACY_SESSION_START_MATCHERS,
    handler: {
      type: "command",
      command: buildNodeCommand(hookScriptPath),
      statusMessage: CODEX_HOOK_STATUS,
    },
  });

  if (options.features.includes("stop-hook")) {
    merged = mergeStopHookDocument(merged, {
      matcher: STOP_MATCH_ALL,
      handler: {
        type: "command",
        command: buildNodeCommand(stopHookScriptPath),
        statusMessage: CODEX_STOP_HOOK_STATUS,
      },
    });
  }

  await writeTextFile(skillPath, await loadAsset(ASSETS.codexSkill));
  await writeTextFile(agentPath, await loadAsset(ASSETS.codexAgent));
  await writeTextFile(
    modelPolicyPath,
    await loadAsset(ASSETS.codexModelPolicy)
  );
  for (const name of skillLayout.skillReferences) {
    await writeTextFile(
      referencePaths[name],
      await loadAsset(referenceAssets[name])
    );
  }
  await writeTextFile(hookScriptPath, await loadAsset(ASSETS.codexHookScript));
  await writeTextFile(hookUtilsPath, await loadAsset(ASSETS.hookUtils));
  await writeTextFile(hookContextDocPath, await loadAsset(ASSETS.contextDoc));
  await writeTextFile(
    contextDocHelperCorePath,
    await loadAsset(ASSETS.contextDocHelperCore)
  );
  await writeTextFile(
    contextDocHelperPath,
    await loadAsset(ASSETS.contextDocHelper)
  );

  if (options.features.includes("stop-hook")) {
    await writeTextFile(
      stopHookCorePath,
      await loadAsset(ASSETS.stopClarifyingCore)
    );
    await writeTextFile(
      stopHookScriptPath,
      await loadAsset(ASSETS.codexStopHookScript)
    );
  }

  await writeJsonFile(hooksConfigPath, merged);

  return [
    skillPath,
    agentPath,
    modelPolicyPath,
    ...Object.values(referencePaths),
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    ...(options.features.includes("stop-hook")
      ? [stopHookCorePath, stopHookScriptPath]
      : []),
    hooksConfigPath,
  ];
}

async function installClaude(options, loadAsset, skillLayout) {
  const {
    repoInstall,
    skillPath,
    modelPolicyPath,
    referencePaths,
    agentPaths,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    stopHookCorePath,
    stopHookScriptPath,
    settingsPath,
  } =
    getClaudeTargets(options, skillLayout);
  const referenceAssets = buildRelativeAssetMap(
    ASSETS.claudeReferencesDir,
    skillLayout.skillReferences
  );
  const claudeAgentAssets = buildRelativeAssetMap(
    ASSETS.claudeAgentsDir,
    skillLayout.claudeAgents
  );

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
  merged = removeLegacySessionStartHookDocuments(merged, {
    matcher: SESSION_START_MATCHER,
    legacyMatchers: LEGACY_SESSION_START_MATCHERS,
    handler: {
      type: "command",
      command: repoInstall
        ? 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/session_start_socrates_context.mjs"'
        : `node ${JSON.stringify(hookScriptPath)}`,
    },
  });

  if (options.features.includes("stop-hook")) {
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

  await writeTextFile(skillPath, await loadAsset(ASSETS.claudeSkill));
  await writeTextFile(
    modelPolicyPath,
    await loadAsset(ASSETS.claudeModelPolicy)
  );
  for (const name of skillLayout.skillReferences) {
    await writeTextFile(
      referencePaths[name],
      await loadAsset(referenceAssets[name])
    );
  }
  for (const name of skillLayout.claudeAgents) {
    await writeTextFile(
      agentPaths[name],
      await loadAsset(claudeAgentAssets[name])
    );
  }
  await writeTextFile(
    hookScriptPath,
    await loadAsset(ASSETS.claudeHookScript)
  );
  await writeTextFile(hookUtilsPath, await loadAsset(ASSETS.hookUtils));
  await writeTextFile(hookContextDocPath, await loadAsset(ASSETS.contextDoc));
  await writeTextFile(
    contextDocHelperCorePath,
    await loadAsset(ASSETS.contextDocHelperCore)
  );
  await writeTextFile(
    contextDocHelperPath,
    await loadAsset(ASSETS.contextDocHelper)
  );

  if (options.features.includes("stop-hook")) {
    await writeTextFile(
      stopHookCorePath,
      await loadAsset(ASSETS.stopClarifyingCore)
    );
    await writeTextFile(
      stopHookScriptPath,
      await loadAsset(ASSETS.claudeStopHookScript)
    );
  }

  await writeJsonFile(settingsPath, merged);

  return [
    skillPath,
    modelPolicyPath,
    ...Object.values(referencePaths),
    ...Object.values(agentPaths),
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    ...(options.features.includes("stop-hook")
      ? [stopHookCorePath, stopHookScriptPath]
      : []),
    settingsPath,
  ];
}

async function uninstallCodex(options, skillLayout) {
  const {
    repoInstall,
    skillPath,
    agentPath,
    modelPolicyPath,
    referencePaths,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    stopHookCorePath,
    stopHookScriptPath,
    hooksConfigPath,
  } = getCodexTargets(options, skillLayout);

  const removeOptionalOnly = options.features.length > 0;

  if (!removeOptionalOnly) {
    await deleteFile(skillPath);
    await deleteFile(agentPath);
    await deleteFile(modelPolicyPath);
    for (const target of Object.values(referencePaths)) {
      await deleteFile(target);
    }
    await deleteFile(hookScriptPath);
    await deleteFile(hookUtilsPath);
    await deleteFile(hookContextDocPath);
    await deleteFile(contextDocHelperCorePath);
    await deleteFile(contextDocHelperPath);
  }
  if (options.features.includes("stop-hook") || !removeOptionalOnly) {
    await deleteFile(stopHookCorePath);
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
          command: buildNodeCommand(hookScriptPath),
          statusMessage: CODEX_HOOK_STATUS,
        },
      });
      updated = removeLegacySessionStartHookDocuments(updated, {
        matcher: SESSION_START_MATCHER,
        legacyMatchers: LEGACY_SESSION_START_MATCHERS,
        handler: {
          type: "command",
          command: buildNodeCommand(hookScriptPath),
          statusMessage: CODEX_HOOK_STATUS,
        },
      });
    }
    if (options.features.includes("stop-hook") || !removeOptionalOnly) {
      updated = removeStopHookDocument(updated, {
        matcher: STOP_MATCH_ALL,
        handler: {
          type: "command",
          command: buildNodeCommand(stopHookScriptPath),
          statusMessage: CODEX_STOP_HOOK_STATUS,
        },
      });
    }
    await writeJsonFileOrDelete(hooksConfigPath, updated);
  }

  return [
    skillPath,
    agentPath,
    modelPolicyPath,
    ...Object.values(referencePaths),
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    stopHookCorePath,
    stopHookScriptPath,
    hooksConfigPath,
  ];
}

async function uninstallClaude(options, skillLayout) {
  const {
    repoInstall,
    skillPath,
    modelPolicyPath,
    referencePaths,
    agentPaths,
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    stopHookCorePath,
    stopHookScriptPath,
    settingsPath,
  } =
    getClaudeTargets(options, skillLayout);

  const removeOptionalOnly = options.features.length > 0;

  if (!removeOptionalOnly) {
    await deleteFile(skillPath);
    await deleteFile(modelPolicyPath);
    for (const target of Object.values(referencePaths)) {
      await deleteFile(target);
    }
    for (const target of Object.values(agentPaths)) {
      await deleteFile(target);
    }
    await deleteFile(hookScriptPath);
    await deleteFile(hookUtilsPath);
    await deleteFile(hookContextDocPath);
    await deleteFile(contextDocHelperCorePath);
    await deleteFile(contextDocHelperPath);
  }
  if (options.features.includes("stop-hook") || !removeOptionalOnly) {
    await deleteFile(stopHookCorePath);
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
      updated = removeLegacySessionStartHookDocuments(updated, {
        matcher: SESSION_START_MATCHER,
        legacyMatchers: LEGACY_SESSION_START_MATCHERS,
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
    modelPolicyPath,
    ...Object.values(referencePaths),
    ...Object.values(agentPaths),
    hookScriptPath,
    hookUtilsPath,
    hookContextDocPath,
    contextDocHelperCorePath,
    contextDocHelperPath,
    stopHookCorePath,
    stopHookScriptPath,
    settingsPath,
  ];
}

async function enableCodexHooks(options) {
  const configPath = path.join(options.homeDir, ".codex", "config.toml");
  const existing = (await readTextFileIfExists(configPath)) ?? "";
  await writeTextFile(configPath, mergeCodexHooksFeature(existing));
  return configPath;
}

export function mergeCodexHooksFeature(toml) {
  const normalized = toml.replace(/\r\n/g, "\n");
  const featuresPattern = /^\[features\]\s*$(?:\n(?!\[).*)*/m;

  if (!featuresPattern.test(normalized)) {
    const prefix = normalized.trimEnd();
    const next =
      prefix === ""
        ? "[features]\ncodex_hooks = true\n"
        : `${prefix}\n\n[features]\ncodex_hooks = true\n`;
    return ensureTrailingNewline(next);
  }

  const next = normalized.replace(featuresPattern, (section) => {
    if (/^\s*codex_hooks\s*=.*$/m.test(section)) {
      return section.replace(/^\s*codex_hooks\s*=.*$/m, "codex_hooks = true");
    }
    return `${section}\ncodex_hooks = true`;
  });

  return ensureTrailingNewline(next);
}

function getCodexTargets(options, skillLayout) {
  const root =
    options.scope === "repo"
      ? path.resolve(options.targetRepo)
      : path.join(options.homeDir, ".codex");
  const repoInstall = options.scope === "repo";
  const skillDir = repoInstall
    ? path.join(root, ".agents", "skills", "socrates")
    : path.join(root, "skills", "socrates");

  return {
    repoInstall,
    skillPath: path.join(skillDir, "SKILL.md"),
    agentPath: path.join(skillDir, "agents", "openai.yaml"),
    modelPolicyPath: path.join(skillDir, "model-policy.json"),
    referencePaths: buildTargetPathMap(
      path.join(skillDir, "references"),
      skillLayout.skillReferences
    ),
    hookScriptPath: repoInstall
      ? path.join(root, ".codex", "hooks", "session_start_socrates_context.mjs")
      : path.join(root, "hooks", "session_start_socrates_context.mjs"),
    hookUtilsPath: repoInstall
      ? path.join(root, ".codex", "hooks", "_socrates_hook_utils.mjs")
      : path.join(root, "hooks", "_socrates_hook_utils.mjs"),
    hookContextDocPath: repoInstall
      ? path.join(root, ".codex", "hooks", "_socrates_context_doc.mjs")
      : path.join(root, "hooks", "_socrates_context_doc.mjs"),
    contextDocHelperCorePath: repoInstall
      ? path.join(root, ".codex", "hooks", "_socrates_context_doc_helper_core.mjs")
      : path.join(root, "hooks", "_socrates_context_doc_helper_core.mjs"),
    contextDocHelperPath: repoInstall
      ? path.join(root, ".codex", "hooks", "socrates_context_doc_helper.mjs")
      : path.join(root, "hooks", "socrates_context_doc_helper.mjs"),
    stopHookCorePath: repoInstall
      ? path.join(root, ".codex", "hooks", "_socrates_stop_clarifying_core.mjs")
      : path.join(root, "hooks", "_socrates_stop_clarifying_core.mjs"),
    stopHookScriptPath: repoInstall
      ? path.join(root, ".codex", "hooks", "stop_socrates_clarifying.mjs")
      : path.join(root, "hooks", "stop_socrates_clarifying.mjs"),
    hooksConfigPath: repoInstall
      ? path.join(root, ".codex", "hooks.json")
      : path.join(root, "hooks.json"),
  };
}

function getClaudeTargets(options, skillLayout) {
  const root =
    options.scope === "repo"
      ? path.resolve(options.targetRepo)
      : path.join(options.homeDir, ".claude");
  const repoInstall = options.scope === "repo";
  const skillDir = repoInstall
    ? path.join(root, ".claude", "skills", "socrates")
    : path.join(root, "skills", "socrates");
  const agentDir = repoInstall
    ? path.join(root, ".claude", "agents")
    : path.join(root, "agents");

  return {
    repoInstall,
    skillPath: path.join(skillDir, "SKILL.md"),
    modelPolicyPath: path.join(skillDir, "model-policy.json"),
    referencePaths: buildTargetPathMap(
      path.join(skillDir, "references"),
      skillLayout.skillReferences
    ),
    agentPaths: buildTargetPathMap(agentDir, skillLayout.claudeAgents),
    hookScriptPath: repoInstall
      ? path.join(root, ".claude", "hooks", "session_start_socrates_context.mjs")
      : path.join(root, "hooks", "session_start_socrates_context.mjs"),
    hookUtilsPath: repoInstall
      ? path.join(root, ".claude", "hooks", "_socrates_hook_utils.mjs")
      : path.join(root, "hooks", "_socrates_hook_utils.mjs"),
    hookContextDocPath: repoInstall
      ? path.join(root, ".claude", "hooks", "_socrates_context_doc.mjs")
      : path.join(root, "hooks", "_socrates_context_doc.mjs"),
    contextDocHelperCorePath: repoInstall
      ? path.join(root, ".claude", "hooks", "_socrates_context_doc_helper_core.mjs")
      : path.join(root, "hooks", "_socrates_context_doc_helper_core.mjs"),
    contextDocHelperPath: repoInstall
      ? path.join(root, ".claude", "hooks", "socrates_context_doc_helper.mjs")
      : path.join(root, "hooks", "socrates_context_doc_helper.mjs"),
    stopHookCorePath: repoInstall
      ? path.join(root, ".claude", "hooks", "_socrates_stop_clarifying_core.mjs")
      : path.join(root, "hooks", "_socrates_stop_clarifying_core.mjs"),
    stopHookScriptPath: repoInstall
      ? path.join(root, ".claude", "hooks", "stop_socrates_clarifying.mjs")
      : path.join(root, "hooks", "stop_socrates_clarifying.mjs"),
    settingsPath: repoInstall
      ? path.join(root, ".claude", "settings.json")
      : path.join(root, "settings.json"),
  };
}

function buildTargetPathMap(baseDir, names) {
  return Object.fromEntries(
    names.map((name) => [name, path.join(baseDir, name)])
  );
}

async function loadSkillLayout(loadAsset) {
  const parsed = JSON.parse(await loadAsset(ASSETS.skillLayout));

  if (
    !isPlainObject(parsed) ||
    !Array.isArray(parsed.skillReferences) ||
    !Array.isArray(parsed.claudeAgents)
  ) {
    throw new Error("reference/skill-layout.json must define skillReferences and claudeAgents arrays");
  }

  return {
    skillReferences: [...parsed.skillReferences],
    claudeAgents: [...parsed.claudeAgents],
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

export function removeLegacySessionStartHookDocuments(
  document,
  { matcher, legacyMatchers, handler }
) {
  let next = document;
  for (const legacyMatcher of legacyMatchers) {
    if (legacyMatcher === matcher) {
      continue;
    }
    next = removeSessionStartHookDocument(next, {
      matcher: legacyMatcher,
      handler,
    });
  }
  return next;
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

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
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

async function readTextFileIfExists(target) {
  try {
    return await readFile(target, "utf8");
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
  --enable-codex-hooks

Notes:
  - Socrates installs only the canonical version 3 shared-context format.
  - Existing version 1 and version 2 SOCRATES_CONTEXT.md files are treated as legacy and must be repaired or deleted before runtime hooks trust them.
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

const isFileModule =
  process.argv[1] &&
  import.meta.url.startsWith("file:") &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
const isExplicitStdinInstall =
  process.argv[1] === "-" && process.env.SOCRATES_INSTALL_RUN === "1";

if (isExplicitStdinInstall || isFileModule) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
