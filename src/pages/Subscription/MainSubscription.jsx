import React, { useEffect, useState, useCallback, useRef } from "react";
import { Skeleton } from "@heroui/react";
import subcric from "./plan.webp";
import { CheckoutModal } from "./CheckoutModal";
import { PlanModal } from "./PlanModal";
import { useAuth } from "../../Auth/AuthContext";
import { payments, paymentMessage } from "../../services/paymentService";
import { isPaid, serviceLabel } from "../../services/paymentClientCore.mjs";
import {
  CreditCard,
  History,
  Clock,
  Download,
  IndianRupee,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (ts) => {
  if (!ts) return "N/A";
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysLeft = (expiryStr) => {
  const today = new Date();
  const expiry = new Date(expiryStr);
  const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return diff;
};

// ─── Active Subscription Card ─────────────────────────────────────────────────
function ActiveSubscriptionCard({ sub }) {
  const days = daysLeft(sub.expirydate);
  const totalDays = sub.duration ?? 1;
  const usedDays = totalDays - days;
  const progress = Math.min(100, Math.max(0, (usedDays / totalDays) * 100));

  return (
    <div
      className="relative rounded-[28px] overflow-hidden shadow-2xl"
      style={{
        background:
          "linear-gradient(135deg,#2F80EA 0%,#236FDE 48%,#1454C5 100%)",
      }}
    >
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at 30% 0%, #6366f1 0%, transparent 70%), radial-gradient(ellipse at 80% 100%, #3b82f6 0%, transparent 60%)",
        }}
      />
      {/* Top highlight */}
      <div className="absolute top-0 left-6 right-6 h-px bg-white/20 rounded-full" />

      <div className="relative p-6">
        {/* Plan name + badge */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
              }}
            >
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[18px] font-display font-bold text-white leading-tight">
                {sub.plan || "Subscription"}
              </p>
              <p className="text-[11px] font-semibold text-white/60 mt-0.5 tracking-wider uppercase">
                {serviceLabel(sub.serviceType)}
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
            style={{
              background: "rgba(34,197,94,0.18)",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
              {sub.scheduled ? "Upcoming" : "Active"}
            </p>
          </div>
        </div>

        {/* Progress timeline */}
        <div
          className="mb-5 rounded-2xl p-4"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider mb-1">
                Started
              </p>
              <p className="text-[13px] font-bold text-white/90">
                {formatDate(sub.startdate)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider mb-1">
                Expires
              </p>
              <p className="text-[13px] font-bold text-red-300">
                {formatDate(sub.expirydate)}
              </p>
            </div>
          </div>
          <div
            className="relative w-full h-2 rounded-full overflow-hidden mb-2"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
              }}
            />
          </div>
          <p className="text-[11px] font-bold text-center text-blue-200">
            {sub.scheduled ? `Starts ${formatDate(sub.startdate)}` : days > 0 ? `${days} days remaining` : "Expiring today"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: sub.serviceType === "video" ? "Service" : "Downloads",
              value: sub.serviceType === "video" ? "Video" : sub.unlimitedDownloads ? "Unlimited" : sub.download ?? 0,
              icon: <Download className="w-3.5 h-3.5" />,
            },
            {
              label: "Duration",
              value: `${sub.duration ?? 0}d`,
              icon: <Clock className="w-3.5 h-3.5" />,
            },
            {
              label: "Paid",
              value: `₹${sub.PaymentAmount ?? 0}`,
              icon: <IndianRupee className="w-3.5 h-3.5" />,
            },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex justify-center text-blue-200 mb-1.5">
                {s.icon}
              </div>
              <p className="text-[14px] font-bold text-white leading-none">
                {s.value}
              </p>
              <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wide mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Expired Subscription Card ────────────────────────────────────────────────
function ExpiredSubscriptionCard({ sub }) {
  return (
    <div className="relative rounded-[24px] overflow-hidden border border-border/60 shadow-sm bg-muted/20">
      {/* Faded stripe */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/10" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[16px] font-display font-bold text-foreground/80">
                {sub.plan || "Subscription"}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 tracking-wider uppercase">
                {serviceLabel(sub.serviceType)}
              </p>
            </div>
          </div>
          <div className="bg-danger/8 border border-danger/15 rounded-full px-2.5 py-1 shrink-0">
            <p className="text-[10px] font-bold text-danger/80 uppercase tracking-wider">
              {sub.payment || "Expired"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/40 p-3 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-wider mb-1">
                Started
              </p>
              <p className="text-[13px] font-bold text-foreground/70">
                {formatDate(sub.startdate)}
              </p>
            </div>
            <div className="h-6 w-px bg-border mx-3" />
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-wider mb-1">
                Expired On
              </p>
              <p className="text-[13px] font-bold text-danger/70">
                {formatDate(sub.expirydate)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Downloads", value: sub.download ?? 0 },
            { label: "Duration", value: `${sub.duration ?? 0}d` },
            { label: "Paid", value: `₹${sub.PaymentAmount ?? 0}` },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-center"
            >
              <p className="text-[14px] font-bold text-foreground/60">
                {s.value}
              </p>
              <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wide mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────────
function SubSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <div className="rounded-[24px] overflow-hidden border border-border bg-white dark:bg-black/20 p-6">
        <div className="flex gap-4 mb-6">
          <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1 pt-1">
            <Skeleton className="h-6 w-1/3 rounded-lg" />
            <Skeleton className="h-4 w-1/4 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-2xl mb-6" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Tabs Component ───────────────────────────────────────────────────────────
function SubscriptionTabs({
  activeTab,
  setActiveTab,
  activeCount,
  expiredCount,
}) {
  const tabs = [
    { key: "active", label: "Active Plans", count: activeCount },
    { key: "expired", label: "History", count: expiredCount },
  ];

  return (
    <div className="flex gap-2 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-[13px] font-bold transition-all duration-300 border ${
            activeTab === tab.key
              ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
              : "bg-muted/30 text-muted-foreground hover:text-foreground border-border"
          }`}
        >
          {tab.key === "active" ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          )}
          {tab.label}
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              activeTab === tab.key
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MainSubscription() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openPlanModal, setOpenPlanModal] = useState(false);
  const [openCheckoutModal, setOpenCheckoutModal] = useState(false);

  // Subscription states
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState([]);
  const [subLoading, setSubLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  const accountId = user?.uid;
  const [suggestedCoupon, setSuggestedCoupon] = useState("");
  const [historyData, setHistoryData] = useState({ items: [], entitlement: null, cursor: null });
  const [legacyData, setLegacyData] = useState({ items: [], cursor: null });
  const [subError, setSubError] = useState("");
  const [pending, setPending] = useState(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("");
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;

  const fetchSubscriptions = useCallback(async (force = false, cursor = null) => {
    if (!accountId) { setSubLoading(false); return; }
    try {
      setSubError("");
      const result = await payments.history(cursor, force);
      if (currentAccount.current !== accountId) return;
      setHistoryData((old) => ({ ...result, items: cursor ? [...old.items, ...result.items] : result.items }));
      // Recover an unfinished checkout even after app storage was cleared.
      if (!payments.readPending()) {
        const unresolved = result.items.find((p) => ["created", "pending", "creating", "creation_unknown"].includes(p.status));
        if (unresolved) payments.remember(unresolved);
      }
      setPending(payments.readPending());
    } catch (err) { if (currentAccount.current === accountId) setSubError(paymentMessage(err)); }
    finally { if (currentAccount.current === accountId) setSubLoading(false); }
  }, [accountId]);

  const fetchPlans = useCallback(async (force = false) => {
    setLoading(true); setError(null);
    try {
      const result = await payments.catalog(force);
      if (currentAccount.current !== accountId) return;
      setPlans(result.plans); setSuggestedCoupon(result.suggestedCoupon || ""); setMode(result.mode);
      setPending(payments.readPending());
    } catch (err) { if (currentAccount.current === accountId) setError(paymentMessage(err)); }
    finally { if (currentAccount.current === accountId) setLoading(false); }
  }, [accountId]);

  useEffect(() => {
    setHistoryData({ items: [], entitlement: null, cursor: null });
    setLegacyData({ items: [], cursor: null });
    setPlans([]); setPending(null); setSubLoading(true);
    setSelectedPlan(null); setOpenCheckoutModal(false); setOpenPlanModal(false);
    if (!accountId) { setSubLoading(false); setLoading(false); setError("Sign in to view app plans."); return; }
    void fetchSubscriptions();
    void fetchPlans();
    payments.legacyHistory().then((value) => {
      if (currentAccount.current === accountId) setLegacyData(value);
    }).catch((err) => { if (currentAccount.current === accountId) setSubError(paymentMessage(err)); });
  }, [accountId, fetchSubscriptions, fetchPlans]);

  useEffect(() => {
    const time = Date.now();
    const rows = historyData.items.map((p) => ({
      id: p.purchaseId, plan: p.plan.PlanName, planType: p.plan.Type,
      serviceType: p.plan.serviceType || "poster", download: p.plan.downloads,
      duration: p.plan.Day_value, PaymentAmount: p.price.totalPaise / 100,
      startdate: p.startsAtMs, expirydate: p.subscriptionExpiresAtMs,
      payment: p.status === "paid" ? (p.subscriptionExpiresAtMs > time ? "Paid" : "Expired") : p.status.replaceAll("_", " "),
    }));
    const active = (historyData.entitlement?.grants || []).filter((g) => !g.revoked && g.expiresAtMs > time).map((g) => {
      const purchase = rows.find((r) => r.id === g.purchaseId);
      return { ...purchase, id: `${g.purchaseId}:${g.serviceType || "poster"}`, plan: g.planName || purchase?.plan || "Active Plan",
        serviceType: g.serviceType || "poster", download: g.remainingDownloads, unlimitedDownloads: g.unlimitedDownloads,
        duration: g.duration || (g.expiresAtMs - g.startsAtMs) / 86400000,
        PaymentAmount: (g.paidPaise || 0) / 100, startdate: g.startsAtMs, expirydate: g.expiresAtMs, scheduled: g.startsAtMs > time };
    });
    for (const row of legacyData.items) {
      if (row.Active && new Date(row.expirydate).getTime() > time) active.push(row);
    }
    setActiveSubscriptions(active);
    setExpiredSubscriptions([...rows, ...legacyData.items]);
  }, [historyData, legacyData]);

  const handlePaymentSuccess = useCallback(async (result) => {
    if (!isPaid(result)) return;
    setOpenCheckoutModal(false); setOpenPlanModal(false); setPending(null);
    setNotice(result.mode === "test" ? "Test payment verified. Live access has not changed." : "Payment verified. Your plan has been activated or scheduled as a renewal.");
    payments.invalidate();
    await fetchSubscriptions(true);
  }, [accountId, fetchSubscriptions]);

  const checkPending = useCallback(async () => {
    if (!accountId) return;
    setChecking(true);
    try {
      const result = await payments.check();
      if (currentAccount.current !== accountId) return;
      setPending(payments.readPending());
      if (isPaid(result)) await handlePaymentSuccess(result);
      else setNotice(result ? `Payment ${result.status.replaceAll("_", " ")}. If money was debited, check again before paying again.` : "No pending payment found.");
    } catch (err) { if (currentAccount.current === accountId) setNotice(paymentMessage(err)); }
    finally { setChecking(false); }
  }, [accountId, handlePaymentSuccess]);

  useEffect(() => {
    if (!accountId) return;
    const resume = () => {
      if (document.visibilityState !== "hidden" && payments.readPending() && !openCheckoutModal) void checkPending();
    };
    resume();
    window.addEventListener("mlmlive-payment-resume", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("mlmlive-payment-resume", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [accountId, checkPending, openCheckoutModal, pending?.purchaseId, pending?.requestId]);

  const handleSlideClick = (plan) => {
    setSelectedPlan(plan);
    setOpenPlanModal(true);
  };

  const hasAnySub =
    activeSubscriptions.length > 0 || expiredSubscriptions.length > 0;

  if (subLoading) {
    return (
      <div className="w-full min-h-full bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <SubSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Premium Hero Header */}
        <div
          className="relative mb-8 rounded-[28px] overflow-hidden p-6"
          style={{
            background:
              "linear-gradient(135deg, #2F80EA 0%, #2F80EA 60%, #2F80EA 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse at 80% 20%, #2F80EA 0%, transparent 60%)",
            }}
          />
          <div className="absolute top-0 left-8 right-8 h-px bg-white/15 rounded-full" />
          <div className="relative flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className="text-yellow-300"
              >
                <path
                  d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-0.5">
                Premium Access
              </p>
              <h1 className="text-[22px] font-display font-bold text-white leading-tight">
                My Subscriptions
              </h1>
            </div>
          </div>
        </div>

        {mode === "test" && <p className="mb-4 rounded-xl border border-amber-300 p-3 text-sm">Test mode — test purchases do not activate live access.</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-border p-3 text-sm">{notice}</p>}
        {subError && <div role="alert" className="mb-4 rounded-xl border border-red-300 p-3 text-sm">{subError} <button className="underline ml-2" onClick={() => fetchSubscriptions(true)}>Retry</button></div>}
        {pending && <div className="mb-6 rounded-2xl border border-amber-300 p-4 space-y-3">
          <p className="font-bold">Payment confirmation pending</p>
          <p className="text-sm text-muted-foreground">{pending.plan?.PlanName || pending.checkout?.plan?.PlanName}. If money was debited, check this payment before paying again.</p>
          {pending.checkout?.orderId && <p className="text-xs break-all">Order: {pending.checkout.orderId}</p>}
          <div className="flex gap-3">
            <button disabled={checking} onClick={checkPending} className="rounded-xl bg-accent text-white px-4 py-2 disabled:opacity-50">{checking ? "Checking…" : "Check payment"}</button>
            {(pending.plan || pending.checkout?.plan) && <button onClick={() => { setSelectedPlan(pending.plan || pending.checkout.plan); setOpenCheckoutModal(true); }} className="rounded-xl border border-border px-4 py-2">View checkout</button>}
          </div>
        </div>}
        {/* ── Subscription Tabs (only shown if user has any subs) ── */}
        {hasAnySub && (
          <div className="mb-10">
            <SubscriptionTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              activeCount={activeSubscriptions.length}
              expiredCount={expiredSubscriptions.length}
            />

            {/* Active Tab Content */}
            {activeTab === "active" && (
              <div className="space-y-6">
                {activeSubscriptions.length === 0 ? (
                  <div className="py-12 px-6 rounded-3xl bg-muted/30 border border-border text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-white dark:bg-black rounded-full flex items-center justify-center shadow-sm mb-4">
                      <CreditCard className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-display font-bold text-foreground mb-2">
                      No Active Plans
                    </h3>
                    <p className="text-muted-foreground text-center max-w-sm">
                      You don't have any active subscriptions. Choose a plan
                      below to unlock premium features.
                    </p>
                  </div>
                ) : (
                  activeSubscriptions.map((sub) => (
                    <ActiveSubscriptionCard key={sub.id} sub={sub} />
                  ))
                )}
              </div>
            )}

            {/* Expired Tab Content */}
            {activeTab === "expired" && (
              <div className="space-y-6">
                {expiredSubscriptions.length === 0 ? (
                  <div className="py-12 px-6 rounded-3xl bg-muted/30 border border-border text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-white dark:bg-black rounded-full flex items-center justify-center shadow-sm mb-4">
                      <History className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-display font-bold text-foreground mb-2">
                      No History
                    </h3>
                    <p className="text-muted-foreground text-center">
                      Your payment and subscription history will appear here.
                    </p>
                  </div>
                ) : (
                  expiredSubscriptions.map((sub) => (
                    <ExpiredSubscriptionCard key={sub.id} sub={sub} />
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {(historyData.cursor || legacyData.cursor) && <div className="flex flex-wrap gap-3 mb-6">
          {historyData.cursor && <button className="text-sm text-accent underline" onClick={() => fetchSubscriptions(false, historyData.cursor)}>Load more payments</button>}
          {legacyData.cursor && <button className="text-sm text-accent underline" onClick={async () => {
            try {
              const value = await payments.legacyHistory(legacyData.cursor);
              if (currentAccount.current === accountId) setLegacyData((old) => ({ ...value, items: [...old.items, ...value.items] }));
            } catch (err) { setSubError(paymentMessage(err)); }
          }}>Load earlier subscriptions</button>}
        </div>}
        {/* ── Available Plans and Renewals ── */}
        {(
          <div className="mt-12">
            {/* <div className="mb-7">
              <p className="text-[11px] font-bold text-accent/80 uppercase tracking-widest mb-1">
                Unlock More
              </p>
              <h2 className="text-[22px] font-display font-bold text-foreground">
                Upgrade Your Plan
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1">
                Choose a plan that fits your workflow
              </p>
            </div> */}

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-64 rounded-3xl" />
                <Skeleton className="h-64 rounded-3xl" />
              </div>
            ) : error ? (
              <div className="p-6 rounded-2xl bg-danger/10 border border-danger/20 text-center">
                <p className="text-danger font-medium">{error}</p>
                <button onClick={() => fetchPlans(true)} className="mt-3 text-sm underline">Retry loading plans</button>
              </div>
            ) : plans.length === 0 ? (
              <div className=" rounded-2xl w-full flex justify-center items-center h-full text-center">
                {/* <p className="text-muted-foreground">
                  No plans currently available.
                </p> */}
                {/* <div className="p-1 rounded-2xl text-center"> */}
                  <img src={subcric} className=" p-2 border border-border/60 rounded-xl  h-full object-contain" alt="Plans Coming Soon" />
                {/* </div> */}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {plans.map((plan, index) => (
                  <div
                    key={plan.planId || index}
                    onClick={() => handleSlideClick(plan)}
                    className="group cursor-pointer rounded-[24px] overflow-hidden border border-border/60 hover:border-accent/40 shadow-md hover:shadow-xl transition-all duration-300 relative bg-white dark:bg-[#0f1525]"
                  >
                    {/* Accent top bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: "linear-gradient(90deg, #2F80EA, #4f6fd0)",
                      }}
                    />

                    {plan.image_url ? (
                      <div className="aspect-[16/9] w-full overflow-hidden relative">
                        <img
                          src={plan.image_url}
                          alt={plan.PlanName}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <div className="flex items-end justify-between">
                            <div>
                              <h3 className="text-white font-display font-bold text-[18px] mb-0.5">
                                {plan.PlanName}
                              </h3>
                              <p className="text-white/70 text-[12px]">
                                Tap to view details
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-white/60 mb-0.5">
                                Price
                              </p>
                              <p className="text-[20px] font-bold text-white">
                                ₹{plan.PlanAmount ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border border-accent/20"
                            style={{
                              background:
                                "linear-gradient(135deg, rgba(14,36,92,0.12), rgba(79,111,208,0.08))",
                            }}
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="text-accent"
                            >
                              <path
                                d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
                                fill="currentColor"
                              />
                            </svg>
                          </div>
                          <div className="px-2.5 py-1 rounded-full text-[10px] font-bold text-accent bg-accent/8 border border-accent/15">
                            {serviceLabel(plan.serviceType)}
                          </div>
                        </div>
                        <h3 className="font-display font-bold text-[18px] text-foreground mb-3 group-hover:text-accent transition-colors">
                          {plan.PlanName || "Premium Plan"}
                        </h3>
                        <div className="flex items-end justify-between pt-3 border-t border-border/40">
                          <div>
                            <p className="text-[9px] text-muted-foreground/70 uppercase font-bold tracking-widest mb-0.5">
                              One-time payment
                            </p>
                            <p className="text-[26px] font-bold text-accent leading-none">
                              ₹{plan.PlanAmount ?? 0}
                            </p>
                          </div>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-accent text-white opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shadow-lg shadow-accent/25">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <PlanModal
        openA={openPlanModal}
        setOpenA={setOpenPlanModal}
        plan={selectedPlan}
        onProceedToCheckout={() => {
          setOpenPlanModal(false);
          setOpenCheckoutModal(true);
        }}
      />

      <CheckoutModal
        isOpen={openCheckoutModal}
        setIsOpen={setOpenCheckoutModal}
        plan={selectedPlan}
        onBack={() => {
          setOpenCheckoutModal(false);
          setOpenPlanModal(true);
        }}
        onPaymentSuccess={handlePaymentSuccess}
        suggestedCoupon={suggestedCoupon}
        onPendingChange={setPending}
      />
    </div>
  );
}
