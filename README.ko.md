# Socrates Protocol

[English](./README.md)

모호함이 구현을 바꿀 때만 개입하는 코딩 스킬.

---

## 개요

Socrates는 모호함이 구현을 실제로 바꿀 수 있는 작업을 위해 설계된 human-in-the-loop 코딩 스킬입니다.

이 스킬은 한 가지 규칙을 강제합니다.

> 진위를 판별할 수 있을 때만 추론한다.

모호함이 핵심적인 경우에는 요청을 명시적이고 테스트 가능한 작업 합의로 바꾼 뒤 구현합니다.
이미 요청이 명확하면 절차를 늘리지 않고 바로 실행합니다.

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
4. 여전히 핵심 모호함이 남아 있으면
   - 짧은 작업 합의를 만든다
5. 요청이 이미 명확하거나 합의가 끝나면
   - 정확하게 실행한다

---

## 언제 써야 하나

다음 상황에서 Socrates를 사용합니다.

- 모호한 요구사항
- 아키텍처 결정
- API 설계
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
$socrates 이 요청이 구현을 바꿀 정도로 모호하면 핵심 질문만 최소한으로 해줘. 이미 명확하면 바로 구현해줘.
$socrates 핵심 모호함이 있을 때만 짧은 작업 합의를 만들고, 그렇지 않으면 바로 코드로 진행해줘.
```

---

### Claude Code

바로 복붙할 수 있는 프롬프트:

```text
/socrates 이 요청이 구현을 바꿀 정도로 모호하면 핵심 질문만 최소한으로 해줘. 이미 명확하면 바로 구현해줘.
/socrates 핵심 모호함이 있을 때만 짧은 작업 합의를 만들고, 그렇지 않으면 바로 코드로 진행해줘.
```

Claude Code 시스템 프롬프트에 넣을 스니펫:

```text
중요한 코딩 작업에서는 Socrates 방식으로 동작해:
- 요청이 이미 명확하고 검증 가능하면 바로 구현한다
- 모호해서 구현이 달라질 수 있는 부분이 있으면, 그 지점만 핵심 질문 1~3개로 확인한다
- 핵심 모호함이 남아 있을 때만 짧은 작업 합의를 만든다
- 명확한 요청에 불필요한 절차를 추가하지 않는다
```

---

## Socrates의 응답 방식

Socrates는 모호한 표현을 두고 추상적으로 논쟁하지 않습니다.
구현을 바꿀 수 있는 모호함만 드러내고, 이미 명확한 요청에는 절차를 덧붙이지 않습니다.
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
