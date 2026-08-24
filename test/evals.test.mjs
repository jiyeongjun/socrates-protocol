import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEvalCatalog,
  runStaticEvals,
  validateEvalCatalog,
} from "../evals/run-static-evals.mjs";
import {
  buildPairedComparisons,
  buildLiveCommand,
  countQuestionMarksOutsideExamples,
  ensureSafeOutputDirectory,
  assertSafeFixtureTree,
  gradeResponse,
  liveGraderIds,
  parseHostOutput,
  parseLiveArms,
  prepareWorkspace,
  runLiveEvals,
  runProcess,
  writeCompleteReport,
} from "../evals/run-live-evals.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("structured eval catalog covers every required behavior and fixture group", async () => {
  const catalog = await validateEvalCatalog(await loadEvalCatalog());
  const schema = JSON.parse(
    await readFile(path.join(repoRoot, "evals/cases.schema.json"), "utf8")
  );
  assert.equal(schema.properties.protocol.const, catalog.protocol);
  assert.equal(schema.properties.schema_version.const, catalog.schema_version);

  const counts = Object.groupBy(catalog.cases, (evalCase) => evalCase.group);
  assert.ok(counts.explanation.length >= 5);
  assert.ok(counts.guided.length >= 7);
  assert.ok(counts.calibration.length >= 5);
  assert.ok(counts.noninterference.length >= 2);
  assert.ok(counts.packaging.length >= 3);

  const ids = new Set(catalog.cases.map((evalCase) => evalCase.id));
  for (const required of [
    "explain-database-index-eli5",
    "explain-race-condition-engineer",
    "deliverable-manager-rate-limit",
    "explain-source-grounded-code",
    "explain-brownfield-scheduled-orders",
    "guided-photosynthesis-opening",
    "guided-cache-misconception",
    "guided-cache-partial",
    "guided-cache-correct",
    "guided-cache-uncertain",
    "guided-change-representation",
    "guided-user-opts-out",
    "calibrate-child-gravity",
    "calibrate-age-without-stereotype",
    "calibrate-mixed-audience",
    "calibrate-analogy-boundary",
    "calibrate-korean-language",
    "noninterference-ordinary-code-edit",
    "noninterference-ready-deliverable",
    "packaging-codex-skill",
    "packaging-claude-skill",
    "packaging-installer-layout",
  ]) {
    assert.ok(ids.has(required), `missing required eval case ${required}`);
  }

  const visualCase = catalog.cases.find(
    (evalCase) => evalCase.id === "explain-database-index-eli5"
  );
  assert.ok(visualCase.required_output_fields.includes("small visual"));
  assert.ok(visualCase.static_grader_ids.includes("visual-explanation"));

  const brownfieldCase = catalog.cases.find(
    (evalCase) => evalCase.id === "explain-brownfield-scheduled-orders"
  );
  assert.equal(brownfieldCase.fixture, "fixtures/brownfield-orders");
  assert.deepEqual(brownfieldCase.expected_questions, { min: 0, max: 0 });
  assert.ok(brownfieldCase.required_output_fields.includes("preserved invariants"));
  assert.ok(brownfieldCase.required_output_fields.includes("proposed extension point"));
  assert.ok(brownfieldCase.static_grader_ids.includes("brownfield-grounding"));
  assert.ok(brownfieldCase.static_grader_ids.includes("brownfield-fixture"));

  const knownLiveGraders = new Set(liveGraderIds);
  for (const evalCase of catalog.cases) {
    if (evalCase.live_grader_id) {
      assert.ok(
        knownLiveGraders.has(evalCase.live_grader_id),
        `unknown live grader ${evalCase.live_grader_id}`
      );
    }
  }
});

test("static eval runner executes every case and machine grader", async () => {
  const summary = await runStaticEvals();
  assert.equal(summary.passed, true);
  assert.equal(summary.cases, 22);
  assert.equal(summary.grader_checks, 42);
  assert.deepEqual(summary.failures, []);
});

