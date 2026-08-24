import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildPlatformSkillBody,
  buildSkillDocument,
  claudeAgentNames,
  codexAgentNames,
  findUnexpectedGeneratedPaths,
  readAgentPromptSource,
  readClaudeSkillAppendix,
  readSkillBody,
  readSkillReferenceSource,
  skillReferenceNames,
  skillReferenceTargets,
  skillScriptNames,
  skillTargets,
  validateGeneratedSkillLayout,
} from "../reference/skill-generator.mjs";
import { DEFAULT_VERSION, listReleaseAssetPaths } from "../scripts/install.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("package metadata identifies the breaking 1.0.0 learning-skill release", async () => {
  const pkg = JSON.parse(await readRepoFile("package.json"));
  assert.equal(pkg.version, "1.0.0");
  assert.equal(DEFAULT_VERSION, "v1.0.0");
  assert.equal(pkg.license, "MIT");
  assert.match(pkg.engines.node, />=22/);
  assert.equal(pkg.scripts["verify:skills"], "node reference/verify-skills.mjs");
  assert.equal(
    pkg.scripts["verify:release-assets"],
    "node scripts/check-release-assets.mjs"
  );
});

test("generated layout is minimal and rejects unsafe names", () => {
  assert.deepEqual(skillReferenceNames, [
    "audience-calibration.md",
    "guided-learning.md",
  ]);
  assert.deepEqual(skillScriptNames, []);
  assert.deepEqual(codexAgentNames, []);
  assert.deepEqual(claudeAgentNames, []);

  const base = {
    skillReferences: ["one.md"],
    skillScripts: [],
    codexAgents: [],
    claudeAgents: [],
  };
  for (const invalid of [
    { ...base, skillReferences: ["../escape.md"] },
    { ...base, skillReferences: ["nested/one.md"] },
    { ...base, codexAgents: ["/absolute.toml"] },
    { ...base, claudeAgents: ["dup.md", "DUP.md"] },
    { ...base, skillScripts: "not-an-array" },
  ]) {
    assert.throws(
      () => validateGeneratedSkillLayout(invalid),
      /invalid|duplicate|array/i
    );
  }
});

test("frontmatter targets learning requests without hijacking ordinary tasks", () => {
  const descriptions = [];
  for (const target of Object.values(skillTargets)) {
    assert.equal(target.frontmatter[0], "name: socrates");
    const raw = target.frontmatter.find((line) => line.startsWith("description: "));
    const description = JSON.parse(raw.slice("description: ".length));
    descriptions.push(description);
    assert.match(description, /Teach and explain concepts/i);
    assert.match(description, /ELI5/i);
    assert.match(description, /Socratic tutoring or a quiz/i);
    assert.match(description, /mistaken or incomplete answer/i);
    assert.match(description, /re-check the same idea before advancing/i);
    assert.match(description, /Do not trigger merely because an ordinary task/i);
    assert.doesNotMatch(description, /production|billing|credential|destructive/i);
  }
  assert.equal(new Set(descriptions).size, 1);
});

