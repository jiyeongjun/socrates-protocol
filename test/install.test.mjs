import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  INSTALL_MANIFEST_NAME,
  inferLocalSourceRoot,
  installSocrates as installSocratesImpl,
  installerStatePaths,
  parseArgs,
  runCli as runInstallerCli,
  uninstallSocrates as uninstallSocratesImpl,
} from "../scripts/install.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const testInstallerStateRoot = await mkdtemp(
  path.join(tmpdir(), "socrates-installer-test-state-")
);
const ASSET_PATH_FOR_CODEX_SKILL = path.join(
  ".agents",
  "skills",
  "socrates-contract",
  "SKILL.md"
);

function installerStateDir(root) {
  return installerPaths(root).stateDir;
}

function installerPaths(root) {
  return installerStatePaths(
    { scope: "repo", targetRepo: root },
    testInstallerStateRoot
  );
}

function installSocrates(options, dependencies = {}) {
  return installSocratesImpl(options, {
    stateRoot: testInstallerStateRoot,
    ...dependencies,
  });
}

function uninstallSocrates(options, dependencies = {}) {
  return uninstallSocratesImpl(options, {
    stateRoot: testInstallerStateRoot,
    ...dependencies,
  });
}

function createOutputCapture() {
  const chunks = [];
  return {
    stream: {
      write(chunk) {
        chunks.push(String(chunk));
        return true;
      },
    },
    text() {
      return chunks.join("");
    },
  };
}

function repoCliArgs(root, mode = "install") {
  return [
    "--mode",
    mode,
    "--platform",
    "codex",
    "--scope",
    "repo",
    "--target-repo",
    root,
    "--source-root",
    repoRoot,
  ];
}

async function assertMissing(target) {
  await assert.rejects(() => access(target));
}

async function writeJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2), "utf8");
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function runNodeCli(scriptPath, args, cwd, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env,
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

    child.on("close", (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

async function loadChangedSkillAsset(relativePath) {
  const contents = await readFile(path.join(repoRoot, relativePath), "utf8");
  return relativePath.endsWith("/SKILL.md")
    ? `${contents}\n<!-- changed fixture -->\n`
    : contents;
}

async function loadChangedSkillAndAgentAsset(relativePath) {
  const contents = await readFile(path.join(repoRoot, relativePath), "utf8");
  if (relativePath.endsWith("/SKILL.md")) {
    return `${contents}\n<!-- changed transaction fixture -->\n`;
  }
  if (relativePath.endsWith("/socrates-verify.toml")) {
    return `${contents}\n# changed transaction fixture\n`;
  }
  return contents;
}

test("parseArgs accepts the recommended repo install shape", () => {
  const parsed = parseArgs([
    "--platform",
    "both",
    "--scope",
    "repo",
    "--target-repo",
    "/tmp/example",
    "--version",
    "v0.9.0",
  ]);

  assert.equal(parsed.platform, "both");
  assert.equal(parsed.scope, "repo");
  assert.equal(parsed.targetRepo, "/tmp/example");
  assert.equal(parsed.version, "v0.9.0");
});

test("parseArgs rejects invalid combinations", () => {
  assert.throws(() => parseArgs(["--platform", "nope"]), /--platform must be one of/);
  assert.throws(() => parseArgs(["--scope", "repo"]), /--target-repo is required/);
  assert.throws(() => parseArgs(["--scope", "planet"]), /--scope must be one of/);
  assert.throws(() => parseArgs(["--mode", "destroy"]), /--mode must be one of/);
});

test(
  "installer state uses a durable private per-user root",
  { skip: process.platform === "win32" },
  async () => {
    const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-state-home-"));
    const targetRepo = await mkdtemp(path.join(tmpdir(), "socrates-state-target-"));
    const paths = installerStatePaths({
      scope: "repo",
      targetRepo,
      homeDir: fakeHome,
      codexHome: path.join(fakeHome, ".codex"),
    });
    assert.equal(
      paths.stateRoot,
      path.join(fakeHome, ".socrates", "installer")
    );

    const insecureRoot = await mkdtemp(
      path.join(tmpdir(), "socrates-insecure-state-")
    );
    await chmod(insecureRoot, 0o755);
    await assert.rejects(
      () =>
        installSocrates(
          {
            platform: "codex",
            scope: "repo",
            targetRepo,
            sourceRoot: repoRoot,
          },
          { stateRoot: insecureRoot }
        ),
      /mode 0700/i
    );
  }
);

test("fresh repo install writes only current platform skills", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-fresh-repo-"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await assert.doesNotReject(() =>
    readFile(path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(
      path.join(root, ".agents", "skills", "socrates-contract", "references", "artifact-recovery.md"),
      "utf8"
    )
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".agents", "skills", "socrates-contract", "scripts", "scaffold-contract.mjs"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".codex", "agents", "socrates-explore.toml"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "skills", "socrates-contract", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "agents", "socrates-plan.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "skills", "socrates-contract", "scripts", "scaffold-contract.mjs"), "utf8")
  );

  await assertMissing(path.join(root, ".claude", "settings.json"));
});

test("global install writes current Codex and Claude locations", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-install-global-"));

  await installSocrates({
    platform: "both",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
  });

  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".agents", "skills", "socrates-contract", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".codex", "agents", "socrates-explore.toml"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".claude", "skills", "socrates-contract", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".claude", "agents", "socrates-evaluate.md"), "utf8")
  );
});

test("install starts from a clean skill directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-clean-dir-"));
  const staleCodexFile = path.join(root, ".agents", "skills", "socrates-contract", "references", "removed.md");
  const staleClaudeFile = path.join(root, ".claude", "skills", "socrates-contract", "references", "removed.md");
  await mkdir(path.dirname(staleCodexFile), { recursive: true });
  await mkdir(path.dirname(staleClaudeFile), { recursive: true });
  await writeFile(staleCodexFile, "stale", "utf8");
  await writeFile(staleClaudeFile, "stale", "utf8");

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await assertMissing(staleCodexFile);
  await assertMissing(staleClaudeFile);
});

test("uninstall removes installed skill files and keeps unrelated config", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  await writeJson(path.join(root, ".claude", "settings.json"), {
    permissions: {
      allow: ["Bash(echo *)"],
    },
  });
  await writeFile(
    path.join(root, ".claude", "agents", "unrelated-agent.md"),
    "unrelated\n",
    "utf8"
  );

  await uninstallSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });

  await assertMissing(path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"));
  await assertMissing(path.join(root, ".claude", "skills", "socrates-contract", "SKILL.md"));
  const settings = JSON.parse(await readFile(path.join(root, ".claude", "settings.json"), "utf8"));
  assert.deepEqual(settings.permissions.allow, ["Bash(echo *)"]);
  assert.equal(
    await readFile(
      path.join(root, ".claude", "agents", "unrelated-agent.md"),
      "utf8"
    ),
    "unrelated\n"
  );
});

test("installer CLI can install from local source", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-install-"));
  const result = await runNodeCli(
    path.join(repoRoot, "scripts", "install.mjs"),
    [
      "--platform",
      "codex",
      "--scope",
      "repo",
      "--target-repo",
      root,
      "--source-root",
      repoRoot,
    ],
    repoRoot,
    { ...process.env, SOCRATES_INSTALLER_STATE_ROOT: testInstallerStateRoot }
  );

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Installed Socrates to:/);
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"), "utf8")
  );
});

