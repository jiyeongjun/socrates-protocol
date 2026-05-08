import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOCRATES_DESCRIPTION =
  "Use when a requested mutation needs explicit agreement on the macro goal, scope, success criteria, protected surfaces, or decomposition into subcontracts before work proceeds. Examples: persisted-field renames, multi-step refactors, schema or auth changes, migrations, billing, deletion, or vague preference words like \"elegant\" or \"robust\". Guides macro-contract alignment, subcontract files, one-question clarification, execution, verification, and closure. Skip read-only explanations, formatting-only work, and explicit low-risk single-step edits.";

export const skillBodyPath = path.join(__dirname, "skill-body.md");
export const agentPromptPath = path.join(__dirname, "openai-default-prompt.txt");
export const modelPolicySourcePath = path.join(__dirname, "model-policy.json");
export const skillReferenceSourceDir = path.join(__dirname, "skill-references");
export const claudeAgentSourceDir = path.join(__dirname, "claude-agents");
export const skillLayoutPath = path.join(__dirname, "skill-layout.json");

const skillLayout = readSkillLayout();

export const skillReferenceNames = skillLayout.skillReferences;
export const claudeAgentNames = skillLayout.claudeAgents;

export const skillTargets = {
  codex: {
    path: path.resolve(__dirname, "../.agents/skills/socrates-contract/SKILL.md"),
    frontmatter: [
      "name: socrates-contract",
      `description: ${JSON.stringify(SOCRATES_DESCRIPTION)}`,
    ],
  },
  claude: {
    path: path.resolve(__dirname, "../.claude/skills/socrates-contract/SKILL.md"),
    frontmatter: [
      "name: socrates-contract",
      `description: ${JSON.stringify(SOCRATES_DESCRIPTION)}`,
    ],
  },
};

export const agentTargetPath = path.resolve(
  __dirname,
  "../.agents/skills/socrates-contract/agents/openai.yaml"
);

export const skillReferenceTargets = {
  codex: buildNamedTargetPaths(
    path.resolve(__dirname, "../.agents/skills/socrates-contract/references"),
    skillReferenceNames
  ),
  claude: buildNamedTargetPaths(
    path.resolve(__dirname, "../.claude/skills/socrates-contract/references"),
    skillReferenceNames
  ),
};

export const modelPolicyTargetPaths = {
  codex: path.resolve(__dirname, "../.agents/skills/socrates-contract/model-policy.json"),
  claude: path.resolve(__dirname, "../.claude/skills/socrates-contract/model-policy.json"),
};

export const claudeAgentTargets = buildNamedTargetPaths(
  path.resolve(__dirname, "../.claude/agents"),
  claudeAgentNames
);

function buildNamedTargetPaths(baseDir, names) {
  return Object.fromEntries(
    names.map((name) => [name, path.join(baseDir, name)])
  );
}

function readSkillLayout() {
  const parsed = JSON.parse(readFileSync(skillLayoutPath, "utf8"));

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.skillReferences) ||
    !Array.isArray(parsed.claudeAgents)
  ) {
    throw new Error("reference/skill-layout.json must define skillReferences and claudeAgents arrays");
  }

  return {
    skillReferences: [...parsed.skillReferences],
    claudeAgents: [...parsed.claudeAgents],
  };
}

async function readNamedSource({ dir, names, name }) {
  if (!names.includes(name)) {
    throw new Error(`Unknown generated Socrates source: ${name}`);
  }

  return (await readFile(path.join(dir, name), "utf8")).trim();
}

export async function readSkillBody() {
  return (await readFile(skillBodyPath, "utf8")).trim();
}

export async function readAgentPromptSource() {
  return (await readFile(agentPromptPath, "utf8")).trim();
}

export async function readModelPolicySource() {
  return (await readFile(modelPolicySourcePath, "utf8")).trim();
}

export async function readSkillReferenceSource(name) {
  return readNamedSource({
    dir: skillReferenceSourceDir,
    names: skillReferenceNames,
    name,
  });
}

export async function readClaudeAgentSource(name) {
  return readNamedSource({
    dir: claudeAgentSourceDir,
    names: claudeAgentNames,
    name,
  });
}

export function buildSkillDocument({ frontmatter, body }) {
  const header = ["---", ...frontmatter, "---", ""].join("\n");
  return `${header}\n${body.trim()}\n`;
}

export function normalizeAgentPrompt(source) {
  return source.replace(/\s+/g, " ").trim();
}

export function buildOpenAIYaml({ promptSource }) {
  const prompt = normalizeAgentPrompt(promptSource);
  return `interface:\n  display_name: "Socrates Contract"\n  short_description: "Align risky changes before editing"\n  default_prompt: ${JSON.stringify(prompt)}\npolicy:\n  allow_implicit_invocation: true\n`;
}
