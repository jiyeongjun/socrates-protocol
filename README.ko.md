# Socrates Protocol

[English](./README.md)

모호함이나 구현 분기가 결과를 바꿀 때 개입하는 코딩 스킬.

---

## 개요

Socrates는 모호함이나 미결정 구현 분기가 구현을 실제로 바꿀 수 있는 작업을 위해 설계된 human-in-the-loop 코딩 스킬입니다.

이 스킬은 한 가지 규칙을 강제합니다.

> 진위를 판별할 수 있을 때만 추론한다.

모호함이 핵심적인 경우에는 요청을 명시적이고 테스트 가능한 작업 합의로 바꾼 뒤 구현합니다.
필수 아티팩트나 대상이 빠져 있으면, 코드베이스에서 찾을 수 있는 경우 먼저 회수하고 그렇지 않으면 분기 분석보다 그 입력을 먼저 묻습니다.
고위험 제약이 미결정이면 전략 질문보다 안전을 결정하는 질문을 먼저 던집니다.
요청 문장이 명확해 보여도 구현 경로가 여러 갈래로 유효하게 열려 있으면, 그 경로를 드러내고 사용자와 방향을 맞춘 뒤 구현합니다.
이미 요청이 명확하고 사실상 한 경로로 수렴하거나 표준 해법이 우세하면 절차를 늘리지 않고 바로 실행합니다.

재작업 비용이 명확화 비용보다 클 때 특히 유용합니다.

---

## 핵심 원칙

> 결정 가능한 명제에만 추론을 적용한다.  
> 문제가 결정 불가능하다면, 추론을 멈춘다.

---

## 왜 필요한가

엔지니어링에서 낭비되는 시간의 상당수는 다음에서 발생합니다.

- 정의되지 않은 개념을 두고 추론하는 일
- 판별 불가능한 질문을 두고 논쟁하는 일
- 증명할 수 없는 선택을 정당화하려는 일

Socrates는 이런 오버헤드를 줄여서 다음과 같은 효과를 얻도록 돕습니다.

- 요구사항 오해로 인한 재작업 감소
- 리뷰 단계에서 기준이 뒤늦게 바뀌는 문제 감소
- 구현 전 성공 기준 합의
- 중요한 변경에서 잘못된 가정으로 출발할 가능성 감소
- 이미 명확한 요청을 불필요한 절차 없이 바로 구현

---

## 하는 일

1. 요청이 이미 구현 가능한지 먼저 판단한다
2. 중요한 주장에 대해 다음 조건을 검증한다
   - 정의 가능성
   - 관측 가능성
   - 평가 가능성
   - 재현 가능성
   - 그리고 고위험 작업이라면 법적 의무, 감사 가능성, 롤백, 멱등성 같은 제약도 함께 본다
3. 중요한 지점 하나라도 실패하면
   - 추론을 멈춘다
   - 최소한의 명확화만 요청한다
4. 필수 아티팩트나 대상이 빠져 있으면
   - 코드베이스에서 찾을 수 있으면 먼저 회수한다
   - 그렇지 않으면 그 누락 입력만 먼저 묻는다
5. 필수 아티팩트와 고위험 제약이 정리된 뒤에도 유효한 구현 경로가 여러 개 남아 있으면
   - 핵심 분기와 트레이드오프를 드러낸다
   - 구현 방향이 맞춰질 때까지 질의를 이어간다
6. 여전히 핵심 모호함이 남아 있으면
   - 짧은 작업 합의를 만든다
7. 요청이 이미 명확하거나, 우세한 경로가 정해졌거나, 합의가 끝나면
   - 정확하게 실행한다

---

## 언제 써야 하나

다음 상황에서 Socrates를 사용합니다.

- 모호한 요구사항
- 아키텍처 결정
- API 설계
- 여러 구현 전략이 가능한 리팩터링이나 코드 수정
- 스키마 변경
- 리스크가 큰 변경

다음 같은 시그널이 있으면 더 엄격하게 봅니다.

