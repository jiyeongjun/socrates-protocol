#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rename,
  rmdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_VERSION = "v0.9.0";
export const INSTALL_MANIFEST_NAME = ".socrates-install.json";

const DEFAULT_MODE = "install";
const REPO_SLUG = "jiyeongjun/socrates-protocol";
const MANIFEST_SCHEMA_VERSION = 1;
const OWNERSHIP_LEDGER_SCHEMA_VERSION = 1;
const PROTOCOL = "socrates-contract";
const PROTOCOL_VERSION = DEFAULT_VERSION.slice(1);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const KNOWN_SHARED_AGENTS = Object.freeze({
  codex: new Set([
    "socrates-evaluate.toml",
    "socrates-explore.toml",
    "socrates-plan.toml",
    "socrates-verify.toml",
  ]),
  claude: new Set([
    "socrates-evaluate.md",
    "socrates-explore.md",
    "socrates-plan.md",
    "socrates-verify.md",
  ]),
});

const ASSETS = Object.freeze({
  skillLayout: "reference/skill-layout.json",
  modelPolicy: "reference/model-policy.json",
  codexSkill: ".agents/skills/socrates-contract/SKILL.md",
  codexAgent: ".agents/skills/socrates-contract/agents/openai.yaml",
  codexModelPolicy: ".agents/skills/socrates-contract/model-policy.json",
  codexReferencesDir: ".agents/skills/socrates-contract/references",
  codexScriptsDir: ".agents/skills/socrates-contract/scripts",
  codexAgentsDir: ".codex/agents",
  claudeSkill: ".claude/skills/socrates-contract/SKILL.md",
  claudeModelPolicy: ".claude/skills/socrates-contract/model-policy.json",
  claudeReferencesDir: ".claude/skills/socrates-contract/references",
  claudeScriptsDir: ".claude/skills/socrates-contract/scripts",
  claudeAgentsDir: ".claude/agents",
});

const OWNERSHIP = Object.freeze({
  skill: "skill",
  codexAgent: "shared-codex-agent",
  claudeAgent: "shared-claude-agent",
});

function buildRelativeAssetMap(baseDir, names) {
  return Object.fromEntries(names.map((name) => [name, `${baseDir}/${name}`]));
}

function sha256(contents) {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

const EMPTY_DIRECTORY_FINGERPRINT = `directory:${sha256("")}`;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateLayoutFilename(name, field) {
  if (typeof name !== "string" || name.length === 0 || name.trim() !== name) {
    throw new Error(`Invalid ${field} filename: expected a non-empty trimmed string`);
  }
  if (
    path.isAbsolute(name) ||
    name === "." ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes(":") ||
    CONTROL_CHARACTERS.test(name)
  ) {
    throw new Error(`Invalid ${field} filename: ${JSON.stringify(name)}`);
  }
  if (!/^[a-z0-9][a-z0-9._-]*\.(?:md|mjs|toml)$/u.test(name)) {
    throw new Error(`Invalid ${field} filename: ${JSON.stringify(name)}`);
  }
}

function validateFilenameArray(value, field) {
  if (!Array.isArray(value)) {
    throw new Error(`reference/skill-layout.json must define ${field} as an array`);
  }
  const exact = new Set();
  const folded = new Set();
  for (const name of value) {
    validateLayoutFilename(name, field);
    const lower = name.toLowerCase();
    if (exact.has(name) || folded.has(lower)) {
      throw new Error(`Duplicate ${field} filename: ${name}`);
    }
    exact.add(name);
    folded.add(lower);
  }
  return [...value];
}

export function validateSkillLayout(parsed) {
  if (!isPlainObject(parsed)) {
    throw new Error("reference/skill-layout.json must contain an object");
  }
  return {
    skillReferences: validateFilenameArray(
      parsed.skillReferences,
      "skillReferences"
    ),
    skillScripts: validateFilenameArray(parsed.skillScripts, "skillScripts"),
    codexAgents: validateFilenameArray(parsed.codexAgents ?? [], "codexAgents"),
    claudeAgents: validateFilenameArray(parsed.claudeAgents, "claudeAgents"),
  };
}

export function listReleaseAssetPaths(rawSkillLayout) {
  const skillLayout = validateSkillLayout(rawSkillLayout);
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
  const codexAgentAssets = buildRelativeAssetMap(
    ASSETS.codexAgentsDir,
    skillLayout.codexAgents
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
    ...Object.values(codexAgentAssets),
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
  for (const [name, value] of [
    ["target repo", options.targetRepo],
    ["source root", options.sourceRoot],
    ["version", options.version],
  ]) {
    if (value !== null && (typeof value !== "string" || CONTROL_CHARACTERS.test(value))) {
      throw new Error(`Invalid ${name}`);
    }
  }
}

export function inferLocalSourceRoot() {
  if (
    !process.argv[1] ||
    process.argv[1] === "-" ||
    !import.meta.url.startsWith("file:")
  ) {
    return null;
  }
  try {
    const scriptPath = realpathSync(fileURLToPath(import.meta.url));
    if (scriptPath !== realpathSync(process.argv[1])) return null;
    const candidate = path.resolve(path.dirname(scriptPath), "..");
    return existsSync(path.join(candidate, ASSETS.codexSkill)) ? candidate : null;
  } catch {
    return null;
  }
}

function normalizeOptions(rawOptions) {
  const resolvedHome = rawOptions.homeDir ?? homedir();
  const useEnvironmentCodexHome = rawOptions.homeDir === undefined;
  return {
    mode: rawOptions.mode ?? DEFAULT_MODE,
    platform: rawOptions.platform ?? "both",
    scope: rawOptions.scope ?? "global",
    targetRepo: rawOptions.targetRepo === undefined ? null : rawOptions.targetRepo,
    sourceRoot:
      rawOptions.sourceRoot === undefined ? inferLocalSourceRoot() : rawOptions.sourceRoot,
    version: rawOptions.version ?? DEFAULT_VERSION,
    homeDir: resolvedHome,
    codexHome:
      rawOptions.codexHome ??
      (useEnvironmentCodexHome ? process.env.CODEX_HOME : null) ??
      path.join(resolvedHome, ".codex"),
    codexHomeExplicit:
      rawOptions.codexHome !== undefined ||
      (useEnvironmentCodexHome && Boolean(process.env.CODEX_HOME)),
    installerStateRoot:
      rawOptions.installerStateRoot ??
      process.env.SOCRATES_INSTALLER_STATE_ROOT ??
      null,
  };
}

function resolvePlatforms(platform) {
  return platform === "both" ? ["codex", "claude"] : [platform];
}

function createOperations(dependencies) {
  return {
    platform: dependencies.platform ?? process.platform,
    stateRoot: dependencies.stateRoot ?? null,
    lstat: dependencies.lstat ?? lstat,
    link: dependencies.link ?? link,
    mkdir: dependencies.mkdir ?? mkdir,
    mkdtemp: dependencies.mkdtemp ?? mkdtemp,
    readFile: dependencies.readFile ?? readFile,
    readdir: dependencies.readdir ?? readdir,
    rename: dependencies.rename ?? rename,
    rmdir: dependencies.rmdir ?? rmdir,
    rm: dependencies.rm ?? rm,
    writeFile: dependencies.writeFile ?? writeFile,
    now: dependencies.now ?? (() => new Date().toISOString()),
    randomUUID: dependencies.randomUUID ?? randomUUID,
    onWarning: dependencies.onWarning ?? (() => {}),
  };
}

function assertContained(root, target, label) {
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} resolves outside its expected root`);
  }
}

async function assertSafeManagedPath(root, target, label, ops) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  assertContained(resolvedRoot, resolvedTarget, label);

  const relative = path.relative(resolvedRoot, resolvedTarget);
  const components = [resolvedRoot];
  let current = resolvedRoot;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    components.push(current);
  }

  for (const component of components) {
    try {
      const metadata = await ops.lstat(component);
      if (metadata.isSymbolicLink()) {
        throw new Error(`${label} traverses a symbolic link: ${component}`);
      }
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }
  }
}

function createAssetLoader(options, dependencies) {
  if (dependencies.loadAsset) return dependencies.loadAsset;

  if (options.sourceRoot) {
    return async (relativePath) => {
      const sourceRoot = path.resolve(options.sourceRoot);
      const candidate = path.resolve(sourceRoot, relativePath);
      assertContained(sourceRoot, candidate, `Local asset ${relativePath}`);
      try {
        const [realRoot, realCandidate] = await Promise.all([
          realpath(sourceRoot),
          realpath(candidate),
        ]);
        assertContained(realRoot, realCandidate, `Local asset ${relativePath}`);
        const metadata = await stat(realCandidate);
        if (!metadata.isFile()) throw new Error("not a regular file");
        return await readFile(realCandidate, "utf8");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Incomplete local source: ${relativePath} (${detail})`);
      }
    };
  }

  return async (relativePath) => {
    const url = `https://raw.githubusercontent.com/${REPO_SLUG}/${options.version}/${relativePath}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${relativePath} from ${url}`);
    }
    return response.text();
  };
}

