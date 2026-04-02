#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { main } from "../reference/context-doc-helper-core.mjs";

try {
  process.exitCode = await main(process.argv.slice(2), fileURLToPath(import.meta.url));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
