import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  installSocrates,
  parseArgs,
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

function runNodeCli(scriptPath, args, cwd) {
  return new Promise((resolve) => {
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

    child.on("close", (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
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
    readFile(path.join(root, ".claude", "skills", "socrates-contract", "SKILL.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "agents", "socrates-plan.md"), "utf8")
  );
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".claude", "skills", "socrates-contract", "scripts", "scaffold-contract.mjs"), "utf8")
  );

  await assertMissing(path.join(root, ".codex"));
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
    readFile(path.join(fakeHome, ".codex", "skills", "socrates-contract", "SKILL.md"), "utf8")
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
    repoRoot
  );

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Installed Socrates to:/);
  await assert.doesNotReject(() =>
    readFile(path.join(root, ".agents", "skills", "socrates-contract", "SKILL.md"), "utf8")
  );
});
