#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { DEFAULT_VERSION, listReleaseAssetPaths } from "./install.mjs";

const execFile = promisify(execFileCallback);
const DEFAULT_REF = "WORKTREE";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const options = parseArgs(process.argv.slice(2));
const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const expectedTag = `v${pkg.version}`;

const skillLayout = JSON.parse(
  await readFile(path.join(repoRoot, "reference", "skill-layout.json"), "utf8")
);
const assets = listReleaseAssetPaths(skillLayout);
const missing = [];

for (const asset of assets) {
  if (!(await assetExistsAtRef(options.ref, asset))) {
    missing.push(asset);
  }
}

if (missing.length > 0) {
  process.stderr.write(`Missing release assets in ${options.ref}:\n`);
  for (const asset of missing) {
    process.stderr.write(`- ${asset}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Verified ${assets.length} release assets in ${options.ref}\n`
);

function parseArgs(argv) {
  const options = {
    ref: DEFAULT_REF,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--ref":
        if (!next || next.startsWith("--")) {
          throw new Error("Missing value for --ref");
        }
        options.ref = next;
        index += 1;
        break;
      case "--help":
      case "-h":
        process.stdout.write(renderHelp());
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  return options;
}

function renderHelp() {
  return `Socrates release asset check

Usage:
  node scripts/check-release-assets.mjs
  node scripts/check-release-assets.mjs --ref WORKTREE
  node scripts/check-release-assets.mjs --ref ${DEFAULT_VERSION}
  node scripts/check-release-assets.mjs --ref ${expectedTag}
`;
}

async function assetExistsAtRef(ref, asset) {
  if (ref === "WORKTREE") {
    try {
      await readFile(path.join(repoRoot, asset), "utf8");
      return true;
    } catch {
      return false;
    }
  }

  try {
    await execFile("git", ["cat-file", "-e", `${ref}:${asset}`], {
      cwd: repoRoot,
    });
    return true;
  } catch {
    return false;
  }
}
