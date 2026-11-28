# MLMLive — Premium Template Badge (Web App patch)

Apply on top of your current Web App source (including existing Plans and Video patches). The ZIP contains only changed/new files; preserve their paths. No Admin, Firebase, R2, plan or navigation files are included.

## Behavior
- Reference-matched gold crown + PREMIUM badge on catalog templates explicitly marked `templateAccess: "premium"`.
- Home rails, everyday moments, trending carousel, festival cards, View All (including subtype previews), legacy search dropdown, and template popups when the feed contains the tier.
- Editor's template grid and live selected design show the same tier. Free and legacy records without a tier show no badge. Existing NEW/selection indicators move to the lower corner for premium items, avoiding overlaps.
- Editor indicator is a DOM overlay outside the Konva Stage, not part of the generated poster/video. No pointer interception or extra network reads.
- Existing plan entitlement, export restrictions and launch environment flag are unchanged. Badge reflects catalog classification regardless of whether the current customer has a subscription. Existing metadata/cache freshness applies; missing tier metadata cannot be identified as premium by this UI patch.

## Apply / deploy
1. Back up your Web App source. Extract the ZIP into its root, keeping `src` and `tests` paths.
2. `npm ci` if dependencies aren't installed; `npm run dev` to check free/premium templates and switch between them in the editor.
3. `node --test tests/premiumTemplateBadge.test.mjs tests/posterAccess.test.mjs`
4. `npm run build` and redeploy the Web App to Vercel. No Firebase deployments required.

## Validation
- 5 new badge regression tests passed; 24 existing related tests passed (29 passing total).
- 3 pre-existing test failures reproduced unchanged against the original updated Web App ZIP: editor frame loader source expectation, festivalEditorCostOptimization test file, and home Capping card dimensions source expectation.
- 9 JSX files transpiled with TypeScript without syntax errors; CSS parsed with PostCSS.
- Full Vite production build and live browser/mobile WebView testing were not performed because project dependencies were not installed in the execution environment. Verify visually before deploying.
