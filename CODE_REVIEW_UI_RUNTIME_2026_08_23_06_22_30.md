# Code Review: UI Runtime

## Reviewed scope and basis

- Scope: UI/runtime production code in `src/App.tsx`, `src/main.tsx`, `src/settings.ts`, `src/config.ts`, and
  `src/components/**`, plus directly related CSS, public assets, runtime contracts, entry HTML, dependency manifests,
  and configuration needed to judge that code.
- Basis: independent review of the current worktree. Generated deployment output, vendored or third-party source, and
  individual test-case logic, fixtures, and assertions are out of scope.
- Review segments: application lifecycle and settings; header, modal, and editing UI; comparison rendering; styling,
  responsive behavior, assets, and directly related runtime/configuration contracts.

## Findings

### 1. Eager worker initialization can unmount the entire UI when construction is unavailable

- Severity: Medium
- References: `src/App.tsx:35-37`, `src/diff/workerClient.ts:19`, `src/diff/workerClient.ts:26-29`
- Problem: `App` eagerly calls `initializeDiffWorker()` from a passive effect without handling a synchronous failure.
  `DiffWorkerClient` constructs the worker in its constructor, and browser worker construction is allowed to throw (for
  example, a `SecurityError` when workers are blocked by browser or deployment policy). Because there is no error
  boundary or local `try`/`catch`, the exception escapes the effect. The guarded call in `handleToggleMode`
  (`src/App.tsx:104-117`) cannot help because the app has already failed during mount.
- Impact: In an environment that rejects worker construction, React unmounts the application and the user receives a
  blank page. Editing, About/settings access, and the existing actionable "Diff Processing Error" modal are all lost,
  even though worker construction could be retried when the user actually requests a comparison.
- Recommendation: Treat eager initialization as a fallible preload. Catch and contain construction failures (or defer
  initialization until comparison); leave the shared client unset so the existing guarded comparison path can retry and
  surface the failure without destroying the rest of the UI. An application-level error boundary/fallback would provide
  additional protection for other mount-time failures.

### 2. Large changed results are rendered synchronously without a bounded fallback

- Severity: Medium
- References: `src/App.tsx:122-130`, `src/App.tsx:180`, `src/components/CompareDisplay.tsx:49-75`,
  `src/components/CompareDisplay.tsx:193-208`, `src/components/CompareDisplay.tsx:243-268`,
  `src/components/CompareDisplay.tsx:317-327`
- Problem: Moving diff computation into a worker protects the main thread only until the result arrives. Every changed
  row is then materialized synchronously, every character-diff run becomes an element, and every inserted/deleted run
  also receives its own hidden description element. The collapsing logic applies only to unchanged regions; there is no
  row virtualization, incremental rendering, size threshold, or simpler large-result representation. `App` processes the
  completed promise by clearing processing state and immediately installing the entire result in the same update.
- Impact: A realistic, moderately sized but heavily changed input can freeze the main thread for seconds after worker
  computation succeeds, during which the processing dialog cannot repaint or accept Terminate. In a focused Chromium
  production-preview measurement using a prebuilt worker response (therefore excluding diff computation), 5,000 changed
  16-character lines took about 0.35 seconds to commit (10,000 cells and 30,000 character spans), 10,000 took about 0.64
  seconds, 20,000 took about 1.23 seconds (40,000 cells and 120,000 character spans), and 50,000 took about 3.32 seconds
  (100,000 cells, 300,000 character spans, and approximately 386 MB reported JS heap). Larger results risk a much longer
  stall or tab memory exhaustion even though the source text itself may be under one megabyte per side.
- Recommendation: Virtualize or incrementally render changed rows and keep cancellation/progress available while UI work
  is pending. Add a bounded large-result fallback (for example, a summary with opt-in chunk expansion) when the element
  estimate exceeds a safe threshold. Use one shared hidden description for deleted text and one for inserted text
  instead of creating a duplicate hidden node for every character-diff run.

### 3. The header's configured logo color cannot reach the external SVG image

- Severity: Low
- References: `src/components/Header.tsx:48-50`, `src/components/Header.css:18-25`, `public/logo.svg:1`
- Problem: The header explicitly assigns `color: var(--primary)` to the logo container, and the SVG defines its stroke
  as `currentColor`, but the SVG is loaded as an external `<img>`. The SVG image document does not inherit the embedding
  HTML element's `color`, so its `currentColor` resolves to the SVG document's default instead of the configured primary
  color.
- Impact: The header logo renders black rather than the intended primary blue, making the branding implementation
  disagree with its CSS configuration. A production-browser canvas check found the image element's computed color was
  `rgb(66, 95, 240)` while its opaque SVG stroke pixels were black.
- Recommendation: Inline the SVG where it needs to inherit `currentColor`, use a CSS mask driven by `background-color`,
  or provide a header-specific SVG whose stroke is explicitly set to the intended color.

## Unresolved questions

- None.

## Checks and areas not covered

- Inspected the current production entry path, worker-client boundary used by `App`, persisted-settings validation,
  header controls, settings/about/processing modal flows, and text-editing component.
- Reproduced finding 1 in Chromium by making the browser's `Worker` constructor throw `SecurityError` before application
  startup; after the passive effect failed, `#app` contained no rendered child and the page was blank.
- Isolated finding 2 against the current production preview with a synthetic worker success response at 5,000, 10,000,
  20,000, and 50,000 fully changed rows; the recorded timings measure response-to-DOM-commit and exclude diff
  calculation and real worker-to-main structured cloning.
- Verified finding 3 in the production preview by rasterizing the loaded header image to an in-memory canvas and
  comparing its opaque pixels with the embedding image element's computed `color`.
- Completed static inspection of the comparison renderer, CSS and responsive rules, asset URLs and licenses, entry HTML,
  CSP/base-path configuration used by this UI, and the directly related diff-result/worker-client contracts.
- `npx tsc -p tsconfig.app.json --noEmit --pretty false --incremental --tsBuildInfoFile /tmp/text-diff-ui-review.tsbuildinfo`
  completed successfully.
- `npm test -- src/App.test.tsx src/main.test.tsx src/settings.test.ts src/components` passed all 56 focused unit checks
  across 10 files.
- Chromium browser checks passed: all 7 checks in `playwright/accessibility.spec.ts`, both checks in
  `playwright/comparison.spec.ts`, both checks in `playwright/processing.spec.ts`, and all 3 checks in
  `playwright/security.spec.ts`. Normal edit/compare/settings/about flows also produced no console errors or failed
  asset requests.
- No individual unit or browser test cases, fixtures, or assertions were reviewed.
- Generated deployment output and third-party source were not reviewed. The focused browser runs used Chromium; a full
  Firefox/WebKit suite and physical-mobile dynamic-viewport/virtual-keyboard behavior were not covered.
