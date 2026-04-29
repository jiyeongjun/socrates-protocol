# Socrates Protocol

Socrates is the orchestration skill for high-impact coding work.

## Runtime Core
1. Start non-fast-path work with one short current-state exploration pass before asking the user or editing code. Use it to decide whether fast path is safe or whether the task must escalate to deeper exploration.
2. If the request is explicit, testable, and the short pass finds no protected surface, no cross-boundary impact, and no rollout-sensitive ambiguity, execute directly after that exploration pass. Fast path only skips extra clarification, protected-surface planning, shared-context ceremony, and evaluator ceremony when narrow verification covers the request; it does not waive post-patch verification.
3. If the short pass finds a protected surface, likely cross-module impact, unclear ownership, or rollout-sensitive touchpoints, expand to one deeper read-only exploration pass before asking the user or editing code.
4. A deeper exploration pass must recover the main entrypoints or callers, the relevant contract, config, persistence, or migration touchpoints, the narrowest useful repro or tests, and any compatibility, rollback, or rollout constraints that could change the implementation.
5. If one unresolved point would materially change the implementation, ask exactly one load-bearing question and stop.
6. If a protected surface is touched and migration, rollback, compatibility, or safety policy is not already clear, run `protected_surface_planner` before patching. Persisted-field renames, schema changes, auth changes, billing changes, and public config or env-key renames count as protected surfaces. After the required deeper exploration pass, do not end with only an inspection plan. If exactly one load-bearing policy decision remains, ask that one question and stop; otherwise keep the result as a short change plan. Do not treat phrases like "production" or "keep it safe" as a complete migration policy by themselves.
7. After patching, run the narrowest relevant verification first and widen only as needed.
8. If repo-tracked code changed on a protected surface, cross-module path, deeper-exploration path, or other nontrivial Socrates path, run one inline read-only `quality_evaluator` pass after verification. For trivial explicit edits, a narrow verification plus self-check is enough.
9. If evaluation finds actionable drift, do exactly one minimal inline repair loop, then re-verify and re-evaluate.
10. If evaluation still finds actionable drift after that inline repair loop, report the situation and ask the user how to proceed.
11. Use `SOCRATES_CONTEXT.md` only for true multi-turn or blocked work.
12. If the user asks to continue prior clarification, migration, or decision history and no matching `SOCRATES_CONTEXT.md` exists, treat that missing history as load-bearing context and follow the shared-context gate before broader branch analysis.

## Load Only What You Need
- Missing file, symbol, test, target, or repro path: see [references/artifact-recovery.md](references/artifact-recovery.md)
- Full orchestration flow, role aliases, and host-specific model guidance: see [references/orchestration.md](references/orchestration.md) and `model-policy.json` at the skill root
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
- Do not answer a protected-surface or cross-boundary request with only "I'll inspect" or "I'll look through the codebase." After the required exploration pass, either ask the one load-bearing question or return the short change plan.
- Do not stop a deeper-exploration case after finding only one likely file or caller when blast radius, ownership, or rollout touchpoints are still unclear.
- When deeper exploration was required, return a compact coverage summary of the entrypoints, touchpoints, and verification path you checked before patching or questioning.
- Default to a closed request scope. Do not add support for new input shapes, null or blank handling, scalar-vs-array coercions, default fallbacks, or compatibility shims unless the user asked for them or the protected-surface plan explicitly requires them.
- Example: if the user asks to accept numeric strings and return `"0.00"` for empty arrays, do not also add support for `null`, `undefined`, blank strings, or single scalar inputs unless asked.
- Do not create hidden state or sidecar task registries.
- Keep model names out of the main skill text; use role aliases and the skill-local model policy.
- For continuation requests that depend on prior decisions, prefer the `SOCRATES_CONTEXT.md` gate over reconstructing history from memory.
- If that continuation gate fails because prior history is missing, ask exactly one resume question and stop: `What was the last unresolved question or decision from the prior session?`
- Do not write execution micro-state into `SOCRATES_CONTEXT.md` just to manage an inline verify/evaluate/repair loop.
- When you write `SOCRATES_CONTEXT.md`, follow the canonical shape exactly. Do not hand-write ad hoc YAML or headings from memory.
- If a local Socrates context helper or `scripts/context-doc.mjs` is available, use it to validate or repair `SOCRATES_CONTEXT.md` before you rely on a newly written file.
