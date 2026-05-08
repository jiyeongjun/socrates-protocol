# Verify and Repair

Use this after a subcontract mutation.

## Loop
1. Run the narrowest relevant check first.
2. If it passes, widen only as needed.
3. If it fails, summarize the blocker in 1 to 3 bullets.
4. Repair and retry.
5. Stop after 2 repair attempts or when the failure indicates a missing requirement or decision.
6. If verification passes on a protected-surface, cross-boundary, multi-step, or otherwise nontrivial Socrates Contract change, run a read-only contract verification pass before closing the subcontract.

## Verification Order
- targeted repro or single failing test
- touched module, package, document, or workflow checks
- lint, typecheck, or build
- snapshot or regression tests
- broader suite only if warranted
- manual inspection when no executable check exists

## Rules
- Keep diffs minimal.
- Do not broaden scope just to silence unrelated failures.
- Do not add tests for new semantics that the user did not ask for just to justify a broader patch.
- Example: do not add tests for `null`, blank strings, or scalar inputs when the request only asked for numeric strings plus empty-array handling.
- If the blocker is a missing decision, ask that one question.
- Keep verification separate from contract closure. Verification proves the changed surface works; contract verification decides whether the active subcontract can close.
- Keep the verify -> repair -> re-verify loop inside the current turn by default instead of writing execution micro-state into contract files.
