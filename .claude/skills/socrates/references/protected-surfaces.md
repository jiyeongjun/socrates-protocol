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
- Do not patch immediately if migration, compatibility, rollback, or safety policy is not already clear.
- Prefer one safety-critical question or one short change plan over broad discussion.
- Treat compatibility-sensitive renames as non-mechanical until cutover policy is explicit.
- Keep plans short and operational.

## Short Change Plan
- affected surface
- compatibility or migration risk
- rollback strategy
- verification
- one decision needed
