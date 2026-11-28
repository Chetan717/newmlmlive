# MLMLive — My Video Requests: 5-at-a-time scroll pagination

Base: Video & Plans UX V4 patch for Web App; latest Admin Video Team UI ZIP for Firebase functions. Apply V4 first if not already installed. This is an incremental patch, not a full project.

## Copy files

- Web App: copy `src/pages/Video/VideoService.jsx` and `src/pages/Video/Video.css` to the same paths in Web App.
- Admin/backend: copy `admin/functions/video/functions.js` to `functions/video/functions.js` in the Admin project (do not create an extra admin folder in the project).
- `tests/videoRequestPagination.test.mjs` is a standalone regression test for the extracted patch directory; no production copy required.

## Deploy

1. Back up the current files; confirm the Firebase CLI targets the correct project (`firebase use`). From the Admin project root install the locked functions dependencies if necessary (`cd functions`, `npm ci`, `cd ..`). Deploy the existing callable function: `firebase deploy --only functions:videoEditing`.
2. From the Web App root run `npm ci` if needed, `npm run dev`, and `npm run build`. Redeploy the Web App to Vercel after checking locally. Deploy backend first: the prior function hard-coded ten records and ignored the requested size.
3. No rules, indexes, R2 configuration or Admin frontend deployment needed. The same Firestore query, filter and document-ID cursor are used, but customer pages are limited to five. Editor/manager/admin pages retain ten.

## Behavior

- Initial list call reads at most five customer feed documents; newest first using existing feed key order. On scrolling to within 64px of the bottom of the request list, the next page is requested. The actual scroll container is used, not the outer page. No eager recursive fetching on effect setup.
- A compact Load more button remains as accessibility/fallback for viewports where scrolling is not possible. One call at a time; ID deduplication; retry preserves previously loaded rows. Status change resets to the first page. If the total is an exact multiple of five, the final scroll can issue one empty query to discover the end, then stops. No count query or additional lookahead document.
- Previously loaded request cards remain on screen; detail views, thumbnails and actual video playback retain V4 behavior. No automatic download of video files.

## Checks

Run `node --test tests/videoRequestPagination.test.mjs` in the extracted patch root. Five regression tests use mocked query/scroll APIs and the extracted implementation; all passed. Six existing V4 tests also passed in a combined source workspace. Backend syntax and JSX parser checks passed. Production build, real browser/WebView and live Firebase were not tested here. On staging, test accounts with 0, 4, 5, 12+ requests, filters, failed network and repeated scrolling. Verify list callable responses contain at most five customer rows and team/admin still return up to ten.
