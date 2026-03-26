---
name: socrates
description: Use for high-impact coding and design work when ambiguity could change what is true about the implementation. Convert requests into explicit, testable contracts before coding.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Socrates Protocol

## Core Rule
Only apply reasoning where truth can be decided.
If a proposition is not decidable yet, stop and clarify.
If the request is already explicit and testable, execute directly.

## Use This Skill When
- requirements are ambiguous
- architecture is still open
- APIs or schemas may change
- rollout risk is high
- acceptance criteria are not yet testable

## High-Risk Signals
Treat these as signals to validate constraints more explicitly before implementing:
- production systems
- real user data
- personal data / PII
- billing, payments, or financial reporting
- auth, permissions, or security boundaries
- public APIs or backward compatibility
- migrations, data deletion, or retention rules
- legal or regulatory obligations

These signals do not automatically require a long contract.
They do require checking whether risk-critical constraints are still undecidable.

## Do Not Use This Skill When
- the task is trivial
- the change is formatting-only
- the request is already explicit and testable

## Fast Path
If the request is already specific enough to implement and verify:
- do not ask clarification questions
- do not emit a long contract
- do not turn the task into a planning exercise
- execute directly against the stated constraints

Use the protocol only when ambiguity would materially change the implementation.

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

If high-risk signals are present, also validate whether these constraints are decided enough to implement:
- data sensitivity and handling requirements
- legal or regulatory obligations
- auditability and observability expectations
- rollback and migration constraints
- idempotency and side-effect boundaries for state-changing behavior

### 3. Stop on undecidable points
If any high-impact point fails validation:
- do not continue reasoning
- ask 1 to 3 minimal clarification questions
- ask only questions that change implementation

If no high-impact point fails validation:
- do not ask questions
- do not emit the alignment contract by default
- proceed directly to implementation

### 4. Produce an alignment contract
Use these headings:
- Goal
- In scope
- Out of scope
- Constraints
- Deliverable
- Acceptance criteria
- Open risks and assumptions

Only produce this contract when material ambiguity remains after validation.

### 5. Execute precisely
Implement only after the contract is sufficient.
Do not silently choose high-impact assumptions.

## Behavioral Rules
- Prefer one sharp fork over broad discussion.
- Treat preference as preference, not truth.
- Do not justify claims that cannot be evaluated.
- If multiple branches are valid, name them explicitly.
- Keep the contract short and operational.
- On clear requests, optimize for correct execution, not ceremony.
- The protocol must reduce implementation risk, not add avoidable latency.
- For state-changing APIs and workflows, explicitly check retry safety, duplicate execution, and side-effect boundaries when those concerns are not already decided.

## Output Style
Be compact, exact, and implementation-oriented.
