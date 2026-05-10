#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_VERSION = "v0.8.0";
const DEFAULT_MODE = "install";
const REPO_SLUG = "jiyeongjun/socrates-protocol";

function buildRelativeAssetMap(baseDir, names) {
  return Object.fromEntries(
    names.map((name) => [name, `${baseDir}/${name}`])
  );
}

const ASSETS = {
  skillLayout: "reference/skill-layout.json",
  modelPolicy: "reference/model-policy.json",
  codexSkill: ".agents/skills/socrates-contract/SKILL.md",
  codexAgent: ".agents/skills/socrates-contract/agents/openai.yaml",
  codexModelPolicy: ".agents/skills/socrates-contract/model-policy.json",
  codexReferencesDir: ".agents/skills/socrates-contract/references",
  codexScriptsDir: ".agents/skills/socrates-contract/scripts",
  claudeSkill: ".claude/skills/socrates-contract/SKILL.md",
  claudeModelPolicy: ".claude/skills/socrates-contract/model-policy.json",
  claudeReferencesDir: ".claude/skills/socrates-contract/references",
  claudeScriptsDir: ".claude/skills/socrates-contract/scripts",
  claudeAgentsDir: ".claude/agents",
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
  const codexScriptAssets = buildRelativeAssetMap(
    ASSETS.codexScriptsDir,
    skillLayout.skillScripts
  );
  const claudeScriptAssets = buildRelativeAssetMap(
    ASSETS.claudeScriptsDir,
    skillLayout.skillScripts
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
    ...Object.values(codexScriptAssets),
    ASSETS.claudeSkill,
    ASSETS.claudeModelPolicy,
    ...Object.values(claudeReferenceAssets),
    ...Object.values(claudeScriptAssets),
    ...Object.values(claudeAgentAssets),
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
  };
}

function resolvePlatforms(platform) {
  return platform === "both" ? ["codex", "claude"] : [platform];
}

