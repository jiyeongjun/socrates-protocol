# Verify and Repair

Use this after patching.

## Loop
1. Run the narrowest relevant check first.
2. If it passes, widen only as needed.
3. If it fails, summarize the blocker in 1 to 3 bullets.
4. Repair and retry.
5. Stop after 2 repair attempts or when the failure indicates a missing requirement or decision.
6. If verification passes on a repo-tracked protected-surface, cross-module, deeper-exploration, or otherwise nontrivial Socrates change, hand off inline to the read-only quality evaluator before ending the Socrates loop.

## Verification Order
- targeted repro or single failing test
- touched module or package tests
- lint, typecheck, or build
- snapshot or regression tests
- broader suite only if warranted

## Rules
- Keep diffs minimal.
- Do not broaden scope just to silence unrelated failures.
- Do not add tests for new semantics that the user did not ask for just to justify a broader patch.
- Example: do not add tests for `null`, blank strings, or scalar inputs when the request only asked for numeric strings plus empty-array handling.
- If the blocker is a missing decision, ask that one question.
- Keep verification separate from evaluation. Verification proves the change still runs; evaluation decides whether one more inline repair loop is warranted.
- Keep the verify -> evaluate -> repair -> re-verify -> re-evaluate loop inside the current turn by default instead of writing execution micro-state into `SOCRATES_CONTEXT.md`.
