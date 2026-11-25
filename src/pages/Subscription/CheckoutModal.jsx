import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@heroui/react";
import { getUser } from "../../utils/authStorage";
import { payments, paymentMessage } from "../../services/paymentService";
import { isPaid, serviceLabel } from "../../services/paymentClientCore.mjs";
import { ensurePaymentCheckout, openPaymentCheckout } from "../../services/paymentCheckout";

const money = (paise) => `₹${((paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CheckoutModal({ plan, isOpen, setIsOpen, onBack, onPaymentSuccess, onPendingChange, suggestedCoupon = "" }) {
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  const quoteVersion = useRef(0);
  const completed = useRef("");
  const [pending, setPending] = useState(null);

  const refreshPending = useCallback(() => {
    const value = payments.readPending();
    setPending(value);
    onPendingChange?.(value);
    return value;
  }, [onPendingChange]);

  const loadQuote = useCallback(async (code) => {
    const version = ++quoteVersion.current;
    setQuoteLoading(true);
    setQuote(null);
    setMessage("");
    try {
      const result = await payments.quote(plan.planId, code);
      if (version === quoteVersion.current) setQuote(result);
    } catch (error) {
      if (version === quoteVersion.current) setMessage(paymentMessage(error));
    } finally {
      if (version === quoteVersion.current) setQuoteLoading(false);
    }
  }, [plan?.planId]);

  useEffect(() => {
    if (!isOpen || !plan?.planId) return;
    completed.current = "";
    const saved = refreshPending();
    const code = saved?.couponCode ?? suggestedCoupon;
    setCoupon(code);
    if (saved?.checkout && saved.planId === plan.planId) {
      setQuote({ ...saved.checkout, quoteId: saved.quoteId, couponCode: saved.couponCode });
      setMessage("An earlier checkout is pending. Use Check payment before paying again.");
    } else { void loadQuote(code); }
    return () => { quoteVersion.current++; };
  }, [isOpen, plan?.planId, suggestedCoupon, loadQuote, refreshPending]);

  const finish = async (result) => {
    refreshPending();
    if (isPaid(result)) {
      if (completed.current !== result.purchaseId) {
        completed.current = result.purchaseId;
        await onPaymentSuccess?.(result);
      }
      setIsOpen(false);
      return true;
    }
    const texts = {
      expired: "This checkout has expired. If money was debited, check its status in payment history before making another payment.",
      failed: "Payment could not be completed. You can try again.",
      refunded: "This payment was refunded. It does not activate a plan.",
      partially_refunded: "This payment was partly refunded. Plan access has been removed.",
      disputed: "This payment is under review. Please contact support with the order ID.",
    };
    setMessage(texts[result?.status] || "Payment confirmation is pending. If money was debited, do not pay again. Use Check payment.");
    return false;
  };

  const checkPayment = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage("Checking payment…");
    try { const result = await payments.check(); if (result) await finish(result); }
    catch (error) { setMessage(paymentMessage(error)); }
    finally { refreshPending(); busyRef.current = false; setBusy(false); }
  };

  const purchase = async () => {
    if (busyRef.current || !quote || quoteLoading) return;
    busyRef.current = true; setBusy(true); setMessage("Preparing secure checkout…");
    try {
      await ensurePaymentCheckout();
      const saved = payments.readPending();
      if (saved && saved.planId !== plan.planId) throw new Error("An earlier plan payment is pending. Check it on the subscription page first.");
      const order = saved ? await payments.recover() : await payments.create(quote);
      refreshPending();
      if (isPaid(order)) { await finish(order); return; }
      if (!order?.orderId || !["created", "pending"].includes(order.status)) { await finish(order); return; }
      setMessage("Complete payment in the secure checkout. Your plan activates after confirmation.");
      const outcome = await openPaymentCheckout(order, getUser() || {});
      setMessage("Confirming your payment. Please wait…");
      if (outcome.status === "verify" && outcome.response) {
        const result = await payments.verify(order.purchaseId, outcome.response);
        await finish(result);
      } else {
        // Closing/cancelling is never proof of payment. Ask the server once.
        const result = await payments.recover();
        await finish(result);
        if (!isPaid(result) && outcome.message) setMessage(outcome.message + " Use Check payment if money was debited.");
      }
    } catch (error) {
      if (error?.details?.checkoutNotCreated === true) setQuote(null);
      setMessage(paymentMessage(error));
    }
    finally { refreshPending(); busyRef.current = false; setBusy(false); }
  };

  if (!plan) return null;
  const price = quote?.price;
  const close = () => { if (!busyRef.current) { setIsOpen(false); onBack?.(); } };
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open && !busyRef.current) setIsOpen(false); }}>
      <Modal.Backdrop className="bg-black/60 backdrop-blur-sm">
        <Modal.Container placement="center" className="px-4">
          <Modal.Dialog className="w-full max-w-md mx-auto rounded-2xl border border-border shadow-2xl bg-background overflow-hidden max-h-[92vh] flex flex-col">
            <Modal.Heading className="px-5 pt-5 text-lg font-bold">Secure Checkout</Modal.Heading>
            <Modal.Body className="space-y-4 px-5 overflow-y-auto">
              <div className="rounded-xl border border-accent/25 bg-accent/5 p-4">
                <p className="font-bold">{plan.PlanName}</p>
                <p className="text-sm text-muted-foreground">{serviceLabel(plan.serviceType)} · {plan.Day_value} days</p>
                <p className="text-xs text-muted-foreground mt-2">Renewals extend the same service. Poster and video validity are tracked separately.</p>
                {quote?.mode === "test" && <p className="text-sm font-bold text-amber-600 mt-2">Test payment — live access will not be activated</p>}
              </div>
              <label className="block text-sm font-medium">Coupon code
                <div className="flex gap-2 mt-1.5">
                  <input aria-label="Coupon code" value={coupon} maxLength={6} disabled={busy || Boolean(pending)}
                    onChange={(e) => { setCoupon(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase()); setQuote(null); }}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3 uppercase" placeholder="6 characters" />
                  <button onClick={() => loadQuote(coupon)} disabled={busy || quoteLoading || Boolean(pending) || (coupon.length > 0 && coupon.length !== 6)} className="px-3 rounded-xl border border-border disabled:opacity-50">{quoteLoading ? "Checking…" : "Apply"}</button>
                </div>
              </label>
              {!pending && coupon && <button disabled={busy || quoteLoading} onClick={() => { setCoupon(""); void loadQuote(""); }} className="text-xs text-accent underline">Remove coupon</button>}
              <div className="rounded-xl border border-border p-4 space-y-2 text-sm" aria-live="polite">
                {quoteLoading && <p>Getting current price…</p>}
                {price ? <>
                  <div className="flex justify-between"><span>Plan amount</span><span>{money(price.basePaise)}</span></div>
                  {price.discountPaise > 0 && <div className="flex justify-between text-green-600"><span>Discount ({price.discountBps / 100}%)</span><span>− {money(price.discountPaise)}</span></div>}
                  <div className="flex justify-between"><span>GST ({price.gstBps / 100}%)</span><span>{money(price.gstPaise)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 font-bold text-base"><span>Total payable</span><span>{money(price.totalPaise)}</span></div>
                </> : !quoteLoading && <p>Apply your coupon or refresh the price before continuing.</p>}
              </div>
              {message && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">{message}</p>}
              {pending?.checkout?.orderId && <p className="text-xs break-all text-muted-foreground">Order: {pending.checkout.orderId}</p>}
            </Modal.Body>
            <Modal.Footer className="flex flex-col gap-2 p-5 border-t border-border">
              {pending && <button onClick={checkPayment} disabled={busy} className="w-full p-3 rounded-xl border border-accent text-accent font-bold disabled:opacity-50">{busy ? "Please wait…" : "Check payment"}</button>}
              <button onClick={purchase} disabled={busy || quoteLoading || !quote} className="w-full p-3 rounded-xl bg-accent text-white font-bold disabled:opacity-50">{busy ? "Processing…" : pending ? "Resume this checkout" : `Pay ${price ? money(price.totalPaise) : ""}`}</button>
              {!quote && !quoteLoading && <button onClick={() => loadQuote(coupon)} disabled={busy} className="text-sm text-accent">Refresh price</button>}
              <button onClick={close} disabled={busy} className="w-full p-2 text-sm text-muted-foreground disabled:opacity-50">Back to plan details</button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
