#!/usr/bin/env node

import { constants, realpathSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rmdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SOCRATES_PROTOCOL = "socrates-contract";
export const SOCRATES_SCHEMA_VERSION = "1.0";
export const CONTRACT_STATUSES = Object.freeze([
  "proposed",
  "aligned",
  "executing",
  "blocked",
  "verifying",
  "done",
  "cancelled",
]);

export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  proposed: Object.freeze(["aligned", "blocked", "cancelled"]),
  aligned: Object.freeze(["executing", "blocked", "cancelled"]),
  executing: Object.freeze(["verifying", "blocked"]),
  blocked: Object.freeze(["aligned", "executing", "cancelled"]),
  verifying: Object.freeze(["executing", "blocked", "done"]),
  done: Object.freeze([]),
  cancelled: Object.freeze([]),
});

export const ALLOWED_ACTIVE_SUBCONTRACT_STATUSES = Object.freeze({
  proposed: Object.freeze(["proposed"]),
  aligned: Object.freeze(["aligned"]),
  executing: Object.freeze(["aligned", "executing", "verifying", "blocked"]),
  blocked: Object.freeze(["blocked"]),
  verifying: Object.freeze(["verifying", "done"]),
  done: Object.freeze(["done"]),
  cancelled: Object.freeze(["cancelled", "blocked"]),
});

export const REQUIRED_INDEX_SECTIONS = Object.freeze([
  "Macro Goal",
  "Current State",
  "Success Criteria",
  "Scope",
  "Non-Goals",
  "Protected Surfaces",
  "Risks / Blast Radius",
  "Authorization Boundaries",
  "Decisions",
  "Open Questions",
  "Rollback / Recovery",
  "Verification Strategy",
  "Subcontracts",
  "Current Status",
]);

export const REQUIRED_SUBCONTRACT_SECTIONS = Object.freeze([
  "Inputs",
  "Knowns",
  "Unknowns",
  "Completion Criteria",
  "Mutation Plan",
  "Verification",
  "Rollback / Recovery",
  "Status",
  "Next Step",
  "Result",
]);

