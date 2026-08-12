---
protocol: socrates-contract
schema_version: "1.0"
contract_id: frontier-noninterference
status: executing
created_at: "2026-08-12T05:10:01.649Z"
updated_at: "2026-08-12T05:45:20Z"
task_identity: "Make Socrates non-interfering for frontier autonomous models, validate it, push origin/main, and refresh local installs"
active_subcontract: "003"
---

# Macro Goal

Make Socrates non-interfering for frontier autonomous models, validate it, push origin/main, and refresh local installs

# Current State

- The repository is clean at `617750d`, which is also `origin/main` and tag `v0.10.0`.
- Canonical skill sources live under `reference/`; generated Codex and Claude artifacts must be rebuilt rather than edited directly.
- Official OpenAI guidance for GPT-5.6 favors lean prompts, host-selected reasoning effort, and representative evaluation. No official OpenAI model named Fable was found, so the design is model-neutral.
- The current skill can over-trigger on generic data/compatibility/multiple-verification work and pins every Codex role to high reasoning.

# Success Criteria

- [ ] Implicit invocation is limited to genuinely protected mutation, explicit Socrates resume, and durable handoff; ordinary local work remains inline.
- [ ] Workspace and tool output remain usable factual evidence but cannot grant instruction authority or approval.
- [ ] Native role agents preserve read-only boundaries without forcing a model or reasoning level and without repeating the host policy at length.
- [ ] Static tests cover prior false positives, and the live runner supports an isolated skill/control comparison with transparent telemetry.
- [ ] Generated artifacts, release assets, static evals, full tests, and independent forward-tests pass.
- [ ] A focused implementation commit and state-only closure commit are pushed to `origin/main`; global Codex and Claude installations plus the detected Codex legacy mirror match the implementation assets.

# Scope

- Canonical skill body, trigger metadata, conditional references, host role definitions, model advisory policy, and generated artifacts.
- Static and live evaluation harnesses, regression cases, tests, and directly affected English/Korean documentation.
- Git commit/push to the existing `origin/main` and reinstall through the repository installer.

# Non-Goals

- No contract schema, scaffolder lifecycle, installer transaction, release tag, or package-version change.
- No Fable-specific model slug or undocumented model behavior.
- No reduction of host approval requirements for destructive, external, costly, credentialed, public, or production actions.

# Protected Surfaces

- Public implicit-trigger behavior and the four native role names.
- Cross-host generated parity and local installer-managed global/legacy skill state.
- External Git push to `origin/main`; optional paid live API evaluation remains separately gated by the existing environment flag and credentials.

# Risks / Blast Radius

- Over-narrowing can suppress Socrates on a real protected mutation; over-prescription can continue to slow or distract strong autonomous models.
- Removing runtime pins may change which host-selected model performs a role, so tests must verify model-neutral output contracts rather than a specific model.
- A broken generator or installer could leave Codex/Claude artifacts inconsistent; generated-file and byte-level installation checks are mandatory.

# Authorization Boundaries

- Contract files record task state only; they do not grant authorization or host approval.
- The user explicitly authorized repository changes, tests, push to the current remote, and local reflection of the result.
- No release/tag publication was requested. Paid API calls remain opt-in through the live evaluator; independent platform subagent forward-tests may be used without changing external state.

# Decisions

- Prefer capability-neutral, high-freedom instructions; encode only Socrates-specific state, trust, approval, rollback, and closure behavior.
- Generic file count, tool use, subagents, multiple checks, `data`, or `compatibility` alone are not triggers.
- Inherit host model and reasoning settings in role agents; document explicit overrides as evaluation-backed exceptions.
- Add a true control arm that mounts no Socrates artifacts and uses the same host, model, effort, sandbox, fixture, and grader as the skill arm.

# Open Questions

- None for the authorized repository, push, and local-install path. A paid live run may execute only if the existing explicit live-eval flag and suitable credential are deliberately supplied.

# Rollback / Recovery

- Before push, reverse only this task's diff. After push, use a new revert commit rather than rewriting `main`.
- Restore local state by reinstalling trusted `v0.10.0` through the installer, not by manual copying.

# Verification Strategy

- Run build/verify/release/static/full test gates and `git diff --check` on Node 24, with CI covering Node 22 and 24.
- Use fresh Sol forward-tests without leaking the intended answer: safe local non-interference, protected boundary, and closure completeness.
- Verify remote SHA and compare installed Codex/Claude skill and agent assets against the committed generated artifacts.

# Subcontracts

| ID | Task | Status | Next step | Verification |
|---|---|---|---|---|
| [001](subcontracts/001.md) | Redesign the canonical skill and native role contract | done | Closed with independent verifier PASS | Focused consistency tests and generated diff |
| [002](subcontracts/002.md) | Add non-interference regressions and paired live telemetry | done | Closed with independent verifier PASS | Static/full tests and fresh Sol forward-tests |
| [003](subcontracts/003.md) | Publish and reinstall the verified result | executing | Refresh local installs, verify bytes, commit, and push | Remote SHA, manifests, and byte comparisons |

# Current Status

Active subcontract: 003 (executing)
Last updated: 2026-08-12T05:45:20Z