test("installer CLI reports pre-publication failure without printing success", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-stage-failure-"));
  const stdout = createOutputCapture();
  const stderr = createOutputCapture();
  let injected = false;

  const code = await runInstallerCli(repoCliArgs(root), {
    stateRoot: testInstallerStateRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    writeFile: async (target, contents, options) => {
      if (!injected && String(target).includes(".socrates-contract.stage-")) {
        injected = true;
        throw new Error("injected CLI staging failure");
      }
      return writeFile(target, contents, options);
    },
  });

  assert.equal(code, 1);
  assert.equal(injected, true);
  assert.equal(stdout.text(), "");
  assert.match(stderr.text(), /injected CLI staging failure/i);
  assert.doesNotMatch(stderr.text(), /Installed Socrates to:/i);
  await assertMissing(
    path.join(root, ".agents", "skills", "socrates-contract")
  );
});

test("layout validation rejects traversal, separators, control characters, and duplicates", async () => {
  const invalidLayouts = [
    { skillReferences: [""], skillScripts: [], claudeAgents: [] },
    { skillReferences: ["/absolute.md"], skillScripts: [], claudeAgents: [] },
    { skillReferences: ["../escape.md"], skillScripts: [], claudeAgents: [] },
    { skillReferences: ["nested/file.md"], skillScripts: [], claudeAgents: [] },
    { skillReferences: ["bad\u0000.md"], skillScripts: [], claudeAgents: [] },
    { skillReferences: ["same.md", "same.md"], skillScripts: [], claudeAgents: [] },
  ];

  for (const layout of invalidLayouts) {
    const root = await mkdtemp(path.join(tmpdir(), "socrates-invalid-layout-"));
    await assert.rejects(
      () =>
        installSocrates(
          {
            platform: "codex",
            scope: "repo",
            targetRepo: root,
            sourceRoot: null,
          },
          {
            loadAsset: async (relativePath) => {
              if (relativePath === "reference/skill-layout.json") {
                return JSON.stringify(layout);
              }
              return readFile(path.join(repoRoot, relativePath), "utf8");
            },
          }
        ),
      /invalid|duplicate/i
    );
    await assertMissing(path.join(root, "escape.md"));
  }
});

test("asset load failure leaves the previous installation intact", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-load-rollback-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    "SKILL.md"
  );
  const previous = await readFile(skillPath, "utf8");
  let loads = 0;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: null,
          version: "v0.9.1-test",
        },
        {
          loadAsset: async (relativePath) => {
            loads += 1;
            if (loads === 4) throw new Error("injected asset load failure");
            return readFile(path.join(repoRoot, relativePath), "utf8");
          },
        }
      ),
    /injected asset load failure/
  );
  assert.equal(await readFile(skillPath, "utf8"), previous);
});

test("staging write failure leaves the previous installation intact", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-write-rollback-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    "SKILL.md"
  );
  const previous = await readFile(skillPath, "utf8");
  let writes = 0;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
          version: "v0.9.1-test",
        },
        {
          loadAsset: loadChangedSkillAsset,
          writeFile: async (...args) => {
            writes += 1;
            if (writes === 3) throw new Error("injected staging write failure");
            return writeFile(...args);
          },
        }
      ),
    /injected staging write failure/
  );
  assert.equal(await readFile(skillPath, "utf8"), previous);
});

test("ownership-ledger staging failure leaves the live installation unchanged", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-ledger-stage-failure-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    "SKILL.md"
  );
  const paths = installerPaths(root);
  const [previousSkill, previousLedger] = await Promise.all([
    readFile(skillPath, "utf8"),
    readFile(paths.ledgerPath, "utf8"),
  ]);

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          loadAsset: loadChangedSkillAsset,
          writeFile: async (target, contents, options) => {
            if (
              String(target).includes(".socrates-ledger.stage-") &&
              path.basename(String(target)) === "ownership.json"
            ) {
              throw new Error("injected ownership ledger staging failure");
            }
            return writeFile(target, contents, options);
          },
        }
      ),
    /injected ownership ledger staging failure/i
  );
  assert.equal(await readFile(skillPath, "utf8"), previousSkill);
  assert.equal(await readFile(paths.ledgerPath, "utf8"), previousLedger);
  await assertMissing(paths.journalPath);
  assert.equal(
    (await readdir(paths.scopeDir)).some((name) =>
      name.startsWith(".socrates-ledger.stage-")
    ),
    false
  );
});

test("explicit local source never falls back to remote assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-incomplete-source-target-"));
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "socrates-incomplete-source-"));
  await writeJson(path.join(sourceRoot, "reference", "skill-layout.json"), {
    skillReferences: ["missing.md"],
    skillScripts: [],
    claudeAgents: [],
  });

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot,
      }),
    /incomplete local source.*missing\.md/i
  );
  await assertMissing(path.join(root, ".agents", "skills", "socrates-contract"));
});

test("activation failure restores both previous platform installations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-activation-rollback-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const codexManifest = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const claudeManifest = path.join(
    root,
    ".claude",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const previousCodex = await readFile(codexManifest, "utf8");
  const previousClaude = await readFile(claudeManifest, "utf8");
  let failed = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "both",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
          version: "v0.9.1-test",
        },
        {
          loadAsset: loadChangedSkillAsset,
          rename: async (source, target) => {
            if (
              !failed &&
              source.includes(".stage-") &&
              target.includes(path.join(".claude", "skills", "socrates-contract"))
            ) {
              failed = true;
              throw new Error("injected activation failure");
            }
            return rename(source, target);
          },
        }
      ),
    /injected activation failure/
  );
  assert.equal(await readFile(codexManifest, "utf8"), previousCodex);
  assert.equal(await readFile(claudeManifest, "utf8"), previousClaude);
});

test("ownership-ledger publication failure rolls back the full update", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-ledger-publish-failure-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const paths = installerPaths(root);
  const skillPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    "SKILL.md"
  );
  const manifestPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const [previousSkill, previousManifest, previousLedger] = await Promise.all([
    readFile(skillPath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(paths.ledgerPath, "utf8"),
  ]);

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          loadAsset: loadChangedSkillAsset,
          link: async (source, target) => {
            if (target === paths.ledgerPath) {
              throw new Error("injected ownership ledger publication failure");
            }
            return link(source, target);
          },
        }
      ),
    /injected ownership ledger publication failure/i
  );
  assert.equal(await readFile(skillPath, "utf8"), previousSkill);
  assert.equal(await readFile(manifestPath, "utf8"), previousManifest);
  assert.equal(await readFile(paths.ledgerPath, "utf8"), previousLedger);
  await assertMissing(paths.journalPath);
});

test("installer CLI reports rollback failure without printing success", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-ledger-recovery-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const paths = installerPaths(root);
  const skillPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    "SKILL.md"
  );
  const [previousSkill, previousLedger] = await Promise.all([
    readFile(skillPath, "utf8"),
    readFile(paths.ledgerPath, "utf8"),
  ]);
  let restoreFailed = false;
  const stdout = createOutputCapture();
  const stderr = createOutputCapture();

  const code = await runInstallerCli(repoCliArgs(root), {
    stateRoot: testInstallerStateRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    loadAsset: loadChangedSkillAsset,
    link: async (source, target) => {
      if (target === paths.ledgerPath) {
        throw new Error("injected ledger publication interruption");
      }
      return link(source, target);
    },
    rename: async (source, target) => {
      if (
        !restoreFailed &&
        target === paths.ledgerPath &&
        path.basename(source).startsWith(".ownership.json.backup-")
      ) {
        restoreFailed = true;
        throw new Error("injected ledger rollback interruption");
      }
      return rename(source, target);
    },
  });
  assert.equal(code, 1);
  assert.equal(stdout.text(), "");
  assert.match(stderr.text(), /rollback failure/i);
  assert.doesNotMatch(stderr.text(), /Installed Socrates to:/i);
  await assert.doesNotReject(() => readFile(paths.journalPath, "utf8"));

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  assert.equal(await readFile(skillPath, "utf8"), previousSkill);
  assert.equal(await readFile(paths.ledgerPath, "utf8"), previousLedger);
  await assertMissing(paths.journalPath);
});

