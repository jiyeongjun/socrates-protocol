import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditSkillReads, buildNativeResponseCommand, runNativeResponseEvals, snapshotSkillBundle } from '../evals/run-native-response-evals.mjs';

const dir = '.claude/skills/socrates';
const read = (name, id = name, options = {}) => ({ name: 'Read', id, input: { file_path: `${dir}/${name}`, ...options } });
const result = (id, content, options = {}) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content, ...options }] } });

async function withSkill(action) {
  const workspace = await mkdtemp(path.join(tmpdir(), 'socrates-read-audit-'));
  try {
    await mkdir(path.join(workspace, dir, 'references'), { recursive: true });
    await writeFile(path.join(workspace, dir, 'SKILL.md'), 'skill\nrule\n');
    await writeFile(path.join(workspace, dir, 'references/guided-learning.md'), 'guide\n');
    await action(workspace);
  } finally { await rm(workspace, { recursive: true, force: true }); }
}

const skillResult = result('SKILL.md', '1\tskill\n2\trule');
const guideResult = result('references/guided-learning.md', '1\tguide');

test('native response audit requires a complete successful skill read first and rejects unrelated or symlink-escaped reads', async () => {
  await withSkill(async workspace => {
    await writeFile(path.join(workspace, 'outside.md'), 'not skill evidence');
    await symlink(path.join(workspace, 'outside.md'), path.join(workspace, dir, 'references/visual-explanations.md'));
    const good = await auditSkillReads([read('SKILL.md'), read('references/guided-learning.md')], workspace, [skillResult, guideResult]);
    assert.equal(good.skillLoaded, true);
    assert.deepEqual(good.reads, ['SKILL.md', 'references/guided-learning.md']);
    assert.deepEqual(good.unexpected, []);
    assert.deepEqual(good.readErrors, []);
    assert.equal((await auditSkillReads([read('references/guided-learning.md'), read('SKILL.md')], workspace, [guideResult, skillResult])).skillLoaded, false);
    assert.equal((await auditSkillReads([], workspace)).skillLoaded, false);
    const bad = await auditSkillReads([read('SKILL.md'), read('outside', 'outside', { file_path: 'outside.md' }), read('references/visual-explanations.md'), { name: 'Bash' }], workspace, [skillResult]);
    assert.equal(bad.unexpected.length, 3);
    const absolute = read('SKILL.md', 'SKILL.md', { file_path: path.join(workspace, dir, 'SKILL.md') });
    assert.equal((await auditSkillReads([absolute], workspace, [skillResult])).skillLoaded, true);
  });
});

test('requested paths alone cannot establish loading: missing, failed and mismatched results fail closed', async () => {
  await withSkill(async workspace => {
    for (const events of [
      [],
      [result('different-id', '1\tskill\n2\trule')],
      [result('SKILL.md', 'Read failed', { is_error: true })],
      [skillResult, skillResult],
      [result('SKILL.md', '1\tskill\n2\ta different rule')],
      [result('SKILL.md', 'skill\nrule')],
    ]) {
      const audit = await auditSkillReads([read('SKILL.md')], workspace, events);
      assert.equal(audit.skillLoaded, false);
      assert.equal(audit.readErrors.length, 1);
      assert.deepEqual(audit.reads, []);
    }
    const failedReference = await auditSkillReads([read('SKILL.md'), read('references/guided-learning.md')], workspace,
      [skillResult, result('references/guided-learning.md', 'Read failed', { is_error: true })]);
    assert.equal(failedReference.skillLoaded, true);
    assert.equal(failedReference.readErrors.length, 1);
  });
});

test('partial, offset and truncated skill reads do not count as full loading; a complete bounded read does', async () => {
  await withSkill(async workspace => {
    for (const [options, content] of [
      [{ limit: 1 }, '1\tskill'],
      [{ offset: 2 }, '2\trule'],
      [{}, '1\tskill\n[output truncated]'],
      [{}, '1\tskill\n3\trule'],
    ]) {
      const audit = await auditSkillReads([read('SKILL.md', 'SKILL.md', options)], workspace, [result('SKILL.md', content)]);
      assert.equal(audit.skillLoaded, false);
      assert.equal(audit.readErrors.length, 1);
    }
    const full = await auditSkillReads([read('SKILL.md', 'SKILL.md', { offset: 1, limit: 20 })], workspace,
      [result('SKILL.md', [{ type: 'text', text: '1\tskill\n2\trule\n' }])]);
    assert.equal(full.skillLoaded, true);
    assert.deepEqual(full.readErrors, []);
  });
});

