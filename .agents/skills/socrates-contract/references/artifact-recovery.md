# Artifact Recovery

Use this only when a required file, symbol, target, contract, test, repro path, or external artifact is missing or ambiguous.

## Rules
- Search the workspace and visible project artifacts before asking the user.
- Prefer host-native file search and read tools over clarification when the artifact is discoverable. In Codex, prefer `rg` and `rg --files`; in Claude Code, use `Read`, `Grep`, and `Glob`.
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
- existing contract files or prior decisions

## Output
Return only:
- recovered artifact(s)
- brief evidence
- the next action