test("ownership-ledger publication failure rolls back uninstall", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-ledger-uninstall-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const paths = installerPaths(root);
  const codexSkill = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    "SKILL.md"
  );
  const [previousSkill, previousLedger] = await Promise.all([
    readFile(codexSkill, "utf8"),
    readFile(paths.ledgerPath, "utf8"),
  ]);

  await assert.rejects(
    () =>
      uninstallSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          link: async (source, target) => {
            if (target === paths.ledgerPath) {
              throw new Error("injected uninstall ledger publication failure");
            }
            return link(source, target);
          },
        }
      ),
    /injected uninstall ledger publication failure/i
  );
  assert.equal(await readFile(codexSkill, "utf8"), previousSkill);
  assert.equal(await readFile(paths.ledgerPath, "utf8"), previousLedger);
  await assert.doesNotReject(() =>
    readFile(
      path.join(root, ".claude", "skills", "socrates-contract", "SKILL.md"),
      "utf8"
    )
  );
  await assertMissing(paths.journalPath);
});

test("repeated install is idempotent and writes a complete manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-idempotent-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const manifestPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const first = await readFile(manifestPath, "utf8");
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const second = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(second);

  assert.equal(second, first);
  assert.equal(manifest.protocol, "socrates-contract");
  assert.equal(manifest.protocol_version, "0.9.0");
  assert.match(manifest.source_ref, /^local:/);
  assert.equal(Array.isArray(manifest.assets), true);
  assert.equal(manifest.assets.some((asset) => asset.source.endsWith("SKILL.md")), true);
  assert.equal(typeof manifest.installed_at, "string");
  assert.equal(second.includes(root), false);
});

test("installer refuses to overwrite an unowned Claude agent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-agent-ownership-"));
  const agentPath = path.join(root, ".claude", "agents", "socrates-plan.md");
  await mkdir(path.dirname(agentPath), { recursive: true });
  await writeFile(agentPath, "user-owned agent\n", "utf8");

  await assert.rejects(
    () =>
      installSocrates({
        platform: "claude",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /unowned Claude agent/i
  );
  assert.equal(await readFile(agentPath, "utf8"), "user-owned agent\n");
  await assertMissing(
    path.join(root, ".claude", "skills", "socrates-contract")
  );
});

test("preexisting byte-identical shared agents remain unowned on uninstall", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-identical-agent-"));
  const agentPath = path.join(root, ".codex", "agents", "socrates-explore.toml");
  const canonical = await readFile(
    path.join(repoRoot, ".codex", "agents", "socrates-explore.toml"),
    "utf8"
  );
  await mkdir(path.dirname(agentPath), { recursive: true });
  await writeFile(agentPath, canonical, "utf8");

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const manifest = JSON.parse(
    await readFile(
      path.join(
        root,
        ".agents",
        "skills",
        "socrates-contract",
        INSTALL_MANIFEST_NAME
      ),
      "utf8"
    )
  );
  assert.equal(
    manifest.assets.some((asset) => asset.target === "agents/socrates-explore.toml"),
    false
  );

  await uninstallSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  assert.equal(await readFile(agentPath, "utf8"), canonical);
});

test("a forged exact manifest claim cannot adopt a byte-identical user agent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-forged-exact-agent-"));
  const agentPath = path.join(root, ".codex", "agents", "socrates-explore.toml");
  const canonical = await readFile(
    path.join(repoRoot, ".codex", "agents", "socrates-explore.toml"),
    "utf8"
  );
  await mkdir(path.dirname(agentPath), { recursive: true });
  await writeFile(agentPath, canonical, "utf8");
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const manifestPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.assets.push({
    source: ".codex/agents/socrates-explore.toml",
    target: "agents/socrates-explore.toml",
    ownership: "shared-codex-agent",
    sha256: sha256(canonical),
    bytes: Buffer.byteLength(canonical, "utf8"),
  });
  await writeJson(manifestPath, manifest);

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /ownership ledger/i
  );
  assert.equal(await readFile(agentPath, "utf8"), canonical);
});

test("agent layout updates remove only unchanged previously owned agents", async () => {
  const removedRoot = await mkdtemp(path.join(tmpdir(), "socrates-agent-remove-"));
  const modifiedRoot = await mkdtemp(path.join(tmpdir(), "socrates-agent-modified-"));
  const evaluateRelative = path.join(".claude", "agents", "socrates-evaluate.md");
  const loadWithoutEvaluate = async (relativePath) => {
    if (relativePath === "reference/skill-layout.json") {
      const layout = JSON.parse(
        await readFile(path.join(repoRoot, relativePath), "utf8")
      );
      layout.claudeAgents = layout.claudeAgents.filter(
        (name) => name !== "socrates-evaluate.md"
      );
      return JSON.stringify(layout);
    }
    return readFile(path.join(repoRoot, relativePath), "utf8");
  };

  for (const root of [removedRoot, modifiedRoot]) {
    await installSocrates({
      platform: "claude",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    });
  }

  await installSocrates(
    {
      platform: "claude",
      scope: "repo",
      targetRepo: removedRoot,
      sourceRoot: null,
    },
    { loadAsset: loadWithoutEvaluate }
  );
  await assertMissing(path.join(removedRoot, evaluateRelative));
  await assert.doesNotReject(() =>
    readFile(
      path.join(removedRoot, ".claude", "agents", "socrates-explore.md"),
      "utf8"
    )
  );

  const modified = path.join(modifiedRoot, evaluateRelative);
  await writeFile(modified, "user-modified agent\n", "utf8");
  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "claude",
          scope: "repo",
          targetRepo: modifiedRoot,
          sourceRoot: null,
        },
        { loadAsset: loadWithoutEvaluate }
      ),
    /modified managed agent/i
  );
  assert.equal(await readFile(modified, "utf8"), "user-modified agent\n");
});

test("global install creates canonical Codex state while updating a detected legacy copy", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-legacy-codex-home-"));
  const legacyDir = path.join(fakeHome, ".codex", "skills", "socrates-contract");
  await mkdir(legacyDir, { recursive: true });
  await writeFile(
    path.join(legacyDir, "SKILL.md"),
    "---\nname: socrates-contract\n---\nlegacy\n",
    "utf8"
  );

  await installSocrates({
    platform: "codex",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
  });

  await assert.doesNotReject(() =>
    readFile(path.join(legacyDir, INSTALL_MANIFEST_NAME), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(
      path.join(
        fakeHome,
        ".agents",
        "skills",
        "socrates-contract",
        INSTALL_MANIFEST_NAME
      ),
      "utf8"
    )
  );
});

