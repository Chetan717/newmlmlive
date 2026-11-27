import { useCallback } from "react";
import { Check, CalendarDays, ChevronRight, ShieldCheck } from "lucide-react";
import PlanBanner from "./PlanBanner";
import PaymentSheet from "./PaymentSheet";
import { money, planBenefits } from "./planState.mjs";
export function PlanModal({ plan, openA, setOpenA, onProceedToCheckout }) {
  const close = useCallback(() => setOpenA(false), [setOpenA]);
  if (!plan) return null;
  return (
    <PaymentSheet
      open={openA}
      title="Plan details"
      variant="screen"
      onClose={close}
      footer={
        <button className="mlm-primary" onClick={onProceedToCheckout}>
          Continue to checkout <ChevronRight size={19}/>
        </button>
      }
    >
      <div className={`mlm-detail-hero mlm-detail-${plan.serviceType || "poster"}`}>
        <PlanBanner plan={plan} priority/><h3>{plan.PlanName}</h3>
        <div className="mlm-detail-hero-metrics"><span><CalendarDays size={18}/> {plan.Day_value} days validity</span><strong>{money(plan.amountPaise ?? Math.round(Number(plan.PlanAmount) * 100))}</strong></div>
      </div>
      <div className="mlm-benefits">
        <h4>What’s included?</h4>
        {planBenefits(plan).map((line, i) => (
          <p key={i}>
            <Check size={18} />
            <span>{line}</span>
          </p>
        ))}
      </div>
      {(plan.serviceType === "video" || plan.serviceType === "combo") && <p className="mlm-additional-note"><ShieldCheck size={20}/> 1 video credit = 1 edited video. Up to 3 corrections before final approval.</p>}
      <p className="mlm-muted mlm-small">
        GST and any valid coupon are calculated in the next step. No automatic
        renewal.
      </p>
    </PaymentSheet>
  );
}
