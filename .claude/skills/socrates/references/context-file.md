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
- If `SOCRATES_CONTEXT.md` already exists for the same task, read it first and continue from its current `task`, `knowns`, `unknowns`, `next_question`, `decisions`, and `status`.
- If `SOCRATES_CONTEXT.md` already exists for a different task, ask: `SOCRATES_CONTEXT.md already tracks a different task. Should I replace it and start this one instead?`
- Delete the file on successful completion.
- If the task stops incomplete or blocked, ask whether to keep or delete it.

## Canonical Shape
- Treat the YAML frontmatter as the canonical machine-readable state and the Markdown body as a rendered view that may be regenerated.
- Rewrite the whole file whenever you update it so frontmatter and body stay synchronized.
- Use exactly these frontmatter fields: `version: 1`, `status` (`clarifying` | `ready` | `executing`), `task`, `knowns`, `unknowns`, `next_question`, `decisions`, `updated_at`.
- Use exactly these body sections in this order: `Task`, `What Socrates Knows`, `What Socrates Still Needs`, `Next Question`, `Fixed Decisions`, `Status`.
- `clarifying` means load-bearing unknowns still remain.
- `ready` means no load-bearing unknowns remain and implementation has not started.
- `executing` means implementation started after the context reached `ready`.
- Do not move to `executing` while unresolved unknowns remain.

## Malformed Files
- If the file is malformed or the body drifts out of sync with frontmatter, ask: `Should I normalize SOCRATES_CONTEXT.md back to the standard format?`
- If the user agrees, preserve their content as much as possible and rewrite it to the canonical shape.
- If the user refuses, do not trust it as persisted context and continue without it.

## Rules
- `SOCRATES_CONTEXT.md` is the only persisted shared state.
- Do not create hidden JSON, logs, task registries, or sidecar state.
- Keep fields minimal and task-oriented.
- Use at most one `next_question` at a time.
- If `unknowns` becomes empty, move `status` to `ready`.
- When implementation begins, move `status` from `ready` to `executing`.