test("legacy Codex compatibility manifests never remove canonical shared agents", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-legacy-agent-claims-"));
  const codexHome = path.join(fakeHome, "custom-codex-home");
  const options = {
    platform: "codex",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
    codexHome,
  };
  await installSocrates(options);
  const canonicalManifestPath = path.join(
    fakeHome,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const legacyManifestPath = path.join(
    codexHome,
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const canonicalManifest = JSON.parse(
    await readFile(canonicalManifestPath, "utf8")
  );
  const legacyManifest = JSON.parse(await readFile(legacyManifestPath, "utf8"));
  legacyManifest.assets.push(
    ...canonicalManifest.assets.filter((asset) => asset.ownership !== "skill")
  );
  await writeJson(legacyManifestPath, legacyManifest);

  await installSocrates(options);
  await assert.doesNotReject(() =>
    readFile(path.join(codexHome, "agents", "socrates-explore.toml"), "utf8")
  );
  const repairedLegacy = JSON.parse(await readFile(legacyManifestPath, "utf8"));
  assert.equal(
    repairedLegacy.assets.some((asset) => asset.ownership !== "skill"),
    false
  );
});

test("direct uninstall ignores historical agent claims in a legacy compatibility manifest", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-legacy-uninstall-claims-"));
  const codexHome = path.join(fakeHome, "custom-codex-home");
  const options = {
    platform: "codex",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
    codexHome,
  };
  await installSocrates(options);
  const canonicalManifestPath = path.join(
    fakeHome,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const legacyManifestPath = path.join(
    codexHome,
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const canonicalManifest = JSON.parse(
    await readFile(canonicalManifestPath, "utf8")
  );
  const legacyManifest = JSON.parse(await readFile(legacyManifestPath, "utf8"));
  legacyManifest.assets.push(
    ...canonicalManifest.assets.filter((asset) => asset.ownership !== "skill")
  );
  await writeJson(legacyManifestPath, legacyManifest);

  await uninstallSocrates({ ...options, mode: "uninstall" });
  await assertMissing(path.join(codexHome, "agents", "socrates-explore.toml"));
  await assertMissing(canonicalManifestPath);
  await assertMissing(legacyManifestPath);
});

test("uninstall preserves unlisted skill files and aborts on modified managed assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-ownership-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract"
  );
  const extra = path.join(skillDir, "user-note.md");
  const managed = path.join(skillDir, "SKILL.md");
  await writeFile(extra, "keep me\n", "utf8");
  await writeFile(managed, "modified\n", "utf8");

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /modified managed asset/i
  );
  assert.equal(await readFile(managed, "utf8"), "modified\n");
  assert.equal(await readFile(extra, "utf8"), "keep me\n");

  await writeFile(
    managed,
    await readFile(path.join(repoRoot, ASSET_PATH_FOR_CODEX_SKILL), "utf8"),
    "utf8"
  );
  await uninstallSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  assert.equal(await readFile(extra, "utf8"), "keep me\n");
  await assertMissing(managed);
});

test("forged manifests cannot claim arbitrary skill or shared-agent ownership", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-forged-manifest-"));
  await installSocrates({
    platform: "claude",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".claude", "skills", "socrates-contract");
  const manifestPath = path.join(skillDir, INSTALL_MANIFEST_NAME);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.assets.push({
    source: "malicious/project-file.md",
    target: "agents/socrates-explore.md",
    ownership: "shared-claude-agent",
    sha256: "0".repeat(64),
    bytes: 1,
  });
  await writeJson(manifestPath, manifest);

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "claude",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /manifest|source|duplicate/i
  );
  await assert.doesNotReject(() => readFile(manifestPath, "utf8"));
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "agents", "socrates-explore.md"), "utf8")
  );
});

test("uninstall rejects a forged conventional internal manifest entry", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-forged-internal-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const privateFile = path.join(skillDir, "references", "user-private.md");
  const contents = "user-owned private reference\n";
  await writeFile(privateFile, contents, "utf8");
  const manifestPath = path.join(skillDir, INSTALL_MANIFEST_NAME);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.assets.push({
    source: ".agents/skills/socrates-contract/references/user-private.md",
    target: "references/user-private.md",
    ownership: "skill",
    sha256: sha256(contents),
    bytes: Buffer.byteLength(contents, "utf8"),
  });
  await writeJson(manifestPath, manifest);

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /ownership ledger/i
  );
  assert.equal(await readFile(privateFile, "utf8"), contents);
});

test("manifestless legacy uninstall refuses recursive deletion", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-legacy-uninstall-"));
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    "---\nname: socrates-contract\n---\n",
    "utf8"
  );
  await writeFile(path.join(skillDir, "user-file.md"), "preserve\n", "utf8");

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /unverifiable legacy/i
  );
  assert.equal(
    await readFile(path.join(skillDir, "user-file.md"), "utf8"),
    "preserve\n"
  );
});

test("explicit CODEX_HOME adds a compatibility skill copy and controls the agent root", async () => {
  const fakeHome = await mkdtemp(path.join(tmpdir(), "socrates-codex-home-"));
  const codexHome = path.join(fakeHome, "custom-codex-home");
  await installSocrates({
    platform: "codex",
    scope: "global",
    sourceRoot: repoRoot,
    homeDir: fakeHome,
    codexHome,
  });

  await assert.doesNotReject(() =>
    readFile(
      path.join(codexHome, "skills", "socrates-contract", INSTALL_MANIFEST_NAME),
      "utf8"
    )
  );
  await assert.doesNotReject(() =>
    readFile(
      path.join(
        fakeHome,
        ".agents",
        "skills",
        "socrates-contract",
        INSTALL_MANIFEST_NAME
      ),
      "utf8"
    )
  );
  await assert.doesNotReject(() =>
    readFile(path.join(codexHome, "agents", "socrates-explore.toml"), "utf8")
  );
});

test("transient rename errors retry while EXDEV rolls back without copying", async () => {
  const retryRoot = await mkdtemp(path.join(tmpdir(), "socrates-rename-retry-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: retryRoot,
    sourceRoot: repoRoot,
  });
  let transientThrown = false;
  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: retryRoot,
      sourceRoot: repoRoot,
    },
    {
      loadAsset: loadChangedSkillAsset,
      rename: async (source, target) => {
        if (!transientThrown && source.includes(".stage-")) {
          transientThrown = true;
          const error = new Error("transient busy");
          error.code = "EBUSY";
          throw error;
        }
        return rename(source, target);
      },
    }
  );
  assert.equal(transientThrown, true);

  const exdevRoot = await mkdtemp(path.join(tmpdir(), "socrates-rename-exdev-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: exdevRoot,
    sourceRoot: repoRoot,
  });
  const manifestPath = path.join(
    exdevRoot,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const previous = await readFile(manifestPath, "utf8");
  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: exdevRoot,
          sourceRoot: repoRoot,
        },
        {
          loadAsset: loadChangedSkillAsset,
          rename: async (source, target) => {
            if (source.includes(".stage-")) {
              const error = new Error("cross-device rename");
              error.code = "EXDEV";
              throw error;
            }
            return rename(source, target);
          },
        }
      ),
    /cross-device rename/
  );
  assert.equal(await readFile(manifestPath, "utf8"), previous);
});

test("stale transaction journal restores a missing live installation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-journal-recovery-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const backup = path.join(
    path.dirname(skillDir),
    `.${path.basename(skillDir)}.backup-interrupted`
  );
  await rename(skillDir, backup);
  const stateDir = installerStateDir(root);
  await mkdir(stateDir, { recursive: true });
  await writeJson(path.join(stateDir, "install.lock"), {
    protocol: "socrates-contract",
    pid: 99999999,
    created_at: "2026-07-13T00:00:00.000Z",
  });
  await writeJson(path.join(stateDir, "transaction.json"), {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: [
      {
        target: skillDir,
        staged: null,
        type: "directory",
        backup,
        activated: false,
      },
    ],
    cleanup_roots: [],
  });

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  await assert.doesNotReject(() =>
    readFile(path.join(skillDir, INSTALL_MANIFEST_NAME), "utf8")
  );
  await assertMissing(backup);
  await assertMissing(path.join(stateDir, "transaction.json"));
});