- production 환경
- 실제 사용자 데이터
- 인증 또는 권한 경계
- 결제나 재무 흐름
- 마이그레이션이나 삭제
- 법적 또는 규제 의무

다음에는 사용하지 않습니다.

- 사소한 수정
- 포매팅
- 이미 명확하게 정의된 작업
- 누락된 입력 하나만 직접 물으면 바로 진행할 수 있는 작업

### Socrates가 막아주는 흔한 실패 패턴

- "깔끔하게", "좋게", "확장 가능하게" 같은 표현을 기준 없이 해석한 채 구현에 들어가는 경우
- 리뷰 단계에서 "내가 원한 건 그게 아니었다"가 뒤늦게 드러나는 경우
- 요구사항보다 가정을 먼저 굳혀서 큰 변경을 잘못된 방향으로 시작하는 경우
- 여러 타당한 구현 경로 중 하나를 에이전트가 임의로 골라 사용자 의도와 어긋나는 경우

---

## 설치

### Codex

어디서든 아래 커맨드를 그대로 복붙하세요.

```bash
mkdir -p ~/.codex/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o ~/.codex/skills/socrates/SKILL.md
mkdir -p ~/.codex/skills/socrates/agents
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o ~/.codex/skills/socrates/agents/openai.yaml
```

다른 리포지토리에 설치:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.agents/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o "$TARGET_REPO/.agents/skills/socrates/SKILL.md"
mkdir -p "$TARGET_REPO/.agents/skills/socrates/agents"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o "$TARGET_REPO/.agents/skills/socrates/agents/openai.yaml"
```

---

### Claude Code

어디서든 아래 커맨드를 그대로 복붙하세요.

```bash
mkdir -p ~/.claude/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o ~/.claude/skills/socrates/SKILL.md
```

다른 리포지토리에 설치:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.claude/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o "$TARGET_REPO/.claude/skills/socrates/SKILL.md"
```

---

## 사용법

### Codex

바로 복붙할 수 있는 프롬프트:

```text
$socrates 필수 아티팩트가 빠져 있으면 코드베이스에서 찾을 수 있는지 먼저 보고, 가능하면 회수하고 아니면 그걸 먼저 물어봐. 고위험 제약이 미결정이면 가장 안전을 좌우하는 질문을 먼저 해줘. 한 경로가 명확하거나 표준 해법이 우세하면 바로 구현해줘.
$socrates 필수 아티팩트와 고위험 제약이 정리된 뒤에도 여러 유효한 구현 분기가 남아 있으면 핵심 트레이드오프를 드러내고, 구현 방향이 맞을 때까지 질의를 이어가줘. 그렇지 않으면 바로 코드로 진행해줘.
```

축약 호출은 아래 패턴에 맞게 튜닝되어 있습니다.

- 명확한 요청: 바로 실행
- 필수 아티팩트 누락: 코드베이스에서 찾을 수 있으면 먼저 회수하고, 아니면 그 입력만 먼저 질문
- `elegant`, `good`, `clean` 같은 미정의 선호어: 먼저 핵심 질문 1개
- 고위험의 미결정 요청: 가장 안전을 좌우하는 질문부터 먼저, 보통 전체 1~3문 안에서 해결
- 여러 유효한 구현 분기: 필수 아티팩트와 고위험 제약이 정리된 뒤에만 분기를 드러냄

가장 명시적인 동작이 필요하면 위의 긴 프롬프트를 그대로 쓰는 편이 가장 안전합니다.

---

### Claude Code