async function loadSkillLayout(loadAsset) {
  let parsed;
  try {
    parsed = JSON.parse(await loadAsset(ASSETS.skillLayout));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid ${ASSETS.skillLayout}: ${error.message}`);
    }
    throw error;
  }
  return validateSkillLayout(parsed);
}

function listInstallAssetSources(platforms, layout) {
  const sources = new Set();
  if (platforms.includes("codex")) {
    sources.add(ASSETS.codexSkill);
    sources.add(ASSETS.codexAgent);
    sources.add(ASSETS.codexModelPolicy);
    for (const name of layout.skillReferences) {
      sources.add(`${ASSETS.codexReferencesDir}/${name}`);
    }
    for (const name of layout.skillScripts) {
      sources.add(`${ASSETS.codexScriptsDir}/${name}`);
    }
    for (const name of layout.codexAgents) {
      sources.add(`${ASSETS.codexAgentsDir}/${name}`);
    }
  }
  if (platforms.includes("claude")) {
    sources.add(ASSETS.claudeSkill);
    sources.add(ASSETS.claudeModelPolicy);
    for (const name of layout.skillReferences) {
      sources.add(`${ASSETS.claudeReferencesDir}/${name}`);
    }
    for (const name of layout.skillScripts) {
      sources.add(`${ASSETS.claudeScriptsDir}/${name}`);
    }
    for (const name of layout.claudeAgents) {
      sources.add(`${ASSETS.claudeAgentsDir}/${name}`);
    }
  }
  return [...sources];
}

async function loadAllAssets(platforms, layout, loadAsset) {
  const loaded = new Map();
  const failures = [];
  for (const relativePath of listInstallAssetSources(platforms, layout)) {
    try {
      const contents = await loadAsset(relativePath);
      if (typeof contents !== "string" || contents.length === 0) {
        throw new Error("asset is empty or not text");
      }
      loaded.set(relativePath, contents);
    } catch (error) {
      failures.push(
        `${relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (failures.length > 0) {
    throw new Error(`Failed to load complete installation:\n- ${failures.join("\n- ")}`);
  }
  return loaded;
}

async function pathExists(target, ops = { lstat }) {
  try {
    await ops.lstat(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}

async function targetFingerprint(target, type, ops) {
  let metadata;
  try {
    metadata = await ops.lstat(target);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return "missing";
    }
    throw error;
  }
  if (metadata.isSymbolicLink()) {
    throw new Error(`Managed target is a symbolic link: ${target}`);
  }

  if (type !== "directory") {
    if (!metadata.isFile()) {
      throw new Error(`Managed target is not a regular file: ${target}`);
    }
    return `file:${sha256(await ops.readFile(target))}`;
  }
  if (!metadata.isDirectory()) {
    throw new Error(`Managed target is not a directory: ${target}`);
  }

  const entries = [];
  async function visit(directory, relativeDirectory) {
    const names = (await ops.readdir(directory)).sort((left, right) =>
      left.localeCompare(right)
    );
    for (const name of names) {
      const child = path.join(directory, name);
      const relative = path.join(relativeDirectory, name).split(path.sep).join("/");
      const childMetadata = await ops.lstat(child);
      if (childMetadata.isSymbolicLink()) {
        throw new Error(`Managed target contains a symbolic link: ${child}`);
      }
      if (childMetadata.isDirectory()) {
        entries.push(`directory:${relative}`);
        await visit(child, relative);
      } else if (childMetadata.isFile()) {
        entries.push(`file:${relative}:${sha256(await ops.readFile(child))}`);
      } else {
        throw new Error(`Managed target contains a non-regular entry: ${child}`);
      }
    }
  }
  await visit(target, "");
  return `directory:${sha256(entries.join("\n"))}`;
}

async function assertExpectedTarget(unit, ops) {
  await assertSafeManagedPath(unit.safeRoot, unit.target, "Managed target", ops);
  const actual = await targetFingerprint(unit.target, unit.type, ops);
  if (actual !== unit.expectedFingerprint) {
    throw new Error(`Managed target changed during the transaction: ${unit.target}`);
  }
  return actual;
}

async function resolveCodexSkillDirs(options, ops) {
  if (options.scope === "repo") {
    return [
      path.join(
        path.resolve(options.targetRepo),
        ".agents",
        "skills",
        "socrates-contract"
      ),
    ];
  }
  const canonical = path.join(
    options.homeDir,
    ".agents",
    "skills",
    "socrates-contract"
  );
  const legacy = path.join(
    options.codexHome,
    "skills",
    "socrates-contract"
  );
  const [hasCanonical, hasLegacy] = await Promise.all([
    pathExists(canonical, ops),
    pathExists(legacy, ops),
  ]);
  if ((hasLegacy || options.codexHomeExplicit) && legacy !== canonical) {
    return [canonical, legacy];
  }
  return [canonical];
}

function resolveClaudeSkillDir(options) {
  return options.scope === "repo"
    ? path.join(
        path.resolve(options.targetRepo),
        ".claude",
        "skills",
        "socrates-contract"
      )
    : path.join(options.homeDir, ".claude", "skills", "socrates-contract");
}

function resolveAgentDir(options, platform) {
  const base =
    options.scope === "repo" ? path.resolve(options.targetRepo) : options.homeDir;
  return platform === "codex"
    ? options.scope === "repo"
      ? path.join(base, ".codex", "agents")
      : path.join(options.codexHome, "agents")
    : path.join(base, ".claude", "agents");
}

export function installerStatePaths(options, stateRootOverride = null) {
  const identity =
    options.scope === "repo"
      ? `repo\0${path.resolve(options.targetRepo)}`
      : `global\0${path.resolve(options.homeDir)}\0${path.resolve(options.codexHome)}`;
  const stateRoot = path.resolve(
    stateRootOverride ??
      options.installerStateRoot ??
      path.join(options.homeDir, ".socrates", "installer")
  );
  const stateAnchor =
    stateRootOverride || options.installerStateRoot
      ? path.dirname(stateRoot)
      : path.resolve(options.homeDir);
  const scopeDir = path.join(stateRoot, sha256(identity).slice(0, 32));
  const stateDir = path.join(scopeDir, "transaction");
  return {
    safeRoot: stateRoot,
    stateRoot,
    stateAnchor,
    scopeDir,
    stateDir,
    lockPath: path.join(stateDir, "install.lock"),
    journalPath: path.join(stateDir, "transaction.json"),
    journalPreviousPath: path.join(stateDir, "transaction.json.previous"),
    ledgerPath: path.join(scopeDir, "ownership.json"),
  };
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === "object" && error.code === "EPERM");
  }
}

async function acquireInstallerLock(options, ops) {
  const paths = installerStatePaths(options, ops.stateRoot);
  await assertSafeManagedPath(
    paths.stateAnchor,
    paths.stateRoot,
    "Installer state root",
    ops
  );
  await ops.mkdir(paths.stateRoot, { recursive: true, mode: 0o700 });
  const stateRootMetadata = await ops.lstat(paths.stateRoot);
  if (stateRootMetadata.isSymbolicLink() || !stateRootMetadata.isDirectory()) {
    throw new Error(`Installer state root is not a private directory: ${paths.stateRoot}`);
  }
  if (
    ops.platform !== "win32" &&
    typeof process.getuid === "function" &&
    (stateRootMetadata.uid !== process.getuid() ||
      (stateRootMetadata.mode & 0o077) !== 0)
  ) {
    throw new Error(`Installer state root must be owned by the current user with mode 0700: ${paths.stateRoot}`);
  }
  await assertSafeManagedPath(
    paths.safeRoot,
    paths.stateDir,
    "Installer state directory",
    ops
  );
  await ops.mkdir(paths.stateDir, { recursive: true, mode: 0o700 });
  await assertSafeManagedPath(
    paths.safeRoot,
    paths.lockPath,
    "Installer lock",
    ops
  );

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const token = ops.randomUUID();
    const payload = `${JSON.stringify({
      protocol: PROTOCOL,
      pid: process.pid,
      token,
      created_at: ops.now(),
    })}\n`;
    try {
      await ops.writeFile(paths.lockPath, payload, {
        encoding: "utf8",
        flag: "wx",
      });
      return { ...paths, token };
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "EEXIST") {
        throw error;
      }
    }

    const observed = await readLockPayload(paths, ops);
    if (observed?.protocol === PROTOCOL && processIsRunning(observed.pid)) {
      throw new Error(`Another Socrates installer is active: ${paths.lockPath}`);
    }

    const quarantine = `${paths.lockPath}.stale-${ops.randomUUID()}`;
    try {
      await ops.rename(paths.lockPath, quarantine);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") continue;
      throw error;
    }

    let claimed = null;
    let claimedText = null;
    try {
      claimedText = await ops.readFile(quarantine, "utf8");
      claimed = JSON.parse(claimedText);
    } catch {
      claimed = null;
    }
    if (claimed?.protocol === PROTOCOL && processIsRunning(claimed.pid)) {
      try {
        await ops.writeFile(paths.lockPath, claimedText, {
          encoding: "utf8",
          flag: "wx",
        });
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "EEXIST") {
          ops.onWarning(`Could not restore active installer lock ${quarantine}`);
        }
      }
      await cleanupPaths([{ target: quarantine, safeRoot: paths.safeRoot }], ops);
      throw new Error(`Another Socrates installer is active: ${paths.lockPath}`);
    }

    try {
      await ops.writeFile(paths.lockPath, payload, {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      await cleanupPaths([{ target: quarantine, safeRoot: paths.safeRoot }], ops);
      if (error && typeof error === "object" && error.code === "EEXIST") continue;
      throw error;
    }
    await cleanupPaths([{ target: quarantine, safeRoot: paths.safeRoot }], ops);
    return { ...paths, token };
  }
  throw new Error(`Could not acquire Socrates installer lock: ${paths.lockPath}`);
}

