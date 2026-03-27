# Socrates Protocol

[한국어](./README.ko.md)

A coding skill that steps in when ambiguity or branch choice would change the implementation.

---

## Overview

Socrates is a human-in-the-loop coding skill for work where ambiguity or unresolved implementation forks could materially change the implementation.

It enforces one rule:

> Only apply reasoning where truth can be decided.

When ambiguity is load-bearing, it turns the request into an explicit, testable working agreement before coding.
If a required artifact or target is missing, it recovers it from the codebase when discoverable; otherwise it asks for that first instead of branching prematurely.
When high-risk constraints are still unresolved, it asks the most safety-critical question before discussing strategy.
When the request sounds clear but still permits multiple materially different implementation paths, it surfaces the paths and asks the user to align on direction before coding.
When the request is already clear and only one reasonable or clearly dominant path remains, it should stay out of the way and execute directly.

It is most useful when the cost of rework is higher than the cost of clarification.

---

## Core Principle

> Apply inference only to decidable propositions.  
> If a problem is undecidable, stop reasoning.

---

## Why

Most wasted time in engineering comes from:

- reasoning about undefined concepts
- debating non-decidable questions
- trying to justify choices that cannot be proven

Socrates reduces that overhead so you can:

- cut rework caused by misunderstood requirements
- avoid changing the success criteria halfway through review
- agree on what "done" means before implementation starts
- reduce the risk of starting important changes from bad assumptions
- implement already-clear requests without unnecessary process

---

## What it does

1. Checks whether the request is already specific enough to implement
2. Validates important claims for:
   - definability
   - observability
   - evaluability
   - reproducibility
   - and, for high-risk work, constraints like legal obligations, auditability, rollback, and idempotency
3. If a material point fails validation:
   - stops reasoning
   - asks minimal clarification
4. If a required artifact or target is missing:
   - recovers it from the codebase when discoverable
   - otherwise asks only for that missing input first
5. If multiple valid implementation branches remain after the required artifacts and safety-critical constraints are decided:
   - surfaces the decision-relevant branches and tradeoffs
   - keeps clarifying until the implementation direction is aligned
6. If material ambiguity remains:
   - writes a short working agreement
7. If the request is already clear, one branch is dominant, or the agreement is sufficient:
   - executes precisely

---

## When to use

Use Socrates for:

- ambiguous requirements
- architecture decisions
- API design
- refactors or code changes with multiple valid strategies
- schema changes
- high-risk changes

Pay extra attention when prompts mention signals like:

- production systems
- real user data
- auth or permissions
- billing or financial flows
- migrations or deletion
- legal or regulatory obligations

Do NOT use for:

- trivial edits
- formatting
- clearly specified tasks
- tasks that only need one direct question to recover a missing artifact or file

### Common failure modes Socrates prevents

- implementing against words like "clean", "good", or "scalable" without agreed criteria
- discovering in review that the stakeholder meant something materially different
- locking in assumptions too early and starting a high-impact change in the wrong direction
- silently choosing one valid implementation path when the user expected another

---

## Installation

### Codex

Install from anywhere:

```bash
mkdir -p ~/.codex/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o ~/.codex/skills/socrates/SKILL.md
mkdir -p ~/.codex/skills/socrates/agents
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o ~/.codex/skills/socrates/agents/openai.yaml
```

Install into another repository:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.agents/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o "$TARGET_REPO/.agents/skills/socrates/SKILL.md"
mkdir -p "$TARGET_REPO/.agents/skills/socrates/agents"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o "$TARGET_REPO/.agents/skills/socrates/agents/openai.yaml"
```

---

### Claude Code

Install from anywhere:

```bash
mkdir -p ~/.claude/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o ~/.claude/skills/socrates/SKILL.md
```

Install into another repository:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.claude/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o "$TARGET_REPO/.claude/skills/socrates/SKILL.md"
```

---

## Usage

### Codex

Copy-paste prompts:

```text
$socrates If a required artifact is missing, recover it from the codebase if discoverable; otherwise ask only for that first. If high-risk constraints are unresolved, ask the most safety-critical question first. If one path is clearly implied or a standard approach is dominant, execute directly.
$socrates If multiple valid implementation branches still remain after the required artifacts and safety-critical constraints are decided, surface the most decision-relevant tradeoffs and keep asking until our implementation direction is aligned. Otherwise write the code.
```

Shorthand invocation is tuned for these response patterns:

- clear request: execute directly
- missing required artifact: recover it from the codebase if discoverable; otherwise ask only for that artifact first
- undefined preference word like `elegant`, `good`, or `clean`: ask one clarifying question first
- high-risk unresolved request: ask the most load-bearing safety question first, usually within 1 to 3 questions total
- multiple valid implementation branches: surface the main forks only after the required artifacts and safety-critical constraints are decided

If you want the most explicit behavior, the longer prompt above is still the safest fallback.

---

### Claude Code

