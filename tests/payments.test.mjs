import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentClient, isPaid, newPaymentRequestId } from '../src/services/paymentClientCore.mjs';
const quote = { quoteId: 'q1', couponCode: '', plan: { planId: 'plan1' }, price: { totalPaise: 11800 } };
const checkout = { purchaseId: 'p1', orderId: 'order_1', status: 'created', plan: quote.plan, price: quote.price };
test('secure payment request IDs work without randomUUID and fail before checkout without secure crypto',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 const secure=globalThis.crypto;
 try {
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:secure.getRandomValues.bind(secure)}});
  const ids=Array.from({length:100},newPaymentRequestId);
  assert(ids.every(id=>/^req_[a-f0-9]{32}$/.test(id)));
  assert.equal(new Set(ids).size,100);
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
  const calls=[];
  const client=createPaymentClient({call:async(...args)=>{calls.push(args);return checkout;},getUid:()=> 'user1',storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  await assert.rejects(client.create(quote),/Secure checkout is unavailable/);
  assert.equal(calls.length,0);
 } finally {
  if(original)Object.defineProperty(globalThis,'crypto',original);
  else delete globalThis.crypto;
 }
});
function setup(handler, backing = new Map()) {
  let uid = 'user1', time = 10000;
  const calls = [];
  const storage = { keys:()=> [...backing.keys()], getItem: k => backing.get(k) || null, setItem: (k,v) => backing.set(k,v), removeItem: k => backing.delete(k) };
  const client = createPaymentClient({ call: async (name,data) => { calls.push({name,data}); return handler(name,data); }, getUid: () => uid, storage, now: () => time, newId: () => 'stable_request' });
  return { client, calls, backing, setUid: value => uid = value, tick: n => time += n };
}
test('catalog coalesces concurrent loads, caches for five minutes and separates users', async () => {
  const s = setup(() => ({ plans: [] }));
  await Promise.all([s.client.catalog(), s.client.catalog(), s.client.catalog()]);
  assert.equal(s.calls.length, 1);
  await s.client.catalog(); assert.equal(s.calls.length, 1);
  s.setUid('user2'); await s.client.catalog(); assert.equal(s.calls.length, 2);
  s.tick(300001); await s.client.catalog(); assert.equal(s.calls.length, 3);
});
test('double submit reserves one request and never sends money or mobile identity', async () => {
  const s = setup(() => checkout);
  await Promise.all([s.client.create(quote), s.client.create(quote)]);
  assert.equal(s.calls.length, 1);
  assert.deepEqual(Object.keys(s.calls[0].data).sort(), ['couponCode','planId','quoteId','requestId']);
  assert.equal(s.client.readPending().purchaseId, 'p1');
});
test('lost create response survives app restart and reuses exact frozen request', async () => {
  const s = setup(() => { throw new Error('network lost'); });
  await assert.rejects(s.client.create(quote));
  const resumed = setup(() => checkout, s.backing);
  await resumed.client.recover();
  assert.deepEqual(resumed.calls[0].data, s.calls[0].data);
});
test('pending and failed verification cannot become success or clear recovery information', async () => {
  let failVerify = false;
  const s = setup(name => {
    if (name === 'paymentVerify' && failVerify) throw new Error('signature rejected');
    return { ...checkout, status: name === 'paymentCreateOrder' ? 'created' : 'pending' };
  });
  await s.client.create(quote);
  const result = await s.client.verify('p1', { razorpay_order_id:'order_1', razorpay_payment_id:'pay1', razorpay_signature:'sig', amount:1 });
  assert.equal(isPaid(result), false); assert(s.client.readPending());
  assert.equal('amount' in s.calls.at(-1).data, false);
  failVerify = true;
  await assert.rejects(s.client.verify('p1', {}));
  assert(s.client.readPending());
  assert.equal(isPaid({status:'success'}), false);
});
test('server-confirmed paid clears draft and invalidates cached history', async () => {
  const s = setup(name => name === 'paymentHistory' ? {items:[]} : {...checkout, status:name === 'paymentStatus' ? 'paid':'created'});
  await s.client.history(); await s.client.create(quote);
  assert.equal(isPaid(await s.client.check()), true);
  assert.equal(s.client.readPending(), null);
  await s.client.history();
  assert.equal(s.calls.filter(c=>c.name === 'paymentHistory').length, 2);
});
test('a second plan is blocked while an earlier payment is unresolved', async () => {
  const s = setup(() => checkout); await s.client.create(quote);
  await assert.rejects(s.client.create({...quote, plan:{planId:'different'}}), /earlier payment is pending/);
  assert.equal(s.calls.length, 1);
});
test('focus/resume checks are throttled and cannot read another user draft', async () => {
  const s = setup(name => ({...checkout, status:name === 'paymentStatus' ? 'pending':'created'}));
  await s.client.create(quote);
  await Promise.all([s.client.check(), s.client.check()]);
  await s.client.check(); assert.equal(s.calls.filter(c=>c.name === 'paymentStatus').length, 1);
  s.setUid('user2'); assert.equal(s.client.readPending(), null);
  assert.equal(await s.client.check(), null);
});

