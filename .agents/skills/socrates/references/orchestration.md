# Orchestration

Use this when Socrates needs to coordinate exploration, implementation, verification, inline evaluation, and the single repair loop.

## Flow
1. Start with one short current-state exploration pass before asking the user or editing code.
2. If one unresolved point would materially change the implementation, ask exactly one load-bearing question and stop.
3. Implement only after the path is explicit enough.
4. Run the narrowest relevant verification first.
5. Run one inline read-only quality evaluation pass after verification when repo-tracked code changed, including explicit fast-path executions.
6. If evaluation finds actionable drift and no repair loop has been spent yet, do exactly one inline repair loop, then re-verify and re-evaluate.
7. If evaluation still finds actionable drift after that inline repair loop, ask the user what to do next.

## Roles
- `fast_explorer`: cheap read-only discovery of files, symbols, tests, repro paths, protected surfaces, and rollout touchpoints
- `protected_surface_planner`: cheap read-only planning pass for migrations, compatibility, rollback, and safety policy
- `fast_verifier`: cheap verification pass that runs the narrowest relevant checks first
- `quality_evaluator`: read-only quality gate that checks requirement fit, regression risk, missing coverage, and whether one inline repair loop is warranted

## Model Routing
- Keep model names out of the main skill text.
- Read `model-policy.json` at the Socrates skill root for per-platform role aliases and ordered fallbacks.
- On Codex, resolve a role to the first available preferred model and fall back to the host default if none are available.
- On Claude, treat the same role policy as best-effort guidance until the host exposes a stable per-agent model binding surface.

## Rules
- Exploration is mandatory for Socrates-triggered work, but hook enforcement only applies when `SOCRATES_CONTEXT.md` exists.
- "Fast path" only skips extra clarification or shared-context ceremony. It does not waive post-patch verification or the evaluation pass after repo-tracked code changes.
- When a protected surface is touched and migration, compatibility, rollback, or safety policy is not already clear, run `protected_surface_planner` before patching. If exactly one load-bearing policy decision remains, ask that one question; otherwise keep the planner output as the short change plan.
- The evaluator is read-only. Only the main agent edits files.
- Keep verify -> evaluate -> repair -> re-verify -> re-evaluate inline within the current turn by default.
- The evaluator-triggered repair loop is capped at one full extra cycle.
- Do not persist execution micro-state such as `needs_evaluation` or `needs_repair` into `SOCRATES_CONTEXT.md` just to manage an inline loop.
- Treat unrequested behavior expansion as drift. If the patch introduces coercions, defaults, compatibility shims, new accepted input shapes, widened nullability, or semantic changes that the user did not ask for, the evaluator should fail the patch even when the narrow verification step still passes.
- Example: if the request mentions numeric strings and empty arrays, adding support for `null`, `undefined`, blank strings, or scalar-only calls is drift unless the request explicitly asks for that broader input domain.
- Skip the evaluation loop for read-only or explanatory turns, or when no repo-tracked code changed.
