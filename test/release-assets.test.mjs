import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_VERSION, listReleaseAssetPaths } from "../scripts/install.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

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

test("release asset manifest stays aligned with package version and shipped files", async () => {
  const pkg = JSON.parse(
    await readFile(path.join(repoRoot, "package.json"), "utf8")
  );
  const skillLayout = JSON.parse(
    await readFile(path.join(repoRoot, "reference", "skill-layout.json"), "utf8")
  );
  const assetPaths = listReleaseAssetPaths(skillLayout);

  assert.equal(DEFAULT_VERSION, `v${pkg.version}`);
  assert.match(JSON.stringify(assetPaths), /scripts\/install\.mjs/);
  assert.match(
    JSON.stringify(assetPaths),
    /reference\/stop-clarifying-core\.mjs/
  );
  assert.match(
    JSON.stringify(assetPaths),
    /reference\/context-doc-helper-core\.mjs/
  );

  for (const relativePath of assetPaths) {
    await assert.doesNotReject(() =>
      access(path.join(repoRoot, relativePath))
    );
  }
});

test("release asset check script validates the current tree by default", async () => {
  const result = await runNodeCli(
    path.join(repoRoot, "scripts", "check-release-assets.mjs"),
    [],
    repoRoot
  );

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Verified \d+ release assets in WORKTREE/);
  assert.equal(result.stderr, "");
});
