# Socrates Protocol

[English](./README.md)

소프트웨어 개발을 위한 인지 자원 배분 프로토콜.

---

## 개요

Socrates는 영향도가 큰 작업을 위해 설계된 human-in-the-loop 코딩 스킬입니다.

이 스킬은 한 가지 규칙을 강제합니다.

> 진위를 판별할 수 있을 때만 추론한다.

코드를 작성하기 전에, 요청을 명시적이고 테스트 가능한 계약으로 바꿔 모호성을 제거합니다.

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

Socrates는 이런 오버헤드를 제거합니다.

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

---

## 설치

### Codex

리포지토리에 아래 경로로 배치합니다.

`.agents/skills/socrates/SKILL.md`

이 저장소에는 다음 메타 파일도 포함되어 있습니다.

`.agents/skills/socrates/openai.yaml`

---

### Claude Code

리포지토리에 아래 경로로 배치합니다.

`.claude/skills/socrates/SKILL.md`

또는 전역 설치:

`~/.claude/skills/socrates/`

---

## 사용법

### Codex

바로 복붙할 수 있는 프롬프트:

```text
$socrates Clarify this task before coding. Ask only the minimum questions that change implementation.
$socrates Convert my request into a short alignment contract, then implement against it.
```

---

### Claude Code

바로 복붙할 수 있는 프롬프트:

```text
/socrates Clarify this task before coding. Ask only the minimum questions that change implementation.
/socrates Convert my request into a short alignment contract, then implement against it.
```

Claude Code 시스템 프롬프트에 넣을 스니펫:

```text
Use Socrates behavior for important coding work:
- restate the request in implementation terms
- ask at most 1-3 load-bearing clarification questions when ambiguity would materially change implementation
- write a compact alignment contract
- only then implement
```

---

## Socrates의 응답 방식

Socrates는 모호한 품질 표현을 두고 추상적으로 논쟁하지 않습니다.
그 표현을 결정 가능한 기준으로 바꾼 다음 진행합니다.

### 예시 1: "elegant"를 정의하기

사용자:

```text
이 함수를 elegant하게 작성해줘
```

Socrates:

```text
여기서 "elegant"는 무엇을 의미하나요?
- concise
- readable
- idiomatic
- performance-oriented
- other (define)
```

사용자:

```text
concise and readable
```

Socrates:

```text
그 기준을 계약으로 삼아 concise하고 readable한 방향으로 구현을 진행합니다.
```

### 예시 2: "good"을 정의하기

사용자:

```text
좋은 API를 설계해줘
```

Socrates:

```text
여기서 "good"은 무엇을 뜻하나요?
- minimal surface area
- scalability
- developer experience
- performance
- other (define)
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

Socrates는 사고 엔진이 아닙니다.

경계입니다.

추론이 존재해서는 안 되는 곳에서 추론이 시작되지 않도록 막습니다.

---

## 한 줄 정의

> 자유롭게 생각하라.  
> 진위를 시험할 수 있을 때만 결정하라.
