# Socrates

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](./package.json)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[English](./README.md)

Socrates는 Codex와 Claude Code에서 다음 네 가지 상황에 쓰는 스킬입니다. 개념을 설명받을 때, 문답으로 배울 때, 내 이해가 맞는지 점검할 때, 다른 사람에게 전달할 설명을 만들 때 사용합니다.

요청을 보고 필요한 방식을 스스로 고릅니다. 일반적인 설명 요청에는 완결된 답을 주며 갑자기 퀴즈를 시작하지 않습니다. “소크라테스식으로 가르쳐줘”, “퀴즈로 확인해줘”처럼 대화형 학습을 명시했을 때만 질문을 이어갑니다.

## 언제 쓰는가

| 원하는 결과 | 이렇게 요청 | Socrates의 동작 |
|---|---|---|
| 개념을 빠르게 이해 | `$socrates 데이터베이스 인덱스를 백엔드 입문자에게 간단히 설명해줘.` | 핵심 원리, 적절한 예시나 시각화, 중요한 주의점까지 설명하고 끝냅니다. 퀴즈를 덧붙이지 않습니다. |
| 대화하며 학습 | `$socrates 재귀를 소크라테스식으로 가르쳐줘. 함수는 알지만 콜스택은 몰라.` | 한 번에 하나의 학습 목표를 다루고 핵심 질문 하나만 묻습니다. |
| 내 이해를 점검 | `$socrates 내가 이해한 eventual consistency는 이래. 틀리거나 빠진 연결고리를 찾아줘: ...` | 맞는 부분과 부족하거나 잘못된 부분을 구분한 뒤 필요한 설명을 보충합니다. |
| 다른 사람에게 설명 | `$socrates 이 API rate limit 문제를 매니저에게 보낼 짧은 글로 만들어줘.` | 글쓰기 수업을 시작하지 않고 상대에게 바로 보낼 완성본을 작성합니다. |

코드 수정, 테스트 실행, 리팩터링 같은 일반 작업은 평소처럼 에이전트에게 요청하면 됩니다. 이해·학습·이해도 점검·대상별 설명이 작업의 목적일 때 Socrates를 사용합니다.

## 요청을 어떻게 해석하는가

- **설명** — “설명해줘”, “ELI5”, “왜”, “어떻게” 같은 요청에는 질문 없이 완결된 설명을 제공합니다. 사용자가 대화형 학습이나 이해도 확인을 명시하지 않으면 후속 질문을 붙이지 않습니다.
- **가이드 학습** — “소크라테스식으로 가르쳐줘”, “퀴즈로 확인해줘”, “단계별로 같이 해보자”는 문답식 학습으로 진행합니다.
- **이해 검토** — 사용자가 답이나 정신 모형을 제시하면 새 개념을 덧붙이기 전에 현재 이해부터 진단합니다.
- **전달물** — “매니저·아이·팀에게 설명해줘”라는 요청에는 그 대상이 그대로 읽을 수 있는 완성본을 만듭니다.

어휘와 깊이는 사용자의 목표, 선행지식, 언어, 형식을 우선해 조절합니다. 나이·직군 같은 인구통계만으로 관심사나 지적 수준을 추정하지 않으며, 쉽게 설명하더라도 틀린 규칙을 만들지 않습니다.

## 시각화는 언제 쓰는가

순서, 비교, 계층, 공간 관계, 상태 변화가 글만으로는 잘 보이지 않을 때 시각화를 사용합니다. 가장 작은 유효한 형식부터 고릅니다.

- 비교표
- 짧은 흐름도·타임라인·트리
- 사용 중인 호스트가 지원하고 상호작용이 실제로 도움이 될 때 더 풍부한 시각화 기능

단순한 사실에 장식용 그림을 붙이지 않습니다. 시각화의 각 요소는 실제 개념과 연결해 설명하고, 비유를 사용하면 어디부터 현실과 맞지 않는지도 밝힙니다.

## 틀린 답을 하면 어떻게 되는가

가이드 학습에서는 현재 개념을 이해했다는 근거가 답에 나타나야 다음 단계로 진행합니다.

| 사용자의 답 | 다음 동작 |
|---|---|
| 정확함 | 무엇이 정확한 이해를 보여주는지 짚고 다음 목표로 진행 |
| 부분적으로 정확함 | 맞는 부분은 살리고 빠진 연결고리를 좁혀 같은 목표를 다시 질문 |
| 오개념 | 어긋난 지점을 바로잡고 예시나 표현 방식을 바꾼 뒤 다음 단계로 넘어가지 않고 같은 개념을 재확인 |
| 모름 또는 무응답 | 구체적 사례, 제한된 선택지, 첫 단계 시범으로 난이도를 낮추고 같은 목표를 재확인 |

