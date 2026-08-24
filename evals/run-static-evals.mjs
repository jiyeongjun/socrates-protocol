import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_VERSION, listReleaseAssetPaths, validateSkillLayout } from "../scripts/install.mjs";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildPlatformSkillBody,
  buildSkillDocument,
  readAgentPromptSource,
  readClaudeSkillAppendix,
  readSkillBody,
  readSkillReferenceSource,
  skillReferenceNames,
  skillReferenceTargets,
  skillTargets,
} from "../reference/skill-generator.mjs";

const evalsRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evalsRoot, "..");
const fixturesRoot = path.join(evalsRoot, "fixtures");
const defaultCatalogPath = path.join(evalsRoot, "cases.json");

const allowedGroups = new Set([
  "explanation",
  "guided",
  "calibration",
  "noninterference",
  "packaging",
]);
const allowedMutations = new Set(["none", "bounded-local", "installer-fixture"]);
const allowedHosts = new Set(["codex", "claude", "node"]);
const requiredCaseFields = [
  "id",
  "group",
  "prompt",
  "fixture",
  "expected_action_class",
  "forbidden_actions",
  "required_output_fields",
  "expected_mutation",
  "expected_questions",
  "hosts",
  "models",
  "static_grader_ids",
  "live_grader_id",
];

function assertNonEmptyStrings(value, label) {
  assert.ok(Array.isArray(value) && value.length > 0, `${label} must be a non-empty array`);
  const seen = new Set();
  for (const item of value) {
    assert.equal(typeof item, "string", `${label} entries must be strings`);
    assert.ok(item.trim().length > 0, `${label} entries must not be blank`);
    assert.ok(!seen.has(item), `${label} contains duplicate ${item}`);
    seen.add(item);
  }
}

function fixturePath(relativePath) {
  if (relativePath === null) return null;
  assert.equal(typeof relativePath, "string", "fixture must be a string or null");
  assert.ok(
    relativePath.startsWith("fixtures/") &&
      !path.isAbsolute(relativePath) &&
      !relativePath.split(/[\\/]/u).includes(".."),
    `unsafe fixture path: ${relativePath}`
  );
  const resolved = path.resolve(evalsRoot, relativePath);
  assert.ok(
    resolved.startsWith(`${fixturesRoot}${path.sep}`),
    `fixture escapes evals/fixtures: ${relativePath}`
  );
  return resolved;
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}

async function loadContext() {
  const [
    body,
    audience,
    guided,
    visual,
    prompt,
    appendix,
    layoutText,
    packageText,
    installTests,
  ] = await Promise.all([
    readSkillBody(),
    readSkillReferenceSource("audience-calibration.md"),
    readSkillReferenceSource("guided-learning.md"),
    readSkillReferenceSource("visual-explanations.md"),
    readAgentPromptSource(),
    readClaudeSkillAppendix(),
    readFile(path.join(repoRoot, "reference/skill-layout.json"), "utf8"),
    readFile(path.join(repoRoot, "package.json"), "utf8"),
    readFile(path.join(repoRoot, "test/install.test.mjs"), "utf8"),
  ]);
  const layout = validateSkillLayout(JSON.parse(layoutText));
  const descriptionLine = skillTargets.codex.frontmatter.find((line) =>
    line.startsWith("description: ")
  );
  return {
    body,
    audience,
    guided,
    visual,
    prompt,
    appendix,
    layout,
    packageJson: JSON.parse(packageText),
    installTests,
    description: JSON.parse(descriptionLine.slice("description: ".length)),
  };
}