test('Claude Read may include or omit the numbered empty segment after the final newline', async () => {
  await withSkill(async workspace => {
    await writeFile(path.join(workspace, dir, 'SKILL.md'), '---\nname: socrates\n---\n\n# Socrates\n\n');
    const numbered = '1\t---\n2\tname: socrates\n3\t---\n4\t\n5\t# Socrates\n6\t';
    for (const content of [numbered, `${numbered}\n7\t`]) {
      const audit = await auditSkillReads([read('SKILL.md')], workspace, [result('SKILL.md', content)]);
      assert.equal(audit.skillLoaded, true);
      assert.deepEqual(audit.readErrors, []);
    }
    // A terminal empty segment is optional; an actual blank source line is not.
    const missingBlank = await auditSkillReads([read('SKILL.md')], workspace,
      [result('SKILL.md', '1\t---\n2\tname: socrates\n3\t---\n4\t\n5\t# Socrates')]);
    assert.equal(missingBlank.skillLoaded, false);
    assert.equal(missingBlank.readErrors.length, 1);
    // Do not permit an invented final empty line when the source lacks a newline.
    await writeFile(path.join(workspace, dir, 'SKILL.md'), 'skill\nrule');
    const invented = await auditSkillReads([read('SKILL.md')], workspace,
      [result('SKILL.md', '1\tskill\n2\trule\n3\t')]);
    assert.equal(invented.skillLoaded, false);
  });
});

test('skill snapshot hashes and case inputs stay tied to captured bytes after source edits', async () => {
  await withSkill(async workspace => {
    for (const name of ['implementation-alignment', 'visual-explanations', 'audience-calibration']) {
      await writeFile(path.join(workspace, dir, `references/${name}.md`), name);
    }
    const snapshot = path.join(workspace, 'snapshot');
    const hashes = await snapshotSkillBundle(workspace, snapshot);
    await writeFile(path.join(workspace, dir, 'SKILL.md'), 'changed after run started');
    const captured = await readFile(path.join(snapshot, 'SKILL.md'), 'utf8');
    assert.equal(captured, 'skill\nrule\n');
    assert.equal(hashes['SKILL.md'], createHash('sha256').update(captured).digest('hex'));
    assert.equal(Object.keys(hashes).length, 5);
  });
});

test('native response invocation permits only Read and preserves explicit model, effort and literal stdin', () => {
  const c = buildNativeResponseCommand({ model: 'claude-haiku-5-5', effort: 'low', cwd: '/tmp', input: 'literal $HOME `echo nope`', env: {} });
  for (const [arg, value] of [['--tools', 'Read'], ['--allowedTools', 'Read'], ['--model', 'claude-haiku-5-5'], ['--effort', 'low']]) assert.equal(c.args[c.args.indexOf(arg) + 1], value);
  assert.ok(!c.args.some(s => /bypass|dangerously|fallback/.test(s)));
  assert.equal(c.input, 'literal $HOME `echo nope`');
});

test('native response runner refuses unauthorized or unknown cases before invoking a model', async () => {
  await assert.rejects(runNativeResponseEvals({}), /authorize/);
  await assert.rejects(runNativeResponseEvals({ SOCRATES_LIVE_EVAL: '1', SOCRATES_NATIVE_CASES: 'missing' }), /Unknown/);
});

test('runner fails invalid reads despite a successful process and preserves the audited snapshot', async () => {
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), 'socrates-native-stub-')));
  try {
    const stub = path.join(workspace, 'fake-claude.mjs');
    await writeFile(stub, `#!/usr/bin/env node
import {readFileSync} from 'node:fs';
const text=readFileSync('.claude/skills/socrates/SKILL.md','utf8');
const content=process.env.FAKE_READ_MODE==='partial' ? '1\\t'+text.split('\\n')[0] : text.split('\\n').map((line,index)=>(index+1)+'\\t'+line).join('\\n');
const events=[
 {type:'assistant',message:{model:'claude-haiku-5-5',content:[{type:'tool_use',id:'skill',name:'Read',input:{file_path:'.claude/skills/socrates/SKILL.md'}}]}},
 {type:'user',message:{content:[{type:'tool_result',tool_use_id:'skill',content,is_error:process.env.FAKE_READ_MODE==='error'}]}},
 {type:'result',is_error:false,result:'Stub response',session_id:'stub'}
];
process.stdin.resume();
process.stdin.on('end',()=>console.log(events.map(JSON.stringify).join('\\n')));
`, { mode: 0o700 });
    const cases = JSON.parse(await readFile(new URL('../evals/grounded-learning-cases.json', import.meta.url), 'utf8'));
    for (const mode of ['error', 'partial', 'complete']) {
      const report = await runNativeResponseEvals({ ...process.env,
        SOCRATES_LIVE_EVAL: '1', SOCRATES_NATIVE_MODEL: 'claude-haiku-5-5', SOCRATES_NATIVE_EFFORT: 'low',
        SOCRATES_NATIVE_CASES: cases[0].id, SOCRATES_NATIVE_CONCURRENCY: '1',
        SOCRATES_NATIVE_OUTPUT: workspace, SOCRATES_GROUNDED_CLAUDE_BIN: stub, FAKE_READ_MODE: mode,
      });
      assert.equal(report.results[0].process.code, 0);
      assert.equal(report.results[0].executionOk, mode === 'complete');
      assert.equal(report.status, mode === 'complete' ? 'completed' : 'execution-failed');
      assert.equal(report.results[0].readErrors.length, mode === 'complete' ? 0 : 1);
    }
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
