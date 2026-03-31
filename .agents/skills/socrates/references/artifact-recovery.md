# Artifact Recovery

Use this only when a required file, symbol, test, target, or repro path is missing or ambiguous.

## Rules
- Search the codebase before asking the user.
- Prefer `Read`, `Grep`, and `Glob` over clarification when the artifact is discoverable.
- If exactly one candidate is clearly dominant, continue without asking.
- If multiple plausible candidates remain, ask one compact disambiguation question.
- Do not branch-analyze before recovering the required artifact.

## What to Recover
- target file or module
- symbol definitions and main call sites
- failing test or repro command
- public entrypoint or API surface
- config or env usage
- migration or persistence touchpoints

## Output
Return only:
- recovered artifact(s)
- brief evidence
- the next action