const staticGraders = {
  "trigger-description": async ({ context }) => {
    for (const term of [
      "visual-first explanations",
      "ELI5",
      "picture explainer",
      "code/module flow",
      "incident explained",
      "Socratic tutoring",
      "quiz",
      "mental model evaluated",
    ]) {
      assert.match(context.description, new RegExp(term, "i"));
    }
    assert.match(context.description, /Do not trigger merely because an ordinary task/i);
  },
  "interaction-routing": async ({ context }) => {
    for (const mode of ["Audience-ready artifact", "Visual learning", "Guided learning", "Review"]) {
      assert.match(context.body, new RegExp(`\\*\\*${mode}\\*\\*`, "i"));
    }
    assert.match(context.body, /Do not make the user choose a mode/i);
    assert.match(context.body, /do not hide the first useful explanation behind a diagnostic questionnaire/i);
    assert.match(context.body, /Preserve the concrete situation, constraints, alternatives/i);
    assert.match(context.body, /then ask one focused question that tests the central relationship/i);
    assert.match(context.body, /Do not ask a learner question when.*finished audience-ready artifact.*no questions.*opts out/is);
  },
  "mastery-gate": async ({ context }) => {
    assert.match(context.body, /Advance only when the user's answer demonstrates the current learning objective's key relationship/i);
    assert.match(context.body, /observable alignment on the current objective/i);
    assert.match(context.body, /do not introduce the next concept/i);
    assert.match(context.body, /checks? the same idea again/i);
    assert.match(context.guided, /For every other class, stay on the same objective/i);
    assert.match(context.body, /one focused question means one response demand/i);
  },
  "adaptive-repair": async ({ context }) => {
    assert.match(context.body, /Do not repeat the same question unchanged/i);
    assert.match(context.guided, /redraw or isolate the misunderstood relationship.*change the representation.*move one rung down/is);
    assert.match(context.guided, /Missing condition|Reversed cause|Overgeneralization/i);
  },
  "audience-calibration": async ({ context }) => {
    assert.match(context.body, /Prioritize the user's stated goal, existing knowledge, context, and requested depth/i);
    assert.match(context.body, /never assume interests, intelligence, family status, technical ability, or life experience/i);
    assert.match(context.audience, /Age does not determine interests or intelligence/i);
    assert.match(context.audience, /write the actual deliverable/i);
  },
  "source-grounding": async ({ context }) => {
    assert.match(context.body, /inspect the relevant evidence instead of inventing a generic explanation/i);
    assert.match(context.body, /Simplify without introducing a false rule/i);
    assert.match(context.body, /where the analogy stops matching/i);
  },
  "brownfield-grounding": async ({ context }) => {
    assert.match(context.body, /preparing a feature for an existing system/i);
    assert.match(context.body, /observed current behavior from proposed changes/i);
    assert.match(context.body, /current flow, invariants that must survive, likely extension points, and affected tests/i);
    assert.match(context.body, /proposals rather than facts/i);
  },
  "brownfield-fixture": async ({ evalCase }) => {
    const resolved = fixturePath(evalCase.fixture);
    assert.ok(resolved);
    assert.equal(path.basename(resolved), "brownfield-orders");
    for (const name of ["package.json", "order-service.js", "order-service.test.js"]) {
      assert.equal(await pathExists(path.join(resolved, name)), true);
    }
    const service = await readFile(path.join(resolved, "order-service.js"), "utf8");
    const tests = await readFile(path.join(resolved, "order-service.test.js"), "utf8");
    assert.match(service, /findByIdempotencyKey.*inventory\.reserve.*payments\.authorize.*orders\.insert.*events\.publish/is);
    assert.match(service, /inventory\.release/);
    assert.match(tests, /existing idempotent order.*before starting side effects/is);
    assert.match(tests, /persists, then publishes/is);
    assert.match(tests, /releases inventory when a downstream step fails/is);
  },
  "visual-explanation": async ({ context }) => {
    assert.match(context.body, /default to a visual rather than a wall of text/i);
    assert.match(context.body, /self-contained HTML artifact with large diagrams and few words/i);
    assert.match(context.body, /artifact or visualization surface/i);
    assert.match(context.body, /Do not write an HTML file into the user's repository/i);
    assert.match(context.body, /skip decorative visuals/i);
    assert.match(context.visual, /numbered sections.*large, simple diagrams.*arrows labeled/is);
    assert.match(context.visual, /make it self-contained and responsive/i);
    assert.match(context.visual, /Repair the visual after a miss/i);
  },
  "efficient-learning": async ({ context }) => {
    assert.match(context.body, /Lead with the visual explanation/i);
    assert.match(context.body, /not permission to withhold a useful model/i);
    assert.match(context.body, /compact complete explanation over an exhaustive survey/i);
    assert.match(context.body, /respect that choice immediately/i);
    assert.match(context.body, /End when the requested deliverable is complete or the final learning objective is aligned/i);
  },
  "fixture-safety": async ({ evalCase }) => {
    const resolved = fixturePath(evalCase.fixture);
    assert.ok(resolved);
    assert.equal((await lstat(resolved)).isDirectory(), true);
    assert.equal(await pathExists(path.join(resolved, "retry.js")), true);
  },
  "generated-parity": async ({ context }) => {
    for (const [platform, target] of Object.entries(skillTargets)) {
      const expected = buildSkillDocument({
        frontmatter: target.frontmatter,
        body: buildPlatformSkillBody(platform, context.body, context.appendix),
      });
      assert.equal(await readFile(target.path, "utf8"), expected);
      for (const name of skillReferenceNames) {
        assert.equal(
          await readFile(skillReferenceTargets[platform][name], "utf8"),
          `${await readSkillReferenceSource(name)}\n`
        );
      }
    }
  },
  "codex-package": async ({ context }) => {
    assert.equal(path.basename(path.dirname(skillTargets.codex.path)), "socrates");
    assert.equal(
      await readFile(agentTargetPath, "utf8"),
      buildOpenAIYaml({ promptSource: context.prompt })
    );
    assert.match(context.prompt, /\$socrates/);
  },
  "claude-package": async () => {
    assert.equal(path.basename(path.dirname(skillTargets.claude.path)), "socrates");
    assert.match(await readFile(skillTargets.claude.path, "utf8"), /^---\nname: socrates\n/u);
  },
  "installer-layout": async ({ context }) => {
    const assets = listReleaseAssetPaths(context.layout);
    assert.equal(DEFAULT_VERSION, "v1.1.0");
    assert.equal(context.packageJson.version, "1.1.0");
    assert.ok(assets.includes(".agents/skills/socrates/SKILL.md"));
    assert.ok(assets.includes(".claude/skills/socrates/SKILL.md"));
    assert.equal(assets.some((asset) => asset.includes("socrates-contract")), false);
    assert.equal(assets.some((asset) => asset.includes("scaffold-contract")), false);
    assert.ok(context.layout.skillReferences.includes("visual-explanations.md"));
    assert.deepEqual(context.layout.skillScripts, []);
    assert.deepEqual(context.layout.codexAgents, []);
    assert.deepEqual(context.layout.claudeAgents, []);
    assert.match(context.installTests, /fresh repo install writes only current platform skills/i);
  },
};

export const staticGraderIds = Object.freeze(Object.keys(staticGraders));

export async function loadEvalCatalog(catalogPath = defaultCatalogPath) {
  return JSON.parse(await readFile(catalogPath, "utf8"));
}

export async function validateEvalCatalog(catalog) {
  assert.equal(catalog?.protocol, "socrates-evals");
  assert.equal(catalog?.schema_version, "1.0");
  assert.ok(catalog.model_sets && typeof catalog.model_sets === "object");
  assert.ok(Array.isArray(catalog.cases) && catalog.cases.length > 0);

  const ids = new Set();
  const groups = new Set();
  for (const evalCase of catalog.cases) {
    assert.deepEqual(Object.keys(evalCase).sort(), [...requiredCaseFields].sort());
    assert.match(evalCase.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.ok(!ids.has(evalCase.id), `duplicate eval id: ${evalCase.id}`);
    ids.add(evalCase.id);
    assert.ok(allowedGroups.has(evalCase.group), `unknown eval group: ${evalCase.group}`);
    groups.add(evalCase.group);
    assert.equal(typeof evalCase.prompt, "string");
    assert.ok(evalCase.prompt.length >= 10);
    assert.equal(typeof evalCase.expected_action_class, "string");
    assert.ok(evalCase.expected_action_class.length > 0);
    assertNonEmptyStrings(evalCase.forbidden_actions, `${evalCase.id}.forbidden_actions`);
    assertNonEmptyStrings(evalCase.required_output_fields, `${evalCase.id}.required_output_fields`);
    assert.ok(allowedMutations.has(evalCase.expected_mutation));
    assert.ok(Number.isInteger(evalCase.expected_questions?.min));
    assert.ok(Number.isInteger(evalCase.expected_questions?.max));
    assert.ok(evalCase.expected_questions.min >= 0);
    assert.ok(evalCase.expected_questions.max <= 3);
    assert.ok(evalCase.expected_questions.min <= evalCase.expected_questions.max);
    assertNonEmptyStrings(evalCase.hosts, `${evalCase.id}.hosts`);
    for (const host of evalCase.hosts) assert.ok(allowedHosts.has(host));
    assert.equal(typeof evalCase.models, "string");
    const modelSet = catalog.model_sets[evalCase.models];
    assert.ok(modelSet, `unknown model set ${evalCase.models} in ${evalCase.id}`);
    for (const host of evalCase.hosts) {
      assertNonEmptyStrings(modelSet[host], `${evalCase.models}.${host}`);
    }
    assertNonEmptyStrings(evalCase.static_grader_ids, `${evalCase.id}.static_grader_ids`);
    for (const graderId of evalCase.static_grader_ids) {
      assert.ok(staticGraders[graderId], `unknown static grader ${graderId}`);
    }
    if (evalCase.live_grader_id !== null) {
      assert.equal(typeof evalCase.live_grader_id, "string");
      assert.ok(evalCase.hosts.some((host) => host === "codex" || host === "claude"));
    }
    if (evalCase.fixture !== null) fixturePath(evalCase.fixture);
  }
  assert.deepEqual(groups, allowedGroups);
  return catalog;
}

export async function runStaticEvals(catalogPath = defaultCatalogPath) {
  const catalog = await validateEvalCatalog(await loadEvalCatalog(catalogPath));
  const context = await loadContext();
  const failures = [];
  let graderChecks = 0;
  for (const evalCase of catalog.cases) {
    for (const graderId of evalCase.static_grader_ids) {
      graderChecks += 1;
      try {
        await staticGraders[graderId]({ context, evalCase });
      } catch (error) {
        failures.push({
          case_id: evalCase.id,
          grader_id: graderId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  const groupCounts = Object.fromEntries(
    [...allowedGroups].map((group) => [
      group,
      catalog.cases.filter((evalCase) => evalCase.group === group).length,
    ])
  );
  return {
    protocol: catalog.protocol,
    schema_version: catalog.schema_version,
    cases: catalog.cases.length,
    group_counts: groupCounts,
    grader_checks: graderChecks,
    passed: failures.length === 0,
    failures,
  };
}

async function main() {
  const summary = await runStaticEvals();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
