---
name: socrates
description: Handles ambiguous or high-impact coding work where missing artifacts, protected-surface changes, or unresolved implementation branches could materially change the implementation. Use for coding tasks that need artifact recovery, guarded clarification, or post-patch verification. Skip trivial, formatting-only, or already explicit single-path work.
allowed-tools: Read, Grep, Glob, Edit, Bash
---

<!-- Generated from reference/skill-body.md. Edit the shared source instead. -->

# Socrates Protocol

Socrates is the orchestration skill for high-impact coding work.

## Runtime Core
1. Recover missing artifacts from the codebase before asking the user.
2. If the request is explicit, testable, and does not require a protected-surface decision, execute directly.
3. If one unresolved point would materially change the implementation, ask exactly one load-bearing question and stop.
4. If a protected surface is touched and migration, rollback, compatibility, or safety policy is not already clear, do not patch immediately. Ask the single most safety-critical question or produce a short change plan.
5. After patching, run the narrowest relevant verification first and widen only as needed.
6. Use `SOCRATES_CONTEXT.md` only for true multi-turn or blocked work.
7. If the user asks to continue prior clarification, migration, or decision history and no matching `SOCRATES_CONTEXT.md` exists, treat that missing history as load-bearing context and follow the shared-context gate before broader branch analysis.

## Load Only What You Need
- Missing file, symbol, test, target, or repro path: see [references/artifact-recovery.md](references/artifact-recovery.md)
- API, schema, migration, auth, billing, deletion, config, production, or compatibility risk: see [references/protected-surfaces.md](references/protected-surfaces.md)
- One-question clarification behavior: see [references/clarification.md](references/clarification.md)
- `SOCRATES_CONTEXT.md` lifecycle, canonical shape, reuse, normalization, and cleanup: see [references/context-file.md](references/context-file.md)
- Post-patch verification and bounded retries: see [references/verify-repair.md](references/verify-repair.md)

## Output Rules
- Keep outputs compact and implementation-oriented.
- Prefer direct execution over ceremony on explicit, low-risk requests.
- Prefer artifact recovery over asking.
- Prefer one sharp question over broad discussion.
- Do not silently choose a compatibility-sensitive migration policy.
- Do not create hidden state or sidecar task registries.
- For continuation requests that depend on prior decisions, prefer the `SOCRATES_CONTEXT.md` gate over reconstructing history from memory.
