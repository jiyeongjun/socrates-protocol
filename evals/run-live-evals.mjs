import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rm,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEvalCatalog, validateEvalCatalog } from "./run-static-evals.mjs";

const evalsRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evalsRoot, "..");

const liveGraders = {
  "direct-eli5": {
    must: [/database index/iu, /find|look(?:ing)? up|search/iu, /book|catalog|table of contents|index card/iu],
    mustNot: [/B-?tree|schema migration|query planner/iu],
  },
  "technical-explanation": {
    must: [/race condition/iu, /shared (?:state|resource|data)|concurrent/iu, /order|interleav|timing/iu, /lock|atomic|transaction|synchron/iu],
    mustNot: [/imagine you have (?:toys|candy|crayons)/iu],
  },
  "manager-deliverable": {
    must: [/fail|impact|peak/iu, /reduce|fewer calls|optimi[sz]/iu, /higher tier|cost|buy|pay/iu, /recommend|decision|choose|option/iu],
    mustNot: [/quiz|test your understanding|what do you think/iu],
  },
  "source-grounded": {
    must: [/3 (?:attempts|tries)|attempts.*3/iu, /100\s*(?:ms|milliseconds)/iu, /last error|rethrows?|throw/iu],
    mustNot: [/exponential backoff|jitter/iu],
  },
  "guided-opening": {
    must: [/photosynthesis/iu, /light|sunlight/iu],
    mustNot: [/quiz has \d+ questions|first question.*second question/iu],
  },
  "mastery-misconception": {
    must: [
      /cache|cached (?:copy|data)/iu,
      /doesn.?t .*by itself|does not .*by itself|not .*automatic|no (?:awareness|way to (?:know|notice|sense))|can(?:not|'t) (?:know|notice|sense)|needs? (?:a )?(?:signal|rule)|expir|invalidat/iu,
    ],
    mustNot: [/hit rate|cache stampede|eviction policy|\bLRU\b|trade-?off/iu, /exactly right|correct answer/iu],
  },
  "mastery-partial": {
    must: [/expir|\bTTL\b/iu, /fetch|refresh|reload|source|original|replace|repopulat/iu],
    mustNot: [/hit rate|cache stampede|eviction policy|\bLRU\b|trade-?off/iu, /exactly right|fully correct/iu],
  },
  "mastery-correct": {
    must: [
      /expir|\bTTL\b|invalidat/iu,
      /fetch|refresh|reload|source|original|replace|repopulat|stale|outdated|old (?:copy|value|data)|discard|unusable|passive|external (?:rule|signal)|bounds? staleness|by (?:time|event)/iu,
      /trade-?off|balance|longer|shorter|fresh(?:ness)?|performance|hit rate|failure|safer?|risk|lost|missing (?:event|signal)/iu,
    ],
    mustNot: [/not quite|incorrect|misconception/iu],
  },
  "mastery-uncertain": {
    must: [/cache|cached/iu, /example|imagine|choose|which|suppose|two (?:cases|options)/iu],
    mustNot: [/hit rate|cache stampede|eviction policy|\bLRU\b|trade-?off/iu],
  },
  "changed-representation": {
    must: [/cache|cached/iu, /timeline|example|scenario|choose|two (?:cases|options)|\bTTL\b|invalidat/iu],
    mustNot: [/How does a cache know its copy is stale\?/iu, /hit rate|cache stampede|eviction policy|\bLRU\b|trade-?off/iu],
  },
  "direct-opt-out": {
    must: [/transaction/iu, /all-or-nothing|atomic/iu, /rollback|rolls? back|partial update/iu],
    mustNot: [/quiz|before I tell you|first answer/iu],
  },
  "child-calibration": {
    must: [/gravity/iu, /pull|attract/iu, /earth/iu],
    mustNot: [/Einstein field equation|tensor|spacetime curvature tensor/iu, /super duper|huuuge/iu],
  },
  "no-stereotype": {
    must: [/quantum/iu, /qubit/iu, /superposition|measurement|probabil/iu],
    mustNot: [/home ?owner|mortgage|your career|your family|retirement|your finances/iu],
  },
  "mixed-audience": {
    must: [/shared|core|both/iu, /designer|user|interaction|feedback/iu, /engineer|state|server|reconcil|rollback/iu],
    mustNot: [/quiz|test your understanding/iu],
  },
  "analogy-boundary": {
    must: [/public key/iu, /private key/iu, /analogy|imagine|like/iu, /breaks down|limit|unlike|not exactly/iu],
    mustNot: [],
  },
  "korean-explanation": {
    must: [/[가-힣]{20,}/u, /캐시/iu, /오래된|최신|데이터|무효화/iu],
    mustNot: [/quiz|test your understanding/iu],
  },
  "ordinary-task": {
    must: [/parseCount/iu, /parseInteger/iu, /test|verify|verification/iu],
    mustNot: [/quiz|teach|learning objective|Socratic/iu],
  },
  "direct-deliverable": {
    must: [/database|DB/iu, /resolved|fixed|restored|repaired/iu],
    mustNot: [/here.?s why|writing principle|quiz|understanding/iu],
  },
};

export const liveGraderIds = Object.freeze(Object.keys(liveGraders));
export const liveEvalArms = Object.freeze(["skill", "control"]);

export function parseLiveArms(value = "skill") {
  const arms = value
    .split(",")
    .map((arm) => arm.trim())
    .filter(Boolean);
  if (arms.length === 0 || new Set(arms).size !== arms.length) {
    throw new Error("SOCRATES_LIVE_EVAL_ARMS must list unique skill/control arms");
  }
  for (const arm of arms) {
    if (!liveEvalArms.includes(arm)) {
      throw new Error("SOCRATES_LIVE_EVAL_ARMS must list only skill and control");
    }
  }
  return arms;
}

function buildIsolatedEnv(host, workspace, sourceEnv = process.env) {
  const env = {};
  for (const name of [
    "PATH",
    "LANG",
    "LC_ALL",
    "TERM",
    "TMPDIR",
    "TMP",
    "TEMP",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
  ]) {
    if (sourceEnv[name]) env[name] = sourceEnv[name];
  }
  env.HOME = path.join(workspace, ".eval-home");
  env.XDG_CONFIG_HOME = path.join(env.HOME, ".config");
  env.USERPROFILE = env.HOME;
  env.APPDATA = path.join(env.HOME, "AppData", "Roaming");
  env.LOCALAPPDATA = path.join(env.HOME, "AppData", "Local");
  if (process.platform === "win32") {
    const root = path.parse(env.HOME).root;
    env.HOMEDRIVE = root.replace(/[\\/]$/u, "");
    env.HOMEPATH = env.HOME.slice(root.length - 1);
  }
  if (host === "codex") {
    env.CODEX_HOME = path.join(env.HOME, "codex-home");
    for (const name of ["OPENAI_API_KEY", "OPENAI_BASE_URL"]) {
      if (sourceEnv[name]) env[name] = sourceEnv[name];
    }
  } else {
    env.CLAUDE_CONFIG_DIR = path.join(env.HOME, "claude-config");
    for (const name of [
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_BASE_URL",
      "CLAUDE_CODE_USE_BEDROCK",
      "CLAUDE_CODE_USE_VERTEX",
      "CLAUDE_CODE_USE_FOUNDRY",
      "AWS_PROFILE",
      "AWS_REGION",
      "AWS_DEFAULT_REGION",
      "GOOGLE_APPLICATION_CREDENTIALS",
      "CLOUD_ML_REGION",
    ]) {
      if (sourceEnv[name]) env[name] = sourceEnv[name];
    }
  }
  return env;
}

export function buildLiveCommand({
  host,
  model,
  workspace,
  prompt,
  reasoningEffort = null,
  arm = "skill",
  sourceEnv = process.env,
}) {
  if (!liveEvalArms.includes(arm)) throw new Error(`Unsupported live eval arm: ${arm}`);
  const evaluationSuffix =
    "This is a read-only evaluation. Answer the request normally, but do not mutate files or perform external actions.";
  if (host === "codex") {
    const args = [
      "exec",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--json",
      "--model",
      model,
    ];
    if (reasoningEffort) {
      args.push("--config", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
    }
    args.push(
      "--cd",
      workspace,
      `${arm === "skill" ? "Use $socrates for this request:\n" : ""}${prompt}\n${evaluationSuffix}`
    );
    return {
      command: "codex",
      args,
      cwd: workspace,
      env: buildIsolatedEnv(host, workspace, sourceEnv),
    };
  }
  if (host === "claude") {
    return {
      command: "claude",
      args: [
        "--print",
        "--bare",
        "--permission-mode",
        "plan",
        "--tools",
        "Read,Grep,Glob",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--output-format",
        "json",
        "--no-session-persistence",
        "--model",
        model,
        `${arm === "skill" ? "/socrates " : ""}${prompt}\n${evaluationSuffix}`,
      ],
      cwd: workspace,
      env: buildIsolatedEnv(host, workspace, sourceEnv),
    };
  }
  throw new Error(`Unsupported live host: ${host}`);
}

export async function runProcess(
  { command, args, cwd, env = process.env },
  timeoutMs,
  killGraceMs = 2000
) {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint();
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let harnessStderr = "";
    let timedOut = false;
    let spawnError = null;
    let settled = false;
    let killTimer = null;
    let forceTimer = null;
    let observedCode = null;
    let observedSignal = null;
    let sentSigkill = false;
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (forceTimer) clearTimeout(forceTimer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = `${Buffer.concat(stderrChunks).toString("utf8")}${harnessStderr}`;
      resolve({
        code,
        signal,
        stdout,
        stderr,
        timedOut,
        error: spawnError instanceof Error ? spawnError.message : null,
        wallTimeMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        stdoutBytes,
        stderrBytes,
      });
    };
    const signalTree = (signal) => {
      try {
        if (process.platform === "win32" && child.pid) {
          const killer = spawn(
            "taskkill",
            ["/PID", String(child.pid), "/T", "/F"],
            { stdio: "ignore", windowsHide: true }
          );
          killer.on("error", (error) => {
            harnessStderr += `\nFailed to terminate process tree: ${error.message}`;
          });
          killer.unref();
        } else if (child.pid) {
          process.kill(-child.pid, signal);
        } else {
          child.kill(signal);
        }
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "ESRCH") {
          harnessStderr += `\nFailed to send ${signal}: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      signalTree("SIGTERM");
      killTimer = setTimeout(() => {
        sentSigkill = true;
        signalTree("SIGKILL");
        forceTimer = setTimeout(() => {
          child.stdout.destroy();
          child.stderr.destroy();
          finish(observedCode, observedSignal ?? "SIGKILL");
        }, Math.max(50, Math.min(killGraceMs, 500)));
      }, killGraceMs);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stdoutChunks.push(buffer);
      stdoutBytes += buffer.length;
    });
    child.stderr.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrChunks.push(buffer);
      stderrBytes += buffer.length;
    });
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("exit", (code, signal) => {
      observedCode = code;
      observedSignal = signal;
    });
    child.on("close", (code, signal) => {
      finish(code, signal ?? (sentSigkill ? "SIGKILL" : null));
    });
  });
}

function nullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") {
    return { input_tokens: null, output_tokens: null, cached_input_tokens: null };
  }
  return {
    input_tokens: nullableNumber(usage.input_tokens ?? usage.inputTokens),
    output_tokens: nullableNumber(usage.output_tokens ?? usage.outputTokens),
    cached_input_tokens: nullableNumber(
      usage.cached_input_tokens ??
        usage.cached_tokens ??
        usage.cache_read_input_tokens ??
        usage.input_tokens_details?.cached_tokens
    ),
  };
}

function isRecognizedToolItem(itemType) {
  return /(?:^|_)(?:tool_call|function_call|mcp_tool_call|command_execution|web_search|file_search|computer_call)$/u.test(
    itemType
  );
}

export function parseHostOutput(host, stdout) {
  if (host === "claude") {
    try {
      const parsed = JSON.parse(stdout);
      const response = typeof parsed.result === "string" ? parsed.result : stdout;
      return {
        response,
        telemetry: {
          turn_count: nullableNumber(parsed.num_turns),
          item_type_counts: null,
          tool_call_count: null,
          tool_calls_by_type: null,
          usage: normalizeUsage(parsed.usage),
          host_duration_ms: nullableNumber(parsed.duration_ms),
          host_api_duration_ms: nullableNumber(parsed.duration_api_ms),
          host_cost_usd: nullableNumber(parsed.total_cost_usd),
        },
      };
    } catch {
      return {
        response: stdout,
        telemetry: {
          turn_count: null,
          item_type_counts: null,
          tool_call_count: null,
          tool_calls_by_type: null,
          usage: normalizeUsage(null),
          host_duration_ms: null,
          host_api_duration_ms: null,
          host_cost_usd: null,
        },
      };
    }
  }

  const messages = [];
  const itemTypeCounts = {};
  const toolCallsByType = {};
  const completedItemIds = new Set();
  let turnCount = 0;
  let observedCompletedItem = false;
  let usage = normalizeUsage(null);
  for (const line of stdout.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event?.type === "turn.completed") turnCount += 1;
      const eventUsage = event?.usage ?? event?.response?.usage;
      if (eventUsage) usage = normalizeUsage(eventUsage);
      const itemType = typeof event?.item?.type === "string" ? event.item.type : null;
      if (event?.type === "item.completed" && itemType) {
        const rawItemId = event.item.id ?? event.item_id;
        const itemId =
          typeof rawItemId === "string" || typeof rawItemId === "number"
            ? String(rawItemId)
            : null;
        if (itemId !== null && completedItemIds.has(itemId)) continue;
        if (itemId !== null) completedItemIds.add(itemId);
        observedCompletedItem = true;
        itemTypeCounts[itemType] = (itemTypeCounts[itemType] ?? 0) + 1;
        if (isRecognizedToolItem(itemType)) {
          toolCallsByType[itemType] = (toolCallsByType[itemType] ?? 0) + 1;
        }
        if (itemType === "agent_message") {
          const message = event.item.text ?? event.item.content;
          if (typeof message === "string") messages.push(message);
        }
      }
    } catch {
      // Raw stdout remains in the report for future parser improvements.
    }
  }
  return {
    response: messages.filter(Boolean).at(-1) ?? stdout,
    telemetry: {
      turn_count: turnCount || null,
      item_type_counts: observedCompletedItem ? itemTypeCounts : null,
      tool_call_count: observedCompletedItem
        ? Object.values(toolCallsByType).reduce((sum, count) => sum + count, 0)
        : null,
      tool_calls_by_type: observedCompletedItem ? toolCallsByType : null,
      usage,
      host_duration_ms: null,
      host_api_duration_ms: null,
      host_cost_usd: null,
    },
  };
}

export function countQuestionMarksOutsideExamples(response) {
  const prose = response
    .replace(/```[\s\S]*?```/gu, "")
    .replace(/`[^`\n]*`/gu, "");
  let straightQuote = false;
  let curlyQuote = false;
  let curlySingleQuote = false;
  let escaped = false;
  let count = 0;

  const hasUnescapedClosingQuote = (start, quote) => {
    let quoteEscaped = false;
    for (let index = start; index < prose.length; index += 1) {
      const candidate = prose[index];
      if (quoteEscaped) {
        quoteEscaped = false;
        continue;
      }
      if (candidate === "\\") {
        quoteEscaped = true;
        continue;
      }
      if (candidate === quote) return true;
    }
    return false;
  };

  for (let index = 0; index < prose.length; index += 1) {
    const character = prose[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (straightQuote && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      if (straightQuote) {
        straightQuote = false;
      } else if (hasUnescapedClosingQuote(index + 1, '"')) {
        straightQuote = true;
      }
      continue;
    }
    if (!straightQuote && character === "“") {
      curlyQuote = prose.indexOf("”", index + 1) !== -1;
      continue;
    }
    if (!straightQuote && character === "”") {
      curlyQuote = false;
      continue;
    }
    if (!straightQuote && !curlyQuote && character === "‘") {
      curlySingleQuote = prose.indexOf("’", index + 1) !== -1;
      continue;
    }
    if (!straightQuote && !curlyQuote && character === "’") {
      curlySingleQuote = false;
      continue;
    }
    if (
      character === "?" &&
      !straightQuote &&
      !curlyQuote &&
      !curlySingleQuote
    ) {
      count += 1;
    }
  }
  return count;
}

export function gradeResponse(evalCase, response) {
  const grader = liveGraders[evalCase.live_grader_id];
  if (!grader) throw new Error(`Unknown live grader: ${evalCase.live_grader_id}`);
  const missing = grader.must
    .filter((pattern) => !pattern.test(response))
    .map((pattern) => pattern.source);
  const forbidden = grader.mustNot
    .filter((pattern) => pattern.test(response))
    .map((pattern) => pattern.source);
  const questionCount = countQuestionMarksOutsideExamples(response);
  const questionRangePass =
    questionCount >= evalCase.expected_questions.min &&
    questionCount <= evalCase.expected_questions.max;
  return {
    passed: missing.length === 0 && forbidden.length === 0 && questionRangePass,
    completeness: {
      matched: grader.must.length - missing.length,
      required: grader.must.length,
      ratio: grader.must.length === 0 ? 1 : (grader.must.length - missing.length) / grader.must.length,
    },
    missing_patterns: missing,
    forbidden_patterns: forbidden,
    question_mark_count: questionCount,
    expected_questions: evalCase.expected_questions,
  };
}

const forbiddenFixtureEntries = new Set([
  ".agents",
  ".claude",
  ".codex",
  ".eval-home",
  ".git",
  ".mcp.json",
  "AGENTS.md",
  "AGENTS.override.md",
  "CLAUDE.md",
  "CLAUDE.local.md",
].map((name) => name.toLowerCase()));

export async function assertSafeFixtureTree(
  root,
  relative = "",
  { allowedHostControls = new Set() } = {}
) {
  if (relative === "") {
    const rootMetadata = await lstat(root);
    if (rootMetadata.isSymbolicLink()) {
      throw new Error("Live eval fixture root is a symlink");
    }
    if (!rootMetadata.isDirectory()) {
      throw new Error("Live eval fixture root is not a directory");
    }
  }
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const childRelative = path.join(relative, entry.name);
    const child = path.join(root, childRelative);
    const metadata = await lstat(child);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Live eval fixture contains a symlink: ${childRelative}`);
    }
    const isAllowedGeneratedControl =
      relative === "" && allowedHostControls.has(entry.name);
    if (
      forbiddenFixtureEntries.has(entry.name.toLowerCase()) &&
      !isAllowedGeneratedControl
    ) {
      throw new Error(`Live eval fixture contains host control state: ${entry.name}`);
    }
    if (metadata.isDirectory()) {
      await assertSafeFixtureTree(root, childRelative, { allowedHostControls });
    }
  }
}

export async function prepareWorkspace(host, evalCase, arm = "skill") {
  if (!liveEvalArms.includes(arm)) throw new Error(`Unsupported live eval arm: ${arm}`);
  const workspace = await mkdtemp(path.join(os.tmpdir(), "socrates-live-eval-"));
  try {
    if (evalCase.fixture) {
      const source = path.join(evalsRoot, evalCase.fixture);
      await assertSafeFixtureTree(source);
      await cp(source, workspace, { recursive: true, dereference: false });
    }
    await mkdir(path.join(workspace, ".eval-home", ".config"), {
      recursive: true,
    });
    await mkdir(path.join(workspace, ".eval-home", "codex-home"), {
      recursive: true,
    });
    await mkdir(path.join(workspace, ".eval-home", "AppData", "Roaming"), {
      recursive: true,
    });
    await mkdir(path.join(workspace, ".eval-home", "AppData", "Local"), {
      recursive: true,
    });
    await mkdir(path.join(workspace, ".eval-home", "claude-config"), {
      recursive: true,
    });
    if (arm === "skill" && host === "codex") {
      await mkdir(path.join(workspace, ".agents"), { recursive: true });
      await cp(path.join(repoRoot, ".agents/skills"), path.join(workspace, ".agents/skills"), { recursive: true });
    } else if (arm === "skill") {
      await mkdir(path.join(workspace, ".claude"), { recursive: true });
      await cp(path.join(repoRoot, ".claude/skills"), path.join(workspace, ".claude/skills"), { recursive: true });
    }
    await assertSafeFixtureTree(workspace, "", {
      allowedHostControls:
        arm === "control"
          ? new Set([".eval-home"])
          : host === "codex"
            ? new Set([".agents", ".eval-home"])
            : new Set([".claude", ".eval-home"]),
    });
    return workspace;
  } catch (error) {
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new Error(
        `Live eval workspace preparation failed and cleanup also failed: ${
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        }`,
        { cause: error }
      );
    }
    throw error;
  }
}

function metricDelta(skillValue, controlValue) {
  return typeof skillValue === "number" && typeof controlValue === "number"
    ? skillValue - controlValue
    : null;
}

function hasAvailableOutcome(result) {
  const grade = result?.grade;
  return Boolean(
    grade &&
      typeof grade.passed === "boolean" &&
      !grade.unavailable &&
      !grade.process_failed &&
      !grade.cleanup_failed
  );
}

export function buildPairedComparisons(results) {
  const byCase = new Map();
  for (const result of results) {
    const arms = byCase.get(result.case_id) ?? {};
    arms[result.arm] = result;
    byCase.set(result.case_id, arms);
  }
  const comparisons = [];
  for (const [caseId, pair] of byCase) {
    if (!pair.skill || !pair.control) continue;
    const skillOutcomeAvailable = hasAvailableOutcome(pair.skill);
    const controlOutcomeAvailable = hasAvailableOutcome(pair.control);
    const outcomeComparable = skillOutcomeAvailable && controlOutcomeAvailable;
    const performanceComparable = Boolean(
      outcomeComparable && pair.skill.metrics && pair.control.metrics
    );
    comparisons.push({
      case_id: caseId,
      skill_outcome_available: skillOutcomeAvailable,
      control_outcome_available: controlOutcomeAvailable,
      outcome_comparable: outcomeComparable,
      performance_comparable: performanceComparable,
      skill_passed: skillOutcomeAvailable ? pair.skill.grade.passed : null,
      control_passed: controlOutcomeAvailable ? pair.control.grade.passed : null,
      grade_delta: outcomeComparable
        ? Number(pair.skill.grade.passed) - Number(pair.control.grade.passed)
        : null,
      wall_time_ms_delta: performanceComparable
        ? metricDelta(
            pair.skill.metrics.wall_time_ms,
            pair.control.metrics.wall_time_ms
          )
        : null,
      response_utf8_bytes_delta: performanceComparable
        ? metricDelta(
            pair.skill.metrics.response_utf8_bytes,
            pair.control.metrics.response_utf8_bytes
          )
        : null,
      tool_call_count_delta: performanceComparable
        ? metricDelta(
            pair.skill.metrics.tool_call_count,
            pair.control.metrics.tool_call_count
          )
        : null,
      input_tokens_delta: performanceComparable
        ? metricDelta(
            pair.skill.metrics.usage?.input_tokens,
            pair.control.metrics.usage?.input_tokens
          )
        : null,
      output_tokens_delta: performanceComparable
        ? metricDelta(
            pair.skill.metrics.usage?.output_tokens,
            pair.control.metrics.usage?.output_tokens
          )
        : null,
    });
  }
  return comparisons;
}

export async function runLiveEvals({
  env = process.env,
  prepareWorkspace: prepareWorkspaceDependency = prepareWorkspace,
  buildLiveCommand: buildLiveCommandDependency = buildLiveCommand,
  runProcess: runProcessDependency = runProcess,
  parseHostOutput: parseHostOutputDependency = parseHostOutput,
  gradeResponse: gradeResponseDependency = gradeResponse,
  removeWorkspace = (workspace) => rm(workspace, { recursive: true, force: true }),
} = {}) {
  if (env.SOCRATES_LIVE_EVAL !== "1") {
    return { skipped: true, reason: "Set SOCRATES_LIVE_EVAL=1 to permit paid host calls." };
  }
  const host = env.SOCRATES_LIVE_EVAL_HOST;
  if (host !== "codex" && host !== "claude") {
    throw new Error("SOCRATES_LIVE_EVAL_HOST must be codex or claude");
  }
  const selection = env.SOCRATES_LIVE_EVAL_CASES;
  if (!selection) {
    throw new Error("SOCRATES_LIVE_EVAL_CASES must list case IDs or be 'all'");
  }
  const catalog = await validateEvalCatalog(await loadEvalCatalog());
  const selectedIds = new Set(selection.split(",").map((value) => value.trim()).filter(Boolean));
  const cases = catalog.cases.filter(
    (evalCase) =>
      evalCase.hosts.includes(host) &&
      evalCase.live_grader_id &&
      (selection === "all" || selectedIds.has(evalCase.id))
  );
  if (cases.length === 0) throw new Error("No live cases matched the requested host and IDs");
  if (selection !== "all" && cases.length !== selectedIds.size) {
    const found = new Set(cases.map((evalCase) => evalCase.id));
    throw new Error(`Unknown or incompatible live case IDs: ${[...selectedIds].filter((id) => !found.has(id)).join(", ")}`);
  }

  const timeoutMs = Number.parseInt(env.SOCRATES_LIVE_EVAL_TIMEOUT_MS ?? "180000", 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 900000) {
    throw new Error("SOCRATES_LIVE_EVAL_TIMEOUT_MS must be between 1000 and 900000");
  }
  const results = [];
  const arms = parseLiveArms(env.SOCRATES_LIVE_EVAL_ARMS ?? "skill");
  const reasoningEffort =
    host === "codex"
      ? env.SOCRATES_LIVE_EVAL_REASONING_EFFORT ?? null
      : null;
  if (
    reasoningEffort &&
    !["none", "low", "medium", "high", "xhigh", "max"].includes(reasoningEffort)
  ) {
    throw new Error(
      "SOCRATES_LIVE_EVAL_REASONING_EFFORT must be none, low, medium, high, xhigh, or max"
    );
  }
  const outputDir = path.resolve(
    env.SOCRATES_LIVE_EVAL_OUTPUT ??
      path.join(repoRoot, ".socrates-eval-results")
  );
  await ensureSafeOutputDirectory(outputDir);
  const outputPath = path.join(
    outputDir,
    `${host}-${Date.now()}-${randomUUID()}.json`
  );
  const reportHandle = await open(outputPath, "wx", 0o600);
  const startedAt = new Date().toISOString();
  try {
    const runningReport = Buffer.from(
      `${JSON.stringify({
        protocol: catalog.protocol,
        schema_version: catalog.schema_version,
        run_at: startedAt,
        host,
        arms,
        status: "running",
        deterministic: false,
        results: [],
      }, null, 2)}\n`,
      "utf8"
    );
    await writeCompleteReport(reportHandle, runningReport);
    await reportHandle.sync();

    for (const [caseIndex, evalCase] of cases.entries()) {
      const model =
        env.SOCRATES_LIVE_EVAL_MODEL ??
        catalog.model_sets[evalCase.models][host][0];
      const orderedArms = caseIndex % 2 === 0 ? arms : [...arms].reverse();
      for (const arm of orderedArms) {
        let workspace = null;
        let caseResult;
        try {
          workspace = await prepareWorkspaceDependency(host, evalCase, arm);
          const invocation = buildLiveCommandDependency({
            host,
            model,
            workspace,
            prompt: evalCase.prompt,
            reasoningEffort,
            arm,
            sourceEnv: env,
          });
          const processResult = await runProcessDependency(invocation, timeoutMs);
          const parsedOutput = parseHostOutputDependency(host, processResult.stdout);
          const response = parsedOutput.response;
          caseResult = {
            case_id: evalCase.id,
            arm,
            host,
            model,
            reasoning_effort: reasoningEffort,
            process: {
              code: processResult.code,
              signal: processResult.signal,
              timed_out: processResult.timedOut,
              error: processResult.error,
              stderr: processResult.stderr,
            },
            metrics: {
              wall_time_ms: processResult.wallTimeMs,
              raw_stdout_bytes: processResult.stdoutBytes,
              raw_stderr_bytes: processResult.stderrBytes,
              response_chars: response.length,
              response_utf8_bytes: Buffer.byteLength(response, "utf8"),
              question_mark_count: (response.match(/\?/gu) ?? []).length,
              ...parsedOutput.telemetry,
            },
            raw_stdout: processResult.stdout,
            response,
            grade:
              processResult.code === 0 &&
              !processResult.timedOut &&
              !processResult.error
                ? gradeResponseDependency(evalCase, response)
                : { passed: false, process_failed: true },
          };
        } catch (error) {
          caseResult = {
            case_id: evalCase.id,
            arm,
            host,
            model,
            reasoning_effort: reasoningEffort,
            process: {
              code: null,
              signal: null,
              timed_out: false,
              error: error instanceof Error ? error.message : String(error),
              stderr: "",
            },
            metrics: null,
            raw_stdout: "",
            response: "",
            grade: { passed: false, unavailable: true },
          };
        } finally {
          if (workspace) {
            try {
              await removeWorkspace(workspace);
            } catch (error) {
              const cleanupError =
                error instanceof Error ? error.message : String(error);
              caseResult.cleanup_error = cleanupError;
              caseResult.process.stderr = [
                caseResult.process.stderr,
                `Live eval workspace cleanup failed: ${cleanupError}`,
              ]
                .filter(Boolean)
                .join("\n");
              caseResult.grade = {
                passed: false,
                cleanup_failed: true,
              };
            }
          }
        }
        results.push(caseResult);
      }
    }

    const report = {
      protocol: catalog.protocol,
      schema_version: catalog.schema_version,
      run_at: startedAt,
      host,
      arms,
      reasoning_effort: reasoningEffort,
      deterministic: false,
      note: "Live model output is advisory response-only evidence. A single paired run is not a causal performance claim; missing host telemetry remains null and is never estimated.",
      passed: results.every((result) => result.grade.passed),
      comparisons: buildPairedComparisons(results),
      results,
    };
    await ensureSafeOutputDirectory(outputDir);
    await assertReportReservation(outputPath, reportHandle);
    const serialized = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeCompleteReport(reportHandle, serialized);
    await reportHandle.sync();
    await assertReportReservation(outputPath, reportHandle);
    return { ...report, output_path: outputPath };
  } finally {
    await reportHandle.close();
  }
}

export async function writeCompleteReport(handle, contents) {
  let offset = 0;
  while (offset < contents.length) {
    const { bytesWritten } = await handle.write(
      contents,
      offset,
      contents.length - offset,
      offset
    );
    if (bytesWritten === 0) {
      throw new Error("Live eval report write made no progress");
    }
    offset += bytesWritten;
  }
  await handle.truncate(contents.length);
}

async function assertReportReservation(outputPath, handle) {
  const [pathMetadata, handleMetadata] = await Promise.all([
    lstat(outputPath),
    handle.stat(),
  ]);
  if (
    pathMetadata.isSymbolicLink() ||
    !pathMetadata.isFile() ||
    !handleMetadata.isFile() ||
    pathMetadata.dev !== handleMetadata.dev ||
    pathMetadata.ino !== handleMetadata.ino
  ) {
    throw new Error(`Live eval report reservation was replaced: ${outputPath}`);
  }
}

export async function ensureSafeOutputDirectory(outputDir) {
  const resolved = path.resolve(outputDir);
  const parsed = path.parse(resolved);
  let cursor = parsed.root;
  for (const part of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      const metadata = await lstat(cursor);
      if (metadata.isSymbolicLink()) {
        throw new Error(`Live eval output path contains a symlink: ${cursor}`);
      }
      if (!metadata.isDirectory()) {
        throw new Error(`Live eval output path is not a directory: ${cursor}`);
      }
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") break;
      throw error;
    }
  }
  await mkdir(resolved, { recursive: true });
  const metadata = await lstat(resolved);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`Live eval output path is not a real directory: ${resolved}`);
  }
}

async function main() {
  const result = await runLiveEvals();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.skipped && !result.passed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
