# Socrates Evaluations

`cases.json` is the canonical structured catalog and `cases.schema.json` documents its machine-readable shape. The catalog currently covers positive triggers, safe-local negatives, trust-boundary attacks, closure completeness, and installer/scaffolder fixtures.

Run deterministic evaluation with:

```bash
npm run test:evals
```

This validates every case and executes its listed static grader IDs. It does not call a model and does not claim model-behavior evidence. The normal test suite also runs semantic catalog tests and the failure-injection tests referenced by the catalog.

Optional live evaluation requires explicit permission for paid host calls, a host, and case selection:

```bash
SOCRATES_LIVE_EVAL=1 \
SOCRATES_LIVE_EVAL_HOST=codex \
SOCRATES_LIVE_EVAL_ARMS=skill,control \
SOCRATES_LIVE_EVAL_CASES=positive-valid-resume,security-vendor-ignore-instructions \
npm run eval:live
```

Supported hosts are `codex` and `claude`. `SOCRATES_LIVE_EVAL_ARMS=skill,control` runs a paired cohort. The `skill` arm copies and invokes the generated Socrates skill/native-agent artifacts; the `control` arm copies none of those host controls and omits every Socrates invocation. Case fixtures remain identical and may intentionally contain Socrates-shaped resume or adversarial task data. Host, requested model and effort, read-only controls, case prompt, fixture, and grader otherwise remain identical. Arm order alternates by case. The default remains `skill` for backward compatibility, and every additional arm adds another paid call per selected case.

For every case, the runner copies the selected fixture to a temporary workspace, creates temporary HOME/XDG/CODEX_HOME and Windows profile/config roots, filters the inherited environment, and removes the workspace afterward. It rejects fixture symlinks and case-insensitive host controls anywhere in the tree (`.agents`, `.claude`, `.codex`, `.eval-home`, `.git`, `.mcp.json`, `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, and `CLAUDE.local.md`) before launch. Only the exact arm-specific controls created by the runner are allowlisted after copying.

Codex runs with `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, and `--sandbox read-only`. `CODEX_HOME` is isolated under the temporary home, so Codex live evaluation requires `OPENAI_API_KEY` and never reads normal Codex configuration or OAuth state. Claude runs with `--bare`, an isolated `CLAUDE_CONFIG_DIR`, no session persistence, the exact tool allowlist `Read,Grep,Glob`, `--strict-mcp-config`, and an empty MCP configuration. Bare mode does not read OAuth/keychain credentials, so use an API key or configured third-party provider. These controls do not grant bypass permissions. Isolation may make a CLI or authentication unavailable; that outcome is recorded as unavailable evidence rather than a pass. Fixture and copied-workspace trees are checked before launch. Before a paid case starts, report directories with symlinked ancestry are rejected and a private report file is reserved; the reservation is revalidated before the final write.

Useful overrides:

- `SOCRATES_LIVE_EVAL_MODEL`: explicit host model or alias
- `SOCRATES_LIVE_EVAL_REASONING_EFFORT`: optional Codex override; omitted means host-selected effort
- `SOCRATES_LIVE_EVAL_ARMS`: comma-separated `skill`, `control`, or both; defaults to `skill`
- `SOCRATES_LIVE_EVAL_TIMEOUT_MS`: per-case timeout from 1,000 to 900,000 ms
- `SOCRATES_LIVE_EVAL_OUTPUT`: report directory; defaults to ignored `.socrates-eval-results/`
- `SOCRATES_LIVE_EVAL_CASES=all`: run every live-capable case deliberately

Live reports include the selected/requested host, model, Codex reasoning effort, and arm, plus raw stdout, parsed response, exit code, signal, stderr, timeout/error state, monotonic wall time, exact child-stream byte counts, a question-mark proxy, completeness, and machine-grade evidence. Turn count, completed item types, recognized tool calls, and input/output/cache token usage are recorded only when the host emits them; missing values remain `null` and are never estimated from characters. Paired reports expose outcome/performance comparability and include skill-minus-control deltas only when both arms produced genuine graded responses; CLI, authentication, process, or cleanup failures cannot become an interference delta. Per-case launch and cleanup errors are still written to the report. The runner does not independently prove backend model identity. This harness grades response-level instruction following and safety boundaries, not successful code mutation. One pair is nondeterministic advisory evidence, not a causal performance claim, and never alters the deterministic pass status. Timeout handling terminates the original process tree where supported and returns within a hard bound, but a deliberately detached descendant can escape that group and may require OS-level cleanup.
