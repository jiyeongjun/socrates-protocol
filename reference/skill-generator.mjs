import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const skillBodyPath = path.join(__dirname, "skill-body.md");
export const agentPromptPath = path.join(__dirname, "openai-default-prompt.txt");

export const skillTargets = {
  codex: {
    path: path.resolve(__dirname, "../.agents/skills/socrates/SKILL.md"),
    frontmatter: [
      "name: socrates",
      'description: Use for ambiguous or high-impact coding work when continued clarification across turns may materially change the implementation. Keep shared context only in SOCRATES_CONTEXT.md when it is truly needed.',
    ],
  },
  claude: {
    path: path.resolve(__dirname, "../.claude/skills/socrates/SKILL.md"),
    frontmatter: [
      "name: socrates",
      'description: Use for ambiguous or high-impact coding work when continued clarification across turns may materially change the implementation. Keep shared context only in SOCRATES_CONTEXT.md when it is truly needed.',
      "user-invocable: true",
      "allowed-tools: Read, Grep, Glob, Edit, Bash",
    ],
  },
};

export async function readSkillBody() {
  return (await readFile(skillBodyPath, "utf8")).trim();
}

export async function readAgentPromptSource() {
  return (await readFile(agentPromptPath, "utf8")).trim();
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
  return `# Generated from reference/openai-default-prompt.txt. Edit the shared source instead.\ninterface:\n  display_name: "Socrates"\n  short_description: "Clarify ambiguous coding requests and keep shared context only when it is truly needed."\n  default_prompt: ${JSON.stringify(prompt)}\npolicy:\n  allow_implicit_invocation: true\n`;
}
