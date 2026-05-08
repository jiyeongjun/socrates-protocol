# Socrates Contract Protocol

Socrates Contract is the mutation protocol for work where the user and agent must agree on the goal before changing files, data, settings, external systems, or other user-visible state.

## Runtime Core
1. Classify the request before mutating anything. Use this skill for nontrivial mutation, protected surfaces, multi-step goals, missing target artifacts, or unresolved choices that would change the result.
2. Skip the contract ceremony for read-only explanations, formatting-only work, and explicit low-risk single-step edits. For those, state any narrow assumption, execute, and verify.
3. For Socrates-triggered work, align the macro contract first: goal, current state, success criteria, scope, non-goals, protected surfaces, risks, verification path, and unresolved questions.
4. If one unresolved point would materially change the macro contract or any mutation path, ask exactly one load-bearing question and stop.
5. Do not perform the real mutation until the macro contract is explicit enough that the user and agent would choose the same next action.
6. If the goal requires multiple independent problems, multiple turns, protected-surface planning, durable handoff, or unresolved decisions that must survive context loss, create visible contract files instead of one large context file. Keep narrow, reversible work inline even when it touches both implementation and verification artifacts. Use `contract-index.md` at the workspace root and `contracts/contract-001.md`, `contracts/contract-002.md`, etc. See [references/contract-files.md](references/contract-files.md).
7. Decompose the macro contract into the fewest useful subcontracts. Each subcontract must have a clear task, inputs, completion criteria, unknowns, next step, and verification method.
8. Execute one active subcontract at a time. Mutate only `contract-index.md`, the active subcontract file, and the direct implementation or verification artifacts needed for that subcontract. Read-only exploration of related code or documents is allowed and encouraged.
9. After each subcontract mutation, run the narrowest relevant verification first, repair if needed, re-verify, then mark that subcontract complete only when its completion criteria are satisfied.
10. After every completed subcontract, update `contract-index.md` with status, decisions, remaining unknowns, and the next active subcontract.
11. When all subcontracts are complete, verify the macro contract itself. Close the macro contract only when the documented success criteria are met or explicitly renegotiated with the user.

## Contract Checklist
- Align the macro goal and clarify exactly one load-bearing unknown if needed.
- Document durable work in `contract-index.md` plus bounded subcontract files.
- Execute one aligned subcontract at a time.
- Verify before closing each subcontract.
- Close the macro contract only after all documented success criteria pass.

## Load Only What You Need
- Missing file, symbol, test, target, or repro path: see [references/artifact-recovery.md](references/artifact-recovery.md)
- Contract file layout, YAML frontmatter, examples, one-level references, and 500-line limits: see [references/contract-files.md](references/contract-files.md)
- Full orchestration flow and role aliases: see [references/orchestration.md](references/orchestration.md) and `model-policy.json` at the skill root
- API, schema, migration, auth, billing, deletion, config, production, external side effects, or compatibility risk: see [references/protected-surfaces.md](references/protected-surfaces.md)
- One-question clarification behavior: see [references/clarification.md](references/clarification.md)
- Post-mutation verification and bounded repair: see [references/verify-repair.md](references/verify-repair.md)
- Legacy `SOCRATES_CONTEXT.md` compatibility for older installs: see [references/context-file.md](references/context-file.md)

## Output Rules
- Keep outputs compact, contract-oriented, and action-specific.
- Prefer artifact recovery over asking when the artifact is discoverable.
- Prefer one sharp question over broad discussion.
- Do not silently choose a compatibility-sensitive migration, deletion, billing, auth, rollout, or external-state policy.
- Default to a closed request scope. Do not add support for new input shapes, compatibility shims, fallback behavior, or side effects unless the macro contract or active subcontract explicitly requires them.
- Do not create hidden state, private task registries, or unreferenced sidecar files.
- Keep contract file references one level deep. Do not make nested reference chains.
- Keep every contract file under 500 lines. Split long background material into a referenced `reference/` file with a table of contents.
- Do not record inline verification and repair micro-steps in the macro index unless the work stops and needs a human-readable handoff.
