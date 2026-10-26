import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGroundedCommand, loadGroundedSkillBundle, modelMatrix, runGroundedEvals } from '../evals/run-grounded-evals.mjs';
import { buildAlignmentCommand } from '../evals/run-alignment-evals.mjs';
import { runProcess } from '../evals/run-live-evals.mjs';

test('grounded matrix pins six models and two efforts without fallback or permission bypass', () => {
  assert.equal(modelMatrix.length, 12);
  assert.equal(new Set(modelMatrix.map(c => c.model)).size, 6);
  for (const config of modelMatrix) {
    const c = buildGroundedCommand({ ...config, cwd: '/tmp', input: 'literal $HOME `echo no`\nnext', env: {} });
    assert.equal(c.args[c.args.indexOf('--model') + 1], config.model);
    assert.equal(c.input, 'literal $HOME `echo no`\nnext');
    assert.ok(!c.args.includes(c.input));
    assert.ok(!c.args.some(a => /bypass|dangerously|fallback|allowedTools/.test(a)));
    if (config.host === 'claude') {
      assert.equal(c.args[c.args.indexOf('--effort') + 1], config.effort);
      assert.equal(c.args[c.args.indexOf('--tools') + 1], '');
    } else assert.ok(c.args.includes(`model_reasoning_effort="${config.effort}"`));
  }
});

test('current full bundle includes the exact canonical reviewer policy', async () => {
  const policy = await readFile(new URL('../reference/skill-references/response-review.md', import.meta.url), 'utf8');
  const { sources, bundle } = await loadGroundedSkillBundle();
  assert.equal(sources.length, 6);
  assert.equal(sources.find(source => source.path === 'reference/skill-references/response-review.md')?.text, policy);
  assert.ok(bundle.includes(`--- reference/skill-references/response-review.md ---\n${policy}`));
});

test('author bundle separates reviewer-only instructions while preserving the legacy all-role stress mode', async () => {
  const all = await loadGroundedSkillBundle();
  const author = await loadGroundedSkillBundle(undefined, 'author');
  assert.equal(author.sources.length, 5);
  assert.deepEqual(author.sources, all.sources.filter(s => !s.path.endsWith('/response-review.md')));
  assert.ok(!author.bundle.includes('# Review a Socrates response'));
  assert.ok(all.bundle.includes('# Review a Socrates response'));
  await assert.rejects(loadGroundedSkillBundle(undefined, 'invalid'), /Unknown bundle mode/);
});

test('native process stdin preserves literal prompts without shell evaluation', async () => {
  const input = '$HOME `touch unexpected` $(echo no)\n한국어';
  const result = await runProcess({ command: process.execPath, args: ['-e', 'process.stdin.pipe(process.stdout)'], cwd: process.cwd(), input }, 5000);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, input);
  assert.equal(result.error, null);
});

test('grounded runner rejects unauthorized calls and invalid selections before invoking a model', async () => {
  await assert.rejects(runGroundedEvals({}), /authorize/);
  await assert.rejects(runGroundedEvals({ SOCRATES_LIVE_EVAL: '1', SOCRATES_GROUNDED_CASES: 'unknown' }), /Unknown/);
  assert.throws(() => buildGroundedCommand({ host: 'claude', effort: 'typo' }), /effort/);
  assert.throws(() => buildGroundedCommand({ host: 'unknown', effort: 'low' }), /host/);
});

test('writable alignment honors explicit effort and uses stdin on initial and resumed turns', () => {
  for (const host of ['claude', 'codex']) {
    for (const sessionId of [undefined, 'exact-session']) {
      const c = buildAlignmentCommand({ host, model: 'pinned-model', workspace: '/tmp', prompt: 'literal $HOME', sessionId, env: { SOCRATES_ALIGNMENT_EFFORT: 'low' } });
      assert.ok(c.input.includes('literal $HOME'));
      assert.ok(!c.args.includes(c.input));
      if (host === 'claude') assert.equal(c.args[c.args.indexOf('--effort') + 1], 'low');
      else assert.ok(c.args.includes('model_reasoning_effort="low"'));
    }
  }
});
