# Orchestration

Use this when Socrates Contract coordinates macro alignment, decomposition, mutation, verification, and closure.

## Flow
1. Run a short current-state pass before asking the user or mutating. Recover obvious artifacts, target surfaces, constraints, and verification options.
2. Decide whether the request is a low-risk single-step mutation. If yes, execute directly and verify without writing contract files.
3. For nontrivial mutation, draft the macro contract: goal, scope, non-goals, success criteria, protected surfaces, risks, verification, knowns, unknowns, and decisions.
4. Ask exactly one load-bearing question if the macro contract or first mutation path is not aligned.
5. For large, multi-turn, protected-surface, or multi-problem goals, create `contract-index.md` and one subcontract file per bounded problem. Keep a single-file, single-check, reversible-decision change inline.
6. Mark only one subcontract as active. Execute it, verify it, update it, then update the macro index.
7. If verification fails, repair the smallest relevant issue and re-run the narrowest useful check.
8. If a subcontract exposes a new load-bearing decision, mark it `blocked`, update the index, ask one question, and stop.
9. When every subcontract is `done`, verify the macro success criteria and close or renegotiate the macro contract.

## Roles
- `fast_explorer`: read-only discovery pass that recovers current state, target artifacts, protected surfaces, and narrow verification paths
- `goal_contractor`: read-only pass that turns the user goal into a macro contract and surfaces the single highest-impact unresolved question
- `subgoal_planner`: read-only pass that decomposes a macro contract into bounded, independently verifiable subcontracts
- `protected_surface_planner`: read-only planning pass for migrations, compatibility, rollback, and safety policy
- `fast_verifier`: cheap verification pass that runs the narrowest relevant checks first
- `contract_verifier`: read-only quality gate that checks whether a subcontract or macro contract can close

## Host Model Guidance
- Keep model names out of the main skill text.
- Read `model-policy.json` at the Socrates skill root for per-platform role aliases and ordered fallbacks.
- Treat the policy as guidance, not a requirement to delegate.
- Keep role work inline unless the host supports an isolated worker or subagent and delegation will not block the next step.

## Rules
- Contract files are visible user-agent state, not hidden task management.
- Do not create contract files for simple single-step work.
- Do not patch, delete, deploy, configure, purchase, send, or otherwise mutate before the active contract is aligned.
- Read-only exploration of related files, callers, docs, and tests is allowed before and during subcontract execution.
- Deeper exploration is required when the first pass cannot bound blast radius, protected surfaces, ownership, or verification.
- Treat unrequested behavior expansion as contract drift.
- The verifier is read-only. Only the main agent mutates files or external state.
- Keep verify -> repair -> re-verify loops inline within the current turn by default.
- Persist only durable decisions, blockers, results, and next steps into contract files.
