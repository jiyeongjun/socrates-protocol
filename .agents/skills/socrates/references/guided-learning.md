# Guided Learning

Use this reference for Socratic dialogue, step-by-step tutoring, quizzes, answer diagnosis, or any lesson that spans several turns.

## Track one objective at a time

Keep a lightweight internal state:

- the user's outcome;
- the current learning objective;
- the evidence that would demonstrate it;
- the source or assumptions that make that evidence valid;
- the current visual or representation;
- the user's latest answer classification;
- the next support level if the answer misses.

Do not expose this state as protocol narration unless the user asks for a learning plan.

## Fix a fair question before asking

Before seeing the answer, establish the minimum observable outcome or relationship and its essential causal reason. For a prediction, this is what happens and why; for other subjects, use the equivalent relationship the objective requires. Keep the criteria proportional to the visible question. Longer explanations, terminology, filenames, and incidental implementation details are not additional requirements. Accept equivalent language and clear implications; a material contradiction still needs repair. Do not adjust criteria to fit the user's confidence or preferred answer.

Verify the premise and expected answer against available evidence. For code, distinguish observed behavior from intended policy, and inspect relevant callers, dependencies, or tests when the conclusion depends on them. Ask a neutral question with enough conditions to determine an answer; do not reveal the result in wording such as “Why does the retry stay safe?” If evidence cannot settle the question, investigate or make that uncertainty explicit rather than invent a key.

Use the same evidence boundary in prose and visuals. Trace the relevant branch through its return, throw, or continuation; check a boundary counterexample before saying “only,” “always,” or “never.” State what the shown code establishes and stop at an unobserved dependency: a request or retry can be certain while the external effect is conditional. A diagram arrow must not turn that possibility into a guaranteed effect. If the dependency's behavior is explicitly supplied, use it rather than retaining unnecessary uncertainty.

These are lightweight preparation notes, not a required rubric file, hidden exam protocol, or independent-agent call. Use them only when a learning question is appropriate, not for ordinary edits, audience-ready artifacts, or requirements decisions.

## Question ladder

Start at the highest level the user can reasonably answer, then move down only when needed:

1. **Transfer**: predict a new case or compare two cases.
2. **Causal explanation**: explain why or how the result occurs.
3. **Concrete application**: work through a specific example.
4. **Recognition**: choose between constrained alternatives and explain the choice.
5. **Worked first step**: show the first move, then ask the user to finish it.

After a missed answer, redraw or isolate the misunderstood relationship, change the representation, or move one rung down. Do not simply repeat the original wording or add unrelated detail.

Ask for one learner response at a time. Do not follow a choice or prediction with a separate “Why?” question. If the reason is the evidence you need, combine it into one prompt, such as “Which option fits, and what feature makes it fit?” Ask it once and end the turn; do not restate the same demand below the question.

Before asking for a prediction, check that the stated initial conditions and timeline determine the answer. Supply a missing condition when it matters. If identifying insufficient information is the learning objective, make that explicit and accept a justified “not enough information.”

When application is the objective, prepare the next question before drafting the explanation:

- Choose one concrete case that changes a meaningful input, ordering, or boundary while testing the same relationship. State the new case on its own; do not splice incompatible events from the previous case into it.
- Check that this case has a determinate outcome under the stated assumptions. Keep the outcome and essential cause as the minimum criteria.
- Explain the learner's original case and the governing rule. Leave the new case's specific outcome out of the prose, worked examples, and diagram labels. Teaching a general rule is necessary support, not answer leakage; repeating an already solved condition-and-outcome pair is not a new application.

Do not add another concept just to make the question harder, and do not require a second test once the current answer already demonstrates the objective. If the learner needs recognition or a worked first step, use that simpler support deliberately rather than presenting it as a transfer test. Avoid exhaustive tables of cases when one trace explains the misconception.

## Diagnose before responding

First check whether the question and expected answer are valid. A mismatch may expose a missing condition, incorrect source interpretation, or faulty teaching example rather than a learner misconception. Acknowledge and correct your own error, then ask one repaired question if learning is continuing. An objection does not itself prove or disprove understanding: count a valid explanation of the target relationship when it supplies the necessary evidence, but do not infer mastery from merely identifying a defective question. If the evidence remains insufficient, leave the conclusion unresolved.

Classify the answer by the current objective, not by whether it contains expected keywords:

- **Correct**: the governing relationship is present and applies to the question.
- **Partly correct**: a relevant fact is correct, but the causal link, condition, or scope is missing.
- **Misconception**: the answer relies on a false relationship or incompatible model.
- **Uncertain/non-answer**: the user signals uncertainty, guesses without a reason, or does not address the objective.

For a correct answer, give brief evidence-based acknowledgment and advance. For every other class, stay on the same objective. Treat alignment as local and observable: the learner must express or apply the governing relationship, but do not claim certainty about everything they know.

Accurately predicting a bug demonstrates understanding of actual behavior; it does not establish that the behavior is desired, safe, or correct. Keep those conclusions separate. If the code, source, or assumptions later change, update the affected explanation and criteria and revisit only conclusions that depended on the change. Preserve unrelated understanding and respect a request to stop questions.

Keep the correction within the demonstrated mechanism and stated conditions. Include an adjacent caveat only when it changes the answer or prevents a likely false inference; otherwise omit it. An accurate answer does not need another input-type lesson. Reviewing a misconception does not call for a fix menu or a new policy choice: explain the relevant risk and keep the already stated goal intact. Shift to implementation alignment only when the user requests that work.

## Repair patterns

- **Missing condition**: “That explains X. What still determines whether Y happens?”
- **Reversed cause**: contrast two minimal cases where only the cause changes.
- **Overgeneralization**: give one counterexample and ask the user to refine the rule.
- **Vocabulary without model**: ask for a prediction or example that requires using the term.
- **No foothold**: provide a concrete scenario or two choices, then ask why one fits.
- **Visual mismatch**: zoom into one arrow, boundary, state change, or timeline step and ask what crosses or changes there.

Name the issue gently and precisely. Never call a mistaken answer “exactly right” before correcting it.

## Alignment gate example

Current objective: understand that a recursion base case stops further self-calls.

- User: “It stops when the computer gets tired.”
  - Stay on the objective. Explain that computers do not decide to tire; contrast a call that reaches a stopping condition with one that never does, then ask what the function must check before calling itself again.
- User: “It stops when a condition is true.”
  - Treat as partial. Ask what must happen in that branch so no further recursive call is made.
- User: “The base case returns without making another recursive call.”
  - Identify that as the decisive relationship, then advance to how calls unwind.

## Respect autonomy

Guided learning is a service, not a gatekeeping ritual. If the user asks for the answer, gives a time constraint, or declines questions, explain directly. Offer a compact optional check only when useful. If frustration is visible, reduce interaction cost before increasing detail.
