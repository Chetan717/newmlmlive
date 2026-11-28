import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const frontend=readFileSync(new URL('../src/pages/Video/VideoService.jsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../admin/functions/video/functions.js',import.meta.url),'utf8');
const listBody=backend.slice(backend.indexOf('  async function list(a, d)'),backend.indexOf('  async function details(a, d)'));
function mockBackend(total){
  const docs=Array.from({length:total},(_,i)=>({id:`r${String(i).padStart(2,'0')}`,data:()=>({id:`r${String(i).padStart(2,'0')}`,tags:[i%2?'status:Completed':'status:Submitted'],metrics:{}})}));
  const limits=[],cursors=[],scopes=[];
  const feed=scope=>{scopes.push(scope);let filtered=docs,after=null,size;return {where(_field,_op,tag){filtered=filtered.filter(doc=>doc.data().tags.includes(tag));return this;},orderBy(){return this;},startAfter(id){after=id;cursors.push(id);return this;},limit(n){size=n;limits.push(n);return this;},async get(){const page=filtered.filter(d=>after===null||d.id>after).slice(0,size);return {docs:page,size:page.length};}}};
  const list=new Function('feed','scopeFor','range','idField','key','V',listBody+'\nreturn list;')(feed,a=>a.role, q=>q,'id',s=>s,{check:(ok)=>assert.ok(ok),line:s=>s});
  return {list,limits,cursors,scopes};
}
test('customer reads at most five documents per query; cursor returns next five, then last two',async()=>{
  const {list,limits,cursors}=mockBackend(12);const actor={role:'customer'};
  const a=await list(actor,{size:1000});assert.equal(a.rows.length,5);
  const b=await list(actor,{cursor:a.cursor});assert.equal(b.rows.length,5);
  const c=await list(actor,{cursor:b.cursor});assert.equal(c.rows.length,2);assert.equal(c.cursor,null);
  assert.deepEqual(limits,[5,5,5]);assert.deepEqual(cursors,['r04','r09']);assert.equal(new Set([...a.rows,...b.rows,...c.rows].map(r=>r.id)).size,12);
});
test('exact multiple allows one empty terminal fetch and then stops',async()=>{
  const {list}=mockBackend(5);const actor={role:'customer'};const a=await list(actor,{});const b=await list(actor,{cursor:a.cursor});assert.equal(b.rows.length,0);assert.equal(b.cursor,null);
});
test('status filter is applied before limit; team and admin still use ten',async()=>{
  const {list,limits}=mockBackend(30);const a=await list({role:'customer'},{filter:'status',value:'Completed'});assert.deepEqual(a.rows.map(r=>r.id),['r01','r03','r05','r07','r09']);
  for(const role of ['editor','manager','admin'])assert.equal((await list({role},{})).rows.length,10);
  assert.deepEqual(limits,[5,10,10,10]);
});
test('frontend merges by id, sends size five and resets cursor for new filters',async()=>{
  const body=frontend.slice(frontend.indexOf('  async function list('),frontend.indexOf('  function loadMore()'));
  let rows=[{id:'r1'}],cursor='old',calls=[],responses=[{rows:[{id:'r1'},{id:'r2'}],cursor:'next'},{rows:[{id:'r3'}],cursor:null}];
  const fn=new Function('api','setRows','page','setPageError','status','cursor',body+'\nreturn list;')(async(action,args)=>{calls.push([action,args]);return responses.shift();},f=>{rows=f(rows);},v=>cursor=v,()=>{},'Completed',cursor);
  await fn('Completed',true);assert.deepEqual(rows.map(r=>r.id),['r1','r2']);assert.equal(cursor,'next');
  await fn('Submitted');assert.deepEqual(rows.map(r=>r.id),['r3']);assert.equal(cursor,null);
  assert.deepEqual(calls.map(c=>c[1]),[{filter:'status',value:'Completed',size:5,cursor:'old'},{filter:'status',value:'Submitted',size:5,cursor:null}]);
});
test('scroll effect loads only near list boundary, ignores concurrent work and detaches on cleanup',()=>{
  const marker=frontend.indexOf('  // Layout scrolls inside');const body=frontend.slice(frontend.indexOf('  useEffect(() => {',marker),frontend.indexOf('  const refreshCurrent=',marker));
  let y=900,load=0,listener,frame,removed=false;const running={current:false};
  const scroller={addEventListener(type,fn){assert.equal(type,'scroll');listener=fn;},removeEventListener(type,fn){assert.equal(fn,listener);removed=true;},getBoundingClientRect(){return {top:0,bottom:600}}};
  const window={requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){frame=null;}};
  let cleanup;new Function('useEffect','loadBoundary','cursor','info','form','detail','busy','err','pageError','scrollRef','window','running','loadMore','status',body)(fn=>cleanup=fn(),{current:{getBoundingClientRect:()=>({top:y,bottom:y+36})}},'cursor',{},false,null,false,'','',{current:{closest:()=>scroller}},window,running,()=>{load++;},'');
  assert.equal(load,0);listener();frame();assert.equal(load,0);y=650;listener();frame();assert.equal(load,1);running.current=true;listener();assert.equal(load,1);cleanup();assert.ok(removed);
});
