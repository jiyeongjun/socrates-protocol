import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CI covers supported Node LTS lines and rejects all generated drift", async () => {
  const workflow = await readFile(
    path.join(repoRoot, ".github/workflows/test.yml"),
    "utf8"
  );
  const pkg = JSON.parse(
    await readFile(path.join(repoRoot, "package.json"), "utf8")
  );

  assert.equal(pkg.engines.node, ">=22");
  assert.match(workflow, /uses: actions\/checkout@v5/);
  assert.match(workflow, /uses: actions\/setup-node@v6/);
  assert.match(workflow, /node:\s*\[22, 24\]/);
  assert.match(workflow, /node-version:\s*\$\{\{ matrix\.node \}\}/);
  assert.doesNotMatch(workflow, /skills\/socrates\//);

  const orderedCommands = [
    "npm run build:skills",
    "git diff --exit-code",
    "git ls-files --others --exclude-standard",
    "npm run verify:skills",
    "npm run verify:release-assets",
    "npm test",
  ];
  let previous = -1;
  for (const command of orderedCommands) {
    const current = workflow.indexOf(command);
    assert.ok(current > previous, `${command} must appear in verification order`);
    previous = current;
  }
});
