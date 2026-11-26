import { useCallback } from "react";
import { Check, Crown, Image, Video } from "lucide-react";
import PaymentSheet from "./PaymentSheet";
import { money, planBenefits } from "./planState.mjs";
export function PlanModal({ plan, openA, setOpenA, onProceedToCheckout }) {
  const close = useCallback(() => setOpenA(false), [setOpenA]);
  if (!plan) return null;
  const Icon =
    plan.serviceType === "combo"
      ? Crown
      : plan.serviceType === "video"
        ? Video
        : Image;
  return (
    <PaymentSheet
      open={openA}
      title="Plan details"
      onClose={close}
      footer={
        <button className="mlm-primary" onClick={onProceedToCheckout}>
          Continue to checkout
        </button>
      }
    >
      {plan.image_url && <img className="mlm-detail-image" src={plan.image_url} alt={plan.PlanName} />}
      <div className="mlm-detail-summary">
        <span className="mlm-service-icon">
          <Icon size={24} />
        </span>
        <div>
          <h3>{plan.PlanName}</h3>
          <p>{plan.Day_value} days validity</p>
        </div>
        <strong>
          {money(plan.amountPaise ?? Math.round(Number(plan.PlanAmount) * 100))}
        </strong>
      </div>
      <div className="mlm-benefits">
        <h4>WHAT YOU GET</h4>
        {planBenefits(plan).map((line, i) => (
          <p key={i}>
            <Check size={18} />
            <span>{line}</span>
          </p>
        ))}
      </div>
      <p className="mlm-muted mlm-small">
        GST and any valid coupon are calculated in the next step. No automatic
        renewal.
      </p>
    </PaymentSheet>
  );
}
