import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
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

const kindIcon = (kind) =>
  kind === "combo" ? Crown : kind === "video" ? Video : Image;
function PlanCard({ plan, onChoose }) {
  const Icon = kindIcon(plan.serviceType),
    combo = plan.serviceType === "combo";
  return (
    <article className={`mlm-plan-card ${combo ? "mlm-plan-featured" : ""}`}>
      <div className="mlm-plan-row">
        <span className="mlm-service-icon">
          {plan.image_url ? (
            <img src={plan.image_url} alt="" />
          ) : (
            <Icon size={23} />
          )}
        </span>
        <div className="mlm-plan-copy">
          <div className="mlm-title-row">
            <h3>{plan.PlanName}</h3>
            {combo && <span className="mlm-tag">COMBO</span>}
          </div>
          <p>
            {serviceLabel(plan.serviceType)} · {plan.Day_value} days
          </p>
        </div>
        {!combo && (
          <div className="mlm-plan-buy">
            <strong>
              {money(
                plan.amountPaise ?? Math.round(Number(plan.PlanAmount) * 100),
              )}
            </strong>
            <button
              aria-label={`View ${plan.PlanName}`}
              onClick={() => onChoose(plan)}
            >
              Buy
            </button>
          </div>
        )}
      </div>
      {combo && (
        <div className="mlm-featured-bottom">
          <strong>
            {money(
              plan.amountPaise ?? Math.round(Number(plan.PlanAmount) * 100),
            )}
          </strong>
          <button onClick={() => onChoose(plan)}>Buy Combo</button>
        </div>
      )}
    </article>
  );
}
function ActiveCard({ grants, onInvoice, invoiceBusy }) {
  const first = grants[0],
    kind = grants.length > 1 ? "combo" : first.serviceType || "poster",
    Icon = kindIcon(kind);
  return (
    <article className="mlm-active-card">
      <div className="mlm-plan-row">
        <span className="mlm-service-icon">
          <Icon size={23} />
        </span>
        <div className="mlm-plan-copy">
          <div className="mlm-title-row">
            <h3>{first.planName || "Active plan"}</h3>
            <span className="mlm-tag">
              {first.startsAtMs > Date.now() ? "SCHEDULED" : "ACTIVE"}
            </span>
          </div>
          <p>{serviceLabel(kind)}</p>
        </div>
      </div>
      {grants.map((g) => (
        <div className="mlm-active-service" key={g.serviceType || "poster"}>
          <p>
            {serviceLabel(g.serviceType)} ·{" "}
            {g.startsAtMs > Date.now() ? "Starts" : "Access until"}{" "}
            {dateLabel(
              g.startsAtMs > Date.now() ? g.startsAtMs : g.expiresAtMs,
            )}
          </p>
          <span>
            {(g.serviceType || "poster") === "poster"
              ? g.unlimitedDownloads
                ? "Unlimited downloads"
                : `${g.remainingDownloads} credits left`
              : g.remainingCredits == null
                ? "Valid for this period"
                : `${g.remainingCredits} credits left`}
          </span>
        </div>
      ))}
      <button
        className="mlm-active-invoice"
        onClick={() => onInvoice(first.purchaseId)}
        disabled={Boolean(invoiceBusy)}
      >
        <Download size={15} />
        {invoiceBusy === first.purchaseId ? "Preparing…" : "Download invoice"}
      </button>
    </article>
  );
}
export default function MainSubscription() {
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
      const results = await Promise.allSettled([
        payments.catalog(force),
        payments.history(null, force),
      ]);
      if (owner.current !== uid || epoch.current !== n) return;
      const [c, h] = results;
      if (c.status === "fulfilled") setCatalog(c.value);
      if (h.status === "fulfilled") {
        setData(h.value);
        if (!payments.readPending()) {
          const saved = h.value.items.find((p) =>
            ["created", "pending", "creating", "creation_unknown"].includes(
              p.status,
            ),
          );
          if (saved) payments.remember(saved);
        }
      } else if (c.status === "fulfilled" && c.value.entitlement)
        setData((old) => ({ ...old, entitlement: c.value.entitlement }));
      if (c.status === "rejected" || h.status === "rejected")
        setError(paymentMessage(c.status === "rejected" ? c.reason : h.reason));
      setPending(payments.readPending());
      setLoading(false);
    },
    [uid],
  );
  useEffect(() => {
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
  const historyMore = async () => {
    try {
      const page = await payments.history(data.cursor);
      if (owner.current === uid)
        setData((old) => ({
          ...page,
          items: [
            ...new Map(
              [...old.items, ...page.items].map((p) => [p.purchaseId, p]),
            ).values(),
          ],
        }));
    } catch (e) {
      setNotice(paymentMessage(e));
    }
  };
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
      className={`mlm-plans mlm-plans-page ${view === "result" ? "mlm-result-page" : ""}`}
    >
      {view !== "result" && (
        <header className="mlm-plans-header">
          <div className="mlm-header-content">
            <div className="mlm-title-row">
              {view !== "plans" && (
                <button
                  className="mlm-back"
                  aria-label="Back to plans"
                  onClick={() => setView("plans")}
                >
                  <ArrowLeft size={22} />
                </button>
              )}
              <h1>
                {view === "my"
                  ? "My plan"
                  : view === "history"
                    ? "Purchase history"
                    : "Plans"}
              </h1>
            </div>
            <p>
              {view === "plans"
                ? "Poster designs and video editing, in one place."
                : view === "my"
                  ? "Your services, validity and credits."
                  : "Your verified payments and invoices."}
            </p>
          </div>
        </header>
      )}
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
                  ? "Payment confirmation pending"
                  : outcome.status === "refunded"
                    ? "Payment refunded"
                    : outcome.status === "partially_refunded"
                      ? "Payment partly refunded"
                      : outcome.status === "disputed"
                        ? "Payment under review"
                        : "Payment didn't complete"}
            </h1>
            <p>
              {resultPaid
                ? `${outcome.plan?.PlanName || "Your plan"} — payment verified.`
                : resultPending
                  ? "If money was debited, check this payment before paying again. You can safely reopen the app and recover this order."
                  : "Check the payment status before trying again. Contact support with your order ID if money was debited."}
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
                    className="mlm-secondary"
                    disabled={Boolean(invoiceBusy)}
                    onClick={() => invoice(outcome.purchaseId)}
                  >
                    <Download size={18} />
                    {invoiceBusy ? "Preparing invoice…" : "Download invoice"}
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
                  <button
                    className="mlm-secondary"
                    onClick={() => {
                      setSelected(pending.plan || pending.checkout?.plan);
                      setCheckout(true);
                    }}
                  >
                    Resume this checkout
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
                  <h3>Payment confirmation pending</h3>
                  <p>
                    {pending.plan?.PlanName || pending.checkout?.plan?.PlanName}{" "}
                    · Check this order before paying again.
                  </p>
                  <button disabled={checking} onClick={check}>
                    {checking ? "Checking…" : "Check payment"}
                  </button>
                  <button
                    onClick={() => {
                      setSelected(pending.plan || pending.checkout?.plan);
                      setCheckout(true);
                    }}
                  >
                    Resume checkout
                  </button>
                </div>
              </section>
            )}
            {view === "history" ? (
              <section className="mlm-history-list">
                {!data.items.length && !loading && (
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
                        onClick={() => invoice(p.purchaseId)}
                      >
                        <Download size={15} />
                        {invoiceBusy === p.purchaseId
                          ? "Preparing…"
                          : "Download invoice"}
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
                  <button className="mlm-secondary" onClick={historyMore}>
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
                {groups.size > 0 && (
                  <section className="mlm-active-list">
                    {[...groups.entries()].map(([id, grants]) => (
                      <ActiveCard
                        key={id}
                        grants={grants}
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
                    {groups.size > 0 && (
                      <h2 className="mlm-section-title">AVAILABLE SERVICES</h2>
                    )}
                    {available
                      .filter((p) => p.serviceType === "combo")
                      .map((p) => (
                        <PlanCard key={p.planId} plan={p} onChoose={choose} />
                      ))}
                    {available.some((p) => p.serviceType !== "combo") && (
                      <h2 className="mlm-section-heading">
                        {groups.size
                          ? "Add another service"
                          : "Choose your service"}
                      </h2>
                    )}
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
