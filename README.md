# Socrates Protocol

[![Version](https://img.shields.io/github/v/tag/jiyeongjun/socrates-protocol?label=version)](https://github.com/jiyeongjun/socrates-protocol/tags)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[한국어](./README.ko.md)

A coding skill for cases where ambiguity, risk, or implementation branch choice would materially change the result.

## What It Does

Socrates stays out of the way when the request is already explicit and single-path.
It steps in only when clarification would change the implementation.
When the same ambiguous task needs continued context across turns, it can keep one shared file at the workspace root: `SOCRATES_CONTEXT.md`.

Core behavior:

- clear request: execute directly
- missing artifact or target: look for it in the codebase first; otherwise ask for it
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

## How It Flows

Socrates is one router skill.
It tries the lightest safe path first instead of asking questions by default.

```mermaid
flowchart LR
    classDef decision fill:#fff7ed,stroke:#f59e0b,color:#7c2d12;
    classDef action fill:#ffffff,stroke:#475569,color:#0f172a;
    classDef done fill:#ecfdf5,stroke:#10b981,color:#065f46;
    classDef repair fill:#fef2f2,stroke:#ef4444,color:#7f1d1d;

    subgraph T["1. Triage"]
        direction TB
        A([User request]):::action --> B{Clear and<br/>single-path?}:::decision
        B -- Yes --> C[Execute directly]:::action
        B -- No --> D{Primary blocker}:::decision
    end

    subgraph R["2. Resolve Only What Matters"]
        direction TB
        E[Look in the<br/>codebase first]:::action
        F[Ask one safety-critical<br/>question or short plan]:::action
        G[Ask one load-bearing<br/>question]:::action
        H[Offer<br/>SOCRATES_CONTEXT.md]:::action
    end

    subgraph X["3. Execute And Verify"]
        direction TB
        I[Implement]:::action --> J[Run the smallest<br/>useful check first]:::action
        J --> K{Finished cleanly?}:::decision
        K -- Yes --> L([Complete and clean up]):::done
        K -- No --> M[Repair, or ask one<br/>missing question]:::repair
    end

    D -- Missing file / symbol / test / target --> E
    D -- Risky change / external contract --> F
    D -- Key choice still open --> G
    D -- Cross-turn context needed --> H

    C --> J
    E --> I
    F --> I
    G --> I
    H --> I
    M --> I
```

In short:

- clear request: do the work
- missing target: search first, ask later
- risky change: stop and clarify the safety decision
- shared context: use one file, `SOCRATES_CONTEXT.md`
- after changes: verify narrowly before widening scope

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

These examples are pinned to the current tagged version: `v0.3.0`.

### Codex

Recommended quick install:

```bash
VERSION=v0.3.0 && curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --platform codex --scope global --version "$VERSION" --enable-codex-hooks
```

Want the Stop hook from the start:

```bash
VERSION=v0.3.0 && curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode install --platform codex --scope global --version "$VERSION" --feature stop-hook --enable-codex-hooks
```

Codex hook activation:

- the recommended install command above already enables `codex_hooks = true` in `~/.codex/config.toml`
- if you installed earlier without `--enable-codex-hooks`, the skill still works, but the `SessionStart` and optional `Stop` hooks do not run until you enable that feature flag
- you can fix an existing install by rerunning the installer with `--enable-codex-hooks`, or by running this one-time fallback command:

```bash
mkdir -p ~/.codex && node --input-type=module - <<'EOF'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const configPath = path.join(homedir(), ".codex", "config.toml");
mkdirSync(path.dirname(configPath), { recursive: true });
const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
const featuresPattern = /^\[features\]\s*$(?:\n(?!\[).*)*/m;

let next = existing;
if (!featuresPattern.test(existing)) {
  next = `${existing.trimEnd()}\n\n[features]\ncodex_hooks = true\n`.trimStart();
} else {
  next = existing.replace(featuresPattern, (section) => {
    if (/^\s*codex_hooks\s*=.*$/m.test(section)) {
      return section.replace(/^\s*codex_hooks\s*=.*$/m, "codex_hooks = true");
    }
    return `${section}\ncodex_hooks = true`;
  });
}

writeFileSync(configPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
console.log(`Updated ${configPath}`);
EOF
```

Update in place:

- rerun the same install command with the version you want
- the installer overwrites stale Socrates files, keeps unrelated hook entries, and installs the hook support files needed for self-contained execution

Uninstall:

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.3.0/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform codex --scope global
```

Install into a repository:

```bash
VERSION=v0.3.0 && TARGET_REPO=/absolute/path/to/your/repo && curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --platform codex --scope repo --target-repo "$TARGET_REPO" --version "$VERSION" --enable-codex-hooks
```

Explicit invocation example:

```text
$socrates Design the account deletion API for our production SaaS. It must be GDPR-compliant and safe.
```

Auto-load example:

```text
Design the account deletion API for our production SaaS. It must be GDPR-compliant and safe.
```

Codex/OpenAI note:

- the generated agent metadata enables implicit invocation when the host supports it
- explicit `$socrates` remains the most deterministic path when you want to force the skill

Optional Codex hook:

- this repo also ships a conservative repo-local hook at `.codex/hooks.json`
- it only runs on `SessionStart` and only adds context when `SOCRATES_CONTEXT.md` already exists
- it helps resumed Socrates tasks recover their shared context without changing fast-path tasks
- Codex hooks are configured by `hooks.json` layers, not by per-skill activation, so this hook file is loaded whenever the repo hook layer is active
- the included hook script is therefore intentionally a no-op unless it finds `SOCRATES_CONTEXT.md`
- the search walks upward only until the nearest git root, so a nested repo does not accidentally adopt a parent repo's `SOCRATES_CONTEXT.md`
- the quick-install command above installs the Socrates router skill, mirrored `references/` files, and the Socrates `SessionStart` hook, merging into any existing `hooks.json`
- the recommended Codex install command above also enables the required `codex_hooks = true` feature flag for you

Optional Stop hook:

- the default install does not add a `Stop` hook
- install it separately only if you want Socrates to keep pushing one more clarification turn while `SOCRATES_CONTEXT.md` remains in `clarifying`
- this hook is stronger than `SessionStart`: it can continue a turn instead of just restoring context
- because hooks are config-scoped rather than skill-scoped, it may still affect non-Socrates work in the same repo if the current assistant message overlaps enough with the clarifying task
- the included implementation is conservative: it requires a canonical `SOCRATES_CONTEXT.md`, `status: "clarifying"`, a pending `next_question`, and relevant overlap with the last assistant message

Install the optional Codex Stop hook:

```bash
VERSION=v0.3.0 && curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode install --platform codex --scope global --version "$VERSION" --feature stop-hook --enable-codex-hooks
```

Remove only the optional Codex Stop hook:

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.3.0/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform codex --scope global --feature stop-hook
```

### Claude Code

Recommended quick install:

```bash
VERSION=v0.3.0 && curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --platform claude --scope global --version "$VERSION"
```

Want the Stop hook from the start:

```bash
VERSION=v0.3.0 && curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode install --platform claude --scope global --version "$VERSION" --feature stop-hook
```

Claude hook behavior:

- the recommended install command already installs the Socrates router skill, mirrored `references/` files, Claude-only subagents in `.claude/agents/`, and the conservative `SessionStart` hook
- the default install does not add the stronger `Stop` hook
- the second command above adds that stronger `Stop` hook from the start

Update in place:

- rerun the same install command with the version you want
- the installer overwrites stale Socrates files, keeps unrelated settings, and installs the hook support files needed for self-contained execution

Uninstall:

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.3.0/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform claude --scope global
```

Install into a repository:

```bash
VERSION=v0.3.0 && TARGET_REPO=/absolute/path/to/your/repo && curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/$VERSION/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --platform claude --scope repo --target-repo "$TARGET_REPO" --version "$VERSION"
```

Explicit invocation example:

```text
/socrates Design the account deletion API for our production SaaS. It must be GDPR-compliant and safe.
```

Auto-load example:

```text
Design the account deletion API for our production SaaS. It must be GDPR-compliant and safe.
```

Claude setup notes:

- skill path: `.claude/skills/<skill-name>/SKILL.md`
- Claude-only Socrates subagents: `.claude/agents/socrates-explore.md`, `.claude/agents/socrates-plan.md`, `.claude/agents/socrates-verify.md`
- detailed on-demand guidance lives one level deep under `.claude/skills/socrates/references/`
- current repo version supports explicit `/socrates` use and auto-load when relevant
- this repo also ships a conservative project hook at `.claude/settings.json`
- it only runs on `SessionStart` and only adds context when `SOCRATES_CONTEXT.md` already exists
- Claude hooks are configured by settings layers, not by per-skill activation, so the included hook is intentionally a no-op unless it finds the shared context doc
- the search walks upward only until the nearest git root, so a nested repo does not accidentally adopt a parent repo's `SOCRATES_CONTEXT.md`
- the quick-install command above installs the Socrates router skill, mirrored `references/` files, Claude-only subagents, and the Socrates `SessionStart` hook, merging into any existing `.claude/settings.json`

Optional Claude Stop hook:

- the default install does not add a `Stop` hook
- install it separately only if you want Socrates to keep pushing one more clarification turn while `SOCRATES_CONTEXT.md` remains in `clarifying`
- this hook is stronger than `SessionStart`: it can continue a turn instead of just restoring context
- because hooks are config-scoped rather than skill-scoped, it may still affect non-Socrates work in the same project when the last assistant message overlaps with the clarifying task
- the included implementation is conservative: it requires a canonical `SOCRATES_CONTEXT.md`, `status: "clarifying"`, a pending `next_question`, and relevant overlap with the last assistant message

Install the optional Claude Stop hook:

- same command as the quick note above

Remove only the optional Claude Stop hook:

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.3.0/scripts/install.mjs | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform claude --scope global --feature stop-hook
```

## Versioning

Socrates Protocol uses SemVer-style tags.
The current tagged version is `v0.3.0`.

- the quick-install examples pin to the same tag shown above for reproducible installs
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
- If you enable the optional Codex repo hook, it only restores context on session start when `SOCRATES_CONTEXT.md` already exists.

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
