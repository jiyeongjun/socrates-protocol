# Socrates

[![Version](https://img.shields.io/badge/version-2.2.1-blue)](./package.json)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[한국어](./README.ko.md)

Socrates aligns natural-language intent with code for Codex and Claude Code. It inspects existing context, asks about consequential gaps, makes the proposed behavior and design reviewable, and carries the confirmed scope through implementation and verification. It also remains a **visual-first learning skill** for concepts, code, trade-offs, and incidents.

## Align a coding request

```text
Request → inspect code and context → identify consequential decisions
   → ask and integrate answers → agree behavior and acceptance examples
   → cross-check useful diagrams → final confirmation
   → implement → verify the agreed behavior
```

The model presents its interpretation for correction. It does not quiz the user about implementation concepts. It discovers existing facts itself and asks when different answers would change behavior, scope, data semantics, failure handling, or important design constraints. Internal choices within the agreement follow repository conventions.

Use `$socrates Add batch invitations; align the intended behavior with me before coding` in Codex, or `/socrates` in Claude Code. The skill can also activate for consequential ambiguity in feature requests. A fully specified ordinary edit proceeds under the existing authorization without an extra ceremony.

Before implementation, review a compact agreement: goal, scope, observable behavior, relevant exceptions, preserved behavior, and acceptance examples. Unresolved consequential decisions prevent a claim of alignment. Choose diagrams by the relationship being checked: classes for object responsibilities, components for module boundaries, sequences for call order and failures, data flow for transformation and storage, states for lifecycles, or flowcharts for branching. Diagrams distinguish current behavior from proposals and include material failure paths. Simple changes need no diagram.

In the alignment workflow, final confirmation covers the concrete agreement and design. Until then, the model may inspect evidence and prepare an inline design, but does not edit product code, tests, dependencies, or configuration. An earlier final approval of the same concrete scope remains valid. Explicit delegation or a user waiver is respected; silence and urgency are not waivers. After approval, implementation and verification proceed. Reopen only decisions whose behavior, scope, or constraints must change.

Learning and implementation have different completion criteria: the learner demonstrates a relationship; the coding user confirms the model's interpretation. A no-quiz learning request does not delegate unresolved product policy. The skill cannot guarantee intent fidelity; inspect actual decisions, tool traces, and acceptance results.

See [the implementation workflow](reference/skill-references/implementation-alignment.md) and [behavioral evaluation instructions](evals/README.md).

[v2.2.1 completion-boundary evaluation](evals/reports/2026-10-26-v2.2.1.md)

## Learning behavior

Version 2.2.1 first checks whether the requested objective is already complete. A correct, completed answer gets a brief assessment and ends; separately requested practice, explanations, and approved fixes still proceed. Without a native reviewer, a narrow explanation uses a finding, execution trace, and remaining requested facts. A deletion-only scope check removes unsolicited proposals and unsupported assurances without rewriting the answer.

Version 2.2 adds review of the complete draft for misconception repair, requested practice, and requirements comparisons. With native delegation available, a fresh read-only reviewer checks the original request, evidence, diagrams, tables, and final question before the author applies minimal repairs. Already-correct completed objectives and fully specified ordinary edits skip this step. Without native delegation, the author follows the ordinary evidence-grounded workflow and does not load or simulate the reviewer-only role. This adds work and latency; it is an instruction workflow, not an enforced runtime gate.

Application questions are prepared before the explanation and checked against both the mistaken and correct model. External calls remain separate from uncertain effects, failure is separate from rollback, and atomicity is separate from visibility. The review preserves explicitly requested fixes, additional options, and simple recognition. See the report for paired tests, skipped reviews, failed pilot calls, and remaining defects. Historical [v2.1.2 results](evals/reports/2026-10-26-v2.1.2.md) remain unchanged.

Version 2.1 adds fair, evidence-grounded learning checks inspired by [Sphinx](https://github.com/parthh01/sphinx): establish the minimum outcome and causal reason before asking, validate the question before diagnosing the learner, and use a changed scenario when application matters. Accept equivalent explanations without adding hidden requirements. Correct an invalid question as a teaching error; describing a bug accurately does not approve the bug. Revisit only conclusions affected by changed evidence. These are conversational rules, not a Git gate or a guarantee of mastery, and never turn implementation alignment into a quiz.

When an answer is wrong or incomplete, Socrates does not move on. It redraws only the misunderstood relationship with a different visual, analogy, or example and stays on the same objective until the learner's answer shows the key relationship.

## How it works

```text
Request
  ↓
Show the big picture visually
  ↓
Ask one focused question
  ↓
Learner's answer
  ├─ Key relationship is correct → next objective or finish
  └─ Wrong or incomplete → redraw that part → check the same objective
```

“Aligned” does not mean the model can read a person's mind or guarantee permanent mastery. It means the learner has **expressed or applied the current objective's key relationship without contradicting it**.

If the user asks for no questions, requests the answer directly, or wants a finished artifact for someone else, Socrates stops the dialogue and provides the deliverable.

## When to use Socrates

| Goal | Example request | What Socrates does |
|---|---|---|
| Align a coding request | `$socrates Add batch invitations. Agree the behavior and design with me before coding.` | Inspects the code, clarifies consequential gaps, cross-checks the design, and implements after final confirmation |
| Understand a new concept | `$socrates Explain database indexes to someone new to backend development.` | Draws the whole model first, then checks it with one question |
| Understand code or a module | `$socrates Show me how this payment module works, using the code as evidence.` | Visualizes data, control, and failure paths from the actual source |
| Prepare a change to an existing system | `$socrates Before I add scheduled orders, explain the current flow and likely connection point.` | Separates current behavior from proposals and connects invariants to tests |
| Understand a trade-off | `$socrates Explain when to choose polling or webhooks with a visual.` | Puts benefits and costs on the same causal map |
| Understand an incident | `$socrates Show why this timeout change caused a retry storm.` | Maps trigger, propagation, impact, and recovery as a timeline or feedback loop |
| Check your mental model | `$socrates Here is how I think cache refresh works. Find the wrong connection: ...` | Preserves correct parts, repairs the mismatch, and checks the same objective again |
| Explain it to someone else | `$socrates Make a one-page explanation of this incident for my manager.` | Produces the finished artifact without quizzing the original user |

## How it differs from a normal response

Socrates does not make the model smarter. It makes the learning flow consistent.

| Situation | Normal response | With Socrates |
|---|---|---|
| Starting an explanation | The model chooses prose, bullets, a table, or a diagram | Shows the big picture visually first |
| Checking understanding | May omit a check or ask several questions | Asks one question about the key relationship |
| Wrong answer | May correct it and continue elsewhere | Stays on the same objective and redraws the misunderstood part |
| Code or incident explanation | May lead with a summary or solution | Shows the current flow and causal chain, then separates evidence from proposals |
| Repeated use | Format can vary from request to request | Preserves the visual → question → repair loop |

A normal model can also do this well when the prompt explicitly asks for a visual and one question. Socrates is valuable because the user does not have to restate that format every time.

## What the visual output looks like

- It uses the host's artifact or visualization surface when available.
- An ELI5 or picture-explainer request prefers a self-contained HTML artifact with large diagrams and few words.
- Without an artifact surface, it uses an inline flow, timeline, state map, tree, or comparison.
- It does not add an HTML file to the user's repository unless the user requested a file.
- For code and systems, it reads the source first and visually distinguishes observed behavior, proposals, and unknowns.

Simple facts do not get decorative diagrams. Every arrow, color, boundary, and label must explain a real relationship.

## Actual response tests

The writable suite provides six scenarios: a four-turn implementation agreement, conflicting requirements, an already approved edit, learning repair, guided continuation, and learning opt-out. It records tool traces and file changes and runs independent acceptance checks after implementation. See [evaluation instructions](evals/README.md) for commands, model selection, isolation limits, and semantic review requirements.

The current candidate was checked with Sonnet 5.5 at high effort. The historical 2026-09-09 Astra/Fable 5.1 runs passed the implementation and regression checks after two focused refinements and affected-case reruns. The [verification report](evals/reports/2026-09-09.md) records the evidence, changes, and limits.

The earlier v1.1.0 learning evaluation was run on 2026-08-24 with Codex. It is historical evidence, not a result for the current models or implementation workflow.

## Invoke the skill

| Host | Explicit invocation |
|---|---|
| Codex | `$socrates <request>` |
| Claude Code | `/socrates <request>` |

The skill may also activate for explicit explanation, learning, ELI5, picture-explainer, code-flow, trade-off, incident-cause, or mental-model review requests. Fully specified ordinary edits and narrow rewrites do not become lessons or approval ceremonies.

## Install

Requires Node.js 22 or newer, plus Codex, Claude Code, or both.

Install both host packages for the current user:

```bash
node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

<details>
<summary>Install one host, install into a repository, or uninstall</summary>

```bash
# Codex only
node scripts/install.mjs --mode install --platform codex --scope global --source-root "$PWD"

# Claude Code only
node scripts/install.mjs --mode install --platform claude --scope global --source-root "$PWD"

# Both hosts in one repository
node scripts/install.mjs --mode install --platform both --scope repo --target-repo /absolute/path/to/repo --source-root "$PWD"

# Remove both current-user installations
node scripts/install.mjs --mode uninstall --platform both --scope global --source-root "$PWD"
```

| Host | User scope | Repository scope |
|---|---|---|
| Codex | `$HOME/.agents/skills/socrates` | `.agents/skills/socrates` |
| Claude Code | `$HOME/.claude/skills/socrates` | `.claude/skills/socrates` |

When a custom `CODEX_HOME` exists or already contains a Codex skill copy, the installer also maintains `$CODEX_HOME/skills/socrates` for compatibility.

</details>

### Update an existing installation

Pull the latest repository state and run the install command again. Managed skill copies are replaced with v2.2.1. The local source command works before a release tag is published.

For a v0.10.0 installation, remove the old product first:

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.10.0/scripts/install.mjs \
  | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform both --scope global --version v0.10.0

node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

The installer does not force-delete an installation it cannot verify or a directory the user has modified.

## Development and verification

One source generates the Codex and Claude Code packages:

```text
reference/skill-body.md
reference/skill-references/
        │
        ├── .agents/skills/socrates/   # Codex
        └── .claude/skills/socrates/   # Claude Code
```

```bash
npm run build:skills
npm run verify:skills
npm run verify:release-assets
npm run test:evals
npm test
```

The evaluation set contains 23 cases and 45 automated checks covering explanation, visualization, guided learning, audience adaptation, noninterference with ordinary work, and packaging.

The separate writable suite covers implementation alignment and learning regressions on both hosts. These commands make real model calls using the current CLI and its account credentials:

```bash
SOCRATES_LIVE_EVAL=1 SOCRATES_ALIGNMENT_HOST=codex npm run eval:alignment
SOCRATES_LIVE_EVAL=1 SOCRATES_ALIGNMENT_HOST=claude npm run eval:alignment
```

## Original inspiration

Socrates' visual-first direction is based on the public Claude Community ELI5 plugin. The original focuses on HTML artifacts with large visuals and few words. Socrates adds the question-driven alignment loop, wrong-answer repair, and source grounding for code and systems.

- [Claude Community ELI5 source](https://github.com/anthropics/claude-plugins-community/tree/main/eli5)

## License

MIT
