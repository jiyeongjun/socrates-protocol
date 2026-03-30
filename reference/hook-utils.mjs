import { access } from "node:fs/promises";
import path from "node:path";

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function findNearestContextDoc(
  startDir,
  docFilename = "SOCRATES_CONTEXT.md"
) {
  const boundary = await findSearchBoundary(path.resolve(startDir));
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, docFilename);
    if (await pathExists(candidate)) {
      return candidate;
    }

    if (boundary !== null && current === boundary) {
      return null;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function findSearchBoundary(startDir) {
  let current = path.resolve(startDir);

  while (true) {
    if (await pathExists(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
