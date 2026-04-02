#!/usr/bin/env node

import { access } from "node:fs/promises";

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

try {
  const { main } = await loadModule([
    "./_socrates_stop_clarifying_core.mjs",
    "../../reference/stop-clarifying-core.mjs",
  ]);
  await main();
} catch {
  process.exit(0);
}

async function loadModule(candidates) {
  for (const candidate of candidates) {
    const url = new URL(candidate, import.meta.url);
    if (!(await fileExists(url))) {
      continue;
    }
    return import(url.href);
  }

  throw new Error(`Missing Socrates stop-hook dependency: ${candidates[0]}`);
}
