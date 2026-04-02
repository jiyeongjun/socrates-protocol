import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const DOC_FILENAME = "SOCRATES_CONTEXT.md";
export const CURRENT_VERSION = 2;
export const LEGACY_VERSION = 1;
export const STATUSES = ["clarifying", "ready", "executing"];
export const CLARIFYING_PHASES = [
  "needs_question",
  "awaiting_user_answer",
];
export const FIXED_HEADINGS = [
  "Task",
  "What Socrates Knows",
  "What Socrates Still Needs",
  "Next Question",
  "Fixed Decisions",
  "Status",
];

export class ContextDocError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function contextDocPath(rootDir) {
  return path.join(rootDir, DOC_FILENAME);
}

export function createState(input) {
  const state = buildStateFromInput(input);

  return validateState(state);
}

export function validateState(input) {
  const state = structuredClone(input);

  if (state.version !== CURRENT_VERSION) {
    throw new ContextDocError(
      "invalid_version",
      `version must be ${CURRENT_VERSION}`
    );
  }

  if (!STATUSES.includes(state.status)) {
    throw new ContextDocError(
      "invalid_status",
      `status must be one of: ${STATUSES.join(", ")}`
    );
  }

  if (typeof state.task !== "string" || state.task.trim() === "") {
    throw new ContextDocError(
      "invalid_task",
      "task must be a non-empty string"
    );
  }

  assertStringArray(state.knowns, "knowns");
  assertStringArray(state.unknowns, "unknowns");
  assertStringArray(state.decisions, "decisions");

  if (
    state.next_question !== null &&
    (typeof state.next_question !== "string" || state.next_question.trim() === "")
  ) {
    throw new ContextDocError(
      "invalid_next_question",
      "next_question must be null or a non-empty string"
    );
  }

  if (
    state.clarifying_phase !== null &&
    !CLARIFYING_PHASES.includes(state.clarifying_phase)
  ) {
    throw new ContextDocError(
      "invalid_clarifying_phase",
      `clarifying_phase must be null or one of: ${CLARIFYING_PHASES.join(", ")}`
    );
  }

  if (
    typeof state.updated_at !== "string" ||
    Number.isNaN(Date.parse(state.updated_at))
  ) {
    throw new ContextDocError(
      "invalid_updated_at",
      "updated_at must be an ISO-8601 timestamp string"
    );
  }

  assertStateTransitionsAreConsistent(state);

  return state;
}

function assertStateTransitionsAreConsistent(state) {
  if (state.status === "clarifying") {
    if (state.unknowns.length === 0) {
      throw new ContextDocError(
        "invalid_status_shape",
        "clarifying state must retain at least one unresolved unknown"
      );
    }
    if (state.next_question === null) {
      throw new ContextDocError(
        "invalid_status_shape",
        "clarifying state must keep one next_question"
      );
    }
    if (state.clarifying_phase === null) {
      throw new ContextDocError(
        "invalid_status_shape",
        "clarifying state must set clarifying_phase"
      );
    }
    return;
  }

  if (state.unknowns.length > 0) {
    throw new ContextDocError(
      "invalid_status_shape",
      `${state.status} state cannot retain unresolved unknowns`
    );
  }

  if (state.next_question !== null) {
    throw new ContextDocError(
      "invalid_status_shape",
      `${state.status} state cannot keep a next_question`
    );
  }

  if (state.clarifying_phase !== null) {
    throw new ContextDocError(
      "invalid_status_shape",
      `${state.status} state cannot keep a clarifying_phase`
    );
  }
}

function assertStringArray(value, field) {
  if (!Array.isArray(value)) {
    throw new ContextDocError(`invalid_${field}`, `${field} must be an array`);
  }

  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new ContextDocError(
        `invalid_${field}`,
        `${field} entries must be non-empty strings`
      );
    }
  }
}

function buildStateFromInput(input = {}) {
  const status = input.status ?? "clarifying";
  const unknowns = input.unknowns ?? [];
  const nextQuestion =
    input.next_question === undefined ? null : input.next_question;

  return {
    version: input.version ?? CURRENT_VERSION,
    status,
    task: input.task ?? "",
    knowns: input.knowns ?? [],
    unknowns,
    next_question: nextQuestion,
    clarifying_phase:
      input.clarifying_phase === undefined
        ? inferDefaultClarifyingPhase({
            status,
            unknowns,
            next_question: nextQuestion,
          })
        : input.clarifying_phase,
    decisions: input.decisions ?? [],
    updated_at: input.updated_at ?? new Date().toISOString(),
  };
}

