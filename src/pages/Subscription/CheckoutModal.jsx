import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, ShieldCheck, CalendarDays, TicketPercent } from "lucide-react";
import PlanBanner from "./PlanBanner";
import { flushSync } from "react-dom";
import { getUser } from "../../utils/authStorage";
import { payments, paymentMessage } from "../../services/paymentService";
import { isPaid, serviceLabel } from "../../services/paymentClientCore.mjs";
import {
  ensurePaymentCheckout,
  openPaymentCheckout,
} from "../../services/paymentCheckout";
import PaymentSheet from "./PaymentSheet";
import { money } from "./planState.mjs";

export function CheckoutModal({
  plan,
  isOpen,
  setIsOpen,
  onBack,
  onPaymentSuccess,
  onPaymentResult,
  onPendingChange,
  suggestedCoupon = "",
}) {
  const [coupon, setCoupon] = useState(""),
    [quote, setQuote] = useState(null),
    [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(null),
    [gatewayOpen, setGatewayOpen] = useState(false);
  const busyRef = useRef(false),
    version = useRef(0),
    completed = useRef("");
  const refresh = useCallback(() => {
    const p = payments.readPending();
    setPending(p);
    onPendingChange?.(p);
    return p;
  }, [onPendingChange]);
  const loadQuote = useCallback(
    async (code) => {
      const v = ++version.current;
      setLoading(true);
      setQuote(null);
      setMessage("");
      try {
        const q = await payments.quote(plan.planId, code);
        if (v === version.current) setQuote(q);
      } catch (e) {
        if (v === version.current) setMessage(paymentMessage(e));
      } finally {
        if (v === version.current) setLoading(false);
      }
    },
    [plan?.planId],
  );
  useEffect(() => {
    if (!isOpen || !plan?.planId) return;
    completed.current = "";
    setMessage("");
    const saved = refresh(),
      code = saved?.couponCode ?? suggestedCoupon;
    setCoupon(code);
    if (saved?.checkout && saved.planId === plan.planId)
      setQuote({
        ...saved.checkout,
        quoteId: saved.quoteId,
        couponCode: saved.couponCode,
      });
    else void loadQuote(code);
    return () => {
      version.current++;
    };
  }, [isOpen, plan?.planId, suggestedCoupon, refresh, loadQuote]);
  const finish = async (result) => {
    refresh();
    if (isPaid(result)) {
      if (completed.current !== result.purchaseId) {
        completed.current = result.purchaseId;
        await onPaymentSuccess?.(result);
      }
      setIsOpen(false);
      return;
    }
    const status = result?.status || "pending";
    setMessage(
      ["failed", "expired"].includes(status)
        ? "This payment was not completed. Check its status before starting a new payment."
        : "Payment confirmation is pending. If money was debited, do not pay again.",
    );
    onPaymentResult?.(result || { status: "pending" });
  };
  const check = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("Checking payment…");
    try {
      const result = await payments.check();
      if (result) await finish(result);
    } catch (e) {
      setMessage(paymentMessage(e));
    } finally {
      refresh();
      busyRef.current = false;
      setBusy(false);
    }
  };
  const purchase = async () => {
    if (busyRef.current || !quote || loading) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("Preparing secure checkout…");
    try {
      await ensurePaymentCheckout();
      const saved = payments.readPending();
      if (saved && saved.planId !== plan.planId)
        throw Error("An earlier payment is pending. Check that payment first.");
      const order = saved
        ? await payments.recover()
        : await payments.create(quote);
      refresh();
      if (
        isPaid(order) ||
        !order?.orderId ||
        !["created", "pending"].includes(order.status)
      ) {
        await finish(order);
        return;
      }
      // Commit the removal of our dialog, focus handlers and scroll lock BEFORE
      // Razorpay mounts its separate iframe/native screen. No external overlay is inert.
      flushSync(() => setGatewayOpen(true));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      let outcome;
      try {
        outcome = await openPaymentCheckout(order, getUser() || {});
      } finally {
        setGatewayOpen(false);
      }
      setMessage("Confirming your payment…");
      const result =
        outcome.status === "verify" && outcome.response
          ? await payments.verify(order.purchaseId, outcome.response)
          : await payments.recover();
      await finish(result);
    } catch (e) {
      setGatewayOpen(false);
      if (e?.details?.checkoutNotCreated === true) setQuote(null);
      setMessage(paymentMessage(e));
    } finally {
      refresh();
      busyRef.current = false;
      setBusy(false);
    }
  };
  const close = useCallback(() => {
    if (!busyRef.current) {
      setIsOpen(false);
      onBack?.();
    }
  }, [setIsOpen, onBack]);
  if (!plan) return null;
  const price = quote?.price;
  return (
    <PaymentSheet
      open={isOpen && !gatewayOpen}
      title="Secure checkout"
      onClose={close}
      busy={busy}
      variant="screen"
      footer={
        <>
          {pending && (
            <button onClick={check} disabled={busy} className="mlm-secondary">
              Check payment
            </button>
          )}
          <button
            onClick={purchase}
            disabled={busy || loading || !quote}
            className="mlm-primary"
          >
            <LockKeyhole size={19} />
            {busy
              ? "Please wait…"
              : pending
                ? "Resume this checkout"
                : `Continue to pay ${price ? money(price.totalPaise) : ""}`}
          </button>
          <div className="mlm-secure-footer"><ShieldCheck size={20}/><span>Secured by <strong>Razorpay</strong></span></div>
          {!quote && !loading && (
            <button
              onClick={() => loadQuote(coupon)}
              disabled={busy}
              className="mlm-text-button"
            >
              Refresh price
            </button>
          )}
          <button onClick={close} disabled={busy} className="mlm-text-button">
            Back to plan details
          </button>
        </>
      }
    >
      <div className={`mlm-checkout-plan mlm-checkout-${plan.serviceType || "poster"}`}>
        <PlanBanner plan={plan} priority/>
        <div><h3>{plan.PlanName}</h3><p>{serviceLabel(plan.serviceType)}</p><p className="mlm-checkout-validity"><CalendarDays size={16}/> {plan.Day_value} days validity</p></div>
      </div>
      {quote?.mode === "test" && (
        <p className="mlm-notice">Test payment — live access stays separate.</p>
      )}
      <label className="mlm-label">
        Coupon code
        <div className="mlm-coupon-row">
          <TicketPercent size={22} className="mlm-coupon-icon" aria-hidden="true"/>
          <input
            aria-label="Coupon code"
            value={coupon}
            maxLength={6}
            disabled={busy || Boolean(pending)}
            placeholder="Enter coupon code"
            onChange={(e) => {
              setCoupon(
                e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(),
              );
              setQuote(null);
            }}
          />
          <button
            disabled={
              busy ||
              loading ||
              Boolean(pending) ||
              (coupon.length > 0 && coupon.length !== 6)
            }
            onClick={() => loadQuote(coupon)}
          >
            {loading ? "Checking…" : "Apply"}
          </button>
        </div>
      </label>
      {!pending && coupon && (
        <button
          disabled={busy || loading}
          className="mlm-text-button"
          onClick={() => {
            setCoupon("");
            void loadQuote("");
          }}
        >
          Remove coupon
        </button>
      )}
      <h3 className="mlm-price-title">Price details</h3>
      <div className="mlm-payment-summary" aria-live="polite">
        {loading ? (
          <p>Getting current price…</p>
        ) : price ? (
          <>
            <p>
              <span>Plan amount</span>
              <strong>{money(price.basePaise)}</strong>
            </p>
            {price.discountPaise > 0 && (
              <p className="mlm-discount-row">
                <span>Discount ({price.discountBps / 100}%)</span>
                <strong>− {money(price.discountPaise)}</strong>
              </p>
            )}
            <p>
              <span>GST ({price.gstBps / 100}%)</span>
              <strong>{money(price.gstPaise)}</strong>
            </p>
            <p className="mlm-summary-total">
              <span>Total payable</span>
              <strong>{money(price.totalPaise)}</strong>
            </p>
          </>
        ) : (
          <p>Refresh the price before continuing.</p>
        )}
      </div>
      {message && (
        <p role="status" className="mlm-notice">
          {message}
        </p>
      )}
      {pending?.checkout?.orderId && (
        <p className="mlm-small mlm-muted mlm-break">
          Order: {pending.checkout.orderId}
        </p>
      )}
    </PaymentSheet>
  );
}