test("platform-specific invocation recovers a shared journal from the other host", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cross-host-recovery-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const claudeSkillDir = path.join(root, ".claude", "skills", "socrates-contract");
  const backup = path.join(
    path.dirname(claudeSkillDir),
    `.${path.basename(claudeSkillDir)}.backup-cross-host`
  );
  await rename(claudeSkillDir, backup);
  const stateDir = installerStateDir(root);
  await mkdir(stateDir, { recursive: true });
  await writeJson(path.join(stateDir, "install.lock"), {
    protocol: "socrates-contract",
    pid: 99999999,
    created_at: "2026-07-13T00:00:00.000Z",
  });
  await writeJson(path.join(stateDir, "transaction.json"), {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: [
      {
        target: claudeSkillDir,
        staged: null,
        type: "directory",
        backup,
        activated: false,
      },
    ],
    cleanup_roots: [],
  });

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  await assert.doesNotReject(() =>
    readFile(path.join(claudeSkillDir, INSTALL_MANIFEST_NAME), "utf8")
  );
  await assertMissing(backup);
  await assertMissing(path.join(stateDir, "transaction.json"));
});

test("repository-controlled installer journals cannot claim agent ownership", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-forged-journal-"));
  const agentPath = path.join(root, ".codex", "agents", "socrates-explore.toml");
  const contents = "user-owned agent that a forged journal must not remove\n";
  await mkdir(path.dirname(agentPath), { recursive: true });
  await writeFile(agentPath, contents, "utf8");
  const forgedState = path.join(root, ".socrates", "installer");
  await mkdir(forgedState, { recursive: true });
  await writeJson(path.join(forgedState, "transaction.json"), {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: [
      {
        target: agentPath,
        staged: null,
        type: "file",
        backup: null,
        activated: true,
        replacement_fingerprint: `file:${sha256(contents)}`,
      },
    ],
    cleanup_roots: [],
  });

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /unowned Codex agent/i
  );
  assert.equal(await readFile(agentPath, "utf8"), contents);
  await assert.doesNotReject(() =>
    readFile(path.join(forgedState, "transaction.json"), "utf8")
  );
});

test("legacy journal intent never deletes an unverifiable post-swap target", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-journal-post-swap-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const backup = path.join(
    path.dirname(skillDir),
    `.${path.basename(skillDir)}.backup-post-swap`
  );
  const staged = path.join(
    path.dirname(skillDir),
    ".socrates-contract.stage-post-swap"
  );
  await rename(skillDir, backup);
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "partial.txt"), "new but uncommitted\n", "utf8");

  const stateDir = installerStateDir(root);
  await mkdir(stateDir, { recursive: true });
  await writeJson(path.join(stateDir, "install.lock"), {
    protocol: "socrates-contract",
    pid: 99999999,
    created_at: "2026-07-13T00:00:00.000Z",
  });
  await writeJson(path.join(stateDir, "transaction.json"), {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: [
      {
        target: skillDir,
        staged,
        type: "directory",
        backup,
        activated: true,
      },
    ],
    cleanup_roots: [staged],
  });

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /changed rollback target|unverifiable rollback target/i
  );
  assert.equal(
    await readFile(path.join(skillDir, "partial.txt"), "utf8"),
    "new but uncommitted\n"
  );
  await assert.doesNotReject(() =>
    readFile(path.join(backup, INSTALL_MANIFEST_NAME), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(stateDir, "transaction.json"), "utf8")
  );
});

test("post-commit cleanup residue is recoverable and does not report a false rollback", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cleanup-recovery-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const warnings = [];
  let failedCleanup = false;
  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    {
      loadAsset: loadChangedSkillAsset,
      rm: async (target, options) => {
        if (!failedCleanup && target.includes(".backup-")) {
          failedCleanup = true;
          throw new Error("injected backup cleanup failure");
        }
        const { rm } = await import("node:fs/promises");
        return rm(target, options);
      },
      onWarning: (warning) => warnings.push(warning),
    }
  );
  assert.equal(failedCleanup, true);
  assert.equal(warnings.some((warning) => /cleanup residue/i.test(warning)), true);
  const journalPath = path.join(installerStateDir(root), "transaction.json");
  await assert.doesNotReject(() => readFile(journalPath, "utf8"));

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    { loadAsset: loadChangedSkillAsset }
  );
  await assertMissing(journalPath);
});

test("installer CLI prints post-commit cleanup warnings once and in order", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-cleanup-warning-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const stdout = createOutputCapture();
  const stderr = createOutputCapture();

  const code = await runInstallerCli(repoCliArgs(root), {
    stateRoot: testInstallerStateRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    loadAsset: loadChangedSkillAsset,
    rm: async (target, options) => {
      const value = String(target);
      if (value.includes(".backup-")) {
        throw new Error("injected backup cleanup failure");
      }
      if (value.includes(".stage-") && options?.recursive === true) {
        throw new Error(`injected staging cleanup failure: ${value}`);
      }
      return rm(target, options);
    },
  });

  const warningOutput = stderr.text();
  const backupWarning = warningOutput.indexOf(
    "Warning: Socrates backup cleanup residue remains:"
  );
  const stagingWarning = warningOutput.indexOf(
    "Warning: Socrates cleanup residue remains:"
  );
  assert.equal(code, 0, stderr.text());
  assert.match(stdout.text(), /Installed Socrates to:/);
  assert.equal((warningOutput.match(/^Warning:/gmu) ?? []).length, 2);
  assert.ok(backupWarning >= 0);
  assert.ok(stagingWarning > backupWarning);
  assert.equal(
    await readFile(
      path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"),
      "utf8"
    ),
    await loadChangedSkillAsset(ASSET_PATH_FOR_CODEX_SKILL)
  );

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    { loadAsset: loadChangedSkillAsset }
  );
  await assertMissing(installerPaths(root).journalPath);
});

test("installer CLI warns instead of failing when committed journal removal is deferred", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-journal-warning-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const paths = installerPaths(root);
  const stdout = createOutputCapture();
  const stderr = createOutputCapture();
  let injected = false;

  const code = await runInstallerCli(repoCliArgs(root), {
    stateRoot: testInstallerStateRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    loadAsset: loadChangedSkillAsset,
    rm: async (target, options) => {
      if (!injected && target === paths.journalPath) {
        injected = true;
        throw new Error("injected committed journal cleanup failure");
      }
      return rm(target, options);
    },
  });

  assert.equal(code, 0);
  assert.equal(injected, true);
  assert.match(stdout.text(), /Installed Socrates to:/);
  assert.match(
    stderr.text(),
    /Warning: Committed Socrates transaction cleanup is deferred because its journal remains/i
  );
  assert.equal((stderr.text().match(/^Warning:/gmu) ?? []).length, 1);
  await assert.doesNotReject(() => readFile(paths.journalPath, "utf8"));
  assert.equal(
    await readFile(
      path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"),
      "utf8"
    ),
    await loadChangedSkillAsset(ASSET_PATH_FOR_CODEX_SKILL)
  );

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    { loadAsset: loadChangedSkillAsset }
  );
  await assertMissing(paths.journalPath);
});

