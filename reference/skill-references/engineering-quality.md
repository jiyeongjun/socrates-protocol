# Engineering Quality Gates

Use these gates when the macro contract or active subcontract includes implementation, refactoring, code review, tests, or architectural design. Keep them scoped to the requested work: do not add repo-wide tooling, broad cleanup, or new semantics unless the contract explicitly includes that scope.

## Scope Boundary

- Treat this file as the self-contained Socrates source for engineering quality and default coding preferences. Do not load or require companion preference skills to get these defaults.
- Apply the TypeScript/NestJS-oriented defaults below when the repository matches that context. For unrelated languages or frameworks, translate only the underlying principle and follow local conventions.
- If the repository's explicit convention conflicts with these defaults, follow the repository unless the active contract asks to change the pattern. Call out the conflict briefly.
- Keep every preference subordinate to the Socrates contract scope, protected-surface decisions, closed-scope rule, and agreed verification path.

## Design Gates

- Write the module and layer boundaries before implementation. Name the intended dependency direction.
- Prefer mechanical enforcement for dependency boundaries and cycles when the repository already has lint, dependency-cruiser, project references, or equivalent CI checks. If enforcement is absent, record the gap instead of silently adding new tooling.
- Identify the single source of truth for shared utilities, types, shapes, schemas, and DTOs before creating another one.
- Keep directory hierarchy aligned with domain and layer boundaries so dependency direction is visible from the tree.

## Implementation Gates

- Keep domain core logic as pure `input -> output` functions when practical.
- Normalize or reject `null`, `undefined`, optional values, raw DTOs, database nullable fields, and external payloads at controller, service, resolver, finder, or IO boundaries before they reach core logic.
- Keep core functions focused on one decision or calculation. Do not scatter fallback defaults, missing-value defense, or input cleanup through the core.
- Collapse repeated branch-axis checks such as `isPickup`, `isB2B`, `is*`, or `if (source === ...)` into a named context, resolver, strategy map, or exhaustive handler map when the axis is stable.
- Use classes mainly for dependency injection, repositories, cache/client wrappers, external IO, or stateful infrastructure boundaries. Prefer plain functions for calculation, selection, validation, normalization, command mapping, and state-transition helpers when local conventions allow.
- Do not swallow errors. Avoid empty `catch`, meaningless fallback values, and defensive checks repeated at every call site. Handle expected failures at boundaries or handlers; otherwise propagate with useful context.
- Challenge nesting at three or more levels. Keep it only when the nesting expresses real structure; otherwise flatten with guard clauses or early returns.
- Respect existing function and file size caps. If the repo has no caps, keep new code small and call out large touched functions or files as risk instead of expanding them casually.
- Before writing code, name the edge and failure cases that should anchor verification: empty input, nullish input, boundary values, concurrency, failed dependencies, and side effects.
- Search for an existing function, helper, type, shape, or schema before creating a new one.

## Type And Error Defaults

- Prefer strict but pragmatic compile-time types: literal unions, enums where local convention supports them, branded types, staged `Input -> Normalized -> Domain` types, and exhaustive `Record` or `switch` plus `never` checks.
- Avoid type puzzles. Use generics, conditional types, and wide discriminated unions only when they reduce real duplication or catch meaningful bugs.
- Treat casts as a last resort. Prefer type guards, parsers, constructor functions, or normalizers that convert runtime input into validated types.
- Prefer `Result` or discriminated unions for explicit success/failure contracts, especially pure library and domain functions where success and failure are both normal domain values.
- Do not force `Result` when the project explicitly prefers framework exceptions, thrown errors, or another established failure pattern. Follow the project rule and call out the conflict briefly.
- In request-facing flows, map `Result` values to the framework's established boundary behavior. If the project convention is NestJS exceptions through filters, interceptors, or transaction boundaries, keep that convention instead of leaking `Result` through controllers or services.
- In request-facing services and controllers, flag `null`, `undefined`, or sentinel returns for unsupported input or missing entities when a `Result`, closed union, or framework exception would express the contract better.
- Treat a migration between exceptions, sentinels, `Result`, and discriminated unions as a failure-contract change. Align the active contract before changing callers or public behavior.

## Cache Key Defaults

- Build cache keys with a pure function such as `build...CacheKey(normalizedInput): string`.
- Include only axes that change the result, such as sales context, membership plan, filters, sort, page, locale, or user segment.
- Normalize defaults before key generation so implicit and explicit defaults share the same key.
- Sort and deduplicate order-independent arrays before key generation.
- Do not key on raw query objects via `JSON.stringify`, timestamps, request IDs, user-agent strings, or other observability-only fields.

## Review Gates

- Check whether new code duplicates code it should replace. Remove dead code and do not leave commented-out code behind.
- Look for quietly swallowed errors or fallbacks that hide failure from the real boundary.
- Look for hidden coupling: implicit contracts, initialization-order dependence, shared global state, and modules connected only by side effects.
- Keep re-exports intentional and discoverable. Do not let barrels hide ownership or create accidental public APIs.
- Check fan-in and fan-out concentration. Avoid turning one helper, barrel, service, or utility module into an unbounded dependency hub.

## Enforcement Gates

- Prefer strict types. Do not use `as any` or `as unknown as` to bypass the model. In JavaScript or untyped boundaries, expose the implicit contract with JSDoc.
- Treat circular dependencies and boundary violations as CI failures when the repository has enforcement or the contract includes adding it.
- Use configured lint rules for complexity, max depth, max lines per function, and related size limits. Do not bypass those rules without an explicit contract decision.

## Test Gates

- Verify observable behavior, outputs, and side effects. Do not add assertions that only match incidental strings or inflate coverage.
- Test core decisions and invariants narrowly. Prefer table-driven tests for pure functions, policy functions, resolver selection, state transitions, cache key generation, and pricing or eligibility decisions.
- Mock only external boundaries. Do not mock internal implementation details to make the test pass.
- Pin edge cases in tests: empty input, boundary values, nullish values, failed dependencies, and concurrency when relevant.
- Avoid mock-heavy service tests that only assert wiring or call counts unless they catch a real regression risk.
- Add tests when types cannot express the invariant, several layers combine, or the logic is easy to regress.
- If a test pushes production code toward defensive fallback behavior, verify that the fallback is a real boundary contract. Otherwise fix the test or clarify the requested semantics.
