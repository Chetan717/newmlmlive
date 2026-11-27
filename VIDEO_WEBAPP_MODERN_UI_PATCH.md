# MLMLive – modern customer Video Editing UI

Base: MLMLIVE_WEBAPP_UPDATED.zip (previous video-service update). This patch is frontend-only, not a full project.

## Apply
1. Back up the current Web App project. Extract this ZIP at its root, preserving the `src/pages/Video` paths. Replace the three files listed below.
2. Run `npm ci` if dependencies are not installed; then `npm run dev` and open `/video-editing` while authenticated. Verify the existing eligible plan, credit balance and request data.
3. Run `npm run build`; redeploy the Web App to Vercel. No Admin, Cloud Functions, Firestore rules/indexes, or R2 configuration changes are required for this patch.

Files changed:
- src/pages/Video/VideoService.jsx — blue branded dashboard, credits, request cards, lazy previews, progress timeline and delivery screen, support.
- src/pages/Video/NewRequest.jsx — three-step upload/details/submit UI, compact clip list, local preview, editing preference helpers, existing upload/resume controls.
- src/pages/Video/Video.css — scoped responsive design, 320px mobile treatment, desktop layout, focus states.

## Approved mockup adaptations
The approved image is visual guidance. Existing data and policies win over mock/example values: category is the display title (no independent title field in the backend); file size limit is 200 MB each, 1–5 clips; plan purchase uses existing /subscription; revision is requested only during review, not after final approval; video file names, sizes and durations for the delivered file are not invented. Original thumbnails are labeled as such and final video playback/download uses the existing Drive link. Additional options append preferences to the existing instructions, not new paid services. Existing global tab bar, badge, access rules, credit and correction rules remain unchanged. No fake requests, credits or timelines.

## Verification
- JSX syntax/transpilation: 2/2 passed via TypeScript transpileModule.
- CSS parse: passed via PostCSS.
- Existing payment and video upload progress tests: 17/17 passed.
- Plan experience suite cannot load because jspdf is not installed in this environment.
- Full Vite build cannot run here because Vite/node_modules are absent; browser, WebView, live Firebase/R2 and Drive playback have not been tested.

## Manual staging checklist
- Eligible/ineligible plan, zero credits; Plans button; refresh; request status filtering and 10-item pagination; return from details.
- 320/360/390/768px widths, no horizontal overflow, existing bottom navigation.
- Select 1–5 valid MP4/MOV/WebM videos, reject files over 200 MB, preview, reorder and remove; navigate all steps; pause and resume; remote draft discard; actual upload progress; submit once.
- Under Review: preview actual Drive file, mark reviewed, request correction or approve; verify credit is consumed only on approval; final file opens in Drive; correction limit respected. Verify cancelled/archived statuses and raw cleanup display.
- WhatsApp support opens configured number; missing support configuration is clearly indicated.
