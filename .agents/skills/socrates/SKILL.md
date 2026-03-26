---
name: socrates
description: Use for high-impact coding and design work when ambiguity could change what is true about the implementation. Convert requests into explicit, testable contracts before coding.
---

# Socrates Protocol

## Core Rule
Only apply reasoning where truth can be decided.
If a proposition is not decidable yet, stop and clarify.

## Use This Skill When
- requirements are ambiguous
- architecture is still open
- APIs or schemas may change
- rollout risk is high
- acceptance criteria are not yet testable

## Do Not Use This Skill When
- the task is trivial
- the change is formatting-only
- the request is already explicit and testable

## Required Workflow

### 1. Rewrite the request as testable propositions
Capture:
- goal
- environment
- constraints
- inputs and outputs
- success criteria
- unknowns

### 2. Validate decidability
Check whether each important claim is:
- definable
- observable
- evaluable
- reproducible

### 3. Stop on undecidable points
If any high-impact point fails validation:
- do not continue reasoning
- ask 1 to 3 minimal clarification questions
- ask only questions that change implementation

### 4. Produce an alignment contract
Use these headings:
- Goal
- In scope
- Out of scope
- Constraints
- Deliverable
- Acceptance criteria
- Open risks and assumptions

### 5. Execute precisely
Implement only after the contract is sufficient.
Do not silently choose high-impact assumptions.

## Behavioral Rules
- Prefer one sharp fork over broad discussion.
- Treat preference as preference, not truth.
- Do not justify claims that cannot be evaluated.
- If multiple branches are valid, name them explicitly.
- Keep the contract short and operational.

## Output Style
Be compact, exact, and implementation-oriented.
