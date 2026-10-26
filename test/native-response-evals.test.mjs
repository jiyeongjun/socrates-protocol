import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditNativeModels, auditNativeReviews, auditSkillReads, buildNativeResponseCommand, runNativeResponseEvals, snapshotSkillBundle } from '../evals/run-native-response-evals.mjs';

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

test('new review reference is optional for historical snapshots, audited when present, and cannot replace missing required files', async () => {
  await withSkill(async workspace => {
    for (const name of ['implementation-alignment', 'visual-explanations', 'audience-calibration']) {
      await writeFile(path.join(workspace, dir, `references/${name}.md`), name);
    }
    const historical = await snapshotSkillBundle(workspace, path.join(workspace, 'historical'));
    assert.equal(Object.keys(historical).length, 5);
    assert.equal(historical['references/response-review.md'], undefined);
    await writeFile(path.join(workspace, dir, 'references/response-review.md'), 'review policy\n');
    const current = await snapshotSkillBundle(workspace, path.join(workspace, 'current'));
    assert.equal(Object.keys(current).length, 6);
    assert.equal(current['references/response-review.md'], createHash('sha256').update('review policy\n').digest('hex'));
    const audit = await auditSkillReads([read('SKILL.md'), read('references/response-review.md')], workspace,
      [skillResult, result('references/response-review.md', '1\treview policy')]);
    assert.deepEqual(audit.reads, ['SKILL.md', 'references/response-review.md']);
    assert.deepEqual(audit.readErrors, []);
    for (const [index, file] of Object.keys(historical).entries()) {
      const original = await readFile(path.join(workspace, dir, file));
      await rm(path.join(workspace, dir, file));
      await assert.rejects(snapshotSkillBundle(workspace, path.join(workspace, `missing-${index}`)), { code: 'ENOENT' });
      await writeFile(path.join(workspace, dir, file), original);
    }
  });
});

test('native response invocation permits only Read and preserves explicit model, effort and literal stdin', () => {
  const c = buildNativeResponseCommand({ model: 'claude-haiku-5-5', effort: 'low', cwd: '/tmp', input: 'literal $HOME `echo nope`', env: {} });
  for (const [arg, value] of [['--tools', 'Read'], ['--allowedTools', 'Read'], ['--model', 'claude-haiku-5-5'], ['--effort', 'low']]) assert.equal(c.args[c.args.indexOf(arg) + 1], value);
  assert.ok(!c.args.some(s => /bypass|dangerously|fallback/.test(s)));
  assert.equal(c.input, 'literal $HOME `echo nope`');
});

test('native review opt-in adds only Agent and TaskOutput without changing the requested model', () => {
  const c = buildNativeResponseCommand({ model: 'claude-haiku-5-5', effort: 'low', cwd: '/tmp', input: 'request', env: { SOCRATES_NATIVE_REVIEW: '1' } });
  for (const arg of ['--tools', '--allowedTools']) assert.equal(c.args[c.args.indexOf(arg) + 1], 'Read,Agent,TaskOutput');
  assert.equal(c.args[c.args.indexOf('--model') + 1], 'claude-haiku-5-5');
  assert.ok(!c.args.some(s => /bypass|dangerously|fallback/.test(s)));
  assert.ok(!c.args.includes('--agents'));
  const reviewerPrompt = '# Review policy\nUse the original request and entire draft. No tools or delegation.\n';
  const selected = buildNativeResponseCommand({ model: 'claude-haiku-5-5', effort: 'low', cwd: '/tmp', input: '', reviewerPrompt,
    env: { SOCRATES_NATIVE_REVIEW: '1', SOCRATES_NATIVE_REVIEW_MODEL: 'claude-opus-5-5' } });
  const reviewer = JSON.parse(selected.args[selected.args.indexOf('--agents') + 1])['socrates-reviewer'];
  assert.equal(reviewer.model, 'claude-opus-5-5');
  assert.deepEqual(reviewer.tools, []);
  assert.equal(reviewer.prompt, reviewerPrompt);
  assert.equal(selected.args[selected.args.indexOf('--model') + 1], 'claude-haiku-5-5');
  assert.throws(() => buildNativeResponseCommand({ model: 'claude-haiku-5-5', effort: 'low', cwd: '/tmp', input: '',
    env: { SOCRATES_NATIVE_REVIEW_MODEL: 'claude-opus-5-5' } }), /requires/);
  assert.throws(() => buildNativeResponseCommand({ model: 'claude-haiku-5-5', effort: 'low', cwd: '/tmp', input: '',
    env: { SOCRATES_NATIVE_REVIEW: '1', SOCRATES_NATIVE_REVIEW_MODEL: 'claude-opus-5-5' } }), /canonical reviewer policy/);
});

