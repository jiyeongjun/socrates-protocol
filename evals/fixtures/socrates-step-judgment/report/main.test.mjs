import test from 'node:test';
import assert from 'node:assert/strict';
import {download} from './main.mjs';
test('existing JSON download',()=>assert.deepEqual(download([{name:'A',count:1}]),{contentType:'application/json',body:'[{"name":"A","count":1}]'}));