test("eval validation rejects unsafe fixtures, duplicates, and unknown graders", async () => {
  const original = await loadEvalCatalog();

  const unsafe = structuredClone(original);
  unsafe.cases[0].fixture = "fixtures/../outside";
  await assert.rejects(validateEvalCatalog(unsafe), /unsafe fixture path/i);

  const duplicate = structuredClone(original);
  duplicate.cases[1].id = duplicate.cases[0].id;
  await assert.rejects(validateEvalCatalog(duplicate), /duplicate eval id/i);

  const unknown = structuredClone(original);
  unknown.cases[0].static_grader_ids = ["not-a-grader"];
  await assert.rejects(validateEvalCatalog(unknown), /unknown static grader/i);
});

test("optional live commands keep skill and control arms isolated under identical host settings", () => {
  const codex = buildLiveCommand({
    host: "codex",
    model: "gpt-5.6-sol",
    workspace: "/tmp/eval",
    prompt: "Review this case",
  });
  assert.equal(codex.command, "codex");
  assert.deepEqual(
    codex.args.slice(codex.args.indexOf("--sandbox"), codex.args.indexOf("--sandbox") + 2),
    ["--sandbox", "read-only"]
  );
  assert.ok(codex.args.includes("--ephemeral"));
  assert.ok(codex.args.includes("--ignore-user-config"));
  assert.ok(codex.args.includes("--ignore-rules"));
  assert.equal(codex.args.includes("--config"), false);
  assert.match(codex.args.at(-1), /\$socrates/);
  assert.doesNotMatch(codex.args.join(" "), /dangerously-bypass/);
  assert.equal(codex.env.HOME, "/tmp/eval/.eval-home");
  assert.equal(codex.env.CODEX_HOME, "/tmp/eval/.eval-home/codex-home");
  assert.equal(codex.env.USERPROFILE, "/tmp/eval/.eval-home");
  assert.equal(codex.env.APPDATA, "/tmp/eval/.eval-home/AppData/Roaming");
  assert.equal(codex.env.LOCALAPPDATA, "/tmp/eval/.eval-home/AppData/Local");
  assert.notEqual(codex.env.HOME, process.env.HOME);

  const codexControl = buildLiveCommand({
    host: "codex",
    model: "gpt-5.6-sol",
    workspace: "/tmp/eval",
    prompt: "Review this case",
    arm: "control",
  });
  for (const flag of [
    "--sandbox",
    "--skip-git-repo-check",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--json",
    "--model",
    "--cd",
  ]) {
    assert.ok(codex.args.includes(flag));
    assert.ok(codexControl.args.includes(flag));
  }
  assert.equal(codexControl.args.includes("--config"), false);
  assert.deepEqual(codexControl.args.slice(0, -1), codex.args.slice(0, -1));
  const codexMediumSkill = buildLiveCommand({
    host: "codex",
    model: "gpt-5.6-sol",
    workspace: "/tmp/eval",
    prompt: "Review this case",
    reasoningEffort: "medium",
  });
  const codexMediumControl = buildLiveCommand({
    host: "codex",
    model: "gpt-5.6-sol",
    workspace: "/tmp/eval",
    prompt: "Review this case",
    reasoningEffort: "medium",
    arm: "control",
  });
  assert.deepEqual(
    codexMediumControl.args.slice(0, -1),
    codexMediumSkill.args.slice(0, -1)
  );
  const controlConfigIndex = codexMediumControl.args.indexOf("--config");
  assert.equal(
    codexMediumControl.args[controlConfigIndex + 1],
    'model_reasoning_effort="medium"'
  );
  assert.doesNotMatch(codexControl.args.at(-1), /\$socrates/i);
  assert.match(codexControl.args.at(-1), /^Review this case/m);

  const pinnedCodex = buildLiveCommand({
    host: "codex",
    model: "gpt-5.6-sol",
    workspace: "/tmp/eval",
    prompt: "Review this case",
    sourceEnv: {
      PATH: process.env.PATH,
      SOCRATES_LIVE_EVAL_CODEX_BIN: "/opt/tools/codex",
    },
  });
  assert.equal(pinnedCodex.command, "/opt/tools/codex");
  assert.throws(
    () =>
      buildLiveCommand({
        host: "codex",
        model: "gpt-5.6-sol",
        workspace: "/tmp/eval",
        prompt: "Review this case",
        sourceEnv: { SOCRATES_LIVE_EVAL_CODEX_BIN: "relative/codex" },
      }),
    /absolute executable path/i
  );

  const claude = buildLiveCommand({
    host: "claude",
    model: "sonnet",
    workspace: "/tmp/eval",
    prompt: "Review this case",
  });
  assert.equal(claude.command, "claude");
  assert.ok(claude.args.includes("--bare"));
  assert.ok(claude.args.includes("plan"));
  const toolsIndex = claude.args.indexOf("--tools");
  assert.ok(toolsIndex >= 0);
  assert.equal(claude.args[toolsIndex + 1], "Read,Grep,Glob");
  assert.ok(claude.args.includes("--strict-mcp-config"));
  const mcpIndex = claude.args.indexOf("--mcp-config");
  assert.ok(mcpIndex >= 0);
  assert.equal(claude.args[mcpIndex + 1], '{"mcpServers":{}}');
  assert.doesNotMatch(claude.args.join(" "), /--allowed-tools|--setting-sources/);
  assert.ok(claude.args.includes("--no-session-persistence"));
  assert.match(claude.args.at(-1), /^\/socrates/);
  assert.doesNotMatch(claude.args.join(" "), /dangerously-skip/);
  assert.equal(claude.env.HOME, "/tmp/eval/.eval-home");
  assert.equal(claude.env.CLAUDE_CONFIG_DIR, "/tmp/eval/.eval-home/claude-config");
  assert.notEqual(claude.env.HOME, process.env.HOME);

  const claudeControl = buildLiveCommand({
    host: "claude",
    model: "sonnet",
    workspace: "/tmp/eval",
    prompt: "Review this case",
    arm: "control",
  });
  assert.doesNotMatch(claudeControl.args.at(-1), /^\/socrates/i);
  assert.deepEqual(claudeControl.args.slice(0, -1), claude.args.slice(0, -1));

  const pinnedClaude = buildLiveCommand({
    host: "claude",
    model: "sonnet",
    workspace: "/tmp/eval",
    prompt: "Review this case",
    sourceEnv: {
      PATH: process.env.PATH,
      SOCRATES_LIVE_EVAL_CLAUDE_BIN: "/opt/tools/claude",
    },
  });
  assert.equal(pinnedClaude.command, "/opt/tools/claude");
});