const agent = { type: 'tool_use', id: 'review', name: 'Agent', input: { prompt: 'Review this draft without tools.' } };
const wait = { type: 'tool_use', id: 'wait', name: 'TaskOutput', input: { task_id: 'agent-1', block: true } };
const call = (tool, extra = {}) => ({ type: 'assistant', message: { model: 'claude-haiku-5-5', content: [tool] }, ...extra });
const launched = { ...result('review', [{ type: 'text', text: 'Async agent launched successfully.\nagentId: agent-1\noutput_file: /private/internal-output' }]),
  tool_use_result: { isAsync: true, status: 'async_launched', agentId: 'agent-1', resolvedModel: 'claude-haiku-5-5' } };
const findings = 'Claim: replace “delivered twice” with “called twice”; the dependency outcome is unspecified.';
const notification = { type: 'system', subtype: 'task_notification', task_id: 'agent-1', tool_use_id: 'review', status: 'completed', summary: findings, usage: { tool_uses: 0 } };
const answer = { type: 'assistant', message: { model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'Final answer.' }] } };
const final = { type: 'result', result: 'Final answer.' };
const reviewOptions = { allowReview: true, reviewRequired: true, expectedReviewerModel: 'claude-haiku-5-5' };

test('async launch metadata is not a review; completed findings require exact provenance before the final answer', () => {
  const prefix = [call(agent), launched];
  const incomplete = auditNativeReviews([agent], [...prefix, answer, final], reviewOptions);
  assert.equal(incomplete.reviewAttempts[0].launched, true);
  assert.equal(incomplete.reviewPerformed, false);
  assert.equal(incomplete.requiredReviewMet, false);
  assert.deepEqual(incomplete.reviewErrors, []); // Protocol miss must not skip later cases.
  for (const notice of [
    { ...notification, task_id: 'other' },
    { ...notification, tool_use_id: 'other' },
    { ...notification, status: 'running' },
    { ...notification, summary: '' },
    { ...notification, summary: 'completed' },
    { ...notification, summary: 'Async agent launched successfully.' },
    { type: 'user', message: { content: [{ type: 'text', text: findings }] } },
  ]) assert.equal(auditNativeReviews([agent], [...prefix, notice, answer, final], reviewOptions).reviewPerformed, false);
  assert.equal(auditNativeReviews([agent], [...prefix, answer, notification, final], reviewOptions).reviewPerformed, false);
  // Native CLI can emit a waiting response, then a notification, then another final turn.
  assert.equal(auditNativeReviews([agent], [...prefix, answer, notification, answer, final, final], reviewOptions).reviewPerformed, true);
  const completed = auditNativeReviews([agent], [...prefix, notification, answer, final], reviewOptions);
  assert.equal(completed.reviewPerformed, true);
  assert.equal(completed.requiredReviewMet, true);
  assert.equal(completed.reviews[0].response, findings);
  assert.equal(completed.reviews[0].modelMatches, true);
  assert.equal(completed.reviews[0].effortEvidence, 'unavailable');
  assert.deepEqual(completed.reviewErrors, []);
});

test('failed, missing, duplicate or out-of-order Agent results fail execution audit', () => {
  for (const events of [
    [call(agent), notification, answer, final],
    [call(agent), launched, launched, notification, answer, final],
    [call(agent), result('review', 'permission denied', { is_error: true }), notification, answer, final],
    [launched, call(agent), notification, answer, final],
    [call(agent), result('other', 'No issues.'), notification, answer, final],
  ]) {
    const audit = auditNativeReviews([agent], events, reviewOptions);
    assert.equal(audit.reviewPerformed, false);
    assert.equal(audit.reviewErrors.length, 1);
  }
  const failed = auditNativeReviews([agent], [call(agent), launched, { ...notification, status: 'failed' }, answer, final], reviewOptions);
  assert.equal(failed.reviewPerformed, false);
  assert.match(failed.reviewErrors[0].reason, /failed/);
  const arbitrary = auditNativeReviews([agent], [call(agent), result('review', 'No issues.'), answer, final], reviewOptions);
  assert.equal(arbitrary.reviewPerformed, false); // Nonempty tool text has no completion envelope.
});

