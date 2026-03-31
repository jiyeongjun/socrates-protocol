import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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

async function writeTextFile(target, contents) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${contents}\n`, "utf8");
}

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
  agentTargetPath,
  buildOpenAIYaml({ promptSource }),
  "utf8"
);

for (const [platform, targets] of Object.entries(skillReferenceTargets)) {
  for (const name of skillReferenceNames) {
    const contents = await readSkillReferenceSource(name);
    await writeTextFile(targets[name], contents);
  }
}

for (const name of claudeAgentNames) {
  const contents = await readClaudeAgentSource(name);
  await writeTextFile(claudeAgentTargets[name], contents);
}