test("live arm parser accepts explicit cohorts and rejects ambiguous input", () => {
  assert.deepEqual(parseLiveArms(), ["skill"]);
  assert.deepEqual(parseLiveArms("skill,control"), ["skill", "control"]);
  assert.throws(() => parseLiveArms("skill,skill"), /unique/i);
  assert.throws(() => parseLiveArms("baseline"), /skill and control/i);
});

test("live output parsers preserve host telemetry without estimating missing values", () => {
  const codex = parseHostOutput(
    "codex",
    [
      JSON.stringify({
        type: "item.started",
        item: { id: "tool-1", type: "command_execution" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { id: "tool-1", type: "command_execution" },
      }),
      JSON.stringify({
        type: "item.completed",
        item: { id: "tool-1", type: "command_execution" },
      }),
      "not-json",
      JSON.stringify({
        type: "item.completed",
        item: { id: "message-1", type: "agent_message", text: "Final answer?" },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 10, output_tokens: 4, cached_input_tokens: 3 },
      }),
    ].join("\n")
  );
  assert.equal(codex.response, "Final answer?");
  assert.equal(codex.telemetry.turn_count, 1);
  assert.equal(codex.telemetry.tool_call_count, 1);
  assert.deepEqual(codex.telemetry.tool_calls_by_type, { command_execution: 1 });
  assert.deepEqual(codex.telemetry.item_type_counts, {
    command_execution: 1,
    agent_message: 1,
  });
  assert.deepEqual(codex.telemetry.usage, {
    input_tokens: 10,
    output_tokens: 4,
    cached_input_tokens: 3,
  });

  const claude = parseHostOutput(
    "claude",
    JSON.stringify({
      result: "Claude result",
      num_turns: 2,
      duration_ms: 80,
      duration_api_ms: 60,
      total_cost_usd: 0.01,
      usage: { input_tokens: 7, output_tokens: 5, cache_read_input_tokens: 2 },
    })
  );
  assert.equal(claude.response, "Claude result");
  assert.equal(claude.telemetry.turn_count, 2);
  assert.equal(claude.telemetry.item_type_counts, null);
  assert.equal(claude.telemetry.tool_call_count, null);
  assert.equal(claude.telemetry.tool_calls_by_type, null);
  assert.equal(claude.telemetry.host_cost_usd, 0.01);
  assert.deepEqual(claude.telemetry.usage, {
    input_tokens: 7,
    output_tokens: 5,
    cached_input_tokens: 2,
  });

  const malformed = parseHostOutput("claude", "not-json");
  assert.equal(malformed.response, "not-json");
  assert.deepEqual(malformed.telemetry.usage, {
    input_tokens: null,
    output_tokens: null,
    cached_input_tokens: null,
  });

  const plainCodex = parseHostOutput("codex", "plain, non-JSON output");
  assert.equal(plainCodex.response, "plain, non-JSON output");
  assert.equal(plainCodex.telemetry.item_type_counts, null);
  assert.equal(plainCodex.telemetry.tool_call_count, null);
  assert.equal(plainCodex.telemetry.tool_calls_by_type, null);
});