const ACTIVE_STATUSES = new Set([
  "proposed",
  "aligned",
  "executing",
  "blocked",
  "verifying",
]);
const HISTORICAL_STATUSES = new Set(["done", "cancelled"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const CONTRACT_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const MAX_GOAL_LENGTH = 500;
const SUBCONTRACT_ID = /^\d{3}$/u;

export function assertStatusTransition(from, to) {
  if (!CONTRACT_STATUSES.includes(from) || !CONTRACT_STATUSES.includes(to)) {
    throw new Error(`Unknown Socrates contract status: ${from} -> ${to}`);
  }
  if (!ALLOWED_STATUS_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid Socrates status transition: ${from} -> ${to}`);
  }
}

export function parseScaffoldArgs(argv) {
  const options = {
    root: process.cwd(),
    contractId: null,
    macroGoal: null,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === "--root") {
      options.root = requireFlagValue(current, next);
      index += 1;
    } else if (current === "--id") {
      options.contractId = requireFlagValue(current, next);
      index += 1;
    } else if (current === "--help" || current === "-h") {
      options.help = true;
    } else if (current.startsWith("--")) {
      throw new Error(`Unknown argument: ${current}`);
    } else {
      positional.push(current);
    }
  }

  if (options.help) {
    return options;
  }
  if (positional.length !== 1) {
    throw new Error("Provide exactly one quoted macro goal");
  }
  options.macroGoal = positional[0];
  options.contractId ??= deriveContractId(options.macroGoal);
  return options;
}

function requireFlagValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function deriveContractId(goal) {
  const slug = String(goal)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64)
    .replace(/-+$/gu, "");
  return slug || "socrates-contract";
}

function validateInputs({ root, contractId, macroGoal, now }) {
  if (typeof root !== "string" || root.length === 0 || CONTROL_CHARACTERS.test(root)) {
    throw new Error("Target root must be a non-empty path without control characters");
  }
  if (typeof contractId !== "string" || !CONTRACT_ID.test(contractId)) {
    throw new Error(
      "Contract id must be 1-64 lowercase letters, digits, or internal hyphens"
    );
  }
  if (typeof macroGoal !== "string" || macroGoal.trim().length === 0) {
    throw new Error("Macro goal must not be empty");
  }
  if (CONTROL_CHARACTERS.test(macroGoal)) {
    throw new Error("Macro goal must not contain control characters");
  }
  if ([...macroGoal].length > MAX_GOAL_LENGTH) {
    throw new Error(`Macro goal must be at most ${MAX_GOAL_LENGTH} characters`);
  }
  if (typeof now !== "string" || Number.isNaN(Date.parse(now))) {
    throw new Error("Timestamp must be a valid ISO-8601 value");
  }
}

function resolveContractPaths(root, contractId) {
  const resolvedRoot = path.resolve(root);
  const contractsRoot = path.join(resolvedRoot, ".socrates", "contracts");
  const contractDir = path.join(contractsRoot, contractId);
  const relative = path.relative(contractsRoot, contractDir);
  if (relative !== contractId || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Contract id resolves outside the Socrates contracts directory");
  }
  return {
    root: resolvedRoot,
    contractsRoot,
    contractDir,
    indexPath: path.join(contractDir, "contract-index.md"),
    subcontractDir: path.join(contractDir, "subcontracts"),
    subcontractPath: path.join(contractDir, "subcontracts", "001.md"),
  };
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readRegularFileNoFollow(target, label) {
  const before = await lstat(target);
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`${label} is not a regular file: ${target}`);
  }
  const flags =
    constants.O_RDONLY |
    (constants.O_NOFOLLOW ?? 0) |
    (constants.O_NONBLOCK ?? 0);
  let handle;
  try {
    handle = await open(target, flags);
    const after = await handle.stat();
    if (
      !after.isFile() ||
      after.dev !== before.dev ||
      after.ino !== before.ino
    ) {
      throw new Error(`${label} changed before it could be read: ${target}`);
    }
    return await handle.readFile("utf8");
  } finally {
    await handle?.close();
  }
}

async function assertSafeManagedPath(root, target, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes the target root`);
  }
  const rootMetadata = await lstat(resolvedRoot);
  if (rootMetadata.isSymbolicLink()) {
    const followed = await stat(resolvedRoot);
    if (!followed.isDirectory()) throw new Error(`${label} root is not a directory`);
  } else if (!rootMetadata.isDirectory()) {
    throw new Error(`${label} root is not a directory`);
  }
  if (!relative) return;
  let cursor = resolvedRoot;
  const parts = relative.split(path.sep);
  for (let index = 0; index < parts.length; index += 1) {
    cursor = path.join(cursor, parts[index]);
    let metadata;
    try {
      metadata = await lstat(cursor);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }
    if (metadata.isSymbolicLink()) {
      throw new Error(`${label} contains a symlink: ${cursor}`);
    }
    if (index < parts.length - 1 && !metadata.isDirectory()) {
      throw new Error(`${label} ancestor is not a directory: ${cursor}`);
    }
  }
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

async function readLock(lockPath) {
  try {
    const raw = await readRegularFileNoFollow(lockPath, "Socrates scaffold lock");
    return { raw, parsed: JSON.parse(raw), missing: false, error: null };
  } catch (error) {
    return {
      raw: null,
      parsed: null,
      missing: Boolean(
        error && typeof error === "object" && error.code === "ENOENT"
      ),
      error,
    };
  }
}

async function acquireScaffoldLock({
  lockPath,
  now,
  writeFileImpl,
  readFileImpl,
  renameImpl,
  rmImpl,
  randomUUIDImpl,
}) {
  const token = randomUUIDImpl();
  const contents = `${JSON.stringify({
    protocol: SOCRATES_PROTOCOL,
    pid: process.pid,
    token,
    created_at: now,
  })}\n`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await writeFileImpl(lockPath, contents, { encoding: "utf8", flag: "wx" });
      return token;
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "EEXIST") {
        throw error;
      }
    }
    const existing = await readLock(lockPath);
    if (
      existing.parsed?.protocol === SOCRATES_PROTOCOL &&
      processIsRunning(existing.parsed.pid)
    ) {
      throw new Error(`Contract id is already being created: ${path.basename(lockPath, ".lock").slice(1)}`);
    }
    const claimPath = `${lockPath}.stale-${token}-${attempt}`;
    try {
      await renameImpl(lockPath, claimPath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") continue;
      throw error;
    }
    const claimed = await readLock(claimPath);
    if (
      claimed.parsed?.protocol === SOCRATES_PROTOCOL &&
      processIsRunning(claimed.parsed.pid)
    ) {
      try {
        await writeFileImpl(lockPath, claimed.raw, {
          encoding: "utf8",
          flag: "wx",
        });
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "EEXIST") {
          throw error;
        }
      } finally {
        await rmImpl(claimPath, { force: true });
      }
      throw new Error(`Contract id is already being created: ${path.basename(lockPath, ".lock").slice(1)}`);
    }
    await rmImpl(claimPath, { force: true });
  }
  throw new Error(`Could not acquire Socrates scaffold lock: ${lockPath}`);
}

async function scaffoldLockIsOwned(lockPath, token) {
  const current = await readLock(lockPath);
  return (
    current.parsed?.protocol === SOCRATES_PROTOCOL &&
    current.parsed?.pid === process.pid &&
    current.parsed?.token === token
  );
}

