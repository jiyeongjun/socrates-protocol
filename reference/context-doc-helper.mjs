#!/usr/bin/env node

import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { main } = await loadModule([
  "./_socrates_context_doc_helper_core.mjs",
  "./context-doc-helper-core.mjs",
]);

try {
  process.exitCode = await main(process.argv.slice(2), fileURLToPath(import.meta.url));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

async function loadModule(candidates) {
  for (const candidate of candidates) {
    const url = new URL(candidate, import.meta.url);
    if (!(await fileExists(url))) {
      continue;
    }
    return import(url.href);
  }

  throw new Error(`Missing Socrates context helper dependency: ${candidates[0]}`);
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