test("live grading ignores question marks inside quoted examples", () => {
  const evalCase = {
    live_grader_id: "ordinary-task",
    expected_questions: { min: 0, max: 0 },
  };
  const grade = gradeResponse(
    evalCase,
    "Rename parseCount to parseInteger, update the focused test, and run verification."
  );
  assert.equal(grade.passed, true);
  assert.deepEqual(grade.completeness, { matched: 3, required: 3, ratio: 1 });
  assert.equal(grade.question_mark_count, 0);
  assert.equal("question_count" in grade, false);

  const managerGrade = gradeResponse(
    {
      live_grader_id: "manager-deliverable",
      expected_questions: { min: 0, max: 0 },
    },
    'Peak-time failures occur because every "is this card valid?" request counts toward the limit. We can reduce calls or pay for a higher tier. I recommend reducing calls first, then deciding whether the added cost is justified.'
  );
  assert.equal(managerGrade.passed, true);
  assert.equal(managerGrade.question_mark_count, 0);

  const misconceptionGrade = gradeResponse(
    {
      live_grader_id: "mastery-misconception",
      expected_questions: { min: 1, max: 1 },
    },
    "Not quite—the cached copy has no awareness of the original by itself. Suppose the cache stores A, then the original changes to B. When requested, will the cache return A or B, and why?"
  );
  assert.equal(misconceptionGrade.passed, true);

  const correctGrade = gradeResponse(
    {
      live_grader_id: "mastery-correct",
      expected_questions: { min: 1, max: 1 },
    },
    "Expiration or invalidation makes the cached copy unusable, and a later read repopulates it. What stale data might readers see, and what trade-off would a shorter TTL create?"
  );
  assert.equal(correctGrade.passed, true);

  const abstractCorrectGrade = gradeResponse(
    {
      live_grader_id: "mastery-correct",
      expected_questions: { min: 1, max: 1 },
    },
    "The cache is passive: freshness comes from expiration or invalidation. TTL bounds staleness by time, while invalidation bounds it by event. Which failure mode is safer when invalidation signals can be lost?"
  );
  assert.equal(abstractCorrectGrade.passed, true);

  const managerDecisionGrade = gradeResponse(
    {
      live_grader_id: "manager-deliverable",
      expected_questions: { min: 0, max: 1 },
    },
    "Peak-time failures are affecting users. We can reduce calls through engineering work or pay for a higher tier. Decision needed: which option best balances engineering time and added cost? I can tighten this draft once the cost figures are available."
  );
  assert.equal(managerDecisionGrade.passed, true);
  assert.equal(managerDecisionGrade.question_mark_count, 1);

  assert.equal(
    countQuestionMarksOutsideExamples(
      'An unmatched "example delimiter must not hide this real question?'
    ),
    1
  );
});

