import { readFileSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOCRATES_DESCRIPTION =
  "Use for mutation with external, destructive, public, costly, credentialed, production, compatibility, schema, auth, billing, data, permission, rollback, or migration risk; multiple independent mutation or verification paths; durable multi-turn handoff; or explicit resume of a Socrates contract. Skip read-only explanation/review, formatting-only work, narrow local reversible edits, and focused source-plus-test or source-plus-doc changes with one coherent verification path.";

export const skillBodyPath = path.join(__dirname, "skill-body.md");
export const agentPromptPath = path.join(__dirname, "openai-default-prompt.txt");
export const claudeSkillAppendixPath = path.join(
  __dirname,
  "claude-skill-appendix.md"
);
export const modelPolicySourcePath = path.join(__dirname, "model-policy.json");
export const skillReferenceSourceDir = path.join(__dirname, "skill-references");
export const skillScriptSourceDir = path.resolve(__dirname, "../scripts");
export const claudeAgentSourceDir = path.join(__dirname, "claude-agents");
export const codexAgentSourceDir = path.join(__dirname, "codex-agents");
export const skillLayoutPath = path.join(__dirname, "skill-layout.json");

const skillLayout = readSkillLayout();

export const skillReferenceNames = skillLayout.skillReferences;
export const skillScriptNames = skillLayout.skillScripts;
export const claudeAgentNames = skillLayout.claudeAgents;
export const codexAgentNames = skillLayout.codexAgents;

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

export const codexAgentTargets = buildNamedTargetPaths(
  path.resolve(__dirname, "../.codex/agents"),
  codexAgentNames
);

function buildNamedTargetPaths(baseDir, names) {
  return Object.fromEntries(
    names.map((name) => [name, path.join(baseDir, name)])
  );
}

function validateGeneratedFilename(name, field, extension) {
  if (
    typeof name !== "string" ||
    !name ||
    name.trim() !== name ||
    path.isAbsolute(name) ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(name) ||
    !new RegExp(`^[a-z0-9][a-z0-9._-]*\\.${extension}$`, "u").test(name)
  ) {
    throw new Error(`Invalid ${field} generated filename: ${JSON.stringify(name)}`);
  }
}

function validateGeneratedArray(value, field, extension) {
  if (!Array.isArray(value)) {
    throw new Error(`reference/skill-layout.json must define ${field} as an array`);
  }
  const seen = new Set();
  return value.map((name) => {
    validateGeneratedFilename(name, field, extension);
    const folded = name.toLowerCase();
    if (seen.has(folded)) {
      throw new Error(`Duplicate ${field} generated filename: ${name}`);
    }
    seen.add(folded);
    return name;
  });
}

export function validateGeneratedSkillLayout(parsed) {

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error("reference/skill-layout.json must contain an object");
  }

  return {
    skillReferences: validateGeneratedArray(
      parsed.skillReferences,
      "skillReferences",
      "md"
    ),
    skillScripts: validateGeneratedArray(parsed.skillScripts, "skillScripts", "mjs"),
    codexAgents: validateGeneratedArray(parsed.codexAgents, "codexAgents", "toml"),
    claudeAgents: validateGeneratedArray(parsed.claudeAgents, "claudeAgents", "md"),
  };
}

function readSkillLayout() {
  return validateGeneratedSkillLayout(
    JSON.parse(readFileSync(skillLayoutPath, "utf8"))
  );
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

export async function readClaudeSkillAppendix() {
  return (await readFile(claudeSkillAppendixPath, "utf8")).trim();
}

export function buildPlatformSkillBody(platform, body, claudeAppendix) {
  return platform === "claude"
    ? `${body.trim()}\n\n${claudeAppendix.trim()}`
    : body.trim();
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

export async function readCodexAgentSource(name) {
  return readNamedSource({
    dir: codexAgentSourceDir,
    names: codexAgentNames,
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

function generatedDirectorySpecs() {
  return [
    {
      dir: path.dirname(skillTargets.codex.path),
      expected: new Set(["SKILL.md", "model-policy.json", "agents", "references", "scripts"]),
      managed: () => true,
    },
    {
      dir: path.dirname(skillTargets.claude.path),
      expected: new Set(["SKILL.md", "model-policy.json", "references", "scripts"]),
      managed: () => true,
    },
    {
      dir: path.dirname(agentTargetPath),
      expected: new Set([path.basename(agentTargetPath)]),
      managed: () => true,
    },
    ...Object.entries(skillReferenceTargets).map(([platform, targets]) => ({
      dir: path.join(path.dirname(skillTargets[platform].path), "references"),
      expected: new Set(Object.keys(targets)),
      managed: () => true,
    })),
    ...Object.entries(skillScriptTargets).map(([platform, targets]) => ({
      dir: path.join(path.dirname(skillTargets[platform].path), "scripts"),
      expected: new Set(Object.keys(targets)),
      managed: () => true,
    })),
    {
      dir: path.resolve(__dirname, "../.codex/agents"),
      expected: new Set(codexAgentNames),
      managed: (name) => name.startsWith("socrates-"),
    },
    {
      dir: path.resolve(__dirname, "../.claude/agents"),
      expected: new Set(claudeAgentNames),
      managed: (name) => name.startsWith("socrates-"),
    },
  ];
}

export async function findUnexpectedGeneratedPaths() {
  const unexpected = [];
  for (const spec of generatedDirectorySpecs()) {
    let entries;
    try {
      entries = await readdir(spec.dir, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (spec.managed(entry.name) && !spec.expected.has(entry.name)) {
        unexpected.push(path.join(spec.dir, entry.name));
      }
    }
  }
  return [...new Set(unexpected)].sort();
}

export async function pruneUnexpectedGeneratedPaths() {
  const unexpected = await findUnexpectedGeneratedPaths();
  for (const target of unexpected) {
    await rm(target, { recursive: true, force: true });
  }
  return unexpected;
}
