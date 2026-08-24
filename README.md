# Socrates

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](./package.json)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[한국어](./README.ko.md)

Socrates is a **visual-first learning skill** for Codex and Claude Code. It turns concepts, code, trade-offs, and incidents into a visible model, then asks one focused question to check the learner's mental model.

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

On 2026-08-24, the generated v1.1.0 skill was given to independent fresh Codex agents. They received the user request and skill, but no evaluation conclusion or model answer.

| Test | Result |
|---|---|
| Database index | PASS — contrasted a full scan with the index path and ended with one question |
| Timeout incident | PASS — visualized trigger, retry feedback loop, recovery, and one causal question |
| First wrong cache answer | PASS — separated source change from cache awareness on a timeline and checked the same objective |
| Second wrong cache answer | PASS — did not advance; redrew only “becomes stale” vs. “discovers stale” |
| Scheduled-order change in existing code | PASS — separated current and proposed flows and grounded invariants, risks, and tests in the code |

The same prompts were also run without the skill.

| Request | Normal response | Socrates response | Observed difference |
|---|---|---|---|
| Database index | Gave a book-index analogy and trade-offs, then stopped | Drew the full-scan and index paths, then asked the learner to trace the path | Socrates consistently added a visible flow and an understanding check |
| Visual timeout incident with one question | Produced a causal flow and one question | Split trigger from recovery and made the retry feedback loop more explicit | The prompt was already specific, so the normal response was also strong and the difference was small |
| Scheduled orders in existing code | Correctly explained current flow, invariants, a proposed pipeline, and risks, then stopped | Separated current and proposed flows and asked the learner to identify the safe branch point | Both were accurate; Socrates connected the explanation to an observable understanding check |

<details>
<summary>Database index — normal response vs. Socrates</summary>

The normal response used a book analogy, SQL, and read/write costs, then ended.

> A database index is like the index at the back of a book.
>
> - Reads become faster.
> - Indexes consume disk space.
> - Inserts, updates, and deletes become slightly slower.

Socrates showed the lookup paths first:

```text
Without an index
users table: row 1? → row 2? → row 3? → ... → row 10,000,000?
             └──────────── full table scan ────────────────┘

With an index on email
sorted email index → location of the row → matching users row
```

> Your turn: after adding an index on `email`, trace the path the database takes to find one user.

</details>

<details>
<summary>Two consecutive wrong-answer repairs</summary>

After the learner said that a cache notices a source change by itself:

```text
10:00  Source: A ──copy──▶ Cache: A
10:01  Source: B           Cache: A  ← unaware

The cache learns through:
Source ──invalidation──▶ Cache
Cache  ──version check──▶ Source
Timer expires ─────────▶ revalidation
```

> If the source changes at 10:01, no invalidation is sent, and the cache checks freshness at 10:05, when can the cache first discover that its copy is stale?

The learner then incorrectly answered “10:01.” Socrates stayed on the same objective and redrew only the mismatch:

```text
Time    Source              Cache
10:00   value = A  ───────▶ value = A
10:01   value = B           value = A   ← receives nothing
10:05   ◀──── cache checks ────────────
         returns B ────────▶ discovers its A was stale
```

> 10:01 is when the cached copy **becomes stale**, not when the cache **discovers** it.
>
> At 10:01, what new information actually reaches the cache: a notification/check result, or nothing?

</details>

<details>
<summary>Scheduled-order explanation grounded in existing code</summary>

Test source: [`order-service.js`](./evals/fixtures/brownfield-orders/order-service.js), [`order-service.test.js`](./evals/fixtures/brownfield-orders/order-service.test.js)

```text
placeOrder(input)
      ↓
Find order by idempotency key
      ├── found ──▶ Return existing order
      ↓
Validate items → Reserve inventory → Authorize payment
      ↓
Insert "confirmed" order → Publish "order.confirmed" → Return

After reservation, any failure
      └──▶ Release reservation ──▶ Rethrow error
```

The proposal was kept separate from observed behavior:

```text
Find by key → Validate items → Is execution time in the future?
                                  ├─ no  → existing immediate path
                                  └─ yes → persist "scheduled"
                                             ↓
                                          due-time trigger
                                             ↓
                                      reserve → pay → confirm
```

> In one sentence: where should a future-dated order leave the current flow, and what makes that boundary safer than branching after inventory reservation?

</details>

The Claude Code skill passed the same generated-package checks and `$skill-creator` validation as the Codex skill. It is installed as a skill, not as a plugin, so `claude plugin validate` is not applicable. The local Claude CLI was logged out, so a v1.1.0 Claude model response was not run and is not marked as a pass.

## Invoke the skill

| Host | Explicit invocation |
|---|---|
| Codex | `$socrates <request>` |
| Claude Code | `/socrates <request>` |

The skill may also activate for explicit explanation, learning, ELI5, picture-explainer, code-flow, trade-off, incident-cause, or mental-model review requests. It does not take over ordinary code edits or narrow rewrites.

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

Pull the latest repository state and run the install command again. Managed skill copies are replaced with v1.1.0.

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

## Original inspiration

Socrates' visual-first direction is based on the public Claude Community ELI5 plugin. The original focuses on HTML artifacts with large visuals and few words. Socrates adds the question-driven alignment loop, wrong-answer repair, and source grounding for code and systems.

- [Claude Community ELI5 source](https://github.com/anthropics/claude-plugins-community/tree/main/eli5)

## License

MIT