test('a completed retry does not erase a prior Agent input validation failure', () => {
  const rejected = { ...agent, id: 'invalid-model', input: { ...agent.input, model: 'claude-opus-5-5' } };
  const audit = auditNativeReviews([rejected, agent], [call(rejected),
    result('invalid-model', '<tool_use_error>InputValidationError: invalid_value at model; accepted values sonnet, opus, haiku, fable</tool_use_error>', { is_error: true }),
    call(agent), launched, notification, answer, final], reviewOptions);
  assert.equal(audit.reviewPerformed, true);
  assert.equal(audit.requiredReviewMet, true);
  assert.equal(audit.reviewErrors.length, 1);
  assert.equal(audit.reviewErrors[0].toolUseId, 'invalid-model');
});

test('TaskOutput requires a successful matching completed result, not a polling acknowledgment', () => {
  const text = `<retrieval_status>success</retrieval_status>\n<task_id>agent-1</task_id>\n<status>completed</status>\n<output>${findings}</output>`;
  const prefix = [call(agent), launched, call(wait)];
  for (const output of [
    result('wait', text),
    { ...result('wait', text), tool_use_result: { retrieval_status: 'success', task: { task_id: 'agent-1', status: 'completed', output: findings } } },
  ]) {
    const audit = auditNativeReviews([agent, wait], [...prefix, output, answer, final], reviewOptions);
    assert.equal(audit.reviewPerformed, true);
    assert.deepEqual(audit.reviewErrors, []);
  }
  for (const text of ['working', '<retrieval_status>timeout</retrieval_status>',
    `<retrieval_status>success</retrieval_status><task_id>other</task_id><status>completed</status><output>${findings}</output>`,
    '<retrieval_status>success</retrieval_status><task_id>agent-1</task_id><status>completed</status>']) {
    assert.equal(auditNativeReviews([agent, wait], [...prefix, result('wait', text), answer, final], reviewOptions).reviewPerformed, false);
  }
  for (const results of [[], [result('wait', 'failed', { is_error: true })], [result('wait', text), result('wait', text)]]) {
    const audit = auditNativeReviews([agent, wait], [...prefix, ...results, answer, final], reviewOptions);
    assert.equal(audit.reviewPerformed, false);
    assert.equal(audit.reviewErrors.length, 1);
  }
  const unrelated = { ...wait, input: { task_id: 'other' } };
  assert.match(auditNativeReviews([agent, unrelated], [call(agent), launched, call(unrelated), result('wait', text), answer, final], reviewOptions).reviewErrors[0].reason, /does not refer/);
});

test('user task notification requires IDs, completed status and explicit findings rather than status summary', () => {
  const notice = (body) => ({ type: 'user', message: { content: [{ type: 'text', text: `<task-notification><task-id>agent-1</task-id><tool-use-id>review</tool-use-id><status>completed</status>${body}</task-notification>` }] } });
  const audit = body => auditNativeReviews([agent], [call(agent), launched, notice(body), answer, final], reviewOptions);
  assert.equal(audit(`<result>${findings}</result>`).reviewPerformed, true);
  assert.equal(audit('<summary>Agent review completed.</summary>').reviewPerformed, false);
});

test('reviewer model mismatches and nested tool use are explicit; unobserved telemetry stays unavailable', () => {
  const wrongModel = { ...launched, tool_use_result: { ...launched.tool_use_result, resolvedModel: 'claude-opus-5-5' } };
  const mismatch = auditNativeReviews([agent], [call(agent), wrongModel, notification, answer, final], reviewOptions);
  assert.equal(mismatch.reviews[0].modelMatches, false);
  assert.match(mismatch.reviewErrors[0].reason, /model differs/);
  const selected = auditNativeReviews([agent], [call(agent), wrongModel, notification, answer, final],
    { ...reviewOptions, expectedReviewerModel: 'claude-opus-5-5' });
  assert.deepEqual(selected.reviewErrors, []);
  assert.equal(selected.reviews[0].modelMatches, true);
  const noModel = { ...launched, tool_use_result: { ...launched.tool_use_result, resolvedModel: undefined } };
  const unknown = auditNativeReviews([agent], [call(agent), noModel, { ...notification, usage: undefined }, answer, final], reviewOptions);
  assert.equal(unknown.reviews[0].modelMatches, null);
  assert.equal(unknown.reviews[0].reviewerToolAudit, 'unavailable');
  for (const name of ['Read', 'Agent']) {
    const nestedTool = { type: 'tool_use', id: 'nested', name, input: {} };
    const audit = auditNativeReviews([agent, nestedTool], [call(agent), launched,
      call(nestedTool, { parent_tool_use_id: 'review' }), notification, answer, final], reviewOptions);
    assert.ok(audit.reviewErrors.some(error => /Reviewer used tools or delegated/.test(error.reason)));
  }
  assert.match(auditNativeReviews([agent], [call(agent), launched, { ...notification, usage: { tool_uses: 1 } }, answer, final], reviewOptions).reviewErrors[0].reason, /reports tool use/);
});

