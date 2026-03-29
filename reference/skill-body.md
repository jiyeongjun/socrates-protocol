# Socrates Protocol

## Purpose
Surface what Socrates still does not know before implementation.
When continued context across turns would materially change the implementation, keep that context in one shared Markdown file at the workspace root: `SOCRATES_CONTEXT.md`.

This file is the only persisted state.
Do not create hidden JSON, archive logs, or a task registry.
This is a shared context document, not a task manager.

## Fast Path
If the request is already explicit, testable, and single-path:
- execute directly
- do not ask meta questions
- do not create `SOCRATES_CONTEXT.md`

## Use This Skill When
- ambiguity or unresolved constraints would change the implementation
- multiple turns are likely needed to settle the same task
- high-risk constraints or compatibility decisions are still open
- the user is likely to come back to the same task in later turns

## Do Not Use This Skill When
- the task is trivial, formatting-only, or already explicit and single-path
- one clarification question is enough and no turn-to-turn context needs to persist

## Workspace Root
Prefer the git repo root.
If no git repo is available, use the current working directory.

## Shared Context Lifecycle
1. Decide whether shared context is needed.
Create `SOCRATES_CONTEXT.md` only when continued context across turns would materially change the implementation.

2. Ask before creating the file.
Ask: `This task looks like it needs shared context. Should I keep it in SOCRATES_CONTEXT.md at the workspace root?`

3. Retry once if declined.
Explain once that turn-to-turn context may be lost without the file, then ask once more.
If the user declines a second time, continue without `SOCRATES_CONTEXT.md` and warn briefly that cross-turn context is not guaranteed.

4. Reuse or replace existing context.
If `SOCRATES_CONTEXT.md` already exists and clearly matches the same task, read it first and keep updating it.
If it exists for a materially different task, ask: `SOCRATES_CONTEXT.md already tracks a different task. Should I replace it and start this one instead?`

5. Rewrite the whole file.
Whenever you update the file, rewrite the entire document so frontmatter and body stay synchronized.

6. Clean up on completion.
If you successfully complete the task, delete `SOCRATES_CONTEXT.md`.
If the task stops incomplete or blocked, ask whether to keep or delete it.

## Required File Format
`SOCRATES_CONTEXT.md` must use YAML frontmatter plus fixed sections.
The frontmatter is the canonical machine-readable state.
The body is a user-facing rendering of that state and may be regenerated.

Use exactly these frontmatter fields:
- `version: 1`
- `status: "clarifying" | "ready" | "executing"`
- `task`
- `knowns`
- `unknowns`
- `next_question`
- `decisions`
- `updated_at`

Use exactly these body sections:
- `Task`
- `What Socrates Knows`
- `What Socrates Still Needs`
- `Next Question`
- `Fixed Decisions`
- `Status`

Treat the frontmatter as a standard generated shape, not arbitrary YAML.
If a user edits it into another YAML form, Socrates may ask to normalize it back to the standard format.

Template:

```md
---
version: 1
status: "clarifying"
task: "..."
knowns:
  - "..."
unknowns:
  - "..."
next_question: "..."
decisions: []
updated_at: "2026-03-29T00:00:00.000Z"
---

# Socrates Context

## Task
...

## What Socrates Knows
- ...

## What Socrates Still Needs
- ...

## Next Question
...

## Fixed Decisions
- None.

## Status
clarifying
```

## State Semantics
- `clarifying`: load-bearing unknowns still remain
- `ready`: no load-bearing unknowns remain, and implementation has not started
- `executing`: implementation is in progress after the context reached `ready`

## Malformed Context Files
If frontmatter is broken or the required body sections no longer match the canonical frontmatter values, ask:
`Should I normalize SOCRATES_CONTEXT.md back to the standard format?`

If the user agrees:
- preserve their content as much as possible
- rewrite the file in the standard format

If the user refuses:
- do not trust the file as persisted context
- continue without it

## Behavioral Rules
- Keep the file short and operational.
- Store only the current task, knowns, unknowns, next question, fixed decisions, and status.
- Do not store long transcripts, plans, or audit logs.
- Use at most one next question at a time.
- If `unknowns` becomes empty, move `status` to `ready`.
- Do not move to `executing` while unresolved `unknowns` remain.
- When implementation begins, move `status` from `ready` to `executing`.
- If the user asks to show current context, show `SOCRATES_CONTEXT.md`.
- If the user asks to delete, reset, or start over, delete `SOCRATES_CONTEXT.md`.
- For clear requests, prioritize correct execution over ceremony.

## Response Patterns
- Clear request: execute directly.
- Shared-context candidate: ask whether to create `SOCRATES_CONTEXT.md`, then stop.
- First decline: explain the tradeoff briefly and ask once more, then stop.
- Second decline: warn briefly and continue without persisted context.
- Existing different context: ask whether to replace the current file, then stop.
- Malformed file: ask whether to normalize it, then stop.
- Successful completion: delete the file and finish normally.
- Incomplete stop: ask whether to keep or delete the file, then stop.

## Examples
- `Design the account deletion API for our production SaaS. It must be GDPR-compliant and safe.`
  Ask whether to keep shared context in `SOCRATES_CONTEXT.md`, then continue with the next load-bearing question if the user agrees.
- `Let's continue the rename migration we were clarifying.`
  Read the existing `SOCRATES_CONTEXT.md` first, then continue from its current knowns, unknowns, and decisions.
- `Write a JavaScript function sum(numbers) that returns 0 for an empty array.`
  Execute directly and do not create `SOCRATES_CONTEXT.md`.
