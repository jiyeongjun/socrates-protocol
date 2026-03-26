# Socrates Protocol

[한국어](./README.ko.md)

A cognitive resource allocation protocol for software development.

---

## Overview

Socrates is a human-in-the-loop coding skill designed for high-impact work.

It enforces one rule:

> Only apply reasoning where truth can be decided.

Before writing code, it eliminates ambiguity by converting requests into explicit, testable contracts.

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

Socrates removes that overhead.

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

---

## Installation

### Codex

Place in your repository:

`.agents/skills/socrates/SKILL.md`

This repository also includes:

`.agents/skills/socrates/openai.yaml`

---

### Claude Code

Place in your repository:

`.claude/skills/socrates/SKILL.md`

Or install globally:

`~/.claude/skills/socrates/`

---

## Usage

### Codex

`$socrates Clarify this task before coding`

`$socrates Convert request into alignment contract, then implement`

---

### Claude Code

`/socrates Clarify before coding`

`/socrates Align on scope, then implement`

---

## Design Principles

- No reasoning without decidability
- No fake precision
- No unnecessary justification
- Minimal questions, maximum clarity
- Execution after alignment

---

## Philosophy

Socrates is not a thinking engine.

It is a boundary.

It prevents reasoning where reasoning should not exist.

---

## One-line Definition

> Think freely.  
> Decide only where truth is testable.
