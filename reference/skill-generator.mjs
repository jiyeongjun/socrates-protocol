import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOCRATES_DESCRIPTION =
  "Use whenever a user request will mutate files, data, configuration, external systems, or any user-visible state. Before all other handling, if a resume/continue request has no contract files, output only that durable state is missing plus the exact question: What was the last unresolved question or decision from the prior session? Default to triggering for any change that crosses more than one verification path, alters persisted or shared state, or hides a load-bearing decision — even when the user did not explicitly ask for \"a contract.\" Examples: persisted-field renames, multi-step refactors, schema or auth changes, migrations, billing, deletion, deployment, environment config, vague preference words like \"elegant\" or \"robust\", and any phrase that names a protected surface (production, rollout, safe). Skip only for read-only explanations, formatting-only edits, single-file low-risk single-step changes the user explicitly scoped, and pure conversational replies.";

export const skillBodyPath = path.join(__dirname, "skill-body.md");
export const agentPromptPath = path.join(__dirname, "openai-default-prompt.txt");
export const modelPolicySourcePath = path.join(__dirname, "model-policy.json");
export const skillReferenceSourceDir = path.join(__dirname, "skill-references");
export const skillScriptSourceDir = path.resolve(__dirname, "../scripts");
export const claudeAgentSourceDir = path.join(__dirname, "claude-agents");
export const skillLayoutPath = path.join(__dirname, "skill-layout.json");

const skillLayout = readSkillLayout();

export const skillReferenceNames = skillLayout.skillReferences;
export const skillScriptNames = skillLayout.skillScripts;
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

export const skillScriptTargets = {
  codex: buildNamedTargetPaths(
    path.resolve(__dirname, "../.agents/skills/socrates-contract/scripts"),
    skillScriptNames
  ),
  claude: buildNamedTargetPaths(
    path.resolve(__dirname, "../.claude/skills/socrates-contract/scripts"),
    skillScriptNames
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
    !Array.isArray(parsed.skillScripts) ||
    !Array.isArray(parsed.claudeAgents)
  ) {
    throw new Error("reference/skill-layout.json must define skillReferences, skillScripts, and claudeAgents arrays");
  }

  return {
    skillReferences: [...parsed.skillReferences],
    skillScripts: [...parsed.skillScripts],
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

export async function readSkillScriptSource(name) {
  return readNamedSource({
    dir: skillScriptSourceDir,
    names: skillScriptNames,
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
