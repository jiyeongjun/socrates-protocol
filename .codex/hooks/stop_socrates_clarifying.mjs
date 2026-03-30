#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";

const DOC_FILENAME = "SOCRATES_CONTEXT.md";
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "ask",
  "before",
  "could",
  "from",
  "have",
  "into",
  "just",
  "must",
  "need",
  "next",
  "only",
  "question",
  "should",
  "still",
  "task",
  "that",
  "the",
  "their",
  "then",
  "this",
  "what",
  "when",
  "which",
  "with",
  "would",
]);
const { analyzeContextDoc, parseContextDoc } = await loadModule(
  "./_socrates_context_doc.mjs",
  "../../reference/context-doc.mjs"
);
const { findNearestContextDoc, parseJson, readStdin } = await loadModule(
  "./_socrates_hook_utils.mjs",
  "../../reference/hook-utils.mjs"
);

async function main() {
  const input = await readStdin();
  const payload = parseJson(input);
  const continuation = await getContinuationReason(payload);

  if (!continuation) {
    return;
  }

  // Both runtimes continue the turn when the hook writes a prompt to stderr
  // and exits with status 2.
  process.stderr.write(`${continuation}\n`);
  process.exitCode = 2;
}

async function getContinuationReason(payload) {
  if (
    !payload ||
    typeof payload.cwd !== "string" ||
    payload.cwd.trim() === "" ||
    payload.stop_hook_active === true
  ) {
    return null;
  }

  const docPath = await findNearestContextDoc(payload.cwd);
  if (!docPath) {
    return null;
  }

  const markdown = await readFile(docPath, "utf8");
  if (analyzeContextDoc(markdown).ok !== true) {
    return null;
  }

  const { state } = parseContextDoc(markdown);
  if (
    state.status !== "clarifying" ||
    state.next_question === null ||
    state.unknowns.length === 0
  ) {
    return null;
  }

  const assistantMessage =
    typeof payload.last_assistant_message === "string"
      ? payload.last_assistant_message
      : "";
  if (assistantMessage.trim() === "") {
    return null;
  }

  if (normalize(assistantMessage).includes(normalize(state.next_question))) {
    return null;
  }

  if (!looksRelatedToClarifyingTask(assistantMessage, state)) {
    return null;
  }

  return [
    "Read SOCRATES_CONTEXT.md before continuing.",
    "This task is still clarifying and should not move to implementation yet.",
    `Ask this next load-bearing question: ${state.next_question}`,
  ].join(" ");
}

function looksRelatedToClarifyingTask(message, state) {
  const normalizedMessage = normalize(message);
  if (normalizedMessage.includes("socrates_context")) {
    return true;
  }

  const keywords = extractKeywords(`${state.task} ${state.next_question}`);
  if (keywords.length === 0) {
    return false;
  }

  let matches = 0;
  for (const keyword of keywords) {
    if (new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(normalizedMessage)) {
      matches += 1;
      if (matches >= 2) {
        return true;
      }
    }
  }

  return false;
}

function extractKeywords(value) {
  return [...new Set(
    normalize(value)
      .split(/[^a-z0-9_]+/)
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
  )];
}

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
