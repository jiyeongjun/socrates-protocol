import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildSkillDocument,
  codexAgentNames,
  codexAgentTargets,
  claudeAgentNames,
  claudeAgentTargets,
  readAgentPromptSource,
  readCodexAgentSource,
  readClaudeAgentSource,
  readSkillBody,
  readSkillReferenceSource,
  readSkillScriptSource,
  pruneUnexpectedGeneratedPaths,
  skillReferenceNames,
  skillReferenceTargets,
  skillScriptNames,
  skillScriptTargets,
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
  await mkdir(path.dirname(target.path), { recursive: true });
  await writeFile(target.path, output, "utf8");
}

await mkdir(path.dirname(agentTargetPath), { recursive: true });
await writeFile(
  agentTargetPath,
  buildOpenAIYaml({ promptSource }),
  "utf8"
);

for (const targets of Object.values(skillReferenceTargets)) {
  for (const name of skillReferenceNames) {
    const contents = await readSkillReferenceSource(name);
    await writeTextFile(targets[name], contents);
  }
}

for (const targets of Object.values(skillScriptTargets)) {
  for (const name of skillScriptNames) {
    const contents = await readSkillScriptSource(name);
    await writeTextFile(targets[name], contents);
  }
}

for (const name of claudeAgentNames) {
  const contents = await readClaudeAgentSource(name);
  await writeTextFile(claudeAgentTargets[name], contents);
}

for (const name of codexAgentNames) {
  const contents = await readCodexAgentSource(name);
  await writeTextFile(codexAgentTargets[name], contents);
}

await pruneUnexpectedGeneratedPaths();
