export function newPaymentRequestId() {
  const api = globalThis.crypto;
  if (typeof api?.randomUUID === "function") return api.randomUUID();
  if (typeof api?.getRandomValues === "function") {
    const bytes = api.getRandomValues(new Uint8Array(16));
    return `req_${Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  throw new Error("Secure checkout is unavailable in this browser. Open MLM LIVE using HTTPS or update your browser.");
}

// The browser keeps recovery IDs, never payment authority or gateway secrets.
export const serviceLabel = (kind = "poster") => ({
  poster: "Poster Design", video: "Video Editing", combo: "Poster + Video Editing",
})[kind] || "Poster Design";
// Reject mismatched frozen quotes before any browser/native gateway opens.
export function matchesCheckout(order, quote) {
  return Boolean(order?.orderId && order.status === "created" &&
    order.plan?.planId === quote?.plan?.planId && order.quoteId === quote?.quoteId &&
    order.mode === quote?.mode && Number.isSafeInteger(quote?.price?.totalPaise) &&
    order.price?.totalPaise === quote.price.totalPaise && order.couponCode === (quote.couponCode || ""));
}
export const isPaid = (result) => result?.status === "paid" && Boolean(result?.purchaseId);
const terminal = new Set(["paid", "refunded", "partially_refunded", "disputed", "failed", "expired"]);

export function createPaymentClient({ call, getUid, storage, now = Date.now, newId = newPaymentRequestId }) {
  const cache = new Map();
  const inflight = new Map();
  const checks = new Map();
  const modes = new Map();
  const revisions = new Map();
  const scope = () => {
    const uid = getUid();
    if (!uid) throw new Error("Please sign in again to manage your plan.");
    return `${uid}:app`;
  };
  const storageKey = () => `mlmlive.payment.pending.v2:${scope()}:${modes.get(scope()) || "default"}`;
  const assertOwner = (owner) => {
    if (scope() !== owner) throw new Error("Your account changed. Open the subscription page again.");
  };
  function readPending() {
    try { return JSON.parse(storage.getItem(storageKey()) || "null"); }
    catch { return null; }
  }
  function writePending(value) {
    // If durable storage is unavailable, stop before creating a payable order.
    storage.setItem(storageKey(), JSON.stringify(value));
  }
  function invalidate() {
    revisions.set(scope(), (revisions.get(scope()) || 0) + 1);
    const prefix = `${scope()}:`;
    for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
  }
  function rememberMode(value) {
    if (["test", "live"].includes(value?.mode)) {
      const key = scope();
      if (modes.get(key) && modes.get(key) !== value.mode) invalidate();
      modes.set(key, value.mode);
      // Carry over a persisted checkout from the company-based release without
      // creating a second provider order. Only this account/mode is considered.
      if (!readPending()) {
        const prefix = `mlmlive.payment.pending.v1:${getUid()}:`;
        for (const oldKey of storage.keys?.() || []) {
          if (!oldKey.startsWith(prefix) || !oldKey.endsWith(`:${value.mode}`)) continue;
          try {
            const old = JSON.parse(storage.getItem(oldKey));
            if (old && (old.purchaseId || old.requestId)) {
              writePending({ ...old, scope: "app" });
              storage.removeItem(oldKey); break;
            }
          } catch { /* A corrupt old draft is never payment authority. */ }
        }
      }
    }
    return value;
  }
  function accept(result) {
    if (!result?.purchaseId) throw new Error("Payment confirmation is pending. Please check payment status.");
    if (terminal.has(result.status)) {
      storage.removeItem(storageKey());
      checks.delete(storageKey());
      invalidate();
    } else {
      writePending({ ...readPending(), purchaseId: result.purchaseId, checkout: result });
    }
    return result;
  }
  async function cached(action, ttl, data = {}, force = false) {
    const owner = scope();
    const revision = revisions.get(owner) || 0;
    const key = `${owner}:${revision}:${action}:${JSON.stringify(data)}`;
    if (!force && cache.get(key)?.until > now()) return cache.get(key).value;
    if (inflight.has(key)) return inflight.get(key);
    const promise = call(action, { ...data }).then((value) => {
      assertOwner(owner);
      if ((revisions.get(owner) || 0) === revision) {
        cache.set(key, { until: now() + ttl, value });
        // Catalog and history already return this account's server-verified ledger.
        if ((action === "paymentCatalog" || action === "paymentHistory") && value.entitlement) {
          cache.set(`${owner}:${revision}:paymentEntitlement:{}`, {
            until: now() + 30000, value: { entitlement: value.entitlement },
          });
        }
      }
      return value;
    }).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }
  async function create(quote) {
    rememberMode(quote);
    let pending = readPending();
    if (pending && (pending.planId !== quote.plan.planId || pending.quoteId !== quote.quoteId)) {
      throw new Error("An earlier payment is pending. Check that payment before starting another.");
    }
    if (!pending) {
      checks.delete(storageKey());
      pending = { planId: quote.plan.planId, couponCode: quote.couponCode || "", quoteId: quote.quoteId, requestId: newId(), plan: quote.plan };
      writePending(pending);
    }
    return recover();
  }
  async function recover(closeUnpaid = false) {
    const owner = scope();
    const draftKey = storageKey();
    const key = `${draftKey}:recover:${closeUnpaid}`;
    if (inflight.has(key)) return inflight.get(key);
    const pending = readPending();
    if (!pending) return null;
    const promise = (async () => {
      const result = pending.purchaseId
        ? await call("paymentStatus", { purchaseId: pending.purchaseId, ...(closeUnpaid ? { closeUnpaid: true } : {}) })
        : await call("paymentCreateOrder", {
          planId: pending.planId, couponCode: pending.couponCode,
          quoteId: pending.quoteId, requestId: pending.requestId,
        });
      assertOwner(owner);
      if (storageKey() !== draftKey) throw new Error("Payment mode changed. Refresh your plans and check payment again.");
      const current = readPending();
      if (!current || (pending.purchaseId ? current.purchaseId !== pending.purchaseId : current.requestId !== pending.requestId))
        throw new Error("Payment session changed in another tab. Check the latest payment before continuing.");
      return accept(result);
    })().catch((error) => {
      if (getUid() && scope() === owner && !pending.purchaseId && error?.details?.checkoutNotCreated === true) {
        if (storageKey() === draftKey && readPending()?.requestId === pending.requestId) {
          storage.removeItem(storageKey());
          invalidate();
          if (error.details.pendingCheckout?.purchaseId) remember(error.details.pendingCheckout);
        }
      }
      throw error;
    }).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }
  async function closePrevious() {
    // If the original create response was lost, recover exactly that request ID
    // first. Never silently create another provider order while it is unknown.
    const hadPurchase = Boolean(readPending()?.purchaseId);
    let result = await recover(true);
    if (!hadPurchase && result?.status === "created" && result.orderId) result = await recover(true);
    return result;
  }
  async function startFresh(quote) {
    rememberMode(quote);
    const owner = scope(), key = `${storageKey()}:fresh`;
    if (inflight.has(key)) return inflight.get(key);
    const promise = (async () => {
      if (readPending()) {
        const previous = await closePrevious();
        assertOwner(owner);
        if (!previous || !["failed", "expired"].includes(previous.status)) return { ...previous, previousCheckout: true };
      }
      try { return await create(quote); }
      catch (error) {
        // Server found an order on a different device. Do not automatically
        // close an interactive checkout there; user can explicitly check it.
        if (error?.details?.pendingCheckout) return { ...error.details.pendingCheckout, previousCheckout: true };
        throw error;
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }
  function remember(checkout) {
    rememberMode(checkout);
    writePending({ planId: checkout.plan.planId, plan: checkout.plan, purchaseId: checkout.purchaseId, checkout,
      quoteId: checkout.quoteId, couponCode: checkout.couponCode || "" });
  }
  async function check(minimumInterval = 15000) {
    const key = storageKey();
    const previous = checks.get(key);
    if (previous && now() - previous.at < minimumInterval) return previous.promise;
    const promise = closePrevious();
    checks.set(key, { at: now(), promise });
    promise.catch(() => checks.delete(key));
    return promise;
  }
  return {
    entitlement: async () => (await cached("paymentEntitlement", 30000)).entitlement,
    catalog: async (force = false) => rememberMode(await cached("paymentCatalog", 5 * 60000, {}, force)),
    history: async (cursor = null, force = false) => rememberMode(await cached("paymentHistory", 30000, { ...(cursor ? { cursor } : {}) }, force)),
    legacyHistory: (cursor = null) => cached("paymentLegacyHistory", 60000, { ...(cursor ? { cursor } : {}) }),
    quote: async (planId, couponCode = "") => {
      const owner = scope();
      const value = await call("paymentQuote", { planId, couponCode });
      assertOwner(owner);
      return rememberMode(value);
    },
    create, recover, check, readPending, invalidate,
    receipt: async (purchaseId) => {
      const owner = scope();
      const result = await call("paymentReceipt", { purchaseId });
      assertOwner(owner);
      return result.invoice;
    },
    remember, startFresh, closePrevious,
    verify: async (purchaseId, response) => {
      const owner = scope();
      const draftKey = storageKey();
      // Deliberately select only provider IDs/signature; no client money/identity.
      const result = await call("paymentVerify", {
        purchaseId, razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
      assertOwner(owner);
      if (storageKey() !== draftKey) throw new Error("Payment mode changed. Check payment again from the subscription page.");
      if (readPending()?.purchaseId !== purchaseId) {
        // Payment was still verified on the server. Do not overwrite another
        // tab's recovery record or silently clear a different active checkout.
        invalidate();
        return result;
      }
      return accept(result);
    },
  };
}
