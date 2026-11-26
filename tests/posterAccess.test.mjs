import test from "node:test";
import assert from "node:assert/strict";
import { canExportPoster } from "../src/pages/Subscription/planState.mjs";
import { createPaymentClient } from "../src/services/paymentClientCore.mjs";
import { buildEditorTemplateSeed } from "../src/utils/editorTemplateSelection.js";

const now = Date.now();
const active = { purchaseId: "order-a", serviceType: "poster", startsAtMs: now - 10000,
  expiresAtMs: now + 600000, remainingDownloads: 0, unlimitedDownloads: true };
const ledger = (...grants) => ({
  grants, services: { poster: { status: "active", currentPurchaseId: active.purchaseId } },
});

test("free, legacy, and pre-launch downloads never read the customer's plan", async () => {
  const unexpected = () => assert.fail("unexpected plan lookup");
  for (const [access, launched] of [["free", true], [undefined, true], ["premium", false]]) {
    assert.equal(await canExportPoster(access, launched, unexpected), true);
  }
});

test("premium export accepts an active poster grant, including a combo's poster grant", async () => {
  const video = { ...active, serviceType: "video", remainingCredits: 5 };
  for (const grants of [[active], [active, video], [{ ...active, unlimitedDownloads: false, remainingDownloads: 1 }]]) {
    assert.equal(await canExportPoster("premium", true, () => ledger(...grants)), true);
  }
  for (const grants of [[], [video], [{ ...active, startsAtMs: now + 200000 }],
    [{ ...active, revoked: true }], [{ ...active, expiresAtMs: now }],
    [{ ...active, unlimitedDownloads: false }]]) {
    assert.equal(await canExportPoster("premium", true, () => ledger(...grants)), false);
  }
  await assert.rejects(canExportPoster("premium", true, () => ({})));
  await assert.rejects(canExportPoster("premium", true, () => Promise.reject(new Error("offline"))), /offline/);
});

test("poster checks reuse fresh payment reads and isolate accounts and checkout invalidations", async () => {
  const calls = [];
  let uid = "one", time = now;
  const client = createPaymentClient({
    getUid: () => uid, now: () => time,
    storage: { keys: () => [], getItem: () => null },
    call: async name => { calls.push(name); return { entitlement: { ...ledger(active), uid } }; },
  });
  await client.catalog();
  assert.equal((await client.entitlement()).uid, uid);
  assert.deepEqual(calls, ["paymentCatalog"]);
  uid = "two";
  await Promise.all([client.entitlement(), client.entitlement()]);
  assert.equal((await client.entitlement()).uid, uid);
  assert.equal(calls.length, 2);
  time += 30001;
  await client.entitlement();
  client.invalidate();
  await client.entitlement();
  assert.deepEqual(calls.slice(1), Array(3).fill("paymentEntitlement"));
});

test("festival and View All editor seeds retain the parent template's tier", () => {
  for (const tier of ["premium", "free", undefined]) {
    const graphic = { id: 4, url: "design.webp" };
    const template = { id: "doc", templateAccess: tier, GraphicsLink: [graphic] };
    assert.equal(buildEditorTemplateSeed({template, selectedGraphic: graphic}).templateAccess, tier || "free");
  }
});
