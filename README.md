# Socrates Protocol

[한국어](./README.ko.md)

A cognitive resource allocation protocol for software development.

---

## Overview

Socrates is a human-in-the-loop coding skill designed for high-impact work.

It enforces one rule:

> Only apply reasoning where truth can be decided.

Before writing code, it eliminates ambiguity by converting requests into explicit, testable contracts.

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

Socrates reduces that overhead so teams can:

- cut rework caused by misunderstood requirements
- avoid changing the success criteria halfway through review
- agree on what "done" means before implementation starts
- reduce the risk of starting important changes from bad assumptions

---

## What it does

1. Converts requests into explicit propositions
2. Validates:
   - definability
   - observability
   - evaluability
   - reproducibility
3. If any condition fails:
   - stops reasoning
   - asks minimal clarification
4. Once aligned:
   - executes precisely

---

## When to use

Use Socrates for:

- ambiguous requirements
- architecture decisions
- API design
- schema changes
- high-risk changes

Do NOT use for:

- trivial edits
- formatting
- clearly specified tasks

### Typical failure modes Socrates prevents

- implementing against words like "clean", "good", or "scalable" without agreed criteria
- discovering in review that the stakeholder meant something materially different
- locking in assumptions too early and starting a high-impact change in the wrong direction

---

## Installation

### Codex

Run from this repository root and copy-paste one of these:

```bash
mkdir -p ~/.codex/skills/socrates
cp .agents/skills/socrates/SKILL.md ~/.codex/skills/socrates/SKILL.md
mkdir -p ~/.codex/skills/socrates/agents
cp .agents/skills/socrates/agents/openai.yaml ~/.codex/skills/socrates/agents/openai.yaml
```

Install into another repository:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.agents/skills/socrates"
cp .agents/skills/socrates/SKILL.md "$TARGET_REPO/.agents/skills/socrates/SKILL.md"
mkdir -p "$TARGET_REPO/.agents/skills/socrates/agents"
cp .agents/skills/socrates/agents/openai.yaml "$TARGET_REPO/.agents/skills/socrates/agents/openai.yaml"
```

---

### Claude Code

Run from this repository root and copy-paste one of these:

```bash
mkdir -p ~/.claude/skills/socrates
cp .claude/skills/socrates/SKILL.md ~/.claude/skills/socrates/SKILL.md
```

Install into another repository:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.claude/skills/socrates"
cp .claude/skills/socrates/SKILL.md "$TARGET_REPO/.claude/skills/socrates/SKILL.md"
```

---

## Usage

### Codex

Copy-paste prompts:

```text
$socrates Clarify this task before coding. Ask only the minimum questions that change implementation.
$socrates Convert my request into a short alignment contract, then implement against it.
```

---

### Claude Code

Copy-paste prompts:

```text
/socrates Clarify this task before coding. Ask only the minimum questions that change implementation.
/socrates Convert my request into a short alignment contract, then implement against it.
```

Claude Code system prompt snippet:

```text
Use Socrates behavior for important coding work:
- restate the request in implementation terms
- ask at most 1-3 load-bearing clarification questions when ambiguity would materially change implementation
- write a compact alignment contract
- only then implement
```

---

## How Socrates Responds

Socrates does not argue about vague quality words.
It turns them into explicit decision criteria, then proceeds.

### Example 1: Defining "elegant"

User:

```text
Write this function elegantly
```

Socrates:

```text
What does "elegant" mean in this context?
- concise
- readable
- idiomatic
- performance-oriented
- other (define)
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
What does "good" mean here?
- minimal surface area
- scalability
- developer experience
- performance
- other (define)
```

---

## Design Principles

- No reasoning without decidability
- No fake precision
- No unnecessary justification
- Minimal questions, maximum clarity
- Execution after alignment

---

## Philosophy

Socrates is not meant to make you think more.

It is meant to separate where reasoning is useful from where alignment is required first.

The practical benefit is:

- less implementation built on undefined terms
- earlier detection when the user and the agent are using the same words with different meanings
- earlier agreement on decision criteria instead of retroactive justification
- lower failure cost on high-impact changes because assumptions are forced into the open first

---

## One-line Definition

> Think freely.  
> Decide only where truth is testable.
