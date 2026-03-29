import { writeFile } from "node:fs/promises";
import {
  buildOpenAIYaml,
  buildSkillDocument,
  readAgentPromptSource,
  readSkillBody,
  skillTargets,
} from "./skill-generator.mjs";

const body = await readSkillBody();
const promptSource = await readAgentPromptSource();

for (const target of Object.values(skillTargets)) {
  const output = buildSkillDocument({
    frontmatter: target.frontmatter,
    body,
  });
  await writeFile(target.path, output, "utf8");
}

await writeFile(
  new URL("../.agents/skills/socrates/agents/openai.yaml", import.meta.url),
  buildOpenAIYaml({ promptSource }),
  "utf8"
);
