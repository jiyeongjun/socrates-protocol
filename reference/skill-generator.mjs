import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOCRATES_DESCRIPTION =
  "Handles ambiguous or high-impact coding work where missing artifacts, protected-surface changes, or unresolved implementation branches could materially change the implementation. Use for coding tasks that need artifact recovery, guarded clarification, or post-patch verification. Skip trivial, formatting-only, or already explicit single-path work.";

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
    path: path.resolve(__dirname, "../.agents/skills/socrates/SKILL.md"),
    frontmatter: [
      "name: socrates",
      `description: ${SOCRATES_DESCRIPTION}`,
    ],
  },
  claude: {
    path: path.resolve(__dirname, "../.claude/skills/socrates/SKILL.md"),
    frontmatter: [
      "name: socrates",
      `description: ${SOCRATES_DESCRIPTION}`,
      "allowed-tools: Read, Grep, Glob, Edit, Bash",
    ],
  },
};

export const agentTargetPath = path.resolve(
  __dirname,
  "../.agents/skills/socrates/agents/openai.yaml"
);

export const skillReferenceTargets = {
  codex: buildNamedTargetPaths(
    path.resolve(__dirname, "../.agents/skills/socrates/references"),
    skillReferenceNames
  ),
  claude: buildNamedTargetPaths(
    path.resolve(__dirname, "../.claude/skills/socrates/references"),
    skillReferenceNames
  ),
};

export const modelPolicyTargetPaths = {
  codex: path.resolve(__dirname, "../.agents/skills/socrates/model-policy.json"),
  claude: path.resolve(__dirname, "../.claude/skills/socrates/model-policy.json"),
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
  return `${header}\n<!-- Generated from reference/skill-body.md. Edit the shared source instead. -->\n\n${body.trim()}\n`;
}

export function normalizeAgentPrompt(source) {
  return source.replace(/\s+/g, " ").trim();
}

export function buildOpenAIYaml({ promptSource }) {
  const prompt = normalizeAgentPrompt(promptSource);
  return `# Generated from reference/openai-default-prompt.txt. Edit the shared source instead.\ninterface:\n  display_name: "Socrates"\n  short_description: "Recover missing artifacts, guard protected surfaces, and keep shared context only when it is truly needed."\n  default_prompt: ${JSON.stringify(prompt)}\npolicy:\n  allow_implicit_invocation: true\n`;
}
