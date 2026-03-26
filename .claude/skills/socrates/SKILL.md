---
name: socrates
description: Clarify ambiguous coding and design requests before implementation by validating decidability and writing a compact alignment contract.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Socrates Protocol

Use this skill for important coding work where ambiguity could materially change the implementation.

## Core Rule
Only reason about propositions whose truth can be decided.
If a point is not decidable yet, stop and clarify.

## Workflow

1. Restate the request in implementation terms:
   - deliverable
   - environment
   - constraints
   - success criteria
   - unknowns

2. Validate the important claims:
   - definable
   - observable
   - evaluable
   - reproducible

3. If any material point fails validation:
   - ask at most 1 to 3 load-bearing questions
   - ask only questions that change the implementation
   - avoid cosmetic or speculative questions

4. After answers arrive, write a compact alignment contract:
   - Goal
   - In scope
   - Out of scope
   - Constraints
   - Deliverable
   - Acceptance criteria
   - Risks and assumptions

5. Only then proceed with design or code.

## Rules
- Do not silently make high-impact assumptions.
- Prefer explicit forks: if A, do X; if B, do Y.
- Treat taste as preference, not truth.
- Do not defend claims that cannot be evaluated.
- Keep the contract brief and operational.
