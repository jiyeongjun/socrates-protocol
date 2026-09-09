import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildSkillDocument,
  claudeAgentNames,
  codexAgentNames,
  findUnexpectedGeneratedPaths,
  readAgentPromptSource,
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

test("package metadata identifies the 2.0.0 intent-alignment release", async () => {
  const pkg = JSON.parse(await readRepoFile("package.json"));
  assert.equal(pkg.version, "2.0.0");
  assert.equal(DEFAULT_VERSION, "v2.0.0");
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
    "implementation-alignment.md",
    "visual-explanations.md",
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
    assert.match(description, /teach through visual-first explanations/i);
    assert.match(description, /ELI5/i);
    assert.match(description, /picture explainer/i);
    assert.match(description, /code\/module flow.*trade-off.*incident/is);
    assert.match(description, /Socratic tutoring or a quiz/i);
    assert.match(description, /Preserve finished-deliverable and no-question learning requests/i);
    assert.match(description, /Do not turn fully specified ordinary edits/i);
    assert.doesNotMatch(description, /production|billing|credential|destructive/i);
  }
  assert.equal(new Set(descriptions).size, 1);
});

test("canonical runtime leads with a visual and enforces the alignment gate", async () => {
  const body = await readSkillBody();
  assert.ok(body.split("\n").length < 100, "runtime should stay compact");
  assert.match(body, /Audience-ready artifact.*Visual learning.*Guided learning.*Review/is);
  assert.match(body, /show a useful visual explanation immediately, then ask one focused question/i);
  assert.match(body, /Do not ask a learner question when.*finished audience-ready artifact.*no questions.*opts out/is);
  assert.match(body, /Preserve the concrete situation, constraints, alternatives/i);
  assert.match(body, /Decision needed:/i);
  assert.match(body, /the deliverable is incomplete until it names that decision/i);
  assert.match(body, /Advance only when the user's answer demonstrates the current learning objective's key relationship/i);
  assert.match(body, /observable alignment on the current objective/i);
  assert.match(body, /Partly correct.*same objective/is);
  assert.match(body, /Misconception.*Do not.*next concept/is);
  assert.match(body, /Uncertain or no answer.*re-check the same objective/is);
  assert.match(body, /Do not repeat the same question unchanged/i);
  assert.match(body, /one focused question means one response demand/i);
  assert.match(body, /Do not stack a prediction, a separate “why\?”/i);
  assert.match(body, /Ask once, then stop the turn/i);
  assert.match(body, /respect that choice immediately/i);
  assert.match(body, /Simplify without introducing a false rule/i);
  assert.match(body, /self-contained HTML artifact with large diagrams and few words/i);
  assert.match(body, /artifact or visualization surface/i);
  assert.match(body, /Do not write an HTML file into the user's repository/i);
  assert.match(body, /skip decorative visuals/i);
  assert.match(body, /never assume interests, intelligence, family status/is);
  assert.match(body, /Do not append a recap or next lesson/i);
  assert.match(body, /compact complete explanation over an exhaustive survey/i);
  assert.doesNotMatch(body, /contract-index|scaffold-contract|protected surface/i);
});

test("guided-learning reference changes support after a miss and advances only on evidence", async () => {
  const guided = await readSkillReferenceSource("guided-learning.md");
  assert.match(guided, /Track one objective at a time/i);
  assert.match(guided, /Transfer.*Causal explanation.*Concrete application.*Recognition.*Worked first step/is);
  assert.match(guided, /redraw or isolate the misunderstood relationship/i);
  assert.match(guided, /alignment as local and observable/i);
  assert.match(guided, /For every other class, stay on the same objective/i);
  assert.match(guided, /computers do not decide to tire/i);
  assert.match(guided, /what the function must check before calling itself again/i);
  assert.match(guided, /base case returns without making another recursive call/i);
  assert.match(guided, /then advance to how calls unwind/i);
  assert.match(guided, /If the user asks for the answer.*explain directly/is);
});

test("visual reference produces readable grounded artifacts and focused repairs", async () => {
  const visual = await readSkillReferenceSource("visual-explanations.md");
  assert.match(visual, /in-conversation artifact or visualization.*self-contained HTML artifact.*inline diagram/is);
  assert.match(visual, /Do not create files in the user's repository/i);
  assert.match(visual, /title phrased as the question.*numbered sections.*large, simple diagrams.*arrows labeled/is);
  assert.match(visual, /self-contained and responsive/i);
  assert.match(visual, /avoid external scripts, fonts, trackers, network requests/i);
  assert.match(visual, /distinguish current behavior from a proposal/i);
  assert.match(visual, /trigger, propagation path, user-visible impact, recovery/is);
  assert.match(visual, /Repair the visual after a miss/i);
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

  const generated = {};
  for (const [platform, target] of Object.entries(skillTargets)) {
    generated[platform] = await readFile(target.path, "utf8");
    assert.equal(
      generated[platform],
      buildSkillDocument({
        frontmatter: target.frontmatter,
        body,
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
  assert.match(yaml, /short_description: "Align intent, visualize decisions, then implement"/);
  assert.match(yaml, /default_prompt: "Use \$socrates/);
  assert.match(yaml, /allow_implicit_invocation: true/);
});

test("release manifest ships only the Socrates package", async () => {
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

test("READMEs link to shipped workflows and document executable package commands", async () => {
  const pkg = JSON.parse(await readRepoFile("package.json"));
  for (const name of ["README.md", "README.ko.md"]) {
    const readme = await readRepoFile(name);
    assert.ok(readme.includes(`version-${pkg.version}-`));
    assert.ok(readme.includes("$socrates"));
    assert.ok(readme.includes("/socrates"));
    for (const match of readme.matchAll(/npm run ([a-z:-]+)/g)) {
      assert.ok(pkg.scripts[match[1]], `undocumented command: ${match[1]}`);
    }
    for (const match of readme.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      await access(path.resolve(repoRoot, target));
    }
  }
});
