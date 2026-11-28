import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const uploadSource=read('src/pages/Video/uploads.js');
const form=read('src/pages/Video/NewRequest.jsx');
const service=read('src/pages/Video/VideoService.jsx');
const plans=read('src/pages/Subscription/MainSubscription.jsx');
const progressSource=read('src/pages/Video/uploadProgress.js').replace('export function','function');
test('one file picker, five clip limit and no numeric progress display',()=>{
  assert.match(form,/list.length !== 1/); assert.match(form,/draft.files.length < 5/);
  assert.doesNotMatch(form,/<input type="file"[^>]*\bmultiple\b/);
  assert.doesNotMatch(form,/\}\s*%/); assert.match(form,/\{clipList\}.*\{\(step===0\|\|draft.id\)/s);
});
test('Plans starts with active plans and preserves payment actions',()=>{
  assert.doesNotMatch(plans,/<PlanArtwork hero/);assert.match(plans,/view !== "result" && view !== "plans"/);
  assert.match(plans,/My Active Plans/); assert.ok(plans.indexOf('className="mlm-active-list')<plans.indexOf('className="mlm-available-plans'));
  assert.match(plans,/onPaymentSuccess=\{onPaid\}/);
});
async function mockUpload(ready, abortOnFinish=false){
  const calls=[], frames=[], active=[];
  const old={};for(const key of ['navigator','window','XMLHttpRequest','__mlmMedia'])old[key]=Object.getOwnPropertyDescriptor(globalThis,key);
  const c=new AbortController();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.XMLHttpRequest=class {upload={};open(method,url){this.url=url;}send(blob){calls.push('PUT:'+this.url);this.upload.onprogress({loaded:blob.size});this.status=200;this.onload();this.onloadend();}abort(){this.onabort();this.onloadend();}};
  globalThis.__mlmMedia=async (action,{index,part})=>{calls.push(`${action}:${index}${part?':'+part:''}`);if(action==='resume')return {ready:ready.includes(index),parts:[]};if(action==='part')return {url:`${index}/${part}`};if(action==='finish'&&abortOnFinish)c.abort(new Error('paused'));return {};};
  try{
    const source=uploadSource.replace(/^import .*;\n/gm,'').replace(/const region = .*;\n/,'').replace(/export const api = async[\s\S]*?\.data;\nexport const media = async[\s\S]*?\.data;/,'const media = (...args) => globalThis.__mlmMedia(...args);');
    const {upload}=await import('data:text/javascript;base64,'+Buffer.from(progressSource+'\n'+source).toString('base64'));
    const f=()=>({size:6,blob:new Blob(['abcdef'])});
    const job=upload({id:'draft',partSize:3,files:[f(),f()]},c.signal,x=>frames.push(x),()=>{},i=>active.push(i));
    if(abortOnFinish)await assert.rejects(job,/paused/);else await job;
    return {calls,frames,active};
  }finally{for(const [key,d] of Object.entries(old)){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}}
}
test('actual upload finishes clip 1 before initiating clip 2, with finalized byte counts',async()=>{
 const {calls,frames,active}=await mockUpload([]);
 assert.ok(calls.indexOf('finish:0')<calls.indexOf('resume:1'));assert.deepEqual(active,[0,1,null]);
 assert.deepEqual(frames.at(-1),[6,6]); assert.equal(calls.filter(s=>s.startsWith('PUT:')).length,4);
});
test('resume skips already finalized clips',async()=>{const {calls,frames}=await mockUpload([0]);assert.ok(!calls.includes('finish:0'));assert.ok(!calls.includes('part:0:1'));assert.deepEqual(frames.at(-1),[6,6]);});
test('pausing stops the next queued clip from starting',async()=>{const {calls,active}=await mockUpload([],true);assert.ok(!calls.includes('resume:1'));assert.deepEqual(active,[0,null]);});
test('approval acknowledges current version before approving; failed acknowledgement blocks action',async()=>{
 const command=service.slice(service.indexOf('  async function command('),service.indexOf('  const r = detail?.row'));
 const run=(api,row)=>new Function('api','detail','open','refresh',command+'\nreturn command;')(api,{row},async()=>{},async()=>{});
 const row={id:'req',version:2,reviewedVersion:1},calls=[];
 await run(async (a,d)=>calls.push([a,d]),row)('approve',{confirmed:true});
 assert.deepEqual(calls.map(([a,d])=>[a,d.version]),[['reviewed',2],['approve',2]]);assert.equal(calls[1][1].confirmed,true);
 calls.length=0;await run(async (a,d)=>calls.push([a,d]),{...row,reviewedVersion:2})('correct',{note:'change'});assert.deepEqual(calls.map(([a])=>a),['correct']);
 calls.length=0;await assert.rejects(run(async a=>{calls.push(a);throw Error('stale version');},row)('approve',{confirmed:true}),/stale version/);assert.deepEqual(calls,['reviewed']);
});
