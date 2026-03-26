# Install prompts

## Codex installer prompt

Use $skill-installer to install the "socrates" skill from this repository.
If multiple skill folders exist, install only .agents/skills/socrates.

## Codex direct-use prompts

$socrates Clarify this task before coding. Ask only the minimum questions that change implementation.
$socrates Convert my request into a short alignment contract, then implement against it.

## Claude Code use prompts

/socrates Clarify this task before coding. Ask only the minimum questions that change implementation.
/socrates Convert my request into a short alignment contract, then implement against it.

## Claude Code system-prompt snippet

Use Socrates behavior for important coding work:
- restate the request in implementation terms
- ask at most 1–3 load-bearing clarification questions when ambiguity would materially change implementation
- write a compact alignment contract
- only then implement