test("installer CLI warns instead of reversing a commit when the final journal probe fails", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-journal-probe-"));
  const paths = installerPaths(root);
  const stdout = createOutputCapture();
  const stderr = createOutputCapture();
  let journalRemoved = false;
  let probeFailed = false;

  const code = await runInstallerCli(repoCliArgs(root), {
    stateRoot: testInstallerStateRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    rm: async (target, options) => {
      const result = await rm(target, options);
      if (target === paths.journalPath) journalRemoved = true;
      return result;
    },
    lstat: async (target) => {
      if (journalRemoved && !probeFailed && target === paths.journalPath) {
        probeFailed = true;
        throw new Error("injected post-commit journal probe failure");
      }
      return lstat(target);
    },
  });

  assert.equal(code, 0);
  assert.equal(journalRemoved, true);
  assert.equal(probeFailed, true);
  assert.match(stdout.text(), /Installed Socrates to:/);
  assert.match(
    stderr.text(),
    /^Warning: Could not inspect the Socrates transaction journal;.*injected post-commit journal probe failure\n$/su
  );
  await assert.doesNotReject(() =>
    readFile(
      path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"),
      "utf8"
    )
  );
});

test("installer CLI warns and preserves a lock replaced after commit", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-lock-replaced-"));
  const paths = installerPaths(root);
  const stdout = createOutputCapture();
  const stderr = createOutputCapture();
  const replacement = `${JSON.stringify({
    protocol: "socrates-contract",
    pid: process.pid,
    token: "replacement-owner",
    created_at: "2026-07-13T00:00:00.000Z",
  })}\n`;
  let replaced = false;

  const code = await runInstallerCli(repoCliArgs(root), {
    stateRoot: testInstallerStateRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    rm: async (target, options) => {
      const result = await rm(target, options);
      if (!replaced && target === paths.journalPath) {
        replaced = true;
        await writeFile(paths.lockPath, replacement, "utf8");
      }
      return result;
    },
  });

  assert.equal(code, 0);
  assert.equal(replaced, true);
  assert.match(stdout.text(), /Installed Socrates to:/);
  assert.match(stderr.text(), /^Warning: Installer lock was replaced;/u);
  assert.equal((stderr.text().match(/^Warning:/gmu) ?? []).length, 1);
  assert.equal(await readFile(paths.lockPath, "utf8"), replacement);
  await rm(paths.lockPath);
});

test("local source inference only applies to direct complete-repository execution", async () => {
  assert.equal(inferLocalSourceRoot(), null);

  const root = await mkdtemp(path.join(tmpdir(), "socrates-inferred-local-"));
  const result = await runNodeCli(
    path.join(repoRoot, "scripts", "install.mjs"),
    [
      "--platform",
      "codex",
      "--scope",
      "repo",
      "--target-repo",
      root,
    ],
    repoRoot,
    { ...process.env, SOCRATES_INSTALLER_STATE_ROOT: testInstallerStateRoot }
  );
  assert.equal(result.code, 0, result.stderr);
  await assert.doesNotReject(() =>
    readFile(
      path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"),
      "utf8"
    )
  );
});

test("installer rejects managed-path symlinks and dangling symlinks", async () => {
  const cases = [
    { name: ".agents", platform: "codex" },
    { name: ".codex", platform: "codex" },
    { name: ".claude", platform: "claude" },
  ];

  for (const fixture of cases) {
    const root = await mkdtemp(path.join(tmpdir(), `socrates-symlink-${fixture.name.slice(1)}-`));
    const outside = await mkdtemp(path.join(tmpdir(), "socrates-symlink-outside-"));
    await symlink(outside, path.join(root, fixture.name), "dir");
    await assert.rejects(
      () =>
        installSocrates({
          platform: fixture.platform,
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        }),
      /symbolic link/i
    );
    assert.deepEqual(await readdir(outside), []);
  }

  const danglingRoot = await mkdtemp(path.join(tmpdir(), "socrates-dangling-symlink-"));
  const missingDestination = path.join(danglingRoot, "missing-destination");
  await symlink(missingDestination, path.join(danglingRoot, ".agents"), "dir");
  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: danglingRoot,
        sourceRoot: repoRoot,
      }),
    /symbolic link/i
  );
  await assertMissing(missingDestination);
});

test("uninstall refuses a symlinked managed tree without deleting its destination", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-symlink-"));
  const outside = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-outside-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const relocated = path.join(outside, "agents-tree");
  await rename(path.join(root, ".agents"), relocated);
  await symlink(relocated, path.join(root, ".agents"), "dir");

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /symbolic link/i
  );
  await assert.doesNotReject(() =>
    readFile(
      path.join(relocated, "skills", "socrates-contract", "SKILL.md"),
      "utf8"
    )
  );
});

test("installer rejects a symlinked ownership manifest even on an otherwise current install", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-manifest-symlink-"));
  const outside = await mkdtemp(path.join(tmpdir(), "socrates-manifest-outside-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const manifestPath = path.join(
    root,
    ".agents",
    "skills",
    "socrates-contract",
    INSTALL_MANIFEST_NAME
  );
  const outsideManifest = path.join(outside, INSTALL_MANIFEST_NAME);
  await rename(manifestPath, outsideManifest);
  await symlink(outsideManifest, manifestPath);

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /symbolic link/i
  );
  await assert.doesNotReject(() => readFile(outsideManifest, "utf8"));
});

test("partial rollback recovery does not delete units already restored", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-partial-rollback-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const codexSkillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const claudeSkillDir = path.join(root, ".claude", "skills", "socrates-contract");
  const sentinel = path.join(claudeSkillDir, "user-sentinel.md");
  await writeFile(sentinel, "preserve after partial rollback\n", "utf8");
  let activationFailed = false;
  let restoreFailed = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "both",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          loadAsset: loadChangedSkillAsset,
          rename: async (source, target) => {
            if (
              !activationFailed &&
              source.includes(".socrates-contract.stage-") &&
              target === claudeSkillDir
            ) {
              activationFailed = true;
              throw new Error("injected late activation failure");
            }
            if (
              activationFailed &&
              !restoreFailed &&
              source.includes(".backup-") &&
              target === codexSkillDir
            ) {
              restoreFailed = true;
              throw new Error("injected partial restore failure");
            }
            return rename(source, target);
          },
        }
      ),
    /rollback failure/i
  );
  assert.equal(await readFile(sentinel, "utf8"), "preserve after partial rollback\n");
  const journalPath = path.join(installerStateDir(root), "transaction.json");
  await assert.doesNotReject(() => readFile(journalPath, "utf8"));

  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  assert.equal(await readFile(sentinel, "utf8"), "preserve after partial rollback\n");
  await assertMissing(journalPath);
});

test("failed committed-journal persistence never cleans rollback backups", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-commit-journal-failure-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const originalSkill = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
  let committedWriteFailed = false;
  let restoreFailed = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          loadAsset: loadChangedSkillAsset,
          writeFile: async (target, contents, options) => {
            if (
              !committedWriteFailed &&
              String(target).includes("transaction.json.tmp-") &&
              JSON.parse(String(contents)).status === "committed"
            ) {
              committedWriteFailed = true;
              throw new Error("injected committed journal write failure");
            }
            return writeFile(target, contents, options);
          },
          rename: async (source, target) => {
            if (
              committedWriteFailed &&
              !restoreFailed &&
              source.includes(".backup-") &&
              target === skillDir
            ) {
              restoreFailed = true;
              throw new Error("injected restore after commit failure");
            }
            return rename(source, target);
          },
        }
      ),
    /rollback failure/i
  );

  const journalPath = path.join(installerStateDir(root), "transaction.json");
  await assert.doesNotReject(() => readFile(journalPath, "utf8"));
  assert.equal(
    (await readdir(path.dirname(skillDir))).some((name) => name.includes(".backup-")),
    true
  );
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  assert.equal(await readFile(path.join(skillDir, "SKILL.md"), "utf8"), originalSkill);
  await assertMissing(journalPath);
});

