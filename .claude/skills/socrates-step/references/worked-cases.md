# Applying the step loop

These examples illustrate decision boundaries, not mandatory templates or new product requirements.

## First implementation and feature additions

For a task API, begin with a useful create/read path and concrete persistence expectations. Do not build all endpoints, repositories, and generic service layers before checking the first behavior. Agree on an observable step; include only the boundary examples that distinguish its contract.

For a feature in an existing service, inspect its current callers and regression coverage. If a new field is optional, preserve old requests; do not infer new defaults or failure policies from implementation convenience. Questions that materially affect the result belong before the step. Naming a local helper does not.

## Bug fixes

Reproduce the failure through the public interface where practical. Add a smaller reproduction when it helps isolate the cause; avoid duplicate tests that merely restate the same evidence. For order-sensitive behavior, vary the order. For boundaries, test either side of the actual boundary. For stateful algorithms, check invariants after meaningful operations and compare against a trusted reference where contracts match.

A randomized failure is useful only if its operation sequence or seed can be replayed. Reduce it to a stable regression case when feasible. Diagnostic printing alone is not a correctness assertion. Check that the test would fail if the intended invariant were violated.

## Structural changes

For “prepare this module for the next pricing rule,” identify a present obstacle such as duplicated eligibility checks. Propose the extraction and existing behavior that must remain unchanged. Execute the approved refactor with before/after checks, then propose the pricing rule. Do not combine the rule's changed semantics into a commit described as only an extraction.

If a feature is green and its structure is already adequate, finish the step. No helper extraction, extra abstraction, or future-proofing is required.

## Performance work

Agree on the operation, representative workload, correctness contract, and measurement method. Capture a baseline before changing the bottleneck. Optimize one supported hypothesis, compare under the same conditions, and check important neighboring operations for regressions. Report variance and tradeoffs rather than promoting a single faster run into a universal claim. Do not introduce machine-dependent timing assertions into ordinary correctness tests without a suitable environment and justified threshold.

## Confirmation edge cases

- “Looks promising; what about time zones?” is not approval while the question changes the behavior. Resolve the affected policy.
- “Yes, implement that rejection case” approves the proposed step, including its necessary tests and local cleanup. Do not ask again before writing its test.
- “Implement all these agreed cases; don't ask after each one” delegates that bounded work. Report progress and continue; reopen only a consequential change.
- “Actually, keep duplicates and preserve their order. Implement that instead” replaces and authorizes the concrete revised behavior.
- “Stop after this step and show me the result” changes cadence. Finish only the authorized current step, report, and wait.
- “Explain the failure; don't fix it” is explanation-only. Do not enter the implementation loop or ask for implementation approval.
- A user request for a test-only change authorizes that product of the step; do not force production code changes if the tests reveal no defect.

## Interrupted or inconclusive work

If a new user message changes direction, preserve unaffected agreements and inspect the actual diff before resuming. Never discard the user's work as a shortcut to a clean baseline. If a required check cannot run, state the precise unverified behavior. Existing unrelated failures need a separate attribution; do not claim an entirely green project or expand into unrelated fixes.
