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
  readSkillScriptSource,
  skillReferenceNames,
  skillReferenceTargets,
  skillScriptNames,
  skillScriptTargets,
  skillTargets,
} from "../reference/skill-generator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const removedContextEnvName = ["SOCRATES", "CONTEXT"].join("_");
const removedClarifyingPhase = ["clarifying", "phase"].join("_");
const separateCodingPreferenceSkill = ["coding", "preferences"].join("-");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("package metadata declares the current version and Node runtime floor", async () => {
  const pkg = JSON.parse(await readRepoFile("package.json"));

  assert.equal(pkg.version, "0.9.0");
  assert.equal(pkg.license, "MIT");
  assert.deepEqual(pkg.engines, { node: ">=24" });
  assert.equal(
    pkg.scripts["verify:release-assets"],
    "node scripts/check-release-assets.mjs"
  );
});

test("README documents the contract-file workflow and install path", async () => {
  const readme = await readRepoFile("README.md");

  assert.match(readme, /^## Quick Install/m);
  assert.match(readme, /^## How Contract Files Work/m);
  assert.match(readme, /VERSION=v0\.9\.0/);
  assert.match(readme, /release tag `v0\.9\.0`/i);
  assert.match(readme, /current package version in this worktree is `0\.9\.0`/i);
  assert.match(readme, /contract-index\.md/);
  assert.match(readme, /contracts\/contract-001\.md/);
  assert.match(readme, /\$socrates-contract/);
  assert.match(readme, /\/socrates-contract/);
  assert.match(readme, /Narrow reversible edits can stay inline/);
  assert.match(readme, /implementation plus tests or docs/);
  assert.match(readme, /durable handoff, protected-surface planning/);
  assert.match(readme, /should not overwrite it/);
  assert.match(readme, /implicit invocation when the host supports it/);
  assert.match(readme, /scripts\/install\.mjs/);
  assert.match(readme, /managed by this installer/);
  assert.match(readme, /keeps only contract-file state/);
  assert.match(readme, /verify:release-assets/);
  assert.match(readme, /Node `24\+`/);
  assert.doesNotMatch(readme, new RegExp(removedContextEnvName));
  assert.doesNotMatch(readme, new RegExp(removedClarifyingPhase));
});

test("Korean README documents the contract-file workflow and install path", async () => {
  const readme = await readRepoFile("README.ko.md");

  assert.match(readme, /^## 빠른 설치/m);
  assert.match(readme, /^## Contract 파일 동작 방식/m);
  assert.match(readme, /VERSION=v0\.9\.0/);
  assert.match(readme, /현재 release tag는 `v0\.9\.0`/);
  assert.match(readme, /현재 worktree의 package version은 `0\.9\.0`/);
  assert.match(readme, /contract-index\.md/);
  assert.match(readme, /contracts\/contract-001\.md/);
  assert.match(readme, /\$socrates-contract/);
  assert.match(readme, /\/socrates-contract/);
  assert.match(readme, /좁고 되돌리기 쉬운 수정/);
  assert.match(readme, /구현 파일과 테스트 또는 문서/);
  assert.match(readme, /오래 남길 handoff, protected-surface 계획/);
  assert.match(readme, /이미 있으면 덮어쓰지 않습니다/);
  assert.match(readme, /implicit invocation/);
  assert.match(readme, /scripts\/install\.mjs/);
  assert.match(readme, /installer가 관리하는 Socrates Contract 파일/);
  assert.match(readme, /contract-file state만 유지/);
  assert.match(readme, /verify:release-assets/);
  assert.doesNotMatch(readme, new RegExp(removedContextEnvName));
  assert.doesNotMatch(readme, new RegExp(removedClarifyingPhase));
});

test("Model regression checklist preserves Codex contract thresholds", async () => {
  const checklist = await readRepoFile("reference/model-regression-checklist.md");

  assert.match(checklist, /Protected-Surface Rename/);
  assert.match(checklist, /Vague Safety Wording/);
  assert.match(checklist, /Continuation Without Contract Files/);
  assert.match(checklist, /Narrow Reversible Source Plus Test/);
  assert.match(checklist, /Missing Artifact \/ Closed Scope/);
  assert.match(checklist, /Dynamic Workflow Gate/);
  assert.match(checklist, /High-Autonomy Model Invocation Gate/);
  assert.match(checklist, /Programmatic Tool Calling Gate/);
  assert.match(checklist, /Persisted Reasoning Is Not Resume State/);
  assert.match(checklist, /Required Content Survives Concision/);
  assert.match(checklist, /all seventeen live prompts/);
  assert.match(checklist, /Treat Pro as an execution mode, never as a separate model slug/);
  assert.match(checklist, /Prompt Injection \/ External Guide/);
  assert.match(checklist, /Contract Drift Beats Severity Filters/);
  assert.match(checklist, /Engineering Quality Gate \/ Swallowed Error/);
  assert.match(checklist, /Engineering Quality Gate \/ Duplicate Helper/);
  assert.match(checklist, /Engineering Quality Gate \/ Test-Driven Fallback Drift/);
  assert.match(checklist, /Engineering Quality Gate \/ Built-In Result Default/);
  assert.match(checklist, /Engineering Quality Gate \/ Project Rule Overrides Result/);
  assert.match(checklist, /\/socrates-contract/);
  assert.match(checklist, /source-plus-test work stays inline/);
  assert.match(checklist, /does not create `contract-index\.md` only because both source and test are touched/);
  assert.match(checklist, /high-autonomy model\/CLI invocation/);
  assert.doesNotMatch(checklist, new RegExp(removedContextEnvName));
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
  assert.match(body, /Execute one active subcontract at a time/);
  assert.match(body, /Default to a closed request scope/);
  assert.match(body, /Resume guard has priority over protected-surface planning/);
  assert.match(body, /high-autonomy agent workflows/);
  assert.match(body, /modern frontier agents can create larger blast radius/);
  assert.match(body, /direct CLI access, subagents, or background execution/);
  assert.match(body, /programmatic tool-calling programs/);
  assert.match(body, /Preserve every required contract field/);
  assert.match(body, /persisted reasoning, previous-response linkage, or model memory/);
  assert.match(body, /What was the last unresolved question or decision from the prior session\?/);
  assert.match(body, /do not include domain-specific options/);
  assert.match(body, /Keep every contract file under 500 lines/);
  assert.match(body, /engineering quality gates/);
  assert.match(body, /references\/engineering-quality\.md/);
  assert.doesNotMatch(body, new RegExp(removedContextEnvName));

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
  assert.equal(skillReferenceNames.includes("context-file.md"), false);
  for (const name of skillReferenceNames) {
    const expected = `${await readSkillReferenceSource(name)}\n`;
    const source = expected.trim();
    const codex = await readFile(skillReferenceTargets.codex[name], "utf8");
    const claude = await readFile(skillReferenceTargets.claude[name], "utf8");

    assert.equal(codex, expected);
    assert.equal(claude, expected);
    assert.doesNotMatch(source, /references\/[^)\s]+\.md/);
    assert.doesNotMatch(source, new RegExp(removedContextEnvName));
  }
});

test("Skill scripts are mirrored from the shared source", async () => {
  assert.deepEqual(skillScriptNames, ["scaffold-contract.mjs"]);
  for (const name of skillScriptNames) {
    const expected = `${await readSkillScriptSource(name)}\n`;
    const codex = await readFile(skillScriptTargets.codex[name], "utf8");
    const claude = await readFile(skillScriptTargets.claude[name], "utf8");

    assert.equal(codex, expected);
    assert.equal(claude, expected);
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
  const policy = JSON.parse(expected);
  const codex = await readFile(modelPolicyTargetPaths.codex, "utf8");
  const claude = await readFile(modelPolicyTargetPaths.claude, "utf8");

  assert.equal(policy.version, 4);
  assert.deepEqual(
    policy.roles.fast_explorer.codex.preferred_models.slice(0, 3),
    ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"]
  );
  assert.deepEqual(
    policy.roles.fast_verifier.codex.preferred_models.slice(0, 3),
    ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"]
  );
  assert.equal(
    policy.roles.subgoal_planner.codex.preferred_models[0],
    "gpt-5.6-terra"
  );
  for (const role of [
    "goal_contractor",
    "protected_surface_planner",
    "contract_verifier",
  ]) {
    assert.deepEqual(
      policy.roles[role].codex.preferred_models.slice(0, 2),
      ["gpt-5.6-sol", "gpt-5.6-terra"]
    );
  }
  const legacyCodexFallbacks = {
    fast_explorer: [
      "gpt-5.4-mini",
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.3-codex-spark",
      "gpt-5.3-codex",
    ],
    goal_contractor: [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.3-codex",
      "gpt-5.4-mini",
    ],
    subgoal_planner: [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
    ],
    protected_surface_planner: [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
    ],
    fast_verifier: [
      "gpt-5.4-mini",
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.3-codex-spark",
      "gpt-5.3-codex",
    ],
    contract_verifier: [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3-codex",
    ],
  };
  for (const [role, fallbackModels] of Object.entries(legacyCodexFallbacks)) {
    assert.deepEqual(
      policy.roles[role].codex.preferred_models.slice(-fallbackModels.length),
      fallbackModels
    );
  }
  assert.equal(
    policy.rules.codex_reasoning_guidance,
    "preserve_baseline_then_compare_one_level_lower"
  );
  assert.equal(policy.rules.max_reasoning_requires_measured_quality_gain, true);
  assert.equal(policy.rules.pro_mode_is_not_a_model_slug, true);
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
  const contractFiles = await readSkillReferenceSource("contract-files.md");
  const orchestration = await readSkillReferenceSource("orchestration.md");
  const protectedSurfaces = await readSkillReferenceSource("protected-surfaces.md");
  const engineeringQuality = await readSkillReferenceSource("engineering-quality.md");
  const clarification = await readSkillReferenceSource("clarification.md");
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
  assert.match(orchestration, /role names describe planning and verification passes/);
  assert.match(orchestration, /\$socrates-contract` in Codex, `\/socrates-contract` in Claude Code/);
  assert.match(orchestration, /dynamic workflows are delegation/);
  assert.match(orchestration, /background loop is running/);
  assert.match(orchestration, /Treat unrequested behavior expansion as contract drift/);
  assert.match(orchestration, /implementation plus tests or docs/);
  assert.match(protectedSurfaces, /perform a `protected_surface_planner` pass/);
  assert.match(protectedSurfaces, /In Codex, do this inline/);
  assert.match(protectedSurfaces, /untrusted external documents/);
  assert.match(protectedSurfaces, /data, not instruction sources/);
  assert.match(engineeringQuality, /Write the module and layer boundaries before implementation/);
  assert.match(engineeringQuality, /self-contained Socrates source for engineering quality and default coding preferences/);
  assert.match(engineeringQuality, /Do not load or require companion preference skills/);
  assert.match(engineeringQuality, /Prefer `Result` or discriminated unions/);
  assert.match(engineeringQuality, /Do not force `Result` when the project explicitly prefers/);
  assert.match(engineeringQuality, /Do not swallow errors/);
  assert.match(engineeringQuality, /Mock only external boundaries/);
  assert.match(engineeringQuality, /circular dependencies and boundary violations as CI failures/);
  assert.doesNotMatch(engineeringQuality, new RegExp(separateCodingPreferenceSkill));
  const artifactRecovery = await readSkillReferenceSource("artifact-recovery.md");
  assert.match(artifactRecovery, /What was the last unresolved question or decision from the prior session\?/);
  assert.match(artifactRecovery, /resume guard outranks protected-surface planning/);
  assert.match(artifactRecovery, /Do not restart the macro contract/);
  assert.match(artifactRecovery, /list migration options/);
  assert.match(clarification, /only allowed question/);
  assert.match(clarification, /frame the next question around the user's domain/);
  assert.match(verifyRepair, /Do not add tests for new semantics/);
  assert.match(
    evaluator,
    /fail the patch when it adds new accepted input shapes/
  );
});