test("direct explanation grader requires a compact explanatory visual", () => {
  const evalCase = {
    live_grader_id: "direct-eli5",
    expected_questions: { min: 0, max: 0 },
  };
  const withVisual = gradeResponse(
    evalCase,
    "A database index is like a book index: it helps the database find a row without searching every page. Index entry -> row location -> matching row. That makes lookups faster, at the cost of extra storage and update work."
  );
  assert.equal(withVisual.passed, true);

  const proseOnly = gradeResponse(
    evalCase,
    "A database index is like a book index: it helps the database find a row without searching every page, so lookups are faster."
  );
  assert.equal(proseOnly.passed, false);
  assert.equal(proseOnly.missing_patterns.length, 1);
});

test("brownfield grader requires source-grounded flow, invariants, proposals, and tests", () => {
  const evalCase = {
    live_grader_id: "brownfield-feature",
    expected_questions: { min: 0, max: 0 },
  };
  const response = [
    "Current flow: findByIdempotencyKey -> inventory.reserve -> payments.authorize -> orders.insert -> events.publish order.confirmed.",
    "Invariants to preserve: idempotency precedes side effects, persistence precedes the event, and downstream failure releases inventory.",
    "A likely proposal is a new scheduled state plus a scheduler or worker; that design is not present in the current code.",
    "Tests should cover duplicate requests, ordering, release on failure, and scheduled execution.",
  ].join("\n\n");
  assert.equal(gradeResponse(evalCase, response).passed, true);

  const mutationClaim = gradeResponse(evalCase, `${response}\n\nI implemented the worker.`);
  assert.equal(mutationClaim.passed, false);
  assert.equal(mutationClaim.forbidden_patterns.length, 1);
});

