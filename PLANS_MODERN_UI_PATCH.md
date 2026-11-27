# MLM LIVE — Modern Plans UI + golden crown shimmer

## Apply
1. Back up the current **Web App** project. The baseline used is `MLMLIVE_WEBAPP_UPDATED.zip`.
2. Extract this patch into the web app project root, maintaining the `src/` paths. Overwrite only the included files. The earlier modern video service patch is not touched.
3. Run `npm ci` if dependencies are not already installed, then `npm run dev` to preview the Plans tab. Run `npm run build` and redeploy the Web App on Vercel after testing.

## Files
- `src/pages/Subscription/MainSubscription.jsx` — blue hero, combo card, separate poster/video cards, actual allowance and price, active plans, existing history and invoice controls.
- `src/pages/Subscription/PlanModal.jsx` — redesigned plan details.
- `src/pages/Subscription/CheckoutModal.jsx` — secure checkout with current server quote, coupon, GST and Razorpay, no new payment logic.
- `src/pages/Subscription/PaymentSheet.jsx` — opt-in full-screen mobile variant; existing generic sheet remains available. Keyboard handling, pending-payment controls and focus restoration remain unchanged.
- `src/pages/Subscription/PlanArtwork.jsx` — lightweight decorative vector artwork using the existing lucide-react package.
- `src/pages/Subscription/plans.css` — scoped responsive styles matching #2f80ea, cream combo, lavender poster, light blue video, rounded cards and buttons.
- `src/components/TabBar.jsx`, `src/components/PlansCrown.css` — gold crown above Plans label with shimmer, selected blue tab, reduced-motion support; other tabs retain their routes and badges.

## No backend deployment required for this patch
Existing payment service, eligiblePlans, grants, GST calculations, payment verification and recovery, invoice implementation, plan activation, Firestore, R2, and video editing functionality are not modified. Prices, validity, benefits and credits come from the existing server data; mockup prices are not hardcoded. Checkout continues through the current Razorpay gateway. No new environment variables or dependencies. The design uses local CSS/vector artwork instead of the mockup's raster illustrations; no extra data reads or remote artwork requests were added. The original subscription screen hides the global app header, so the redesigned hero includes branding without adding non-functional navigation or notification buttons. The crown is the actual Plans icon, not an additional badge.

## Verification
- 21 existing tests passed (`payments`, `videoServiceProgress`, `posterAccess`).
- The eligibility test from `planExperience` passed in isolation without its invoice dependency.
- All six JSX files transpiled successfully with TypeScript, and both CSS files parsed with PostCSS.
- The full `planExperience` suite could not start because `jspdf` is not installed in this environment. The production Vite build and real mobile/browser checkout were not run because project dependencies are unavailable. No live Firebase data or payment was used.

## Before production
Check on a small phone and desktop: no-plan account, poster-only, video-only, combo, expired/exhausted and scheduled grants; plan details and checkout navigation; coupon add/remove; pending-order recovery; Razorpay test payment; receipt download; existing video feature; tab shimmer with reduced-motion accessibility enabled. Verify against your latest local project if changes were made after the supplied ZIP.