function inferDefaultClarifyingPhase(state) {
  if (
    state.status !== "clarifying" ||
    state.unknowns.length === 0 ||
    state.next_question === null
  ) {
    return null;
  }

  return "needs_question";
}

function normalizeLegacyParsedState(state) {
  return {
    ...state,
    version: CURRENT_VERSION,
    clarifying_phase:
      state.clarifying_phase ??
      inferDefaultClarifyingPhase({
        status: state.status,
        unknowns: state.unknowns ?? [],
        next_question: state.next_question ?? null,
      }),
  };
}

export function renderContextDoc(input) {
  const state = validateState(input);
  const frontmatter = renderFrontmatter(state);
  const body = renderBody(state);
  return `---\n${frontmatter}---\n\n${body}`;
}

function renderFrontmatter(state) {
  const lines = [
    `version: ${CURRENT_VERSION}`,
    `status: ${quote(state.status)}`,
    `task: ${quote(state.task)}`,
    renderArray("knowns", state.knowns),
    renderArray("unknowns", state.unknowns),
    state.next_question === null
      ? "next_question: null"
      : `next_question: ${quote(state.next_question)}`,
    state.clarifying_phase === null
      ? "clarifying_phase: null"
      : `clarifying_phase: ${quote(state.clarifying_phase)}`,
    renderArray("decisions", state.decisions),
    `updated_at: ${quote(state.updated_at)}`,
  ];

  return `${lines.join("\n")}\n`;
}

function renderArray(field, items) {
  if (items.length === 0) {
    return `${field}: []`;
  }

  return `${field}:\n${items.map((item) => `  - ${quote(item)}`).join("\n")}`;
}

function renderBody(state) {
  return [
    "# Socrates Context",
    "",
    "## Task",
    state.task,
    "",
    "## What Socrates Knows",
    renderBodyList(state.knowns),
    "",
    "## What Socrates Still Needs",
    renderBodyList(state.unknowns),
    "",
    "## Next Question",
    state.next_question ?? "None.",
    "",
    "## Fixed Decisions",
    renderBodyList(state.decisions),
    "",
    "## Status",
    state.status,
    "",
  ].join("\n");
}

function renderBodyList(items) {
  if (items.length === 0) {
    return "- None.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function quote(value) {
  return JSON.stringify(value);
}

export function parseContextDoc(markdown) {
  const { parsed, body } = parseParsedDocSource(markdown);
  return {
    state: validateState(parsed),
    body,
  };
}

function parseParsedDocSource(markdown) {
  const { frontmatter, body } = splitFrontmatter(markdown);
  const parsed = parseFrontmatter(frontmatter);
  const sourceVersion =
    typeof parsed.version === "number" ? parsed.version : null;

  return {
    parsed,
    body,
    sourceVersion,
  };
}

function splitFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    throw new ContextDocError(
      "missing_frontmatter",
      "document must start with YAML frontmatter"
    );
  }

  const closing = normalized.indexOf("\n---\n", 4);
  if (closing === -1) {
    throw new ContextDocError(
      "missing_frontmatter_end",
      "document must end YAML frontmatter with ---"
    );
  }

  return {
    frontmatter: normalized.slice(4, closing),
    body: normalized.slice(closing + 5).replace(/^\n/, ""),
  };
}

function parseFrontmatter(frontmatter) {
  const lines = frontmatter.split("\n");
  const result = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      continue;
    }

    const match = /^([a-z_]+):(?: (.*))?$/.exec(line);
    if (!match) {
      throw new ContextDocError(
        "invalid_frontmatter_line",
        `cannot parse frontmatter line: ${line}`
      );
    }

    const [, key, inlineValue] = match;
    if (inlineValue !== undefined && inlineValue !== "") {
      result[key] = parseScalarOrInlineArray(inlineValue);
      continue;
    }

    const items = [];
    index += 1;
    while (index < lines.length && /^  - /.test(lines[index])) {
      items.push(parseQuotedString(lines[index].slice(4)));
      index += 1;
    }
    index -= 1;
    result[key] = items;
  }

  return result;
}

