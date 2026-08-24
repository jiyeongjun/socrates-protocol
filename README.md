# Socrates

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](./package.json)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[한국어](./README.ko.md)

Socrates is a Codex and Claude Code skill for work whose real goal is understanding or learning. It covers concept explanations, interactive learning, understanding checks, audience-ready explanations, and learning an existing system before adding a feature.

It chooses the interaction from the request. A normal explanation gets a complete answer, not a surprise quiz. Socratic dialogue starts only when you ask to be taught, questioned, or tested interactively.

## When to use Socrates

| Your goal | Example request | What Socrates does |
|---|---|---|
| Understand something quickly | `$socrates Explain database indexes briefly for someone new to backend development.` | Gives the core model, a useful example or visual, and the important caveat. It does not append a quiz. |
| Learn through dialogue | `$socrates Teach me recursion Socratically. I know functions, but not the call stack.` | Teaches one objective at a time and asks one focused question at a time. |
| Check your understanding | `$socrates Here is how I understand eventual consistency. Find the gap in my model: ...` | Separates what is correct from what is missing or mistaken before adding new material. |
| Explain it to someone else | `$socrates Turn this API rate-limit issue into a short update I can send to my manager.` | Produces the finished audience-ready message instead of teaching the original user how to write it. |
| Understand a change to existing code | `$socrates I need to add scheduled orders to this existing service. Explain how it works now, what rules must stay true, and where the new feature could connect.` | Separates what the code does today from what still needs to be built, then names the rules and tests the change must preserve. |

## How it differs from a normal response

Socrates does not make the model smarter. Modern models already explain straightforward concepts well, so a one-shot explanation may look similar with or without the skill. The difference is not a second reasoning engine; it is a consistent **interaction policy for learning**.

| Situation | Normal response without the skill | With Socrates |
|---|---|---|
| One-shot explanation | Uses whatever depth and format the model considers appropriate | Gives an audience-calibrated, complete answer, uses the smallest useful visual when helpful, and does not append a surprise check |
| Interactive learning | May explain several related ideas at once or choose any follow-up | Focuses on one learning objective and one response-demanding question at a time |
| Wrong or unclear answer | May give the correction and continue to another topic | Changes the representation but stays on the same objective until the learner demonstrates the missing relationship |
| Audience-ready deliverable | May mix the requested text with advice about how to explain it | Prioritizes the finished text the audience can read directly |
| Feature in an existing system | May jump directly to a patch plan or file list | Explains how the code works now and which rules must stay true before discussing what needs to be added |

In short, Socrates makes explanation, guided learning, and understanding checks more predictable; it does not replace the base model's intelligence.

Use the normal assistant for ordinary implementation work such as editing code, running tests, or refactoring. Use Socrates when understanding, teaching, evaluating a mental model, or adapting an explanation is the actual goal.

## How it responds

- **Explain** — Requests such as “explain,” “ELI5,” “why,” and “how” receive a direct, complete explanation. No follow-up question is added unless you explicitly ask for interactive learning or an understanding check.
- **Guided learning** — Requests such as “teach me Socratically,” “quiz me,” and “walk me through this” open an interactive lesson.
- **Review** — A supplied answer or mental model is diagnosed before the skill introduces another concept.
- **Deliverable** — “Explain this to my manager, child, or team” produces the text for that audience.

The requested audience, prior knowledge, language, depth, and format take priority over demographic assumptions. Simplification must remain accurate.

## Visual explanations

Socrates uses a visual when sequence, comparison, hierarchy, spatial structure, or changing state is materially clearer that way. It chooses the smallest useful format:

- a comparison table;
- an inline flow, timeline, or tree;
- a richer visualization capability when the host provides one and interaction would genuinely help.

It does not add decorative diagrams to simple facts. Every visual must map back to the real concept, and an analogy must say where the comparison stops matching.

## What happens after a wrong answer

Guided learning advances only when the current idea is demonstrated in the learner's answer.

