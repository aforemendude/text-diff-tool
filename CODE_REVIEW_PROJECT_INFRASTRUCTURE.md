# Code review: project infrastructure

## Reviewed scope and basis

This report covers the repository's dependency manifests and lockfile consistency; Vite, TypeScript, Vitest, and
Playwright configuration; test-runner infrastructure (not individual test assertions, fixture payloads, or coverage
adequacy); npm scripts; `index.html`; setup, testing, and deployment claims in `README.md` and `TESTING.md`; and the
README screenshot-generation script and relevant source assets and license notices under `public/`.

Generated `docs/**`, generated screenshots, Playwright result artifacts, vendored/binary font contents, and the contents
of notes fixture payloads are excluded. The review is based on the current worktree, direct inspection of the listed
files and their shared contracts, the installed dependency tree, and the focused checks recorded below.

## Findings

### PI-1: The production integration command may test an unrelated already-running server

- **Severity:** Medium
- **References:** `package.json:31`, `playwright.config.ts:44-52`, `README.md:102-115`
- **Problem:** `npm run integration` first builds the production output and then starts Playwright without `BASE_URL`,
  but the default `webServer` configuration sets `reuseExistingServer: true`. Consequently, any process that already
  answers at `http://localhost:4173` is accepted instead of the repository's preview command. The separate
  `integration:dev`/`BASE_URL` path already provides an explicit workflow for caller-owned servers.
- **Impact:** A nominal production integration run can pass without exercising the production output it just built (or
  fail against unrelated content), so the command does not reliably validate the deployment artifact described by the
  README.
- **Recommendation:** Disable `reuseExistingServer` for the default production-preview workflow and treat an occupied
  port as an error. Continue to use `BASE_URL` with `integration:dev` when reusing a caller-owned development server is
  intentional.

### PI-2: The documented Node.js prerequisite is not represented in package metadata

- **Severity:** Low
- **References:** `README.md:39-48`, `package.json:22-41`
- **Problem:** The README declares Node.js v24 as a prerequisite, but the root package has no `engines.node` (and no
  package-manager version declaration). npm therefore has no project-level, machine-readable representation of the
  runtime/toolchain contract.
- **Impact:** Contributors and automation can begin installation under an unsupported Node/npm combination and only
  encounter transitive engine warnings, lockfile churn, or tool failures later in setup.
- **Recommendation:** Add a root `engines.node` constraint matching the supported Node 24 range and pin the intended npm
  major with the `packageManager` field (or document and encode a broader range if Node 20/22 are intentionally
  supported).

### PI-3: The development CSP can block Vite's own HMR connection when the page uses a hostname alias

- **Severity:** Medium
- **References:** `vite.config.ts:9-31`, `README.md:67-73`, `README.md:110-115`, `TESTING.md:98-110`
- **Problem:** The development CSP is built only from hostnames in `server.resolvedUrls`. That policy is then served to
  requests made through any hostname accepted by the server. In a verified run, Vite advertised
  `ws://127.0.0.1:5173/text-diff-tool/`, while the documented caller URL `http://localhost:5173` caused the HMR client
  to open `ws://localhost:5173/text-diff-tool/?token=...`. Chromium blocked that socket because only the `127.0.0.1`
  source was in `connect-src`.
- **Impact:** The application loads, but hot-module reload never connects and development changes are no longer pushed
  to the browser. The documented focused integration workflow also fails its CSP check under this otherwise valid
  loopback alias combination; 13 of 14 Chromium tests passed and the CSP check failed in the reproduced run.
- **Recommendation:** Generate the development `connect-src` from the actual HMR client endpoint, or configure a single
  explicit HMR hostname and use it consistently. If multiple loopback aliases are accepted, include the normalized
  aliases that the browser may use and verify both `localhost` and `127.0.0.1` access.

### PI-4: Full screenshot regeneration deletes the existing set before regeneration is known to be viable

- **Severity:** Low
- **References:** `scripts/create-readme-screenshots.mjs:188-195`, `scripts/create-readme-screenshots.mjs:325-350`,
  `README.md:75-85`
