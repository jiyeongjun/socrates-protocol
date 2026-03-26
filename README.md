# Socrates Protocol

[한국어](./README.ko.md)

A coding skill that steps in only when ambiguity would change the implementation.

---

## Overview

Socrates is a human-in-the-loop coding skill for work where ambiguity could materially change the implementation.

It enforces one rule:

> Only apply reasoning where truth can be decided.

When ambiguity is load-bearing, it turns the request into an explicit, testable working agreement before coding.
When the request is already clear, it should stay out of the way and execute directly.

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
4. If material ambiguity remains:
   - writes a short working agreement
5. If the request is already clear or the agreement is sufficient:
   - executes precisely

---

## When to use

Use Socrates for:

- ambiguous requirements
- architecture decisions
- API design
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
$socrates If this request is ambiguous in a way that would change the implementation, ask only the minimum clarifying questions. If it is already explicit and testable, execute directly.
$socrates Use Socrates only for load-bearing ambiguity. Otherwise write the code.
```

Shorthand invocation is tuned for these response patterns:

- clear request: execute directly
- undefined preference word like `elegant`, `good`, or `clean`: ask one clarifying question first
- high-risk unresolved request: ask 1 to 3 load-bearing questions first

If you want the most explicit behavior, the longer prompt above is still the safest fallback.

---

### Claude Code

Copy-paste prompts:

```text
/socrates If this request is ambiguous in a way that would change the implementation, ask only the minimum clarifying questions. If it is already explicit and testable, execute directly.
/socrates Use Socrates only for load-bearing ambiguity. Otherwise write the code.
```

Shorthand invocation is tuned for the same response patterns:

- clear request: execute directly
- undefined preference word like `elegant`, `good`, or `clean`: ask one clarifying question first
- high-risk unresolved request: ask 1 to 3 load-bearing questions first

Claude Code system prompt snippet:

```text
Use Socrates behavior only when ambiguity would materially change the implementation:
- if the request is already explicit and testable, execute directly
- ask at most 1-3 load-bearing clarification questions when ambiguity would change the implementation
- write a compact working agreement only when material ambiguity remains
- do not add process to clear requests
```

---

## How Socrates Responds

Socrates does not argue abstractly about vague words.
It surfaces only the ambiguity that would change implementation, and it stays out of the way when the request is already clear.
Undefined preference words like `elegant`, `good`, and `clean` are treated as unresolved if they would materially change the implementation.
For high-risk requests, Socrates should ask the load-bearing questions first instead of front-loading a contract or analysis.
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
