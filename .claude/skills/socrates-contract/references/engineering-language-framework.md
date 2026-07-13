# Language And Framework Guidance

Load this only when language- or framework-specific choices matter.

- Follow the repository’s established naming, errors, module boundaries, types, and testing style.
- Normalize untrusted/nullish input at IO boundaries before core logic.
- Prefer readable types that expose real relationships; avoid casts and type puzzles that bypass validation.
- Keep calculations and policy decisions pure when local conventions make that clearer; use stateful classes or wrappers at real IO/dependency boundaries.
- Preserve the project’s established exception, result, sentinel, or framework-filter contract. Changing that contract requires alignment and caller verification.
- In TypeScript, prefer `unknown` plus narrowing over `any`, exhaustive unions/maps where they catch missing cases, and `satisfies` where it prevents widening.
- Do not impose TypeScript, NestJS, `Result`, class/function, collection, or framework preferences on unrelated repositories.
