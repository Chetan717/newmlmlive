import { newPaymentRequestId } from "./paymentClientCore.mjs";
let sdkPromise;
function loadWebSdk() {
  if (window.Razorpay) return Promise.resolve();
  sdkPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => { script.remove(); sdkPromise = null; reject(new Error("Payment gateway did not load. Check your connection.")); }, 20000);
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); sdkPromise = null; reject(new Error("Payment gateway did not load. Check your connection.")); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
export async function ensurePaymentCheckout() {
  if (window.ReactNativeWebView) {
    if (!window.MLMLIVE_NATIVE_PAYMENT) throw new Error("Update MLM LIVE to the latest app version to make a secure payment.");
    return;
  }
  await loadWebSdk();
}
export async function openPaymentCheckout(checkout, user = {}) {
  await ensurePaymentCheckout();
  const options = {
    key: checkout.keyId, order_id: checkout.orderId,
    amount: checkout.price.totalPaise, currency: "INR",
    name: "MLM LIVE", description: checkout.plan.PlanName,
    prefill: { name: user.name || "", contact: String(user.mobileNo || ""), email: user.email || "" },
    theme: { color: "#2F80EA" },
  };
  if (window.ReactNativeWebView) {
    const requestId = newPaymentRequestId();
    return new Promise((resolve) => {
      const timeout = setTimeout(() => finish({ status: "pending" }), 20 * 60000);
      const finish = (value) => { clearTimeout(timeout); window.removeEventListener("mlmlive-payment-result", listener); resolve(value); };
      const listener = (event) => {
        const data = event.detail;
        if (data?.requestId === requestId) finish(data);
      };
      window.addEventListener("mlmlive-payment-result", listener);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "PAYMENT_OPEN", requestId, options }));
    });
  }
  return new Promise((resolve, reject) => {
    let finished = false;
    let failureMessage = "";
    const finish = (value) => { if (!finished) { finished = true; resolve(value); } };
    const gateway = new window.Razorpay({
      ...options, retry: { enabled: false },
      handler: (response) => finish({ status: "verify", response }),
      modal: { ondismiss: () => finish({ status: "pending", message: failureMessage }) },
    });
    // A failed-attempt event can arrive while Checkout is still visible. Do
    // not restore our app dialog on top of a gateway that is still interactive.
    gateway.on("payment.failed", () => { failureMessage = "Payment was not completed. Check the status if money was debited."; });
    try { gateway.open(); } catch (error) { reject(error); }
  });
}
