---
name: socrates
description: Handles ambiguous or high-impact coding work where missing artifacts, protected-surface changes, or unresolved implementation branches could materially change the implementation. Use for coding tasks that need artifact recovery, guarded clarification, or post-patch verification. Skip trivial, formatting-only, or already explicit single-path work.
---

<!-- Generated from reference/skill-body.md. Edit the shared source instead. -->

# Socrates Protocol

Socrates is the orchestration skill for high-impact coding work.

## Runtime Core
1. Start non-fast-path work with one short current-state exploration pass before asking the user or editing code.
2. If the request is explicit, testable, and does not require a protected-surface decision, execute directly after that exploration pass. Fast path only skips extra clarification or shared-context ceremony; it does not waive post-patch verification or evaluation after repo-tracked code changes.
3. If one unresolved point would materially change the implementation, ask exactly one load-bearing question and stop.
4. If a protected surface is touched and migration, rollback, compatibility, or safety policy is not already clear, run `protected_surface_planner` before patching. Persisted-field renames, schema changes, auth changes, billing changes, and public config or env-key renames count as protected surfaces. If exactly one load-bearing policy decision remains, ask that one question and stop; otherwise keep the result as a short change plan. Do not treat phrases like "production" or "keep it safe" as a complete migration policy by themselves.
5. After patching, run the narrowest relevant verification first and widen only as needed.
6. If repo-tracked code changed, run one inline read-only `quality_evaluator` pass after verification, including explicit fast-path executions.
7. If evaluation finds actionable drift, do exactly one minimal inline repair loop, then re-verify and re-evaluate.
8. If evaluation still finds actionable drift after that inline repair loop, report the situation and ask the user how to proceed.
9. Use `SOCRATES_CONTEXT.md` only for true multi-turn or blocked work.
10. If the user asks to continue prior clarification, migration, or decision history and no matching `SOCRATES_CONTEXT.md` exists, treat that missing history as load-bearing context and follow the shared-context gate before broader branch analysis.

## Load Only What You Need
- Missing file, symbol, test, target, or repro path: see [references/artifact-recovery.md](references/artifact-recovery.md)
- Full orchestration flow, role aliases, and model-routing policy: see [references/orchestration.md](references/orchestration.md) and `model-policy.json` at the skill root
- API, schema, migration, auth, billing, deletion, config, production, or compatibility risk: see [references/protected-surfaces.md](references/protected-surfaces.md)
- One-question clarification behavior: see [references/clarification.md](references/clarification.md)
- `SOCRATES_CONTEXT.md` lifecycle, canonical shape, reuse, normalization, and cleanup: see [references/context-file.md](references/context-file.md)
- Post-patch verification and bounded retries: see [references/verify-repair.md](references/verify-repair.md)

## Output Rules
- Keep outputs compact and implementation-oriented.
- Prefer direct execution over ceremony on explicit, low-risk requests.
- Prefer artifact recovery over asking.
- Prefer one sharp question over broad discussion.
- Do not silently choose a compatibility-sensitive migration policy.
- Default to a closed request scope. Do not add support for new input shapes, null or blank handling, scalar-vs-array coercions, default fallbacks, or compatibility shims unless the user asked for them or the protected-surface plan explicitly requires them.
- Example: if the user asks to accept numeric strings and return `"0.00"` for empty arrays, do not also add support for `null`, `undefined`, blank strings, or single scalar inputs unless asked.
- Do not create hidden state or sidecar task registries.
- Keep model names out of the main skill text; use role aliases and the skill-local model policy.
- For continuation requests that depend on prior decisions, prefer the `SOCRATES_CONTEXT.md` gate over reconstructing history from memory.
- Do not write execution micro-state into `SOCRATES_CONTEXT.md` just to manage an inline verify/evaluate/repair loop.
- When you write `SOCRATES_CONTEXT.md`, follow the canonical shape exactly. Do not hand-write ad hoc YAML or headings from memory.
- If a local Socrates context helper or `scripts/context-doc.mjs` is available, use it to validate or repair `SOCRATES_CONTEXT.md` before you rely on a newly written file.
