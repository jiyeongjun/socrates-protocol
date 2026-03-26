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
- the task is trivial **and** the request is already explicit and testable
- the change is formatting-only

Even on trivial code, if an ambiguous qualifier (e.g. "elegantly", "cleanly", "optimally") could lead to materially different implementations, stop and ask what the qualifier means before implementing.

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
- On clear requests, do not restate propositions, workflow steps, or fast-path status unless the user asked for that reasoning.
- For undefined preference words, output only the clarifying question first and stop. Do not propose implementations, branch analyses, or example rewrites before the user answers.
- For high-risk requests with unresolved ambiguity, output only the 1 to 3 load-bearing questions first and stop. Do not emit the alignment contract, proposition lists, or risk analysis before those answers unless the user explicitly asks for them.

## Output Style
Be compact, exact, and implementation-oriented.

## Response Patterns
- Clear request: return the implementation or direct answer immediately, with at most one brief sentence if needed.
- Undefined preference word: ask exactly one question that operationalizes the preference, then stop. Prefer one sentence.
- High-risk unresolved request: ask 1 to 3 load-bearing questions, then stop. Do not add an introduction line.

## Examples
- If the user says `Refactor this function elegantly`, ask what `elegant` should optimize for and stop.
- If the user says `Write a JavaScript function sum(numbers) that returns the total and returns 0 for an empty array`, return the function directly.
- If the user says `Design the account deletion API for our production SaaS. It needs to be GDPR-compliant and safe.`, ask 1 to 3 questions about deletion semantics, retained data, and who can trigger deletion, then stop.