function parseScalarOrInlineArray(raw) {
  if (raw === "null") {
    return null;
  }

  if (raw === "[]") {
    return [];
  }

  if (/^-?\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }

  return parseQuotedString(raw);
}

function parseQuotedString(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "string") {
      throw new Error("not a string");
    }
    return parsed;
  } catch {
    throw new ContextDocError(
      "invalid_string",
      `expected a JSON-style quoted string, got: ${raw}`
    );
  }
}

export function analyzeContextDoc(markdown) {
  try {
    const { state, body } = parseContextDoc(markdown);
    if (!bodyMatchesCanonicalView(body, renderBody(state))) {
      return {
        ok: false,
        reason: "body_mismatch",
        state,
      };
    }

    return {
      ok: true,
      state,
    };
  } catch (error) {
    if (error instanceof ContextDocError) {
      return {
        ok: false,
        reason: error.code,
      };
    }
    throw error;
  }
}

export function getContextDocRepairPlan(markdown, options = {}) {
  const legacyPlan = getLegacyContextDocRepairPlan(markdown);
  if (legacyPlan) {
    return legacyPlan;
  }

  const analysis = analyzeContextDoc(markdown);
  if (analysis.ok) {
    return {
      action: "ok",
      reason: null,
      source: "canonical",
      state: analysis.state,
      markdown,
    };
  }

  if (analysis.state) {
    return {
      action: "repair",
      reason: analysis.reason,
      source: "frontmatter",
      state: analysis.state,
      markdown: renderContextDoc(analysis.state),
    };
  }

  return {
    action: "unrepairable",
    reason: analysis.reason,
    source: null,
    state: null,
    markdown: null,
  };
}

function getLegacyContextDocRepairPlan(markdown) {
  try {
    const { parsed, sourceVersion } = parseParsedDocSource(markdown);
    if (sourceVersion === null || sourceVersion >= CURRENT_VERSION) {
      return null;
    }

    const state = validateState(normalizeLegacyParsedState(parsed));
    return {
      action: "repair",
      reason: "legacy_version",
      source: "frontmatter",
      state,
      markdown: renderContextDoc(state),
    };
  } catch (error) {
    if (error instanceof ContextDocError) {
      return null;
    }
    throw error;
  }
}

function normalizeSection(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function bodyMatchesCanonicalView(body, expectedBody) {
  const normalizedBody = body.replace(/\r\n/g, "\n").trimEnd();
  const normalizedExpected = expectedBody.replace(/\r\n/g, "\n").trimEnd();
  return (
    normalizedBody === normalizedExpected ||
    normalizedBody.startsWith(`${normalizedExpected}\n`)
  );
}

export async function writeContextDoc(rootDir, input) {
  const output = renderContextDoc(input);
  const target = contextDocPath(rootDir);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, output, "utf8");
  return target;
}

export async function readContextDoc(rootDir) {
  const target = contextDocPath(rootDir);
  return readFile(target, "utf8");
}

export async function deleteContextDoc(rootDir) {
  const target = contextDocPath(rootDir);
  await rm(target, { force: true });
  return target;
}

export function askToCreateDoc() {
  return {
    action: "ask_create_doc",
    message:
      "This task looks like it needs shared context. Should I keep it in SOCRATES_CONTEXT.md at the workspace root?",
  };
}

export function askToReplaceDoc() {
  return {
    action: "ask_replace_doc",
    message:
      "SOCRATES_CONTEXT.md already tracks a different task. Should I replace it and start this one instead?",
  };
}

export function askToRepairDoc() {
  return {
    action: "ask_repair_doc",
    message: "Should I normalize SOCRATES_CONTEXT.md to the canonical version 2 format?",
  };
}

export function askToDeleteIncompleteDoc() {
  return {
    action: "ask_delete_incomplete_doc",
    message:
      "This task did not finish cleanly. Should I delete SOCRATES_CONTEXT.md or keep it for the next turn?",
  };
}

export function maybeStartSharedContext({
  isFastPath = false,
  needsSharedContext = false,
  existingDoc = null,
  sameTask = false,
}) {
  if (isFastPath || !needsSharedContext) {
    return { action: "no_doc_needed" };
  }

  if (!existingDoc) {
    return askToCreateDoc();
  }

  if (sameTask) {
    return { action: "reuse_existing_doc" };
  }

  return askToReplaceDoc();
}