test("a previous journal slot is restored before transaction recovery", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-previous-journal-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const backup = path.join(path.dirname(skillDir), ".socrates-contract.backup-previous-slot");
  await rename(skillDir, backup);
  const stateDir = installerStateDir(root);
  await mkdir(stateDir, { recursive: true });
  const previousJournal = path.join(stateDir, "transaction.json.previous");
  await writeJson(previousJournal, {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: [
      {
        target: skillDir,
        staged: null,
        type: "directory",
        backup,
        activated: false,
      },
    ],
    cleanup_roots: [],
  });

  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  await assert.doesNotReject(() =>
    readFile(path.join(skillDir, INSTALL_MANIFEST_NAME), "utf8")
  );
  await assertMissing(previousJournal);
});

test("a replacement installer lock survives stale-lock takeover", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-lock-replacement-"));
  const stateDir = installerStateDir(root);
  const lockPath = path.join(stateDir, "install.lock");
  await writeJson(lockPath, {
    protocol: "socrates-contract",
    pid: 99999999,
    token: "stale-token",
    created_at: "2026-07-13T00:00:00.000Z",
  });
  const replacement = {
    protocol: "socrates-contract",
    pid: process.pid,
    token: "replacement-owner-token",
    created_at: "2026-07-13T00:00:01.000Z",
  };
  let injected = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          rename: async (source, target) => {
            if (!injected && source === lockPath && target.includes(".stale-")) {
              injected = true;
              await rename(source, target);
              await writeJson(lockPath, replacement);
              return;
            }
            return rename(source, target);
          },
        }
      ),
    /another Socrates installer is active/i
  );
  assert.equal(JSON.parse(await readFile(lockPath, "utf8")).token, replacement.token);
});

test("release never deletes a lock that replaced the acquired owner", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-lock-release-"));
  const lockPath = path.join(installerStateDir(root), "install.lock");
  const replacement = {
    protocol: "socrates-contract",
    pid: process.pid,
    token: "replacement-during-transaction",
    created_at: "2026-07-13T00:00:02.000Z",
  };
  let injected = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          writeFile: async (target, contents, options) => {
            if (!injected && String(target).includes("transaction.json.tmp-")) {
              injected = true;
              await rm(lockPath, { force: true });
              await writeJson(lockPath, replacement);
            }
            return writeFile(target, contents, options);
          },
        }
      ),
    /lock ownership was lost|rollback failure/i
  );
  assert.equal(JSON.parse(await readFile(lockPath, "utf8")).token, replacement.token);
});

test("persistent committed cleanup residue blocks a new transaction", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-persistent-cleanup-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  let firstFailure = false;
  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    {
      loadAsset: loadChangedSkillAsset,
      rm: async (target, options) => {
        if (!firstFailure && target.includes(".backup-")) {
          firstFailure = true;
          throw new Error("injected initial cleanup residue");
        }
        return rm(target, options);
      },
    }
  );
  let stages = 0;
  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          loadAsset: loadChangedSkillAsset,
          mkdtemp: async (...args) => {
            stages += 1;
            return mkdtemp(...args);
          },
          rm: async (target, options) => {
            if (target.includes(".backup-")) {
              throw new Error("injected persistent cleanup failure");
            }
            return rm(target, options);
          },
        }
      ),
    /cannot finish cleanup/i
  );
  assert.equal(stages, 0);
  await assert.doesNotReject(() =>
    readFile(path.join(installerStateDir(root), "transaction.json"), "utf8")
  );

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    { loadAsset: loadChangedSkillAsset }
  );
});

test("Windows-style journal replacement keeps a recoverable previous slot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-windows-journal-"));
  const journalPath = path.join(installerStateDir(root), "transaction.json");
  let injected = false;

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    {
      rename: async (source, target) => {
        if (
          !injected &&
          source.includes("transaction.json.tmp-") &&
          target === journalPath
        ) {
          try {
            await access(journalPath);
            injected = true;
            const error = new Error("injected Windows replacement restriction");
            error.code = "EPERM";
            throw error;
          } catch (error) {
            if (error && typeof error === "object" && error.code === "ENOENT") {
              return rename(source, target);
            }
            throw error;
          }
        }
        return rename(source, target);
      },
    }
  );
  assert.equal(injected, true);
  await assertMissing(`${journalPath}.previous`);
});

test("committed Windows journal residue never rolls back a durable mixed-asset update", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-windows-commit-residue-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const journalPath = path.join(installerStateDir(root), "transaction.json");
  const previousPath = `${journalPath}.previous`;
  const skillPath = path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md");
  const agentPath = path.join(root, ".codex", "agents", "socrates-verify.toml");
  const expectedSkill = await loadChangedSkillAndAgentAsset(
    ".agents/skills/socrates-contract/SKILL.md"
  );
  const expectedAgent = await loadChangedSkillAndAgentAsset(
    ".codex/agents/socrates-verify.toml"
  );
  const warnings = [];
  let blockedPreviousCleanup = 0;

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    {
      loadAsset: loadChangedSkillAndAgentAsset,
      rename: async (source, target) => {
        if (source.includes("transaction.json.tmp-") && target === journalPath) {
          try {
            await access(journalPath);
            const error = new Error("simulated Windows journal replacement");
            error.code = "EPERM";
            throw error;
          } catch (error) {
            if (error && typeof error === "object" && error.code === "ENOENT") {
              return rename(source, target);
            }
            throw error;
          }
        }
        return rename(source, target);
      },
      rm: async (target, options) => {
        if (target === previousPath) {
          try {
            const current = JSON.parse(await readFile(journalPath, "utf8"));
            if (current.status === "committed") {
              blockedPreviousCleanup += 1;
              const error = new Error("simulated AV lock on previous journal");
              error.code = "EACCES";
              throw error;
            }
          } catch (error) {
            if (!error || typeof error !== "object" || error.code !== "ENOENT") {
              throw error;
            }
          }
        }
        return rm(target, options);
      },
      onWarning: (warning) => warnings.push(warning),
    }
  );

  assert.ok(blockedPreviousCleanup >= 2);
  assert.equal(warnings.some((warning) => /previous journal slot|previous slot/i.test(warning)), true);
  assert.equal(await readFile(skillPath, "utf8"), expectedSkill);
  assert.equal(await readFile(agentPath, "utf8"), expectedAgent);
  await assert.doesNotReject(() => readFile(journalPath, "utf8"));
  await assert.doesNotReject(() => readFile(previousPath, "utf8"));
  assert.equal(
    (await readdir(path.dirname(path.dirname(skillPath)))).some((name) =>
      name.includes(".backup-")
    ),
    true
  );

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    { loadAsset: loadChangedSkillAndAgentAsset }
  );
  assert.equal(await readFile(skillPath, "utf8"), expectedSkill);
  assert.equal(await readFile(agentPath, "utf8"), expectedAgent);
  await assertMissing(journalPath);
  await assertMissing(previousPath);
});

