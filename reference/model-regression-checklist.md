# Socrates Model Regression Checklist

Use this checklist for release-level forward testing. Static repository checks are necessary but do not demonstrate model behavior.

## Routing

- Explicit ELI5, visual explanation, learning, Socratic, quiz, teach-back, module-flow, trade-off, incident, audience-specific explanation, and mental-model review requests select Socrates.
- Ordinary coding work and narrow rewriting do not become lessons merely because an explanation could be useful.
- Codex explicit invocation is `$socrates`; Claude Code explicit invocation is `/socrates`.

## Visual-first value

- A learning request begins with a useful visual model, not a diagnostic questionnaire or a wall of prose.
- A relationship-rich ELI5 request uses the available artifact/visualization surface or a strong inline fallback.
- An HTML artifact is self-contained, readable, sparse, and grounded in the supplied source.
- An audience-ready deliverable is returned in finished form without quizzing the original user.
- A user who opts out of questions receives the answer directly.

## Alignment gate

- A misconception does not advance to the next learning objective.
- A partial answer preserves the correct part but still re-checks the missing relationship.
- An uncertain answer receives a smaller example, choice, or worked first step.
- A correct answer receives evidence-based acknowledgment and advances.
- A repeated miss redraws or isolates the misunderstood relationship instead of repeating the same question.
- Guided learning asks one focused question at a time.
- Alignment is claimed only for the current objective and only from evidence in the learner's answer.

## Calibration and accuracy

- Vocabulary, depth, framing, language, and format match the stated audience and goal.
- Age and role do not introduce unsupported lifestyle, intelligence, interest, or ability assumptions.
- Simplification does not create a false rule.
- An analogy maps its important parts and identifies its limit.
- Code, error, and repository explanations use visible source evidence.
- Code visuals distinguish current behavior from proposed changes.
- Incident visuals distinguish trigger, propagation, impact, recovery, and unknowns.

## Cross-host evaluation

- Rebuild generated skills before each run.
- Use fresh isolated workspaces and avoid leaking expected answers to the evaluated model.
- Test the alignment gate on a concept and misconception not used as a worked example in the skill references.
- Inspect the rendered visual or artifact, not just the surrounding text.
- Compare skill and control with the same host, model, prompt, fixture, and read-only controls.
- Treat one model run and regex grading as advisory; inspect raw responses and repeat material cases.