최신 Claude Code 공식 문서 기준으로도 개인/프로젝트 스킬 위치는 `.claude/skills/<skill-name>/SKILL.md`가 맞습니다.
Anthropic은 이제 커스텀 명령을 skills에 통합해서 설명하므로, Socrates를 Claude Code에서 skill로 유지하는 방향은 여전히 맞습니다.
이 저장소는 Claude 쪽에서 `disable-model-invocation`을 두지 않아, 요청이 실제로 skill과 맞을 때 Claude가 Socrates를 자동 로드할 수 있게 해둡니다.
대신 `user-invocable: true`는 유지해서, 원하면 `/socrates`로 수동 호출도 계속 할 수 있습니다.
다시 수동 전용 워크플로로 되돌리고 싶다면 [`/.claude/skills/socrates/SKILL.md`](./.claude/skills/socrates/SKILL.md) 에 `disable-model-invocation: true`를 다시 넣으면 됩니다.
description 문구는 vague preference와 reliability-hardening 요청은 잡되, trivial formatting이나 이미 단일 경로인 작업은 자동으로 끌어오지 않도록 맞춰두었습니다.
Subagent는 별도의 격리된 전문 작업자용 기능이고, Socrates는 메인 대화의 질의/실행 방식을 바꾸는 성격이므로 skill로 두는 편이 맞습니다.

바로 복붙할 수 있는 프롬프트:

```text
/socrates 필수 아티팩트가 빠져 있으면 코드베이스에서 찾을 수 있는지 먼저 보고, 가능하면 회수하고 아니면 그걸 먼저 물어봐. 고위험 제약이 미결정이면 가장 안전을 좌우하는 질문을 먼저 해줘. 한 경로가 명확하거나 표준 해법이 우세하면 바로 구현해줘.
/socrates 필수 아티팩트와 고위험 제약이 정리된 뒤에도 여러 유효한 구현 분기가 남아 있으면 핵심 트레이드오프를 드러내고, 구현 방향이 맞을 때까지 질의를 이어가줘. 그렇지 않으면 바로 코드로 진행해줘.
```

축약 호출도 같은 패턴으로 튜닝되어 있습니다.

- 명확한 요청: 바로 실행
- 필수 아티팩트 누락: 코드베이스에서 찾을 수 있으면 먼저 회수하고, 아니면 그 입력만 먼저 질문
- `elegant`, `good`, `clean` 같은 미정의 선호어: 먼저 핵심 질문 1개
- 고위험의 미결정 요청: 가장 안전을 좌우하는 질문부터 먼저, 보통 전체 1~3문 안에서 해결
- 여러 유효한 구현 분기: 필수 아티팩트와 고위험 제약이 정리된 뒤에만 분기를 드러냄

Claude Code 시스템 프롬프트에 넣을 스니펫:

```text
중요한 코딩 작업에서는 Socrates 방식으로 동작해:
- 필수 아티팩트가 빠져 있으면 코드베이스에서 찾을 수 있는지 먼저 보고, 가능하면 회수하고 아니면 그 입력만 먼저 묻는다
- 요청이 이미 명확하고 검증 가능하며 사실상 한 구현 경로만 남아 있거나 표준 해법이 우세하면 바로 구현한다
- 모호해서 구현이 달라질 수 있는 부분이 있으면, 그 지점만 핵심 질문 1~3개로 확인한다
- 고위험 제약과 구현 분기가 동시에 열려 있으면, 가장 안전을 좌우하는 질문을 먼저 한다
- 여러 유효한 구현 경로가 남아 있으면, 필수 아티팩트와 고위험 제약이 정리된 뒤에만 핵심 트레이드오프를 드러내고 구현 방향이 맞을 때까지 후속 질문으로 계속 좁혀간다
- 핵심 모호함이 남아 있을 때만 짧은 작업 합의를 만든다
- 명확한 요청에 불필요한 절차를 추가하지 않는다
```

이 저장소의 Claude Code skill frontmatter:

```yaml
---
name: socrates
description: Use for ambiguous preference words, reliability-hardening changes, and high-impact coding or design work where ambiguity or unresolved implementation branches could change the implementation. Skip trivial, formatting-only, or already explicit single-path tasks.
user-invocable: true
allowed-tools: Read, Grep, Glob, Edit, Bash
---
```

---

## Socrates의 응답 방식

