# Universal Engineering Gate

Load this short gate for implementation, refactoring, tests, review, or architecture work.

- Follow explicit repository conventions and dependency direction.
- Search for existing helpers, types, schemas, and sources of truth before adding another.
- Keep the change minimal and avoid unrelated cleanup or speculative abstractions.
- Do not swallow errors or add fallbacks that hide observable failure.
- Do not let a test silently redefine production behavior or add unsupported semantics.
- Verify observable behavior, outputs, and side effects; mock only real external boundaries.
- Pin relevant edge/failure cases, including concurrency only when the touched behavior can race.
- Prefer the simplest design that satisfies the current scope and verification path.
- Record broader defects as out of scope unless they block the active verification.

Load language/framework, automation, security, or distributed-systems guidance only when that surface is actually present.
