# MLMLive — Premium Badge V2 (incremental patch)

Apply after MLMLIVE_PREMIUM_TEMPLATE_BADGE_PATCH.zip. Extract to the Web App project root and replace the two source files and regression test at their original paths.

- Removes the selected poster's top Premium badge from GeneralEditPage. SalesExecutiveForm uses this same component in previewOnly mode, so the form preview no longer displays the badge either.
- Keeps the Premium badge on catalog cards and editor ListOfTemplates unchanged. Existing separate promotional popup behavior is unchanged.
- Removes the unused editor-only badge CSS. No changes to template access checks, download rules, Plans crown, backend, or Firebase.

Validation: all five badge regression tests passed against the previous patched source; editor JSX transpilation and badge CSS parsing passed. No production build or live browser/WebView testing performed.

Run `node --test tests/premiumTemplateBadge.test.mjs`, then `npm run dev`, verify editor and form preview with a premium template and check the template list; run `npm run build` and redeploy Web App. No backend deployment needed.
