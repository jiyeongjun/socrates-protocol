# Protected Surfaces

Use this when the change may affect compatibility, safety, rollback, or external contracts.

## Protected Surfaces
- public APIs or CLIs
- schema or migration changes
- persisted fields or formats
- auth, permissions, or security boundaries
- billing or payments
- deletion or retention
- config keys or env contracts
- production behavior or rollout-sensitive logic

## Rules
- On first detection of a protected surface whose migration, compatibility, rollback, or safety policy is still unclear, run `protected_surface_planner` before patching.
- Do not patch immediately if migration, compatibility, rollback, or safety policy is not already clear.
- After the required exploration pass, do not reply with only an intent to inspect files or trace call sites.
- If the planner leaves exactly one load-bearing policy decision unresolved, ask that one question. Otherwise keep the planner output as the short change plan and proceed from there.
- Prefer one safety-critical question or one short change plan over broad discussion.
- Treat compatibility-sensitive renames as non-mechanical until cutover policy is explicit.
- Persisted-field renames and schema renames are not self-justifying. If the prompt does not explicitly define migration, backfill, rollback, and compatibility handling, stop and ask before patching.
- Treat words like `production`, `safe`, or `keep rollout safe` as risk signals that trigger planning, not as permission to silently choose a migration strategy.
- Example: `Rename persisted field plan_tier to billing_tier across this production data model` must stop and ask whether to do a hard cutover or a backward-compatible transition if the prompt does not say.
- Keep plans short and operational.

## Short Change Plan
- affected surface
- compatibility or migration risk
- rollback strategy
- verification
- one decision needed
