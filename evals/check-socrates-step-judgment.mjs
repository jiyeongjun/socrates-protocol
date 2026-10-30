// Acceptance checks for isolated model-produced judgment fixtures.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [kind, directory] = process.argv.slice(2);
if (!['unique', 'pricing', 'report'].includes(kind) || !directory) {
  console.error('Usage: node evals/check-socrates-step-judgment.mjs <unique|pricing|report> <fixture-directory>');
  process.exit(2);
}
const api = await import(pathToFileURL(path.resolve(directory, 'main.mjs')));
if (kind === 'unique') {
  assert.deepEqual(Object.keys(api), ['unique']);
  const values = ['z', 'a', 'z', 'b', 'a'];
  const before = [...values];
  assert.deepEqual(api.unique(values), ['z', 'a', 'b']);
  assert.deepEqual(values, before);
  assert.deepEqual(api.unique([3, 1, 3, 2]), [3, 1, 2]);
  assert.deepEqual(api.unique([]), []);
} else if (kind === 'pricing') {
  assert.deepEqual(Object.keys(api).sort(), ['preview', 'quote', 'receipt']);
  for (const total of [0, 1, 7, 99, 101, 137, 1000]) {
    for (const vip of [false, true]) {
      const amount = Math.round(total * (vip ? 0.85 : 1));
      assert.deepEqual(api.quote(total, vip), {amount, type:'quote'});
      assert.deepEqual(api.receipt(total, vip), {paid:amount, type:'receipt'});
      assert.deepEqual(api.preview(total, vip), {due:amount, type:'preview'});
    }
  }
} else {
  assert.deepEqual(Object.keys(api), ['download']);
  const rows = [{name:'A,"B"', count:7}, {name:'C', count:0}];
  const snapshot = JSON.stringify(rows);
  const {serialize} = await import(pathToFileURL(path.resolve(directory, 'formatter.mjs')));
  assert.deepEqual(api.download(rows), {contentType:'application/json', body:JSON.stringify(rows)});
  assert.deepEqual(api.download(rows, {format:'csv'}), {contentType:'text/csv', body:serialize(rows, {format:'csv'})});
  assert.deepEqual(api.download([], {format:'csv'}), {contentType:'text/csv', body:serialize([], {format:'csv'})});
  assert.equal(JSON.stringify(rows), snapshot);
}
console.log(`${kind}: independent acceptance checks passed`);
