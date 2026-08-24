import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rmdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  DEFAULT_VERSION,
  INSTALL_MANIFEST_NAME,
  inferLocalSourceRoot,
  installSocrates as installSocratesImpl,
  installerStatePaths,
  parseArgs,
  runCli as runInstallerCli,
  uninstallSocrates as uninstallSocratesImpl,
  validateSkillLayout,
} from "../scripts/install.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testInstallerStateRoot = await mkdtemp(
  path.join(tmpdir(), "socrates-installer-test-state-")
);
const codexSkillRelative = path.join(".agents", "skills", "socrates");
const claudeSkillRelative = path.join(".claude", "skills", "socrates");

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
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function loadChangedSkillAsset(relativePath) {
  const contents = await readFile(path.join(repoRoot, relativePath), "utf8");
  return relativePath.endsWith("/SKILL.md")
    ? `${contents}\n<!-- changed fixture -->\n`
    : contents;
}

async function loadExdevSkillAsset(relativePath) {
  const contents = await readFile(path.join(repoRoot, relativePath), "utf8");
  return relativePath.endsWith("/SKILL.md")
    ? `${contents}\n<!-- EXDEV fixture -->\n`
    : contents;
}

test("parseArgs accepts the recommended install shape and v1 default", () => {
  const parsed = parseArgs([
    "--platform",
    "both",
    "--scope",
    "repo",
    "--target-repo",
    "/tmp/example",
  ]);
  assert.equal(parsed.platform, "both");
  assert.equal(parsed.scope, "repo");
  assert.equal(parsed.targetRepo, "/tmp/example");
  assert.equal(parsed.version, DEFAULT_VERSION);
  assert.equal(DEFAULT_VERSION, "v1.0.0");
});

test("parseArgs and layout validation reject invalid input", () => {
  assert.throws(() => parseArgs(["--platform", "nope"]), /--platform must be one of/);
  assert.throws(() => parseArgs(["--scope", "repo"]), /--target-repo is required/);
  assert.throws(() => parseArgs(["--mode", "destroy"]), /--mode must be one of/);
  for (const layout of [
    {
      skillReferences: ["../escape.md"],
      skillScripts: [],
      codexAgents: [],
      claudeAgents: [],
    },
    {
      skillReferences: ["one.md", "ONE.md"],
      skillScripts: [],
      codexAgents: [],
      claudeAgents: [],
    },
  ]) {
    assert.throws(() => validateSkillLayout(layout), /invalid|duplicate/i);
  }
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
    assert.equal(paths.stateRoot, path.join(fakeHome, ".socrates", "installer"));

    const insecureRoot = await mkdtemp(path.join(tmpdir(), "socrates-insecure-state-"));
    await chmod(insecureRoot, 0o755);
    await assert.rejects(
      () =>
        installSocrates(
          { platform: "codex", scope: "repo", targetRepo, sourceRoot: repoRoot },
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

  for (const relative of [codexSkillRelative, claudeSkillRelative]) {
    const skill = await readFile(path.join(root, relative, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: socrates\n/u);
    await assert.doesNotReject(() =>
      readFile(path.join(root, relative, "references", "audience-calibration.md"), "utf8")
    );
    await assert.doesNotReject(() =>
      readFile(path.join(root, relative, "references", "guided-learning.md"), "utf8")
    );
    await assertMissing(path.join(root, relative, "scripts"));
  }
  await assert.doesNotReject(() =>
    readFile(path.join(root, codexSkillRelative, "agents", "openai.yaml"), "utf8")
  );
  await assertMissing(path.join(root, ".codex", "agents"));
  await assertMissing(path.join(root, ".claude", "agents"));
  await assertMissing(path.join(root, ".agents", "skills", "socrates-contract"));
  await assertMissing(path.join(root, ".claude", "skills", "socrates-contract"));
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
    readFile(path.join(fakeHome, ".agents", "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(fakeHome, ".claude", "skills", "socrates", "SKILL.md"), "utf8")
  );
});

test("explicit CODEX_HOME receives a compatibility copy without native agents", async () => {
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
    readFile(path.join(fakeHome, ".agents", "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(codexHome, "skills", "socrates", "SKILL.md"), "utf8")
  );
  await assertMissing(path.join(codexHome, "agents"));
});

test("install starts from a clean skill directory and preserves siblings", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-install-clean-dir-"));
  const stale = path.join(root, codexSkillRelative, "references", "removed.md");
  const sibling = path.join(root, ".agents", "skills", "user-skill", "SKILL.md");
  await mkdir(path.dirname(stale), { recursive: true });
  await mkdir(path.dirname(sibling), { recursive: true });
  await writeFile(stale, "stale\n", "utf8");
  await writeFile(sibling, "user-owned\n", "utf8");
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  await assertMissing(stale);
  assert.equal(await readFile(sibling, "utf8"), "user-owned\n");
});

test("uninstall removes managed skills and keeps unrelated config", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const settings = path.join(root, ".claude", "settings.json");
  await writeJson(settings, { permissions: { allow: ["Bash(echo *)"] } });
  await uninstallSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  await assertMissing(path.join(root, codexSkillRelative, "SKILL.md"));
  await assertMissing(path.join(root, claudeSkillRelative, "SKILL.md"));
  assert.deepEqual(JSON.parse(await readFile(settings, "utf8")), {
    permissions: { allow: ["Bash(echo *)"] },
  });
});

test("uninstall refuses modified managed assets and preserves them", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-modified-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillPath = path.join(root, codexSkillRelative, "SKILL.md");
  await writeFile(skillPath, "user modified\n", "utf8");
  await assert.rejects(
    () =>
      uninstallSocrates({
        platform: "codex",
        scope: "repo",
        targetRepo: root,
        sourceRoot: repoRoot,
      }),
    /modified|mismatch|refus|fingerprint/i
  );
  assert.equal(await readFile(skillPath, "utf8"), "user modified\n");
});

test("installer CLI can install from the complete local source", async () => {
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
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Installed Socrates to:/);
  await assert.doesNotReject(() =>
    readFile(path.join(root, codexSkillRelative, "SKILL.md"), "utf8")
  );
});

test("explicit local source never falls back to missing assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-incomplete-target-"));
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "socrates-incomplete-source-"));
  await writeJson(path.join(sourceRoot, "reference", "skill-layout.json"), {
    skillReferences: ["missing.md"],
    skillScripts: [],
    codexAgents: [],
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
  await assertMissing(path.join(root, codexSkillRelative));
});

