# Testing strategy and catalog

## Coverage policy

Use Vitest for deterministic behavior that does not depend on a browser engine. This includes diff and JSON edge cases,
component markup and callbacks, application state transitions, and the worker protocol. These tests are faster, isolate
failures more precisely, and can cover input permutations without multiplying work across browsers.

Use Playwright only when the behavior depends on a complete browser integration or a browser implementation detail:

- one representative end-to-end workflow for each user-facing comparison mode;
- real Web Worker loading and lifecycle integration;
- CSP enforcement context, network-loaded fonts, and framed-document behavior;
- focus management, keyboard interaction, computed styles, scrolling, responsive layout, and the accessibility tree.

Do not add an input or algorithm permutation to Playwright when the same contract can be asserted directly in Vitest.
Add it to the relevant unit suite instead.

## Current Playwright catalog

All 14 tests run in Chromium, Firefox, and WebKit. Each row identifies the browser-specific confidence that justifies
the test.

| Spec                    | Test                                                                                       | Why it remains in Playwright                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `comparison.spec.ts`    | `compares text and returns to editing`                                                     | Representative text-mode path through controlled inputs, the worker, rendered results, and the Edit transition. |
| `comparison.spec.ts`    | `normalizes equivalent JSON through the complete UI workflow`                              | Representative JSON-mode path from the toggle through worker normalization to the result modal.                 |
| `processing.spec.ts`    | `loads one dedicated worker with the page and reuses it for consecutive comparisons`       | Verifies the real browser Worker URL, creation, and reuse.                                                      |
| `processing.spec.ts`    | `keeps the processing modal open until the user terminates the worker`                     | Verifies the integrated pending-worker UI, modal focus containment, cancellation, and replacement Worker.       |
| `security.spec.ts`      | `uses an environment-specific CSP in development and preview`                              | Reads the served CSP and verifies the development WebSocket exception versus the production policy.             |
| `security.spec.ts`      | `loads bundled fonts without a runtime font CDN`                                           | Observes browser requests, font loading, origins, and computed font families.                                   |
| `security.spec.ts`      | `stays hidden and inert in framed documents`                                               | Exercises both script-enabled cross-origin framing and a script-disabled sandbox in real frames.                |
| `accessibility.spec.ts` | `names the editor fields and exposes visible high-contrast focus`                          | Checks the browser accessibility names and computed focus/placeholder contrast.                                 |
| `accessibility.spec.ts` | `contains modal focus, supports Escape, restores the opener, and preserves list semantics` | Exercises native dialog focus, keyboard containment, Escape, and focus restoration.                             |
| `accessibility.spec.ts` | `gives settings accessible controls and restores automatically saved choices`              | Uses the accessibility tree and computed focus styles, then verifies LocalStorage restoration after a reload.   |
| `accessibility.spec.ts` | `exposes comparison structure, line changes, and keyboard disclosure controls`             | Verifies table semantics plus real Enter/Space disclosure behavior and focus retention.                         |
| `accessibility.spec.ts` | `makes long comparison results keyboard-scrollable`                                        | Requires browser layout, focus, and scrolling behavior.                                                         |
| `accessibility.spec.ts` | `reflows header controls without clipping across viewport and text sizes`                  | Covers narrow widths, the responsive breakpoint, and 200% text with real layout measurements.                   |
| `accessibility.spec.ts` | `passes automated checks in the primary UI states`                                         | Runs axe against edit, settings, About, comparison, expanded comparison, and error-dialog states.               |

## Vitest catalog