async function readLockPayload(paths, ops) {
  try {
    return JSON.parse(await ops.readFile(paths.lockPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    return null;
  }
}

async function assertInstallerLockOwned(paths, ops) {
  await assertSafeManagedPath(paths.safeRoot, paths.lockPath, "Installer lock", ops);
  const payload = await readLockPayload(paths, ops);
  if (
    payload?.protocol !== PROTOCOL ||
    payload?.pid !== process.pid ||
    payload?.token !== paths.token
  ) {
    throw new Error(`Socrates installer lock ownership was lost: ${paths.lockPath}`);
  }
}

async function releaseInstallerLock(paths, ops) {
  const observed = await readLockPayload(paths, ops);
  if (observed?.token !== paths.token || observed?.pid !== process.pid) {
    if (observed !== null) {
      ops.onWarning(`Installer lock was replaced; leaving it untouched: ${paths.lockPath}`);
    }
    return;
  }
  const quarantine = `${paths.lockPath}.release-${ops.randomUUID()}`;
  try {
    await ops.rename(paths.lockPath, quarantine);
  } catch (error) {
    if (!error || typeof error !== "object" || error.code !== "ENOENT") {
      ops.onWarning(`Could not release installer lock ${paths.lockPath}`);
    }
    return;
  }
  let payload = null;
  let payloadText = null;
  try {
    payloadText = await ops.readFile(quarantine, "utf8");
    payload = JSON.parse(payloadText);
  } catch {
    payload = null;
  }
  if (payload?.token === paths.token && payload?.pid === process.pid) {
    await cleanupPaths([{ target: quarantine, safeRoot: paths.safeRoot }], ops);
  } else {
    let restored = false;
    try {
      await ops.writeFile(paths.lockPath, payloadText ?? "", {
        encoding: "utf8",
        flag: "wx",
      });
      restored = true;
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "EEXIST") {
        ops.onWarning(`Could not restore replacement installer lock ${quarantine}`);
      }
    }
    if (restored) {
      await cleanupPaths([{ target: quarantine, safeRoot: paths.safeRoot }], ops);
    }
    ops.onWarning(`Installer lock was replaced; leaving it untouched: ${paths.lockPath}`);
    return;
  }
  try {
    await ops.rmdir(paths.stateDir);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)
    ) {
      ops.onWarning(
        `Could not prune installer state directory ${paths.stateDir}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

function allowedTransactionTargets(options, platforms, installerPaths = null) {
  const skillRoots = new Map();
  const agentRoots = new Map();
  const ledgerTargets = new Map();
  if (installerPaths) {
    ledgerTargets.set(installerPaths.ledgerPath, installerPaths.safeRoot);
  }
  const repoRoot =
    options.scope === "repo" ? path.resolve(options.targetRepo) : null;
  if (platforms.includes("codex")) {
    if (options.scope === "repo") {
      skillRoots.set(
        path.join(
          repoRoot,
          ".agents",
          "skills",
          "socrates-contract"
        ),
        repoRoot
      );
    } else {
      skillRoots.set(
        path.join(options.homeDir, ".agents", "skills", "socrates-contract"),
        options.homeDir
      );
      skillRoots.set(
        path.join(options.codexHome, "skills", "socrates-contract"),
        options.codexHome
      );
    }
    agentRoots.set(resolveAgentDir(options, "codex"), {
      names: KNOWN_SHARED_AGENTS.codex,
      safeRoot: repoRoot ?? options.codexHome,
    });
  }
  if (platforms.includes("claude")) {
    skillRoots.set(resolveClaudeSkillDir(options), repoRoot ?? options.homeDir);
    agentRoots.set(resolveAgentDir(options, "claude"), {
      names: KNOWN_SHARED_AGENTS.claude,
      safeRoot: repoRoot ?? options.homeDir,
    });
  }
  return { skillRoots, agentRoots, ledgerTargets };
}

function validateJournalUnit(unit, allowed) {
  if (
    !isPlainObject(unit) ||
    typeof unit.target !== "string" ||
    !path.isAbsolute(unit.target) ||
    !["directory", "file", "delete"].includes(unit.type) ||
    (unit.staged !== null && typeof unit.staged !== "string") ||
    (unit.backup !== null && typeof unit.backup !== "string") ||
    typeof unit.activated !== "boolean" ||
    (unit.rollback_complete !== undefined &&
      typeof unit.rollback_complete !== "boolean") ||
    (unit.replacement_fingerprint !== undefined &&
      unit.replacement_fingerprint !== null &&
      typeof unit.replacement_fingerprint !== "string") ||
    (unit.original_fingerprint !== undefined &&
      unit.original_fingerprint !== null &&
      typeof unit.original_fingerprint !== "string")
  ) {
    throw new Error("Invalid Socrates transaction journal unit");
  }
  if (
    (unit.staged !== null && !path.isAbsolute(unit.staged)) ||
    (unit.backup !== null && !path.isAbsolute(unit.backup))
  ) {
    throw new Error("Invalid Socrates transaction journal path");
  }
  const resolvedTarget = path.resolve(unit.target);
  let safeRoot = allowed.ledgerTargets.get(resolvedTarget) ?? null;
  let targetAllowed = safeRoot !== null;
  if (!targetAllowed) {
    safeRoot = allowed.skillRoots.get(resolvedTarget) ?? null;
    targetAllowed = safeRoot !== null;
  }
  if (!targetAllowed) {
    for (const [skillDir, root] of allowed.skillRoots) {
      const relative = path.relative(skillDir, resolvedTarget).split(path.sep).join("/");
      if (
        relative === "SKILL.md" ||
        relative === "model-policy.json" ||
        relative === "agents/openai.yaml" ||
        relative === INSTALL_MANIFEST_NAME ||
        /^references\/[a-z0-9][a-z0-9._-]*\.md$/u.test(relative) ||
        /^scripts\/[a-z0-9][a-z0-9._-]*\.mjs$/u.test(relative)
      ) {
        targetAllowed = true;
        safeRoot = root;
        break;
      }
    }
  }
  if (!targetAllowed) {
    for (const [agentDir, agent] of allowed.agentRoots) {
      if (
        path.dirname(resolvedTarget) === agentDir &&
        agent.names.has(path.basename(resolvedTarget))
      ) {
        targetAllowed = true;
        safeRoot = agent.safeRoot;
        break;
      }
    }
  }
  if (!targetAllowed) {
    throw new Error(`Untrusted Socrates journal target: ${unit.target}`);
  }
  if (unit.backup !== null) {
    if (
      path.dirname(unit.backup) !== path.dirname(resolvedTarget) ||
      !path
        .basename(unit.backup)
        .startsWith(`.${path.basename(resolvedTarget)}.backup-`)
    ) {
      throw new Error(`Untrusted Socrates journal backup: ${unit.backup}`);
    }
  }
  if (unit.staged !== null) {
    const stagedParent = path.dirname(unit.staged);
    const isSkillStage =
      allowed.skillRoots.has(resolvedTarget) &&
      stagedParent === path.dirname(resolvedTarget) &&
      path.basename(unit.staged).startsWith(".socrates-contract.stage-");
    let isAgentStage = false;
    for (const agentDir of allowed.agentRoots.keys()) {
      if (
        path.dirname(stagedParent) === path.dirname(agentDir) &&
        path.basename(stagedParent).startsWith(".socrates-agents.stage-") &&
        path.basename(unit.staged) === path.basename(resolvedTarget)
      ) {
        isAgentStage = true;
        break;
      }
    }
    const isLedgerStage =
      allowed.ledgerTargets.has(resolvedTarget) &&
      path.dirname(stagedParent) === path.dirname(resolvedTarget) &&
      path.basename(stagedParent).startsWith(".socrates-ledger.stage-") &&
      path.basename(unit.staged) === path.basename(resolvedTarget);
    if (!isSkillStage && !isAgentStage && !isLedgerStage) {
      throw new Error(`Untrusted Socrates journal stage: ${unit.staged}`);
    }
  }
  return {
    ...unit,
    target: resolvedTarget,
    rollback_complete: unit.rollback_complete ?? false,
    replacement_fingerprint: unit.replacement_fingerprint ?? null,
    original_fingerprint: unit.original_fingerprint ?? null,
    safeRoot,
  };
}

async function writeTransactionJournal(journalPath, journal, ops) {
  const temporary = `${journalPath}.tmp-${ops.randomUUID()}`;
  const previous = `${journalPath}.previous`;
  await ops.writeFile(temporary, `${JSON.stringify(journal, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  try {
    await ops.rename(temporary, journalPath);
  } catch (error) {
    if (error && typeof error === "object" && ["EEXIST", "EPERM"].includes(error.code)) {
      if (await pathExists(previous, ops)) {
        await ops.rm(temporary, { force: true });
        throw new Error(`Previous Socrates journal slot is still occupied: ${previous}`);
      }
      await ops.rename(journalPath, previous);
      try {
        await ops.rename(temporary, journalPath);
      } catch (replacementError) {
        try {
          if (!(await pathExists(journalPath, ops))) {
            await ops.rename(previous, journalPath);
          }
        } finally {
          await ops.rm(temporary, { force: true });
        }
        throw replacementError;
      }
      try {
        await ops.rm(previous, { force: true });
      } catch (cleanupError) {
        if (journal.status !== "committed") throw cleanupError;
        ops.onWarning(
          `Committed Socrates journal is durable but its previous slot remains: ${previous}`
        );
      }
    } else {
      await ops.rm(temporary, { force: true });
      throw error;
    }
  }
}

async function validateRecoveryJournal(journal, allowed, ops) {
  if (
    !isPlainObject(journal) ||
    journal.protocol !== PROTOCOL ||
    journal.schema_version !== 1 ||
    !["activating", "committed"].includes(journal.status) ||
    !Array.isArray(journal.units) ||
    !Array.isArray(journal.cleanup_roots)
  ) {
    throw new Error("Invalid Socrates installer journal");
  }
  const units = journal.units.map((unit) => validateJournalUnit(unit, allowed));
  const allowedCleanupRoots = new Map();
  for (const unit of units) {
    await assertSafeManagedPath(unit.safeRoot, unit.target, "Journal target", ops);
    if (unit.backup) {
      await assertSafeManagedPath(unit.safeRoot, unit.backup, "Journal backup", ops);
    }
    if (unit.staged) {
      await assertSafeManagedPath(unit.safeRoot, unit.staged, "Journal stage", ops);
      allowedCleanupRoots.set(
        unit.type === "directory" ? unit.staged : path.dirname(unit.staged),
        unit.safeRoot
      );
    }
  }
  const cleanupEntries = [];
  for (const cleanupRoot of journal.cleanup_roots) {
    if (typeof cleanupRoot !== "string" || !allowedCleanupRoots.has(cleanupRoot)) {
      throw new Error(`Untrusted Socrates journal cleanup root: ${cleanupRoot}`);
    }
    cleanupEntries.push({
      target: cleanupRoot,
      safeRoot: allowedCleanupRoots.get(cleanupRoot),
    });
  }
  return { units, cleanupEntries };
}

async function recoverJournalSlot(paths, allowed, ops) {
  await assertSafeManagedPath(
    paths.safeRoot,
    paths.journalPath,
    "Installer transaction journal",
    ops
  );
  await assertSafeManagedPath(
    paths.safeRoot,
    paths.journalPreviousPath,
    "Installer previous transaction journal",
    ops
  );
  const [hasCurrent, hasPrevious] = await Promise.all([
    pathExists(paths.journalPath, ops),
    pathExists(paths.journalPreviousPath, ops),
  ]);
  if (!hasCurrent && hasPrevious) {
    await renameWithRetry(paths.journalPreviousPath, paths.journalPath, ops);
  } else if (hasCurrent && hasPrevious) {
    let current;
    try {
      current = JSON.parse(await ops.readFile(paths.journalPath, "utf8"));
    } catch {
      throw new Error(
        `Cannot discard the previous Socrates journal while the current slot is malformed: ${paths.journalPath}`
      );
    }
    try {
      await validateRecoveryJournal(current, allowed, ops);
    } catch {
      throw new Error(
        `Cannot discard the previous Socrates journal while the current slot is invalid: ${paths.journalPath}`
      );
    }
    await ops.rm(paths.journalPreviousPath, { force: true });
  }
}

async function clearTransactionJournalSlots(journalPath, ops) {
  await ops.rm(`${journalPath}.previous`, { force: true });
  await ops.rm(journalPath, { force: true });
}

async function recoverInterruptedTransaction(paths, allowed, ops) {
  await assertInstallerLockOwned(paths, ops);
  await recoverJournalSlot(paths, allowed, ops);
  if (!(await pathExists(paths.journalPath, ops))) return;
  let journal;
  try {
    journal = JSON.parse(await ops.readFile(paths.journalPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot recover malformed Socrates installer journal at ${paths.journalPath}`
    );
  }
  let validated;
  try {
    validated = await validateRecoveryJournal(journal, allowed, ops);
  } catch (error) {
    throw new Error(
      `Invalid Socrates installer journal at ${paths.journalPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const { units, cleanupEntries } = validated;
  if (journal.status === "committed") {
    const cleanupFailures = await cleanupVerifiedBackups(
      units.map((unit) => ({ unit, backup: unit.backup })),
      ops
    );
    cleanupFailures.push(...(await cleanupPaths(cleanupEntries, ops)));
    if (cleanupFailures.length > 0) {
      throw new Error(
        `Cannot finish cleanup for committed Socrates transaction at ${paths.journalPath}`
      );
    }
  } else {
    const records = units.map((unit) => ({
      unit,
      backup: unit.backup,
      activated: unit.activated,
      rollbackComplete: unit.rollback_complete,
    }));
    await rollbackRecords(records, ops, async () => {
      await assertInstallerLockOwned(paths, ops);
      await writeTransactionJournal(
        paths.journalPath,
        buildJournalSnapshot("activating", records, journal.cleanup_roots),
        ops
      );
    }, () => assertInstallerLockOwned(paths, ops));
    const cleanupFailures = await cleanupPaths(cleanupEntries, ops);
    if (cleanupFailures.length > 0) {
      throw new Error(
        `Cannot finish cleanup for rolled-back Socrates transaction at ${paths.journalPath}`
      );
    }
  }
  await clearTransactionJournalSlots(paths.journalPath, ops);
}

function makeInternalAsset(source, relativeTarget, loaded) {
  const contents = loaded.get(source);
  return {
    source,
    relativeTarget,
    target: null,
    ownership: OWNERSHIP.skill,
    contents,
    sha256: sha256(contents),
  };
}

function makeExternalAsset(source, target, ownership, loaded) {
  const contents = loaded.get(source);
  return {
    source,
    relativeTarget: null,
    target,
    ownership,
    contents,
    sha256: sha256(contents),
  };
}

function buildCodexAssets(skillDir, agentDir, layout, loaded, includeAgents) {
  const internal = [
    makeInternalAsset(ASSETS.codexSkill, "SKILL.md", loaded),
    makeInternalAsset(ASSETS.codexAgent, path.join("agents", "openai.yaml"), loaded),
    makeInternalAsset(ASSETS.codexModelPolicy, "model-policy.json", loaded),
    ...layout.skillReferences.map((name) =>
      makeInternalAsset(
        `${ASSETS.codexReferencesDir}/${name}`,
        path.join("references", name),
        loaded
      )
    ),
    ...layout.skillScripts.map((name) =>
      makeInternalAsset(
        `${ASSETS.codexScriptsDir}/${name}`,
        path.join("scripts", name),
        loaded
      )
    ),
  ];
  for (const asset of internal) asset.target = path.join(skillDir, asset.relativeTarget);
  const external = includeAgents
    ? layout.codexAgents.map((name) =>
        makeExternalAsset(
          `${ASSETS.codexAgentsDir}/${name}`,
          path.join(agentDir, name),
          OWNERSHIP.codexAgent,
          loaded
        )
      )
    : [];
  return { internal, external };
}

function buildClaudeAssets(skillDir, agentDir, layout, loaded) {
  const internal = [
    makeInternalAsset(ASSETS.claudeSkill, "SKILL.md", loaded),
    makeInternalAsset(ASSETS.claudeModelPolicy, "model-policy.json", loaded),
    ...layout.skillReferences.map((name) =>
      makeInternalAsset(
        `${ASSETS.claudeReferencesDir}/${name}`,
        path.join("references", name),
        loaded
      )
    ),
    ...layout.skillScripts.map((name) =>
      makeInternalAsset(
        `${ASSETS.claudeScriptsDir}/${name}`,
        path.join("scripts", name),
        loaded
      )
    ),
  ];
  for (const asset of internal) asset.target = path.join(skillDir, asset.relativeTarget);
  const external = layout.claudeAgents.map((name) =>
    makeExternalAsset(
      `${ASSETS.claudeAgentsDir}/${name}`,
      path.join(agentDir, name),
      OWNERSHIP.claudeAgent,
      loaded
    )
  );
  return { internal, external };
}

function protocolVersion() {
  return PROTOCOL_VERSION;
}

function sourceRef(options) {
  return options.sourceRoot
    ? "local:WORKTREE"
    : `github:${options.version}`;
}

function manifestTarget(asset, descriptor) {
  if (asset.ownership === OWNERSHIP.skill) return asset.relativeTarget;
  return `agents/${path.basename(asset.target)}`;
}

function buildManifest(descriptor, options, installedAt) {
  const assets = [
    ...descriptor.internal,
    ...descriptor.external.filter((asset) => asset.installOwned !== false),
  ]
    .map((asset) => ({
      source: asset.source,
      target: manifestTarget(asset, descriptor).split(path.sep).join("/"),
      ownership: asset.ownership,
      sha256: asset.sha256,
      bytes: Buffer.byteLength(asset.contents, "utf8"),
    }))
    .sort((left, right) => left.target.localeCompare(right.target));
  return {
    protocol: PROTOCOL,
    schema_version: MANIFEST_SCHEMA_VERSION,
    protocol_version: protocolVersion(),
    platform: descriptor.platform,
    scope: options.scope,
    source_ref: sourceRef(options),
    installed_at: installedAt,
    assets,
  };
}

function trustedInternalManifestPair(asset, platform) {
  const exactPairs =
    platform === "codex"
      ? new Map([
          ["SKILL.md", ASSETS.codexSkill],
          ["agents/openai.yaml", ASSETS.codexAgent],
          ["model-policy.json", ASSETS.codexModelPolicy],
        ])
      : new Map([
          ["SKILL.md", ASSETS.claudeSkill],
          ["model-policy.json", ASSETS.claudeModelPolicy],
        ]);
  if (exactPairs.get(asset.target) === asset.source) return true;

  const parts = asset.target.split("/");
  if (parts.length !== 2) return false;
  const [directory, name] = parts;
  if (directory === "references") {
    try {
      validateLayoutFilename(name, "manifest reference");
    } catch {
      return false;
    }
    if (!name.endsWith(".md")) return false;
    const sourceDirectory =
      platform === "codex"
        ? ASSETS.codexReferencesDir
        : ASSETS.claudeReferencesDir;
    return asset.source === `${sourceDirectory}/${name}`;
  }
  if (directory === "scripts") {
    try {
      validateLayoutFilename(name, "manifest script");
    } catch {
      return false;
    }
    if (!name.endsWith(".mjs")) return false;
    const sourceDirectory =
      platform === "codex" ? ASSETS.codexScriptsDir : ASSETS.claudeScriptsDir;
    return asset.source === `${sourceDirectory}/${name}`;
  }
  return false;
}

function validateManifestAsset(asset, platform) {
  if (!isPlainObject(asset)) throw new Error("Invalid installation manifest asset");
  if (
    typeof asset.source !== "string" ||
    typeof asset.target !== "string" ||
    typeof asset.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(asset.sha256) ||
    !Number.isInteger(asset.bytes) ||
    asset.bytes < 0
  ) {
    throw new Error("Invalid installation manifest asset fields");
  }
  if (
    path.isAbsolute(asset.target) ||
    asset.target.includes("\\") ||
    asset.target.split("/").some((part) => !part || part === "." || part === "..") ||
    CONTROL_CHARACTERS.test(asset.target)
  ) {
    throw new Error(`Invalid installation manifest target: ${asset.target}`);
  }
  const allowedExternal =
    platform === "codex" ? OWNERSHIP.codexAgent : OWNERSHIP.claudeAgent;
  if (![OWNERSHIP.skill, allowedExternal].includes(asset.ownership)) {
    throw new Error(`Invalid installation manifest ownership: ${asset.ownership}`);
  }
  if (asset.ownership === OWNERSHIP.skill) {
    if (!trustedInternalManifestPair(asset, platform)) {
      throw new Error(
        `Unrecognized Socrates manifest source/target pair: ${asset.source} -> ${asset.target}`
      );
    }
  } else {
    const parts = asset.target.split("/");
    if (parts.length !== 2 || parts[0] !== "agents") {
      throw new Error(`Invalid shared-agent manifest target: ${asset.target}`);
    }
    validateLayoutFilename(parts[1], `${platform} agent`);
    if (!parts[1].startsWith("socrates-")) {
      throw new Error(`Invalid shared-agent ownership target: ${asset.target}`);
    }
    if (!KNOWN_SHARED_AGENTS[platform].has(parts[1])) {
      throw new Error(`Unknown shared-agent manifest target: ${asset.target}`);
    }
    const sourceDirectory =
      platform === "codex" ? ASSETS.codexAgentsDir : ASSETS.claudeAgentsDir;
    if (asset.source !== `${sourceDirectory}/${parts[1]}`) {
      throw new Error(
        `Unrecognized shared-agent manifest source: ${asset.source}`
      );
    }
  }
}

function validateManifest(parsed, platform = null) {
  if (
    !isPlainObject(parsed) ||
    parsed.protocol !== PROTOCOL ||
    parsed.schema_version !== MANIFEST_SCHEMA_VERSION ||
    !["codex", "claude"].includes(parsed.platform) ||
    !["repo", "global"].includes(parsed.scope) ||
    typeof parsed.protocol_version !== "string" ||
    typeof parsed.source_ref !== "string" ||
    typeof parsed.installed_at !== "string" ||
    Number.isNaN(Date.parse(parsed.installed_at)) ||
    !Array.isArray(parsed.assets)
  ) {
    throw new Error("Invalid Socrates installation manifest");
  }
  if (platform && parsed.platform !== platform) {
    throw new Error(`Installation manifest platform mismatch: ${parsed.platform}`);
  }
  const targets = new Set();
  for (const asset of parsed.assets) {
    validateManifestAsset(asset, parsed.platform);
    const folded = asset.target.toLowerCase();
    if (targets.has(folded)) {
      throw new Error(`Duplicate installation manifest target: ${asset.target}`);
    }
    targets.add(folded);
  }
  return parsed;
}

function ownershipAssetKey(asset) {
  return [
    asset.ownership,
    asset.source,
    asset.target,
    asset.sha256,
    String(asset.bytes),
  ].join("\0");
}

function validateOwnershipLedger(parsed) {
  if (
    !isPlainObject(parsed) ||
    parsed.protocol !== PROTOCOL ||
    parsed.schema_version !== OWNERSHIP_LEDGER_SCHEMA_VERSION ||
    !Array.isArray(parsed.installations)
  ) {
    throw new Error("Invalid Socrates ownership ledger");
  }
  const skillDirs = new Set();
  for (const installation of parsed.installations) {
    if (
      !isPlainObject(installation) ||
      !path.isAbsolute(installation.skill_dir) ||
      !["codex", "claude"].includes(installation.platform) ||
      !Array.isArray(installation.assets)
    ) {
      throw new Error("Invalid Socrates ownership ledger installation");
    }
    const resolvedSkillDir = path.resolve(installation.skill_dir);
    if (skillDirs.has(resolvedSkillDir)) {
      throw new Error(`Duplicate Socrates ownership ledger installation: ${resolvedSkillDir}`);
    }
    skillDirs.add(resolvedSkillDir);
    const assets = new Set();
    for (const asset of installation.assets) {
      validateManifestAsset(asset, installation.platform);
      const key = ownershipAssetKey(asset);
      if (assets.has(key)) {
        throw new Error(`Duplicate Socrates ownership ledger asset: ${asset.target}`);
      }
      assets.add(key);
    }
  }
  return parsed;
}

async function readOwnershipLedger(paths, ops) {
  await assertSafeManagedPath(
    paths.safeRoot,
    paths.ledgerPath,
    "Installer ownership ledger",
    ops
  );
  if ((await targetFingerprint(paths.ledgerPath, "file", ops)) === "missing") {
    return {
      protocol: PROTOCOL,
      schema_version: OWNERSHIP_LEDGER_SCHEMA_VERSION,
      installations: [],
    };
  }
  try {
    return validateOwnershipLedger(
      JSON.parse(await ops.readFile(paths.ledgerPath, "utf8"))
    );
  } catch (error) {
    throw new Error(
      `Invalid Socrates ownership ledger at ${paths.ledgerPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function ownershipInstallation(ledger, skillDir) {
  const resolved = path.resolve(skillDir);
  return (
    ledger.installations.find(
      (installation) => path.resolve(installation.skill_dir) === resolved
    ) ?? null
  );
}

function ownershipClaimsAsset(installation, asset) {
  if (!installation) return false;
  const expected = ownershipAssetKey(asset);
  return installation.assets.some(
    (candidate) => ownershipAssetKey(candidate) === expected
  );
}

function buildOwnershipLedger(previous, descriptors, manifests) {
  const replaced = new Set(
    descriptors.map((descriptor) => path.resolve(descriptor.skillDir))
  );
  const installations = previous.installations.filter(
    (installation) => !replaced.has(path.resolve(installation.skill_dir))
  );
  for (const descriptor of descriptors) {
    const manifest = manifests.get(descriptor);
    installations.push({
      skill_dir: path.resolve(descriptor.skillDir),
      platform: descriptor.platform,
      assets: manifest.assets,
    });
  }
  installations.sort((left, right) => left.skill_dir.localeCompare(right.skill_dir));
  return {
    protocol: PROTOCOL,
    schema_version: OWNERSHIP_LEDGER_SCHEMA_VERSION,
    installations,
  };
}

async function stageOwnershipLedger(paths, ledger, ops) {
  validateOwnershipLedger(ledger);
  await assertSafeManagedPath(
    paths.safeRoot,
    paths.scopeDir,
    "Installer ownership scope",
    ops
  );
  await assertSafeManagedPath(
    paths.safeRoot,
    paths.ledgerPath,
    "Installer ownership ledger",
    ops
  );
  const expectedFingerprint = await targetFingerprint(
    paths.ledgerPath,
    "file",
    ops
  );

  if (ledger.installations.length === 0) {
    return expectedFingerprint === "missing"
      ? { unit: null, cleanupRoot: null }
      : {
          unit: {
            target: paths.ledgerPath,
            staged: null,
            type: "file",
            safeRoot: paths.safeRoot,
            expectedFingerprint,
            replacementFingerprint: null,
          },
          cleanupRoot: null,
        };
  }

  if (expectedFingerprint !== "missing") {
    const current = validateOwnershipLedger(
      JSON.parse(await ops.readFile(paths.ledgerPath, "utf8"))
    );
    if (JSON.stringify(current) === JSON.stringify(ledger)) {
      return { unit: null, cleanupRoot: null };
    }
  }

  const stageRoot = await ops.mkdtemp(
    path.join(paths.scopeDir, ".socrates-ledger.stage-")
  );
  const staged = path.join(stageRoot, path.basename(paths.ledgerPath));
  try {
    await assertSafeManagedPath(
      paths.safeRoot,
      stageRoot,
      "Staged ownership ledger directory",
      ops
    );
    await ops.writeFile(staged, `${JSON.stringify(ledger, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    const stagedLedger = validateOwnershipLedger(
      JSON.parse(await ops.readFile(staged, "utf8"))
    );
    if (JSON.stringify(stagedLedger) !== JSON.stringify(ledger)) {
      throw new Error("Staged Socrates ownership ledger failed verification");
    }
    return {
      unit: {
        target: paths.ledgerPath,
        staged,
        type: "file",
        safeRoot: paths.safeRoot,
        expectedFingerprint,
        replacementFingerprint: await targetFingerprint(staged, "file", ops),
      },
      cleanupRoot: stageRoot,
    };
  } catch (error) {
    await cleanupPaths(
      [{ target: stageRoot, safeRoot: paths.safeRoot }],
      ops
    );
    throw error;
  }
}

async function verifyOwnershipLedgerState(paths, ledger, ops) {
  validateOwnershipLedger(ledger);
  const fingerprint = await targetFingerprint(paths.ledgerPath, "file", ops);
  if (ledger.installations.length === 0) {
    if (fingerprint !== "missing") {
      throw new Error("Live ownership ledger validation failed: expected removal");
    }
    return;
  }
  if (fingerprint === "missing") {
    throw new Error("Live ownership ledger validation failed: ledger is missing");
  }
  const installed = validateOwnershipLedger(
    JSON.parse(await ops.readFile(paths.ledgerPath, "utf8"))
  );
  if (JSON.stringify(installed) !== JSON.stringify(ledger)) {
    throw new Error("Live ownership ledger validation failed: content mismatch");
  }
}

async function readInstalledManifest(skillDir, platform, ops) {
  const manifestPath = path.join(skillDir, INSTALL_MANIFEST_NAME);
  if ((await targetFingerprint(manifestPath, "file", ops)) === "missing") {
    return null;
  }
  try {
    return validateManifest(JSON.parse(await ops.readFile(manifestPath, "utf8")), platform);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid Socrates installation manifest at ${manifestPath}`);
    }
    throw error;
  }
}

function stableManifestFields(manifest) {
  return {
    protocol: manifest.protocol,
    schema_version: manifest.schema_version,
    protocol_version: manifest.protocol_version,
    platform: manifest.platform,
    scope: manifest.scope,
    source_ref: manifest.source_ref,
    assets: manifest.assets,
  };
}

async function fileMatches(target, expectedHash, ops) {
  return (await targetFingerprint(target, "file", ops)) === `file:${expectedHash}`;
}

async function descriptorIsCurrent(descriptor, desiredManifest, ops) {
  const existing = await readInstalledManifest(
    descriptor.skillDir,
    descriptor.platform,
    ops
  );
  if (!existing) return false;
  if (
    JSON.stringify(stableManifestFields(existing)) !==
    JSON.stringify(stableManifestFields(desiredManifest))
  ) {
    return false;
  }
  for (const asset of [...descriptor.internal, ...descriptor.external]) {
    if (!(await fileMatches(asset.target, asset.sha256, ops))) return false;
  }
  return true;
}

function manifestExternalMap(manifest) {
  return new Map(
    (manifest?.assets ?? [])
      .filter((asset) => asset.ownership !== OWNERSHIP.skill)
      .map((asset) => [path.basename(asset.target), asset])
  );
}

async function preflightExternalOwnership(
  descriptor,
  previousManifest,
  ownership,
  ops
) {
  if (!descriptor.managesExternal) {
    return { removals: [], expected: new Map() };
  }
  const previousExternal = manifestExternalMap(previousManifest);
  const desiredExternal = new Set(
    descriptor.external.map((asset) => path.basename(asset.target))
  );
  const removals = [];
  const expected = new Map();

  for (const asset of descriptor.external) {
    const fingerprint = await targetFingerprint(asset.target, "file", ops);
    expected.set(asset.target, fingerprint);
    if (fingerprint === "missing") {
      asset.installOwned = true;
      continue;
    }
    const previous = previousExternal.get(path.basename(asset.target));
    if (
      previous &&
      ownershipClaimsAsset(ownership, previous) &&
      (fingerprint === `file:${previous.sha256}` ||
        fingerprint === `file:${asset.sha256}`)
    ) {
      asset.installOwned = true;
      continue;
    }
    if (fingerprint === `file:${asset.sha256}`) {
      asset.installOwned = false;
      continue;
    }
    const label = descriptor.platform === "claude" ? "Claude" : "Codex";
    throw new Error(`Refusing to overwrite unowned ${label} agent: ${asset.target}`);
  }
  for (const [name, previous] of previousExternal) {
    if (desiredExternal.has(name)) continue;
    if (!ownershipClaimsAsset(ownership, previous)) continue;
    const target = path.join(descriptor.agentDir, name);
    const fingerprint = await targetFingerprint(target, "file", ops);
    expected.set(target, fingerprint);
    if (fingerprint === "missing") continue;
    if (fingerprint !== `file:${previous.sha256}`) {
      throw new Error(`Refusing to remove modified managed agent: ${target}`);
    }
    removals.push(target);
  }
  return { removals, expected };
}

async function assertDescriptorPathsSafe(descriptor, ops) {
  await assertSafeManagedPath(
    descriptor.skillRoot,
    descriptor.skillDir,
    `${descriptor.platform} skill directory`,
    ops
  );
  await assertSafeManagedPath(
    descriptor.agentRoot,
    descriptor.agentDir,
    `${descriptor.platform} agent directory`,
    ops
  );
  for (const asset of [...descriptor.internal, ...descriptor.external]) {
    await assertSafeManagedPath(
      asset.ownership === OWNERSHIP.skill
        ? descriptor.skillRoot
        : descriptor.agentRoot,
      asset.target,
      `${descriptor.platform} managed asset`,
      ops
    );
  }
}

async function createDescriptors(options, platforms, layout, loaded, ops) {
  const descriptors = [];
  if (platforms.includes("codex")) {
    const skillDirs = await resolveCodexSkillDirs(options, ops);
    const agentDir = resolveAgentDir(options, "codex");
    skillDirs.forEach((skillDir, index) => {
      const assets = buildCodexAssets(
        skillDir,
        agentDir,
        layout,
        loaded,
        index === 0
      );
      descriptors.push({
        platform: "codex",
        managesExternal: index === 0,
        skillDir,
        skillRoot:
          options.scope === "repo" || index === 0
            ? options.scope === "repo"
              ? path.resolve(options.targetRepo)
              : options.homeDir
            : options.codexHome,
        agentDir,
        agentRoot:
          options.scope === "repo" ? path.resolve(options.targetRepo) : options.codexHome,
        ...assets,
      });
    });
  }
  if (platforms.includes("claude")) {
    const skillDir = resolveClaudeSkillDir(options);
    const agentDir = resolveAgentDir(options, "claude");
    descriptors.push({
      platform: "claude",
      managesExternal: true,
      skillDir,
      skillRoot:
        options.scope === "repo" ? path.resolve(options.targetRepo) : options.homeDir,
      agentDir,
      agentRoot:
        options.scope === "repo" ? path.resolve(options.targetRepo) : options.homeDir,
      ...buildClaudeAssets(skillDir, agentDir, layout, loaded),
    });
  }
  return descriptors;
}

async function writeStagedFile(target, contents, ops) {
  await ops.mkdir(path.dirname(target), { recursive: true });
  await ops.writeFile(target, contents, { encoding: "utf8", flag: "wx" });
}

async function cleanupPaths(paths, ops) {
  const failures = [];
  for (const entry of paths) {
    const target = typeof entry === "string" ? entry : entry.target;
    try {
      if (typeof entry !== "string") {
        await assertSafeManagedPath(
          entry.safeRoot,
          target,
          "Cleanup target",
          ops
        );
      }
      await ops.rm(target, { recursive: true, force: true });
    } catch (error) {
      failures.push(
        `${target}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (failures.length > 0) {
    ops.onWarning(`Socrates cleanup residue remains:\n- ${failures.join("\n- ")}`);
  }
  return failures;
}

async function stageDescriptor(descriptor, manifest, removals, expectedState, ops) {
  const ownedExternal = descriptor.external.filter(
    (asset) => asset.installOwned !== false
  );
  await assertDescriptorPathsSafe(descriptor, ops);
  await ops.mkdir(path.dirname(descriptor.skillDir), { recursive: true });
  await assertDescriptorPathsSafe(descriptor, ops);
  const skillStage = await ops.mkdtemp(
    path.join(path.dirname(descriptor.skillDir), ".socrates-contract.stage-")
  );
  const cleanupRoots = [skillStage];
  const units = [];

  try {
    await assertSafeManagedPath(
      descriptor.skillRoot,
      skillStage,
      "Staged skill directory",
      ops
    );
    for (const asset of descriptor.internal) {
      await writeStagedFile(
        path.join(skillStage, asset.relativeTarget),
        asset.contents,
        ops
      );
    }
    await writeStagedFile(
      path.join(skillStage, INSTALL_MANIFEST_NAME),
      `${JSON.stringify(manifest, null, 2)}\n`,
      ops
    );
    for (const asset of descriptor.internal) {
      const stagedTarget = path.join(skillStage, asset.relativeTarget);
      if (!(await fileMatches(stagedTarget, asset.sha256, ops))) {
        throw new Error(`Staged asset validation failed: ${asset.source}`);
      }
    }
    validateManifest(
      JSON.parse(
        await ops.readFile(path.join(skillStage, INSTALL_MANIFEST_NAME), "utf8")
      ),
      descriptor.platform
    );
    units.push({
      target: descriptor.skillDir,
      staged: skillStage,
      type: "directory",
      safeRoot: descriptor.skillRoot,
      expectedFingerprint: expectedState.skill,
      replacementFingerprint: await targetFingerprint(
        skillStage,
        "directory",
        ops
      ),
    });

    if (ownedExternal.length > 0) {
      await assertSafeManagedPath(
        descriptor.agentRoot,
        descriptor.agentDir,
        "Agent directory",
        ops
      );
      await ops.mkdir(descriptor.agentDir, { recursive: true });
      await assertSafeManagedPath(
        descriptor.agentRoot,
        descriptor.agentDir,
        "Agent directory",
        ops
      );
      const agentStage = await ops.mkdtemp(
        path.join(path.dirname(descriptor.agentDir), ".socrates-agents.stage-")
      );
      cleanupRoots.push(agentStage);
      await assertSafeManagedPath(
        descriptor.agentRoot,
        agentStage,
        "Staged agent directory",
        ops
      );
      for (const asset of ownedExternal) {
        const staged = path.join(agentStage, path.basename(asset.target));
        await writeStagedFile(staged, asset.contents, ops);
        if (!(await fileMatches(staged, asset.sha256, ops))) {
          throw new Error(`Staged agent validation failed: ${asset.source}`);
        }
        units.push({
          target: asset.target,
          staged,
          type: "file",
          safeRoot: descriptor.agentRoot,
          expectedFingerprint: expectedState.targets.get(asset.target),
          replacementFingerprint: await targetFingerprint(staged, "file", ops),
        });
      }
    }
    for (const target of removals) {
      units.push({
        target,
        staged: null,
        type: "delete",
        safeRoot: descriptor.agentRoot,
        expectedFingerprint: expectedState.targets.get(target),
        replacementFingerprint: null,
      });
    }
    return { units, cleanupRoots };
  } catch (error) {
    await cleanupPaths(
      cleanupRoots
        .reverse()
        .map((target) => ({
          target,
          safeRoot:
            target === skillStage ? descriptor.skillRoot : descriptor.agentRoot,
        })),
      ops
    );
    throw error;
  }
}

async function renameWithRetry(source, target, ops) {
  const transientCodes = new Set(["EACCES", "EBUSY", "EPERM"]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await ops.rename(source, target);
      return;
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !transientCodes.has(error.code) ||
        attempt === 2
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

function buildJournalSnapshot(status, records, cleanupRoots) {
  return {
    protocol: PROTOCOL,
    schema_version: 1,
    status,
    units: records.map((record) => ({
      target: record.unit.target,
      staged: record.unit.staged,
      type: record.unit.type,
      backup: record.backup,
      activated: record.activated,
      rollback_complete: record.rollbackComplete,
      replacement_fingerprint:
        record.unit.replacementFingerprint ??
        record.unit.replacement_fingerprint ??
        null,
      original_fingerprint:
        record.unit.expectedFingerprint ??
        record.unit.original_fingerprint ??
        null,
    })),
    cleanup_roots: cleanupRoots,
  };
}

async function sameFileIdentity(left, right, ops) {
  const [leftMetadata, rightMetadata] = await Promise.all([
    ops.lstat(left),
    ops.lstat(right),
  ]);
  return (
    leftMetadata.isFile() &&
    rightMetadata.isFile() &&
    leftMetadata.dev === rightMetadata.dev &&
    leftMetadata.ino === rightMetadata.ino
  );
}

async function rollbackTargetIsOwned(record, actual, stagedStillExists, ops) {
  const { unit } = record;
  const replacementFingerprint =
    unit.replacementFingerprint ?? unit.replacement_fingerprint ?? null;
  if (!stagedStillExists) {
    return Boolean(replacementFingerprint && actual === replacementFingerprint);
  }
  if (unit.type === "directory") {
    return actual === EMPTY_DIRECTORY_FINGERPRINT;
  }
  return sameFileIdentity(unit.target, unit.staged, ops);
}

async function rollbackRecords(
  records,
  ops,
  persist = async () => {},
  assertOwnership = async () => {}
) {
  for (const record of [...records].reverse()) {
    if (record.rollbackComplete) continue;
    await assertOwnership();
    const { unit } = record;
    await assertSafeManagedPath(unit.safeRoot, unit.target, "Rollback target", ops);
    if (record.backup) {
      await assertSafeManagedPath(
        unit.safeRoot,
        record.backup,
        "Rollback backup",
        ops
      );
    }
    if (unit.staged) {
      await assertSafeManagedPath(unit.safeRoot, unit.staged, "Rollback stage", ops);
    }

    const hasTarget = await pathExists(unit.target, ops);
    const hasBackup = record.backup
      ? await pathExists(record.backup, ops)
      : false;
    if (record.backup) {
      if (hasBackup) {
        if (hasTarget) {
          if (!record.activated) {
            throw new Error(
              `Ambiguous rollback state has both target and backup: ${unit.target}`
            );
          }
          const stagedStillExists = unit.staged
            ? await pathExists(unit.staged, ops)
            : false;
          const actual = await targetFingerprint(unit.target, unit.type, ops);
          if (
            !(await rollbackTargetIsOwned(
              record,
              actual,
              stagedStillExists,
              ops
            ))
          ) {
            throw new Error(
              `Refusing to remove a changed rollback target: ${unit.target}`
            );
          }
          await assertSafeManagedPath(
            unit.safeRoot,
            unit.target,
            "Rollback target",
            ops
          );
          await ops.rm(unit.target, { recursive: true, force: true });
        }
        await renameWithRetry(record.backup, unit.target, ops);
      } else if (!hasTarget) {
        throw new Error(`Rollback lost both target and backup: ${unit.target}`);
      }
    } else if (record.activated && hasTarget) {
      const stagedStillExists = unit.staged
        ? await pathExists(unit.staged, ops)
        : false;
      const actual = await targetFingerprint(unit.target, unit.type, ops);
      if (await rollbackTargetIsOwned(record, actual, stagedStillExists, ops)) {
        await assertSafeManagedPath(
          unit.safeRoot,
          unit.target,
          "Rollback target",
          ops
        );
        await ops.rm(unit.target, { recursive: true, force: true });
      } else if (!stagedStillExists || record.backup) {
        throw new Error(
          `Refusing to remove an unverifiable rollback target: ${unit.target}`
        );
      }
    }

    record.rollbackComplete = true;
    await persist();
  }
}

async function publishStagedNoReplace(unit, ops) {
  await assertSafeManagedPath(unit.safeRoot, unit.target, "Transaction target", ops);
  await assertSafeManagedPath(unit.safeRoot, unit.staged, "Transaction stage", ops);
  if ((await targetFingerprint(unit.target, unit.type, ops)) !== "missing") {
    throw new Error(`Transaction target appeared during activation: ${unit.target}`);
  }

  if (unit.type === "file") {
    try {
      await ops.link(unit.staged, unit.target);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        throw new Error(`Transaction target appeared during activation: ${unit.target}`);
      }
      throw error;
    }
  } else if (ops.platform === "win32") {
    try {
      // Windows rename does not replace an existing directory, so publishing the
      // staged tree directly provides the no-replace primitive that the POSIX
      // empty-directory reservation emulates below.
      await renameWithRetry(unit.staged, unit.target, ops);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        ["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code) &&
        (await targetFingerprint(unit.target, unit.type, ops)) !== "missing"
      ) {
        throw new Error(`Transaction target appeared during activation: ${unit.target}`);
      }
      throw error;
    }
  } else {
    try {
      await ops.mkdir(unit.target);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "EEXIST") {
        throw new Error(`Transaction target appeared during activation: ${unit.target}`);
      }
      throw error;
    }
    if (
      (await targetFingerprint(unit.target, "directory", ops)) !==
      EMPTY_DIRECTORY_FINGERPRINT
    ) {
      throw new Error(`Transaction directory reservation changed: ${unit.target}`);
    }
    await renameWithRetry(unit.staged, unit.target, ops);
  }

  const published = await targetFingerprint(unit.target, unit.type, ops);
  if (published !== unit.replacementFingerprint) {
    throw new Error(`Published transaction target failed validation: ${unit.target}`);
  }
  if (unit.type === "file") {
    await ops.rm(unit.staged, { force: false });
  }
}

async function cleanupVerifiedBackups(records, ops) {
  const failures = [];
  for (const record of records) {
    if (!record.backup) continue;
    try {
      await assertSafeManagedPath(
        record.unit.safeRoot,
        record.backup,
        "Committed transaction backup",
        ops
      );
      if (!(await pathExists(record.backup, ops))) continue;
      const expected =
        record.unit.expectedFingerprint ??
        record.unit.original_fingerprint ??
        null;
      if (!expected) {
        throw new Error("missing original fingerprint");
      }
      const actual = await targetFingerprint(
        record.backup,
        record.unit.type,
        ops
      );
      if (actual !== expected) {
        throw new Error("backup changed after activation");
      }
      await ops.rm(record.backup, { recursive: true, force: true });
    } catch (error) {
      failures.push(
        `${record.backup}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  if (failures.length > 0) {
    ops.onWarning(`Socrates backup cleanup residue remains:\n- ${failures.join("\n- ")}`);
  }
  return failures;
}

async function activateTransaction(
  units,
  verifyLive,
  ops,
  transaction = null
) {
  const records = units.map((unit) => ({
    unit,
    backup: null,
    activated: false,
    rollbackComplete: false,
  }));
  let committed = false;
  const cleanupRoots = transaction?.cleanupRoots ?? [];
  const cleanupEntries = cleanupRoots.map((target) => {
    const owner = records.find((record) => {
      if (!record.unit.staged) return false;
      return (
        (record.unit.type === "directory"
          ? record.unit.staged
          : path.dirname(record.unit.staged)) === target
      );
    });
    if (!owner) throw new Error(`Unowned transaction cleanup root: ${target}`);
    return { target, safeRoot: owner.unit.safeRoot };
  });
  const assertOwnership = async () => {
    if (transaction?.lock) await assertInstallerLockOwned(transaction.lock, ops);
  };
  const persistJournal = async (status) => {
    if (!transaction) return;
    await assertOwnership();
    if (transaction.lock) {
      await assertSafeManagedPath(
        transaction.lock.safeRoot,
        transaction.journalPath,
        "Transaction journal",
        ops
      );
      await assertSafeManagedPath(
        transaction.lock.safeRoot,
        `${transaction.journalPath}.previous`,
        "Previous transaction journal",
        ops
      );
    }
    await writeTransactionJournal(
      transaction.journalPath,
      buildJournalSnapshot(status, records, cleanupRoots),
      ops
    );
  };
  try {
    await persistJournal("activating");
    for (const record of records) {
      const { unit } = record;
      await assertOwnership();
      const expected = await assertExpectedTarget(unit, ops);
      if (expected !== "missing") {
        record.backup = path.join(
          path.dirname(unit.target),
          `.${path.basename(unit.target)}.backup-${ops.randomUUID()}`
        );
        await assertSafeManagedPath(
          unit.safeRoot,
          record.backup,
          "Transaction backup",
          ops
        );
        await persistJournal("activating");
        await renameWithRetry(unit.target, record.backup, ops);
        const captured = await targetFingerprint(record.backup, unit.type, ops);
        if (captured !== unit.expectedFingerprint) {
          throw new Error(`Managed target changed during backup: ${unit.target}`);
        }
      }
      record.activated = true;
      await persistJournal("activating");
      if (unit.staged) {
        await assertOwnership();
        await assertSafeManagedPath(
          unit.safeRoot,
          unit.staged,
          "Transaction stage",
          ops
        );
        await publishStagedNoReplace(unit, ops);
      }
    }
    await verifyLive();
    await persistJournal("committed");
    committed = true;
  } catch (error) {
    try {
      await rollbackRecords(
        records,
        ops,
        () => persistJournal("activating"),
        assertOwnership
      );
    } catch (rollbackError) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}; rollback failure: ${
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        }`
      );
    }
    if (transaction) {
      await clearTransactionJournalSlots(transaction.journalPath, ops);
    }
    throw error;
  } finally {
    if (committed) {
      let previousSlotCleared = true;
      if (transaction) {
        try {
          await ops.rm(`${transaction.journalPath}.previous`, { force: true });
        } catch (error) {
          previousSlotCleared = false;
          ops.onWarning(
            `Committed Socrates transaction cleanup is deferred because its previous journal slot remains: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      if (previousSlotCleared) {
        const cleanupFailures = await cleanupVerifiedBackups(records, ops);
        cleanupFailures.push(...(await cleanupPaths(cleanupEntries, ops)));
        if (transaction && cleanupFailures.length === 0) {
          await ops.rm(transaction.journalPath, { force: true });
        }
      }
    }
  }
}

async function verifyDescriptors(descriptors, manifests, ops) {
  for (const descriptor of descriptors) {
    const installed = await readInstalledManifest(
      descriptor.skillDir,
      descriptor.platform,
      ops
    );
    if (
      !installed ||
      JSON.stringify(stableManifestFields(installed)) !==
        JSON.stringify(stableManifestFields(manifests.get(descriptor)))
    ) {
      throw new Error(`Live manifest validation failed: ${descriptor.skillDir}`);
    }
    for (const asset of [...descriptor.internal, ...descriptor.external]) {
      if (!(await fileMatches(asset.target, asset.sha256, ops))) {
        throw new Error(`Live asset validation failed: ${asset.target}`);
      }
    }
  }
}

export async function installSocrates(rawOptions = {}, dependencies = {}) {
  const options = normalizeOptions(rawOptions);
  validateArgs(options);
  const ops = createOperations(dependencies);
  const loadAsset = createAssetLoader(options, dependencies);
  const layout = await loadSkillLayout(loadAsset);
  const platforms = resolvePlatforms(options.platform);
  const loaded = await loadAllAssets(platforms, layout, loadAsset);
  const lock = await acquireInstallerLock(options, ops);
  try {
    await recoverInterruptedTransaction(
      lock,
      allowedTransactionTargets(options, ["codex", "claude"], lock),
      ops
    );
    const ownershipLedger = await readOwnershipLedger(lock, ops);
    const descriptors = await createDescriptors(
      options,
      platforms,
      layout,
      loaded,
      ops
    );
    for (const descriptor of descriptors) {
      await assertDescriptorPathsSafe(descriptor, ops);
    }
    const installedAt = ops.now();
    const manifests = new Map();
    const changedDescriptors = [];
    const removalsByDescriptor = new Map();
    const expectedByDescriptor = new Map();

    for (const descriptor of descriptors) {
      await assertInstallerLockOwned(lock, ops);
      const previousManifest = await readInstalledManifest(
        descriptor.skillDir,
        descriptor.platform,
        ops
      );
      const ownership = await preflightExternalOwnership(
        descriptor,
        previousManifest,
        ownershipInstallation(ownershipLedger, descriptor.skillDir),
        ops
      );
      const desiredManifest = buildManifest(descriptor, options, installedAt);
      manifests.set(descriptor, desiredManifest);
      if (await descriptorIsCurrent(descriptor, desiredManifest, ops)) continue;
      removalsByDescriptor.set(descriptor, ownership.removals);
      expectedByDescriptor.set(descriptor, {
        skill: await targetFingerprint(descriptor.skillDir, "directory", ops),
        targets: ownership.expected,
      });
      changedDescriptors.push(descriptor);
    }
    const desiredOwnershipLedger = buildOwnershipLedger(
      ownershipLedger,
      descriptors,
      manifests
    );

    const units = [];
    const cleanupRoots = [];
    const cleanupEntries = [];
    try {
      for (const descriptor of changedDescriptors) {
        await assertInstallerLockOwned(lock, ops);
        const staged = await stageDescriptor(
          descriptor,
          manifests.get(descriptor),
          removalsByDescriptor.get(descriptor),
          expectedByDescriptor.get(descriptor),
          ops
        );
        units.push(...staged.units);
        cleanupRoots.push(...staged.cleanupRoots);
        cleanupEntries.push(
          ...staged.cleanupRoots.map((target) => ({
            target,
            safeRoot: target.includes(".socrates-contract.stage-")
              ? descriptor.skillRoot
              : descriptor.agentRoot,
          }))
        );
      }
      await assertInstallerLockOwned(lock, ops);
      const stagedLedger = await stageOwnershipLedger(
        lock,
        desiredOwnershipLedger,
        ops
      );
      if (stagedLedger.unit) units.push(stagedLedger.unit);
      if (stagedLedger.cleanupRoot) {
        cleanupRoots.push(stagedLedger.cleanupRoot);
        cleanupEntries.push({
          target: stagedLedger.cleanupRoot,
          safeRoot: lock.safeRoot,
        });
      }
      if (units.length === 0) {
        await verifyOwnershipLedgerState(lock, desiredOwnershipLedger, ops);
        return descriptors.flatMap((descriptor) =>
          [...descriptor.internal, ...descriptor.external].map(
            (asset) => asset.target
          )
        );
      }
      await assertInstallerLockOwned(lock, ops);
      await activateTransaction(
        units,
        async () => {
          await verifyDescriptors(changedDescriptors, manifests, ops);
          await verifyOwnershipLedgerState(lock, desiredOwnershipLedger, ops);
        },
        ops,
        { journalPath: lock.journalPath, cleanupRoots, lock }
      );
    } finally {
      if (!(await pathExists(lock.journalPath, ops))) {
        await cleanupPaths([...cleanupEntries].reverse(), ops);
      }
    }

    return descriptors.flatMap((descriptor) =>
      [...descriptor.internal, ...descriptor.external].map((asset) => asset.target)
    );
  } finally {
    await releaseInstallerLock(lock, ops);
  }
}

function resolveManifestAssetTarget(asset, skillDir, agentDir) {
  if (asset.ownership === OWNERSHIP.skill) {
    const target = path.resolve(skillDir, asset.target);
    assertContained(skillDir, target, `Manifest asset ${asset.target}`);
    return target;
  }
  const name = path.basename(asset.target);
  validateLayoutFilename(name, "manifest agent");
  const target = path.join(agentDir, name);
  assertContained(agentDir, target, `Manifest agent ${asset.target}`);
  return target;
}

async function collectUninstallUnits(
  skillDir,
  platform,
  agentDir,
  skillRoot,
  agentRoot,
  trustedAssets,
  ownership,
  managesExternal,
  ops
) {
  await assertSafeManagedPath(skillRoot, skillDir, "Uninstall skill directory", ops);
  await assertSafeManagedPath(agentRoot, agentDir, "Uninstall agent directory", ops);
  if (!(await pathExists(skillDir, ops))) return { units: [], prune: [] };
  const manifest = await readInstalledManifest(skillDir, platform, ops);
  if (!manifest) {
    throw new Error(
      `Refusing to uninstall unverifiable legacy installation at ${skillDir}; reinstall once to create an ownership manifest`
    );
  }

  if (!ownership) {
    throw new Error(
      `Refusing to uninstall without a trusted Socrates ownership ledger for ${skillDir}; reinstall once to establish ownership`
    );
  }
  const included = (asset) =>
    asset.ownership === OWNERSHIP.skill || managesExternal;
  const manifestOwnership = manifest.assets
    .filter(included)
    .map(ownershipAssetKey)
    .sort();
  const ledgerOwnership = ownership.assets
    .filter(included)
    .map(ownershipAssetKey)
    .sort();
  if (JSON.stringify(manifestOwnership) !== JSON.stringify(ledgerOwnership)) {
    throw new Error(
      `Installation manifest does not match the trusted Socrates ownership ledger: ${skillDir}`
    );
  }

  const units = [];
  const prune = new Map([[skillDir, skillRoot]]);
  for (const asset of manifest.assets) {
    if (asset.ownership !== OWNERSHIP.skill && !managesExternal) continue;
    const target = resolveManifestAssetTarget(asset, skillDir, agentDir);
    const safeRoot =
      asset.ownership === OWNERSHIP.skill ? skillRoot : agentRoot;
    await assertSafeManagedPath(safeRoot, target, "Uninstall managed asset", ops);
    const fingerprint = await targetFingerprint(target, "file", ops);
    if (fingerprint !== `file:${asset.sha256}`) {
      throw new Error(`Refusing to uninstall modified managed asset: ${target}`);
    }
    if (trustedAssets.get(asset.source) !== asset.sha256) {
      if (asset.ownership !== OWNERSHIP.skill) {
        throw new Error(
          `Refusing to uninstall an unauthenticated shared agent: ${target}`
        );
      }
      throw new Error(
        `Refusing to uninstall an unauthenticated managed asset: ${target}`
      );
    }
    units.push({
      target,
      staged: null,
      type: "file",
      safeRoot,
      expectedFingerprint: fingerprint,
      replacementFingerprint: null,
    });
    if (asset.ownership === OWNERSHIP.skill) {
      let current = path.dirname(target);
      while (current !== skillDir && current.startsWith(`${skillDir}${path.sep}`)) {
        prune.set(current, skillRoot);
        current = path.dirname(current);
      }
    }
  }
  const manifestPath = path.join(skillDir, INSTALL_MANIFEST_NAME);
  await assertSafeManagedPath(skillRoot, manifestPath, "Uninstall manifest", ops);
  units.push({
    target: manifestPath,
    staged: null,
    type: "file",
    safeRoot: skillRoot,
    expectedFingerprint: await targetFingerprint(manifestPath, "file", ops),
    replacementFingerprint: null,
  });
  return {
    units,
    prune: [...prune]
      .map(([target, safeRoot]) => ({ target, safeRoot }))
      .sort((left, right) => right.target.length - left.target.length),
  };
}

async function pruneEmptyDirectories(paths, ops) {
  for (const entry of paths) {
    const target = entry.target;
    try {
      await assertSafeManagedPath(
        entry.safeRoot,
        target,
        "Prune directory",
        ops
      );
      await ops.rmdir(target);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)
      ) {
        throw error;
      }
    }
  }
}

export async function uninstallSocrates(rawOptions = {}, dependencies = {}) {
  const options = normalizeOptions(rawOptions);
  validateArgs(options);
  const ops = createOperations(dependencies);
  const platforms = resolvePlatforms(options.platform);
  const loadAsset = createAssetLoader(options, dependencies);
  const layout = await loadSkillLayout(loadAsset);
  const loaded = await loadAllAssets(platforms, layout, loadAsset);
  const trustedAssets = new Map(
    [...loaded].map(([source, contents]) => [source, sha256(contents)])
  );
  const lock = await acquireInstallerLock(options, ops);
  try {
    await recoverInterruptedTransaction(
      lock,
      allowedTransactionTargets(options, ["codex", "claude"], lock),
      ops
    );
    const ownershipLedger = await readOwnershipLedger(lock, ops);
    const targets = [];
    if (platforms.includes("codex")) {
      const canonical =
        options.scope === "repo"
          ? path.join(
              path.resolve(options.targetRepo),
              ".agents",
              "skills",
              "socrates-contract"
            )
          : path.join(
              options.homeDir,
              ".agents",
              "skills",
              "socrates-contract"
            );
      const legacy =
        options.scope === "global"
          ? path.join(options.codexHome, "skills", "socrates-contract")
          : null;
      targets.push({
        platform: "codex",
        managesExternal: true,
        skillDir: canonical,
        skillRoot:
          options.scope === "repo" ? path.resolve(options.targetRepo) : options.homeDir,
        agentDir: resolveAgentDir(options, "codex"),
        agentRoot:
          options.scope === "repo" ? path.resolve(options.targetRepo) : options.codexHome,
      });
      if (legacy && legacy !== canonical) {
        targets.push({
          platform: "codex",
          managesExternal: false,
          skillDir: legacy,
          skillRoot: options.codexHome,
          agentDir: resolveAgentDir(options, "codex"),
          agentRoot: options.codexHome,
        });
      }
    }
    if (platforms.includes("claude")) {
      targets.push({
        platform: "claude",
        managesExternal: true,
        skillDir: resolveClaudeSkillDir(options),
        skillRoot:
          options.scope === "repo" ? path.resolve(options.targetRepo) : options.homeDir,
        agentDir: resolveAgentDir(options, "claude"),
        agentRoot:
          options.scope === "repo" ? path.resolve(options.targetRepo) : options.homeDir,
      });
    }

    const assetUnits = [];
    const prune = [];
    for (const target of targets) {
      await assertInstallerLockOwned(lock, ops);
      const collected = await collectUninstallUnits(
        target.skillDir,
        target.platform,
        target.agentDir,
        target.skillRoot,
        target.agentRoot,
        trustedAssets,
        ownershipInstallation(ownershipLedger, target.skillDir),
        target.managesExternal,
        ops
      );
      assetUnits.push(...collected.units);
      prune.push(...collected.prune);
    }

    const uniqueTargets = new Set();
    for (const unit of assetUnits) {
      const folded = unit.target.toLowerCase();
      if (uniqueTargets.has(folded)) {
        throw new Error(`Duplicate uninstall target: ${unit.target}`);
      }
      uniqueTargets.add(folded);
    }
    const removedSkillDirs = new Set(
      targets.map((target) => path.resolve(target.skillDir))
    );
    const desiredOwnershipLedger = {
      ...ownershipLedger,
      installations: ownershipLedger.installations.filter(
        (installation) =>
          !removedSkillDirs.has(path.resolve(installation.skill_dir))
      ),
    };
    const stagedLedger = await stageOwnershipLedger(
      lock,
      desiredOwnershipLedger,
      ops
    );
    const units = [...assetUnits];
    const cleanupRoots = [];
    const cleanupEntries = [];
    if (stagedLedger.unit) units.push(stagedLedger.unit);
    if (stagedLedger.cleanupRoot) {
      cleanupRoots.push(stagedLedger.cleanupRoot);
      cleanupEntries.push({
        target: stagedLedger.cleanupRoot,
        safeRoot: lock.safeRoot,
      });
    }
    await assertInstallerLockOwned(lock, ops);
    try {
      await activateTransaction(
        units,
        async () => {
          for (const unit of assetUnits) {
            if (await pathExists(unit.target, ops)) {
              throw new Error(`Uninstall verification failed: ${unit.target}`);
            }
          }
          await verifyOwnershipLedgerState(lock, desiredOwnershipLedger, ops);
        },
        ops,
        { journalPath: lock.journalPath, cleanupRoots, lock }
      );
    } finally {
      if (!(await pathExists(lock.journalPath, ops))) {
        await cleanupPaths([...cleanupEntries].reverse(), ops);
      }
    }
    const uniquePrune = new Map(prune.map((entry) => [entry.target, entry]));
    await pruneEmptyDirectories([...uniquePrune.values()], ops);
    return assetUnits.map((unit) => unit.target);
  } finally {
    await releaseInstallerLock(lock, ops);
  }
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
  --source-root /absolute/path/to/complete/local/repo
  --version git-ref-or-tag

Notes:
  - Local sources are strict and never mix with remote assets.
  - Current user-scope Codex skills install under $HOME/.agents/skills.
  - Detected legacy $HOME/.codex/skills installations are updated in place.
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

function isCurrentFileModule() {
  if (!process.argv[1] || process.argv[1] === "-" || !import.meta.url.startsWith("file:")) {
    return false;
  }
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
}

const isFileModule = isCurrentFileModule();
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
