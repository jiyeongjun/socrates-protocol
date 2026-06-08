# Socrates Contract Protocol

Socrates Contract is the mutation protocol for work where the user and agent must agree on the goal before changing files, data, settings, external systems, or other user-visible state. It exists because the most common failure mode of an autonomous agent is silent scope drift — quietly expanding what the user asked for, picking a compatibility strategy without saying, or shipping an irreversible side effect without alignment.

## Runtime Core

0. Resume guard has priority over protected-surface planning. If the user asks to continue, resume, or pick up prior contract work and no `contract-index.md` or `contracts/` directory exists, do not classify the domain further, do not draft a fresh macro contract, do not write a short change plan, and do not ask a new domain-specific question. Do not ask about migration, rollout, compatibility, billing, auth, schema, or any domain policy in this case. Use this exact shape and stop:
   ```text
   I do not have durable contract state to resume: no `contract-index.md` or `contracts/` directory is present. What was the last unresolved question or decision from the prior session?
   ```
   - Why: a resume request without contract files is a missing-handoff problem, not permission to infer prior migration, rollout, billing, or compatibility decisions.

1. Classify the request before mutating anything. Use this skill for nontrivial mutation, protected surfaces, multi-step goals, missing target artifacts, or unresolved choices that would change the result.
   - Why: misclassification at this gate is the single biggest source of contract drift downstream — it cascades into every later rule.

2. Skip the contract ceremony for read-only explanations, formatting-only work, and explicit low-risk single-step edits. For those, state any narrow assumption, execute, and verify.
   - Why: ceremony on trivial work burns user trust and slows delivery. Reserve the protocol for cases where misalignment would actually hurt.

3. Tie-breaker for ambiguous cases. When you are unsure whether to trigger, prefer to skip and state your assumption in one sentence. If the first verification reveals risk (touches a protected surface, exposes a hidden decision, or affects more than one verification path), escalate to a contract before continuing.
   - Why: forcing every borderline case into ceremony makes the agent timid; verification is a cheap second filter that catches missed cases without paying alignment cost on safe ones.

4. For Socrates-triggered work, align the macro contract first: goal, current state, success criteria, scope, non-goals, protected surfaces, risks, verification path, and unresolved questions.
   - Why: the macro contract is the artifact the user and agent hold each other to. Without it, "done" has no shared definition.

5. If one unresolved point would materially change the macro contract or any mutation path, ask exactly one load-bearing question and stop.
   - Why: stacking three questions at once forces the user to context-switch on all of them and usually returns shallow answers; one sharp question gets a real answer.

6. Do not perform the real mutation until the macro contract is explicit enough that the user and agent would choose the same next action. If the goal requires multiple independent problems, multiple turns, protected-surface planning, durable handoff, or unresolved decisions that must survive context loss, create visible contract files instead of one large context file. Keep narrow, reversible work inline when it has one coherent verification path, even when it touches both implementation and verification artifacts. Use `contract-index.md` at the workspace root and `contracts/contract-001.md`, `contracts/contract-002.md`, etc. To scaffold these files quickly, run `node scripts/scaffold-contract.mjs "<one-line macro goal>"` from the workspace root. See [references/contract-files.md](references/contract-files.md).
   - Why: agents tend to treat "small change" subjectively; an objective rule (one coherent verification path = inline; broader = contract files) prevents both over-ceremonialization and silent multi-file drift.

7. Decompose the macro contract into the fewest useful subcontracts. Each subcontract must have a clear task, inputs, completion criteria, unknowns, next step, and verification method.
   - Why: subcontracts are the unit of verification. Too many = ceremony tax; too few = unverifiable lump.

8. Execute one active subcontract at a time. Mutate only `contract-index.md`, the active subcontract file, and the direct implementation or verification artifacts needed for that subcontract. Read-only exploration of related code or documents is allowed and encouraged.
   - Why: parallel mutation across subcontracts hides failure causes and turns rollback into a multi-axis problem.

9. After each subcontract mutation, run the narrowest relevant verification first, repair if needed, re-verify, then mark that subcontract complete only when its completion criteria are satisfied.
   - Why: deferring verification means you accumulate untrusted state; tight verification keeps the recovery point close to the failure.

