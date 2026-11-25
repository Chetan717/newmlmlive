import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "@firebase-config";
import { createPaymentClient } from "./paymentClientCore.mjs";

const functions = getFunctions(app, "asia-south1");
const callables = new Map();
export const payments = createPaymentClient({
  getUid: () => auth.currentUser?.uid,
  storage: {
    keys: () => Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)),
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  },
  call: async (name, data) => {
    if (!auth.currentUser) throw new Error("Please sign in again to manage your plan.");
    if (!callables.has(name)) callables.set(name, httpsCallable(functions, name, { timeout: 65000 }));
    return (await callables.get(name)(data)).data;
  },
});

export function paymentMessage(error) {
  const code = String(error?.code || "").replace("functions/", "");
  if (["unavailable", "deadline-exceeded", "internal"].includes(code))
    return "Confirmation is pending. If money was debited, check this payment before paying again.";
  if (code === "unauthenticated") return "Your session has expired. Please sign in again.";
  if (code === "resource-exhausted") {
    if (/Contact support|support-assisted|pending payment history/i.test(error?.message || "")) return error.message;
    return "Too many attempts. Please wait before checking again.";
  }
  return error?.message?.replace(/^Firebase:\s*/i, "") || "Unable to confirm payment. Please check your connection and try Check payment.";
}
