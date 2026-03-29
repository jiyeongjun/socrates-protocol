import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const DOC_FILENAME = "SOCRATES_CONTEXT.md";
export const STATUSES = ["clarifying", "ready", "executing"];
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
  const state = {
    version: 1,
    status: input.status ?? "clarifying",
    task: input.task ?? "",
    knowns: input.knowns ?? [],
    unknowns: input.unknowns ?? [],
    next_question:
      input.next_question === undefined ? null : input.next_question,
    decisions: input.decisions ?? [],
    updated_at: input.updated_at ?? new Date().toISOString(),
  };

  return validateState(state);
}

export function validateState(input) {
  const state = structuredClone(input);

  if (state.version !== 1) {
    throw new ContextDocError("invalid_version", "version must be 1");
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

export function renderContextDoc(input) {
  const state = validateState(input);
  const frontmatter = renderFrontmatter(state);
  const body = renderBody(state);
  return `---\n${frontmatter}---\n\n${body}`;
}

function renderFrontmatter(state) {
  const lines = [
    "version: 1",
    `status: ${quote(state.status)}`,
    `task: ${quote(state.task)}`,
    renderArray("knowns", state.knowns),
    renderArray("unknowns", state.unknowns),
    state.next_question === null
      ? "next_question: null"
      : `next_question: ${quote(state.next_question)}`,
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
  const { frontmatter, body } = splitFrontmatter(markdown);
  const parsed = parseFrontmatter(frontmatter);
  return {
    state: validateState(parsed),
    body,
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
    const sections = readCanonicalBodySections(body);
    if (!sections) {
      return {
        ok: false,
        reason: "missing_sections",
        state,
      };
    }

    const expectedSections = buildCanonicalSectionContents(state);
    const hasMismatch = FIXED_HEADINGS.some(
      (heading) => normalizeSection(sections[heading]) !== normalizeSection(expectedSections[heading])
    );

    if (hasMismatch) {
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

function readCanonicalBodySections(body) {
  const headings = Array.from(
    body.matchAll(/^## (.+)$/gm),
    (match) => ({
      heading: match[1].trim(),
      index: match.index,
      length: match[0].length,
    })
  );

  if (headings.length < FIXED_HEADINGS.length) {
    return null;
  }

  const hasRequiredOrder = FIXED_HEADINGS.every(
    (heading, index) => headings[index].heading === heading
  );
  if (!hasRequiredOrder) {
    return null;
  }

  const sections = {};
  for (let index = 0; index < FIXED_HEADINGS.length; index += 1) {
    const current = headings[index];
    const next = headings[index + 1];
    const contentStart = current.index + current.length;
    const contentEnd = next ? next.index : body.length;
    sections[current.heading] = body
      .slice(contentStart, contentEnd)
      .replace(/^\n+/, "")
      .trimEnd();
  }

  return sections;
}

function buildCanonicalSectionContents(state) {
  return {
    Task: state.task,
    "What Socrates Knows": renderBodyList(state.knowns),
    "What Socrates Still Needs": renderBodyList(state.unknowns),
    "Next Question": state.next_question ?? "None.",
    "Fixed Decisions": renderBodyList(state.decisions),
    Status: state.status,
  };
}

function normalizeSection(value) {
  return value.replace(/\r\n/g, "\n").trim();
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
    message: "Should I normalize SOCRATES_CONTEXT.md back to the standard format?",
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
  const nextState = {
    ...state,
    ...patch,
    knowns: patch.knowns ?? state.knowns,
    unknowns: patch.unknowns ?? state.unknowns,
    decisions: patch.decisions ?? state.decisions,
    next_question:
      patch.next_question === undefined
        ? state.next_question
        : patch.next_question,
    updated_at: patch.updated_at ?? new Date().toISOString(),
  };

  nextState.status = nextState.unknowns.length === 0 ? "ready" : "clarifying";
  return validateState(nextState);
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
