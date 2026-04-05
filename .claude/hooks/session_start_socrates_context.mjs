#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DOC_FILENAME = "SOCRATES_CONTEXT.md";
const HANDLED_SOURCES = new Set(["startup", "resume", "clear", "compact"]);
let analyzeContextDoc;
let CURRENT_VERSION;
let getContextDocRepairPlan;
let parseContextDoc;
let findNearestContextDoc;
let parseJson;
let readStdin;

try {
  ({ analyzeContextDoc, CURRENT_VERSION, getContextDocRepairPlan, parseContextDoc } = await loadModule(
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
  const analysis = analyzeContextDoc(markdown);
  const repairPlan = getContextDocRepairPlan(markdown);

  if (
    analysis.ok !== true &&
    repairPlan?.reason !== "legacy_version" &&
    !looksLikeMalformedSocratesContext(markdown, repairPlan)
  ) {
    return;
  }

  // Claude SessionStart hooks return the additional context as plain stdout text.
  const additionalContext =
    analysis.ok === true
      ? buildAdditionalContext(docPath, parseContextDoc(markdown).state)
      : repairPlan?.reason === "legacy_version"
        ? await buildLegacyAdditionalContext(docPath, repairPlan)
        : await buildRepairAdditionalContext(docPath, repairPlan);
  process.stdout.write(`${additionalContext}\n`);
}

function buildAdditionalContext(docPath, state) {
  return [
    `Socrates shared context is active at ${docPath}.`,
    `Read ${DOC_FILENAME} before continuing and treat its frontmatter as the canonical persisted state.`,
    "Continue from its task, knowns, unknowns, next_question, clarifying_phase, decisions, and status instead of creating another persisted context file.",
    describePhaseSpecificGuidance(state),
    "Delete the file on successful completion; if the task stops incomplete, ask whether to keep or delete it.",
  ].join(" ");
}

function describePhaseSpecificGuidance(state) {
  if (state.status === "clarifying") {
    if (state.clarifying_phase === "needs_question") {
      return "Ask the next load-bearing question and flip clarifying_phase to awaiting_user_answer before ending the turn.";
    }

    return "If status is clarifying and clarifying_phase is awaiting_user_answer, wait for the user instead of moving to implementation.";
  }

  if (state.status === "ready") {
    return "Exploration and clarification are complete. When implementation starts, move status to executing.";
  }

  return "This task is executing with shared context. Resume from the saved task and decisions. Keep verify -> quality_evaluator -> one repair loop inline within the current turn instead of persisting execution micro-state back into SOCRATES_CONTEXT.md.";
}

async function buildLegacyAdditionalContext(docPath, repairPlan) {
  const doctorCommand = await buildHelperCommand("doctor", docPath);
  const repairCommand =
    repairPlan?.action === "repair"
      ? await buildHelperCommand("repair", docPath)
      : null;

  return [
    `Socrates found a legacy shared context file at ${docPath}.`,
    `Do not treat ${DOC_FILENAME} as canonical runtime state until it is normalized to version ${CURRENT_VERSION} or deleted.`,
    `Ask whether to normalize the legacy file to the canonical version ${CURRENT_VERSION} format before continuing.`,
    doctorCommand
      ? `If the user wants a diagnosis first, suggest: ${doctorCommand}.`
      : "If the user wants a diagnosis first, suggest the local Socrates context doctor command if it is available.",
    repairCommand
      ? `If the user wants automatic normalization, suggest: ${repairCommand}.`
      : "If the user wants automatic normalization, suggest the local Socrates context repair command if it is available.",
    `If the user no longer needs that legacy file, suggest deleting it and continuing with a fresh version ${CURRENT_VERSION} context instead.`,
  ].join(" ");
}

async function buildRepairAdditionalContext(docPath, repairPlan) {
  const doctorCommand = await buildHelperCommand("doctor", docPath);
  const repairCommand =
    repairPlan?.action === "repair"
      ? await buildHelperCommand("repair", docPath)
      : null;

  return [
    `Socrates found a malformed shared context file at ${docPath}.`,
    "Do not treat this file as canonical persisted state until it is normalized.",
    `Ask whether to normalize SOCRATES_CONTEXT.md to the canonical version ${CURRENT_VERSION} format before continuing.`,
    doctorCommand
      ? `If the user wants a diagnosis first, suggest: ${doctorCommand}.`
      : "If the user wants a diagnosis first, suggest the local Socrates context doctor command if it is available.",
    repairCommand
      ? `If the user wants automatic normalization, suggest: ${repairCommand}.`
      : "If the user wants automatic normalization, explain that this file is not auto-repairable and must be rewritten or replaced manually after diagnosis.",
  ].join(" ");
}

function looksLikeMalformedSocratesContext(markdown, repairPlan) {
  const normalized = markdown.replace(/\r\n/g, "\n").trimStart();
  return (
    repairPlan?.action === "repair" ||
    normalized.startsWith("## Task\n") ||
    normalized === "## Task" ||
    normalized.startsWith("---\n") ||
    /(?:^|\n)# Socrates Context(?:\n|$)/.test(normalized)
  );
}

async function buildHelperCommand(command, docPath) {
  const helperPath = await findHelperScriptPath();
  if (!helperPath) {
    return null;
  }

  return `node ${JSON.stringify(helperPath)} ${command} --file ${JSON.stringify(docPath)}`;
}

async function findHelperScriptPath() {
  for (const candidate of [
    "./socrates_context_doc_helper.mjs",
    "../../scripts/context-doc.mjs",
  ]) {
    const url = new URL(candidate, import.meta.url);
    if (await fileExists(url)) {
      return fileURLToPath(url);
    }
  }

  return null;
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
