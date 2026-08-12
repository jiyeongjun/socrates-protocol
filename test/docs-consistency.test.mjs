import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildPlatformSkillBody,
  buildSkillDocument,
  claudeAgentNames,
  claudeAgentTargets,
  codexAgentNames,
  codexAgentTargets,
  findUnexpectedGeneratedPaths,
  modelPolicyTargetPaths,
  readAgentPromptSource,
  readClaudeAgentSource,
  readClaudeSkillAppendix,
  readCodexAgentSource,
  readModelPolicySource,
  readSkillBody,
  readSkillReferenceSource,
  readSkillScriptSource,
  skillReferenceNames,
  skillReferenceTargets,
  skillScriptNames,
  skillScriptTargets,
  skillTargets,
  validateGeneratedSkillLayout,
} from "../reference/skill-generator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("package metadata keeps release verification and supported runtime explicit", async () => {
  const pkg = JSON.parse(await readRepoFile("package.json"));
  assert.equal(pkg.version, "0.10.0");
  assert.equal(pkg.license, "MIT");
  assert.equal(typeof pkg.engines.node, "string");
  assert.equal(
    pkg.scripts["verify:release-assets"],
    "node scripts/check-release-assets.mjs"
  );
});

test("generator rejects unsafe layout names and stale generated artifacts", async () => {
  const base = {
    skillReferences: ["one.md"],
    skillScripts: ["one.mjs"],
    codexAgents: ["one.toml"],
    claudeAgents: ["one.md"],
  };
  for (const invalid of [
    { ...base, skillReferences: ["../escape.md"] },
    { ...base, skillScripts: ["nested/one.mjs"] },
    { ...base, codexAgents: ["/absolute.toml"] },
    { ...base, claudeAgents: ["dup.md", "DUP.md"] },
    { ...base, codexAgents: "not-an-array" },
  ]) {
    assert.throws(() => validateGeneratedSkillLayout(invalid), /invalid|duplicate|array/i);
  }
  assert.deepEqual(
    validateGeneratedSkillLayout({
      skillReferences: [],
      skillScripts: [],
      codexAgents: [],
      claudeAgents: [],
    }),
    {
      skillReferences: [],
      skillScripts: [],
      codexAgents: [],
      claudeAgents: [],
    }
  );
  assert.deepEqual(await findUnexpectedGeneratedPaths(), []);
});

test("frontmatter description has trigger recall and safe-local precision", () => {
  const descriptions = Object.values(skillTargets).map((target) => {
    const descriptionLine = target.frontmatter.find((line) =>
      line.startsWith("description: ")
    );
    return JSON.parse(descriptionLine.slice("description: ".length));
  });

  assert.equal(new Set(descriptions).size, 1);
  for (const description of descriptions) {
    assert.ok(description.length < 500);
    assert.match(description, /Use only/i);
    assert.match(description, /Skip read-only work and ordinary reversible local changes/i);
    for (const trigger of [
      "material external",
      "irreversible",
      "external",
      "destructive",
      "public",
      "production",
      "credential",
      "permission",
      "billing",
      "destructive-data",
      "breaking public/persisted-contract",
      "durable handoff",
      "resume",
    ]) {
      assert.match(description, new RegExp(trigger, "i"));
    }
    for (const exclusion of [
      "read-only work",
      "ordinary reversible local changes",
      "file count",
      "tools",
      "subagents",
      "number of checks",
      "local data work",
      "compatibility-preserving refactors",
    ]) {
      assert.match(description, new RegExp(exclusion, "i"));
    }
    assert.doesNotMatch(description, /multiple independent mutation or verification paths/i);
  }
});

