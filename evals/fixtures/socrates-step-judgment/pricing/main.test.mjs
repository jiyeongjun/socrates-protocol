import test from 'node:test';
import assert from 'node:assert/strict';
import {quote,receipt,preview} from './main.mjs';
test('normal prices and shape',()=>{assert.deepEqual(quote(101,false),{amount:101,type:'quote'});assert.deepEqual(receipt(101,false),{paid:101,type:'receipt'});assert.deepEqual(preview(101,false),{due:101,type:'preview'});});
test('VIP prices agree',()=>{assert.equal(quote(100,true).amount,90);assert.equal(receipt(100,true).paid,90);assert.equal(preview(100,true).due,90);});
