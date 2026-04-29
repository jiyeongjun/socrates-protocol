# Orchestration

Use this when Socrates needs to coordinate exploration, implementation, verification, inline evaluation, and the single repair loop.

## Flow
1. Start with one short current-state exploration pass before asking the user or editing code. Use it to classify fast path versus deeper exploration.
2. If the short pass finds a protected surface, likely cross-boundary impact, unclear ownership, or rollout-sensitive touchpoints, expand to one deeper read-only exploration pass before continuing.
3. In a deeper exploration pass, recover the main entrypoints or callers, relevant contract, config, persistence, or migration touchpoints, the narrowest useful repro or tests, and the compatibility, rollback, or rollout constraints that could change the implementation.
4. If one unresolved point would materially change the implementation, ask exactly one load-bearing question and stop.
5. Implement only after the path is explicit enough and the required exploration coverage is satisfied.
6. Run the narrowest relevant verification first.
7. Run one inline read-only quality evaluation pass after verification when repo-tracked code changed on a protected surface, cross-module path, deeper-exploration path, or other nontrivial Socrates path. For trivial explicit edits, a narrow verification plus self-check is enough.
8. If evaluation finds actionable drift and no repair loop has been spent yet, do exactly one inline repair loop, then re-verify and re-evaluate.
9. If evaluation still finds actionable drift after that inline repair loop, ask the user what to do next.

## Roles
- `fast_explorer`: read-only discovery pass that classifies fast path versus deeper exploration and recovers the current implementation shape
- `protected_surface_planner`: read-only planning pass for migrations, compatibility, rollback, and safety policy after the required deeper exploration coverage is in hand
- `fast_verifier`: cheap verification pass that runs the narrowest relevant checks first
- `quality_evaluator`: read-only quality gate that checks requirement fit, regression risk, missing coverage, and whether one inline repair loop is warranted

## Host Model Guidance
- Keep model names out of the main skill text.
- Read `model-policy.json` at the Socrates skill root for per-platform role aliases and ordered fallbacks.
- Treat the policy as guidance, not a requirement to delegate. Keep role work inline unless the host already supports an isolated worker or subagent and delegation will not block the next step.
- On Codex, prefer the host default when a requested model alias is unavailable. For lightweight explorer or verifier roles, prefer the current mini or fast coding model when available.
- On Claude Code, use subagent frontmatter `model` aliases (`haiku`, `sonnet`, `opus`, or `inherit`) when a custom subagent is present. Exact Claude model versions and availability come from `/model`.

## Rules
- Exploration is mandatory for Socrates-triggered work, but hook enforcement only applies when `SOCRATES_CONTEXT.md` exists.
- "Fast path" only skips extra clarification, protected-surface planning, shared-context ceremony, and evaluator ceremony when narrow verification covers the request. It does not waive post-patch verification.
- Deeper exploration is required for protected surfaces and should also trigger when the first pass cannot bound blast radius to a single local change.
- Do not patch while a still-discoverable entrypoint, contract, config, persistence, migration, repro, test, compatibility, rollback, or rollout touchpoint is still unknown and could change the implementation or verification.
- When a protected surface is touched and migration, compatibility, rollback, or safety policy is not already clear, run `protected_surface_planner` before patching. After the required deeper exploration pass, do not stop at an inspection plan. If exactly one load-bearing policy decision remains, ask that one question; otherwise keep the planner output as the short change plan.
- After a deeper exploration pass, return a compact coverage summary of what you checked before patching or asking.
- The evaluator is read-only. Only the main agent edits files.
- Keep verify -> evaluate -> repair -> re-verify -> re-evaluate inline within the current turn by default.
- The evaluator-triggered repair loop is capped at one full extra cycle.
- Do not persist execution micro-state such as `needs_evaluation` or `needs_repair` into `SOCRATES_CONTEXT.md` just to manage an inline loop.
- Treat unrequested behavior expansion as drift. If the patch introduces coercions, defaults, compatibility shims, new accepted input shapes, widened nullability, or semantic changes that the user did not ask for, the evaluator should fail the patch even when the narrow verification step still passes.
- Example: if the request mentions numeric strings and empty arrays, adding support for `null`, `undefined`, blank strings, or scalar-only calls is drift unless the request explicitly asks for that broader input domain.
- Skip the evaluation loop for read-only or explanatory turns, or when no repo-tracked code changed.
