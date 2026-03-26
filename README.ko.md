# Socrates Protocol

[English](./README.md)

소프트웨어 개발을 위한 인지 자원 배분 프로토콜.

---

## 개요

Socrates는 영향도가 큰 작업을 위해 설계된 human-in-the-loop 코딩 스킬입니다.

이 스킬은 한 가지 규칙을 강제합니다.

> 진위를 판별할 수 있을 때만 추론한다.

코드를 작성하기 전에, 요청을 명시적이고 테스트 가능한 계약으로 바꿔 모호성을 제거합니다.

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

Socrates는 이런 오버헤드를 줄여서 다음을 얻도록 돕습니다.

- 요구사항 오해로 인한 재작업 감소
- 리뷰 단계에서 뒤늦게 기준이 바뀌는 문제 감소
- 구현 전에 성공 기준을 분명히 합의
- 중요한 변경에서 잘못된 가정으로 출발할 가능성 감소

---

## 하는 일

1. 요청을 명시적인 명제로 변환한다
2. 다음 조건을 검증한다
   - 정의 가능성
   - 관측 가능성
   - 평가 가능성
   - 재현 가능성
3. 하나라도 실패하면
   - 추론을 멈춘다
   - 최소한의 명확화만 요청한다
4. 정렬이 끝나면
   - 정확하게 실행한다

---

## 언제 써야 하나

다음 상황에서 Socrates를 사용합니다.

- 모호한 요구사항
- 아키텍처 결정
- API 설계
- 스키마 변경
- 리스크가 큰 변경

다음에는 사용하지 않습니다.

- 사소한 수정
- 포매팅
- 이미 명확하게 정의된 작업

### Socrates가 막아주는 대표적인 실패 패턴

- "깔끔하게", "좋게", "확장 가능하게" 같은 표현을 기준 없이 해석한 채 구현에 들어가는 경우
- 리뷰 단계에서 "내가 원한 건 그게 아니었다"가 뒤늦게 드러나는 경우
- 요구사항보다 가정을 먼저 굳혀서 큰 변경을 잘못된 방향으로 시작하는 경우

---

## 설치

### Codex

이 저장소 루트에서 아래 둘 중 하나를 그대로 복붙하세요.

```bash
mkdir -p ~/.codex/skills/socrates
cp .agents/skills/socrates/SKILL.md ~/.codex/skills/socrates/SKILL.md
mkdir -p ~/.codex/skills/socrates/agents
cp .agents/skills/socrates/agents/openai.yaml ~/.codex/skills/socrates/agents/openai.yaml
```

다른 리포지토리에 설치:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.agents/skills/socrates"
cp .agents/skills/socrates/SKILL.md "$TARGET_REPO/.agents/skills/socrates/SKILL.md"
mkdir -p "$TARGET_REPO/.agents/skills/socrates/agents"
cp .agents/skills/socrates/agents/openai.yaml "$TARGET_REPO/.agents/skills/socrates/agents/openai.yaml"
```

---

### Claude Code

이 저장소 루트에서 아래 둘 중 하나를 그대로 복붙하세요.

```bash
mkdir -p ~/.claude/skills/socrates
cp .claude/skills/socrates/SKILL.md ~/.claude/skills/socrates/SKILL.md
```

다른 리포지토리에 설치:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.claude/skills/socrates"
cp .claude/skills/socrates/SKILL.md "$TARGET_REPO/.claude/skills/socrates/SKILL.md"
```

---

## 사용법

### Codex

바로 복붙할 수 있는 프롬프트:

```text
$socrates 코드 작성에 들어가기 전에 이 요청부터 분명하게 정리해줘. 구현이 달라질 수 있는 부분만 최소한으로 확인해줘.
$socrates 내 요청을 짧은 작업 합의로 정리한 다음, 그 기준에 맞춰 구현해줘.
```

---

### Claude Code

바로 복붙할 수 있는 프롬프트:

```text
/socrates 코드 작성에 들어가기 전에 이 요청부터 분명하게 정리해줘. 구현이 달라질 수 있는 부분만 최소한으로 확인해줘.
/socrates 내 요청을 짧은 작업 합의로 정리한 다음, 그 기준에 맞춰 구현해줘.
```

Claude Code 시스템 프롬프트에 넣을 스니펫:

```text
중요한 코딩 작업에서는 Socrates 방식으로 동작해:
- 먼저 요청을 구현 가능한 형태로 다시 정리한다
- 모호해서 구현이 달라질 수 있는 부분이 있으면, 그 지점만 핵심 질문 1~3개로 확인한다
- 짧고 분명한 작업 합의를 만든다
- 합의가 서기 전에는 구현하지 않는다
```

---

## Socrates의 응답 방식

Socrates는 모호한 품질 표현을 두고 추상적으로 논쟁하지 않습니다.
그 표현을 결정 가능한 기준으로 바꾼 다음 진행합니다.

### 예시 1: "elegant"를 정의하기

사용자:

```text
이 함수를 우아하게 작성해줘
```

Socrates:

```text
여기서 "우아하게"는 무엇을 의미하나요?
- 간결함
- 가독성
- 관용적인 스타일
- 성능 중심
- 기타 (직접 정의)
```

사용자:

```text
간결하고 읽기 쉬운 것
```

Socrates:

```text
좋습니다. "간결하고 읽기 쉬운 코드"를 기준으로 삼아 구현하겠습니다.
```

### 예시 2: "good"을 정의하기

사용자:

```text
좋은 API를 설계해줘
```

Socrates:

```text
여기서 "좋은"은 무엇을 뜻하나요?
- 표면적이 작은 API
- 확장성
- 개발자 경험
- 성능
- 기타 (직접 정의)
```

---

## 설계 원칙

- 결정 가능성 없는 추론 금지
- 가짜 정밀성 금지
- 불필요한 정당화 금지
- 질문은 최소로, 명확성은 최대로
- 정렬 이후 실행

---

## 철학

Socrates의 목적은 더 많이 생각하게 만드는 것이 아닙니다.

생각해야 할 곳과 멈춰야 할 곳을 분리하는 것입니다.

그 결과:

- 정의되지 않은 상태로 구현에 들어가는 일을 줄일 수 있습니다
- 팀이 같은 말을 다른 뜻으로 이해한 채 진행하는 일을 줄일 수 있습니다
- "왜 이렇게 만들었는가"를 나중에 설명하는 대신, 기준을 먼저 맞출 수 있습니다
- 고비용 변경일수록 추론보다 합의를 먼저 하게 만들어 실패 비용을 낮출 수 있습니다

---

## 한 줄 정의

> 자유롭게 생각하라.  
> 진위를 시험할 수 있을 때만 결정하라.