| Test file                                 | Primary contracts                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/diff/compute.test.ts`                | Text/JSON identity and errors; exact numeric, duplicate-key, object-key, and array-order preservation; line/grapheme alignment; Unicode graphemes; cleanup modes and edit cost; trailing newlines; empty sides; algorithm selection; inherited property names; large inputs. |
| `src/diff/worker.test.ts`                 | Worker-realm hardening, request filtering, diff responses, and stable error responses.                                                                                                                                                                                       |
| `src/diff/workerClient.test.ts`           | Request protocol, reuse, settlement, invalid responses, runtime/posting failures, termination, replacement, stale events, and overlap rejection.                                                                                                                             |
| `src/settings.test.ts`                    | Settings serialization, restoration, validation, defaults, and unavailable-storage handling.                                                                                                                                                                                 |
| `src/App.test.tsx`                        | State ownership and settings updates; child wiring; success, identity, parse-error, processing-error, cancellation, unmount, modal, and Edit transitions.                                                                                                                    |
| `src/main.test.tsx`                       | Top-level mounting/reveal/prototype hardening and framed-document non-mounting.                                                                                                                                                                                              |
| `src/components/CompareDisplay.test.tsx`  | Line and character markup, table semantics, context calculation, independent disclosure state, trailing-newline rows, and invalid diff rejection.                                                                                                                            |
| `src/components/SettingsModal.test.tsx`   | Defaults, available/selected options, callbacks, edit-cost enablement, and numeric validation.                                                                                                                                                                               |
| `src/components/Modal.test.tsx`           | Dialog markup, dismissible controls, custom content, and non-dismissible action behavior.                                                                                                                                                                                    |
| `src/components/Header.test.tsx`          | Editable/comparison controls, state callbacks, disabled states, and owned modal wiring.                                                                                                                                                                                      |
| `src/components/TextAreas.test.tsx`       | Labels, controlled values, and field-specific callbacks.                                                                                                                                                                                                                     |
| `src/components/AboutModal.test.tsx`      | Modal composition, exact content, semantic lists, external-link safety, and exact public-asset URLs.                                                                                                                                                                         |
| `src/components/ProcessingModal.test.tsx` | Non-dismissible processing status and termination contract.                                                                                                                                                                                                                  |

## Consolidation audit

This is the disposition of the 32 Playwright cases that existed before the consolidation.

| Former browser test                                                                                       | Disposition and replacement coverage                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| About: `About modal can be opened and closed`                                                             | Removed. `AboutModal.test.tsx`, `Header.test.tsx`, and `Modal.test.tsx` cover its content, URLs, opening, and closing; the retained modal accessibility test exercises the real dialog. |
| Accessibility: `names the editor fields and exposes visible high-contrast focus`                          | Kept; accessible names and computed contrast are browser behavior.                                                                                                                      |
| Accessibility: `contains modal focus, supports Escape, restores the opener, and preserves list semantics` | Kept; the focus lifecycle and keyboard containment require a real dialog.                                                                                                               |
| Accessibility: `gives settings controls concise names, descriptions, and keyboard focus indicators`       | Kept; it covers the actual accessibility tree and computed focus indicator.                                                                                                             |
| Accessibility: `exposes comparison structure, line changes, and keyboard disclosure controls`             | Kept; it covers actual keyboard disclosure interaction and accessibility-tree output.                                                                                                   |
| Accessibility: `makes long comparison results keyboard-scrollable`                                        | Kept; scrolling is layout-dependent browser behavior.                                                                                                                                   |
| Accessibility: `reflows header controls without overlap at narrow viewport widths`                        | Combined into the single retained responsive-layout test.                                                                                                                               |
| Accessibility: `returns header controls to the first row when they fit`                                   | Combined into the single retained responsive-layout test.                                                                                                                               |
| Accessibility: `preserves header content when text is resized to 200 percent`                             | Combined into the single retained responsive-layout test.                                                                                                                               |
| Accessibility: `passes automated checks in the primary UI states`                                         | Kept; axe inspects the browser-rendered states.                                                                                                                                         |
| JSON: `ignores both key order and formatting differences`                                                 | Kept as the concise JSON end-to-end workflow; detailed normalization remains in `compute.test.ts`.                                                                                      |
| JSON: `detects actual value differences`                                                                  | Removed. `compute.test.ts` asserts the exact normalized diff, while the retained text workflow covers rendered-change integration.                                                      |
| JSON: `preserves numeric precision and duplicate keys in the diff`                                        | Removed. Separate `compute.test.ts` cases assert exact number spellings and duplicate-member order.                                                                                     |
| JSON: `shows error for invalid JSON`                                                                      | Removed. `compute.test.ts` covers both source-specific errors, `App.test.tsx` covers exact modal state, and the axe state test still renders the real error dialog.                     |
| JSON: `preserves array element order`                                                                     | Moved to `compute.test.ts`, where both normalized element sequences are asserted directly.                                                                                              |
| Processing: `loads one dedicated worker with the page and reuses it for consecutive comparisons`          | Kept; real Worker construction and URL behavior are browser-specific.                                                                                                                   |
| Processing: `keeps the processing modal open until the user terminates the worker`                        | Kept; it integrates a pending Worker with native dialog focus, accessibility, cancellation, and replacement.                                                                            |
| Security: `uses an environment-specific CSP in development and preview`                                   | Kept; the served policy differs by server environment.                                                                                                                                  |
| Security: `loads bundled fonts without a runtime font CDN`                                                | Kept; request provenance and loaded/computed fonts require a browser.                                                                                                                   |
| Security: `stays hidden and inert inside a cross-origin frame`                                            | Combined into the single retained framed-document test.                                                                                                                                 |
| Security: `stays hidden when iframe sandboxing disables scripts`                                          | Combined into the single retained framed-document test.                                                                                                                                 |
| Settings: `uses no cleanup by default and can apply semantic cleanup to the same diff`                    | Removed. `SettingsModal.test.tsx` covers the default/callback and `compute.test.ts` covers exact cleanup output.                                                                        |
| Settings: `labels every default, omits Sparse, and applies whole-content grapheme diffing with Adaptive`  | Removed. `SettingsModal.test.tsx` asserts the complete option set/defaults; `compute.test.ts` covers grapheme mode and both algorithms.                                                 |
| Settings: `enables and applies edit cost for efficiency cleanup`                                          | Removed. `SettingsModal.test.tsx` covers enablement/validation and `compute.test.ts` directly covers both efficiency thresholds.                                                        |
| Text: `detects line and character changes and returns to edit mode`                                       | Kept as the concise text end-to-end workflow.                                                                                                                                           |
| Text: `highlights complete grapheme clusters for emoji substitutions`                                     | Removed. `compute.test.ts` covers four Unicode grapheme classes and `CompareDisplay.test.tsx` covers character markup.                                                                  |
| Text: `keeps the former final line unchanged when a line is appended`                                     | Removed. `compute.test.ts` asserts the complete aligned result and `CompareDisplay.test.tsx` covers equal/insert/empty rendering.                                                       |
| Text: `keeps inherited prototype names equal on unchanged final lines`                                    | Moved to a four-case `compute.test.ts` table; `main.test.tsx` independently asserts prototype hardening.                                                                                |
| Text: `handles empty input gracefully`                                                                    | Removed. `compute.test.ts` now covers either empty side, while existing identity and App tests cover the empty-equal modal path.                                                        |
| Text: `shows a trailing-newline row only when the sides differ`                                           | Removed. `compute.test.ts` covers both diff modes and `CompareDisplay.test.tsx` asserts both rendered directions and equal-state omission.                                              |
| Text: `collapses unchanged sections at both ends`                                                         | Removed. `CompareDisplay.test.tsx` directly asserts context boundaries and both collapsed regions.                                                                                      |
| Text: `collapses multiple regions and toggles one independently`                                          | Removed. `CompareDisplay.test.tsx` asserts immutable per-section state; the retained accessibility test exercises a disclosure with real keyboard input.                                |

## Commands

Run deterministic tests first:

```bash
npm test
```

Run a focused browser spec against an existing development server:

```bash
BASE_URL=http://localhost:5173 npm run integration:dev -- playwright/comparison.spec.ts --project=chromium
```

Run the production-build, three-browser suite:

```bash
npm run integration
```