test("activation failure restores both previous platform installations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-activation-rollback-"));
  await installSocrates({
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const codexSkill = path.join(root, codexSkillRelative, "SKILL.md");
  const claudeSkill = path.join(root, claudeSkillRelative, "SKILL.md");
  const [previousCodex, previousClaude] = await Promise.all([
    readFile(codexSkill, "utf8"),
    readFile(claudeSkill, "utf8"),
  ]);
  let injected = false;
  await assert.rejects(
    () =>
      installSocrates(
        {
          platform: "both",
          scope: "repo",
          targetRepo: root,
          sourceRoot: repoRoot,
          version: "v1.0.1-test",
        },
        {
          loadAsset: loadChangedSkillAsset,
          rename: async (source, target) => {
            if (
              !injected &&
              source.includes(".stage-") &&
              target.includes(claudeSkillRelative)
            ) {
              injected = true;
              throw new Error("injected activation failure");
            }
            return rename(source, target);
          },
        }
      ),
    /injected activation failure/
  );
  assert.equal(await readFile(codexSkill, "utf8"), previousCodex);
  assert.equal(await readFile(claudeSkill, "utf8"), previousClaude);
});

test("ownership-ledger publication failure rolls back the update", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-ledger-rollback-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const paths = installerPaths(root);
  const skillPath = path.join(root, codexSkillRelative, "SKILL.md");
  const [previousSkill, previousLedger] = await Promise.all([
    readFile(skillPath, "utf8"),
    readFile(paths.ledgerPath, "utf8"),
  ]);
  await assert.rejects(
    () =>
      installSocrates(
        { platform: "codex", scope: "repo", targetRepo: root, sourceRoot: repoRoot },
        {
          loadAsset: loadChangedSkillAsset,
          link: async (source, target) => {
            if (target === paths.ledgerPath) {
              throw new Error("injected ownership ledger failure");
            }
            return link(source, target);
          },
        }
      ),
    /injected ownership ledger failure/i
  );
  assert.equal(await readFile(skillPath, "utf8"), previousSkill);
  assert.equal(await readFile(paths.ledgerPath, "utf8"), previousLedger);
  await assertMissing(paths.journalPath);
});

test("repeated install is byte-idempotent and writes a complete v1 manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-idempotent-"));
  const options = {
    platform: "both",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  };
  await installSocrates(options);
  const manifestPath = path.join(root, codexSkillRelative, INSTALL_MANIFEST_NAME);
  const first = await readFile(manifestPath, "utf8");
  await installSocrates(options);
  const second = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(second);
  assert.equal(second, first);
  assert.equal(manifest.protocol, "socrates");
  assert.equal(manifest.protocol_version, "1.0.0");
  assert.match(manifest.source_ref, /^local:/u);
  assert.ok(manifest.assets.some((asset) => asset.target === "SKILL.md"));
  assert.ok(
    manifest.assets.some(
      (asset) => asset.target === "references/guided-learning.md"
    )
  );
  assert.equal(manifest.assets.some((asset) => asset.target.startsWith("scripts/")), false);
  assert.equal(second.includes(root), false);
});

