# Socrates

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](./package.json)
[![CI](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/jiyeongjun/socrates-protocol/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[English](./README.md)

Socrates는 Codex와 Claude Code에서 사용하는 학습·설명 스킬입니다. 대상에 맞춘 설명과 소크라테스식 문답, mastery gate를 결합합니다. 학습자의 답이 틀렸거나 불완전하면 다음 단계로 넘어가지 않고 현재의 잘못된 정신 모형을 바로잡은 뒤 같은 개념을 다시 확인합니다.

[DreambigOu/ELI5](https://github.com/dreambigou/eli5)의 쉬운 대상별 설명 방식에서 영감을 받았지만, 중심 목표를 “더 쉽게 말하기”에서 “정확한 정신 모형을 만들고 실제로 이해했는지 확인하기”로 옮겼습니다.

## 무엇을 하는가

Socrates는 요청에 맞는 가장 덜 방해되는 상호작용을 고릅니다.

- **설명**: 사용자의 수준에 맞춰 어휘·깊이·예시·주의점을 조절하고 먼저 답합니다.
- **전달물**: 특정 대상에게 보낼 완성된 설명을 작성합니다. 원래 사용자를 상대로 수업을 시작하지 않습니다.
- **가이드 학습**: 한 번에 하나의 학습 목표와 하나의 핵심 질문으로 진행합니다.
- **이해 검토**: 사용자가 제시한 답이나 정신 모형을 먼저 진단한 다음 필요한 내용을 보충합니다.

모든 설명을 퀴즈로 만들지 않습니다. 직접적인 질문에는 먼저 답하고, 전달물은 그대로 전달물로 완성하며, 사용자는 언제든 문답식 학습을 중단할 수 있습니다.

## Mastery gate

가이드 학습에서는 자신감이나 특정 키워드가 아니라 실제로 드러난 이해를 기준으로 진도를 결정합니다.

| 사용자의 답 | Socrates의 다음 행동 |
|---|---|
| 정확함 | 무엇이 정확한 이해를 보여주는지 짚고 다음 목표로 진행 |
| 부분적으로 정확함 | 맞는 부분은 살리고 빠진 연결고리를 좁혀 같은 목표를 다시 질문 |
| 오개념 | 어긋난 지점을 설명하고 비유·예시·표현 방식을 바꾼 뒤 같은 목표를 다시 확인 |
| 모름 또는 무응답 | 구체적 예시, 선택지, 첫 단계 시범으로 난이도를 낮추고 같은 목표를 재확인 |

틀린 뒤 같은 질문을 그대로 반복하지 않습니다. 예시, 표현 방식, 난이도를 바꿉니다. 사용자가 답을 바로 알려 달라고 하거나 퀴즈를 그만하고 싶어 하면 정보를 볼모로 잡지 않고 직접 설명합니다.

## 더 나은 대상 보정

우선순위는 사용자의 목표, 선행지식, 맥락, 원하는 깊이, 언어, 형식입니다. 나이·학년·직군은 어휘와 관점을 고르는 단서일 수 있지만, 인지 능력·관심사·가족 상태·경제 상황·기술 수준을 인구통계만으로 추정하지 않습니다.

단순화하더라도 틀린 규칙을 만들지 않습니다. 근사 설명은 근사임을 밝히고, 비유를 쓰면 실제 개념의 각 요소와 대응시킨 뒤 어디부터 맞지 않는지도 설명합니다.

## 사용 예시

Codex:

```text
$socrates 재귀를 소크라테스식으로 가르쳐줘. 함수는 알지만 콜스택은 몰라.
$socrates 데이터베이스 인덱스를 ELI5로 설명해줘. 퀴즈는 하지 마.
$socrates 내가 설명한 eventual consistency에서 빠진 연결고리를 찾아줘.
```

Claude Code:

```text
/socrates 재귀를 소크라테스식으로 가르쳐줘. 함수는 알지만 콜스택은 몰라.
/socrates 이 API rate limit 문제를 매니저에게 설명해줘.
/socrates transaction isolation을 한 번에 한 개념씩 퀴즈로 확인해줘.
```

명시적인 학습·설명·ELI5·대상별 변환·퀴즈·teach-back·이해 검토 요청에는 자동으로 선택될 수 있습니다. 평범한 코딩 작업에 짧은 설명이 필요하다는 이유만으로는 활성화되지 않습니다.

## 현재 checkout에서 설치

요구 사항:

- Node.js 22 이상
- Codex, Claude Code 또는 둘 다

현재 사용자에게 설치:

```bash
node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

한 host에만 설치:

```bash
node scripts/install.mjs --mode install --platform codex --scope global --source-root "$PWD"
node scripts/install.mjs --mode install --platform claude --scope global --source-root "$PWD"
```

특정 저장소에 설치:

```bash
node scripts/install.mjs --mode install --platform both --scope repo --target-repo /absolute/path/to/repo --source-root "$PWD"
```

v1 스킬 삭제:

```bash
node scripts/install.mjs --mode uninstall --platform both --scope global --source-root "$PWD"
```

설치 위치:

| Host | 사용자 범위 | 저장소 범위 | 명시적 호출 |
|---|---|---|---|
| Codex | `$HOME/.agents/skills/socrates` | `.agents/skills/socrates` | `$socrates` |
| Claude Code | `$HOME/.claude/skills/socrates` | `.claude/skills/socrates` | `/socrates` |

사용자 지정 `CODEX_HOME`이 명시되어 있거나 기존 Codex skill copy가 발견되면 canonical `$HOME/.agents/skills/socrates`와 함께 `$CODEX_HOME/skills/socrates` 호환 copy도 관리합니다.

## 0.10.x에서 업그레이드

1.0.0은 제품 방향이 바뀐 breaking release입니다. 이전 `socrates-contract` 위험 변경 조정 스킬, contract scaffolder, native role agent는 v1 스킬 패키지에 포함되지 않습니다. 기존 0.10.0 설치는 해당 버전의 installer로 제거한 뒤 v1을 설치합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/jiyeongjun/socrates-protocol/v0.10.0/scripts/install.mjs \
  | SOCRATES_INSTALL_RUN=1 node --input-type=module - --mode uninstall --platform both --scope global --version v0.10.0

node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"
```

v1 installer는 소유권을 검증할 수 없거나 사용자가 수정한 legacy directory를 재귀 삭제하지 않습니다. 이전 경로를 근거 없이 installer 소유라고 가정하지 않기 위해서입니다.

## 패키지 구조

공용 원본은 `reference/` 아래에 있고 두 host 패키지를 생성합니다.

```text
reference/skill-body.md
reference/skill-references/
        │
        ├── .agents/skills/socrates/   # Codex + agents/openai.yaml
        └── .claude/skills/socrates/   # Claude Code
```

설치되는 스킬은 의도적으로 작습니다. 공용 `SKILL.md` 하나, 조건부 reference 두 개, Codex UI metadata만 들어갑니다. 실행 script, model-policy sidecar, contract 상태, 필수 subagent workflow는 없습니다.

Installer는 기존 저장소의 방어적인 transaction 설계를 유지합니다. 전체 source 선로딩, path·symlink 검증, private ownership record, sibling staging, atomic publish, rollback, 중단 transaction 복구, 변경된 asset 삭제 거부, 소유권 기반 uninstall을 적용합니다.

## 평가

평가 카탈로그는 설명, 가이드 학습, 대상 보정, 비간섭, 패키징의 21개 case로 구성됩니다. 핵심 진도 테스트는 오개념, 부분정답, 정답, 모름, 같은 질문 반복 실패, 사용자의 퀴즈 중단 요청을 서로 구분합니다.

결정적 저장소 검증:

```bash
npm run build:skills
npm run verify:skills
npm run verify:release-assets
npm run test:evals
npm test
```

정적 검사는 패키지 구조와 선언된 행동 불변식을 검증할 뿐 모델 행동을 증명하지 않습니다. 선택적인 live eval은 격리된 read-only 환경에서 skill/control cohort를 실행합니다.

```bash
SOCRATES_LIVE_EVAL=1 \
SOCRATES_LIVE_EVAL_HOST=claude \
SOCRATES_LIVE_EVAL_ARMS=skill,control \
SOCRATES_LIVE_EVAL_CASES=guided-cache-misconception,guided-cache-correct \
npm run eval:live
```

Codex에서는 `SOCRATES_LIVE_EVAL_HOST=codex`를 사용합니다. arm이나 case를 늘릴 때마다 모델 호출이 추가될 수 있습니다. 모델 출력은 비결정적이고 결정적 regex rubric은 의미 판정의 근사치이므로 report는 참고 증거입니다.

## 라이선스

MIT
