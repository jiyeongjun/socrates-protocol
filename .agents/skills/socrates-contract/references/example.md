# Worked Example

A walk-through of one Socrates Contract from request to closure. Read this once before you author your first contract on a new project; the structure recurs in every later use.

## Setup
The user opens a project and writes:

> "We need to rename `plan_tier` to `billing_tier` across the codebase. It's persisted, used in the API, in two services, and in the dashboard."

This is a persisted-field rename across multiple surfaces. Rule 6's threshold fails on every leg: more than one coherent verification path, more than one decision, and the change crosses a protected surface. Contract files are required.

## Classification
Triggered by:
- Multi-surface mutation crossing distinct verification paths (schema, API, services, dashboard)
- Protected surface (persisted field, public API, production rollout)
- Compatibility-sensitive (cutover policy not stated)

## One Load-Bearing Question
Before scaffolding contracts, the agent identifies the single missing decision and asks one question:

> "Hard cutover (one release renames everything and migration runs at deploy) or backward-compatible transition (alias period where reads accept both names, writes go to `billing_tier`, then `plan_tier` is removed in a later release)? The choice changes the migration plan, the API contract, and the rollback lever."

The user replies:

> "Backward-compatible transition. We have rolling deploys."

## Macro Contract
The agent runs the scaffolder:

```bash
node scripts/scaffold-contract.mjs "Rename plan_tier to billing_tier (backward-compatible transition)"
```

It then fills in `contract-index.md`:

- Macro Goal: rename persisted field `plan_tier` → `billing_tier` across API, services, and dashboard, with backward-compatible transition.
- Success Criteria: writes go to `billing_tier`; reads accept both during transition; one later release removes `plan_tier`; no production read returns `null` for the new field.
- Scope: schema migration, ORM model, API serializer, two service consumers, dashboard query.
- Non-Goals: renaming related fields; changing tier semantics; data backfill beyond the new column.
- Protected Surfaces: persisted column, public API field name, dashboard query.
- Decisions: backward-compatible transition with alias period (per user).
- Open Questions: none load-bearing at macro level.
- Subcontracts: 4.
- Current Status: subcontract 001 active.

## Subcontracts
1. 001 — Schema migration with alias column. Add `billing_tier`, backfill from `plan_tier`, keep both writable. Verified by migration test.
2. 002 — ORM and serializer. Update model and API serializer to write `billing_tier`, accept reads from both. Verified by integration test.
3. 003 — Service consumers. Two services updated to read `billing_tier` first, fall back to `plan_tier`. Verified by service unit tests.
4. 004 — Dashboard query. Update dashboard to read `billing_tier`. Verified by smoke test on staging.

A separate later contract (out of scope here) handles `plan_tier` removal after one release cycle.

## Execution and Verification
Subcontract 001 moves to `executing`, the migration is written, the migration test runs, and on green the subcontract moves to `done`. `contract-index.md` is updated. Subcontract 002 moves to `executing`. The loop continues until 004 closes.

If a check fails, the agent repairs and re-runs the narrowest check (Rule 9). After two failed repairs, the agent stops, marks the subcontract `blocked`, surfaces the blocker as one question, and waits.

## Closure
With all four subcontracts `done`, the agent re-reads the macro success criteria and confirms each one against the diff and test output. The macro contract closes. The agent reports:

> "All four subcontracts closed; success criteria verified; `plan_tier` removal queued as a separate contract for the next release."

## What This Example Demonstrates
- One load-bearing question, not a list. The agent asked the one whose answer changed every later step, not three at once.
- Subcontracts split by verification boundary, not file count. Subcontract 003 is one subcontract even though it touches two services, because the verification is one test suite. Subcontract 004 is its own subcontract because the dashboard verification is a different test path.
- Scaffolding is bundled. The boilerplate of `contract-index.md` sections and YAML frontmatter is created by `scripts/scaffold-contract.mjs` so the agent spends its tokens on decisions, not on YAML.
- Macro success is verified explicitly. The agent did not assume that four green subcontracts mean the macro is done. It re-checked each macro success criterion against the actual diff and test output.

## Counter-Example: When Not To Do This
If the user instead said "fix the typo in `plan_tier` — should be `plan_tire`" in a single migration file, that is a single-file, single-test, reversible change with one coherent verification path. Rule 2 sends it inline: state the assumption ("editing migration file X.sql, line 12, replacing `plan_tier` → `plan_tire`"), apply the edit, run the migration test, report. No contract files. Forcing ceremony there would waste the user's time.

A near miss: if the user said "rename `plan_tier` to `plan_tire` — it's persisted but only in tests, not yet in any release," Rule 3 (tie-breaker) applies. State the assumption ("treating this as test-only because it has not shipped, single coherent verification path = the touched test files compile and pass"), proceed. If the verification reveals a leaked production reference, Rule 3's escalation kicks in and the work moves to a contract.
