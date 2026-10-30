---
name: socrates-step
description: "Implement software in small, user-aligned steps: propose a behavior, confirm it, test and implement it, then assess structure. Use for stepwise first implementations, feature additions, bug fixes, refactoring, and performance work. Works independently or after Socrates requirements alignment. Exclude explanation-only requests and routine text edits."
---

# Socrates Step

Deliver one useful behavior at a time while keeping the next change feasible.

## Align on the next step

- Inspect relevant code, tests, and project instructions. Reuse decisions and approvals already established, including through Socrates.
- For a broad goal, outline useful outcomes provisionally, then propose one small observable behavior. Prefer a working input-to-output path over building every architectural layer first.
- State the expected behavior, step boundary, existing behavior to preserve, and a concrete acceptance example. Resolve consequential unknowns; decide ordinary implementation details yourself.
- A direct request to implement a user-selected small change already authorizes implementation: proceed without reconfirmation unless the user explicitly requires it; ask before implementing steps you select yourself.
- Unless this concrete step is already approved, ask whether to proceed and wait. Before confirmation, investigate and design without editing code, tests, configuration, or scaffolding. Silence and urgency are not approval.
- Explicit delegation to finish an agreed scope authorizes its constituent steps. Continue without repeated confirmation. Reopen only decisions that change the agreed behavior or scope.
- Apply user corrections to the affected agreement. Respect cancellation and requests to return to step-by-step confirmation. Do not turn alignment into a quiz.

## Test, then implement

- Establish the relevant baseline. Preserve unrelated changes and distinguish pre-existing failures.
- Write one focused failing example and run it **before adding another test or changing production code**. Confirm that it fails for the intended missing behavior, not an unrelated environment problem.
- Implement only enough to satisfy that example and existing contracts. Run the focused test and relevant regressions, then add the next example within the approved step.
- Group normal and boundary cases for the same small operation into one approval. Each test does not need another user confirmation.
- If a test already passes, check whether the behavior already exists or the example misses the defect. Do not manufacture a failure or unnecessary implementation.
- Never obtain green by silently weakening assertions, disabling tests, or redefining expectations around a bug. An approved contract change may require changing expectations; explain the change and preserve unaffected coverage.
- Use meaningful checks suited to the change. Refactors need before/after verification, not invented failing feature tests. Run required integration or performance checks when relevant; distinguish skipped, blocked, and executed checks.

## Keep the next change feasible

- After green, inspect touched code for actual friction: duplicated rules, accumulating special cases, unclear state ownership, or changes spreading across unrelated modules.
- Make the smallest justified improvement; adequate structure needs no refactor. Do not build speculative frameworks or expand into unrelated cleanup.
- Keep structural and behavioral changes distinguishable. Verify behavior before and after structural edits. If commits are requested, separate their logical purposes; do not create commits merely because this skill is active.
- Local cleanup belongs inside the approved step. A separate preparatory refactor needs its own proposal unless covered by existing approval or delegation. Substantial redesign or expanded scope requires a new agreement.
- Repeated failed fixes without a new explanation are a signal to narrow the reproduction and reassess the cause, not grow the patch or weaken tests.

## Close the step

Report the behavior delivered, actual verification, necessary structural changes, and material uncertainty. If work remains, propose the next step and wait, or continue within explicit delegation. When the agreed work is complete, stop without inventing more work.

Reconsider the remaining plan when implementation or verification changes an assumption; skip unnecessary implementation work, but propose and confirm any change to agreed functionality, behavior, or scope.

Keep lightweight continuity in conversation; reuse an existing plan when useful, but do not require or create plan.md by default.

For special cases, consult [worked cases](references/worked-cases.md) only as needed. [Sources and adaptation decisions](references/sources.md) document the independent adaptation of Kent Beck's work; this is not an official Kent Beck skill.