10. After every completed subcontract, update `contract-index.md` with status, decisions, remaining unknowns, and the next active subcontract.
    - Why: the index is the durable handoff. If it lags, anyone (including you in a later turn) reads stale state and acts on it.

11. When all subcontracts are complete, verify the macro contract itself. Close the macro contract only when the documented success criteria are met or explicitly renegotiated with the user.
    - Why: subcontract success does not imply macro success — emergent failures show up only when the pieces meet.

## Worked Example
A full request → classification → contract files → one question → execution → verification → closure walk-through is in [references/example.md](references/example.md). Read it once before authoring your first contract on a new project; the structure recurs every time.

## Contract Checklist
- Align the macro goal and clarify exactly one load-bearing unknown if needed.
- Document durable work in `contract-index.md` plus bounded subcontract files (use `scripts/scaffold-contract.mjs` to generate the boilerplate).
- For implementation, refactoring, review, test, or architecture contracts, load the engineering quality gates and apply them only within the agreed scope.
- Execute one aligned subcontract at a time.
- Verify before closing each subcontract.
- Close the macro contract only after all documented success criteria pass.

## Load Only What You Need
- Missing file, symbol, test, target, or repro path: see [references/artifact-recovery.md](references/artifact-recovery.md)
- Contract file layout, YAML frontmatter, examples, one-level references, and 500-line limits: see [references/contract-files.md](references/contract-files.md)
- Full orchestration flow, role-to-Claude-subagent mapping, and host model policy: see [references/orchestration.md](references/orchestration.md) and `model-policy.json` at the skill root
- API, schema, migration, auth, billing, deletion, config, production, external side effects, or compatibility risk: see [references/protected-surfaces.md](references/protected-surfaces.md)
- Implementation, refactoring, code review, test, or architecture quality gates: see [references/engineering-quality.md](references/engineering-quality.md)
- One-question clarification behavior: see [references/clarification.md](references/clarification.md)
- Post-mutation verification and bounded repair: see [references/verify-repair.md](references/verify-repair.md)
- Worked example end-to-end: see [references/example.md](references/example.md)

## Output Rules
- Keep outputs compact, contract-oriented, and action-specific. — Long discursive replies dilute the next decision; the user usually needs the move, not the lecture.
- Prefer artifact recovery over asking when the artifact is discoverable. — Asking about something the agent could have grepped wastes a load-bearing question slot.
- Prefer one sharp question over broad discussion. — Broad discussion forces the user to disambiguate later anyway, with worse signal-to-noise.
- On resume requests with no visible contract files, ask only `What was the last unresolved question or decision from the prior session?` and stop; do not include domain-specific options. — Inventing the next migration or rollout question creates fake continuity.
- Do not silently choose a compatibility-sensitive migration, deletion, billing, auth, rollout, or external-state policy. — These choices have asymmetric downside; surfacing them is cheap, recovery from a wrong silent pick is not.
- Default to a closed request scope. Do not add support for new input shapes, compatibility shims, fallback behavior, or side effects unless the macro contract or active subcontract explicitly requires them. — Unrequested expansion is the most common form of contract drift; closing scope by default makes drift visible.
- Do not create hidden state, private task registries, or unreferenced sidecar files. — Hidden state breaks the user-agent alignment that contract files exist to maintain.
- Keep contract file references one level deep. Do not make nested reference chains. — Each extra hop forces another file load, multiplying token cost without adding clarity.
- Keep every contract file under 500 lines. Split long background material into a referenced `reference/` file with a table of contents. — Beyond ~500 lines, a single file becomes hard to scan and merge-review.
- Do not record inline verification and repair micro-steps in the macro index unless the work stops and needs a human-readable handoff. — Micro-state in the macro index turns it from a routing ledger into a noisy log.

## Self-Check Before Mutating
Before any mutation, confirm:
- [ ] Have I checked whether Rule 0 applies before protected-surface planning?
- [ ] Have I classified this as inline-only or contract-required using Rule 6?
- [ ] If contract-required, do I have an aligned macro contract or one explicit load-bearing question?
- [ ] If inline-only, have I stated the assumption I am running with?
- [ ] Have I named the verification command or inspection that will prove the change?

If any of these is "no," do not mutate yet.