test("canonical runtime leads with value and enforces the mastery gate", async () => {
  const body = await readSkillBody();
  assert.ok(body.split("\n").length < 100, "runtime should stay compact");
  assert.match(body, /Deliverable.*Explain.*Guided learning.*Review/is);
  assert.match(body, /give a useful explanation immediately/i);
  assert.match(body, /do not append a check, quiz, or follow-up question unless the user explicitly asks/i);
  assert.match(body, /Preserve the concrete situation, constraints, alternatives/i);
  assert.match(body, /Decision needed:/i);
  assert.match(body, /the deliverable is incomplete until it names that decision/i);
  assert.match(body, /phrase the offer as a statement rather than a second question/i);
  assert.match(body, /advance only when the user's answer demonstrates the current learning objective/i);
  assert.match(body, /Partly correct.*same objective/is);
  assert.match(body, /Misconception.*Do not.*next concept/is);
  assert.match(body, /Uncertain or no answer.*re-check the same objective/is);
  assert.match(body, /Do not repeat the same question unchanged/i);
  assert.match(body, /one focused question means one response demand/i);
  assert.match(body, /Do not stack a prediction, a separate “why\?”/i);
  assert.match(body, /Ask it once, then stop the turn/i);
  assert.match(body, /respect that choice, explain it directly/i);
  assert.match(body, /Simplify without introducing a false rule/i);
  assert.match(body, /available visualization capability/i);
  assert.match(body, /compact table or inline flow, timeline, or tree/i);
  assert.match(body, /skip decorative visuals/i);
  assert.match(body, /never assume interests, intelligence, family status/is);
  assert.match(body, /Do not append a quiz, recap, or next lesson/i);
  assert.match(body, /compact complete explanation over an exhaustive survey/i);
  assert.doesNotMatch(body, /contract-index|scaffold-contract|protected surface/i);
});

test("guided-learning reference changes support after a miss and advances only on evidence", async () => {
  const guided = await readSkillReferenceSource("guided-learning.md");
  assert.match(guided, /Track one objective at a time/i);
  assert.match(guided, /Transfer.*Causal explanation.*Concrete application.*Recognition.*Worked first step/is);
  assert.match(guided, /For every other class, stay on the same objective/i);
  assert.match(guided, /computers do not decide to tire/i);
  assert.match(guided, /what the function must check before calling itself again/i);
  assert.match(guided, /base case returns without making another recursive call/i);
  assert.match(guided, /then advance to how calls unwind/i);
  assert.match(guided, /If the user asks for the answer.*explain directly/is);
});

test("audience reference calibrates by evidence instead of demographics", async () => {
  const audience = await readSkillReferenceSource("audience-calibration.md");
  assert.match(audience, /Goal.*Prior knowledge.*Depth.*Context.*Language and format/is);
  assert.match(audience, /An explicit user preference beats a category default/i);
  assert.match(audience, /Young child.*Beginner.*Practitioner.*Manager.*Mixed audience/is);
  assert.match(audience, /Age does not determine interests or intelligence/i);
  assert.match(audience, /Use facts supplied by the user, not stereotypes/i);
  assert.match(audience, /Do not make the simple layer memorable by making it false/i);
  assert.match(audience, /write the actual deliverable in the appropriate voice/i);
  assert.match(audience, /explicitly state the decision when alternatives were supplied/i);
});

test("Codex and Claude packages are generated from one shared runtime", async () => {
  const body = await readSkillBody();
  const claudeAppendix = await readClaudeSkillAppendix();
  assert.equal(claudeAppendix, "");

  const generated = {};
  for (const [platform, target] of Object.entries(skillTargets)) {
    generated[platform] = await readFile(target.path, "utf8");
    assert.equal(
      generated[platform],
      buildSkillDocument({
        frontmatter: target.frontmatter,
        body: buildPlatformSkillBody(platform, body, claudeAppendix),
      })
    );

    for (const name of skillReferenceNames) {
      assert.equal(
        await readFile(skillReferenceTargets[platform][name], "utf8"),
        `${await readSkillReferenceSource(name)}\n`
      );
    }
  }
  assert.equal(generated.codex, generated.claude);

  assert.deepEqual(await findUnexpectedGeneratedPaths(), []);
});

test("Codex UI metadata invokes the renamed skill explicitly", async () => {
  const prompt = await readAgentPromptSource();
  const yaml = await readFile(agentTargetPath, "utf8");
  assert.equal(yaml, buildOpenAIYaml({ promptSource: prompt }));
  assert.match(yaml, /display_name: "Socrates"/);
  assert.match(yaml, /short_description: "Explain clearly and build real understanding"/);
  assert.match(yaml, /default_prompt: "Use \$socrates/);
  assert.match(yaml, /allow_implicit_invocation: true/);
});

test("release manifest ships only the v1 Socrates package", async () => {
  const layout = JSON.parse(await readRepoFile("reference/skill-layout.json"));
  const assets = listReleaseAssetPaths(layout);
  assert.equal(assets.includes(".agents/skills/socrates/SKILL.md"), true);
  assert.equal(assets.includes(".claude/skills/socrates/SKILL.md"), true);
  assert.equal(assets.some((item) => item.includes("socrates-contract")), false);
  assert.equal(assets.some((item) => item.includes("scaffold-contract")), false);
  assert.equal(assets.some((item) => item.includes("model-policy")), false);

  for (const removed of [
    "scripts/scaffold-contract.mjs",
    "reference/model-policy.json",
    ".agents/skills/socrates-contract/SKILL.md",
    ".claude/skills/socrates-contract/SKILL.md",
    ".codex/agents/socrates-plan.toml",
    ".claude/agents/socrates-plan.md",
  ]) {
    await assert.rejects(() => access(path.join(repoRoot, removed)), {
      code: "ENOENT",
    });
  }
});

test("English and Korean READMEs document behavior, installation, upgrade, and evaluation", async () => {
  const english = await readRepoFile("README.md");
  const korean = await readRepoFile("README.ko.md");
  for (const readme of [english, korean]) {
    assert.match(readme, /version-1\.0\.0/);
    assert.match(readme, /\$socrates/);
    assert.match(readme, /\/socrates/);
    assert.match(readme, /\.agents\/skills\/socrates/);
    assert.match(readme, /\.claude\/skills\/socrates/);
    assert.match(readme, /v0\.10\.0/);
    assert.match(readme, /21/);
    assert.match(readme, /38/);
    assert.match(readme, /npm run verify:skills/);
    assert.match(readme, /SOCRATES_LIVE_EVAL_HOST=claude/);
    assert.doesNotMatch(readme, /DreambigOu\/ELI5/);
    assert.doesNotMatch(readme, /No quiz|퀴즈는 하지 마/i);
  }
  assert.match(english, /When to use Socrates/i);
  assert.match(english, /Understand something quickly.*Learn through dialogue.*Check your understanding.*Explain it to someone else/is);
  assert.match(english, /A normal explanation gets a complete answer, not a surprise quiz/i);
  assert.match(english, /Visual explanations/i);
  assert.match(english, /Actual response tests/i);
  assert.match(english, /Codex.*PASS.*Claude.*PASS/is);
  assert.match(english, /checks the same idea again before moving forward/i);
  assert.match(english, /never repeats the same question unchanged/i);
  assert.match(korean, /언제 쓰는가/);
  assert.match(korean, /개념을 빠르게 이해.*대화하며 학습.*내 이해를 점검.*다른 사람에게 설명/is);
  assert.match(korean, /일반적인 설명 요청에는 완결된 답을 주며 갑자기 퀴즈를 시작하지 않습니다/);
  assert.match(korean, /시각화는 언제 쓰는가/);
  assert.match(korean, /실제 답변 테스트/);
  assert.match(korean, /Codex.*통과.*Claude.*통과/is);
  assert.match(korean, /다음 단계로 넘어가지 않고/);
  assert.match(korean, /같은 질문을 그대로 반복하지 않습니다/);
});