test('native model audit separates parent and reviewer identities without allowing fallback', () => {
  const child = { ...answer, parent_tool_use_id: 'review', message: { ...answer.message, model: 'claude-opus-5-5' } };
  const expected = auditNativeModels([answer, child], 'claude-haiku-5-5', 'claude-opus-5-5');
  assert.equal(expected.parentModelMatches, true);
  assert.equal(expected.reviewerModelMatches, true);
  assert.deepEqual(expected.parentModelEvidence, ['claude-haiku-5-5']);
  assert.deepEqual(expected.reviewerModelEvidence, ['claude-opus-5-5']);
  assert.equal(auditNativeModels([answer, child], 'claude-haiku-5-5').reviewerModelMatches, false);
  assert.equal(auditNativeModels([answer, child], 'claude-opus-5-5', 'claude-opus-5-5').parentModelMatches, false);
  assert.equal(auditNativeModels([answer], 'claude-haiku-5-5').reviewerModelMatches, null);
});

test('Read path restrictions remain active with review enabled and controls do not require a review', async () => {
  await withSkill(async workspace => {
    const control = await auditSkillReads([read('SKILL.md')], workspace, [skillResult], { ...reviewOptions, reviewRequired: false });
    assert.equal(control.skillLoaded, true);
    assert.equal(control.reviewPerformed, false);
    assert.equal(control.requiredReviewMet, true);
    const nestedRead = { ...read('SKILL.md', 'nested'), type: 'tool_use' };
    const audit = await auditSkillReads([read('SKILL.md'), agent, nestedRead], workspace, [skillResult,
      call(agent), launched, call(nestedRead, { parent_tool_use_id: 'review' }), notification, answer, final], reviewOptions);
    assert.deepEqual(audit.unexpected, ['reviewer:Read']);
    const outside = await auditSkillReads([read('SKILL.md'), read('elsewhere')], workspace, [skillResult], reviewOptions);
    assert.equal(outside.unexpected.length, 1);
    const disabled = await auditSkillReads([read('SKILL.md'), agent, wait], workspace, [skillResult]);
    assert.deepEqual(disabled.unexpected, ['Agent', 'TaskOutput']);
  });
});

test('native response runner refuses unauthorized or unknown cases before invoking a model', async () => {
  await assert.rejects(runNativeResponseEvals({}), /authorize/);
  await assert.rejects(runNativeResponseEvals({ SOCRATES_LIVE_EVAL: '1', SOCRATES_NATIVE_CASES: 'missing' }), /Unknown/);
});

test('custom case definitions require string IDs, nonempty prompts, boolean review metadata and unique IDs', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'socrates-case-validation-'));
  try {
    const caseFile = path.join(workspace, 'cases.json');
    for (const cases of [[], [{ prompt: 'request' }], [{ id: 1, prompt: 'request' }], [{ id: '../escape', prompt: 'request' }],
      [{ id: 'valid', prompt: ' ' }], [{ id: 'valid', prompt: 'request', reviewRequired: 'false' }],
      [{ id: 'same', prompt: 'request' }, { id: 'same', prompt: 'other' }]]) {
      await writeFile(caseFile, JSON.stringify(cases));
      await assert.rejects(runNativeResponseEvals({ SOCRATES_LIVE_EVAL: '1', SOCRATES_NATIVE_CASE_FILE: caseFile }), /Invalid or duplicate case definitions/);
    }
  } finally { await rm(workspace, { recursive: true, force: true }); }
});

