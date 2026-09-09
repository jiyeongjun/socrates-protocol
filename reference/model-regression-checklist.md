# Socrates Model Regression Checklist

Use this checklist for release-level forward testing. Static repository checks are necessary but do not demonstrate model behavior.

## Routing

- Requirements clarification, design confirmation, and consequential feature ambiguity select implementation alignment. Existing-code explanations remain explanations.
- Already approved, fully specified ordinary edits proceed without a new confirmation ceremony.
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

- Test `gpt-6-astra` and `claude-fable-5-1` with exact requested model IDs and record the CLI versions and resolved identity when exposed. Report unavailable models and authentication failures; do not silently substitute a model.
- Run `eval:alignment` in writable temporary workspaces. Inspect actual tool calls before and after final confirmation, including attempted edits that failed or were later reverted.
- Check a consequential ambiguity, source discovery, contradictory requirements, a corrected decision reflected in the diagram, final approval followed by implementation, and already approved scope without a repeated gate.
- Check the batch acceptance examples independently of model-authored tests. An unchanged hash under a read-only host is not evidence of a successful implementation gate.
- Treat explicit local invocation results separately from automatic skill discovery; the writable suite does not measure trigger recall or a skill/control performance advantage.
- Rebuild generated skills before each run.
- Use fresh isolated workspaces and avoid leaking expected answers to the evaluated model.
- Test the alignment gate on a concept and misconception not used as a worked example in the skill references.
- Inspect the rendered visual or artifact, not just the surrounding text.
- Compare skill and control with the same host, model, prompt, fixture, and read-only controls.
- Treat one model run and regex grading as advisory; inspect raw responses and repeat material cases.
