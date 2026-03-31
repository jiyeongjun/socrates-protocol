# Verify and Repair

Use this after patching.

## Loop
1. Run the narrowest relevant check first.
2. If it passes, widen only as needed.
3. If it fails, summarize the blocker in 1 to 3 bullets.
4. Repair and retry.
5. Stop after 2 repair attempts or when the failure indicates a missing requirement or decision.

## Verification Order
- targeted repro or single failing test
- touched module or package tests
- lint, typecheck, or build
- snapshot or regression tests
- broader suite only if warranted

## Rules
- Keep diffs minimal.
- Do not broaden scope just to silence unrelated failures.
- If the blocker is a missing decision, ask that one question.
