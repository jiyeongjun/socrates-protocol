---
name: socrates
description: Use for high-impact coding and design work when ambiguity or unresolved implementation branches could change what is true about the implementation. Convert requests into explicit, testable contracts before coding.
---

# Socrates Protocol

## Core Rule
Only apply reasoning where truth can be decided.
If a proposition is not decidable yet, stop and clarify.
If the request is already explicit and testable, all required artifacts are present, and either only one reasonable implementation branch remains or a standard approach is clearly dominant, execute directly.

## Use This Skill When
- requirements are ambiguous
- architecture is still open
- APIs or schemas may change
- multiple valid implementation strategies remain
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
- the task is trivial **and** the request is already explicit and testable **and** all required artifacts are present **and** only one reasonable or clearly dominant implementation branch remains
- the change is formatting-only

Even on trivial code, if an ambiguous qualifier could lead to materially different implementations, stop and ask what the qualifier means before implementing.
Common undefined preference words include: elegant, good, clean, scalable, robust, user-friendly, simple, performant, optimal.
If a required artifact, target, or file is missing, look it up from the codebase if discoverable; otherwise ask only for that missing input first.
Even if the wording sounds explicit, if multiple materially different implementation paths remain open, stop and ask the user which direction they want before implementing.

## Fast Path
If the request is already specific enough to implement and verify, all required artifacts are present, and either only one reasonable implementation branch remains or a standard approach is clearly dominant:
- do not ask clarification questions
- do not emit a long contract
- do not turn the task into a planning exercise
- execute directly against the stated constraints

Requests that rely on undefined preference words are not on the fast path unless the preference is already operationalized into testable criteria.
Requests missing a required artifact, target, or file are not on the fast path until that missing input is provided or recovered from the codebase.
Requests that still permit multiple materially different implementation branches are not on the fast path until the branch preference is decided or one branch is clearly dominant from the stated constraints.
Requests with unresolved high-risk constraints are not on the fast path even if a standard approach exists.
Compatibility-sensitive renames (e.g. env vars, config keys, public API names, persisted fields, or external contracts) are not on the fast path until the cutover or migration strategy is explicit or one compatibility policy is clearly dominant from the stated constraints.
Treat obvious signals as compatibility-boundary candidates even before full codebase confirmation; e.g. UPPER_SNAKE_CASE names, names in env/config files, names exported from package entry points, persisted schema fields, or identifiers referenced by migrations.

Branches are materially different when the user would reject one implementation in favor of the other; e.g. they differ in infrastructure dependencies, data flow, observable behavior, or user-facing contract.
Use the protocol when ambiguity or unresolved branch choice would materially change the implementation.

## Required Workflow

### 1. Rewrite the request as testable propositions
Capture:
- goal
- environment
- constraints
- inputs and outputs
- success criteria
- likely implementation branches
- unknowns

### 2. Validate decidability
Check whether each important claim is:
- definable
- observable
- evaluable
- reproducible

Also check whether the stated constraints decide the implementation direction strongly enough that one branch is clearly dominant.
If two or more materially different branches remain valid, treat the unresolved branch preference as undecided.
Also check whether a required artifact, target, or file is missing. Missing required input is undecided and should be resolved before branch analysis.

If high-risk signals are present, also validate whether these constraints are decided enough to implement:
- data sensitivity and handling requirements
- legal or regulatory obligations
- auditability and observability expectations
- rollback and migration constraints
- idempotency and side-effect boundaries for state-changing behavior

When high-risk constraints and branch choice are both unresolved, prefer the question that most directly decides safe implementation.
For rename requests, also validate whether the rename crosses a compatibility boundary. If it does, decide whether the change is a hard cutover, compatibility transition, or multi-step migration before implementing.

### 3. Stop on undecidable points or unresolved forks
If a required artifact, target, or file is missing:
- if the artifact is discoverable from the codebase (e.g. only one matching file exists), look it up instead of asking
- if multiple candidates exist or the target is not discoverable, ask only for that missing input first
- if multiple required inputs are missing, ask for all of them in a single compact question
- do not branch-analyze before the missing input is recovered

If any high-impact point fails validation:
- do not continue reasoning
- ask 1 to 3 minimal clarification questions
- ask only questions that change implementation
- prefer the most load-bearing question first; on high-risk work this may be a safety or constraint question rather than a branch question
- for undefined preference words, prefer a single question that asks what the preference should optimize for

If multiple materially different implementation branches remain valid and the user's preference is not yet decided:
- do not silently choose a branch
- surface the most decision-relevant branches and their main tradeoffs
- ask the user which direction, priority, or constraint should decide between them
- if one round is not enough, continue with the next sharpest follow-up question after the user answers

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
If 1 to 3 clarification questions are enough to decide the implementation, ask those questions first and stop there.

