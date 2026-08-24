# Audience Calibration

Use this reference when the user names an audience, age, grade, role, knowledge level, or communication setting.

## Calibrate on five dimensions

1. **Goal**: learn, decide, implement, teach, troubleshoot, or communicate.
2. **Prior knowledge**: unfamiliar, adjacent knowledge, practitioner, or expert.
3. **Depth**: gist, working model, implementation detail, or rigorous nuance.
4. **Context**: personal curiosity, school, work, incident response, or a ready-to-send deliverable.
5. **Language and format**: preferred language, length, examples, equations, code, prose, or visual structure.

An explicit user preference beats a category default. When a category is all you have, make the least presumptive adjustment and let follow-up evidence refine it.

## Useful defaults

| Audience signal | Vocabulary | Emphasis | Avoid |
|---|---|---|---|
| Young child | Familiar concrete words, one causal step at a time | Observable examples and simple predictions | Baby talk, fake excitement, demographic assumptions |
| Beginner | Define essential terms at first use | Core model, one worked example, common confusion | Removing every proper term or hiding important conditions |
| Student | Match stated course level | Connections, derivation, practice, transfer | Assuming the syllabus or grading standard |
| Practitioner | Normal domain terminology | Mechanism, debugging cues, trade-offs | Re-teaching basics already demonstrated |
| Expert | Precise compact language | Assumptions, edge cases, alternatives, evidence | Decorative analogies and generic summaries |
| Manager or director | Plain professional language | Outcome, options, risk, cost, timing, decision | Code detail that does not alter the decision |
| Designer | Product language | User mental model, interaction, accessibility, failure states | Treating design as merely visual styling |
| Mixed audience | Shared plain-language core | Separate layers for decisions and implementation | A compromise level that serves nobody |

Age does not determine interests or intelligence. A role does not prove technical knowledge. A relationship label does not authorize a familiar or patronizing tone. Use facts supplied by the user, not stereotypes.

## Layered explanation

For an audience with mixed or uncertain background, use optional layers:

- **Core**: one or two sentences everyone needs.
- **Working model**: example, causal flow, or comparison.
- **Technical layer**: terminology, implementation, equations, or edge cases.
- **Decision layer**: implications and next choices.

The layers should agree with each other. Do not make the simple layer memorable by making it false.

## Audience-ready deliverables

When the request is “explain this to my manager/child/team,” write the actual deliverable in the appropriate voice. Preserve concrete facts, constraints, alternatives, and requested actions from the source request. For a decision-maker, explicitly state the decision when alternatives were supplied; that deliverable is not finished without the decision sentence. Recommend only when the evidence supports a choice. Use placeholders or conservative wording for nonessential unknowns. Put any optional refinement offer after the usable text and make it a non-interrogative invitation, not a second question. Do not address the original user as a student, announce the calibration process, or append an unsolicited quiz. Include a caveat only when omitting it would materially mislead the audience.