| Learner response | What happens next |
|---|---|
| Correct | Names the relationship that shows understanding, then advances |
| Partly correct | Keeps the correct part, isolates the missing link, and asks a narrower question on the same objective |
| Misconception | Corrects the mismatch, changes the example or representation, and checks the same idea again before moving forward |
| Unsure or no answer | Lowers the difficulty with a concrete case, constrained choice, or worked first step, then re-checks the same objective |

Socrates never repeats the same question unchanged after a miss. It changes the support and stays on the current objective. A guided lesson can still be stopped at any time by asking for the answer directly.

## Actual response tests

These results came from fresh Codex and Claude sessions using the generated v1 skill on 2026-08-24. They are behavioral evidence, not scripted output; wording can vary between runs.

| Host | Scenario | Observed result |
|---|---|---|
| Codex | Direct database-index explanation | PASS — book-index model, comparison table, and no follow-up question |
| Claude | Direct database-index explanation | PASS — B+tree sketch, comparison table, and no follow-up question |
| Codex | Cache-freshness misconception | PASS — corrected the model, stayed on cache freshness, and asked one same-objective question |
| Claude | Cache-freshness misconception | PASS — changed to a paper-menu analogy and re-checked the same objective with one question |
| Codex A/B | Understand scheduled orders in an existing service | PASS — both arms read the code correctly; Socrates separated what exists from what must be added and listed decisions and new tests |

### Same-prompt A/B — normal response vs. Socrates

These paired runs used the same Codex model in independent fresh sessions. One session was explicitly prevented from loading a skill; the other explicitly used Socrates.

| Request | Normal response | Socrates response | Observed difference |
|---|---|---|---|
| Explain a database index | Book analogy, SQL example, read/write trade-off, and no closing question | Book analogy, SQL example, read/write trade-off, and no closing question | Little difference for a straightforward explanation; Socrates did not force an unnecessary dialogue |
| Continue after “the cache watches the source automatically” | Introduced TTL, invalidation, version checks, events, and polling together, then asked a TTL calculation | Corrected automatic detection, then asked what the cache returns when no signal, expiry, or version check occurs | The normal response expanded to a related objective; Socrates stayed on the original misconception and re-checked it |
| Understand scheduled orders before changing an existing service | Correctly explained the current flow, rules to preserve, two-stage design, and existing risks | Covered the same evidence, separated what works today from what must be added, then listed decisions to make and tests to add | The normal response was already strong. Socrates was not more correct; it made the things to check before changing the code easier to scan and harder to miss |

<details>
<summary>Actual misconception A/B excerpts — Codex</summary>

Shared request:

```text
We are learning how a cache knows that source data changed. You asked,
“How does a cache know its copy is stale?” and I answered,
“It keeps watching the source and notices automatically.” Continue teaching me.
```

Normal response:

> That’s possible, but caches usually don’t “notice automatically.” They need a signal or rule:
>
> - **Expiration (TTL):** “This copy is valid for five minutes.”
> - **Invalidation:** The source tells the cache, “Delete or update this key.”
> - **Version checking:** The cache asks whether the source’s version, timestamp, or ETag changed.
> - **Change events:** The cache subscribes to update notifications.
> - **Polling:** The cache periodically checks the source.
>
> Quick check: if a cache refreshes every five minutes and the source changes one minute after a refresh, how long might users receive stale data?

Socrates response:

> “Watching the source” is one possible design, but it isn’t automatic. A cache only detects staleness through a mechanism such as:
>
> - the source sending an invalidation or update;
> - the cached entry expiring after a TTL;
> - the cache comparing a version number or ETag;
> - a subscription or change stream that watches updates.
>
> Without one of these, stale data can still look valid.
>
> Suppose the source changes, but sends no notification, the TTL has not expired, and no version check occurs. What will the cache return on the next request: its old copy or the new source value?

</details>

<details>
<summary>Actual existing-code feature A/B excerpts — Codex</summary>

Test code: [`order-service.js`](./evals/fixtures/brownfield-orders/order-service.js), [`order-service.test.js`](./evals/fixtures/brownfield-orders/order-service.test.js)

Shared request:

```text
I'm new to this codebase and need to add scheduled orders.
Before I change anything, help me understand the current order-creation flow,
what must remain true, and where this feature would likely connect.
```

Normal response:

