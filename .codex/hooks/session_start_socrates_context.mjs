#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";

const DOC_FILENAME = "SOCRATES_CONTEXT.md";
const HANDLED_SOURCES = new Set(["startup", "resume"]);
let analyzeContextDoc;
let findNearestContextDoc;
let parseJson;
let readStdin;

try {
  ({ analyzeContextDoc } = await loadModule(
    "./_socrates_context_doc.mjs",
    "../../reference/context-doc.mjs"
  ));
  ({ findNearestContextDoc, parseJson, readStdin } = await loadModule(
    "./_socrates_hook_utils.mjs",
    "../../reference/hook-utils.mjs"
  ));
} catch {
  process.exit(0);
}

async function main() {
  const input = await readStdin();
  const payload = parseJson(input);

  if (
    !payload ||
    typeof payload.cwd !== "string" ||
    payload.cwd.trim() === "" ||
    !HANDLED_SOURCES.has(payload.source)
  ) {
    return;
  }

  const docPath = await findNearestContextDoc(payload.cwd);
  if (!docPath) {
    return;
  }

  const markdown = await readFile(docPath, "utf8");
  if (!looksLikeSocratesContext(markdown)) {
    return;
  }

  const additionalContext = buildAdditionalContext(docPath);
  // Codex SessionStart hooks must emit hookSpecificOutput JSON on stdout.
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    })}\n`
  );
}

function looksLikeSocratesContext(markdown) {
  return analyzeContextDoc(markdown).ok === true;
}

function buildAdditionalContext(docPath) {
  return [
    `Socrates shared context is active at ${docPath}.`,
    `Read ${DOC_FILENAME} before continuing and treat its frontmatter as the canonical persisted state.`,
    "Continue from its task, knowns, unknowns, next_question, decisions, and status instead of creating another persisted context file.",
    "If unresolved unknowns remain, ask the next load-bearing question before implementation.",
    "Delete the file on successful completion; if the task stops incomplete, ask whether to keep or delete it.",
  ].join(" ");
}

async function loadModule(localSpecifier, repoSpecifier) {
  for (const candidate of [localSpecifier, repoSpecifier]) {
    const url = new URL(candidate, import.meta.url);
    if (!(await fileExists(url))) {
      continue;
    }
    return import(url.href);
  }

  throw new Error(`Missing Socrates hook dependency: ${localSpecifier}`);
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

await main();
