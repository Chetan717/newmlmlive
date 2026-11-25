import test from 'node:test';
import assert from 'node:assert/strict';
import {eligiblePlans,grantAvailable,planBenefits} from '../src/pages/Subscription/planState.mjs';
import {createPaymentInvoice,downloadPaymentInvoice} from '../src/services/paymentInvoice.js';
const plans=['poster','video','combo'].map(serviceType=>({serviceType,planId:serviceType,Launch:true,Day_value:30,downloads:50,videoCredits:3}));
test('the buy list follows service overlap, expiry and exhausted credits without assuming image categories',()=>{
 const t=1000,g=kind=>({serviceType:kind,startsAtMs:0,expiresAtMs:2000,remainingDownloads:1,remainingCredits:2});
 const list=grants=>eligiblePlans(plans,{grants},t).map(p=>p.serviceType);
 assert.deepEqual(list([]),['poster','video','combo']);assert.deepEqual(list([g('poster')]),['video']);assert.deepEqual(list([g('video')]),['poster']);assert.deepEqual(list([g('poster'),g('video')]),[]);
 assert.deepEqual(list([{...g('poster'),remainingDownloads:0}]),['poster','video','combo']);
 assert.deepEqual(list([{...g('video'),remainingCredits:0},g('poster')]),['video']);
 assert.deepEqual(list([{...g('poster'),expiresAtMs:t}]),['poster','video','combo']);
 assert.equal(grantAvailable({...g('poster'),remainingDownloads:0,unlimitedDownloads:true},t),true);
 assert.equal(grantAvailable({...g('video'),remainingCredits:null},t),true);
 assert(planBenefits(plans[2]).includes('3 video editing credits'));
});
const invoice={invoiceId:'p_fixture',customerName:'Test Customer',mobileNo:'9999999999',planName:'Poster Pro',durationDays:30,paymentMethod:'netbanking',orderId:'order_fixture',paymentId:'pay_fixture',mode:'test',status:'paid',paidAtMs:1800000000000,price:{basePaise:100000,discountPaise:0,gstBps:1800,gstPaise:18000,totalPaise:118000}};
test('compact payment PDF contains actual amounts/references and rejects unpaid invoices',()=>{
 const doc=createPaymentInvoice(invoice),text=doc.output();assert.equal(doc.getNumberOfPages(),1);assert.equal(Math.round(doc.internal.pageSize.getWidth()),105);
 for(const word of ['MLM LIVE','TEST PAYMENT INVOICE','order_fixture','pay_fixture','1180.00','netbanking'])assert(text.includes(word),word);
 assert.throws(()=>createPaymentInvoice({...invoice,status:'pending'}),/verified payment/);
 const long=createPaymentInvoice({...invoice,customerName:'Very long customer '.repeat(8),planName:'Very long plan title '.repeat(8),orderId:'order_'+'a'.repeat(120),paymentId:'pay_'+'b'.repeat(120),refundedPaise:100,status:'partially_refunded'});
 assert.equal(long.getNumberOfPages(),1);assert(long.internal.pageSize.getHeight()>165);
});
test('native invoice uses existing Android PDF save and iOS share/save bridge',async()=>{
 const descriptors=Object.fromEntries(['window','document','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const sent=[];
 try{
  Object.defineProperty(globalThis,'window',{configurable:true,value:{ReactNativeWebView:{postMessage:s=>sent.push(JSON.parse(s))}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{fonts:{ready:Promise.resolve()}}});
  for(const agent of ['Android','iPhone']){Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:agent}});await downloadPaymentInvoice(invoice);}
  assert.equal(sent[0].type,'DOWNLOAD_PDF');assert.equal(sent[1].type,'SHARE_SOMETHING');
  assert(sent.every(p=>p.mimeType==='application/pdf'&&p.fileName==='MLMLIVE_Invoice_p_fixture.pdf'&&p.base64.includes('base64,')));
 }finally{for(const [key,descriptor]of Object.entries(descriptors)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