- **Problem:** With no filename argument, the script recursively empties `screenshots/` before it starts or validates
  the application server, launches Chromium, or captures any replacement. A later startup, browser, navigation, or
  capture failure therefore leaves an empty or partially regenerated directory.
- **Impact:** A transient tool or browser failure can discard uncommitted screenshot work and leave the tracked README
  image set incomplete, requiring a manual restore or another full successful run.
- **Recommendation:** Capture the complete set into a temporary sibling directory and replace the tracked images only
  after every capture succeeds. At minimum, validate the server and browser before clearing any existing output.

### PI-5: A Vite child can escape screenshot-script cleanup when readiness fails

- **Severity:** Low
- **References:** `scripts/create-readme-screenshots.mjs:125-173`, `scripts/create-readme-screenshots.mjs:325-353`
- **Problem:** `startApplication` spawns Vite and awaits `waitForApplication` before returning the child handle. If the
  child stays alive but readiness times out (for example, Vite serves an error response), the promise rejects before
  `main` assigns that handle. Its `finally` block consequently calls `stopApplication` with `undefined` and cannot stop
  the owned process.
- **Impact:** The screenshot command can hang or leave its port occupied after reporting the readiness failure, which
  then disrupts retries and later development commands.
- **Recommendation:** Catch readiness failures inside `startApplication`, terminate the locally owned child, and then
  rethrow. Alternatively, return/register ownership of the child before awaiting readiness so the outer `finally` can
  always clean it up.

## Unresolved questions

- Is the absence of a checked-in CI workflow intentional, with `npm run deploy` expected to be run and reviewed manually
  before updating GitHub Pages?
- What is the provenance of `public/logo.svg`? Its SVG attributes and geometry match Feather Icons'
  [`file-plus.svg`](https://github.com/feathericons/feather/blob/main/icons/file-plus.svg), apart from omitted
  dimensions and serialization-neutral line ordering/direction, but the repository has no Feather attribution. If it is
  Feather-derived, Feather's
  [MIT copyright and permission notice](https://github.com/feathericons/feather/blob/main/LICENSE) should accompany the
  distributed asset; if it was created independently, recording that provenance would resolve the apparent license gap.

## Checks and areas not covered

- Confirmed `package.json` and the lockfile root have identical name, version, production dependencies, and development
  dependencies.
- `npm ls --all --json` and `npm ls --depth=0` completed without invalid, missing, or conflicting dependency reports.
- Full and production-only `npm audit` runs reported zero known vulnerabilities in the current dependency tree on
  2026-08-23.
- The installed browser production tree consists of the five third-party packages represented in
  `public/THIRD_PARTY_NOTICES.txt`; their versions and package-declared licenses match the lockfile. Both self-hosted
  font families have adjacent complete OFL 1.1 texts and are represented in the public notice.
- `tsc -b --pretty false`, `vitest list`, and `playwright test --list` completed successfully. Playwright discovered the
  documented 14 cases in each of three projects (42 project/case combinations).
- The full Vitest command completed successfully with 13 files and 116 tests. A focused development-server Chromium run
  completed with 13 passes and the CSP/HMR failure described in PI-3; the same three security checks passed when the
  caller used the server's advertised `127.0.0.1` hostname.
- A direct headless-Chromium probe reproduced PI-3: the page logged Vite's connection attempt and a CSP violation
  blocking the `ws://localhost:5173/text-diff-tool/` socket. No WebSocket connection opened.
- A focused Prettier check passed for the parseable infrastructure, script, HTML, Markdown, and JSON files. Notice,
  license, and SVG files have no inferred Prettier parser and were inspected directly.
- Beyond the findings above, no additional verified findings were identified in manifest/lockfile consistency,
  TypeScript or Vitest configuration, `index.html`, the testing catalog, or the current JavaScript/font notices. This is
  not a guarantee that those areas are defect-free.
- No build, deployment, full multi-browser suite, screenshot regeneration, or generated-artifact update was performed.
- Individual test cases, assertions, fixture payloads, generated output, screenshots, and binary font data were not
  reviewed.
- No source, configuration, test, or generated file was intentionally edited; this report is the segment's only
  workspace modification.