test("transient rename retries while EXDEV rolls back without copying", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-rename-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  let transientThrown = false;
  await installSocrates(
    { platform: "codex", scope: "repo", targetRepo: root, sourceRoot: repoRoot },
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
  const before = await readFile(path.join(root, codexSkillRelative, "SKILL.md"), "utf8");
  await assert.rejects(
    () =>
      installSocrates(
        { platform: "codex", scope: "repo", targetRepo: root, sourceRoot: repoRoot },
        {
          loadAsset: loadExdevSkillAsset,
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
  assert.equal(await readFile(path.join(root, codexSkillRelative, "SKILL.md"), "utf8"), before);
});

test("stale journal restores a missing live installation before continuing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-journal-recovery-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, codexSkillRelative);
  const backup = path.join(path.dirname(skillDir), ".socrates.backup-interrupted");
  await rename(skillDir, backup);
  const paths = installerPaths(root);
  await mkdir(paths.stateDir, { recursive: true });
  await writeJson(paths.lockPath, {
    protocol: "socrates",
    pid: 99999999,
    created_at: "2026-08-24T00:00:00.000Z",
  });
  await writeJson(paths.journalPath, {
    protocol: "socrates",
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
  await assert.doesNotReject(() => readFile(path.join(skillDir, "SKILL.md"), "utf8"));
  await assertMissing(backup);
  await assertMissing(paths.journalPath);
});

test("installer rejects managed-path and manifest symlinks", async () => {
  for (const [name, platform] of [[".agents", "codex"], [".claude", "claude"]]) {
    const root = await mkdtemp(path.join(tmpdir(), "socrates-symlink-root-"));
    const outside = await mkdtemp(path.join(tmpdir(), "socrates-symlink-outside-"));
    await symlink(outside, path.join(root, name), "dir");
    await assert.rejects(
      () =>
        installSocrates({ platform, scope: "repo", targetRepo: root, sourceRoot: repoRoot }),
      /symbolic link/i
    );
    assert.deepEqual(await readdir(outside), []);
  }

  const root = await mkdtemp(path.join(tmpdir(), "socrates-manifest-link-"));
  const outside = await mkdtemp(path.join(tmpdir(), "socrates-manifest-outside-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const manifest = path.join(root, codexSkillRelative, INSTALL_MANIFEST_NAME);
  const moved = path.join(outside, INSTALL_MANIFEST_NAME);
  await rename(manifest, moved);
  await symlink(moved, manifest);
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
  await assert.doesNotReject(() => readFile(moved, "utf8"));
});

test("uninstall fingerprints preserve a managed file changed after verification", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-uninstall-race-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillPath = path.join(root, codexSkillRelative, "SKILL.md");
  let injected = false;
  await assert.rejects(
    () =>
      uninstallSocrates(
        { platform: "codex", scope: "repo", targetRepo: root, sourceRoot: repoRoot },
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

test("atomic directory pruning preserves a concurrently added file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-prune-race-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, codexSkillRelative);
  const racedNote = path.join(skillDir, "raced-note.md");
  let injected = false;
  await uninstallSocrates(
    { platform: "codex", scope: "repo", targetRepo: root, sourceRoot: repoRoot },
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

test("installer CLI reports cleanup residue without false failure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-cli-prune-warning-"));
  await installSocrates({
    platform: "codex",
    scope: "repo",
    targetRepo: root,
    sourceRoot: repoRoot,
  });
  const skillDir = path.join(root, codexSkillRelative);
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
        const error = new Error("injected cleanup failure");
        error.code = "EACCES";
        throw error;
      }
      return rmdir(target);
    },
  });
  assert.equal(code, 0);
  assert.match(stdout.text(), /Removed Socrates from:/);
  assert.match(stderr.text(), /Warning: Socrates empty-directory cleanup residue remains:/i);
  await assertMissing(path.join(skillDir, "SKILL.md"));
  await assert.doesNotReject(() => access(skillDir));
});

test("local source inference is limited to direct complete-repository execution", () => {
  assert.equal(inferLocalSourceRoot(), null);
});

test.after(async () => {
  await rm(testInstallerStateRoot, { recursive: true, force: true });
});
