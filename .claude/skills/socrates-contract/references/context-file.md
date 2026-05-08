# Legacy Single Context File

Use this only for compatibility with existing Socrates installs or workspaces that already contain `SOCRATES_CONTEXT.md`.

## Rules
- Prefer `contract-index.md` plus `contracts/contract-NNN.md` for new large or multi-step goals.
- If an existing `SOCRATES_CONTEXT.md` is present and appears to track the same active task, read it before creating new contract files.
- If the old file contains durable decisions, migrate those decisions into the macro contract or active subcontract before mutating.
- If `SOCRATES_CONTEXT.md` tracks a different task, ask whether to leave it untouched or replace it with the new contract-file workflow.
- Do not maintain both `SOCRATES_CONTEXT.md` and `contract-index.md` for the same task after migration. Choose one visible contract system.
- Existing hooks may still restore `SOCRATES_CONTEXT.md` context on session start. Treat that as legacy continuity, not the preferred new workflow.
- If a hook injects legacy context for a task that now uses contract files, migrate durable decisions once, then stop writing the legacy file for that task.

## Migration
1. Read the legacy task, knowns, unknowns, decisions, next question, and status.
2. Draft `contract-index.md` from the task, decisions, and open questions (use `node scripts/scaffold-contract.mjs "<macro goal>"` for the boilerplate).
3. Create one subcontract for the next bounded problem.
4. Ask one load-bearing question if the macro goal is still not aligned.
5. After migration succeeds, propose deleting the legacy `SOCRATES_CONTEXT.md` in your next reply unless the user has explicitly asked to preserve it. Why: keeping both files alive is the most common source of stale state, because future turns may read the legacy file and act on outdated decisions.

## Auto-Cleanup End Condition
Migration is complete when all three hold:
- All durable decisions, knowns, unknowns, and the active next step have been moved into contract files.
- `contract-index.md` references the active subcontract.
- The user has either confirmed deletion of `SOCRATES_CONTEXT.md` or explicitly asked to preserve it.

After the end condition is met, do not write to `SOCRATES_CONTEXT.md` for this task again. If a session-start hook re-injects legacy context after migration, treat it as informational only and do not let it overwrite contract-file decisions.

## Do Not
- Do not create `SOCRATES_CONTEXT.md` for new multi-step work.
- Do not store execution micro-state in either legacy or new contract files.
- Do not trust malformed legacy files as canonical state until normalized or migrated.
