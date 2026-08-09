# Code Review: Tooling, Deployment, and Test Infrastructure

## Scope and review basis

Reviewed `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`,
`playwright.config.ts`, `README.md`, `.gitignore`, `.prettier*`, `.vscode/settings.json`, the source-to-`docs/`
deployment path, and test infrastructure/configuration. Generated build/test output and vendored third-party source were
excluded except where their integration contracts were needed as evidence. Individual test cases, fixtures, assertions,
and coverage were not reviewed.

The review is based on commit `759a88f` on `main`, the current checked-in configuration, dependency metadata, focused
repository searches, and the checks listed below.

## Findings

### 1. The committed and live GitHub Pages deployment is stale

- **Severity:** Medium
- **Reference:** `docs/index.html:12-13`, `docs/assets/index-yvjqNzWJ.js:1`, `docs/assets/index-B4ma4shS.css:1` (current
  source: `src/App.tsx:64`, `src/components/Header.tsx:34,44`, `src/components/TextAreas.tsx:12`; deployment contract:
  `vite.config.ts:8-10`, `README.md:18,73-79`)
- **Problem:** The tracked deployment bundle predates the current source. The deployed assets contain the removed
  `.layout`, `.brand`, `.header-center`, and `.workspace` structure, while current source uses `.app`, `.header__brand`,
  `.header__controls`, and `.text-areas`. A focused Vite build to a temporary directory produced different JS/CSS assets
  containing the current structure. The documented GitHub Pages URL returned byte-for-byte copies of the stale tracked
  `docs/index.html`, JS, and CSS files, confirming this is the live deployment rather than an unused artifact.
- **Impact:** Users of the README's hosted application do not receive the version represented by the current source, and
  production observations cannot validate the reviewed code. Source changes can therefore appear complete in the
  repository while never reaching users.
- **Recommendation:** Rebuild and publish `docs/` from the current clean source. Then make deployment reproducible: have
  CI build and publish an artifact directly, or fail CI whenever a clean build changes the tracked `docs/` tree, so
  source and the Pages payload cannot drift silently.

### 2. Playwright serves stale code and currently fails against the current specs

- **Severity:** Medium
- **Reference:** `playwright.config.ts:37-40` (related: `package.json:24-25`, `vite.config.ts:8-10`,
  `playwright/about.spec.ts:10-11`)
- **Problem:** Playwright starts `npm run preview`, which only serves the existing Vite output from `docs/`; neither the
  Playwright script nor its `webServer` command builds the application first. Because `docs/` is checked in, a developer
  can change `src/` and run `npm run playwright:local` while the tests continue to exercise the older committed bundle.
  In addition, `reuseExistingServer: true` allows any already-running responder on the configured URL to bypass the
  declared server command entirely. This is an active failure, not only a latent risk: a focused Chromium run of
  `playwright/about.spec.ts` failed because the current spec looks for `.modal__overlay` at lines 10-11 while the
  previewed bundle still renders the former `.modal-overlay` DOM.
- **Impact:** End-to-end results can be false positives (the changed behavior was never exercised) or false negatives
  (tests expect a source change that is absent from the stale bundle). This undermines the main reliability property of
  the browser-test workflow.
- **Recommendation:** Make the Playwright workflow deterministically produce the bundle it serves before starting the
  preview server. Prefer a dedicated, ignored test output directory so running tests does not rewrite tracked deployment
  artifacts; alternatively, use the Vite development server when validating a production build is not required. Disable
  server reuse for deterministic/CI runs, or make reuse an explicit local opt-in.

### 3. The CSP does not provide its declared framing protection

- **Severity:** Low
- **Reference:** `index.html:6-9`
- **Problem:** `frame-ancestors 'none'` is delivered in a `<meta http-equiv="Content-Security-Policy">` element, but
  browsers do not apply `frame-ancestors` from a meta-delivered policy. A focused Chromium check emitted the
  corresponding warning and successfully loaded the live GitHub Pages application inside a cross-origin iframe. The live
  response also supplies no CSP HTTP header that could enforce the directive separately.
- **Impact:** The application has no effective anti-framing policy, despite the source appearing to provide one. This
  leaves it open to UI-redressing/clickjacking if sensitive or state-changing interactions are added, and can mislead
  maintainers assessing the deployment's security controls.
- **Recommendation:** Deliver `Content-Security-Policy: frame-ancestors 'none'` as an HTTP response header (and consider
  `X-Frame-Options: DENY` as a legacy fallback). If the current static host cannot set response headers, move the site
  to a host or edge layer that can; do not rely on the meta directive for this control.

