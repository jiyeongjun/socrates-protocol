# Socrates Protocol

[한국어](./README.ko.md)

A coding skill for cases where ambiguity, risk, or implementation branch choice would materially change the result.

## What It Does

Socrates stays out of the way when the request is already explicit and single-path.
It steps in only when clarification would change the implementation.
When the same ambiguous task needs continued context across turns, it can keep one shared file at the workspace root: `SOCRATES_CONTEXT.md`.

Core behavior:

- clear request: execute directly
- missing artifact or target: recover it from the codebase if discoverable; otherwise ask for it
- high-risk unresolved work: ask the most safety-critical question first
- multiple valid implementation branches: surface the main tradeoff before coding
- continued multi-turn context: ask before creating `SOCRATES_CONTEXT.md`
- successful completion: automatically delete `SOCRATES_CONTEXT.md`

Typical triggers:

- vague preference words like `elegant`, `clean`, `good`, `robust`
- API, schema, migration, auth, billing, deletion, or production changes
- requests that still allow multiple materially different implementations
- renames of env vars, config keys, public APIs, or persisted fields
- tasks likely to require several clarification rounds across turns

## Limitations

Socrates still relies on LLM judgment to decide whether ambiguity is load-bearing.
That means the entry check has the same basic limitation as the model it is guiding.

It is most effective when:

- high-risk signals are explicit in the prompt or visible in the code context
- the unresolved fork or missing constraint is already textually grounded
- the user can answer a small number of concrete clarification questions
- continued context across turns is genuinely necessary for the same task

It may miss:

- subtle implicit assumptions that are never stated
- team norms or business constraints that are not visible in the prompt or repo
- ambiguity that only becomes obvious deeper into implementation

Use it as a risk-reduction aid, not as a guarantee that every load-bearing ambiguity has been surfaced.
`SOCRATES_CONTEXT.md` is a shared current-context file, not a task manager.

## Quick Install

These examples currently track `main` until the first tagged release that includes the shared-context workflow is published.

### Codex

Install globally:

```bash
VERSION=main
mkdir -p ~/.codex/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/.agents/skills/socrates/SKILL.md -o ~/.codex/skills/socrates/SKILL.md
mkdir -p ~/.codex/skills/socrates/agents
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/.agents/skills/socrates/agents/openai.yaml -o ~/.codex/skills/socrates/agents/openai.yaml
```

Install into a repository:

```bash
VERSION=main
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.agents/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/.agents/skills/socrates/SKILL.md -o "$TARGET_REPO/.agents/skills/socrates/SKILL.md"
mkdir -p "$TARGET_REPO/.agents/skills/socrates/agents"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/.agents/skills/socrates/agents/openai.yaml -o "$TARGET_REPO/.agents/skills/socrates/agents/openai.yaml"
```

Minimal prompt:

```text
$socrates Clarify only when ambiguity would materially change the implementation. Use SOCRATES_CONTEXT.md only when shared context across turns is truly needed, and delete it on success.
```

Codex/OpenAI note:

- the generated agent metadata enables implicit invocation when the host supports it
- explicit `$socrates` remains the most deterministic path when you want to force the skill

### Claude Code

Install globally:

```bash
VERSION=main
mkdir -p ~/.claude/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/.claude/skills/socrates/SKILL.md -o ~/.claude/skills/socrates/SKILL.md
```

Install into a repository:

```bash
VERSION=main
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.claude/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/.claude/skills/socrates/SKILL.md -o "$TARGET_REPO/.claude/skills/socrates/SKILL.md"
```

Minimal prompt:

```text
/socrates Clarify only when ambiguity would materially change the implementation. Use SOCRATES_CONTEXT.md only when shared context across turns is truly needed, and delete it on success.
```

Claude setup notes:

- skill path: `.claude/skills/<skill-name>/SKILL.md`
- current repo version supports explicit `/socrates` use and auto-load when relevant

## Versioning

Socrates Protocol uses SemVer-style tags.
Start with `v0.1.0` while the behavior and prompt contract are still evolving.

- pin installs to a release tag for reproducible behavior
- until the first shared-context release is published, the quick-install examples intentionally use `VERSION=main`
- switch back to a release tag as soon as that release exists for reproducible installs
- treat `0.x` releases as unstable contracts that may still change between minor versions

### Context File Format

`SOCRATES_CONTEXT.md` currently uses `version: 1` in YAML frontmatter.

- while the project is still in `0.x`, the context file format is not yet a stable compatibility contract
- if the format changes incompatibly, increment the frontmatter version instead of silently reinterpreting old files
- prefer normalize-or-rewrite behavior on the next write rather than maintaining a long migration chain before `1.0`

To run the local validation scripts exactly as CI does, use Node `24+`.

## How Shared Context Works

Socrates only proposes `SOCRATES_CONTEXT.md` when continued context across turns would materially change the implementation.

- The file lives at the workspace root: prefer the git repo root; otherwise use the current working directory.
- The file is the only persisted state. There is no hidden JSON, archive log, or task registry behind it.
- The YAML frontmatter is the canonical machine-readable state.
- The Markdown body is a rendered view of that state and may be regenerated on the next update.
- Socrates expects the standard generated frontmatter shape, not arbitrary YAML forms.
- Socrates rewrites the whole file on each update using YAML frontmatter plus fixed Markdown sections.
- If you decline once, Socrates explains the tradeoff briefly and asks once more.
- If you decline twice, Socrates continues without persisted context and warns that cross-turn context is not guaranteed.
- If `SOCRATES_CONTEXT.md` already exists for the same task, Socrates reads it first and keeps updating it.
- If `SOCRATES_CONTEXT.md` already exists for a different task, Socrates asks whether to replace it or keep using the current file.
- If the file is malformed or the canonical body sections drift out of sync with frontmatter, Socrates asks whether to normalize it back to the standard format.
- When the task successfully ends, Socrates automatically deletes `SOCRATES_CONTEXT.md`.
- If the task stops incomplete or blocked, Socrates asks whether to keep or delete it.
- This is a shared current-context file, not a task manager.

The file shape is fixed:

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

`status` should be one of `clarifying`, `ready`, or `executing`.
Only move to `executing` after the file has reached `ready` with no unresolved `unknowns`.

## Representative Interactions

```bash
/socrates "write a JavaScript function sum(numbers) that returns 0 for an empty array"
# Execute directly.
# Do not create SOCRATES_CONTEXT.md.
```

```bash
/socrates "Design the account deletion API for our production SaaS. It must be GDPR-compliant and safe."
# Socrates: This task looks like it needs shared context. Should I keep it in SOCRATES_CONTEXT.md at the workspace root?
# User: yes
# Socrates creates SOCRATES_CONTEXT.md and continues with the next load-bearing question.
```

```bash
/socrates "show the current context"
# Socrates reads SOCRATES_CONTEXT.md and shows the current task, knowns, unknowns, next question, decisions, and status.
```

```bash
/socrates "we're done"
# If the task succeeded, Socrates automatically deletes SOCRATES_CONTEXT.md.
# If the task stopped incomplete, Socrates asks whether to keep or delete it.
```
