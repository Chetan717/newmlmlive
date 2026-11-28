import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
  Clock,
  Crown,
  Download,
  History,
  Image,
  RefreshCw,
  Video,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import PaymentSheet from "./PaymentSheet";
import { useAuth } from "../../Auth/AuthContext";
import { payments, paymentMessage } from "../../services/paymentService";
import { isPaid, serviceLabel } from "../../services/paymentClientCore.mjs";
import { CheckoutModal } from "./CheckoutModal";
import { PlanModal } from "./PlanModal";
import {
  dateLabel,
  eligiblePlans,
  grantAvailable,
  money,
} from "./planState.mjs";
import "./plans.css";
import PlanBanner from "./PlanBanner";

function PlanCard({ plan, onChoose, priority = false }) {
  const kind = plan.serviceType || "poster";
  const combo = kind === "combo";
  const amount = money(plan.amountPaise ?? Math.round(Number(plan.PlanAmount) * 100));
  const description = combo ? "Poster Design + Video Editing in one plan." : kind === "video" ? "Get your videos professionally edited." : "Create and download professional posters.";
  return (
    <article className={`mlm-plan-card mlm-banner-card mlm-plan-${kind} ${combo ? "mlm-plan-featured" : ""}`}>
      <div className="mlm-banner-wrap">
        <PlanBanner plan={plan} priority={priority}/>
        {combo && <span className="mlm-combo-label"><Crown size={12}/> Combo benefits</span>}
      </div>
      <div className="mlm-banner-body">
        <h3>{plan.PlanName}</h3>
        <p className="mlm-banner-description">{description}</p>
        <div className="mlm-clean-benefits">
          {kind !== "video" && <span><Image size={14}/>{plan.unlimitedDownloads ? "Unlimited posters" : `${plan.downloads || 0} poster downloads`}</span>}
          {kind !== "poster" && <span><Video size={14}/>{plan.videoCredits == null ? "Video service access" : `${plan.videoCredits} video credits`}</span>}
        </div>
        <div className="mlm-banner-footer">
          <div className="mlm-banner-price"><strong>{amount}</strong><span className="mlm-duration-pill">{plan.Day_value} days</span></div>
          <button type="button" className="mlm-compact-buy mlm-compact-buy-featured" aria-label={`Buy ${plan.PlanName}`} onClick={() => onChoose(plan)}>Buy Now <ChevronRight size={15}/></button>
        </div>
      </div>
    </article>
  );
}
function ActiveCard({ grants, purchasedPlan, onInvoice, invoiceBusy }) {
  const first = grants[0];
  const kind = purchasedPlan?.serviceType || (grants.length > 1 ? "combo" : first.serviceType || "poster");
  const now = Date.now();
  const scheduled = grants.every(g => g.startsAtMs > now);
  const name = first.planName || purchasedPlan?.PlanName || "Active plan";
  return (
    <article className={`mlm-active-card mlm-banner-active mlm-active-${kind}`}>
      <PlanBanner plan={purchasedPlan || {PlanName: name}} kind={kind}/>
      <div className="mlm-banner-body">
        <div className="mlm-active-title"><h3>{name}</h3><span className={`mlm-tag ${scheduled ? "is-scheduled" : "is-active"}`}>{scheduled ? "Scheduled" : "Active"}</span></div>
        <div className="mlm-active-facts">
          {grants.map(g => <div className="mlm-active-fact" key={`date-${g.serviceType || "poster"}`}><CalendarDays size={15}/><span>{grants.length > 1 ? `${serviceLabel(g.serviceType)} · ` : ""}{g.startsAtMs > now ? "Starts on" : "Valid till"}</span><strong>{dateLabel(g.startsAtMs > now ? g.startsAtMs : g.expiresAtMs)}</strong></div>)}
          <div className="mlm-active-fact"><ShieldCheck size={15}/><span>Access type</span><strong>{serviceLabel(grants.length > 1 ? "combo" : first.serviceType)}</strong></div>
          {grants.map(g => {const poster = (g.serviceType || "poster") === "poster";return <div className="mlm-active-fact" key={`credits-${g.serviceType || "poster"}`}>{poster ? <Image size={15}/> : <Video size={15}/>}<span>{poster ? "Poster downloads" : "Video credits"}</span><strong>{poster ? (g.unlimitedDownloads ? "Unlimited" : `${g.remainingDownloads} left`) : (g.remainingCredits == null ? "Period access" : `${Math.max(0,g.remainingCredits-(g.reservedVideoCredits||0))} left`)}</strong></div>;})}
        </div>
        <div className="mlm-clean-active-actions">
          <button type="button" className="mlm-active-invoice" aria-label="Download invoice" onClick={() => onInvoice(first.purchaseId)} disabled={Boolean(invoiceBusy)}><Download size={13}/>{invoiceBusy === first.purchaseId ? "Preparing…" : "Invoice"}</button>
        </div>
      </div>
    </article>
  );
}
export default function MainSubscription() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);
  useEffect(() => {
    if (!location.state?.premiumPoster) return;
    setShowPremiumPrompt(true);
    const { premiumPoster, ...state } = location.state;
    navigate(location.pathname + location.search + location.hash, { replace: true, state });
  }, [location, navigate]);
  const closePremiumPrompt = useCallback(() => setShowPremiumPrompt(false), []);
  const { user } = useAuth(),
    uid = user?.uid,
    owner = useRef(uid),
    epoch = useRef(0);
  owner.current = uid;
  const [catalog, setCatalog] = useState({
      plans: [],
      mode: "",
      suggestedCoupon: "",
    }),
    [data, setData] = useState({ items: [], entitlement: null, cursor: null });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState("plans"),
    [outcome, setOutcome] = useState(null);
  const [selected, setSelected] = useState(null),
    [details, setDetails] = useState(false),
    [checkout, setCheckout] = useState(false),
    [pending, setPending] = useState(null);
  const [checking, setChecking] = useState(false),
    [invoiceBusy, setInvoiceBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [legacy, setLegacy] = useState(null),
    [legacyBusy, setLegacyBusy] = useState(false);
  // One same-URL history entry protects the internal checkout stack. Browser
  // Back and older native WebViews stay in the payment screen during processing.
  const internalBackRef = useRef(null);
  const internalActive = checkout || details || showPremiumPrompt || view !== "plans";
  internalBackRef.current = { active: internalActive, checkout, back: () => {
    if (checkout) window.dispatchEvent(new Event("mlmlive-payment-back"));
    else if (details) setDetails(false);
    else if (showPremiumPrompt) setShowPremiumPrompt(false);
    else setView("plans");
  }};
  useEffect(() => {
    const back = () => { if (!internalBackRef.current?.active) return; internalBackRef.current.back(); };
    const nativeBack = () => { if (internalBackRef.current?.active && !internalBackRef.current.checkout) back(); };
    window.addEventListener("mlmlive-payment-back", nativeBack);
    return () => window.removeEventListener("mlmlive-payment-back", nativeBack);
  }, []);
  useEffect(() => {
    if (!internalActive) {
      if (window.history.state?.mlmPaymentInternal) window.history.back();
      return;
    }
    const page = window.location.pathname;
    const push = () => window.history.pushState({ ...window.history.state, mlmPaymentInternal: true }, "", window.location.href);
    if (!window.history.state?.mlmPaymentInternal) push();
    const pop = () => {
      if (window.location.pathname !== page || !internalBackRef.current?.active || window.history.state?.mlmPaymentInternal) return;
      push();
      internalBackRef.current.back();
    };
    window.addEventListener("popstate", pop);
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "PAYMENT_NAV_GUARD", active: true }));
    return () => {
      window.removeEventListener("popstate", pop);
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "PAYMENT_NAV_GUARD", active: false }));
    };
  }, [internalActive]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const historyInFlight = useRef(false), historyLoaded = useRef(false);
  const reload = useCallback(
    async (force = false) => {
      if (!uid) {
        setLoading(false);
        setError("Sign in to view app plans.");
        return;
      }
      const n = ++epoch.current;
      if (force) payments.invalidate();
      setLoading(true);
      setError("");
      try {
        const c = await payments.catalog(force);
        if (owner.current !== uid || epoch.current !== n) return;
        setCatalog(c);
        setData(old => ({ ...old, entitlement: c.entitlement }));
        historyLoaded.current = false;
        if (!payments.readPending() && c.pendingCheckout) payments.remember(c.pendingCheckout);
        setPending(payments.readPending());
      } catch (e) {
        if (owner.current === uid && epoch.current === n) setError(paymentMessage(e));
      }
      if (owner.current !== uid || epoch.current !== n) return;
      setLoading(false);
    },
    [uid],
  );
  useEffect(() => {
    historyLoaded.current = false;
    historyInFlight.current = false;
    setHistoryBusy(false);
    setCatalog({ plans: [], mode: "", suggestedCoupon: "" });
    setData({ items: [], entitlement: null, cursor: null });
    setLegacy(null);
    setOutcome(null);
    setView("plans");
    setDetails(false);
    setCheckout(false);
    setSelected(null);
    setPending(null);
    setNotice("");
    setInvoiceBusy("");
    setChecking(false);
    void reload();
    return () => {
      epoch.current++;
    };
  }, [uid, reload]);
  useEffect(() => {
    let last = Date.now();
    const resume = () => {
      if (
        document.visibilityState === "hidden" ||
        checkout ||
        Date.now() - last < 30000
      )
        return;
      last = Date.now();
      void reload(true);
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("mlmlive-payment-resume", resume);
    return () => {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("mlmlive-payment-resume", resume);
    };
  }, [reload, checkout]);
  useEffect(() => {
    const next = (data.entitlement?.grants || [])
      .flatMap((g) => [g.startsAtMs, g.expiresAtMs])
      .filter((t) => t > Date.now())
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const timer = setTimeout(
      () => void reload(true),
      Math.min(next - Date.now() + 1000, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [data.entitlement, reload]);
  useEffect(() => {
    const scroller = document.querySelector(".mlm-main-scroll-container");
    if (scroller) scroller.scrollTop = 0;
  }, [view]);
  const onPaid = useCallback(
    async (result) => {
      if (!isPaid(result)) return;
      setOutcome(result);
      setView("result");
      setDetails(false);
      setCheckout(false);
      setPending(null);
      await reload(true);
    },
    [reload],
  );
  const check = async () => {
    if (checking) return;
    const account = uid;
    setChecking(true);
    setNotice("");
    try {
      const result = await payments.check();
      if (owner.current !== account) return;
      setPending(payments.readPending());
      if (isPaid(result)) await onPaid(result);
      else if (result) {
        setOutcome(result);
        setView("result");
      }
    } catch (e) {
      if (owner.current === account) setNotice(paymentMessage(e));
    } finally {
      if (owner.current === account) setChecking(false);
    }
  };
  const invoice = async (id) => {
    if (invoiceBusy) return;
    const account = uid;
    setInvoiceBusy(id);
    setNotice("");
    try {
      const record = await payments.receipt(id);
      if (owner.current !== account) return;
      const { downloadPaymentInvoice } = await import(
        "../../services/paymentInvoice"
      );
      if (owner.current !== account) return;
      await downloadPaymentInvoice(record);
    } catch (e) {
      if (owner.current === account) setNotice(paymentMessage(e));
    } finally {
      if (owner.current === account) setInvoiceBusy("");
    }
  };
  const choose = (plan) => {
    setSelected(plan);
    setDetails(true);
  };
  const available = data.entitlement
    ? eligiblePlans(catalog.plans, data.entitlement)
    : [];
  const groups = new Map();
  for (const g of data.entitlement?.grants || [])
    if (grantAvailable(g)) {
      if (!groups.has(g.purchaseId)) groups.set(g.purchaseId, []);
      groups.get(g.purchaseId).push(g);
    }
  const resultPaid = isPaid(outcome),
    resultPending =
      outcome &&
      ![
        "paid",
        "failed",
        "expired",
        "refunded",
        "partially_refunded",
        "disputed",
      ].includes(outcome.status);
  const ResultIcon = resultPaid ? Crown : resultPending ? Clock : X;
  const historyMore = async (initial = false) => {
    if (historyInFlight.current) return;
    historyInFlight.current = true;
    setHistoryBusy(true);
    try {
      const page = await payments.history(initial ? null : data.cursor, initial);
      if (owner.current === uid) {
        historyLoaded.current = true;
        setData((old) => ({
          ...page,
          entitlement: old.entitlement || page.entitlement,
          items: [
            ...new Map(
              [...(initial ? [] : old.items), ...page.items].map((p) => [p.purchaseId, p]),
            ).values(),
          ],
        }));
      }
    } catch (e) {
      if (owner.current === uid) setNotice(paymentMessage(e));
    } finally {
      if (owner.current === uid) { historyInFlight.current = false; setHistoryBusy(false); }
    }
  };
  useEffect(() => { if (view === "history" && !loading && !historyLoaded.current) void historyMore(true); }, [view, loading, uid]);
  const earlier = async () => {
    if (legacyBusy) return;
    setLegacyBusy(true);
    try {
      const page = await payments.legacyHistory(legacy?.cursor);
      if (owner.current === uid)
        setLegacy((old) => ({
          ...page,
          items: [
            ...new Map(
              [...(old?.items || []), ...page.items].map((p) => [p.id, p]),
            ).values(),
          ],
        }));
    } catch (e) {
      setNotice(paymentMessage(e));
    } finally {
      setLegacyBusy(false);
    }
  };
  return (
    <div
      className={`mlm-plans mlm-plans-page ${view === "result" ? "mlm-result-page" : view === "plans" ? "mlm-plans-no-hero" : ""}`}
    >
      {view !== "result" && view !== "plans" && (
        <header className="mlm-plans-header">
          <div className="mlm-header-content"><div className="mlm-title-row">
            <button className="mlm-back" aria-label="Back to plans" onClick={() => setView("plans")}><ArrowLeft size={22}/></button>
            <h1>{view === "my" ? "My plan" : "Purchase history"}</h1>
          </div></div>
        </header>
      )}
      <PaymentSheet open={showPremiumPrompt} title="Premium design" onClose={closePremiumPrompt}
        footer={<button className="mlm-primary" onClick={closePremiumPrompt}>View plans</button>}>
        <p>Choose a Poster Design or Combo plan to download this premium design.</p>
      </PaymentSheet>
      <main className="mlm-plans-content">
        {catalog.mode === "test" && (
          <p className="mlm-notice mlm-test-notice">
            TEST MODE · Test purchases do not activate live access.
          </p>
        )}
        {notice && (
          <p role="status" className="mlm-notice">
            {notice}
          </p>
        )}
        {error && (
          <div role="alert" className="mlm-notice mlm-error">
            {error}
            <button className="mlm-text-button" onClick={() => reload(true)}>
              Retry loading
            </button>
          </div>
        )}
        {view === "result" && outcome ? (
          <section className="mlm-result">
            <button type="button" className="mlm-secondary mlm-result-back" onClick={() => setView("plans")}><ArrowLeft size={18}/> Back to plans</button>
            <div
              className={`mlm-result-symbol ${resultPaid ? "is-success" : resultPending ? "is-pending" : "is-failed"}`}
            >
              <ResultIcon size={31} />
            </div>
            <h1>
              {resultPaid
                ? outcome.mode === "test"
                  ? "Test purchase verified"
                  : "Your plan is ready"
                : resultPending
                  ? (outcome.status === "created" ? "Previous checkout needs a status check" : "Payment confirmation pending")
                  : outcome.status === "refunded"
                    ? "Payment refunded"
                    : outcome.status === "partially_refunded"
                      ? "Payment partly refunded"
                      : outcome.status === "disputed"
                        ? "Payment under review"
                        : outcome.status === "expired" ? "Checkout cancelled" : "Payment failed"}
            </h1>
            <p>
              {resultPaid
                ? `${outcome.plan?.PlanName || "Your plan"} — payment verified.`
                : resultPending
                  ? "If money was debited, check this payment before paying again. This is the earlier order, not a new charge."
                  : "This checkout is closed. You can choose a new plan. If money was debited, contact support with your order ID."}
            </p>
            <div className="mlm-payment-summary">
              <p>
                <span>Plan</span>
                <strong>{outcome.plan?.PlanName || "—"}</strong>
              </p>
              <p>
                <span>{resultPaid ? "Amount paid" : "Order amount"}</span>
                <strong>{money(outcome.price?.totalPaise)}</strong>
              </p>
              <p>
                <span>Order ID</span>
                <strong className="mlm-break">
                  {outcome.orderId || outcome.purchaseId || "Pending"}
                </strong>
              </p>
              {resultPaid && (
                <p>
                  <span>Access until</span>
                  <strong>{dateLabel(outcome.subscriptionExpiresAtMs)}</strong>
                </p>
              )}
            </div>
            <div className="mlm-result-actions">
              {resultPaid ? (
                <>
                  <button className="mlm-primary" onClick={() => setView("my")}>
                    View my plans
                  </button>
                  <button
                    className="mlm-secondary mlm-result-invoice"
                    aria-label="Download invoice"
                    disabled={Boolean(invoiceBusy)}
                    onClick={() => invoice(outcome.purchaseId)}
                  >
                    <Download size={18} />
                    {invoiceBusy ? "Preparing…" : "Invoice"}
                  </button>
                </>
              ) : pending ? (
                <>
                  <button
                    className="mlm-primary"
                    disabled={checking}
                    onClick={check}
                  >
                    {checking ? "Checking…" : "Check payment"}
                  </button>

                </>
              ) : (
                <button
                  className="mlm-primary"
                  onClick={() => {
                    setView("plans");
                    void reload(true);
                  }}
                >
                  View available plans
                </button>
              )}
              <button
                className="mlm-text-button"
                onClick={() => setView("history")}
              >
                Purchase history
              </button>
            </div>
          </section>
        ) : (
          <>
            {pending && (
              <section className="mlm-pending-card">
                <Clock size={20} />
                <div>
                  <h3>{pending.checkout?.status === "created" ? "Previous checkout" : "Payment confirmation pending"}</h3>
                  <p>
                    {pending.plan?.PlanName || pending.checkout?.plan?.PlanName}{" "}
                    · Check this order before paying again.
                  </p>
                  <button disabled={checking} onClick={check}>
                    {checking ? "Checking…" : "Check payment"}
                  </button>

                </div>
              </section>
            )}
            {view === "history" ? (
              <section className="mlm-history-list">
                {historyBusy && <p role="status">Loading payment history…</p>}
                {!historyBusy && !historyLoaded.current && <button className="mlm-secondary" onClick={() => historyMore(true)}>Retry history</button>}
                {!data.items.length && !loading && !historyBusy && historyLoaded.current && (
                  <p className="mlm-empty">
                    Your payment history will appear here.
                  </p>
                )}
                {data.items.map((p) => (
                  <article className="mlm-history-card" key={p.purchaseId}>
                    <div className="mlm-title-row">
                      <h3>{p.plan.PlanName}</h3>
                      <strong>{money(p.price.totalPaise)}</strong>
                    </div>
                    <p>
                      {dateLabel(p.paidAtMs || p.createdAtMs)} ·{" "}
                      <span className={`mlm-status mlm-status-${p.status}`}>
                        {p.status.replaceAll("_", " ")}
                      </span>
                      {p.mode === "test" ? " · TEST" : ""}
                    </p>
                    <p className="mlm-small mlm-break">
                      {p.orderId || p.purchaseId}
                    </p>
                    {[
                      "paid",
                      "refunded",
                      "partially_refunded",
                      "disputed",
                    ].includes(p.status) && (
                      <button
                        disabled={Boolean(invoiceBusy)}
                        className="mlm-text-button"
                        aria-label="Download invoice"
                        onClick={() => invoice(p.purchaseId)}
                      >
                        <Download size={15} />
                        {invoiceBusy === p.purchaseId
                          ? "Preparing…"
                          : "Invoice"}
                      </button>
                    )}
                    {[
                      "created",
                      "pending",
                      "creating",
                      "creation_unknown",
                    ].includes(p.status) && (
                      <button
                        className="mlm-text-button"
                        onClick={() => {
                          payments.remember(p);
                          setPending(payments.readPending());
                          void check();
                        }}
                      >
                        Check payment
                      </button>
                    )}
                  </article>
                ))}
                {data.cursor && (
                  <button className="mlm-secondary" disabled={historyBusy} onClick={() => historyMore(false)}>
                    Load more payments
                  </button>
                )}
                <button
                  className="mlm-text-button"
                  disabled={legacyBusy}
                  onClick={earlier}
                >
                  {legacyBusy
                    ? "Loading…"
                    : legacy?.cursor
                      ? "Load more earlier subscriptions"
                      : "View earlier subscriptions"}
                </button>
                {legacy?.items.map((p) => (
                  <article className="mlm-history-card" key={p.id}>
                    <h3>{p.plan}</h3>
                    <p>Earlier subscription · {p.payment}</p>
                    <p>{dateLabel(p.expirydate)}</p>
                  </article>
                ))}
              </section>
            ) : (
              <>
                {(view === "plans" || groups.size > 0) && (
                  <section className="mlm-active-list mlm-active-first" aria-label="My active plans">
                    {view === "plans" && <h2 className="mlm-section-heading">My Active Plans</h2>}
                    {!loading && !error && groups.size === 0 && <p className="mlm-no-active">No active plans yet. Choose a plan below to get started.</p>}
                    {[...groups.entries()].map(([id, grants]) => (
                      <ActiveCard
                        key={id}
                        grants={grants}
                        purchasedPlan={data.items.find(p => p.purchaseId === id)?.plan || catalog.activePlans?.[id] || (grants[0]?.planImageUrl ? {PlanName:grants[0].planName,image_url:grants[0].planImageUrl,serviceType:grants.length>1?"combo":grants[0].serviceType} : undefined)}
                        onInvoice={invoice}
                        invoiceBusy={invoiceBusy}
                      />
                    ))}
                  </section>
                )}
                {loading ? (
                  <div className="mlm-loading" role="status">
                    Loading your plans…
                  </div>
                ) : data.entitlement && available.length > 0 ? (
                  <section
                    aria-label="Available plans"
                    className="mlm-available-plans"
                  >
                    {groups.size > 0 && <p className="mlm-additional-note"><ShieldCheck size={19}/> These services can be purchased separately from your current plan.</p>}
                    {available
                      .filter((p) => p.serviceType === "combo")
                      .map((p, i) => (
                        <PlanCard key={p.planId} plan={p} onChoose={choose} priority={i === 0 && groups.size === 0} />
                      ))}
                    
                    {available
                      .filter((p) => p.serviceType !== "combo")
                      .map((p) => (
                        <PlanCard key={p.planId} plan={p} onChoose={choose} />
                      ))}
                    
                    <p className="mlm-catalog-note">
                      One-time payment, no automatic renewal. GST is calculated
                      at checkout. You can buy a service again after its plan
                      expires or credits are used.
                    </p>
                  </section>
                ) : (
                  !loading &&
                  !error && (
                    <p className="mlm-empty">
                      {groups.size
                        ? "Your services are already active. Plans become available when a service expires or its credits are used."
                        : "No plans are published yet."}
                    </p>
                  )
                )}
                <div className="mlm-action-list">
                  <button
                    onClick={() => setView(view === "my" ? "plans" : "my")}
                  >
                    <Crown size={20} />
                    {view === "my" ? "View available plans" : "My plan"}
                    <ChevronRight size={19} />
                  </button>
                  <button onClick={() => setView("history")}>
                    <History size={20} />
                    Purchase history
                    <ChevronRight size={19} />
                  </button>
                  <button disabled={loading} onClick={() => reload(true)}>
                    <RefreshCw size={19} />
                    Refresh my purchases
                    <ChevronRight size={19} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <PlanModal
        plan={selected}
        openA={details}
        setOpenA={setDetails}
        onProceedToCheckout={() => {
          setDetails(false);
          setCheckout(true);
        }}
      />
      <CheckoutModal
        plan={selected}
        isOpen={checkout}
        setIsOpen={setCheckout}
        onBack={() => setDetails(true)}
        onPaymentSuccess={onPaid}
        onPaymentResult={(result) => {
          setOutcome(result);
          setView("result");
          setCheckout(false);
        }}
        onPendingChange={setPending}
        suggestedCoupon={catalog.suggestedCoupon}
      />
    </div>
  );
}