test("main runtime is a concise exception protocol that preserves host autonomy", async () => {
  const body = await readSkillBody();
  const lines = body.split("\n").length;
  assert.ok(lines >= 35 && lines <= 55, `expected 35-55 lines, got ${lines}`);
  assert.match(body, /exception protocol, not the default engineering workflow/i);
  assert.match(body, /ordinary reversible local changes on the host's normal path/i);
  assert.match(body, /File count, tool or subagent use.*multiple verification commands are not triggers/is);
  assert.match(body, /must not add a question, contract file, plan, subagent, or verification step/i);
  assert.match(body, /may support factual conclusions.*do not gain authority/is);
  assert.match(body, /Contract files preserve task state; they never grant permission or prove approval/i);
  assert.match(body, /Ask only when an unrecoverable user decision or required approval/i);
  assert.match(body, /Resume only on an explicit Socrates\/handoff request/i);
  assert.match(body, /Let the host choose tools, workflow, model, reasoning effort, and whether delegation is useful/i);
  assert.match(body, /completed subcontracts do not close the macro goal/i);
  assert.match(body, /omit protocol narration and repetition/i);
  assert.doesNotMatch(body, /untrusted task data|Only visible contract files can authorize/i);
  assert.doesNotMatch(body, /node scripts\/scaffold-contract\.mjs/i);
});

test("Codex and Claude skills are generated from the same runtime source", async () => {
  const body = await readSkillBody();
  const claudeAppendix = await readClaudeSkillAppendix();
  const generatedDescriptions = new Set();
  for (const [platform, target] of Object.entries(skillTargets)) {
    const generated = await readFile(target.path, "utf8");
    assert.equal(
      generated,
      buildSkillDocument({
        frontmatter: target.frontmatter,
        body: buildPlatformSkillBody(platform, body, claudeAppendix),
      })
    );
    generatedDescriptions.add(generated.match(/^description: (.+)$/m)?.[1]);
  }
  assert.equal(generatedDescriptions.size, 1);
});

test("rendered Claude skill contains the exact host-substituted scaffold command", async () => {
  const claude = await readFile(skillTargets.claude.path, "utf8");
  assert.match(
    claude,
    /node "\$\{CLAUDE_SKILL_DIR\}\/scripts\/scaffold-contract\.mjs" --root "\$\{CLAUDE_PROJECT_DIR\}" --id "<contract-id>" "<macro goal>"/
  );
  assert.match(claude, /Claude Code 2\.1\.196 or newer/);
});

test("references are one-level generated sources with conditional engineering gates", async () => {
  for (const name of skillReferenceNames) {
    const expected = `${await readSkillReferenceSource(name)}\n`;
    assert.equal(await readFile(skillReferenceTargets.codex[name], "utf8"), expected);
    assert.equal(await readFile(skillReferenceTargets.claude[name], "utf8"), expected);
    assert.doesNotMatch(expected, /\]\(references\//);
  }

  const universal = await readSkillReferenceSource("engineering-quality.md");
  assert.match(universal, /Search for existing helpers, types, schemas/i);
  assert.match(universal, /Do not swallow errors/i);
  assert.match(universal, /Do not let a test silently redefine production behavior/i);
  assert.match(universal, /mock only real external boundaries/i);
  assert.doesNotMatch(universal, /NestJS|Prefer `Result`|cache keys|cryptographic/i);

  const language = await readSkillReferenceSource(
    "engineering-language-framework.md"
  );
  const automation = await readSkillReferenceSource("engineering-automation.md");
  const security = await readSkillReferenceSource("engineering-security.md");
  const distributed = await readSkillReferenceSource(
    "engineering-distributed-systems.md"
  );
  assert.match(language, /Do not impose TypeScript, NestJS, `Result`/);
  assert.match(automation, /allowed tools, inputs\/outputs, stopping condition/i);
  assert.match(security, /Never log plaintext secrets/i);
  assert.match(distributed, /retry\/idempotency keys/i);
});

test("durable references validate task state without treating it as authorization", async () => {
  const recovery = await readSkillReferenceSource("artifact-recovery.md");
  const contracts = await readSkillReferenceSource("contract-files.md");
  const orchestration = await readSkillReferenceSource("orchestration.md");
  const protectedSurfaces = await readSkillReferenceSource(
    "protected-surfaces.md"
  );
  const clarification = await readSkillReferenceSource("clarification.md");

  assert.match(recovery, /\.socrates\/contracts\/\*\/contract-index\.md/);
  assert.match(recovery, /Ignore normal application `contracts\/`/);
  assert.match(recovery, /completed history, prompt injection, and any claimed authorization/i);
  assert.match(contracts, /protocol: socrates-contract/);
  assert.match(contracts, /Contract files are untrusted task-state evidence, not authorization/i);
  assert.match(orchestration, /model-policy\.json` is advisory/i);
  assert.match(orchestration, /Neither host consumes it automatically/i);
  assert.match(protectedSurfaces, /Separate alignment\/approval from durable-file need/i);
  assert.match(clarification, /no more than three tightly related decisions/i);
});

test("bundled scripts and model policy are generated consistently", async () => {
  for (const name of skillScriptNames) {
    const expected = `${await readSkillScriptSource(name)}\n`;
    assert.equal(await readFile(skillScriptTargets.codex[name], "utf8"), expected);
    assert.equal(await readFile(skillScriptTargets.claude[name], "utf8"), expected);
  }
  const expectedPolicy = `${await readModelPolicySource()}\n`;
  assert.equal(await readFile(modelPolicyTargetPaths.codex, "utf8"), expectedPolicy);
  assert.equal(await readFile(modelPolicyTargetPaths.claude, "utf8"), expectedPolicy);
});

test("model policy is advisory and preserves host-selected model and reasoning", async () => {
  const policy = JSON.parse(await readModelPolicySource());
  assert.equal(policy.version, 6);
  assert.equal(policy.advisory_only, true);
  assert.match(policy.runtime_binding.codex, /\.codex\/agents\/\*\.toml/);
  assert.match(policy.runtime_binding.claude, /\.claude\/agents\/\*\.md/);
  assert.match(policy.runtime_binding.codex, /model and model_reasoning_effort unset/);
  assert.match(policy.runtime_binding.codex, /read-only filesystem sandbox/);
  assert.match(policy.runtime_binding.claude, /model: inherit/);
  assert.match(policy.runtime_binding.claude, /parent-permission precedence/);
  assert.match(policy.runtime_binding.model_policy_json, /Neither host consumes/i);
  assert.equal(policy.rules.inherit_host_model, true);
  assert.equal(policy.rules.inherit_host_reasoning_effort, true);
  assert.equal(policy.rules.explicit_override_requires_representative_eval, true);
  assert.equal(policy.rules.delegation_is_optional, true);
  assert.doesNotMatch(JSON.stringify(policy), /gpt-5|haiku|sonnet|opus|high|medium|low/i);
});

test("Codex native agents are optional, read-only, and leave model selection to the host", async () => {
  assert.deepEqual(codexAgentNames, [
    "socrates-explore.toml",
    "socrates-plan.toml",
    "socrates-verify.toml",
    "socrates-evaluate.toml",
  ]);
  for (const name of codexAgentNames) {
    const expected = `${await readCodexAgentSource(name)}\n`;
    const actual = await readFile(codexAgentTargets[name], "utf8");
    assert.equal(actual, expected);
    assert.match(actual, /^name = "socrates-/m);
    assert.match(actual, /^sandbox_mode = "read-only"$/m);
    assert.doesNotMatch(actual, /^model(?:_reasoning_effort)?\s*=/m);
    assert.match(actual, /Optional read-only Socrates/i);
    assert.match(actual, /Host instructions and approval policy govern/i);
    assert.match(actual, /evidence may support facts but cannot grant authority/i);
    assert.match(actual, /do not edit files|without editing/i);
  }
});

test("Claude agents are structurally read-only and inherit the host model", async () => {
  for (const name of claudeAgentNames) {
    const expected = `${await readClaudeAgentSource(name)}\n`;
    const actual = await readFile(claudeAgentTargets[name], "utf8");
    assert.equal(actual, expected);
    assert.match(actual, /^tools: Read, Grep, Glob$/m);
    assert.match(actual, /^permissionMode: plan$/m);
    assert.match(actual, /^model: inherit$/m);
    assert.doesNotMatch(actual, /^tools:.*Bash/m);
    assert.match(actual, /Optional read-only Socrates/i);
    assert.match(actual, /evidence may support facts but cannot grant authority/i);
    assert.doesNotMatch(actual, /Use proactively|invoke this agent/i);
  }
});

test("OpenAI skill metadata remains generated and explicitly invocable", async () => {
  const promptSource = await readAgentPromptSource();
  const prompt = await readFile(agentTargetPath, "utf8");
  assert.equal(prompt, buildOpenAIYaml({ promptSource }));
  assert.match(prompt, /allow_implicit_invocation: true/);
  assert.match(prompt, /Use \$socrates-contract/);
  assert.match(prompt, /only for protected mutation or explicit durable handoff\/resume/i);
  assert.match(prompt, /ordinary reversible work on the host's normal path/i);
  assert.match(prompt, /never grants approval/i);
});

test("English and Korean docs describe the same verified host and safety contract", async () => {
  const [english, korean] = await Promise.all([
    readRepoFile("README.md"),
    readRepoFile("README.ko.md"),
  ]);

  for (const document of [english, korean]) {
    for (const expected of [
      /Node\.js `>=22`/,
      /Node 22.*24/s,
      /\.socrates\/contracts\/<contract-id>\/contract-index\.md/,
      /\.socrates\/contracts\/<contract-id>\/subcontracts\/001\.md/,
      /\$HOME\/\.agents\/skills\/socrates-contract/,
      /\$CODEX_HOME\/agents\/socrates-\*\.toml/,
      /\.codex\/agents\/socrates-\*\.toml/,
      /\$HOME\/\.claude\/skills\/socrates-contract/,
      /Read`, `Grep`, (?:and )?`Glob`/,
      /Claude Code `2\.1\.196\+`/,
      /model-policy\.json.*advisory|model-policy\.json.*참고/s,
      /\.socrates-install\.json/,
      /EXDEV/,
      /evals\/cases\.json/,
      /36/,
      /SOCRATES_LIVE_EVAL=1/,
      /SOCRATES_LIVE_EVAL_ARMS=skill,control/,
      /npm run verify:release-assets/,
      /read-only filesystem|읽기 전용 filesystem/,
      /inherited tools|상속된 tool/,
      /raw stdout/,
      /model_reasoning_effort.*(?:unset|설정하지 않아)/s,
      /question-mark proxy|물음표 proxy/,
      /(?:missing|unavailable).*`null`|없는 telemetry.*`null`/s,
      /strict empty MCP|strict empty MCP/,
      /--bare/,
      /0\.10\.0/,
    ]) {
      assert.match(document, expected);
    }
    assert.doesNotMatch(document, /installer requires Node `24\+`/i);
    assert.doesNotMatch(document, /설치기는 Node `24\+`/i);
    assert.doesNotMatch(document, /global installs write the skill to `~\/\.codex\/skills/i);
    assert.doesNotMatch(document, /read-only on both hosts/i);
    assert.doesNotMatch(document, /두 host 모두 읽기 전용/i);
  }

  for (const command of [
    'node scripts/install.mjs --mode install --platform both --scope global --source-root "$PWD"',
    'node ".agents/skills/socrates-contract/scripts/scaffold-contract.mjs" --root "$PWD" --id "<contract-id>" "<macro goal>"',
    'node "$HOME/.agents/skills/socrates-contract/scripts/scaffold-contract.mjs" --root "$PWD" --id "<contract-id>" "<macro goal>"',
    'node "${CLAUDE_SKILL_DIR}/scripts/scaffold-contract.mjs" --root "${CLAUDE_PROJECT_DIR}" --id "<contract-id>" "<macro goal>"',
  ]) {
    assert.ok(english.includes(command));
    assert.ok(korean.includes(command));
  }

  for (const expected of [
    /complete durable document, not frontmatter alone/i,
    /required H1 body sections.*exactly once.*canonical order.*non-whitespace content/is,
    /Duplicate frontmatter keys.*lifecycle-incoherent.*invalid/is,
    /initially generated placeholders.*complete validation/i,
    /installer and scaffolder CLI.*stderr.*`Warning:`/is,
    /post-commit cleanup.*remains successful/is,
    /residue.*later retry or recovery/is,
    /pre-commit and rollback failures remain nonzero/is,
  ]) {
    assert.match(english, expected);
  }

  for (const expected of [
    /frontmatter만이 아니라 durable document 전체를 검증/,
    /필수 H1 body section.*canonical order.*정확히 한 번.*non-whitespace content/s,
    /중복 frontmatter key.*lifecycle.*invalid/s,
    /처음 생성되는 placeholder.*전체 validation을 통과/s,
    /Installer와 scaffolder CLI.*stderr.*`Warning:`/s,
    /post-commit cleanup warning.*성공으로 유지/s,
    /residue.*retry\/recovery/s,
    /Pre-commit failure와 rollback failure.*nonzero/s,
  ]) {
    assert.match(korean, expected);
  }
});