test('only an explicit server refusal before order creation releases a stale quote draft', async () => {
  const s = setup(() => { throw Object.assign(new Error('Plan changed'), {code:'failed-precondition',details:{checkoutNotCreated:true}}); });
  await assert.rejects(s.client.create(quote));
  assert.equal(s.client.readPending(),null);
  const unknown = setup(() => { throw Object.assign(new Error('timeout'), {code:'unavailable'}); });
  await assert.rejects(unknown.client.create(quote));
  assert(unknown.client.readPending());
});

test('an account switch during an in-flight payment cannot attach its response to the new account', async () => {
  let resolve;
  const s = setup(() => new Promise(r => {resolve=r;}));
  const creating = s.client.create(quote);
  s.setUid('user2'); resolve(checkout);
  await assert.rejects(creating,/account changed/);
  assert.equal(s.client.readPending(),null);
  s.setUid('user1'); assert(s.client.readPending());
});

test('test and live pending drafts are isolated and a test checkout cannot block live payment', async () => {
  let mode='test';
  const s=setup(name=>name==='paymentCatalog'?{plans:[],mode}:{...checkout,mode});
  await s.client.catalog();
  await s.client.create({...quote,mode:'test'});
  assert(s.client.readPending());
  mode='live';await s.client.catalog(true);
  assert.equal(s.client.readPending(),null);
  await s.client.create({...quote,mode:'live'});
  assert.equal(s.client.readPending().checkout.mode,'live');
  mode='test';await s.client.catalog(true);
  assert.equal(s.client.readPending().checkout.mode,'test');
});

test('app API requests have no company selector or company-dependent payload',async()=>{
 const s=setup(name=>name==='paymentCatalog'?{mode:'test',plans:[]}:{...checkout,mode:'test'});
 await s.client.catalog();await s.client.quote('plan1');await s.client.create({...quote,mode:'test'});
 assert(s.calls.every(c=>!Object.hasOwn(c.data,'companyId')));
});
test('a saved checkout from the prior company-based app resumes without creating another payment',async()=>{
 const backing=new Map([['mlmlive.payment.pending.v1:user1:old_company:test',JSON.stringify({purchaseId:'p1',requestId:'old_request',planId:'plan1',checkout:{...checkout,mode:'test'}})]]);
 const s=setup(name=>name==='paymentCatalog'?{mode:'test',plans:[]}:{...checkout,status:'pending',mode:'test'},backing);
 await s.client.catalog();assert.equal(s.client.readPending().purchaseId,'p1');
 await s.client.recover();assert.equal(s.calls.filter(c=>c.name==='paymentCreateOrder').length,0);
 assert.equal(backing.has('mlmlive.payment.pending.v1:user1:old_company:test'),false);
});


test('cache invalidation isolates an older in-flight availability response',async()=>{
 const resolves=[];const s=setup(()=>new Promise(r=>resolves.push(r)));
 const old=s.client.catalog();s.client.invalidate();const fresh=s.client.catalog();
 assert.equal(resolves.length,2);resolves[1]({mode:'test',plans:[]});await fresh;
 resolves[0]({mode:'test',plans:[{planId:'already_owned'}]});await old;
 assert.deepEqual((await s.client.catalog()).plans,[]);
});
test('invoice API sends only the purchase reference and respects an account change',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r));const result=s.client.receipt('p1');
 assert.deepEqual(s.calls[0],{name:'paymentReceipt',data:{purchaseId:'p1'}});
 s.setUid('user2');resolve({invoice:{paymentId:'pay1'}});await assert.rejects(result,/account changed/);
});
