# Shared Context File

Use this only when continued context across turns would materially change the implementation or the task is blocked on a decision.

## Creation Gate
- If the request is already explicit, testable, and single-path, execute directly and do not create `SOCRATES_CONTEXT.md`.
- If the user asks to continue, resume, or pick up prior clarification, migration, or decision history and no matching `SOCRATES_CONTEXT.md` exists, treat that missing history as load-bearing context.
- Before creating the file, ask: `This task looks like it needs shared context. Should I keep it in SOCRATES_CONTEXT.md at the workspace root?`
- If the user declines, explain once that cross-turn context may be lost and ask once more.
- If the user declines a second time, continue without the file and warn briefly.

## Reuse and Cleanup
- Prefer the git repo root. If no git repo is available, use the current working directory.
- If `SOCRATES_CONTEXT.md` already exists for the same task, read it first and continue from its current `task`, `knowns`, `unknowns`, `next_question`, `clarifying_phase`, `decisions`, and `status`.
- If `SOCRATES_CONTEXT.md` already exists for a different task, ask: `SOCRATES_CONTEXT.md already tracks a different task. Should I replace it and start this one instead?`
- Delete the file on successful completion.
- If the task stops incomplete or blocked, ask whether to keep or delete it.

## Canonical Shape
- Treat the YAML frontmatter as the canonical machine-readable state and the Markdown body as a rendered view that may be regenerated.
- Rewrite the whole file whenever you update it so frontmatter and body stay synchronized.
- Use exactly these frontmatter fields: `version: 2`, `status` (`clarifying` | `ready` | `executing`), `task`, `knowns`, `unknowns`, `next_question`, `clarifying_phase`, `decisions`, `updated_at`.
- Use exactly these body sections in this order: `Task`, `What Socrates Knows`, `What Socrates Still Needs`, `Next Question`, `Fixed Decisions`, `Status`.
- `clarifying` means load-bearing unknowns still remain.
- While `status` is `clarifying`, `clarifying_phase` must be `needs_question` or `awaiting_user_answer`.
- Set `clarifying_phase` to `needs_question` when the next load-bearing question still needs to be asked.
- After asking that question, rewrite the file and flip `clarifying_phase` to `awaiting_user_answer` before ending the turn.
- When the user answers and unresolved unknowns still remain, update the file and move `clarifying_phase` back to `needs_question` for the next question.
- If you enable the optional Stop hook, keep it fully state-driven: while `clarifying_phase` is `needs_question`, block the turn until the shared context file is rewritten to another valid state or replaced/deleted.
- Do not rely on the Stop hook to infer whether the pending question was “already asked” from the last assistant message.
- `ready` means no load-bearing unknowns remain and implementation has not started.
- `executing` means implementation started after the context reached `ready`.
- Do not move to `executing` while unresolved unknowns remain.

## Malformed Files
- Treat `version: 2` as the only canonical runtime format. Legacy `version: 1` files must be normalized or deleted before they count as persisted state again.
- If the file is malformed or the body drifts out of sync with frontmatter, ask: `Should I normalize SOCRATES_CONTEXT.md to the canonical version 2 format?`
- If the user agrees, preserve their content as much as possible and rewrite it to the canonical shape.
- Automatic normalization is frontmatter-driven. Body-only or partially corrupted files may require manual rewrite after diagnosis.
- If the user refuses, do not trust it as persisted context and continue without it.

## Rules
- `SOCRATES_CONTEXT.md` is the only persisted shared state.
- Do not create hidden JSON, logs, task registries, or sidecar state.
- Keep fields minimal and task-oriented.
- Use at most one `next_question` at a time.
- If `unknowns` becomes empty, move `status` to `ready`.
- When implementation begins, move `status` from `ready` to `executing`.