Latest Claude Code docs still support project and personal skills at `.claude/skills/<skill-name>/SKILL.md`.
Anthropic now documents custom commands as merged into skills, so keeping Socrates as a skill is still the correct integration point for Claude Code.
This repository intentionally leaves out `disable-model-invocation` on the Claude skill so Claude can auto-load Socrates when the request actually matches the skill.
`user-invocable: true` is still kept, so `/socrates` remains available for explicit invocation when you want to force the behavior manually.
If you want a stricter manual-only workflow again, add `disable-model-invocation: true` back to [`/.claude/skills/socrates/SKILL.md`](./.claude/skills/socrates/SKILL.md).
The description is tuned to catch vague preference words and reliability-hardening prompts without auto-grabbing trivial formatting or already explicit single-path edits.
Subagents are a different feature intended for isolated specialist workers; Socrates is kept as a skill because it changes how the main conversation clarifies and executes work.

Copy-paste prompts:

```text
/socrates If a required artifact is missing, recover it from the codebase if discoverable; otherwise ask only for that first. If high-risk constraints are unresolved, ask the most safety-critical question first. If one path is clearly implied or a standard approach is dominant, execute directly.
/socrates If multiple valid implementation branches still remain after the required artifacts and safety-critical constraints are decided, surface the most decision-relevant tradeoffs and keep asking until our implementation direction is aligned. Otherwise write the code.
```

Shorthand invocation is tuned for the same response patterns:

- clear request: execute directly
- missing required artifact: recover it from the codebase if discoverable; otherwise ask only for that artifact first
- undefined preference word like `elegant`, `good`, or `clean`: ask one clarifying question first
- high-risk unresolved request: ask the most load-bearing safety question first, usually within 1 to 3 questions total
- multiple valid implementation branches: surface the main forks only after the required artifacts and safety-critical constraints are decided

Claude Code system prompt snippet:

```text
Use Socrates behavior when ambiguity or branch choice would materially change the implementation:
- if a required artifact is missing, recover it from the codebase if discoverable; otherwise ask only for that artifact first
- if the request is already explicit and testable and only one reasonable or clearly dominant implementation path remains, execute directly
- ask at most 1-3 load-bearing clarification questions when ambiguity would change the implementation
- if high-risk constraints and branch choice are both unresolved, ask the most safety-critical question first
- if multiple valid implementation branches remain after the required artifacts and safety-critical constraints are decided, surface the main tradeoffs and keep clarifying until the implementation direction is aligned
- write a compact working agreement only when material ambiguity remains
- do not add process to clear requests
```

Claude Code skill frontmatter in this repo:

```yaml
---
name: socrates
description: Use for ambiguous preference words, reliability-hardening changes, and high-impact coding or design work where ambiguity or unresolved implementation branches could change the implementation. Skip trivial, formatting-only, or already explicit single-path tasks.
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Bash
---
```

---

## How Socrates Responds

Socrates does not argue abstractly about vague words.
It surfaces only the ambiguity or branch choice that would change implementation, and it stays out of the way when the request is already clear and one path is dominant.
Undefined preference words like `elegant`, `good`, and `clean` are treated as unresolved if they would materially change the implementation.
If a required artifact or target is missing, Socrates should recover it from the codebase when discoverable; otherwise ask for it first instead of analyzing branches.
Even if the wording sounds explicit, Socrates should not silently choose among multiple valid strategies when that choice would materially affect the result.
For high-risk requests, Socrates should ask the most safety-critical load-bearing questions first instead of front-loading a contract or branch analysis.
When several reasonable implementation paths remain, Socrates should surface the next most important fork only after the required artifacts and safety-critical constraints are decided.
The examples below are illustrative, not fixed response templates. The actual clarification should adapt to the request and ask only what would change the implementation.

### Example 1: Defining "elegant"

User:

```text
Write this function elegantly
```

Socrates:

```text
"Elegant" is load-bearing here because it changes the implementation.
What should it optimize for in this function?
Examples: concise, readability, idiomatic style, performance, or your own criteria.
```

User:

```text
concise and readable
```

Socrates:

```text
Proceeds with implementation using concise and readable code as the contract.
```

### Example 2: Defining "good"

User:

```text
Design a good API
```

Socrates:

```text
"Good" is not specific enough to design against yet.
Which property matters most for this API?
Examples: minimal surface area, scalability, developer experience, performance, or your own criteria.
```

### Example 3: Executing a clear request directly

User:

```text
Write a JavaScript function `sum(numbers)` that returns the total and returns 0 for an empty array.
```

Socrates:

```text
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}
```

### Example 4: Aligning on implementation direction

User:

```text
Refactor this API client so retries are safer.
```

Socrates:

```text
Which failures should remain retryable, and do requests already have idempotency keys or another unique request ID?
If those are already decided, I can narrow the retry strategy next.
```

### Example 5: Recovering a Missing Artifact

User:

```text
Format this file with Prettier and sort imports.
```

Socrates:

```text
Which file should I format?
```

---

## Design Principles

- No reasoning without decidability
- No fake precision
- No unnecessary justification
- Minimal questions, maximum clarity
- Direct execution on clear requests
- Alignment first only when ambiguity is material

---

## Philosophy

Socrates is not meant to add process to every task.

It is meant to stop only where ambiguity is load-bearing, and to execute directly when the request is already clear.

The practical benefit is:

- less implementation built on undefined terms
- earlier detection when the user and the agent are using the same words with different meanings
- earlier agreement on decision criteria instead of retroactive justification
- lower failure cost on high-impact changes because assumptions are forced into the open first