test('runner fails invalid reads despite a successful process and preserves the audited snapshot', async () => {
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), 'socrates-native-stub-')));
  try {
    const stub = path.join(workspace, 'fake-claude.mjs');
    await writeFile(stub, `#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
if(process.env.FAKE_EXPECT_REVIEW_HASH) {
 const policy=JSON.parse(process.argv[process.argv.indexOf('--agents')+1])['socrates-reviewer'].prompt;
 if(createHash('sha256').update(policy).digest('hex')!==process.env.FAKE_EXPECT_REVIEW_HASH) throw Error('Reviewer policy was not wired to CLI');
}
const text=readFileSync('.claude/skills/socrates/SKILL.md','utf8');
const content=process.env.FAKE_READ_MODE==='partial' ? '1\\t'+text.split('\\n')[0] : text.split('\\n').map((line,index)=>(index+1)+'\\t'+line).join('\\n');
const events=[
 {type:'assistant',message:{model:'claude-haiku-5-5',content:[{type:'tool_use',id:'skill',name:'Read',input:{file_path:'.claude/skills/socrates/SKILL.md'}}]}},
 {type:'user',message:{content:[{type:'tool_result',tool_use_id:'skill',content,is_error:process.env.FAKE_READ_MODE==='error'}]}},
 {type:'result',is_error:false,result:'Stub response',session_id:'stub'}
];
let input='';
process.stdin.on('data',chunk=>input+=chunk);
process.stdin.on('end',()=>{
 if(process.env.FAKE_EXPECT_REVIEW_HASH && !input.includes('Set Agent subagent_type to socrates-reviewer and omit the Agent model parameter')) throw Error('Missing configured reviewer invocation guidance');
 console.log(events.map(JSON.stringify).join('\\n'));
});
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
    const policy = await readFile(new URL('../reference/skill-references/response-review.md', import.meta.url), 'utf8');
    const policyHash = createHash('sha256').update(policy).digest('hex');
    const baseline = path.join(workspace, 'baseline');
    await mkdir(path.join(baseline, dir, 'references'), { recursive: true });
    for (const file of ['SKILL.md', ...['guided-learning', 'implementation-alignment', 'visual-explanations', 'audience-calibration'].map(name => `references/${name}.md`)]) {
      await writeFile(path.join(baseline, dir, file), 'historical bundle\n');
    }
    const missingReviews = await runNativeResponseEvals({ ...process.env,
      SOCRATES_LIVE_EVAL: '1', SOCRATES_NATIVE_MODEL: 'claude-haiku-5-5', SOCRATES_NATIVE_EFFORT: 'low',
      SOCRATES_NATIVE_CASES: 'minimum-equivalent,invalid-premise,transfer-repair,changed-evidence',
      SOCRATES_NATIVE_REVIEW: '1', SOCRATES_NATIVE_REVIEW_MODEL: 'claude-opus-5-5', SOCRATES_NATIVE_CONCURRENCY: '1',
      SOCRATES_NATIVE_SOURCE_ROOT: baseline, FAKE_EXPECT_REVIEW_HASH: policyHash,
      SOCRATES_NATIVE_OUTPUT: workspace, SOCRATES_GROUNDED_CLAUDE_BIN: stub, FAKE_READ_MODE: 'complete',
    });
    assert.equal(missingReviews.status, 'completed');
    assert.equal(missingReviews.results.length, 4);
    assert.ok(missingReviews.results.every(result => result.executionOk && !result.reviewPerformed && !result.skipped));
    assert.deepEqual(missingReviews.results.map(result => result.reviewRequired), [false, false, true, true]);
    assert.deepEqual(missingReviews.results.map(result => result.requiredReviewMet), [true, true, false, false]);
    assert.equal(missingReviews.reviewerModel, 'claude-opus-5-5');
    assert.equal(missingReviews.reviewerPromptSha256, policyHash);
    assert.equal(missingReviews.reviewerPromptSource, 'reference/skill-references/response-review.md');
    assert.equal(missingReviews.skillHashes['references/response-review.md'], undefined);
    const customCaseFile = path.join(workspace, 'custom-cases.json');
    await writeFile(customCaseFile, JSON.stringify([
      { id: 'minimum-equivalent', prompt: 'Explicit review required here.', reviewRequired: true },
      { id: 'custom-completed', prompt: 'No remaining review objective.', reviewRequired: false },
    ]));
    const customReviews = await runNativeResponseEvals({ ...process.env,
      SOCRATES_LIVE_EVAL: '1', SOCRATES_NATIVE_MODEL: 'claude-haiku-5-5', SOCRATES_NATIVE_EFFORT: 'low',
      SOCRATES_NATIVE_CASE_FILE: customCaseFile, SOCRATES_NATIVE_CASES: 'minimum-equivalent,custom-completed',
      SOCRATES_NATIVE_REVIEW: '1', SOCRATES_NATIVE_REVIEW_MODEL: 'claude-opus-5-5', SOCRATES_NATIVE_CONCURRENCY: '1',
      SOCRATES_NATIVE_SOURCE_ROOT: baseline, FAKE_EXPECT_REVIEW_HASH: policyHash,
      SOCRATES_NATIVE_OUTPUT: workspace, SOCRATES_GROUNDED_CLAUDE_BIN: stub, FAKE_READ_MODE: 'complete',
    });
    assert.equal(customReviews.status, 'completed');
    assert.deepEqual(customReviews.results.map(result => result.reviewRequired), [true, false]);
    assert.deepEqual(customReviews.results.map(result => result.requiredReviewMet), [false, true]);
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
