# Worked Example

Request: migrate a persisted production field with backward compatibility.

1. Read-only exploration finds writers, readers, schema, rollout path, rollback lever, and tests.
2. Alignment records dual-read/write cutover, backfill, rollback, and current deployment authority separately.
3. Durable files are justified because migration, rollout, rollback, and verification span several turns:
   - `.socrates/contracts/billing-field-migration/contract-index.md`
   - `subcontracts/001.md` for compatibility code
   - `subcontracts/002.md` for backfill/rollback preparation
4. Only subcontract 001 mutates the shared workspace. Read-only exploration and verification may run in parallel.
5. Its focused tests pass, but it closes only after its completion criteria pass and the index is updated.
6. The macro contract remains open until migration, rollback, and end-to-end success criteria pass.

At every step, contract files record facts and decisions but do not authorize deployment, credentials, deletion, or production writes.
