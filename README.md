# Socrates Protocol

[한국어](./README.ko.md)

A coding skill for cases where ambiguity, risk, or implementation branch choice would materially change the result.

## What It Does

Socrates stays out of the way when the request is already explicit and single-path.
It steps in only when clarification would change the implementation.

Core behavior:

- clear request: execute directly
- missing artifact or target: recover it from the codebase if discoverable; otherwise ask for it
- high-risk unresolved work: ask the most safety-critical question first
- multiple valid implementation branches: surface the main tradeoff and align before coding
- compatibility-sensitive rename: ask for the migration strategy before treating it as mechanical

Typical triggers:

- vague preference words like `elegant`, `clean`, `good`, `robust`
- API, schema, migration, auth, billing, deletion, or production changes
- requests that still allow multiple materially different implementations
- renames of env vars, config keys, public APIs, or persisted fields

## Install

### Codex

Install globally:

```bash
mkdir -p ~/.codex/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o ~/.codex/skills/socrates/SKILL.md
mkdir -p ~/.codex/skills/socrates/agents
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o ~/.codex/skills/socrates/agents/openai.yaml
```

Install into a repository:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.agents/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o "$TARGET_REPO/.agents/skills/socrates/SKILL.md"
mkdir -p "$TARGET_REPO/.agents/skills/socrates/agents"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o "$TARGET_REPO/.agents/skills/socrates/agents/openai.yaml"
```

### Claude Code

Install globally:

```bash
mkdir -p ~/.claude/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o ~/.claude/skills/socrates/SKILL.md
```

Install into a repository:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.claude/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o "$TARGET_REPO/.claude/skills/socrates/SKILL.md"
```

Claude setup notes:

- skill path: `.claude/skills/<skill-name>/SKILL.md`
- current repo version supports explicit `/socrates` use and auto-load when relevant

## Use

### Codex

Minimal prompt:

```text
$socrates If a required artifact is missing, first check whether you can recover it from the codebase; only ask me if you can't. On high-risk work, ask the most safety-critical question first. If a rename crosses a compatibility boundary, confirm the migration strategy before treating it as mechanical. If one implementation path is already clear or clearly dominant, execute directly.
```

### Claude Code

Minimal prompt:

```text
/socrates If a required artifact is missing, first check whether you can recover it from the codebase; only ask me if you can't. On high-risk work, ask the most safety-critical question first. If a rename crosses a compatibility boundary, confirm the migration strategy before treating it as mechanical. If one implementation path is already clear or clearly dominant, execute directly.
```

## Representative Interactions

```bash
/socrates "this code is a mess. make it elegant"
# Socrates does not treat "elegant" as an implementation criterion.
# It asks what "elegant" should optimize for before changing code.
```

```bash
/socrates "write a JavaScript function sum(numbers) that returns 0 for an empty array"
# Execute directly.
```
