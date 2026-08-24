# Socrates

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](./package.json)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[English](./README.md)

Socrates는 Codex와 Claude Code를 위한 **시각화 우선 학습 스킬**입니다. 개념·코드·트레이드오프·장애 원인을 먼저 그림으로 보여주고, 질문 하나로 사용자의 멘탈 모델을 확인합니다.

답이 어긋나면 다음 내용으로 넘어가지 않습니다. 이해하지 못한 부분만 다른 그림·비유·사례로 다시 설명하고, 사용자의 답에서 핵심 관계가 정확히 드러날 때까지 같은 목표를 이어갑니다.

## 어떻게 동작하는가

```text
요청
  ↓
큰 흐름을 시각화
  ↓
핵심 질문 하나
  ↓
사용자의 답
  ├─ 핵심 관계가 맞음 → 다음 단계 또는 종료
  └─ 틀리거나 부족함 → 해당 부분을 다시 그림 → 같은 목표 재확인
```

여기서 “얼라인됐다”는 모델이 사람의 머릿속을 100% 안다는 뜻이 아닙니다. **현재 학습 목표의 핵심 관계를 사용자가 자기 말로 정확히 설명하거나 새 사례에 적용했다**는 관찰 가능한 기준입니다.

사용자가 질문을 원하지 않거나 답을 바로 달라고 하면 문답을 멈춥니다. 다른 사람에게 보낼 설명 자료를 요청한 경우에도 완성된 자료만 제공합니다.

## 언제 쓰는가

| 원하는 결과 | 요청 예시 | Socrates의 동작 |
|---|---|---|
| 처음 보는 개념 이해 | `$socrates 데이터베이스 인덱스를 백엔드 입문자에게 설명해줘.` | 전체 구조를 먼저 그리고 핵심 질문 하나로 이해를 확인 |
| 코드나 모듈 흐름 파악 | `$socrates 이 결제 모듈이 어떻게 동작하는지 코드 근거로 보여줘.` | 실제 코드를 읽고 데이터·제어·실패 경로를 시각화 |
| 기존 시스템에 기능 추가 | `$socrates 주문 서비스에 예약 주문을 넣기 전에 현재 흐름과 연결 지점을 설명해줘.` | 현재 동작과 제안을 구분하고 지켜야 할 규칙과 테스트까지 연결 |
| 트레이드오프 이해 | `$socrates polling과 webhook의 선택 기준을 그림으로 설명해줘.` | 장점과 비용을 같은 인과관계 위에 배치 |
| 장애 원인 이해 | `$socrates 이 타임아웃 장애가 왜 재시도 폭증으로 이어졌는지 보여줘.` | 원인·전파·영향·복구를 타임라인이나 피드백 루프로 표현 |
| 내 이해 점검 | `$socrates 내가 이해한 캐시 갱신 방식은 이래. 틀린 연결을 찾아줘: ...` | 맞는 부분과 어긋난 부분을 나누고 같은 목표를 다시 확인 |
| 다른 사람에게 전달 | `$socrates 이 장애를 매니저에게 보여줄 한 장 설명으로 만들어줘.` | 원래 사용자를 퀴즈 내지 않고 바로 공유할 수 있는 결과물 작성 |

## 일반 응답과 무엇이 다른가

Socrates가 모델을 더 똑똑하게 만드는 것은 아닙니다. 차이는 설명을 매번 같은 학습 흐름으로 이끈다는 점입니다.

| 상황 | 일반 응답 | Socrates |
|---|---|---|
| 설명 시작 | 문단·불릿·표 중 모델이 임의로 선택 | 큰 흐름을 그림으로 먼저 제시 |
| 이해 확인 | 생략하거나 여러 질문을 붙일 수 있음 | 핵심 관계를 확인하는 질문 하나만 제시 |
| 틀린 답 | 정답을 알려준 뒤 다른 주제로 갈 수 있음 | 다음 단계로 넘어가지 않고 해당 부분을 다시 시각화 |
| 코드·장애 설명 | 요약이나 해결책부터 제시할 수 있음 | 현재 흐름과 인과관계를 먼저 보여주고 근거와 제안을 구분 |
| 반복 사용 | 요청할 때마다 형식이 달라질 수 있음 | 시각화 → 질문 → 교정이라는 흐름을 유지 |

