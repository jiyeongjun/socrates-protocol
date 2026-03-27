# Socrates Protocol

[English](./README.md)

모호함, 리스크, 구현 분기가 결과를 실제로 바꿀 때 개입하는 코딩 스킬입니다.

## 하는 일

요청이 이미 명확하고 사실상 한 경로로 수렴하면 Socrates는 개입하지 않습니다.
질문이 실제 구현을 바꾸는 경우에만 개입합니다.

핵심 동작:

- 명확한 요청: 바로 실행
- 아티팩트나 대상 누락: 코드베이스에서 찾을 수 있으면 먼저 회수, 아니면 질문
- 고위험 미결정 작업: 가장 안전을 좌우하는 질문부터 먼저
- 여러 유효한 구현 분기: 핵심 트레이드오프를 드러내고 방향 합의 후 구현
- 호환성 민감 이름 변경: mechanical rename으로 처리하지 말고 migration strategy부터 확인

주로 이런 경우에 발동합니다:

- `elegant`, `clean`, `good`, `robust` 같은 미정의 선호어
- API, 스키마, 마이그레이션, 인증, 결제, 삭제, 프로덕션 변경
- 여러 materially different implementation이 가능한 요청
- env var, config key, public API, persisted field 이름 변경

## 설치

### Codex

전역 설치:

```bash
mkdir -p ~/.codex/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o ~/.codex/skills/socrates/SKILL.md
mkdir -p ~/.codex/skills/socrates/agents
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o ~/.codex/skills/socrates/agents/openai.yaml
```

리포지토리에 설치:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.agents/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/SKILL.md -o "$TARGET_REPO/.agents/skills/socrates/SKILL.md"
mkdir -p "$TARGET_REPO/.agents/skills/socrates/agents"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.agents/skills/socrates/agents/openai.yaml -o "$TARGET_REPO/.agents/skills/socrates/agents/openai.yaml"
```

### Claude Code

전역 설치:

```bash
mkdir -p ~/.claude/skills/socrates
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o ~/.claude/skills/socrates/SKILL.md
```

리포지토리에 설치:

```bash
TARGET_REPO=/absolute/path/to/your/repo
mkdir -p "$TARGET_REPO/.claude/skills/socrates"
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/main/.claude/skills/socrates/SKILL.md -o "$TARGET_REPO/.claude/skills/socrates/SKILL.md"
```

Claude 참고:

- 스킬 경로: `.claude/skills/<skill-name>/SKILL.md`
- 현재 버전은 `/socrates` 수동 호출과 relevant한 경우 auto-load를 둘 다 지원합니다

## 사용법

### Codex

최소 프롬프트:

```text
$socrates 필수 아티팩트가 빠져 있으면 코드베이스에서 찾을 수 있는지 먼저 보고, 가능하면 회수하고 아니면 그걸 먼저 물어봐. 고위험 제약이 미결정이면 가장 안전을 좌우하는 질문을 먼저 해줘. 이름 변경이 호환성 경계를 넘으면 migration strategy 질문 1개를 먼저 해줘. 한 경로가 명확하거나 우세하면 바로 구현해줘.
```

### Claude Code

최소 프롬프트:

```text
/socrates 필수 아티팩트가 빠져 있으면 코드베이스에서 찾을 수 있는지 먼저 보고, 가능하면 회수하고 아니면 그걸 먼저 물어봐. 고위험 제약이 미결정이면 가장 안전을 좌우하는 질문을 먼저 해줘. 이름 변경이 호환성 경계를 넘으면 migration strategy 질문 1개를 먼저 해줘. 한 경로가 명확하거나 우세하면 바로 구현해줘.
```

## 기대 동작

- `이 함수를 우아하게 리팩터링해줘`
  `우아하게`가 무엇을 뜻하는지 먼저 묻습니다.

- `이 API 클라이언트의 재시도를 더 안전하게 만들어줘`
  어떤 실패를 재시도할지, idempotency key가 있는지 먼저 묻습니다.

- `이 API에 pagination 추가해줘`
  cursor 기반인지 offset 기반인지 먼저 묻습니다.

- `리포지토리 전체에서 API_HOST를 API_BASE_URL로 바꿔줘`
  hard cutover인지 compatibility transition인지 먼저 묻습니다.

- `DB 스키마에서 customer_id를 account_id로 바꿔줘`
  single cutover인지 expand-contract migration인지 먼저 묻습니다.

- `빈 배열이면 0을 반환하는 sum(numbers) 함수를 작성해줘`
  바로 구현합니다.