틀린 뒤 같은 질문을 그대로 반복하지 않습니다. 지원 방식은 바꾸되 현재 목표에는 머뭅니다. 사용자가 답을 바로 알려 달라고 하면 문답을 멈추고 직접 설명합니다.

## 실제 답변 테스트

아래 결과는 2026-08-24에 생성된 v1 스킬을 Codex와 Claude의 새 세션에서 직접 실행해 얻었습니다. 정해진 문장을 재생하는 방식이 아니므로 실행할 때마다 표현은 달라질 수 있습니다.

| 호스트 | 테스트 상황 | 실제 결과 |
|---|---|---|
| Codex | 데이터베이스 인덱스 일반 설명 | 통과 — 책 색인 비유와 흐름·비교표를 사용하고 후속 질문 없이 종료 |
| Claude | 데이터베이스 인덱스 일반 설명 | 통과 — B+tree 그림과 비교표를 사용하고 후속 질문 없이 종료 |
| Codex | 캐시 freshness 오개념 | 통과 — 오개념을 수정하고 같은 목표에 머물며 질문 하나로 재확인 |
| Claude | 캐시 freshness 오개념 | 통과 — 종이 메뉴판 비유로 표현을 바꾸고 같은 목표를 질문 하나로 재확인 |

<details>
<summary>실제 일반 설명 발췌 — Codex</summary>

요청:

```text
$socrates 데이터베이스 인덱스를 백엔드 입문자에게 설명해줘.
```

응답에서 핵심 부분을 그대로 발췌했습니다.

> 데이터베이스 인덱스는 **테이블의 모든 행을 확인하지 않고 원하는 데이터를 빠르게 찾도록 만든 별도의 정렬된 찾아보기 구조**입니다.
>
> 500쪽짜리 책에서 “트랜잭션”이라는 단어를 찾는다고 해봅시다.
>
> - 색인이 없으면 1쪽부터 전부 읽어야 합니다.
> - 색인이 있으면 색인에서 “트랜잭션 → 120쪽”을 찾고 바로 이동합니다.

```text
email 인덱스에서 값 검색
        ↓
해당 행의 위치 확인
        ↓
users 테이블에서 실제 데이터 조회
```

| 장점 | 비용 |
|---|---|
| `SELECT`가 빨라질 수 있음 | 저장 공간을 추가로 사용함 |
| 검색·정렬 범위를 줄임 | `INSERT`할 때 인덱스도 추가해야 함 |
| 일부 `JOIN`이 빨라짐 | 인덱스 컬럼을 `UPDATE`하면 인덱스도 수정해야 함 |

> 핵심은 이것입니다: **인덱스는 읽을 때 탐색 범위를 줄이는 대신, 저장 공간과 쓰기 성능을 지불하는 자료구조입니다.**

</details>

<details>
<summary>실제 일반 설명 발췌 — Claude</summary>

요청:

```text
/socrates 데이터베이스 인덱스를 백엔드 입문자에게 설명해줘.
```

응답에서 핵심 부분을 그대로 발췌했습니다.

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
<summary>실제 오개념 교정 응답 — Codex</summary>

요청:

```text
$socrates 캐시가 원본 데이터의 변경을 어떻게 아는지 배우고 있어.
네가 “캐시는 자기 복사본이 오래됐는지 어떻게 알까?”라고 물었고,
내가 “원본을 계속 보고 있어서 자동으로 알아”라고 답했어. 이어서 가르쳐줘.
```

전체 응답:

> 방향은 일부 맞아. 캐시는 원본 변화와 연결되는 정보가 필요해. 하지만 보통 원본을 계속 감시하며 자동으로 아는 것은 아니야. 알림, 만료 시간(TTL), 원본 재확인 같은 장치가 있어야 해.
>
> 원본 값이 `A`에서 `B`로 바뀌었는데, 캐시는 알림도 못 받았고 만료되지도 않았으며 원본에 다시 묻지도 않았어.
>
> 이때 캐시는 `A`와 `B` 중 어떤 값을 돌려줄까?

</details>

<details>
<summary>실제 오개념 교정 응답 발췌 — Claude</summary>

같은 캐시 오개념 요청에 대한 응답에서 그대로 발췌했습니다.