> The fixture has one immediate order-creation path: `placeOrder`. There is currently no scheduler, pending-order state, API layer, or concrete repository implementation.
>
> A two-stage design fits this flow best:
>
> 1. `scheduleOrder` stores a scheduling intent containing `customerId`, items, `scheduledFor`, and a schedule ID.
> 2. A worker claims that intent when due and invokes the existing `placeOrder` flow.
> 3. Worker retries use a deterministic idempotency key derived from the schedule ID.
> 4. The schedule records execution outcome separately: scheduled, processing, completed, cancelled, or failed.
>
> - If event publication fails after insertion, the code releases inventory even though a confirmed order already exists; a retry then returns that order without republishing.
> - If insertion fails after payment authorization, the authorization is not voided.

Socrates response:

> The core mental model is: `placeOrder` synchronously turns a request into a confirmed order. Scheduled orders would add a persisted “intent” that is fulfilled later.
>
> There is no scheduler, API route, or concrete database implementation in this fixture. The visible extension point is this service and its injected dependencies.
>
> Before implementation, decide:
>
> - Whether inventory and price are locked when scheduled or evaluated at execution time.
> - Whether payment is authorized now or at execution time.
> - How cancellation and rescheduling affect queued work.
> - Which failures are retryable and how duplicate charges are prevented.
>
> Alongside preserving the existing three tests, cover:
>
> - Scheduling persists a `scheduled` order without reserving inventory or authorizing payment.
> - A due order is claimed and fulfilled exactly once under concurrent workers.
> - Fulfillment retains the existing reserve → authorize → confirm → publish ordering.
> - Retries cannot duplicate payment, confirmation, or event publication.

</details>

<details>
<summary>Actual direct-explanation excerpt — Codex</summary>

Prompt:

```text
$socrates Explain database indexes to someone new to backend development.
```

Verbatim excerpt:

> A database index is an extra data structure that helps the database find specific rows without checking every row in a table.
>
> Think of it like a book:
>
> - The table is the book’s pages.
> - The index is the alphabetical index at the back.
> - The index tells you where to look instead of reading every page.

|  | Without index | With index |
|---|---|---|
| Matching reads | Often slower | Usually faster |
| Inserts and updates | Cheaper | Slightly slower |
| Storage | No extra space | Uses extra space |

> The most useful mental model is: **an index exchanges extra storage and write work for faster retrieval of particular data.**

</details>

<details>
<summary>Actual direct-explanation excerpt — Claude</summary>

Prompt:

```text
/socrates 데이터베이스 인덱스를 백엔드 입문자에게 설명해줘.
```

Verbatim excerpts from the Korean test session:

> 인덱스는 "테이블 전체를 훑지 않고 원하는 행을 바로 찾아가기 위해, 특정 컬럼을 **미리 정렬해 둔 별도의 자료구조**"입니다.

```text
              [ 50 | 200 ]              ← 루트
             /      |      \
    [10|30]    [80|150]    [400|900]    ← 중간 노드
      |           |             |
   실제 행 위치들 (정렬된 리프)          ← 옆으로 연결돼 있어 범위 스캔도 빠름
```

| | 인덱스 없음 | 인덱스 있음 |
|---|---|---|
| 100만 행에서 1건 조회 | 100만 행 읽음 | 3~4개 노드 읽음 |
| 조회 비용 증가 속도 | 행 수에 비례 (O(n)) | 로그에 비례 (O(log n)) |
| INSERT/UPDATE | 데이터만 씀 | 데이터 + 인덱스도 갱신 |
| 저장 공간 | 데이터만 | 인덱스만큼 추가 |

> 인덱스 5개 달린 테이블은 INSERT 한 번에 6곳을 씁니다. 쓰기가 많은 테이블에 인덱스를 남발하면 오히려 느려집니다.

</details>

<details>
<summary>Actual misconception-repair response — Codex</summary>

Prompt:

```text
$socrates We are learning how a cache knows that source data changed. You asked,
“How does a cache know its copy is stale?” and I answered,
“It keeps watching the source and notices automatically.” Continue teaching me.
```

Full response:

