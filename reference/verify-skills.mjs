import { readFile } from "node:fs/promises";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildSkillDocument,
  claudeAgentNames,
  claudeAgentTargets,
  readAgentPromptSource,
  readClaudeAgentSource,
  readSkillBody,
  readSkillReferenceSource,
  skillReferenceNames,
  skillReferenceTargets,
  skillTargets,
} from "./skill-generator.mjs";

const body = await readSkillBody();
const promptSource = await readAgentPromptSource();
let hasMismatch = false;

for (const [name, target] of Object.entries(skillTargets)) {
  const expected = buildSkillDocument({
    frontmatter: target.frontmatter,
    body,
  });
  const actual = await readFile(target.path, "utf8");

  if (actual !== expected) {
    hasMismatch = true;
    console.error(`${name} skill is out of sync with reference/skill-body.md`);
  }
}

for (const [platform, targets] of Object.entries(skillReferenceTargets)) {
  for (const name of skillReferenceNames) {
    const expected = `${await readSkillReferenceSource(name)}\n`;
    const actual = await readFile(targets[name], "utf8");

    if (actual !== expected) {
      hasMismatch = true;
      console.error(
        `${platform} skill reference ${name} is out of sync with reference/skill-references/${name}`
      );
    }
  }
}

for (const name of claudeAgentNames) {
  const expected = `${await readClaudeAgentSource(name)}\n`;
  const actual = await readFile(claudeAgentTargets[name], "utf8");

  if (actual !== expected) {
    hasMismatch = true;
    console.error(
      `claude subagent ${name} is out of sync with reference/claude-agents/${name}`
    );
  }
}

const expectedAgent = buildOpenAIYaml({ promptSource });
const actualAgent = await readFile(agentTargetPath, "utf8");

if (actualAgent !== expectedAgent) {
  hasMismatch = true;
  console.error("openai agent yaml is out of sync with reference/openai-default-prompt.txt");
}

if (hasMismatch) {
  console.error("Run `npm run build:skills` and commit the regenerated generated files.");
  process.exit(1);
}
