# Socrates Evaluations

## Writable, multi-turn alignment evaluation

Run the new behavior suite with the installed native CLI account:

```bash
SOCRATES_LIVE_EVAL=1 SOCRATES_ALIGNMENT_HOST=codex npm run eval:alignment
SOCRATES_LIVE_EVAL=1 SOCRATES_ALIGNMENT_HOST=claude npm run eval:alignment
```

Defaults are `gpt-6-astra` and `claude-fable-5-1`. Use a current CLI supporting the requested model. The runner never substitutes a fallback model. `SOCRATES_ALIGNMENT_MODEL` overrides the model; `SOCRATES_ALIGNMENT_CODEX_BIN` and `SOCRATES_ALIGNMENT_CLAUDE_BIN` select executables. `SOCRATES_ALIGNMENT_CASES` selects comma-separated case IDs; `SOCRATES_ALIGNMENT_OUTPUT` selects the report directory (default: ignored `.socrates-eval-results/`). Each turn has a five-minute timeout.

The five scenarios cover a four-turn batch feature with a corrected decision, contradictory requirements, an already approved exact edit, learning misconception repair, and learning question opt-out. The batch case reads real fixture code, settles failure handling, changes duplicate behavior, then confirms implementation. Independent acceptance code checks partial failure, order, sequential execution, duplicates after failure, per-call reset, exact string identity, empty input, and the existing API. Acceptance code is not mounted in the model workspace or shown before implementation.

The evaluator uses real session IDs for subsequent turns. File hashes are compared after each turn; raw tool traces and produced files are preserved in private reports before removing temporary workspaces. A missing session ID fails continuation. CLI sessions remain in the native host's history. Codex uses workspace-write sandboxing; Claude exposes file tools and permits Node commands, with hooks, setting sources, and MCP configuration disabled. No read-only restriction prevents the agent from making the edit under evaluation.

Native account authentication is retained rather than copied into an isolated HOME. Global skill discovery can still be visible; prompts explicitly select the fresh local skill copy. This suite tests behavior under those recorded conditions, not fully isolated skill/control performance. Claude's existing OAuth login is supported; the older `--bare` runner below requires API/provider credentials. Authentication or model-access failures are execution failures, not behavioral passes.

Mechanical checks do not establish semantic success: manually inspect the response and tool trace for premature edit attempts, policy invention, repeated questions, diagram/agreement contradictions, and incorrect approval handling. A file could be changed and restored within one turn, so an unchanged final hash alone is insufficient. Confirm that the batch diagram includes failure continuation and the corrected duplicate branch. Confirm that the simple approved edit proceeds and learning cases preserve their original behavior. Reports keep semantic review pending until a separate evidence-based review is recorded.

## Existing learning and packaging catalog

`cases.json` is the learning and packaging catalog. It contains 23 cases in five groups; the writable scenarios are defined separately in `run-alignment-evals.mjs`:

- `explanation`: visual-first concept and incident explanations, technical and audience-ready output, source-grounded walkthroughs, and brownfield feature explanations;
- `guided`: opening a lesson, misconceptions, partial answers, correct answers, uncertainty, changed representations, and quiz opt-out;
- `calibration`: children, age without stereotyping, mixed roles, bounded analogies, and language matching;
- `noninterference`: ordinary tasks and narrow deliverables that must not become lessons;
- `packaging`: generated Codex/Claude parity and installer layout.

Run the automated catalog checks with:

```bash
npm run test:evals
```

These 45 checks validate the catalog, canonical/generated parity, package layout, reference routing, and explicit behavioral invariants. They do not call a model and do not prove model behavior.

## Live paired evaluation

Live evaluation is opt-in because each selected case and arm may incur a model call:

```bash
SOCRATES_LIVE_EVAL=1 \
SOCRATES_LIVE_EVAL_HOST=claude \
SOCRATES_LIVE_EVAL_ARMS=skill,control \
SOCRATES_LIVE_EVAL_CASES=guided-cache-misconception,guided-cache-correct \
npm run eval:live
```

Supported hosts are `codex` and `claude`. The `skill` arm mounts and explicitly invokes Socrates; the `control` arm uses the same prompt, model, fixture, and read-only host controls without the skill. Arm order alternates by case.

The runner isolates each case in a temporary workspace, rejects symlinked or embedded host-control fixtures, uses a separate HOME and host configuration roots, and removes the workspace afterward. Codex uses an ephemeral read-only sandbox with user configuration and rules disabled. Claude uses bare mode, plan permissions, an empty MCP configuration, and only `Read`, `Grep`, and `Glob`.

Useful options:

- `SOCRATES_LIVE_EVAL_MODEL`: explicit host model or alias;
- `SOCRATES_LIVE_EVAL_CODEX_BIN`: absolute Codex executable path, useful when `codex` resolves through Volta or another HOME-dependent shim;
- `SOCRATES_LIVE_EVAL_CLAUDE_BIN`: absolute Claude executable path for the same situation;
- `SOCRATES_LIVE_EVAL_REASONING_EFFORT`: optional Codex reasoning override;
- `SOCRATES_LIVE_EVAL_ARMS`: `skill`, `control`, or `skill,control`;
- `SOCRATES_LIVE_EVAL_TIMEOUT_MS`: per-case timeout from 1,000 to 900,000 ms;
- `SOCRATES_LIVE_EVAL_OUTPUT`: report directory, defaulting to ignored `.socrates-eval-results/`;
- `SOCRATES_LIVE_EVAL_CASES=all`: deliberately run every live-capable case.