function createAssetLoader(options) {
  return async function loadAsset(relativePath) {
    if (options.sourceRoot) {
      try {
        return await readFile(path.join(options.sourceRoot, relativePath), "utf8");
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
  const targets = getCodexTargets(options, skillLayout);
  const referenceAssets = buildRelativeAssetMap(
    ASSETS.codexReferencesDir,
    skillLayout.skillReferences
  );
  const scriptAssets = buildRelativeAssetMap(
    ASSETS.codexScriptsDir,
    skillLayout.skillScripts
  );

  await rm(targets.skillDir, { recursive: true, force: true });
  await writeTextFile(targets.skillPath, await loadAsset(ASSETS.codexSkill));
  await writeTextFile(targets.agentPath, await loadAsset(ASSETS.codexAgent));
  await writeTextFile(
    targets.modelPolicyPath,
    await loadAsset(ASSETS.codexModelPolicy)
  );
  for (const name of skillLayout.skillReferences) {
    await writeTextFile(
      targets.referencePaths[name],
      await loadAsset(referenceAssets[name])
    );
  }
  for (const name of skillLayout.skillScripts) {
    await writeTextFile(
      targets.scriptPaths[name],
      await loadAsset(scriptAssets[name])
    );
  }

  return [
    targets.skillPath,
    targets.agentPath,
    targets.modelPolicyPath,
    ...Object.values(targets.referencePaths),
    ...Object.values(targets.scriptPaths),
  ];
}

async function installClaude(options, loadAsset, skillLayout) {
  const targets = getClaudeTargets(options, skillLayout);
  const referenceAssets = buildRelativeAssetMap(
    ASSETS.claudeReferencesDir,
    skillLayout.skillReferences
  );
  const scriptAssets = buildRelativeAssetMap(
    ASSETS.claudeScriptsDir,
    skillLayout.skillScripts
  );
  const claudeAgentAssets = buildRelativeAssetMap(
    ASSETS.claudeAgentsDir,
    skillLayout.claudeAgents
  );

  await rm(targets.skillDir, { recursive: true, force: true });
  await writeTextFile(targets.skillPath, await loadAsset(ASSETS.claudeSkill));
  await writeTextFile(
    targets.modelPolicyPath,
    await loadAsset(ASSETS.claudeModelPolicy)
  );
  for (const name of skillLayout.skillReferences) {
    await writeTextFile(
      targets.referencePaths[name],
      await loadAsset(referenceAssets[name])
    );
  }
  for (const name of skillLayout.skillScripts) {
    await writeTextFile(
      targets.scriptPaths[name],
      await loadAsset(scriptAssets[name])
    );
  }
  for (const name of skillLayout.claudeAgents) {
    await writeTextFile(
      targets.agentPaths[name],
      await loadAsset(claudeAgentAssets[name])
    );
  }

  return [
    targets.skillPath,
    targets.modelPolicyPath,
    ...Object.values(targets.referencePaths),
    ...Object.values(targets.scriptPaths),
    ...Object.values(targets.agentPaths),
  ];
}

async function uninstallCodex(options, skillLayout) {
  const targets = getCodexTargets(options, skillLayout);

  await rm(targets.skillDir, { recursive: true, force: true });

  return [
    targets.skillPath,
    targets.agentPath,
    targets.modelPolicyPath,
    ...Object.values(targets.referencePaths),
    ...Object.values(targets.scriptPaths),
  ];
}

async function uninstallClaude(options, skillLayout) {
  const targets = getClaudeTargets(options, skillLayout);

  await rm(targets.skillDir, { recursive: true, force: true });
  for (const target of Object.values(targets.agentPaths)) {
    await deleteFile(target);
  }

  return [
    targets.skillPath,
    targets.modelPolicyPath,
    ...Object.values(targets.referencePaths),
    ...Object.values(targets.scriptPaths),
    ...Object.values(targets.agentPaths),
  ];
}

function getCodexTargets(options, skillLayout) {
  const repoInstall = options.scope === "repo";
  const repoRoot = repoInstall ? path.resolve(options.targetRepo) : null;
  const skillDir = repoInstall
    ? path.join(repoRoot, ".agents", "skills", "socrates-contract")
    : path.join(options.homeDir, ".codex", "skills", "socrates-contract");

  return {
    skillDir,
    skillPath: path.join(skillDir, "SKILL.md"),
    agentPath: path.join(skillDir, "agents", "openai.yaml"),
    modelPolicyPath: path.join(skillDir, "model-policy.json"),
    referencePaths: buildTargetPathMap(
      path.join(skillDir, "references"),
      skillLayout.skillReferences
    ),
    scriptPaths: buildTargetPathMap(
      path.join(skillDir, "scripts"),
      skillLayout.skillScripts
    ),
  };
}

function getClaudeTargets(options, skillLayout) {
  const repoInstall = options.scope === "repo";
  const root = repoInstall
    ? path.resolve(options.targetRepo)
    : path.join(options.homeDir, ".claude");
  const skillDir = repoInstall
    ? path.join(root, ".claude", "skills", "socrates-contract")
    : path.join(root, "skills", "socrates-contract");
  const agentDir = repoInstall
    ? path.join(root, ".claude", "agents")
    : path.join(root, "agents");

  return {
    skillDir,
    skillPath: path.join(skillDir, "SKILL.md"),
    modelPolicyPath: path.join(skillDir, "model-policy.json"),
    referencePaths: buildTargetPathMap(
      path.join(skillDir, "references"),
      skillLayout.skillReferences
    ),
    agentPaths: buildTargetPathMap(agentDir, skillLayout.claudeAgents),
    scriptPaths: buildTargetPathMap(
      path.join(skillDir, "scripts"),
      skillLayout.skillScripts
    ),
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
    !Array.isArray(parsed.skillScripts) ||
    !Array.isArray(parsed.claudeAgents)
  ) {
    throw new Error("reference/skill-layout.json must define skillReferences, skillScripts, and claudeAgents arrays");
  }

  return {
    skillReferences: [...parsed.skillReferences],
    skillScripts: [...parsed.skillScripts],
    claudeAgents: [...parsed.claudeAgents],
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function writeTextFile(target, contents) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
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

Notes:
  - Socrates installs the contract-file workflow only.
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
