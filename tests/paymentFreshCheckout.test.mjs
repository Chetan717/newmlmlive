import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentClient,matchesCheckout} from '../src/services/paymentClientCore.mjs';
const quote=(planId,amount,quoteId)=>({mode:'live',plan:{planId},quoteId,couponCode:'',price:{totalPaise:amount}});
const old=quote('same_plan',29382,'old_quote'),fresh=quote('same_plan',118,'fresh_quote');
const order=(q,id,status='created')=>({...q,purchaseId:id,orderId:`order_${id}`,status});
function setup(handler){const map=new Map(),calls=[];let i=0;const client=createPaymentClient({getUid:()=> 'user1',newId:()=>`r${++i}`,storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},call:async(n,d)=>{calls.push([n,d]);return handler(n,d);}});return {client,calls};}
test('same plan repriced from 249 to 1: confirmed unpaid old order is replaced with exact fresh quote',async()=>{
 const s=setup((n,d)=>n==='paymentStatus'?order(old,'old','expired'):order(fresh,'new'));
 s.client.remember(order(old,'old'));const result=await s.client.startFresh(fresh);
 assert.equal(result.price.totalPaise,118);assert.equal(result.orderId,'order_new');assert(matchesCheckout(result,fresh));assert.equal(s.calls.length,2);
 assert.deepEqual(s.calls[0],['paymentStatus',{purchaseId:'old',closeUnpaid:true}]);assert.equal(s.calls[1][1].quoteId,'fresh_quote');
});
test('old different plan, changed coupon, mismatched amount or mode cannot open gateway',()=>{
 const v=order(fresh,'new');for(const bad of [{...v,plan:{planId:'other'}},{...v,quoteId:'wrong'},{...v,price:{totalPaise:29382}},{...v,couponCode:'OTHER1'},{...v,mode:'test'},{...v,status:'pending'},{...v,orderId:''}]) assert.equal(matchesCheckout(bad,fresh),false);
});
test('genuine pending or paid previous order never causes another order to be created',async()=>{
 for(const status of ['pending','paid','creation_unknown']){const s=setup(()=>order(old,'old',status));s.client.remember(order(old,'old'));const res=await s.client.startFresh(fresh);assert.equal(res.previousCheckout,true);assert.equal(res.status,status);assert.equal(s.calls.length,1);}
});
test('gateway status outage preserves recovery pointer and never creates second order',async()=>{
 const s=setup(()=>{throw new Error('gateway offline');});s.client.remember(order(old,'old'));await assert.rejects(s.client.startFresh(fresh),/offline/);assert.equal(s.calls.length,1);assert.equal(s.client.readPending().purchaseId,'old');
});
test('new purchase happy path calls only create; double-click same quote coalesces',async()=>{
 const s=setup(()=>order(fresh,'new'));const result=await Promise.all([s.client.startFresh(fresh),s.client.startFresh(fresh)]);assert.equal(s.calls.length,1);assert.equal(result[0].orderId,result[1].orderId);
});
test('cross-device lock conflict does not reopen or silently close the other checkout',async()=>{
 const s=setup(()=>{throw Object.assign(new Error('prior checkout'),{details:{checkoutNotCreated:true,pendingCheckout:order(old,'old')}});});const result=await s.client.startFresh(fresh);assert.equal(result.previousCheckout,true);assert.equal(s.client.readPending().purchaseId,'old');assert.equal(s.calls.length,1);assert.equal(matchesCheckout(result,fresh),false);
});
test('cancel and retry same plan gets new request ID after server confirms no charge',async()=>{
 let creates=0;const s=setup((n,d)=>n==='paymentStatus'?order(fresh,`p${creates}`,'expired'):order(fresh,`p${++creates}`));const a=await s.client.startFresh(fresh);await s.client.closePrevious();const b=await s.client.startFresh(fresh);assert.notEqual(a.orderId,b.orderId);assert.notEqual(s.calls[0][1].requestId,s.calls[2][1].requestId);
});
