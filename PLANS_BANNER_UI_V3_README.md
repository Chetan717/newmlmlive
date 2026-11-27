# MLMLive — Plans Banner UI V3

Cumulative Web App patch based on MLMLIVE_CLEAN_PLANS_UI_V2_PATCH.zip. Extract into the Web App root, preserving paths. Back up your local project first. No Admin, Firebase Functions, Firestore Rules, R2 configuration or payment logic changes are required.

## Banner setup
1. In the existing Admin panel, open App Plans (`/plans`). Select the desired plan.
2. In Plan image, upload your rectangular artwork. Recommended dimensions: 1200 × 540 pixels (20:9). Existing upload converts to WebP and stores the HTTPS R2 URL as `image_url`.
3. Wait for upload completion; click Save App Plans. Ensure the plan is published and eligible for purchase.
4. Refresh the Web App Plans page (use Refresh my purchases if needed). Uploaded images appear for Combo, Poster and Video plans, also in plan details and checkout. The display keeps the whole image, so differing aspect ratios may have letterboxing. Missing or broken images use a local service-themed vector fallback.
5. My Plan uses the purchased plan snapshot from the existing history response; older purchases without an image or outside the loaded history page display a fallback. Updating the catalog does not rewrite historical purchases.

## Changes
- Taller rectangular banner, full card width, ratio 20:9, responsive and lazy-loaded (first featured banner eager). No stretching/cropping, no new data reads.
- Separate title, description, benefits and price/validity/Buy Now row. Combo highlighted in gold; card prices, validity and credits remain actual backend values.
- My Plan has vertically aligned facts, compact Invoice action; no visible Plan ID or Open Video Editing CTA. Purchase history and existing coupon/checkout flow retained.
- Plan Details and Secure Checkout share the banner UI. Checkout totals and payment logic remain unchanged.
- TabBar.jsx and PlansCrown.css are byte-for-byte identical to V2. Ask AI remains absent from bottom navigation; crown shimmer unchanged.
- Existing app shell does not show a separate menu or notifications on Plans, so no non-functional controls were added from the mockup. Fallback artwork is lightweight vector UI, not the example artwork.

## Deploy
Run `npm ci` if dependencies are not installed, then `npm run dev` and inspect the Plans screen on mobile. Run `npm run build`, then redeploy the Web App to Vercel. Apply only this cumulative Plans patch; the earlier Video UI patch is unaffected.

## Verification
21 existing Web App tests passed (payments, poster access, video progress); 14 existing payment domain tests passed. Seven JSX files transpiled using TypeScript and both CSS files parsed with PostCSS; ten source assertions passed; both navigation files identical to V2. No Vite installation available here; build blocked (`vite: not found`). Invoice PDF, payment HTTP (missing runtime dependencies), live Firebase/R2, checkout and browser layout not verified. Test mobile at 320/375/390/430px, image upload/save, missing/broken image, active and scheduled plans, invoice, coupon quote, actual Razorpay sandbox checkout, and tab bar before production deployment.
