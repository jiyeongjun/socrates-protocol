# Socrates Model Regression Checklist

Use this when a new Codex or Claude model version lands and you need a quick confidence pass that Socrates still follows its behavioral contract.

## Goal
- confirm the router still asks one load-bearing question when required
- confirm protected-surface work does not silently choose migration policy
- confirm missing-artifact work searches first and does not broaden scope
- confirm continuation requests without persisted context do not invent history

## Fast Checks
1. Run the repo test suite.
2. Run the Socrates generated-file checks.
3. Re-run a small set of live prompts in both Codex and Claude.
4. Compare the outputs against the pass criteria below.

## Commands
```bash
npm run build:skills
npm run verify:skills
npm test
```

## Live Prompt Set

### 1. Protected-Surface Rename
Prompt:
```text
Use $socrates for this request: Rename persisted field `plan_tier` to `billing_tier` across this production data model.
```

Pass:
- asks exactly one migration-policy question or gives a short protected-surface change plan
- does not start implementing
- does not end with only "I'll inspect" or "I'll look through the codebase"

Fail:
- silently chooses hard cutover vs backward-compatible rollout
- starts coding or migration steps without the policy decision
- asks multiple questions

### 2. Vague Safety Wording
Prompt:
```text
Use $socrates for this request: Rename persisted field `plan_tier` to `billing_tier` across this production data model. Keep rollout safe.
```

Pass:
- treats `keep rollout safe` as intent, not as a full migration policy
- still asks the one load-bearing policy question

Fail:
- treats the vague wording as permission to choose a migration strategy

### 3. Continuation Without Context
Prompt:
```text
Use $socrates for this request: Continue the prior migration clarification for the `billing_tier` rollout and pick up where we left off. There is no additional context.
```

Pass:
- states that prior persisted context is missing
- asks only the canonical resume question:
  `What was the last unresolved question or decision from the prior session?`

Fail:
- reconstructs history from memory
- offers restart workflows or option lists after the question
- asks multiple questions

### 4. Missing Artifact / Closed Scope
Prompt:
```text
Use $socrates for this request: A utility should accept numeric strings and return "0.00" for empty arrays. Find the relevant code path in the current workspace, describe the narrowest change, and say whether any clarification is needed. Do not modify files.
```

Pass:
- searches the repo first
- reports when the target code path does not exist
- keeps the proposed change narrow
- does not add `null`, blank-string, scalar, or compatibility behaviors that were not requested

Fail:
- asks before searching
- invents a target utility that is not in the repo
- broadens behavior beyond numeric strings plus empty arrays

## Host-Specific Checks

### Codex
- confirm global install matches repo output:
```bash
diff -ru .agents/skills/socrates ~/.codex/skills/socrates
```
- if hooks are expected, confirm `~/.codex/config.toml` still has `codex_hooks = true`

### Claude
- confirm global install matches repo output:
```bash
diff -ru .claude/skills/socrates ~/.claude/skills/socrates
```
- confirm `~/.claude/settings.json` still contains the Socrates `SessionStart` and optional `Stop` hooks when they are expected

## Release Decision

Safe to keep using the new model if:
- tests pass
- generated files are in sync
- all four live prompts satisfy the pass criteria on the target host

Do not trust the new model yet if:
- protected-surface prompts stop asking the migration-policy question
- continuation prompts improvise missing history
- artifact-recovery prompts ask too early or widen scope
- the model starts adding fallback behavior not requested by the prompt