test("paired comparisons separate outcome from nullable performance deltas", () => {
  const comparisons = buildPairedComparisons([
    {
      case_id: "case-one",
      arm: "skill",
      grade: { passed: true },
      metrics: {
        wall_time_ms: 120,
        response_utf8_bytes: 80,
        tool_call_count: 1,
        usage: { input_tokens: 20, output_tokens: 10 },
      },
    },
    {
      case_id: "case-one",
      arm: "control",
      grade: { passed: false },
      metrics: {
        wall_time_ms: 100,
        response_utf8_bytes: 50,
        tool_call_count: null,
        usage: { input_tokens: null, output_tokens: 8 },
      },
    },
  ]);
  assert.deepEqual(comparisons, [
    {
      case_id: "case-one",
      skill_outcome_available: true,
      control_outcome_available: true,
      outcome_comparable: true,
      performance_comparable: true,
      skill_passed: true,
      control_passed: false,
      grade_delta: 1,
      wall_time_ms_delta: 20,
      response_utf8_bytes_delta: 30,
      tool_call_count_delta: null,
      input_tokens_delta: null,
      output_tokens_delta: 2,
    },
  ]);

  const unavailable = buildPairedComparisons([
    {
      case_id: "unavailable-case",
      arm: "skill",
      grade: { passed: false, unavailable: true },
      metrics: null,
    },
    {
      case_id: "unavailable-case",
      arm: "control",
      grade: { passed: true },
      metrics: {
        wall_time_ms: 100,
        response_utf8_bytes: 50,
        tool_call_count: 0,
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    },
  ]);
  assert.deepEqual(unavailable, [
    {
      case_id: "unavailable-case",
      skill_outcome_available: false,
      control_outcome_available: true,
      outcome_comparable: false,
      performance_comparable: false,
      skill_passed: null,
      control_passed: true,
      grade_delta: null,
      wall_time_ms_delta: null,
      response_utf8_bytes_delta: null,
      tool_call_count_delta: null,
      input_tokens_delta: null,
      output_tokens_delta: null,
    },
  ]);
  for (const failureFlag of ["process_failed", "cleanup_failed"]) {
    const [comparison] = buildPairedComparisons([
      {
        case_id: `${failureFlag}-case`,
        arm: "skill",
        grade: { passed: false, [failureFlag]: true },
        metrics: {
          wall_time_ms: 200,
          response_utf8_bytes: 10,
          tool_call_count: 0,
          usage: { input_tokens: 4, output_tokens: 2 },
        },
      },
      {
        case_id: `${failureFlag}-case`,
        arm: "control",
        grade: { passed: true },
        metrics: {
          wall_time_ms: 100,
          response_utf8_bytes: 8,
          tool_call_count: 0,
          usage: { input_tokens: 3, output_tokens: 1 },
        },
      },
    ]);
    assert.equal(comparison.skill_outcome_available, false);
    assert.equal(comparison.outcome_comparable, false);
    assert.equal(comparison.performance_comparable, false);
    assert.equal(comparison.skill_passed, null);
    assert.equal(comparison.grade_delta, null);
    assert.equal(comparison.wall_time_ms_delta, null);
  }
});

test("live fixture validation rejects symlinks and host control state", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-live-fixture-"));
  const rootLink = `${root}-link`;
  try {
    await symlink(root, rootLink, "dir");
    await assert.rejects(assertSafeFixtureTree(rootLink), /root is a symlink/i);
    await rm(rootLink);
    await mkdir(path.join(root, "safe"));
    await symlink(path.join(root, "safe"), path.join(root, "linked"));
    await assert.rejects(assertSafeFixtureTree(root), /contains a symlink/i);
    await rm(path.join(root, "linked"));
    for (const name of [
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
      "agents.md",
      "AgEnTs.override.Md",
      ".Git",
    ]) {
      const target = path.join(root, name);
      if (name.endsWith(".md") || name.endsWith(".json")) {
        await writeFile(target, "fixture control\n", "utf8");
      } else {
        await mkdir(target);
      }
      await assert.rejects(assertSafeFixtureTree(root), /host control state/i);
      await rm(target, { recursive: true, force: true });
    }
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "AGENTS.md"), "nested control\n", "utf8");
    await assert.rejects(assertSafeFixtureTree(root), /host control state/i);
  } finally {
    await rm(rootLink, { force: true });
    await rm(root, { recursive: true, force: true });
  }
});

test("live report output rejects symlinked directory ancestry", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "socrates-live-output-"));
  const outside = await mkdtemp(path.join(tmpdir(), "socrates-live-output-outside-"));
  const linked = path.join(root, "linked");
  await symlink(outside, linked, "dir");
  await assert.rejects(
    ensureSafeOutputDirectory(path.join(linked, "reports")),
    /contains a symlink/i
  );
  assert.deepEqual(await readdir(outside), []);
});

