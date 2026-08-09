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
