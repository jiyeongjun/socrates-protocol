import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildSkillDocument,
  claudeAgentNames,
  claudeAgentTargets,
  modelPolicyTargetPaths,
  readAgentPromptSource,
  readClaudeAgentSource,
  readModelPolicySource,
  readSkillBody,
  readSkillReferenceSource,
  skillReferenceNames,
  skillReferenceTargets,
  skillTargets,
} from "../reference/skill-generator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("package metadata declares the current version and Node runtime floor", async () => {
  const pkg = JSON.parse(await readRepoFile("package.json"));

  assert.equal(pkg.version, "0.7.0");
  assert.equal(pkg.license, "MIT");
  assert.deepEqual(pkg.engines, { node: ">=24" });
  assert.equal(
    pkg.scripts["verify:release-assets"],
    "node scripts/check-release-assets.mjs"
  );
});

test("README documents contract workflow, legacy context, and quick install", async () => {
  const readme = await readRepoFile("README.md");

  assert.match(readme, /^## Quick Install/m);
  assert.match(readme, /^## How Contract Files Work/m);
  assert.match(readme, /^## Legacy Shared Context/m);
  assert.match(readme, /github\/v\/tag\/jiyeongjun\/socrates-protocol/);
  assert.match(readme, /Explicit invocation example:/);
  assert.match(readme, /Auto-load example:/);
  assert.match(readme, /contract-index\.md/);
  assert.match(readme, /contracts\/contract-001\.md/);
  assert.match(readme, /\$socrates-contract/);
  assert.match(readme, /SOCRATES_CONTEXT\.md/);
  assert.match(readme, /VERSION=v0\.7\.0/);
  assert.match(readme, /release tag `v0\.7\.0`/i);
  assert.match(readme, /current package version in this worktree is `0\.7\.0`/i);
  assert.match(readme, /Every contract file should stay under 500 lines/);
  assert.match(readme, /Narrow reversible edits can stay inline/);
  assert.match(readme, /implementation plus tests or docs/);
  assert.match(readme, /durable handoff, protected-surface planning/);
  assert.match(readme, /should not overwrite it/);
  assert.match(readme, /Subcontract status values are `proposed`, `aligned`, `executing`, `blocked`, `verifying`, and `done`/);
  assert.match(readme, /If you decline twice/);
  assert.match(readme, /already exists for the same task, Socrates reads it first/);
  assert.match(readme, /implicit invocation when the host supports it/);
  assert.match(readme, /Optional Codex hook:/);
  assert.match(readme, /\.codex\/hooks\.json/);
  assert.match(readme, /SOCRATES_INSTALL_RUN=1 node --input-type=module -/);
  assert.match(readme, /--enable-codex-hooks/);
  assert.match(readme, /codex_hooks = true/);
  assert.match(readme, /not by per-skill activation/);
  assert.match(readme, /scripts\/install\.mjs/);
  assert.match(readme, /merging into any existing `hooks\.json`/i);
  assert.match(readme, /--mode uninstall --platform codex --scope global/);
  assert.match(readme, /rerun the same install command/i);
  assert.match(readme, /self-contained execution/i);
  assert.match(readme, /Optional Stop hook:/);
  assert.match(readme, /--feature stop-hook/);
  assert.match(readme, /default install does not add a `Stop` hook/);
  assert.match(readme, /Want the Stop hook from the start:/);
  assert.match(readme, /\.claude\/settings\.json/);
  assert.match(readme, /\.claude\/agents\//);
  assert.match(readme, /\.claude\/agents\/socrates-evaluate\.md/);
  assert.match(readme, /mirrored `references\/` files/);
  assert.match(readme, /model-policy\.json/);
  assert.match(readme, /not a task manager/i);
  assert.match(readme, /canonical machine-readable state/);
  assert.match(readme, /may be regenerated/);
  assert.match(readme, /drift out of sync with frontmatter/);
  assert.match(readme, /clarifying_phase/);
  assert.match(readme, /awaiting_user_answer/);
  assert.match(readme, /inline verification, evaluation, and repair flow/);
  assert.match(readme, /scripts\/context-doc\.mjs doctor/);
  assert.match(readme, /scripts\/context-doc\.mjs repair/);
  assert.match(readme, /socrates_context_doc_helper\.mjs/);
  assert.match(readme, /verify:release-assets/);
  assert.match(readme, /version: 3/);
  assert.match(readme, /Node `24\+`/);
  assert.doesNotMatch(readme, /workflow_phase/);
  assert.doesNotMatch(readme, /needs_evaluation/);
  assert.doesNotMatch(readme, /needs_repair/);
});

test("Korean README documents contract workflow and legacy context", async () => {
  const readme = await readRepoFile("README.ko.md");

  assert.match(readme, /^## 빠른 설치/m);
  assert.match(readme, /^## Contract 파일 동작 방식/m);
  assert.match(readme, /^## Legacy 공유 맥락/m);
  assert.match(readme, /github\/v\/tag\/jiyeongjun\/socrates-protocol/);
  assert.match(readme, /명시적 호출 예시:/);
  assert.match(readme, /자동 개입 예시:/);
  assert.match(readme, /contract-index\.md/);
  assert.match(readme, /contracts\/contract-001\.md/);
  assert.match(readme, /\$socrates-contract/);
  assert.match(readme, /SOCRATES_CONTEXT\.md/);
  assert.match(readme, /VERSION=v0\.7\.0/);
  assert.match(readme, /현재 릴리즈 태그는 `v0\.7\.0`입니다/);
  assert.match(readme, /현재 worktree의 package version은 `0\.7\.0`입니다/);
  assert.match(readme, /모든 contract 파일은 500줄 미만으로 유지합니다/);
  assert.match(readme, /좁고 되돌리기 쉬운 수정/);
  assert.match(readme, /구현 파일과 테스트 또는 문서/);
  assert.match(readme, /오래 남길 handoff, protected-surface 계획/);
  assert.match(readme, /이미 있으면 덮어쓰지 않습니다/);
  assert.match(readme, /`proposed`, `aligned`, `executing`, `blocked`, `verifying`, `done`/);
  assert.match(readme, /두 번 연속 거부/);
  assert.match(readme, /같은 작업을 가리키는 `SOCRATES_CONTEXT\.md`가 이미 있으면 먼저 읽고 계속 갱신합니다/);
  assert.match(readme, /implicit invocation을 켜 둡니다/);
  assert.match(readme, /선택적 Codex hook:/);
  assert.match(readme, /\.codex\/hooks\.json/);
  assert.match(readme, /SOCRATES_INSTALL_RUN=1 node --input-type=module -/);
  assert.match(readme, /--enable-codex-hooks/);
  assert.match(readme, /codex_hooks = true/);
  assert.match(readme, /스킬별 활성화가 아니라/);
  assert.match(readme, /scripts\/install\.mjs/);
  assert.match(readme, /기존 `hooks\.json`과 병합합니다/);
  assert.match(readme, /--mode uninstall --platform codex --scope global/);
  assert.match(readme, /같은 install 명령을 다시 실행하면 됩니다/);
  assert.match(readme, /독립 실행되도록 필요한 지원 파일도 함께 설치합니다/);
  assert.match(readme, /선택적 Stop hook:/);
  assert.match(readme, /--feature stop-hook/);
  assert.match(readme, /기본 설치에는 `Stop` hook이 포함되지 않습니다/);
  assert.match(readme, /처음부터 Stop hook까지 포함해서 설치:/);
  assert.match(readme, /\.claude\/settings\.json/);
  assert.match(readme, /\.claude\/agents\//);
  assert.match(readme, /\.claude\/agents\/socrates-evaluate\.md/);
  assert.match(readme, /미러된 `references\/` 파일들/);
  assert.match(readme, /model-policy\.json/);
  assert.match(readme, /task manager가 아니라/);
  assert.match(readme, /canonical machine-readable state/);
  assert.match(readme, /다시 생성될 수 있습니다/);
  assert.match(readme, /body 섹션이 frontmatter와 어긋나면/);
  assert.match(readme, /clarifying_phase/);
  assert.match(readme, /awaiting_user_answer/);
  assert.match(readme, /inline verification, evaluation, and repair flow/);
  assert.match(readme, /scripts\/context-doc\.mjs doctor/);
  assert.match(readme, /scripts\/context-doc\.mjs repair/);
  assert.match(readme, /socrates_context_doc_helper\.mjs/);
  assert.match(readme, /verify:release-assets/);
  assert.match(readme, /version: 3/);
  assert.match(readme, /Node `24\+`/);
  assert.doesNotMatch(readme, /workflow_phase/);
  assert.doesNotMatch(readme, /needs_evaluation/);
  assert.doesNotMatch(readme, /needs_repair/);
});

test("Model regression checklist preserves Codex contract thresholds", async () => {
  const checklist = await readRepoFile("reference/model-regression-checklist.md");

  assert.match(checklist, /Protected-Surface Rename/);
  assert.match(checklist, /Vague Safety Wording/);
  assert.match(checklist, /Continuation Without Context/);
  assert.match(checklist, /Narrow Reversible Source Plus Test/);
  assert.match(checklist, /Missing Artifact \/ Closed Scope/);
  assert.match(checklist, /source-plus-test work stays inline/);
  assert.match(checklist, /does not create `contract-index\.md` only because both source and test are touched/);
  assert.match(checklist, /all five live prompts satisfy the pass criteria/);
});

test("Codex and Claude skills are generated from the shared skill body source", async () => {
  const body = await readSkillBody();
  const codex = await readFile(skillTargets.codex.path, "utf8");
  const claude = await readFile(skillTargets.claude.path, "utf8");

  assert.match(
    body,
    /align the macro contract first: goal, current state, success criteria/
  );
  assert.match(body, /create visible contract files instead of one large context file/);
  assert.match(body, /contract-index\.md/);
  assert.match(body, /contracts\/contract-001\.md/);
  assert.match(
    body,
    /Execute one active subcontract at a time/
  );
  assert.match(body, /Default to a closed request scope/);
  assert.match(body, /Keep every contract file under 500 lines/);

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
  assert.match(codex, /^description: "/m);
  assert.match(claude, /^description: "/m);
  assert.doesNotMatch(codex, /^description: [^"\n]*\bExamples:/m);
  assert.doesNotMatch(claude, /^description: [^"\n]*\bExamples:/m);
});

test("Skill references are mirrored from the shared source without nested reference links", async () => {
  for (const name of skillReferenceNames) {
    const expected = `${await readSkillReferenceSource(name)}\n`;
    const source = expected.trim();
    const codex = await readFile(skillReferenceTargets.codex[name], "utf8");
    const claude = await readFile(skillReferenceTargets.claude[name], "utf8");

    assert.equal(codex, expected);
    assert.equal(claude, expected);
    assert.doesNotMatch(source, /references\/[^)\s]+\.md/);
  }
});

test("Claude subagents are generated from the shared source", async () => {
  for (const name of claudeAgentNames) {
    const expected = `${await readClaudeAgentSource(name)}\n`;
    const actual = await readFile(claudeAgentTargets[name], "utf8");
    assert.equal(actual, expected);
  }
});

test("Model policy is mirrored from the shared source", async () => {
  const expected = `${await readModelPolicySource()}\n`;
  const codex = await readFile(modelPolicyTargetPaths.codex, "utf8");
  const claude = await readFile(modelPolicyTargetPaths.claude, "utf8");

  assert.equal(codex, expected);
  assert.equal(claude, expected);
});

test("OpenAI agent prompt stays aligned with the router and on-demand references", async () => {
  const promptSource = await readAgentPromptSource();
  const prompt = await readFile(agentTargetPath, "utf8");

  assert.equal(
    prompt,
    buildOpenAIYaml({
      promptSource,
    })
  );
  assert.match(prompt, /allow_implicit_invocation: true/);
  assert.match(prompt, /display_name: "Socrates Contract"/);
  assert.doesNotMatch(prompt, /Generated from reference\/openai-default-prompt\.txt/);
  assert.match(prompt, /short_description: "Align risky changes before editing"/);
  assert.match(
    prompt,
    /default_prompt: "Use \$socrates-contract to align risky changes before editing, create contract files only for durable multi-step or protected-surface work, and verify each contract before closing\."/
  );
});

test("Reference files encode contract file and anti-scope-creep rules", async () => {
  const skillBody = await readSkillBody();
  const contextFile = await readSkillReferenceSource("context-file.md");
  const contractFiles = await readSkillReferenceSource("contract-files.md");
  const orchestration = await readSkillReferenceSource("orchestration.md");
  const protectedSurfaces = await readSkillReferenceSource("protected-surfaces.md");
  const verifyRepair = await readSkillReferenceSource("verify-repair.md");
  const evaluator = await readClaudeAgentSource("socrates-evaluate.md");

  assert.match(skillBody, /multiple independent problems/);
  assert.match(skillBody, /narrow, reversible work inline/);
  assert.match(skillBody, /implementation or verification artifacts/);
  assert.match(contractFiles, /contract-index\.md/);
  assert.match(contractFiles, /contracts\/contract-001\.md/);
  assert.match(contractFiles, /do not overwrite it/);
  assert.match(contractFiles, /Required body sections/);
  assert.match(contractFiles, /Keep references one level deep/);
  assert.match(contractFiles, /500 lines/);
  assert.match(contextFile, /Prefer `contract-index\.md` plus `contracts\/contract-NNN\.md`/);
  assert.match(orchestration, /role names describe planning and verification passes/);
  assert.match(orchestration, /Treat unrequested behavior expansion as contract drift/);
  assert.match(orchestration, /implementation plus tests or docs/);
  assert.match(protectedSurfaces, /perform a `protected_surface_planner` pass/);
  assert.match(protectedSurfaces, /In Codex, do this inline/);
  assert.match(verifyRepair, /Do not add tests for new semantics/);
  assert.match(
    evaluator,
    /fail the patch when it adds new accepted input shapes/
  );
});

test("repo-local hook configs stay aligned with the SessionStart matcher", async () => {
  const codexHooks = JSON.parse(await readRepoFile(".codex/hooks.json"));
  const claudeSettings = JSON.parse(await readRepoFile(".claude/settings.json"));

  assert.equal(
    codexHooks.hooks.SessionStart[0].matcher,
    "startup|resume|clear|compact"
  );
  assert.equal(
    claudeSettings.hooks.SessionStart[0].matcher,
    "startup|resume|clear|compact"
  );
});
