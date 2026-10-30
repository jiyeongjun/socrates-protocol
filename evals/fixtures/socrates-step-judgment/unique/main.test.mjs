import test from 'node:test';
import assert from 'node:assert/strict';
import {unique} from './main.mjs';
test('deduplicates sorted input',()=>assert.deepEqual(unique(['a','a','b']),['a','b']));