function quoteYaml(value) {
  return JSON.stringify(value);
}

function buildIndexContent({ contractId, macroGoal, now }) {
  return `---
protocol: ${SOCRATES_PROTOCOL}
schema_version: ${quoteYaml(SOCRATES_SCHEMA_VERSION)}
contract_id: ${contractId}
status: proposed
created_at: ${quoteYaml(now)}
updated_at: ${quoteYaml(now)}
task_identity: ${quoteYaml(macroGoal)}
active_subcontract: ${quoteYaml("001")}
---

# Macro Goal

${macroGoal}

# Current State

- (facts known before mutation)

# Success Criteria

- [ ] (testable end state)

# Scope

- (in-scope surfaces)

# Non-Goals

- (explicit exclusions)

# Protected Surfaces

- (compatibility, schema, auth, billing, deletion, production, external actions)

# Risks / Blast Radius

- (failure modes and affected users or systems)

# Authorization Boundaries

- Contract files record task state only; they do not grant authorization or host approval.

# Decisions

- (durable decisions and their evidence)

# Open Questions

- (load-bearing unresolved decisions only)

# Rollback / Recovery

- (how to restore the prior valid state)

# Verification Strategy

- (commands, inspections, fixtures, or observable behavior)

# Subcontracts

| ID | Task | Status | Next step | Verification |
|---|---|---|---|---|
| [001](subcontracts/001.md) | (one bounded task) | proposed | (immediate next action) | (narrow proof) |

# Current Status

Active subcontract: 001 (proposed)
Last updated: ${now}
`;
}

function buildSubcontractContent({ contractId, now }) {
  return `---
protocol: ${SOCRATES_PROTOCOL}
schema_version: ${quoteYaml(SOCRATES_SCHEMA_VERSION)}
contract_id: ${contractId}
subcontract_id: ${quoteYaml("001")}
task: ${quoteYaml("(one bounded task)")}
status: proposed
created_at: ${quoteYaml(now)}
updated_at: ${quoteYaml(now)}
next_step: ${quoteYaml("(immediate next action)")}
---

# Inputs

- (artifacts, decisions, and constraints)

# Knowns

- (verified facts)

# Unknowns

- (unresolved facts or decisions)

# Completion Criteria

- [ ] (testable criterion)

# Mutation Plan

1. (smallest bounded mutation)

# Verification

- (narrowest relevant proof)

# Rollback / Recovery

- (recovery path when relevant)

# Status

proposed

# Next Step

(immediate next action)

# Result

Pending. Record facts, commands, evidence, blockers, and outcomes only; never hidden reasoning.
`;
}

