# Socrates Evaluations

`cases.json` is the canonical evaluation catalog. It contains 22 cases in five groups:

- `explanation`: direct, technical, audience-ready, source-grounded, and brownfield feature explanations;
- `guided`: opening a lesson, misconceptions, partial answers, correct answers, uncertainty, changed representations, and quiz opt-out;
- `calibration`: children, age without stereotyping, mixed roles, bounded analogies, and language matching;
- `noninterference`: ordinary tasks and narrow deliverables that must not become lessons;
- `packaging`: generated Codex/Claude parity and installer layout.

Run the automated catalog checks with:

```bash
npm run test:evals
```

These checks validate the catalog, canonical/generated parity, package layout, reference routing, and explicit behavioral invariants. They do not call a model and do not prove model behavior.

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

Reports preserve raw output, parsed response, process state, timing, exact stream byte counts, available host telemetry, machine rubric results, and paired deltas only when both outcomes are genuinely comparable. Regex-based live graders are fast signals, not semantic proof; the question-count proxy ignores code and quoted examples but remains a punctuation heuristic. The guided live cases intentionally use cache freshness rather than the recursion example embedded in the skill reference. Final releases should also use independent forward tests with fresh model context, especially for the mastery gate.