일반 모델도 명시적으로 “시각화하고 질문 하나를 해 달라”고 요청하면 좋은 답을 만들 수 있습니다. Socrates의 가치는 정확도 우위가 아니라 이 형식을 매번 다시 적지 않아도 된다는 데 있습니다.

## 어떤 시각화를 만드는가

- Codex나 Claude Code가 아티팩트·시각화 화면을 지원하면 그 기능을 우선 사용합니다.
- ELI5나 그림 설명을 요청하면 큰 다이어그램과 적은 글자로 구성된 자체 완결형 HTML 아티팩트를 우선합니다.
- 해당 기능이 없으면 채팅 안에 흐름도·타임라인·상태도·트리·비교표를 만듭니다.
- 사용자가 파일을 요청하지 않았다면 HTML을 만들기 위해 저장소에 파일을 추가하지 않습니다.
- 코드와 시스템은 먼저 원문을 읽고, 현재 동작·제안·모르는 부분을 시각적으로 구분합니다.

단순한 사실에는 장식용 그림을 붙이지 않습니다. 화살표·색·경계·라벨은 모두 실제 관계를 설명해야 합니다.

## 실제 응답 테스트

2026-08-24에 v1.1.0 생성 스킬만 전달한 독립된 새 Codex 에이전트로 테스트했습니다. 평가 결론이나 모범 답안은 전달하지 않았습니다.

| 테스트 | 결과 |
|---|---|
| 데이터베이스 인덱스 | 통과 — 전체 스캔과 인덱스 경로를 나란히 그리고 질문 하나로 종료 |
| 타임아웃 장애 | 통과 — 트리거·재시도 피드백 루프·복구 흐름을 그리고 인과 질문 하나로 종료 |
| 캐시를 잘못 이해한 첫 답 | 통과 — 원본 변경과 캐시 인지 시점을 타임라인으로 분리하고 같은 목표를 질문 |
| 캐시를 다시 틀리게 답함 | 통과 — 다음 내용으로 넘어가지 않고 `낡아진 시점`과 `알아차린 시점`만 다시 그림 |
| 기존 주문 코드에 예약 주문 추가 전 파악 | 통과 — 현재 흐름과 제안 흐름을 분리하고 지켜야 할 규칙·위험·테스트를 코드 근거로 설명 |

같은 프롬프트를 스킬 없이 실행한 결과도 함께 비교했습니다.

| 요청 | 일반 응답 | Socrates | 실제 차이 |
|---|---|---|---|
| 데이터베이스 인덱스 | 책 색인 비유와 장단점을 설명했지만 흐름 확인 질문 없이 종료 | 전체 스캔과 인덱스 탐색 경로를 그리고 사용자가 경로를 직접 설명하도록 질문 | Socrates가 시각적 흐름과 이해 확인을 일관되게 추가 |
| 타임아웃 장애를 시각적으로 설명하고 질문 | 인과 흐름과 질문을 모두 제공 | 트리거와 복구를 나누고 재시도 피드백 루프를 더 명확히 표시 | 요청 자체가 구체적이면 일반 응답도 충분히 좋았으며 차이는 작았음 |
| 기존 주문 코드에 예약 주문 추가 전 파악 | 현재 흐름·지켜야 할 규칙·제안 파이프라인과 위험을 정확히 설명하고 종료 | 현재와 제안 흐름을 따로 그리고 사용자가 분기 위치와 이유를 설명하도록 질문 | 두 응답 모두 정확했고, Socrates만 이해 확인까지 학습 흐름으로 연결 |

<details>
<summary>데이터베이스 인덱스 — 일반 응답과 Socrates 비교</summary>

일반 응답은 책 색인 비유, SQL, 읽기·쓰기 비용을 설명한 뒤 끝났습니다.

> A database index is like the index at the back of a book.
>
> - Reads become faster.
> - Indexes consume disk space.
> - Inserts, updates, and deletes become slightly slower.

Socrates 응답은 탐색 경로를 먼저 보여줬습니다.

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
<summary>잘못된 답을 두 번 이어서 교정한 결과</summary>

첫 답이 “캐시는 원본이 바뀐 것을 스스로 알아차린다”였을 때:

```text
10:00  Source: A ──copy──▶ Cache: A
10:01  Source: B           Cache: A  ← unaware

The cache learns through:
Source ──invalidation──▶ Cache
Cache  ──version check──▶ Source
Timer expires ─────────▶ revalidation
```

