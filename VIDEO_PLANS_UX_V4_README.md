# MLMLive – Plans & Video Service UX V4

Apply this incremental Web App patch on top of `MLMLIVE_PLANS_BANNER_UI_V3_PATCH.zip` and `MLMLIVE_WEBAPP_MODERN_VIDEO_UI_PATCH.zip` (and the existing video service backend). Back up your project first. Extract the ZIP at the Web App root, preserving paths. No Admin, Firebase rules, indexes, Functions, R2 or Razorpay changes are included. Existing golden crown/shimmer and plan banners are untouched.

## Changes
- Plans landing screen: removed its hero (title, artwork and duplicate branding); begins with My Active Plans, or a compact no-active-plans message. Pending payment / errors / test-mode notices remain visible when applicable. My Plan/history headers and available-plan purchase flow are preserved.
- Video detail: larger portrait-friendly in-app player and a full-screen overlay; thumbnails and local raw previews use contain sizing. Drive remains the video provider; playback still depends on the shared link, browser and network. Switching to/from expanded player may restart playback.
- Upload: single-file picker; Add another clip appears below list; maximum 5 clips, 200 MB each. Select clips individually, enter details, then Upload and submit: actual multipart uploads run strictly in sequence, including finalization before starting the next clip. The existing draft manifest is fixed at submission, so files cannot be appended during a running upload; this avoids changing backend protocol. Resume uses existing original-file selection, saved draft and retry support. Green progress bars use real bytes or an indeterminate animation when no progress event has arrived. No percentage or redundant overall percentage is displayed. Completed clips are marked Uploaded only after finalization. Existing upload concurrency environment setting is no longer used.
- Review: Approve Final and Need Change. Approval still requires confirmation (one credit consumed); Need Change opens a compact instruction field. A decision automatically acknowledges the current reviewed version before applying the server action if needed. Existing free correction limits and server-side access checks are unchanged.

## Deployment
From the Web App root: `npm ci` (if dependencies are not installed), `npm run dev`, then `npm run build`. Redeploy only the Web App to Vercel after local smoke testing. No backend redeploy required for this patch.

## Verification
- 23 Node tests passed (17 existing payment/progress tests, 6 new mocked/source regression tests).
- TypeScript transpilation syntax diagnostics: 4 changed JS/JSX files passed. PostCSS parsing: 2 CSS files passed.
- New tests: `node --test tests/videoPlansUxV4.test.mjs`.
- Full Vite production build, browser/WebView playback and live Firebase/R2 upload and approval were not run in this environment. Test with a portrait clip, two clips, five clips and a sixth selection attempt, network interruption/resume, and review/approval with a test customer before deploying. The upload percentage was hidden as requested; live progress event delivery has not been independently verified.