> That describes one possible design, but it isn’t automatic. A cached copy becomes stale as soon as the source changes; the cache may remain unaware until it receives an invalidation/update, checks the source, or reaches an expiry time.
>
> Suppose a cache stores `price = $10` for five minutes. After one minute, the database changes it to `$12`, but sends no notification. A request arrives after two minutes. What price will the cache return, and why?

</details>

<details>
<summary>Actual misconception-repair excerpt — Claude</summary>

Verbatim excerpts from the Korean cache-freshness test:

> "원본을 계속 보고 있다"는 부분이 핵심 오해야. 그리고 이건 그냥 틀린 게 아니라, **캐시가 존재하는 이유 자체와 모순**돼.
>
> **주머니 속 종이 메뉴판**을 떠올려봐. 가게에서 아메리카노 가격을 4,000원 → 4,500원으로 올렸어. 네 주머니 속 종이는 그 순간 뭘 할까? 아무것도 안 해. 종이는 가게를 볼 수 없어. 그냥 4,000원이라고 적힌 채 조용히 틀린 정보가 돼.
>
> 캐시도 똑같아. 복사본은 **수동적**이야. 스스로 낡음을 감지하는 능력이 없어.
>
> 다시 물어볼게 (같은 지점이야). 주머니 속 종이 메뉴판이 스스로 가게를 볼 수 없다면 — 그런데도 네가 "이 종이는 이제 못 믿겠다"는 걸 알게 되는 경로가 있을 거야. 그중 **하나만** 구체적으로 말해봐. 누가/무엇이 움직여서 네가 알게 되는 거야?

</details>

## Invoke the skill

| Host | Explicit invocation |
|---|---|
| Codex | `$socrates <request>` |
| Claude Code | `/socrates <request>` |

The skill may also activate automatically for an explicit explanation, learning, quiz, teach-back, audience adaptation, or understanding-review request. An ordinary task does not trigger it merely because the answer may contain a short explanation.

## Install from this checkout

Requirements: Node.js 22 or newer, plus Codex, Claude Code, or both.

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

Uninstall v1:

```bash
node scripts/install.mjs --mode uninstall --platform both --scope global --source-root "$PWD"
```

| Host | User scope | Repository scope |
|---|---|---|
| Codex | `$HOME/.agents/skills/socrates` | `.agents/skills/socrates` |
| Claude Code | `$HOME/.claude/skills/socrates` | `.claude/skills/socrates` |

When a custom `CODEX_HOME` is explicitly configured or already contains a Codex skill copy, the installer also maintains `$CODEX_HOME/skills/socrates` as a compatibility copy.

## Upgrade from 0.10.x

Version 1.0.0 replaces the former `socrates-contract` risk-coordination product. The contract scaffolder and native role agents are not part of v1. Remove the managed v0.10.0 installation with its original installer, then install v1:

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.10.0/scripts/install.mjs \
  | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform both --scope global --version v0.10.0

node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

The v1 installer does not recursively delete an unverified or user-modified legacy directory.

## Package and verification

One canonical skill source generates both host packages:

```text
reference/skill-body.md
reference/skill-references/
        │
        ├── .agents/skills/socrates/   # Codex + agents/openai.yaml
        └── .claude/skills/socrates/   # Claude Code
```

The installed package contains one shared `SKILL.md`, two conditional references, and Codex UI metadata. It has no bundled executable, model-policy sidecar, contract state, or required subagent workflow.

Run automated checks:

```bash
npm run build:skills
npm run verify:skills
npm run verify:release-assets
npm run test:evals
npm test
```

The catalog contains 22 cases and 42 automated grader checks across explanation, guided learning, audience calibration, noninterference, and packaging. Optional isolated live evaluation:

```bash
SOCRATES_LIVE_EVAL=1 \
SOCRATES_LIVE_EVAL_HOST=claude \
SOCRATES_LIVE_EVAL_ARMS=skill,control \
SOCRATES_LIVE_EVAL_CASES=guided-cache-misconception,guided-cache-correct \
npm run eval:live
```

Use `SOCRATES_LIVE_EVAL_HOST=codex` for Codex. Model output is nondeterministic, so regex graders and recorded examples are supporting evidence rather than semantic proof.

## License

MIT
