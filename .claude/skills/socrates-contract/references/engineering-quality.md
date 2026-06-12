# Engineering Quality Gates

Use these gates when the macro contract or active subcontract includes implementation, refactoring, code review, tests, or architectural design. Keep them scoped to the requested work: do not add repo-wide tooling, broad cleanup, or new semantics unless the contract explicitly includes that scope.

## Contents

- Scope Boundary
- Design Gates
- Implementation Gates
- Naming And Predictability Gates
- Type And Error Defaults
- Automation And External Interaction Gates
- Security And Crypto Gates
- Distributed Systems Gates
- Cache Key Defaults
- Review Gates
- Enforcement Gates
- Test Gates

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
- Split interfaces from implementations at IO, vendor, storage, queue, crypto, payment, auth, or framework boundaries where replacement, mocking, or failure isolation is a real concern.
- Do not introduce an interface, base class, strategy layer, or OCP extension point only because a change might happen later. Prefer a closed union, exhaustive handler map, or plain function until the changing axis is visible.
- Treat sync-to-async flow changes, new queues, new service boundaries, and cross-system state moves as contract-level behavior changes, not implementation details.

## Implementation Gates

- Keep domain core logic as pure `input -> output` functions when practical.
- Normalize or reject `null`, `undefined`, optional values, raw DTOs, database nullable fields, and external payloads at controller, service, resolver, finder, or IO boundaries before they reach core logic.
- Keep core functions focused on one decision or calculation. Do not scatter fallback defaults, missing-value defense, or input cleanup through the core.
- Collapse repeated branch-axis checks such as `isPickup`, `isB2B`, `is*`, or `if (source === ...)` into a named context, resolver, strategy map, or exhaustive handler map when the axis is stable.
- Use classes mainly for dependency injection, repositories, cache/client wrappers, external IO, or stateful infrastructure boundaries. Prefer plain functions for calculation, selection, validation, normalization, command mapping, and state-transition helpers when local conventions allow.
- Prefer eager array or collection operations for already materialized small inputs. Consider `Iterable<T>` or `AsyncIterable<T>` for large, streamed, paginated, short-circuited, or infinite data; write generators plainly with `for...of`, `for await...of`, `while`, and `yield` when that is clearer.
- When reconciling or comparing two collections by identifier, consider a `Map` or keyed index before nested loops if inputs can grow. Keep the simpler loop for small inputs or one-off processing.
- For serializers, formatters, templates, and response builders, put representation invariants in the object or small module that owns output safety: escaping, normalization, recursive rendering, and safe composition. Use functional transforms for internal data shaping when they clarify the flow, but do not add the abstraction without real repetition rules or safety requirements.
- Do not swallow errors. Avoid empty `catch`, meaningless fallback values, and defensive checks repeated at every call site. Handle expected failures at boundaries or handlers; otherwise propagate with useful context.
- Challenge nesting at three or more levels. Keep it only when the nesting expresses real structure; otherwise flatten with guard clauses or early returns.
- Respect existing function and file size caps. If the repo has no caps, keep new code small and call out large touched functions or files as risk instead of expanding them casually.
- Before writing code, name the edge and failure cases that should anchor verification: empty input, nullish input, boundary values, concurrency, failed dependencies, and side effects.
- Search for an existing function, helper, type, shape, or schema before creating a new one.
- When touching adjacent flawed code, fix only the issue that blocks the active verification path. Record broader cleanup as out of scope unless the contract explicitly expands.

## Naming And Predictability Gates

- Treat names as part of the public contract. A caller should be able to predict behavior from the name, parameters, and return type without reading the implementation.
- Use the same naming pattern only for the same behavior and return shape. Do not mix booleans, sentinels, thrown errors, and `Result` objects under similar validation or check names.
- Reveal added behavior in wrapper names. If a local wrapper adds auth, retry, timeout, caching, logging, persistence, or validation beyond a primitive or library call, make that behavior visible in the name.
- Name complex predicates or constants when the name reduces reader context or captures domain meaning. Do not extract trivial one-off expressions just to add a name.
- Prefer positive boolean and predicate names. Avoid double negatives and vague identifiers such as `data`, `item`, `flag`, `manager`, `helper`, or `processor` when a domain term is available.