Socrates는 모호한 표현을 두고 추상적으로 논쟁하지 않습니다.
구현을 바꿀 수 있는 모호함이나 구현 분기만 드러내고, 이미 명확하며 사실상 한 경로로 수렴한 요청에는 절차를 덧붙이지 않습니다.
`elegant`, `good`, `clean` 같은 미정의 선호어는 구현을 실제로 바꿀 수 있다면 아직 미결정으로 취급합니다.
필수 아티팩트나 대상이 빠져 있으면, 코드베이스에서 찾을 수 있는 경우 먼저 회수하고 그렇지 않으면 분기 분석보다 그 입력을 먼저 묻습니다.
문장상 명확해 보여도 여러 구현 전략이 실제로 열려 있으면, Socrates는 그중 하나를 조용히 고르지 않고 사용자와 먼저 방향을 맞춥니다.
고위험 요청에서는 계약이나 분기 분석보다, 안전을 가장 크게 좌우하는 질문부터 먼저 묻는 쪽을 우선합니다.
여러 경로가 합리적으로 가능한 경우에도, 필수 아티팩트와 고위험 제약이 정리된 뒤에만 그중 가장 중요한 분기부터 드러내고 후속 질문으로 점차 합의점을 좁혀갑니다.
아래 예시는 설명용이며 고정 응답 템플릿이 아닙니다. 실제 질문은 요청에 맞게 달라져야 하고, 구현을 바꾸는 지점만 최소한으로 확인해야 합니다.

### 예시 1: "우아하게"의 뜻 정하기

사용자:

```text
이 함수를 우아하게 작성해줘
```

Socrates:

```text
"우아하게"는 구현 기준을 바꾸므로 먼저 정의가 필요합니다.
이 함수에서는 무엇을 우선하나요?
예: 간결함, 가독성, 관용적인 스타일, 성능, 또는 직접 정의한 기준
```

사용자:

```text
간결하고 읽기 쉬운 것
```

Socrates:

```text
좋습니다. "간결하고 읽기 쉬운 코드"를 기준으로 삼아 구현하겠습니다.
```

### 예시 2: "좋은 API"의 기준 정하기

사용자:

```text
좋은 API를 설계해줘
```

Socrates:

```text
"좋은"만으로는 아직 설계 기준이 부족합니다.
이 API에서 가장 중요한 속성은 무엇인가요?
예: 표면적이 작은 API, 확장성, 개발자 경험, 성능, 또는 직접 정의한 기준
```

### 예시 3: 이미 명확한 요청은 바로 실행하기

사용자:

```text
JavaScript로 `sum(numbers)` 함수를 작성해줘. 배열이 비어 있으면 0을 반환해야 해.
```

Socrates:

```text
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}
```

### 예시 4: 구현 방향 먼저 맞추기

사용자:

```text
이 API 클라이언트의 재시도를 더 안전하게 리팩터링해줘
```

Socrates:

```text
어떤 실패까지 재시도 대상으로 남겨야 하나요, 그리고 요청마다 idempotency key나 다른 고유 요청 ID가 이미 있나요?
그 제약이 정해지면 다음에 재시도 전략을 좁히겠습니다.
```

### 예시 5: 누락 입력 먼저 회수하기

사용자:

```text
이 파일을 Prettier로 포맷하고 import도 정렬해줘
```

Socrates:

```text
어느 파일을 포맷하면 되나요?
```

---

## 설계 원칙

- 결정 가능성 없는 추론 금지
- 가짜 정밀성 금지
- 불필요한 정당화 금지
- 질문은 최소로, 명확성은 최대로
- 명확한 요청은 바로 실행
- 핵심 모호함이 있을 때만 먼저 합의

---

## 철학

Socrates의 목적은 모든 작업에 절차를 추가하는 데 있지 않습니다.

핵심 모호함이 있는 경우에만 멈추고, 이미 명확한 요청에는 바로 실행하게 만드는 데 있습니다.

그 결과:

- 정의되지 않은 상태로 구현에 들어가는 일을 줄일 수 있습니다
- 사용자와 에이전트가 같은 표현을 다르게 이해한 상태를 구현 전에 드러내고 확인할 수 있습니다
- "왜 이렇게 만들었는가"를 나중에 설명하는 대신, 기준을 먼저 맞출 수 있습니다
- 고비용 변경일수록 추론보다 합의를 먼저 하게 만들어 실패 비용을 낮출 수 있습니다
