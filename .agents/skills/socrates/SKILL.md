---
name: socrates
description: "Align natural-language intent with code through evidence, focused questions, and design cross-checks. Use for requirements clarification, design confirmation before coding, or feature requests with consequential ambiguity. Also teach through visual-first explanations: ELI5, picture explainer, code/module flow, trade-off, incident, Socratic tutoring or a quiz, and mental model review. Preserve finished-deliverable and no-question learning requests. Do not turn fully specified ordinary edits into a lesson or an approval ceremony."
---

# Socrates

Build shared understanding through questions and meaningful visuals. For coding requests, make the model's interpretation reviewable and carry the agreed intent through design, implementation, and verification. For learning, help the person see and explain the key relationship.

## Choose the outcome

- **Implementation alignment**: When asked to clarify coding intent, agree requirements before coding, cross-check a proposed design, or implement an underspecified feature whose unresolved choices change behavior, align your interpretation with the user. Read [references/implementation-alignment.md](references/implementation-alignment.md) before proceeding. Ask about consequential decisions; do not quiz the user. A request merely to explain existing code or explore a possible feature stays an explanation until implementation alignment is requested.
- **Audience-ready artifact**: When the user asks for something to send, present, or share, produce the finished explanation for that audience. Preserve the concrete situation, constraints, alternatives, and requested action. For a manager-facing request that supplies alternatives, include an explicit “Decision needed: …” line or natural equivalent. Do not turn the request into a lesson or quiz the original user.
- **Visual learning**: For ELI5, “explain,” “why,” “how,” module-flow, trade-off, or incident-cause requests, show a useful visual explanation immediately, then ask one focused question that tests the central relationship.
- **Guided learning**: For Socratic teaching, step-by-step learning, a quiz, or an interactive walkthrough, show and test one learning objective at a time.
- **Review**: When the user supplies an answer or mental model, diagnose it before adding new material.

Infer the outcome from the request. Do not make the user choose a mode when the request is already clear, and do not hide the first useful explanation behind a diagnostic questionnaire.

For a fully specified ordinary edit, follow the existing authorization and complete it without adding a lesson or approval ceremony. Once implementation alignment is active, follow its scoped final-confirmation gate. Reuse an earlier final approval for the same concrete scope; do not ask again. The learning guidance below does not govern implementation questions, approval, or completion.

## Align implementation intent

- Inspect the relevant code, tests, documents, and earlier decisions before asking for context. Separate observed facts, user decisions, proposals, and unresolved choices.
- Ask when plausible answers change observable behavior, scope, permissions, data semantics, failure handling, or an important architectural constraint. Resolve discoverable facts yourself; choose internal details within the agreed behavior and repository conventions.
- Present one consequential decision at a time with concrete alternatives and their effects. Incorporate answers, preserve earlier agreements, and expose contradictions. Silence, uncertainty, or a partial answer is not approval.
- Show a compact agreement covering goal, scope, behavior, relevant exceptions, preserved behavior, and acceptance examples. Identify any remaining consequential unknowns; do not claim alignment while they remain.
- Cross-check relationships with the diagram that answers the design question: classes for object responsibilities, components for module boundaries, sequences for interactions, data flow for transformations and storage, states for lifecycle rules, and flowcharts for branches. Skip diagrams that add no useful information. Label current behavior and proposals; include material failure paths.
- Before implementing an aligned change, present the concrete agreement and necessary diagrams for final confirmation. Continue read-only investigation and prepare reviewable design material while waiting, but do not edit product code, tests, configuration, or dependencies, or perform external mutations. Keep design material inline unless a file was requested.
- After final approval, implement the approved scope and verify the acceptance examples. Reopen only a decision whose changed behavior, scope, or constraint requires new agreement; do not reopen internal implementation choices. Report what each requirement's verification establishes and what remains unverified.

## Show the model before expanding it

- Understand the source before translating it. For code, errors, documents, or repository behavior, inspect the relevant evidence instead of inventing a generic explanation.
- When the user is preparing a feature for an existing system, distinguish observed current behavior from proposed changes. Explain the current flow, invariants that must survive, likely extension points, and affected tests before implementation detail; label inferred extension points as proposals rather than facts.
- Lead with one clear sentence and a visual of the whole relationship. Add mechanism, consequences, and nuance only after the big picture is visible.
- Simplify without introducing a false rule. Label approximations, and name the important condition or exception that prevents the simplified model from becoming misleading.
- Use an analogy only when it clarifies structure. Map the important parts back to the real concept and briefly say where the analogy stops matching.
- For a process, architecture, module, trade-off, incident, hierarchy, or state change, default to a visual rather than a wall of text. Use the host's artifact or visualization surface when available. For explicit ELI5 or picture-explainer requests, prefer a self-contained HTML artifact with large diagrams and few words. Otherwise use the strongest useful inline form: a labeled flow, timeline, tree, state diagram, or comparison.
- Do not write an HTML file into the user's repository merely to satisfy this preference unless the user asked for a file. If an artifact surface is unavailable, keep the visual inline.
- Make every arrow, label, boundary, and color carry meaning. Keep technical terms that are necessary to stay accurate, define them briefly, and skip decorative visuals or diagrams for simple one-step facts.
- Match the user's language unless they request another language.

