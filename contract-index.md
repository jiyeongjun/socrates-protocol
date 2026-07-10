# Contract Index

## Macro Goal
Update Socrates Contract for GPT-5.6, validate it, push it, and reinstall the local Codex skill

## Success Criteria
- [x] GPT-5.6 `sol`, `terra`, and `luna` are routed by Socrates role while older Codex models remain ordered fallbacks.
- [x] The skill preserves required contract content under GPT-5.6's concise-response bias and explicitly gates Programmatic Tool Calling and persisted reasoning.
- [x] Generated Codex and Claude skill artifacts are synchronized from the shared sources.
- [x] Repository tests, generated-file verification, Skill Creator validation, and independent forward-tests pass.
- [x] The completed change is committed and pushed to `origin/main`.
- [x] The updated Codex skill is reinstalled under the user's local Codex skill directory and matches the repository artifact.

## Scope
- `reference/model-policy.json` and generated platform copies.
- `reference/skill-body.md`, orchestration guidance, and generated platform copies.
- GPT-5.6 regression guidance and focused consistency tests.
- Existing skill generation, validation, and installer workflows.
- Commit, push to `origin/main`, and local Codex global-scope reinstall.

## Non-Goals
- Changing the Socrates triggering description or core contract-file schema.
- Removing GPT-5.5, GPT-5.4, or older Codex fallback models.
- Changing Claude model aliases or Claude subagent behavior.
- Adding GPT-5.6 API integration, a new runtime model router, or release tags/version bumps.
- Treating GPT-5.6 Pro as a separate model slug or defaulting every role to maximum reasoning.

## Protected Surfaces
- Published skill behavior and role-based model-selection guidance.
- External Git push to `origin/main`.
- Installer-managed local files under `~/.codex/skills/socrates-contract`.

## Decisions
- Use explicit GPT-5.6 family slugs: `sol` for quality-first contract roles, `terra` for balanced planning, and `luna` for fast exploration/verification.
- Preserve existing models as fallbacks and preserve Claude behavior.
- Keep model names out of the main skill body; place routing in `model-policy.json`.
- Replace generic brevity wording with required-content prioritization.
- Treat Programmatic Tool Calling as bounded execution and persisted reasoning as non-durable state.
- Validate with repository checks plus independent Skill Creator forward-tests before pushing.
- User explicitly authorized push and local skill reinstallation.
- Roll back by reverting the pushed commit and reinstalling the reverted repository artifact if post-push or install verification fails.

## Open Questions
- None.

## Subcontracts
| ID  | Path                       | Task              | Status   | Next Step    | Verification          |
|-----|----------------------------|-------------------|----------|--------------|-----------------------|
| 001 | contracts/contract-001.md  | Update GPT-5.6 skill sources and generated artifacts | done | Complete | Focused tests, generation checks, full test suite, Skill Creator validation |
| 002 | contracts/contract-002.md  | Independently forward-test the updated skill | done | Complete | Fresh-agent outputs for protected PTC, persisted resume, and contract completeness |
| 003 | contracts/contract-003.md  | Commit, push, and reinstall the local Codex skill | done | Complete | Remote branch state and byte-for-byte local skill comparison |

## Current Status
Macro contract closed. All three subcontracts are done and every success criterion passed.
Last updated: 2026-07-10T04:14:00Z
