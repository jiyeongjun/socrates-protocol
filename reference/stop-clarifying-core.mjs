import { access, readFile } from "node:fs/promises";

let analyzeContextDoc;
let getClarifyingQuestionGate;
let parseContextDoc;
let findNearestContextDoc;
let parseJson;
let readStdin;

try {
  ({ analyzeContextDoc, getClarifyingQuestionGate, parseContextDoc } =
    await loadModule([
      "./_socrates_context_doc.mjs",
      "./context-doc.mjs",
      "../reference/context-doc.mjs",
    ]));
  ({ findNearestContextDoc, parseJson, readStdin } = await loadModule([
    "./_socrates_hook_utils.mjs",
    "./hook-utils.mjs",
    "../reference/hook-utils.mjs",
  ]));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(message);
}

export async function main() {
  const input = await readStdin();
  const payload = parseJson(input);
  const continuation = await getContinuationReason(payload);

  if (!continuation) {
    return;
  }

  process.stderr.write(`${continuation}\n`);
  process.exitCode = 2;
}

async function getContinuationReason(payload) {
  if (
    !payload ||
    typeof payload.cwd !== "string" ||
    payload.cwd.trim() === ""
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
  const gate = getClarifyingQuestionGate(state);
  if (gate.action !== "continue") {
    return null;
  }

  return [
    "Read SOCRATES_CONTEXT.md before continuing.",
    "This task is still clarifying and should not move to implementation yet.",
    `Ask this next load-bearing question: ${gate.next_question}`,
    "After asking it, rewrite SOCRATES_CONTEXT.md and flip clarifying_phase to awaiting_user_answer before ending the turn.",
    "If you already asked it in this draft, do not ask it again. Just update SOCRATES_CONTEXT.md before ending the turn.",
  ].join(" ");
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

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