test("live report writes retry partial positional writes without corrupting JSON", async () => {
  const contents = Buffer.from('{"passed":true}\n', "utf8");
  const destination = Buffer.alloc(contents.length);
  let truncatedTo = null;
  const handle = {
    async write(buffer, offset, length, position) {
      const bytesWritten = Math.min(3, length);
      buffer.copy(destination, position, offset, offset + bytesWritten);
      return { bytesWritten };
    },
    async truncate(length) {
      truncatedTo = length;
    },
  };

  await writeCompleteReport(handle, contents);
  assert.equal(destination.toString("utf8"), contents.toString("utf8"));
  assert.equal(truncatedTo, contents.length);
  await assert.rejects(
    writeCompleteReport(
      {
        async write() {
          return { bytesWritten: 0 };
        },
        async truncate() {},
      },
      contents
    ),
    /made no progress/i
  );
});

test("live process preserves split UTF-8 and exact raw stream byte counts", async () => {
  const result = await runProcess(
    {
      command: process.execPath,
      args: [
        "-e",
        "process.stdout.write(Buffer.from([0xe2])); process.stderr.write(Buffer.from([0xf0, 0x9f])); setTimeout(() => { process.stdout.write(Buffer.from([0x82, 0xac])); process.stderr.write(Buffer.from([0x98, 0x80])); }, 20)",
      ],
      cwd: repoRoot,
      env: process.env,
    },
    1000
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "€");
  assert.equal(result.stderr, "😀");
  assert.equal(result.stdoutBytes, 3);
  assert.equal(result.stderrBytes, 4);
});

test("live workspace preparation isolates both controls and preserves non-null fixtures", async () => {
  const evalCase = { fixture: "fixtures/source-grounded" };
  const fixtureRelative = "retry.js";
  const fixtureSource = await readFile(
    path.join(repoRoot, "evals", evalCase.fixture, fixtureRelative),
    "utf8"
  );
  for (const host of ["codex", "claude"]) {
    const prepared = {};
    for (const arm of ["skill", "control"]) {
      prepared[arm] = await prepareWorkspace(host, evalCase, arm);
    }
    try {
      await assertSafeFixtureTree(prepared.skill, "", {
        allowedHostControls:
          host === "codex"
            ? new Set([".agents", ".eval-home"])
            : new Set([".claude", ".eval-home"]),
      });
      await assertSafeFixtureTree(prepared.control, "", {
        allowedHostControls: new Set([".eval-home"]),
      });
      const skillEntries = await readdir(prepared.skill);
      const controlEntries = await readdir(prepared.control);
      assert.equal(skillEntries.includes(".agents"), host === "codex");
      assert.equal(skillEntries.includes(".codex"), false);
      assert.equal(skillEntries.includes(".claude"), host === "claude");
      for (const hostControl of [".agents", ".codex", ".claude"]) {
        assert.equal(controlEntries.includes(hostControl), false);
      }
      assert.equal(
        await readFile(path.join(prepared.skill, fixtureRelative), "utf8"),
        fixtureSource
      );
      assert.equal(
        await readFile(path.join(prepared.control, fixtureRelative), "utf8"),
        fixtureSource
      );
    } finally {
      await rm(prepared.skill, { recursive: true, force: true });
      await rm(prepared.control, { recursive: true, force: true });
    }
  }
});

