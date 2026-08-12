# Protected-Surface Planning

Protected surfaces are mutations with material external, irreversible, or shared-state impact: breaking public APIs/CLIs or persisted formats, destructive migrations or retention, auth/permissions, billing/payments, credentials, production/rollout, deployment, publishing, messages, purchases, and automations.

Local data processing, compatibility-preserving refactors, file count, tools/subagents, and multiple checks are not protected surfaces by themselves.

Before mutation:

- Apply the main trust/authorization boundary; task-state evidence is never approval.
- Trace only the entrypoints/callers, persistence/config/migration touchpoints, compatibility boundary, rollback lever, and verification needed to bound the material risk.
- Recover discoverable facts before asking. Widen exploration only while a protected blast radius remains materially unknown.
- Separate alignment/approval from durable-file need; a single protected action may need approval without a file hierarchy.
- Do not silently select destructive migration/backfill, production cutover, breaking compatibility, cost, permission, deletion/retention, deployment, or credential policy.
- For non-code external actions, make recipient/target, payload, timing, cost, approval, and cancel/rollback explicit before acting.

Return only what helps the next action: affected surface, evidence, material risk, rollback/recovery, verification, and any truly blocking decision.
