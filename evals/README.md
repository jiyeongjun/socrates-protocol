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