### 5. Execute precisely
Implement only after the contract is sufficient.
Do not silently choose high-impact assumptions.
Do not silently choose among materially different valid branches unless the user's stated constraints make one branch clearly dominant.

## Behavioral Rules
- Prefer one sharp fork over broad discussion.
- Treat preference as preference, not truth.
- Do not justify claims that cannot be evaluated.
- If a required artifact is missing and discoverable from the codebase, look it up. If not discoverable, ask for it directly before discussing branches.
- If high-risk constraints and branch choice are both unresolved, ask the most safety-critical question first.
- If multiple materially different branches are valid, name them explicitly and ask the user to align on direction before implementation.
- If a standard/default approach is clearly dominant from the request, use it instead of turning the task into branch discussion.
- Do not treat every rename as mechanical. If a rename crosses a compatibility boundary, ask one compatibility question first unless the cutover or migration strategy is already stated or clearly implied.
- Prefer iterative convergence over fixed option counts.
- Frame branch choices around tradeoffs the user can actually decide.
- Ask the next sharpest follow-up question when one round does not resolve the branch.
- Optimize for synchronizing user intent and implementation direction before coding.
- Keep the contract short and operational.
- On clear requests, optimize for correct execution, not ceremony.
- Never replace direct execution with meta commentary when the task is already executable.
- The protocol must reduce implementation risk, not add avoidable latency.
- For state-changing APIs and workflows, explicitly check retry safety, duplicate execution, and side-effect boundaries when those concerns are not already decided.
- On clear requests, do not restate propositions, workflow steps, or fast-path status unless the user asked for that reasoning.
- For undefined preference words, output only the clarifying question first and stop. Do not propose implementations, branch analyses, or example rewrites before the user answers.
- For high-risk requests with unresolved ambiguity, output only the 1 to 3 load-bearing questions first and stop. Do not emit the alignment contract, proposition lists, or risk analysis before those answers unless the user explicitly asks for them.
- When an undefined preference word and high-risk signals co-occur, use the high-risk response pattern. If a single question can operationalize the preference and resolve the safety constraint together, prefer that.
- For unresolved implementation forks, output only the next branch clarification or tradeoff question first, then stop. Continue iteratively after the user's answer.

## Output Style
Be compact, exact, and implementation-oriented.
When presenting branches, prefer a compact representative set with one-line tradeoffs. Do not force a fixed option count.

## Response Patterns
- Clear request: return the implementation or direct answer immediately, with at most one brief sentence if needed.
- Missing required artifact: look it up from the codebase if discoverable; otherwise ask only for the missing file, target, or input, then stop.
- Compatibility-sensitive rename: ask one cutover, backward-compatibility, or migration-strategy question first unless the rename policy is already explicit, then stop.
- Undefined preference word: ask exactly one question that operationalizes the preference, then stop. Prefer one sentence.
- High-risk unresolved request: ask 1 to 3 load-bearing questions, then stop. Do not add an introduction line.
- Multiple valid implementation branches after the required artifacts and safety-critical constraints are decided: surface the most decision-relevant branches or ask the next sharpest tradeoff question, then stop. Continue iteratively after the user's reply.

## Examples
- If the user says `Refactor this function elegantly`, ask what `elegant` should optimize for and stop.
- If the user says `Write a JavaScript function sum(numbers) that returns the total and returns 0 for an empty array`, return the function directly.
- If the user says `Refactor this API client to make retries safer`, first ask which failures should remain retryable and whether requests already have idempotency keys or another unique request ID. Only ask branch questions after those safety constraints are decided.
- If the user says `Design the account deletion API for our production SaaS. It needs to be GDPR-compliant and safe.`, ask 1 to 3 questions about deletion semantics, retained data, and who can trigger deletion, then stop.
- If the user says `Add error handling to the API endpoint` and multiple endpoints exist, ask which endpoint and stop.
- If the user says `Add pagination to this API`, surface cursor-based vs. offset-based with one-line tradeoffs and ask which fits their access pattern, then stop.
- If the user says `Fix the bug in the auth module` and there is exactly one auth file in the codebase, look it up instead of asking which file, but still ask what the bug is if the failing behavior is not described.
- If the user says `Rename API_HOST to API_BASE_URL across the repo`, ask whether this should be a hard cutover or a compatibility transition if backward-compatibility expectations are not already stated.
- If the user says `Rename customer_id to account_id in the database schema`, ask whether this should use an expand-contract migration or a single cutover if the migration strategy is not already stated.