> If the source changes at 10:01, no invalidation is sent, and the cache checks freshness at 10:05, when can the cache first discover that its copy is stale?

여기에 다시 “10:01에 알아차린다”고 틀리게 답하자 다음 주제로 넘어가지 않았습니다.

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
<summary>기존 주문 코드에 예약 주문을 추가하기 전 응답 발췌</summary>

테스트에 사용한 코드: [`order-service.js`](./evals/fixtures/brownfield-orders/order-service.js), [`order-service.test.js`](./evals/fixtures/brownfield-orders/order-service.test.js)

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

제안은 현재 동작과 분리해 표시했습니다.

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

Claude Code용 스킬은 Codex용 스킬과 같은 생성 패키지 검사와 `$skill-creator` 검증을 통과했습니다. 플러그인이 아니라 스킬로 설치되므로 `claude plugin validate` 대상은 아닙니다. 현재 로컬 Claude CLI가 로그아웃 상태라 v1.1.0의 실제 모델 응답은 실행하지 않았으며, 이를 통과로 표시하지 않았습니다.

## 호출 방법

| 도구 | 명시적 호출 |
|---|---|
| Codex | `$socrates <요청>` |
| Claude Code | `/socrates <요청>` |

설명·학습·ELI5·그림 설명·코드 흐름·트레이드오프·장애 원인·멘탈 모델 점검 요청에는 자동으로 선택될 수도 있습니다. 일반적인 코드 수정이나 짧은 문장 편집에는 개입하지 않습니다.

## 설치

Node.js 22 이상과 Codex 또는 Claude Code가 필요합니다.

현재 사용자에게 Codex와 Claude Code용 스킬을 함께 설치:

```bash
node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

<details>
<summary>한쪽만 설치하거나 특정 저장소에 설치·삭제하기</summary>

```bash
# Codex만 설치
node scripts/install.mjs --mode install --platform codex --scope global --source-root "$PWD"

# Claude Code만 설치
node scripts/install.mjs --mode install --platform claude --scope global --source-root "$PWD"

# 특정 저장소에 둘 다 설치
node scripts/install.mjs --mode install --platform both --scope repo --target-repo /absolute/path/to/repo --source-root "$PWD"

# 현재 사용자 범위에서 둘 다 삭제
node scripts/install.mjs --mode uninstall --platform both --scope global --source-root "$PWD"
```

| 도구 | 사용자 범위 | 저장소 범위 |
|---|---|---|
| Codex | `$HOME/.agents/skills/socrates` | `.agents/skills/socrates` |
| Claude Code | `$HOME/.claude/skills/socrates` | `.claude/skills/socrates` |

사용자 지정 `CODEX_HOME`이 있거나 기존 Codex 스킬 복사본이 발견되면 호환성을 위해 `$CODEX_HOME/skills/socrates`도 함께 관리합니다.

</details>

### 기존 버전에서 업데이트

저장소를 최신 상태로 받은 뒤 설치 명령을 다시 실행하면 관리 중인 스킬이 v1.1.0으로 교체됩니다.

v0.10.0을 사용했다면 이전 설치를 먼저 제거합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.10.0/scripts/install.mjs \
  | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform both --scope global --version v0.10.0

node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

설치 스크립트는 설치 주체를 확인할 수 없거나 사용자가 수정한 기존 폴더를 강제로 지우지 않습니다.

## 개발 및 검증

하나의 원본에서 Codex와 Claude Code용 패키지를 생성합니다.

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

평가 세트에는 설명, 시각화, 대화형 학습, 독자에 맞춘 설명, 일반 작업 비개입, 패키징을 다루는 테스트 사례 23개와 자동 판정 45개가 있습니다.

## 참고한 원본

Socrates의 시각화 우선 방향은 공개된 Claude Community ELI5 플러그인을 참고했습니다. 원본은 큰 그림과 적은 글자의 HTML 아티팩트에 집중하며, Socrates는 여기에 질문 기반 얼라인먼트, 틀린 답 교정, 코드 근거 확인을 더합니다.

- [Claude Community ELI5 공개 코드](https://github.com/anthropics/claude-plugins-community/tree/main/eli5)

## 라이선스

MIT
