import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOpenAIYaml,
  buildSkillDocument,
  readAgentPromptSource,
  readSkillBody,
  skillTargets,
} from "../reference/skill-generator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("package metadata declares the current version and Node runtime floor", async () => {
  const pkg = JSON.parse(await readRepoFile("package.json"));

  assert.equal(pkg.version, "0.2.0");
  assert.equal(pkg.license, "MIT");
  assert.deepEqual(pkg.engines, { node: ">=24" });
});

test("README documents shared context lifecycle and quick install", async () => {
  const readme = await readRepoFile("README.md");

  assert.match(readme, /^## Quick Install/m);
  assert.match(readme, /^## How Shared Context Works/m);
  assert.match(readme, /github\/v\/tag\/jiyeongjun\/socrates-protocol/);
  assert.match(readme, /Explicit invocation example:/);
  assert.match(readme, /Auto-load example:/);
  assert.match(readme, /SOCRATES_CONTEXT\.md/);
  assert.match(readme, /VERSION=v0\.2\.0/);
  assert.match(readme, /current tagged version: `v0\.2\.0`/i);
  assert.match(readme, /automatically deletes `SOCRATES_CONTEXT\.md`/);
  assert.match(readme, /If you decline twice/);
  assert.match(readme, /already exists for the same task, Socrates reads it first/);
  assert.match(readme, /implicit invocation when the host supports it/);
  assert.match(readme, /not a task manager/i);
  assert.match(readme, /canonical machine-readable state/);
  assert.match(readme, /may be regenerated/);
  assert.match(readme, /drift out of sync with frontmatter/);
  assert.match(readme, /version: 1/);
  assert.match(readme, /Node `24\+`/);
});

test("Korean README documents shared context lifecycle", async () => {
  const readme = await readRepoFile("README.ko.md");

  assert.match(readme, /^## 빠른 설치/m);
  assert.match(readme, /^## 공유 맥락 문서 동작 방식/m);
  assert.match(readme, /github\/v\/tag\/jiyeongjun\/socrates-protocol/);
  assert.match(readme, /명시적 호출 예시:/);
  assert.match(readme, /자동 개입 예시:/);
  assert.match(readme, /SOCRATES_CONTEXT\.md/);
  assert.match(readme, /VERSION=v0\.2\.0/);
  assert.match(readme, /현재 태그 버전은 `v0\.2\.0`입니다/);
  assert.match(readme, /성공적으로 끝나면.*자동으로 삭제/);
  assert.match(readme, /두 번 연속 거부/);
  assert.match(readme, /같은 작업을 가리키는 `SOCRATES_CONTEXT\.md`가 이미 있으면 먼저 읽고 계속 갱신합니다/);
  assert.match(readme, /implicit invocation을 켜 둡니다/);
  assert.match(readme, /task manager가 아니라/);
  assert.match(readme, /canonical machine-readable state/);
  assert.match(readme, /다시 생성될 수 있습니다/);
  assert.match(readme, /body 섹션이 frontmatter와 어긋나면/);
  assert.match(readme, /version: 1/);
  assert.match(readme, /Node `24\+`/);
});

test("Codex and Claude skills are generated from the shared skill body source", async () => {
  const body = await readSkillBody();
  const codex = await readRepoFile(".agents/skills/socrates/SKILL.md");
  const claude = await readRepoFile(".claude/skills/socrates/SKILL.md");

  assert.equal(
    codex,
    buildSkillDocument({
      frontmatter: skillTargets.codex.frontmatter,
      body,
    })
  );
  assert.equal(
    claude,
    buildSkillDocument({
      frontmatter: skillTargets.claude.frontmatter,
      body,
    })
  );
});

test("OpenAI agent prompt stays aligned with the shared context lifecycle", async () => {
  const promptSource = await readAgentPromptSource();
  const prompt = await readRepoFile(".agents/skills/socrates/agents/openai.yaml");

  assert.equal(
    prompt,
    buildOpenAIYaml({
      promptSource,
    })
  );
  assert.match(prompt, /allow_implicit_invocation: true/);
  assert.match(prompt, /already exists for the same task, read it first/);
  assert.match(prompt, /Use exactly these frontmatter fields:/);
  assert.match(prompt, /version: 1/);
  assert.match(prompt, /status` \(`clarifying` \| `ready` \| `executing`\)/);
  assert.match(prompt, /Use exactly these body sections in this order:/);
  assert.match(prompt, /What Socrates Knows/);
  assert.match(prompt, /standard generated shape, not arbitrary YAML/);
});