export function handleDocOptIn({ accepted, attempt }) {
  if (accepted) {
    return {
      action: "create_or_update_doc",
    };
  }

  if (attempt === 1) {
    return {
      action: "retry_doc_opt_in",
      message:
        "I may lose important context across turns without SOCRATES_CONTEXT.md. Should I create it?",
    };
  }

  return {
    action: "warn_continue_without_doc",
    message:
      "Continuing without SOCRATES_CONTEXT.md. I may not retain this context across turns.",
  };
}

export function updateForClarification(state, patch = {}) {
  const validated = validateState(state);
  const shouldResetClarifyingPhase =
    patch.unknowns !== undefined || patch.next_question !== undefined;
  const nextState = {
    ...validated,
    ...patch,
    version: CURRENT_VERSION,
    knowns: patch.knowns ?? validated.knowns,
    unknowns: patch.unknowns ?? validated.unknowns,
    decisions: patch.decisions ?? validated.decisions,
    next_question:
      patch.next_question === undefined
        ? validated.next_question
        : patch.next_question,
    clarifying_phase:
      shouldResetClarifyingPhase
        ? "needs_question"
        : (patch.clarifying_phase ?? validated.clarifying_phase),
    updated_at: patch.updated_at ?? new Date().toISOString(),
  };

  if (nextState.unknowns.length === 0) {
    nextState.status = "ready";
    nextState.next_question = null;
    nextState.clarifying_phase = null;
  } else {
    nextState.status = "clarifying";
  }

  return validateState(nextState);
}

export function markQuestionAsked(
  state,
  updated_at = new Date().toISOString()
) {
  const validated = validateState(state);
  if (validated.status !== "clarifying") {
    throw new ContextDocError(
      "invalid_transition",
      "can only mark a question as asked while clarifying"
    );
  }

  return validateState({
    ...validated,
    clarifying_phase: "awaiting_user_answer",
    updated_at,
  });
}

export function getClarifyingQuestionGate(state) {
  const validated = validateState(state);
  if (
    validated.status !== "clarifying" ||
    validated.clarifying_phase !== "needs_question"
  ) {
    return {
      action: "allow",
      next_question: null,
    };
  }

  return {
    action: "continue",
    next_question: validated.next_question,
  };
}

export function startExecution(state, updated_at = new Date().toISOString()) {
  const validated = validateState(state);
  if (validated.status !== "ready") {
    throw new ContextDocError(
      "invalid_transition",
      "can only transition to executing from ready"
    );
  }

  return validateState({
    ...validated,
    status: "executing",
    clarifying_phase: null,
    updated_at,
  });
}

export function handleTaskCompletion({
  success,
  deleteConfirmed,
}) {
  if (success) {
    return { action: "delete_doc" };
  }

  if (deleteConfirmed === true) {
    return { action: "delete_doc" };
  }

  if (deleteConfirmed === false) {
    return { action: "keep_doc" };
  }

  return askToDeleteIncompleteDoc();
}

export function runLifecycleFixture(fixture) {
  let contextState = fixture.initialState ?? null;
  const outputs = [];

  for (const step of fixture.steps) {
    switch (step.type) {
      case "maybe_start":
        outputs.push(maybeStartSharedContext(step));
        break;
      case "doc_opt_in":
        outputs.push(handleDocOptIn(step));
        break;
      case "clarify":
        contextState = updateForClarification(contextState, step.patch);
        outputs.push({ action: "state_updated", state: contextState });
        break;
      case "question_asked":
        contextState = markQuestionAsked(contextState, step.updated_at);
        outputs.push({ action: "state_updated", state: contextState });
        break;
      case "start_execution":
        contextState = startExecution(contextState, step.updated_at);
        outputs.push({ action: "state_updated", state: contextState });
        break;
      case "complete":
        outputs.push(handleTaskCompletion(step));
        break;
      case "repair":
        outputs.push(askToRepairDoc());
        break;
      default:
        throw new ContextDocError(
          "unknown_fixture_step",
          `unknown fixture step type: ${step.type}`
        );
    }
  }

  return {
    finalState: contextState,
    outputs,
  };
}
