# Socrates

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](./package.json)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[한국어](./README.ko.md)

Socrates is a learning and explanation skill for Codex and Claude Code. It combines audience-calibrated explanation with Socratic dialogue and a mastery gate: when a learner's answer is mistaken or incomplete, Socrates repairs the current mental model and checks the same idea again before moving forward.

It is inspired by the approachable audience adaptation of [DreambigOu/ELI5](https://github.com/dreambigou/eli5), but changes the center of gravity from “make this simpler” to “help this person form and demonstrate a correct model.”

## What it does

Socrates chooses the least intrusive interaction that fits the request:

- **Explain**: answer immediately, with vocabulary, depth, examples, and caveats calibrated to the user.
- **Deliver**: write the finished explanation for a named audience without turning the request into a lesson.
- **Guide**: teach one objective at a time with one focused question at a time.
- **Review**: diagnose a supplied answer or mental model before adding new material.

It does not force every explanation into a quiz. Direct questions receive direct value, audience-ready deliverables stay deliverables, and a user can opt out of guided dialogue at any time.

## The mastery gate

In guided learning, progress depends on demonstrated understanding rather than confidence or keyword matching.

| Learner response | Socrates does next |
|---|---|
| Correct | Identifies the relationship that is correct, then advances |
| Partly correct | Keeps the correct part, isolates the missing link, and asks a narrower question on the same objective |
| Misconception | Names the mismatch, changes the support or representation, and checks the same objective again |
| Unsure or no answer | Lowers the difficulty with an example, constrained choice, or worked first step, then re-checks |

Socrates never repeats the same question unchanged after a miss. It changes the example, representation, or difficulty. If the user asks for the answer or wants to stop the quiz, it explains directly instead of withholding information.

## Better audience calibration

Audience adaptation is based first on the user's goal, prior knowledge, context, requested depth, language, and format. Age, grade, or job role can guide vocabulary and framing, but Socrates does not infer interests, intelligence, family status, finances, or technical ability from demographic labels.

Simplification must remain accurate. An approximation is labeled, and an analogy maps back to the real concept and states where the comparison stops working.

## Usage

Codex:

```text
$socrates Teach me recursion Socratically. I understand functions but not the call stack.
$socrates ELI5 what a database index is. No quiz.
$socrates Review my explanation of eventual consistency and find the gap.
```

Claude Code:

```text
/socrates Teach me recursion Socratically. I understand functions but not the call stack.
/socrates Explain this API rate-limit problem to my manager.
/socrates Quiz me on transaction isolation, one concept at a time.
```

The skill can also activate automatically for explicit learning, explanation, ELI5, audience-translation, quiz, teach-back, and understanding-review requests. An ordinary coding task does not trigger it merely because a brief explanation is useful.

## Install from this checkout

Requirements:

- Node.js 22 or newer
- Codex, Claude Code, or both

Install for the current user:

```bash
node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

Install for one host:

```bash
node scripts/install.mjs --mode install --platform codex --scope global --source-root "$PWD"
node scripts/install.mjs --mode install --platform claude --scope global --source-root "$PWD"
```

Install into a repository:

```bash
node scripts/install.mjs --mode install --platform both --scope repo --target-repo /absolute/path/to/repo --source-root "$PWD"
```

Uninstall the v1 skill:

```bash
node scripts/install.mjs --mode uninstall --platform both --scope global --source-root "$PWD"
```

Installed locations:

| Host | User scope | Repository scope | Invocation |
|---|---|---|---|
| Codex | `$HOME/.agents/skills/socrates` | `.agents/skills/socrates` | `$socrates` |
| Claude Code | `$HOME/.claude/skills/socrates` | `.claude/skills/socrates` | `/socrates` |

When a custom `CODEX_HOME` is explicitly configured or already contains a Codex skill copy, the installer maintains the compatibility copy at `$CODEX_HOME/skills/socrates` as well as the canonical `$HOME/.agents/skills/socrates` copy.

## Upgrade from 0.10.x

Version 1.0.0 is a breaking product change. The former `socrates-contract` risk-coordination skill, contract scaffolder, and native role agents are not part of the v1 skill package. Remove the managed v0.10.0 installation with its original installer, then install v1:

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.10.0/scripts/install.mjs \
  | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform both --scope global --version v0.10.0

node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

The v1 installer does not recursively delete an unverified or user-modified legacy directory. This avoids treating an old path as installer-owned without evidence.

## Package design

The canonical skill sources live under `reference/` and generate two host packages:

```text
reference/skill-body.md
reference/skill-references/
        │
        ├── .agents/skills/socrates/   # Codex + agents/openai.yaml
        └── .claude/skills/socrates/   # Claude Code
```

The installed skill is deliberately small: one shared `SKILL.md`, two conditional references, and Codex UI metadata. It has no bundled executable, model-policy sidecar, contract state, or required subagent workflow.

The installer retains the previous repository's defensive transaction design: complete-source loading, path and symlink validation, private ownership records, sibling staging, atomic publication, rollback, interrupted-transaction recovery, modified-asset refusal, and ownership-aware uninstall.

## Evaluation

The catalog contains 21 cases across explanation, guided learning, audience calibration, noninterference, and packaging. The key progression tests distinguish a misconception, a partial answer, a correct answer, uncertainty, repeated-question failure, and explicit quiz opt-out.

Run deterministic repository checks:

```bash
npm run build:skills
npm run verify:skills
npm run verify:release-assets
npm run test:evals
npm test
```

Static checks validate package structure and declared behavioral invariants; they do not prove model behavior. Optional live evaluation runs isolated read-only skill/control cohorts:

```bash
SOCRATES_LIVE_EVAL=1 \
SOCRATES_LIVE_EVAL_HOST=claude \
SOCRATES_LIVE_EVAL_ARMS=skill,control \
SOCRATES_LIVE_EVAL_CASES=guided-cache-misconception,guided-cache-correct \
npm run eval:live
```

Use `SOCRATES_LIVE_EVAL_HOST=codex` for Codex. Each additional arm or case may incur another model call. Reports are advisory because model output is nondeterministic and deterministic regex rubrics are only semantic proxies.

## License

MIT
