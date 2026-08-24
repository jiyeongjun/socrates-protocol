# Socrates Model Regression Checklist

Use this checklist for release-level forward testing. Static repository checks are necessary but do not demonstrate model behavior.

## Routing

- Explicit ELI5, learning, Socratic, quiz, teach-back, audience-specific explanation, and understanding-review requests select Socrates.
- Ordinary coding work and narrow rewriting do not become lessons merely because an explanation could be useful.
- Codex explicit invocation is `$socrates`; Claude Code explicit invocation is `/socrates`.

## Direct value

- A direct explanation begins with useful content, not a diagnostic questionnaire.
- An audience-ready deliverable is returned in finished form without an unsolicited quiz.
- A user who opts out of questions receives the answer directly.

## Mastery gate

- A misconception does not advance to the next learning objective.
- A partial answer preserves the correct part but still re-checks the missing relationship.
- An uncertain answer receives a smaller example, choice, or worked first step.
- A correct answer receives evidence-based acknowledgment and advances.
- A repeated miss changes representation or difficulty instead of repeating the same question.
- Guided learning asks one focused question at a time.

## Calibration and accuracy

- Vocabulary, depth, framing, language, and format match the stated audience and goal.
- Age and role do not introduce unsupported lifestyle, intelligence, interest, or ability assumptions.
- Simplification does not create a false rule.
- An analogy maps its important parts and identifies its limit.
- Code, error, and repository explanations use visible source evidence.

## Cross-host evaluation

- Rebuild generated skills before each run.
- Use fresh isolated workspaces and avoid leaking expected answers to the evaluated model.
- Test the mastery gate on a concept and misconception not used as a worked example in the skill references.
- Compare skill and control with the same host, model, prompt, fixture, and read-only controls.
- Treat one model run and regex grading as advisory; inspect raw responses and repeat material cases.