Reports preserve raw output, parsed response, process state, timing, exact stream byte counts, available host telemetry, machine rubric results, and paired deltas only when both outcomes are genuinely comparable. Regex-based live graders are fast signals, not semantic proof; the question-count proxy ignores code and quoted examples but remains a punctuation heuristic. The guided live cases intentionally use cache freshness rather than the recursion example embedded in the skill reference. Final releases should also use independent forward tests with fresh model context and inspect visual quality directly, especially for the alignment gate.

## Grounded learning matrix (v2.1)

```bash
SOCRATES_LIVE_EVAL=1 npm run eval:grounded
# Run just one supported host, or one explicit model/effort:
SOCRATES_LIVE_EVAL=1 SOCRATES_GROUNDED_HOST=claude npm run eval:grounded
SOCRATES_LIVE_EVAL=1 SOCRATES_GROUNDED_HOST=claude \
  SOCRATES_GROUNDED_MODEL=claude-sonnet-5-5 SOCRATES_GROUNDED_EFFORT=high npm run eval:grounded
```

The explicit matrix is GPT-6 Luna/Sol/Astra and Claude 5.5 Haiku/Sonnet/Opus, each at low and high effort. Availability depends on the installed CLI and account; there is no model fallback. `SOCRATES_GROUNDED_CONCURRENCY` accepts 1–4 (default 3); `SOCRATES_GROUNDED_CASES` selects comma-separated IDs; `SOCRATES_GROUNDED_OUTPUT` sets a private report directory. `SOCRATES_GROUNDED_CODEX_BIN` and `SOCRATES_GROUNDED_CLAUDE_BIN` select executable paths. Model access failures stop subsequent cases for that configuration; already running cases may finish. Each invocation has a five-minute timeout.

Six scenarios exercise equivalent minimum answers, a defective question, transfer after misconception repair, changed code evidence, implementation-versus-learning boundaries, and question opt-out. Every scenario is a fresh process with supplied prior-turn vignettes, not a real multi-turn continuation. Full skill references are supplied inline; prompts omit the evaluation criteria. This isolates response behavior from tool retrieval. Native authentication remains available. Claude tools/hooks/MCP are disabled; Codex still has filesystem read access and may discover global skills, so tool use invalidates the response-only sample. This is not a perfectly isolated skill/control experiment. Run before global installation and record the exact skill hashes.

Reports preserve prompts, raw streams, process status, session IDs when available, resolved Claude model IDs, and responses. Codex streams do not consistently expose resolved model IDs; the explicit requested model is recorded without inventing confirmation. A successful execution is **not** a semantic pass. Review actual responses against the criteria in `grounded-learning-cases.json`, including whether a table already disclosed a new question's answer or an unnecessary question extended a completed objective. Preserve failures and review evidence rather than treating regex scores as proof. The writable `eval:alignment` suite remains responsible for real implementation/approval behavior; `SOCRATES_ALIGNMENT_EFFORT` now selects an explicit effort for either host and is recorded in its report. Prompts are sent through stdin.

## Native file-loading response evaluation

```bash
SOCRATES_LIVE_EVAL=1 npm run eval:native
SOCRATES_LIVE_EVAL=1 SOCRATES_NATIVE_MODEL=claude-haiku-5-5 \
  SOCRATES_NATIVE_EFFORT=low npm run eval:native
```

This complements the full-bundle grounded matrix with a fresh Claude CLI context and temporary workspace for each case. The prompt selects the copied `SKILL.md`; the model chooses which routed references to read. Only `Read` is available. This tests explicit skill loading, not automatic discovery. The six Claude 5.5 model/effort combinations are the default; no model is substituted. GPT-6 response tests can use explicitly selected desktop agents when the installed Codex CLI does not support those IDs, but that is a different host and must be reported separately.

`SOCRATES_NATIVE_CASES` selects original grounded case IDs, `SOCRATES_NATIVE_CONCURRENCY` accepts 1–4, `SOCRATES_NATIVE_OUTPUT` selects a private output directory, and `SOCRATES_NATIVE_SOURCE_ROOT` selects a checkout for baseline comparisons. The runner snapshots the skill bundle before launching cases, records its hashes, and audits tool results against the snapshot. A missing, failed, incomplete initial skill read, unrelated file read, permission denial, unexpected tool, or model mismatch fails execution. The model never receives the case criteria. Raw prompts, tool traces, session IDs, responses, and audit details remain in the ignored output directory; publish sanitized evidence separately.

Native authentication and host history remain available as in the grounded suite. A valid file-loading trace does not prove a correct response. Apply the frozen semantic rubric separately, preserve failed pilots, and report full-bundle and native-loading results as separate cohorts. Repeated samples and judging variation must not be presented as reliable model rankings or pass-rate estimates.

The v2.1.2 report separates the five existing holdouts from `branch-outcome-regressions.json`, a targeted regression designed after observing a last-step outcome error. Neither forward prompt includes the grading criteria. See [release evidence](reports/2026-10-26-v2.1.2.md) for all cohorts, evaluator repairs, judgments, and remaining warnings.
