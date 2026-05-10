# Contract Files

Use this when a macro goal needs durable context, several independent problems, several turns, or explicit user-agent alignment before mutation.

## Quick Scaffold
For a fresh contract, run the bundled scaffolder from the workspace root:

```bash
node scripts/scaffold-contract.mjs "<one-line macro goal>"
```

It creates `contract-index.md` with all required sections plus `contracts/contract-001.md` with YAML frontmatter and the body sections required below. Edit the placeholders rather than recreating the structure each time. Why: the boilerplate is identical every run; bundling it removes a class of schema drift errors and keeps the agent focused on decisions, not on YAML formatting. The script refuses to overwrite existing files.

## Paths
- Put `contract-index.md` at the workspace root unless the user names another location.
- Put subcontracts under `contracts/contract-001.md`, `contracts/contract-002.md`, etc.
- Before creating new contract files, check for an existing `contract-index.md` or `contracts/`. If one tracks an unrelated active task, do not overwrite it; ask one load-bearing location or replacement question unless the user already named a location.
- If background detail would push a contract over 500 lines, put it under `reference/` and link to it directly from the index or a subcontract.
- Keep references one level deep. A contract file may link to `reference/foo.md`; that reference file must not point to another reference file.
- If the workspace already uses `reference/` for another purpose, use `contracts/reference/` and note that choice in `contract-index.md`.

## Macro Index
`contract-index.md` is the contract ledger and routing index. It summarizes the macro goal and points to each subcontract.

Required sections:
- `Macro Goal`
- `Success Criteria`
- `Scope`
- `Non-Goals`
- `Protected Surfaces`
- `Decisions`
- `Open Questions`
- `Subcontracts`
- `Current Status`

Each subcontract entry must include:
- path
- one-line task summary
- status
- current next step
- verification method

## Subcontract Frontmatter
Each `contracts/contract-NNN.md` file must start with YAML frontmatter containing at least:

```yaml
---
task: "..."
status: "proposed"
knowns:
  - "..."
unknowns:
  - "..."
next_step: "..."
updated_at: "YYYY-MM-DDTHH:mm:ss.sssZ"
---
```

Allowed `status` values:
- `proposed`: drafted but not aligned
- `aligned`: ready to execute
- `executing`: mutation started
- `blocked`: waiting on user, environment, or dependency
- `verifying`: mutation done and checks running
- `done`: completion criteria met

Required body sections:
- `Inputs`
- `Completion Criteria`
- `Mutation Plan`
- `Verification`

Recommended body sections:
- `Work Log`
- `Result`

## Contract Sizing
- Make each subcontract independently verifiable.
- Prefer fewer useful contracts over many tiny chores.
- Split a contract when it has unrelated mutation surfaces, different verification paths, or separate user decisions.
- Merge a contract when two steps cannot be verified separately.

## Update Rules
- Before mutating, make the active subcontract `aligned` or ask one load-bearing question.
- When mutation starts, set the active subcontract to `executing`.
- After mutation, set it to `verifying`, run checks, and record the commands or inspection performed.
- Set it to `done` only when its completion criteria pass.
- Update `contract-index.md` immediately after a subcontract reaches `done`, `blocked`, or materially changes scope.
- Do not keep private state outside these visible files.
