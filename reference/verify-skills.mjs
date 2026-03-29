import { readFile } from "node:fs/promises";
import {
  buildOpenAIYaml,
  buildSkillDocument,
  readAgentPromptSource,
  readSkillBody,
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

const agentPath = new URL("../.agents/skills/socrates/agents/openai.yaml", import.meta.url);
const expectedAgent = buildOpenAIYaml({ promptSource });
const actualAgent = await readFile(agentPath, "utf8");

if (actualAgent !== expectedAgent) {
  hasMismatch = true;
  console.error("openai agent yaml is out of sync with reference/openai-default-prompt.txt");
}

if (hasMismatch) {
  console.error("Run `npm run build:skills` and commit the regenerated generated files.");
  process.exit(1);
}
