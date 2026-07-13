import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  agentTargetPath,
  buildOpenAIYaml,
  buildPlatformSkillBody,
  buildSkillDocument,
  codexAgentNames,
  codexAgentTargets,
  claudeAgentNames,
  claudeAgentTargets,
  readAgentPromptSource,
  readCodexAgentSource,
  readClaudeAgentSource,
  readClaudeSkillAppendix,
  readModelPolicySource,
  readSkillBody,
  readSkillReferenceSource,
  readSkillScriptSource,
  modelPolicyTargetPaths,
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
const claudeAppendix = await readClaudeSkillAppendix();
const promptSource = await readAgentPromptSource();
const modelPolicy = await readModelPolicySource();

for (const [platform, target] of Object.entries(skillTargets)) {
  const output = buildSkillDocument({
    frontmatter: target.frontmatter,
    body: buildPlatformSkillBody(platform, body, claudeAppendix),
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

for (const [platform, targets] of Object.entries(skillScriptTargets)) {
  for (const name of skillScriptNames) {
    const contents = await readSkillScriptSource(name);
    await writeTextFile(targets[name], contents);
  }
}

for (const target of Object.values(modelPolicyTargetPaths)) {
  await writeTextFile(target, modelPolicy);
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