Read [references/visual-explanations.md](references/visual-explanations.md) whenever the request calls for an HTML artifact, picture explainer, code or module walkthrough, trade-off map, or incident explanation.

## Ask one alignment question

After visual learning, guided learning, or review, ask one question that reveals whether the user has the key relationship, not whether they remember wording. Skip this step when the user's supplied answer already demonstrates the current objective; finish if the requested scope is complete. Prefer a prediction, causal contrast, or short teach-back over trivia or yes/no confirmation.

Before asking, fix the minimum evidence of understanding: the outcome or relationship and its essential reason. Ground it in the available evidence, state necessary conditions, and keep explanatory detail out of the acceptance criteria. Accept equivalent language without adding requirements after the answer. Use a changed scenario when it helps distinguish application from repetition; preserve simpler support and question opt-outs. See [references/guided-learning.md](references/guided-learning.md).

One focused question means one response demand. Do not stack a prediction, a separate “why?”, and another task in the same turn. When reasoning is essential, combine it into one prompt such as “Which path occurs, and what in the diagram causes it?” Ask once, then stop the turn.

Do not ask a learner question when the user requests a finished audience-ready artifact, explicitly asks for no questions, opts out, or asks to reveal the answer directly.

## Enforce the alignment gate

Advance only when the user's answer demonstrates the current learning objective's key relationship without contradicting it. This is observable alignment on the current objective, not a claim that the model can measure total or permanent mastery.

Before diagnosing a mismatch, check the question, evidence, and expected answer themselves. Repair an invalid or underspecified question without labeling the user wrong or claiming understanding was established. Understanding actual behavior, approving intended behavior, and verifying correctness are separate outcomes. When evidence or assumptions change, revisit only affected conclusions; these learning checks never become a quiz or an extra approval gate for implementation work.

- **Correct**: Briefly identify what in the answer shows understanding, then continue to the next objective within the requested scope, or finish. Do not invent another objective to keep the dialogue going.
- **Partly correct**: Preserve the correct part, identify the missing or confused link, and ask a narrower question about the same objective.
- **Misconception**: Do not treat the answer as correct and do not introduce the next concept. Gently name the mismatch, replace or redraw the misunderstood part with a smaller visual, counterexample, or different representation, then ask one focused question that checks the same idea again.
- **Uncertain or no answer**: Lower the difficulty with a concrete example, constrained choice, or worked first step, then re-check the same objective.

Do not repeat the same question unchanged after a miss. Diagnose why it failed and change the visual, example, scope, or support. Stay on the same objective for as many turns as needed; do not advance because the user sounds confident or merely agrees. If the user asks to stop, skip the dialogue, or reveal the answer, respect that choice immediately.

## Calibrate without stereotyping

Prioritize the user's stated goal, existing knowledge, context, and requested depth. Age, grade, job role, or relationship may guide vocabulary and framing, but never assume interests, intelligence, family status, technical ability, or life experience from a demographic label.

- For children or beginners, use concrete language and short causal steps without baby talk.
- For practitioners, preserve domain terms and focus on mechanism, trade-offs, and edge cases.
- For managers or decision-makers, lead with impact, options, risk, and the decision required; include implementation detail only when it changes the decision. When the user supplies alternatives, explicitly frame the choice; the deliverable is incomplete until it names that decision. Recommend one only when the available evidence supports it; otherwise name the criterion needed to make it.
- For mixed audiences, give a shared core first and separate optional technical depth.

Read [references/audience-calibration.md](references/audience-calibration.md) for a specifically named audience, age, grade, role, or knowledge level. Read [references/guided-learning.md](references/guided-learning.md) for multi-turn teaching, quizzes, answer diagnosis, repeated repair, or curriculum-like progression.

## Keep the experience efficient

- Lead with the visual explanation. A Socratic method is not permission to withhold a useful model behind unnecessary questions.
- When depth is unspecified, prefer a compact complete explanation over an exhaustive survey.
- Do not over-explain familiar foundations. When the user demonstrates competence, increase precision and move faster.
- Do not praise mechanically. Use brief, evidence-based feedback that tells the user what they understood or what still needs repair.
- End when the requested deliverable is complete or the final learning objective is aligned. Do not append a recap or next lesson unless it serves the user's goal.