test("recovery preserves both journal slots when the current slot is malformed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-malformed-current-journal-"));
  const stateDir = installerStateDir(root);
  const journalPath = path.join(stateDir, "transaction.json");
  const previousPath = `${journalPath}.previous`;
  await mkdir(stateDir, { recursive: true });
  await writeFile(journalPath, "{ malformed\n", "utf8");
  await writeJson(previousPath, {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: [],
    cleanup_roots: [],
  });

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /current slot is malformed/i
  );
  assert.equal(await readFile(journalPath, "utf8"), "{ malformed\n");
  await assert.doesNotReject(() => readFile(previousPath, "utf8"));
});

test("recovery validates all current journal fields before discarding the previous slot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-invalid-current-journal-"));
  const stateDir = installerStateDir(root);
  const journalPath = path.join(stateDir, "transaction.json");
  const previousPath = `${journalPath}.previous`;
  await mkdir(stateDir, { recursive: true });
  await writeJson(journalPath, {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: "not-an-array",
    cleanup_roots: [],
  });
  await writeJson(previousPath, {
    protocol: "socrates-contract",
    schema_version: 1,
    status: "activating",
    units: [],
    cleanup_roots: [],
  });

  await assert.rejects(
    () =>
      installSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /current slot is invalid/i
  );
  await assert.doesNotReject(() => readFile(journalPath, "utf8"));
  await assert.doesNotReject(() => readFile(previousPath, "utf8"));
});

test("install fingerprints preserve an agent created after ownership preflight", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-race-"));
  const racedAgent = path.join(root, ".codex", "agents", "socrates-explore.toml");
  let injected = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          writeFile: async (target, contents, options) => {
            if (!injected && String(target).includes("transaction.json.tmp-")) {
              injected = true;
              await writeFile(racedAgent, "user-created during install\n", "utf8");
            }
            return writeFile(target, contents, options);
          },
        }
      ),
    /changed during the transaction/i
  );
  assert.equal(await readFile(racedAgent, "utf8"), "user-created during install\n");
  await assertMissing(
    path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md")
  );
});

test("backup capture restores content changed in the final pre-rename window", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-backup-race-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const agentPath = path.join(root, ".codex", "agents", "socrates-explore.toml");
  const racedContents = "USER DATA ARRIVED IN THE FINAL BACKUP WINDOW\n";
  let injected = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          loadAsset: loadChangedSkillAsset,
          rename: async (source, target) => {
            if (!injected && source === agentPath && target.includes(".backup-")) {
              injected = true;
              await writeFile(source, racedContents, "utf8");
            }
            return rename(source, target);
          },
        }
      ),
    /changed during backup/i
  );
  assert.equal(await readFile(agentPath, "utf8"), racedContents);
});

test("no-replace publication preserves a file created in the final activation window", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-publish-race-"));
  const agentPath = path.join(root, ".codex", "agents", "socrates-explore.toml");
  const racedContents = "USER DATA ARRIVED BEFORE NO-REPLACE PUBLICATION\n";
  let injected = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          link: async (source, target) => {
            if (!injected && target === agentPath) {
              injected = true;
              await writeFile(target, racedContents, "utf8");
            }
            return link(source, target);
          },
        }
      ),
    /appeared during activation/i
  );
  assert.equal(await readFile(agentPath, "utf8"), racedContents);
});

test("Windows directory publication succeeds without a POSIX reservation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-windows-publish-"));
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  let published = 0;

  await installSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    {
      platform: "win32",
      rename: async (source, target) => {
        if (source.includes(".stage-") && target === skillDir) {
          published += 1;
          await assertMissing(target);
        }
        return rename(source, target);
      },
    }
  );

  assert.equal(published, 1);
  await assert.doesNotReject(() =>
    readFile(path.join(skillDir, INSTALL_MANIFEST_NAME), "utf8")
  );
});

test("Windows directory publication preserves a target that appears in the final window", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-windows-publish-race-"));
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const sentinel = path.join(skillDir, "user-created.txt");
  let injected = false;

  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          platform: "win32",
          rename: async (source, target) => {
            if (!injected && source.includes(".stage-") && target === skillDir) {
              injected = true;
              await mkdir(target, { recursive: true });
              await writeFile(sentinel, "created during publication\n", "utf8");
              const error = new Error("simulated Windows no-replace failure");
              error.code = "EEXIST";
              throw error;
            }
            return rename(source, target);
          },
        }
      ),
    /appeared during activation/i
  );
  assert.equal(await readFile(sentinel, "utf8"), "created during publication\n");
});

test("uninstall fingerprints preserve a managed file changed after verification", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-race-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillPath = path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md");
  let injected = false;

  await assert.rejects(
    () =>
      uninstallSocrates(
        {
          platform: "codex",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
        },
        {
          writeFile: async (target, contents, options) => {
            if (!injected && String(target).includes("transaction.json.tmp-")) {
              injected = true;
              await writeFile(skillPath, "changed during uninstall\n", "utf8");
            }
            return writeFile(target, contents, options);
          },
        }
      ),
    /changed during the transaction/i
  );
  assert.equal(await readFile(skillPath, "utf8"), "changed during uninstall\n");
});

test("uninstall authenticates shared agents against packaged assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-auth-"));
  await installSocrates({
    platform: "claude",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".claude", "skills", "socrates-contract");
  const manifestPath = path.join(skillDir, INSTALL_MANIFEST_NAME);
  const agentPath = path.join(root, ".claude", "agents", "socrates-explore.md");
  const forgedContents = "user-owned but forged into a known manifest entry\n";
  await writeFile(agentPath, forgedContents, "utf8");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entry = manifest.assets.find(
    (asset) => asset.target === "agents/socrates-explore.md"
  );
  entry.sha256 = sha256(forgedContents);
  entry.bytes = Buffer.byteLength(forgedContents, "utf8");
  await writeJson(manifestPath, manifest);

  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "claude",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /ownership ledger|unauthenticated shared agent/i
  );
  assert.equal(await readFile(agentPath, "utf8"), forgedContents);
});

test("atomic directory pruning preserves a concurrently added file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-prune-race-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const racedNote = path.join(skillDir, "raced-note.md");
  let injected = false;

  await uninstallSocrates(
    {
      platform: "codex",
      scope: "repo",
      targetRepo: root,
      sourceRoot: repoRoot,
    },
    {
      rmdir: async (target) => {
        if (!injected && target === skillDir) {
          injected = true;
          await writeFile(racedNote, "created before atomic rmdir\n", "utf8");
        }
        return rmdir(target);
      },
    }
  );
  assert.equal(await readFile(racedNote, "utf8"), "created before atomic rmdir\n");
});

test("installer CLI reports uninstall directory cleanup residue without false failure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-prune-warning-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, ".agents", "skills", "socrates-contract");
  const stdout = createOutputCapture();
  const stderr = createOutputCapture();
  let injected = false;

  const code = await runInstallerCli(repoCliArgs(root, "uninstall"), {
    stateRoot: testInstallerStateRoot,
    stdout: stdout.stream,
    stderr: stderr.stream,
    rmdir: async (target) => {
      if (!injected && target === skillDir) {
        injected = true;
        const error = new Error("injected empty-directory cleanup failure");
        error.code = "EACCES";
        throw error;
      }
      return rmdir(target);
    },
  });

  assert.equal(code, 0);
  assert.equal(injected, true);
  assert.match(stdout.text(), /Removed Socrates from:/);
  assert.match(
    stderr.text(),
    /Warning: Socrates empty-directory cleanup residue remains:/i
  );
  assert.equal((stderr.text().match(/^Warning:/gmu) ?? []).length, 1);
  await assertMissing(path.join(skillDir, "SKILL.md"));
  await assert.doesNotReject(() => access(skillDir));
});