> "원본을 계속 보고 있다"는 부분이 핵심 오해야. 그리고 이건 그냥 틀린 게 아니라, **캐시가 존재하는 이유 자체와 모순**돼.
>
> **주머니 속 종이 메뉴판**을 떠올려봐. 가게에서 아메리카노 가격을 4,000원 → 4,500원으로 올렸어. 네 주머니 속 종이는 그 순간 뭘 할까? 아무것도 안 해. 종이는 가게를 볼 수 없어. 그냥 4,000원이라고 적힌 채 조용히 틀린 정보가 돼.
>
> 캐시도 똑같아. 복사본은 **수동적**이야. 스스로 낡음을 감지하는 능력이 없어.
>
> 다시 물어볼게 (같은 지점이야). 주머니 속 종이 메뉴판이 스스로 가게를 볼 수 없다면 — 그런데도 네가 "이 종이는 이제 못 믿겠다"는 걸 알게 되는 경로가 있을 거야. 그중 **하나만** 구체적으로 말해봐. 누가/무엇이 움직여서 네가 알게 되는 거야?

</details>

## 호출 방법

| 호스트 | 명시적 호출 |
|---|---|
| Codex | `$socrates <요청>` |
| Claude Code | `/socrates <요청>` |

명시적인 설명·학습·퀴즈·teach-back·대상별 변환·이해 검토 요청에는 자동으로 선택될 수도 있습니다. 평범한 작업에 짧은 설명이 포함된다는 이유만으로는 활성화되지 않습니다.

## 현재 checkout에서 설치

요구 사항은 Node.js 22 이상과 Codex 또는 Claude Code입니다.

현재 사용자에게 설치:

```bash
node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

한 호스트에만 설치:

```bash
node scripts/install.mjs --mode install --platform codex --scope global --source-root "$PWD"
node scripts/install.mjs --mode install --platform claude --scope global --source-root "$PWD"
```

특정 저장소에 설치:

```bash
node scripts/install.mjs --mode install --platform both --scope repo --target-repo /absolute/path/to/repo --source-root "$PWD"
```

v1 삭제:

```bash
node scripts/install.mjs --mode uninstall --platform both --scope global --source-root "$PWD"
```

| 호스트 | 사용자 범위 | 저장소 범위 |
|---|---|---|
| Codex | `$HOME/.agents/skills/socrates` | `.agents/skills/socrates` |
| Claude Code | `$HOME/.claude/skills/socrates` | `.claude/skills/socrates` |

사용자 지정 `CODEX_HOME`이 명시되어 있거나 기존 Codex 스킬 복사본이 발견되면 `$CODEX_HOME/skills/socrates`도 호환 경로로 함께 관리합니다.

## 0.10.x에서 업그레이드

1.0.0은 이전 `socrates-contract` 위험 변경 조정 제품을 대체합니다. contract scaffolder와 native role agent는 v1에 포함되지 않습니다. 기존 v0.10.0 설치는 원래 installer로 제거한 뒤 v1을 설치합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.10.0/scripts/install.mjs \
  | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform both --scope global --version v0.10.0

node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

v1 installer는 소유권을 검증할 수 없거나 사용자가 수정한 legacy directory를 재귀 삭제하지 않습니다.

## 패키지와 검증

하나의 공용 원본에서 두 호스트 패키지를 생성합니다.

```text
reference/skill-body.md
reference/skill-references/
        │
        ├── .agents/skills/socrates/   # Codex + agents/openai.yaml
        └── .claude/skills/socrates/   # Claude Code
```

설치 패키지는 공용 `SKILL.md` 하나, 조건부 reference 두 개, Codex UI metadata로 구성됩니다. 실행 파일, model-policy sidecar, contract 상태, 필수 subagent workflow는 없습니다.

결정적 검사:

```bash
npm run build:skills
npm run verify:skills
npm run verify:release-assets
npm run test:evals
npm test
```

평가 카탈로그는 설명, 가이드 학습, 대상 보정, 비간섭, 패키징의 21개 case와 38개 정적 판정으로 구성됩니다. 선택적 격리 live eval:

```bash
SOCRATES_LIVE_EVAL=1 \
SOCRATES_LIVE_EVAL_HOST=claude \
SOCRATES_LIVE_EVAL_ARMS=skill,control \
SOCRATES_LIVE_EVAL_CASES=guided-cache-misconception,guided-cache-correct \
npm run eval:live
```

Codex에서는 `SOCRATES_LIVE_EVAL_HOST=codex`를 사용합니다. 모델 출력은 비결정적이므로 regex grader와 기록된 예시는 의미 정확성의 보조 증거입니다.

## 라이선스

MIT
