import test from 'node:test';
import assert from 'node:assert/strict';
import { progressBytes } from '../src/pages/Video/uploadProgress.js';
test('multipart progress counts only the current attempt and resets on retry',()=>{
  assert.equal(progressBytes(50,25,100),75);
  assert.equal(progressBytes(50,0,100),50);
  assert.equal(progressBytes(50,25,100),75);
});
test('100 percent only appears after successful finalization, including 1 byte',()=>{
  assert.equal(progressBytes(100,0,100),99);
  assert.equal(progressBytes(50,50,100),99);
  assert.equal(progressBytes(1,0,1),0);
  assert.equal(progressBytes(100,0,100,true),100);
  assert.equal(progressBytes(1,0,1,true),1);
});