test("live orchestration pairs arms in alternating order without model or network calls", async () => {
  const outputRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "socrates-live-orchestration-"))
  );
  const calls = [];
  const fakeRunProcess = async (invocation) => {
    const renderedPrompt = invocation.args.at(-1);
    const caseId = renderedPrompt.includes("parseCount")
      ? "noninterference-ordinary-code-edit"
      : "noninterference-ready-deliverable";
    const arm = renderedPrompt.includes("$socrates") ? "skill" : "control";
    calls.push([caseId, arm]);
    if (caseId === "noninterference-ready-deliverable" && arm === "skill") {
      return {
        code: 2,
        signal: null,
        stdout: "",
        stderr: "injected host failure",
        timedOut: false,
        error: null,
        wallTimeMs: 9,
        stdoutBytes: 0,
        stderrBytes: Buffer.byteLength("injected host failure", "utf8"),
      };
    }
    const stdout = [
      JSON.stringify({
        type: "item.completed",
        item: {
          id: `${caseId}-${arm}-message`,
          type: "agent_message",
          text:
            caseId === "noninterference-ordinary-code-edit"
              ? "Rename parseCount to parseInteger, update its test, and run verification."
              : "The database issue was resolved and service was restored.",
        },
      }),
      JSON.stringify({
        type: "turn.completed",
        usage: { input_tokens: 10, output_tokens: 6 },
      }),
    ].join("\n");
    return {
      code: 0,
      signal: null,
      stdout,
      stderr: "",
      timedOut: false,
      error: null,
      wallTimeMs: arm === "skill" ? 12 : 10,
      stdoutBytes: Buffer.byteLength(stdout, "utf8"),
      stderrBytes: 0,
    };
  };

  try {
    const report = await runLiveEvals({
      env: {
        PATH: process.env.PATH,
        SOCRATES_LIVE_EVAL: "1",
        SOCRATES_LIVE_EVAL_HOST: "codex",
        SOCRATES_LIVE_EVAL_ARMS: "skill,control",
        SOCRATES_LIVE_EVAL_CASES:
          "noninterference-ordinary-code-edit,noninterference-ready-deliverable",
        SOCRATES_LIVE_EVAL_OUTPUT: path.join(outputRoot, "reports"),
      },
      runProcess: fakeRunProcess,
    });
    assert.deepEqual(calls, [
      ["noninterference-ordinary-code-edit", "skill"],
      ["noninterference-ordinary-code-edit", "control"],
      ["noninterference-ready-deliverable", "control"],
      ["noninterference-ready-deliverable", "skill"],
    ]);
    assert.deepEqual(report.arms, ["skill", "control"]);
    assert.deepEqual(
      report.results.map(({ case_id: caseId, arm }) => [caseId, arm]),
      calls
    );
    const successfulPair = report.comparisons.find(
      ({ case_id: caseId }) => caseId === "noninterference-ordinary-code-edit"
    );
    assert.equal(successfulPair.outcome_comparable, true);
    assert.equal(successfulPair.performance_comparable, true);
    assert.equal(successfulPair.grade_delta, 0);
    assert.equal(successfulPair.wall_time_ms_delta, 2);
    const failedPair = report.comparisons.find(
      ({ case_id: caseId }) => caseId === "noninterference-ready-deliverable"
    );
    assert.equal(failedPair.skill_outcome_available, false);
    assert.equal(failedPair.control_outcome_available, true);
    assert.equal(failedPair.outcome_comparable, false);
    assert.equal(failedPair.performance_comparable, false);
    assert.equal(failedPair.skill_passed, null);
    assert.equal(failedPair.grade_delta, null);
    assert.equal(failedPair.wall_time_ms_delta, null);
    const persisted = JSON.parse(await readFile(report.output_path, "utf8"));
    assert.deepEqual(persisted.arms, report.arms);
    assert.deepEqual(persisted.comparisons, report.comparisons);
    assert.deepEqual(
      persisted.results.map(({ case_id: caseId, arm }) => [caseId, arm]),
      calls
    );
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test(
  "live process timeout returns without waiting on escaped descendant pipes",
  { skip: process.platform === "win32" },
  async () => {
    const startedAt = Date.now();
    const result = await runProcess(
      {
        command: process.execPath,
        args: [
          "-e",
          "const { spawn } = require('node:child_process'); const escaped = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 3000)'], { detached: true, stdio: ['ignore', process.stdout, process.stderr] }); escaped.unref(); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
        ],
        cwd: repoRoot,
        env: process.env,
      },
      50,
      50
    );
    assert.equal(result.timedOut, true);
    assert.equal(result.signal, "SIGKILL");
    assert.ok(Date.now() - startedAt < 1000, "timeout must not wait on escaped pipes");
  }
);
