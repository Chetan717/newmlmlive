# MLM LIVE — Clean Plans UI v2 + four-tab navigation

This cumulative patch replaces the previous MLMLIVE_MODERN_PLANS_UI_PATCH. Extract it into the existing Web App project root and overwrite the included paths. It includes the original modern checkout and crown artwork files, so it works whether or not the earlier Plans patch was already applied. It does not overwrite the Video Editing UI patch.

## Changes in v2
- All catalog cards: artwork and plan name side by side, plain description, separate compact benefits and price/action rows; cream Combo card, clean white single-service cards.
- My Plan: no visible Plan ID; clearly separated validity and credits/downloads; separate service sections for combo grants. Scheduled and active status retained.
- Download invoice and Open video editing use compact content-width buttons, wrapping on small screens. Invoice on the successful payment screen is compact too.
- Removed the Available additional services and redundant Choose another service headings for existing subscribers. The existing eligible-plan filter still controls what is shown.
- Plan details: artwork and name share a horizontal heading. Secure checkout from the previous patch retained.
- Bottom bar: Home, Plans (gold crown shimmer), Video Service (NEW), My Profile. Ask AI navigation item removed; underlying route and feature code are retained. Other navigation entries and badges remain unchanged.

## Deploy
Back up your project. Copy the included src paths to the Web App root. Use npm ci if dependencies are missing, npm run dev to preview, then npm run build and redeploy Web App on Vercel. No Admin, Firebase Functions, Firestore rules/indexes, R2, env, or payment service changes required. Actual catalog and entitlement data drive all prices, credits and validity. No new dependencies.

## Verification
21 existing payment, video progress and poster access tests passed; original eligibility test passed separately (22 total). Six JSX files transpiled with TypeScript, two CSS files parsed with PostCSS, and ten UI source assertions passed. The full production build could not run because Vite is not installed here; full invoice tests and browser/live checkout testing were not run. The design is adapted to real plan data and uses local vector artwork instead of raster mockup images.

Before publishing, check mobile widths 320/360/390px, long plan names, poster-only/video-only/combo/scheduled accounts, invoice download, Open video editing, four-tab navigation, and Razorpay test checkout.
