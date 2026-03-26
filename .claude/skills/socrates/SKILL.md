---
name: socrates
description: Clarify ambiguous coding and design requests before implementation by validating decidability and writing a compact alignment contract.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Socrates Protocol

Use this skill for important coding work where ambiguity could materially change the implementation.

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

## Core Rule
Only reason about propositions whose truth can be decided.
If a point is not decidable yet, stop and clarify.
If the request is already explicit and testable, execute directly.

## Fast Path
If the request is already specific enough to implement and verify:
- do not ask clarification questions
- do not emit a long contract
- do not turn the task into a planning exercise
- execute directly against the stated constraints

Use the protocol only when ambiguity would materially change the implementation.

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

   If high-risk signals are present, also validate whether these constraints are decided enough to implement:
   - data sensitivity and handling requirements
   - legal or regulatory obligations
   - auditability and observability expectations
   - rollback and migration constraints
   - idempotency and side-effect boundaries for state-changing behavior

3. If any material point fails validation:
   - ask at most 1 to 3 load-bearing questions
   - ask only questions that change the implementation
   - avoid cosmetic or speculative questions

   If no material point fails validation:
   - do not ask questions
   - do not emit the alignment contract by default
   - proceed directly to implementation

4. After answers arrive, write a compact alignment contract:
   - Goal
   - In scope
   - Out of scope
   - Constraints
   - Deliverable
   - Acceptance criteria
   - Risks and assumptions

   Only produce this contract when material ambiguity remains after validation.

5. Only then proceed with design or code.

## Rules
- Do not silently make high-impact assumptions.
- Prefer explicit forks: if A, do X; if B, do Y.
- Treat taste as preference, not truth.
- Do not defend claims that cannot be evaluated.
- Keep the contract brief and operational.
- On clear requests, optimize for correct execution, not ceremony.
- The protocol must reduce implementation risk, not add avoidable latency.
- For state-changing APIs and workflows, explicitly check retry safety, duplicate execution, and side-effect boundaries when those concerns are not already decided.
