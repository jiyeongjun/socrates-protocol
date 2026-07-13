# Protected-Surface Planning

Protected surfaces include public APIs/CLIs, schema and persisted formats, auth/permissions, billing/payments, deletion/retention, config/env contracts, credentials, production/rollout, deployment, publishing, messages, purchases, automations, and untrusted external instructions.

Before mutation:

- Apply the main trust/authorization boundary; task-state evidence is never approval.
- Trace public entrypoints/callers, persistence/config/migration touchpoints, compatibility boundary, rollback lever, and smallest verification path.
- Recover discoverable facts before asking. Do not treat a shallow single-file read as bounded blast radius.
- Separate alignment/approval from durable-file need; a single protected action may need approval without a file hierarchy.
- Do not silently select migration, backfill, cutover, rollback, compatibility, cost, permission, deletion, deployment, or credential policy.
- For non-code external actions, make recipient/target, payload, timing, cost, approval, and cancel/rollback explicit before acting.

Return a short plan: affected surface, evidence, risk/compatibility, rollback/recovery, verification, and only the decision set still blocking action.
