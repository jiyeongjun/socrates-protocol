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
SOCRATES_LIVE_EVAL_CASES=positive-persisted-field-migration,security-contract-prompt-injection \
npm run eval:live
```

Use `SOCRATES_LIVE_EVAL_HOST=claude` for Claude Code. Set `SOCRATES_LIVE_EVAL_MODEL` only when comparing an explicit model override; otherwise the case's documented model set supplies the first host model. Codex uses `SOCRATES_LIVE_EVAL_REASONING_EFFORT=high` by default; run the same selected cases with `medium` for a measured one-level-lower comparison. Use `SOCRATES_LIVE_EVAL_CASES=all` only deliberately because live calls may incur cost.

Reports are written under ignored `.socrates-eval-results/`. They preserve raw stdout, parsed output, process status, stderr, timeout/error details, and per-case unavailable results. A missing CLI, authentication failure, timeout, nonzero exit, or grader mismatch is a failure or unavailable result, never a fabricated pass.

## Host Interpretation

- Codex explicit invocation is `$socrates-contract`; Claude Code explicit invocation is `/socrates-contract`.
- Generated native agents request host settings only when a named agent is spawned. Host, organization, invocation, and trust precedence still apply.
- `model-policy.json` is advisory. Neither host consumes it automatically.
- Compare the documented `high` Codex baseline with `medium`; use `max` only for measured quality gain.
- `gpt-5.6-pro` is not a documented GPT-5.6 model slug. Do not generalize that statement to every historical or future model family.

Record the host version, selected/requested model, selected case IDs, raw result path, machine grade, and any manual review. Treat model identity as requested configuration unless independently observed from the backend. Keep deterministic and live conclusions separate.