export async function scaffoldContract(rawOptions, dependencies = {}) {
  const now = rawOptions.now ?? new Date().toISOString();
  const options = {
    root: rawOptions.root ?? process.cwd(),
    contractId: rawOptions.contractId ?? deriveContractId(rawOptions.macroGoal),
    macroGoal: rawOptions.macroGoal,
    now,
  };
  validateInputs(options);

  const writeFileImpl = dependencies.writeFileImpl ?? writeFile;
  const readFileImpl = dependencies.readFileImpl ?? readFile;
  const mkdirImpl = dependencies.mkdirImpl ?? mkdir;
  const renameImpl = dependencies.renameImpl ?? rename;
  const rmdirImpl = dependencies.rmdirImpl ?? rmdir;
  const rmImpl = dependencies.rmImpl ?? rm;
  const platform = dependencies.platform ?? process.platform;
  const randomUUIDImpl = dependencies.randomUUIDImpl ?? randomUUID;
  const onWarning = dependencies.onWarning ?? (() => {});
  const paths = resolveContractPaths(options.root, options.contractId);
  const rootStat = await stat(paths.root).catch((error) => {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      throw new Error(`Target root does not exist: ${paths.root}`);
    }
    throw error;
  });
  if (!rootStat.isDirectory()) {
    throw new Error(`Target root is not a directory: ${paths.root}`);
  }

  await assertSafeManagedPath(
    paths.root,
    paths.contractsRoot,
    "Socrates contract destination"
  );
  await mkdirImpl(paths.contractsRoot, { recursive: true });
  await assertSafeManagedPath(
    paths.root,
    paths.contractsRoot,
    "Socrates contract destination"
  );
  const lockPath = path.join(paths.contractsRoot, `.${options.contractId}.lock`);
  let temporaryDir = null;
  let lockToken = null;
  let reservationIdentity = null;
  lockToken = await acquireScaffoldLock({
    lockPath,
    now,
    writeFileImpl,
    readFileImpl,
    renameImpl,
    rmImpl,
    randomUUIDImpl,
  });

  try {
    await assertSafeManagedPath(
      paths.root,
      paths.contractDir,
      "Socrates contract destination"
    );
    if (await pathExists(paths.contractDir)) {
      throw new Error(`Socrates contract already exists: ${paths.contractDir}`);
    }
    temporaryDir = await mkdtemp(
      path.join(paths.contractsRoot, `.${options.contractId}.tmp-`)
    );
    const temporarySubcontracts = path.join(temporaryDir, "subcontracts");
    await mkdirImpl(temporarySubcontracts, { recursive: false });
    await writeFileImpl(
      path.join(temporaryDir, "contract-index.md"),
      buildIndexContent(options),
      { encoding: "utf8", flag: "wx" }
    );
    await writeFileImpl(
      path.join(temporarySubcontracts, "001.md"),
      buildSubcontractContent(options),
      { encoding: "utf8", flag: "wx" }
    );

    const indexDocument = validateIndexDocument(
      await readFileImpl(path.join(temporaryDir, "contract-index.md"), "utf8"),
      options.contractId
    );
    const subcontractDocument = validateSubcontractDocument(
      await readFileImpl(path.join(temporarySubcontracts, "001.md"), "utf8"),
      { contractId: options.contractId, subcontractId: "001" }
    );
    validateIndexSubcontractCoherence(indexDocument, subcontractDocument);
    await assertSafeManagedPath(
      paths.root,
      paths.contractDir,
      "Socrates contract destination"
    );
    if (!(await scaffoldLockIsOwned(lockPath, lockToken))) {
      throw new Error(`Lost Socrates scaffold lock ownership: ${lockPath}`);
    }
    if (platform === "win32") {
      await renameImpl(temporaryDir, paths.contractDir);
    } else {
      await mkdirImpl(paths.contractDir, { recursive: false });
      const reservation = await lstat(paths.contractDir);
      if (!reservation.isDirectory() || reservation.isSymbolicLink()) {
        throw new Error(
          `Socrates contract destination is not an owned directory reservation: ${paths.contractDir}`
        );
      }
      reservationIdentity = { dev: reservation.dev, ino: reservation.ino };
      const current = await lstat(paths.contractDir);
      const entries = await readdir(paths.contractDir);
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        current.dev !== reservationIdentity.dev ||
        current.ino !== reservationIdentity.ino ||
        entries.length !== 0
      ) {
        throw new Error(
          `Socrates contract destination changed during publication: ${paths.contractDir}`
        );
      }
      await renameImpl(temporaryDir, paths.contractDir);
      reservationIdentity = null;
    }
    temporaryDir = null;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      ["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code)
    ) {
      throw new Error(`Socrates contract already exists: ${paths.contractDir}`);
    }
    throw error;
  } finally {
    if (reservationIdentity) {
      try {
        const current = await lstat(paths.contractDir);
        if (
          current.isDirectory() &&
          !current.isSymbolicLink() &&
          current.dev === reservationIdentity.dev &&
          current.ino === reservationIdentity.ino
        ) {
          await rmdirImpl(paths.contractDir);
        }
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)
        ) {
          onWarning(
            `Could not remove Socrates scaffold reservation ${paths.contractDir}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }
    if (temporaryDir) {
      try {
        await rmImpl(temporaryDir, { recursive: true, force: true });
      } catch (error) {
        onWarning(
          `Could not remove Socrates scaffold staging directory ${temporaryDir}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
    if (lockToken) {
      const lockInspection = await readLock(lockPath);
      const lockIsOwned =
        lockInspection.parsed?.protocol === SOCRATES_PROTOCOL &&
        lockInspection.parsed?.pid === process.pid &&
        lockInspection.parsed?.token === lockToken;
      if (lockIsOwned) {
        try {
          await rmImpl(lockPath, { force: true });
        } catch (error) {
          onWarning(
            `Could not release Socrates scaffold lock ${lockPath}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else if (!lockInspection.missing) {
        const detail = lockInspection.error
          ? `: ${
              lockInspection.error instanceof Error
                ? lockInspection.error.message
                : String(lockInspection.error)
            }`
          : "";
        onWarning(
          `Socrates scaffold lock was replaced or could not be verified; leaving it untouched at ${lockPath}${detail}`
        );
      }
    }
  }

  return paths;
}

function parseFrontmatter(contents, documentLabel) {
  if (typeof contents !== "string") {
    throw new Error(`${documentLabel} must be UTF-8 text`);
  }
  const normalized = contents.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u);
  if (!match) {
    throw new Error(`${documentLabel} is missing Socrates YAML frontmatter`);
  }
  const metadata = {};
  const seen = new Set();
  const frontmatterLines = match[1].split("\n");
  for (let index = 0; index < frontmatterLines.length; index += 1) {
    const line = frontmatterLines[index];
    if (!line.trim()) continue;
    const lineNumber = index + 2;
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(
        `${documentLabel} frontmatter line ${lineNumber} is malformed: expected key: value`
      );
    }
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/u.test(key)) {
      throw new Error(
        `${documentLabel} frontmatter line ${lineNumber} has invalid key ${JSON.stringify(key)}`
      );
    }
    if (seen.has(key)) {
      throw new Error(
        `${documentLabel} frontmatter line ${lineNumber} duplicates key ${JSON.stringify(key)}`
      );
    }
    seen.add(key);
    const rawValue = line.slice(separator + 1).trim();
    let value = rawValue;
    if (rawValue.startsWith('"')) {
      try {
        value = JSON.parse(rawValue);
      } catch {
        throw new Error(
          `${documentLabel} frontmatter field ${JSON.stringify(key)} has a malformed quoted value on line ${lineNumber}`
        );
      }
      if (typeof value !== "string") {
        throw new Error(
          `${documentLabel} frontmatter field ${JSON.stringify(key)} must be a simple scalar`
        );
      }
    }
    Object.defineProperty(metadata, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return {
    metadata,
    body: normalized.slice(match[0].length),
  };
}

function markdownFenceOpening(line) {
  const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
  if (!opening) return null;
  if (opening[1][0] === "`" && opening[2].includes("`")) return null;
  return { character: opening[1][0], length: opening[1].length };
}

function closesMarkdownFence(line, fence) {
  const closing = line.match(/^ {0,3}(`+|~+)[\t ]*$/u);
  return Boolean(
    closing &&
      closing[1][0] === fence.character &&
      closing[1].length >= fence.length
  );
}

function scanMarkdownH1Sections(body) {
  const lines = body.split("\n");
  const headings = [];
  let fence = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      if (closesMarkdownFence(line, fence)) fence = null;
      continue;
    }

    const opening = markdownFenceOpening(line);
    if (opening) {
      fence = opening;
      continue;
    }

    const heading = line.match(/^ {0,3}#(?!#)[\t ]+(.+?)[\t ]*$/u);
    if (!heading) continue;
    const title = heading[1].replace(/[\t ]+#+[\t ]*$/u, "").trim();
    headings.push({ title, lineIndex: index, lineNumber: index + 1 });
  }

  return { headings, lines };
}

function validateRequiredSections(body, requiredSections, documentLabel) {
  const { headings, lines } = scanMarkdownH1Sections(body);
  const byTitle = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const endLine = headings[index + 1]?.lineIndex ?? lines.length;
    const section = {
      ...heading,
      content: lines.slice(heading.lineIndex + 1, endLine).join("\n").trim(),
    };
    const occurrences = byTitle.get(heading.title) ?? [];
    occurrences.push(section);
    byTitle.set(heading.title, occurrences);
  }

  const canonicalByFoldedTitle = new Map(
    requiredSections.map((title) => [title.toLowerCase(), title])
  );
  for (const heading of headings) {
    const canonical = canonicalByFoldedTitle.get(heading.title.toLowerCase());
    if (canonical && heading.title !== canonical) {
      const kind = byTitle.has(canonical) ? "duplicates" : "misspells";
      throw new Error(
        `${documentLabel} ${kind} required H1 section ${JSON.stringify(canonical)} with noncanonical heading ${JSON.stringify(heading.title)} at line ${heading.lineNumber}`
      );
    }
  }

  for (const required of requiredSections) {
    const occurrences = byTitle.get(required) ?? [];
    if (occurrences.length === 0) {
      throw new Error(`${documentLabel} is missing required H1 section ${JSON.stringify(required)}`);
    }
    if (occurrences.length > 1) {
      throw new Error(
        `${documentLabel} has duplicate required H1 section ${JSON.stringify(required)} at line ${occurrences[1].lineNumber}`
      );
    }
  }

  let previous = null;
  for (const required of requiredSections) {
    const section = byTitle.get(required)[0];
    if (previous && section.lineIndex < previous.lineIndex) {
      throw new Error(
        `${documentLabel} required H1 section ${JSON.stringify(required)} is out of canonical order`
      );
    }
    if (!section.content) {
      throw new Error(`${documentLabel} required H1 section ${JSON.stringify(required)} is empty`);
    }
    previous = section;
  }

  return new Map(requiredSections.map((title) => [title, byTitle.get(title)[0].content]));
}

function validateIndexDocument(contents, directoryId = null) {
  const { metadata, body } = parseFrontmatter(contents, "Socrates contract index");
  if (metadata.protocol !== SOCRATES_PROTOCOL) {
    throw new Error(`invalid Socrates protocol marker: ${metadata.protocol ?? "missing"}`);
  }
  if (metadata.schema_version !== SOCRATES_SCHEMA_VERSION) {
    throw new Error(`unsupported Socrates schema version: ${metadata.schema_version ?? "missing"}`);
  }
  if (!CONTRACT_ID.test(metadata.contract_id ?? "")) {
    throw new Error("invalid or missing Socrates contract_id");
  }
  if (directoryId && metadata.contract_id !== directoryId) {
    throw new Error(
      `Socrates contract_id ${metadata.contract_id} does not match directory ${directoryId}`
    );
  }
  if (!CONTRACT_STATUSES.includes(metadata.status)) {
    throw new Error(`invalid or missing Socrates status: ${metadata.status ?? "missing"}`);
  }
  for (const field of ["created_at", "updated_at"]) {
    if (!metadata[field] || Number.isNaN(Date.parse(metadata[field]))) {
      throw new Error(`invalid or missing Socrates ${field}`);
    }
  }
  if (!metadata.task_identity || CONTROL_CHARACTERS.test(metadata.task_identity)) {
    throw new Error("invalid or missing Socrates task_identity");
  }
  if (!SUBCONTRACT_ID.test(metadata.active_subcontract ?? "")) {
    throw new Error("invalid or missing Socrates active_subcontract");
  }
  return {
    metadata,
    sections: validateRequiredSections(
      body,
      REQUIRED_INDEX_SECTIONS,
      "Socrates contract index"
    ),
  };
}

export async function validateSocratesIndex(contents, directoryId = null) {
  return validateIndexDocument(contents, directoryId).metadata;
}

function validateSubcontractDocument(
  contents,
  { contractId = null, subcontractId = null } = {}
) {
  const { metadata, body } = parseFrontmatter(contents, "Socrates subcontract");
  if (metadata.protocol !== SOCRATES_PROTOCOL) {
    throw new Error(`invalid Socrates subcontract protocol marker: ${metadata.protocol ?? "missing"}`);
  }
  if (metadata.schema_version !== SOCRATES_SCHEMA_VERSION) {
    throw new Error(`unsupported Socrates subcontract schema version: ${metadata.schema_version ?? "missing"}`);
  }
  if (!CONTRACT_ID.test(metadata.contract_id ?? "")) {
    throw new Error("invalid or missing Socrates subcontract contract_id");
  }
  if (contractId && metadata.contract_id !== contractId) {
    throw new Error(`Socrates subcontract contract_id mismatch: ${metadata.contract_id}`);
  }
  if (!SUBCONTRACT_ID.test(metadata.subcontract_id ?? "")) {
    throw new Error("invalid or missing Socrates subcontract_id");
  }
  if (subcontractId && metadata.subcontract_id !== subcontractId) {
    throw new Error(`Socrates subcontract id mismatch: ${metadata.subcontract_id}`);
  }
  if (!CONTRACT_STATUSES.includes(metadata.status)) {
    throw new Error(`invalid or missing Socrates subcontract status: ${metadata.status ?? "missing"}`);
  }
  for (const field of ["created_at", "updated_at"]) {
    if (!metadata[field] || Number.isNaN(Date.parse(metadata[field]))) {
      throw new Error(`invalid or missing Socrates subcontract ${field}`);
    }
  }
  for (const field of ["task", "next_step"]) {
    if (!metadata[field] || CONTROL_CHARACTERS.test(metadata[field])) {
      throw new Error(`invalid or missing Socrates subcontract ${field}`);
    }
  }
  const sections = validateRequiredSections(
    body,
    REQUIRED_SUBCONTRACT_SECTIONS,
    "Socrates subcontract"
  );
  const textualStatus = sections.get("Status").trim();
  if (textualStatus !== metadata.status) {
    throw new Error(
      `Socrates subcontract Status section ${JSON.stringify(textualStatus)} does not match frontmatter status ${JSON.stringify(metadata.status)}`
    );
  }
  return { metadata, sections };
}

export async function validateSocratesSubcontract(
  contents,
  { contractId = null, subcontractId = null } = {}
) {
  return validateSubcontractDocument(contents, { contractId, subcontractId }).metadata;
}

function withoutFencedCode(markdown) {
  const lines = markdown.split("\n");
  const visible = [];
  let fence = null;
  for (const line of lines) {
    if (fence) {
      if (closesMarkdownFence(line, fence)) fence = null;
      continue;
    }
    const opening = markdownFenceOpening(line);
    if (opening) {
      fence = opening;
      continue;
    }
    visible.push(line);
  }
  return visible.join("\n");
}

function validateIndexSubcontractCoherence(
  indexDocument,
  subcontractDocument,
  { requirePathReference = true } = {}
) {
  const index = indexDocument.metadata;
  const subcontract = subcontractDocument.metadata;
  if (subcontract.contract_id !== index.contract_id) {
    throw new Error(
      `Socrates subcontract contract_id ${subcontract.contract_id} does not match index ${index.contract_id}`
    );
  }
  if (subcontract.subcontract_id !== index.active_subcontract) {
    throw new Error(
      `Socrates subcontract id ${subcontract.subcontract_id} does not match active_subcontract ${index.active_subcontract}`
    );
  }

  if (requirePathReference) {
    const visibleSubcontracts = withoutFencedCode(
      indexDocument.sections.get("Subcontracts")
    );
    const expectedPath = `subcontracts/${index.active_subcontract}.md`;
    const escapedPath = expectedPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const pathReference = new RegExp(
      `(?:^|[\\s('"<])(?:\\./)?${escapedPath}(?=$|[\\s)'">#?])`,
      "u"
    );
    if (!pathReference.test(visibleSubcontracts)) {
      throw new Error(
        `Socrates index Subcontracts section does not reference active path ${expectedPath}`
      );
    }
  }

  const allowed = ALLOWED_ACTIVE_SUBCONTRACT_STATUSES[index.status];
  if (!allowed.includes(subcontract.status)) {
    throw new Error(
      `incoherent Socrates lifecycle: macro ${index.status} cannot reference subcontract ${subcontract.status}`
    );
  }
}

function taskTokens(value) {
  const ignored = new Set([
    "a",
    "an",
    "and",
    "continue",
    "contract",
    "for",
    "of",
    "socrates",
    "task",
    "the",
    "to",
    "work",
  ]);
  return new Set(
    String(value)
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2 && !ignored.has(token))
  );
}

function plausiblyMatchesTask(taskIdentity, taskHint) {
  if (!taskHint) return null;
  const task = taskTokens(taskIdentity);
  const hint = taskTokens(taskHint);
  if (task.size === 0 || hint.size === 0) return false;
  return [...hint].some((token) => task.has(token));
}

async function discoverLegacyState(root) {
  const indexPath = path.join(root, "contract-index.md");
  const contractsDir = path.join(root, "contracts");
  if (!(await pathExists(indexPath)) || !(await pathExists(contractsDir))) {
    return null;
  }
  try {
    const [indexMetadata, contractsMetadata] = await Promise.all([
      lstat(indexPath),
      lstat(contractsDir),
    ]);
    if (
      indexMetadata.isSymbolicLink() ||
      !indexMetadata.isFile() ||
      contractsMetadata.isSymbolicLink() ||
      !contractsMetadata.isDirectory()
    ) {
      return null;
    }
  } catch {
    return null;
  }
  let entries;
  try {
    entries = await readdir(contractsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const legacyFiles = entries
    .filter(
      (entry) => entry.isFile() && /^contract-\d{3}\.md$/u.test(entry.name)
    )
    .map((entry) => path.join(contractsDir, entry.name));
  if (legacyFiles.length === 0) return null;
  return {
    kind: "legacy",
    indexPath,
    subcontractPaths: legacyFiles.sort(),
    readOnly: true,
    canAuthorize: false,
  };
}

export async function discoverSocratesState({ root, taskHint = null }) {
  if (typeof root !== "string" || !root || CONTROL_CHARACTERS.test(root)) {
    throw new Error("Discovery root must be a valid path without control characters");
  }
  const resolvedRoot = path.resolve(root);
  const contractsRoot = path.join(resolvedRoot, ".socrates", "contracts");
  const result = {
    active: [],
    historical: [],
    legacy: await discoverLegacyState(resolvedRoot),
    invalid: [],
  };
  try {
    await assertSafeManagedPath(
      resolvedRoot,
      contractsRoot,
      "Socrates discovery path"
    );
  } catch (error) {
    result.invalid.push({
      contractId: null,
      indexPath: contractsRoot,
      canAuthorize: false,
      reason: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
  let entries;
  try {
    entries = await readdir(contractsRoot, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return result;
    }
    result.invalid.push({
      contractId: null,
      indexPath: contractsRoot,
      canAuthorize: false,
      reason: `Cannot read Socrates contracts root: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return result;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const indexPath = path.join(contractsRoot, entry.name, "contract-index.md");
    if (entry.isSymbolicLink()) {
      result.invalid.push({
        contractId: entry.name,
        indexPath,
        canAuthorize: false,
        reason: `Socrates contract directory contains a symlink: ${entry.name}`,
      });
      continue;
    }
    if (!entry.isDirectory()) continue;
    try {
      await assertSafeManagedPath(
        resolvedRoot,
        indexPath,
        "Socrates contract index"
      );
      const indexDocument = validateIndexDocument(
        await readRegularFileNoFollow(indexPath, "Socrates contract index"),
        entry.name
      );
      const metadata = indexDocument.metadata;
      const candidate = {
        kind: "socrates",
        contractId: metadata.contract_id,
        status: metadata.status,
        taskIdentity: metadata.task_identity,
        createdAt: metadata.created_at,
        updatedAt: metadata.updated_at,
        indexPath,
        matchesTask: plausiblyMatchesTask(metadata.task_identity, taskHint),
        readOnly: false,
        canAuthorize: false,
      };
      if (ACTIVE_STATUSES.has(metadata.status)) {
        const subcontractPath = path.join(
          contractsRoot,
          entry.name,
          "subcontracts",
          `${metadata.active_subcontract}.md`
        );
        await assertSafeManagedPath(
          resolvedRoot,
          subcontractPath,
          "Socrates active subcontract"
        );
        let subcontractContents;
        try {
          subcontractContents = await readRegularFileNoFollow(
            subcontractPath,
            "Socrates active subcontract"
          );
        } catch (error) {
          if (error && typeof error === "object" && error.code === "ENOENT") {
            throw new Error(
              `active Socrates subcontract is missing: subcontracts/${metadata.active_subcontract}.md`
            );
          }
          throw error;
        }
        const subcontractDocument = validateSubcontractDocument(
          subcontractContents,
          {
            contractId: metadata.contract_id,
            subcontractId: metadata.active_subcontract,
          }
        );
        validateIndexSubcontractCoherence(indexDocument, subcontractDocument);
        candidate.activeSubcontract = metadata.active_subcontract;
        candidate.subcontractPath = subcontractPath;
        candidate.subcontractStatus = subcontractDocument.metadata.status;
        result.active.push(candidate);
      } else if (HISTORICAL_STATUSES.has(metadata.status)) {
        const subcontractPath = path.join(
          contractsRoot,
          entry.name,
          "subcontracts",
          `${metadata.active_subcontract}.md`
        );
        await assertSafeManagedPath(
          resolvedRoot,
          subcontractPath,
          "Socrates referenced subcontract"
        );
        if (await pathExists(subcontractPath)) {
          const subcontractDocument = validateSubcontractDocument(
            await readRegularFileNoFollow(
              subcontractPath,
              "Socrates referenced subcontract"
            ),
            {
              contractId: metadata.contract_id,
              subcontractId: metadata.active_subcontract,
            }
          );
          validateIndexSubcontractCoherence(indexDocument, subcontractDocument, {
            requirePathReference: false,
          });
          candidate.activeSubcontract = metadata.active_subcontract;
          candidate.subcontractPath = subcontractPath;
          candidate.subcontractStatus = subcontractDocument.metadata.status;
        }
        result.historical.push(candidate);
      }
    } catch (error) {
      result.invalid.push({
        contractId: entry.name,
        indexPath,
        canAuthorize: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const newestFirst = (left, right) => right.updatedAt.localeCompare(left.updatedAt);
  result.active.sort(newestFirst);
  result.historical.sort(newestFirst);
  result.invalid.sort((left, right) => left.contractId.localeCompare(right.contractId));
  return result;
}

export function renderScaffoldHelp() {
  return `Socrates contract scaffolder

Usage:
  node scaffold-contract.mjs --root /absolute/workspace --id stable-contract-id "<macro goal>"

Compatibility:
  The legacy one-argument form still defaults --root to the current directory and derives an id.
  New state is always created under .socrates/contracts/<contract-id>/.
`;
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const options = parseScaffoldArgs(argv);
  if (options.help) {
    stdout.write(renderScaffoldHelp());
    return;
  }
  const result = await scaffoldContract(options, dependencies);
  stdout.write(
    `Created Socrates contract ${options.contractId}:\n` +
      `- ${result.indexPath}\n` +
      `- ${result.subcontractPath}\n` +
      "Next: fill the placeholders, align the active subcontract, then verify before closing.\n"
  );
}

export async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const stderr = dependencies.stderr ?? process.stderr;
  const warnings = [];
  const callerWarning = dependencies.onWarning;
  const onWarning = (warning) => {
    warnings.push(String(warning).trimEnd());
    callerWarning?.(warning);
  };
  const flushWarnings = () => {
    for (const warning of warnings) {
      stderr.write(`Warning: ${warning}\n`);
    }
  };

  try {
    await main(argv, { ...dependencies, onWarning });
    flushWarnings();
    return 0;
  } catch (error) {
    flushWarnings();
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`${message}\n`);
    return 1;
  }
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

if (isFileModule) {
  process.exitCode = await runCli();
}
