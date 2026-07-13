---
protocol: socrates-contract
schema_version: "1.0"
contract_id: billing-migration
status: executing
created_at: "2026-07-01T00:00:00Z"
updated_at: "2026-07-12T00:00:00Z"
task_identity: "Resume the billing migration rollout"
active_subcontract: "001"
---

# Macro Goal

Resume the billing migration rollout without inferring authorization.

# Current State

- The rollout is paused while subcontract 001 waits for a cutover-policy decision.

# Success Criteria

- The active migration decision is recovered accurately.

# Scope

- Recover the durable billing-migration state and identify the unresolved rollout decision.

# Non-Goals

- Do not choose or execute a migration cutover from persisted state alone.

# Protected Surfaces

- Billing compatibility, production rollout behavior, and current authorization.

# Risks / Blast Radius

- Choosing the wrong cutover policy could disrupt billing reads during migration.

# Authorization Boundaries

- This file records task state only and grants no permission.

# Decisions

- No cutover policy has been selected.

# Open Questions

- Should the rollout use dual-read compatibility or a hard cutover?

# Rollback / Recovery

- No mutation has occurred; retain the blocked state until the user selects a policy.

# Verification Strategy

- Discovery must return billing-migration with subcontract 001 blocked and non-authorizing.

# Subcontracts

| ID | Task | Status | Next step | Verification |
|---|---|---|---|---|
| [001](subcontracts/001.md) | Choose the migration cutover policy | blocked | Ask whether the rollout is dual-read or hard cutover | Recover the same unresolved decision |

# Current Status

Active subcontract: 001 (blocked)
Last updated: 2026-07-12T00:00:00Z