## Type And Error Defaults

- Prefer strict but pragmatic compile-time types: literal unions, enums where local convention supports them, branded types, staged `Input -> Normalized -> Domain` types, and exhaustive `Record` or `switch` plus `never` checks.
- Avoid type puzzles. Use generics, conditional types, and wide discriminated unions only when they reduce real duplication or catch meaningful bugs.
- Treat casts as a last resort. Prefer type guards, parsers, constructor functions, or normalizers that convert runtime input into validated types.
- Use `unknown` rather than `any` at untrusted IO boundaries, then narrow with a parser, type guard, schema, or normalizer before the value enters domain logic.
- Treat `any`, `as any`, `as unknown as`, and `Record<string, any>` as signs that a contract is hidden. Replace them with explicit shapes, `unknown` plus narrowing, or a narrowly scoped generic when the local change needs that contract.
- Use advanced TypeScript features only when they make invalid states unrepresentable or preserve a real relationship between inputs and outputs. Prefer readable unions and helper types over clever conditional-type machinery.
- Prefer `satisfies`, literal inference, exhaustive `Record<Union, Handler>`, and `never` checks when they catch missing cases without widening public types.
- Prefer `Result` or discriminated unions for explicit success/failure contracts, especially pure library and domain functions where success and failure are both normal domain values.
- Do not force `Result` when the project explicitly prefers framework exceptions, thrown errors, or another established failure pattern. Follow the project rule and call out the conflict briefly.
- In request-facing flows, map `Result` values to the framework's established boundary behavior. If the project convention is NestJS exceptions through filters, interceptors, or transaction boundaries, keep that convention instead of leaking `Result` through controllers or services.
- In request-facing services and controllers, flag `null`, `undefined`, or sentinel returns for unsupported input or missing entities when a `Result`, closed union, or framework exception would express the contract better.
- Treat a migration between exceptions, sentinels, `Result`, and discriminated unions as a failure-contract change. Align the active contract before changing callers or public behavior.

## Automation And External Interaction Gates

- Analyze web automation targets read-only first: page flow, HTTP requests and responses, script interactions, authentication state, rate limits, and stable selectors or APIs.
- Treat login, checkout, ordering, form submission, account changes, deletion, payment, messaging, and production writes as protected external side effects that need explicit contract alignment.
- Prefer documented APIs, stable semantic selectors, and idempotent operations over brittle DOM coordinates, timing guesses, or text that is likely to be localized or personalized.
- Define retry, timeout, rate-limit, dry-run, and failure-recovery behavior before making automation persistent or recurring.

## Security And Crypto Gates

- Do not hand-roll cryptographic primitives, certificate parsing, padding, signing, hashing, or random generation when a vetted library or platform API exists.
- Treat algorithm, mode, padding, encoding, key format, certificate chain, rotation, backward compatibility, and vendor sample compatibility as contract decisions.
- Verify crypto behavior with known test vectors, vendor sample payloads, or round-trip compatibility checks when available.
- Never log plaintext secrets, private keys, decrypted payloads, tokens, passwords, session cookies, or full certificate material. Redact before adding diagnostic context.

## Distributed Systems Gates

- Name transaction boundaries, ownership of state, consistency expectations, and retry/idempotency keys before changing cross-system flows.
- For queues and async work, define ordering assumptions, duplicate handling, poison-message behavior, dead-letter policy, and replay safety.
- Distinguish `Promise<T>` from a task factory such as `() => Promise<T>`: a promise is usually already started, while a factory keeps execution policy attachable. Prefer retry, timeout, cancellation, batching, concurrency limits, and pools around task factories or iterables of task factories.
- Split services only when ownership, scaling, failure isolation, data boundaries, or deployment cadence justify the added network and operational complexity.
- Treat moving work between client, server, queue, worker, and vendor systems as a behavior change that needs explicit verification across the affected boundary.

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