### 4. The production CSP disables Vite hot-module reload during development

- **Severity:** Low
- **Reference:** `index.html:6-9` (related: `package.json:22`)
- **Problem:** The CSP omits `connect-src`, so its `default-src 'none'` fallback blocks the WebSocket connection used by
  the Vite development client. A focused Chromium run against `npm run dev` loaded the initial page but logged that the
  Vite WebSocket was blocked by this exact policy.
- **Impact:** Hot-module reload cannot connect, so source edits do not get Vite's expected live-update behavior and the
  development loop becomes slower and potentially confusing.
- **Recommendation:** Generate a development-specific CSP that permits only the Vite WebSocket endpoint while retaining
  the stricter production policy. Keep the policy environment-aware rather than broadly enabling WebSocket connections
  in production.

### 5. Playwright's configured trace mode can never capture a trace

- **Severity:** Low
- **Reference:** `playwright.config.ts:7,12`
- **Problem:** The suite sets `retries: 0` while selecting `trace: 'on-first-retry'`. That trace mode records only when
  a test's retry index is 1; with retries disabled, such a run never occurs. The focused failing Chromium run produced
  an error context but no trace artifact, confirming the configured behavior.
- **Impact:** Browser failures have no trace artifact, even though the configuration appears to enable tracing, making
  intermittent or browser-specific failures materially harder to diagnose.
- **Recommendation:** Use `retain-on-failure` (or another first-run capture mode) while retries remain disabled, or
  enable retries in the environments where `on-first-retry` is intended.

### 6. A formatter plugin is installed as a production dependency

- **Severity:** Low
- **Reference:** `package.json:2-4` (related: `.prettierrc.json:2`)
- **Problem:** `@aforemendude/prettier-plugin-wrap-comments` is used only by Prettier configuration but is declared
  under `dependencies`. Its Prettier peer dependency consequently also remains in the production dependency tree; this
  was confirmed with `npm ls --omit=dev --depth=1`.
- **Impact:** Production-only installs fetch and retain both the formatting plugin and Prettier even though neither is
  used by the built application, increasing install size, time, and third-party dependency surface.
- **Recommendation:** Move the plugin to `devDependencies` alongside Prettier and regenerate the lockfile with the
  existing package manager.

## Unresolved questions

None.

## Checks and areas not covered

- Confirmed that Vite preview announces `/text-diff-tool/` and redirects `/` to that base path while serving the
  existing `docs/` output.
- Built current source with Vite into a temporary directory and compared its asset contracts with the tracked `docs/`
  artifacts; the temporary output was not copied into or substituted for reviewed files.
- Fetched the README's GitHub Pages URL and its referenced JS/CSS assets. Their SHA-256 digests exactly matched the
  tracked stale `docs/` files, and the response did not supply a CSP HTTP header.
- Compared the tracked `public/` inputs with their `docs/` counterparts only to validate the build/deployment contract;
  generated output itself was not reviewed.
- Verified that Playwright reports/results and TypeScript build metadata match the intended `.gitignore` rules.
- Ran `npm ls --depth=0` and `npm ls --omit=dev --depth=1`; both completed successfully and the latter substantiated
  finding 6.
- Ran both TypeScript projects directly with `--noEmit --incremental false`; both completed successfully.
- Ran `npm test`; Vitest completed successfully with 10 files and 68 tests. Test cases and assertions were not reviewed.
- Ran `npx playwright test --list`; Playwright discovered 78 tests across the configured Chromium, Firefox, and WebKit
  projects without a configuration error. The listing itself did not execute browser tests.
- Ran the current About Playwright spec once in Chromium with line reporting and all artifacts directed to `/tmp`; it
  failed at `playwright/about.spec.ts:11` because the configured stale preview does not contain `.modal__overlay`. This
  was used only to validate the runner/server integration, not to review the test's logic or assertion quality.
- Used focused headless Chromium probes to validate the live site's framing behavior and the development server's
  WebSocket behavior; these were infrastructure checks, not application test-case review.
- Did not run `npm run build` into its configured tracked `docs/` destination. The focused Vite build used for
  comparison wrote only to a new temporary directory, so no deployment artifact was rewritten.
- Did not audit generated `docs/` assets, Playwright reports/results, TypeScript build metadata, individual tests or
  fixtures, coverage adequacy, or vendored third-party implementation source.
