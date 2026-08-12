# Socrates Model Regression Checklist

Use the structured catalog in `evals/cases.json`; do not substitute remembered prompts or treat static evidence as a live-model pass.

## Deterministic Gate

```bash
npm run build:skills
npm run verify:skills
npm run test:evals
npm test
```

The static runner validates the catalog schema, fixture containment, required scenario groups, trust rules, durable-state discovery, installer input rejection, and the presence of executable installer/scaffolder failure tests. CI runs this through `npm test` on Node 22 and 24.

## Optional Live Gate

Live calls are opt-in, ephemeral, and reported separately. Every case uses a temporary workspace and isolated HOME/XDG/CODEX_HOME roots with a filtered environment. Codex requests a read-only filesystem sandbox while ignoring user config and rules, and requires `OPENAI_API_KEY` instead of normal Codex OAuth state. Claude uses `--bare` and is limited to `Read,Grep,Glob` with a strict empty MCP configuration, so it needs API-key or configured provider authentication. Unsafe fixture symlinks and top-level host-control files are rejected before and after copying.

```bash
SOCRATES_LIVE_EVAL=1 \
SOCRATES_LIVE_EVAL_HOST=codex \
SOCRATES_LIVE_EVAL_ARMS=skill,control \
SOCRATES_LIVE_EVAL_CASES=positive-persisted-field-migration,security-contract-prompt-injection \
npm run eval:live
```

Use `SOCRATES_LIVE_EVAL_HOST=claude` for Claude Code. Set `SOCRATES_LIVE_EVAL_MODEL` only when comparing an explicit model override; otherwise the case's documented model set supplies the first host model. Leave `SOCRATES_LIVE_EVAL_REASONING_EFFORT` unset to inherit the host default, or set it only for a deliberate measured comparison. The paired `skill,control` cohort holds host flags and fixtures constant while the control workspace contains no Socrates skill/native-agent artifacts or invocation; case fixtures remain identical and may intentionally contain adversarial or resume-state data. Use `SOCRATES_LIVE_EVAL_CASES=all` only deliberately because every selected arm incurs a call.

Reports are written under ignored `.socrates-eval-results/`. They preserve raw stdout, parsed output, process status, stderr, timeout/error details, arm, wall time, completeness, the question-mark proxy, host-emitted turns/completed-items/tools/usage, comparability flags, paired deltas, and per-case unavailable results. Missing telemetry stays `null`; unavailable, process-failed, or cleanup-failed arms do not produce outcome or performance deltas. A missing CLI, authentication failure, timeout, nonzero exit, or grader mismatch is a failure or unavailable result, never a fabricated pass. Treat one pair as response-only advisory evidence, not causal implementation-performance proof.

## Host Interpretation

- Codex explicit invocation is `$socrates-contract`; Claude Code explicit invocation is `/socrates-contract`.
- Generated native agents inherit the host-selected model and reasoning effort. Their read-only role boundary applies only when a named agent is spawned; host, organization, invocation, and trust precedence still apply.
- `model-policy.json` is advisory. Neither host consumes it automatically.
- Add an explicit model or effort override only after a representative paired evaluation shows a measured need.

Record the host version, selected/requested model, selected case IDs, raw result path, machine grade, and any manual review. Treat model identity as requested configuration unless independently observed from the backend. Keep deterministic and live conclusions separate.
