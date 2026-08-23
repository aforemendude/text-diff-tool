# Code review: project infrastructure

## Reviewed scope and basis

This report covers the repository's dependency manifests and lockfile consistency; Vite, TypeScript, Vitest, and
Playwright configuration; test-runner infrastructure (not individual test assertions, fixture payloads, or coverage
adequacy); npm scripts; `index.html`; setup, testing, and deployment claims in `README.md` and `TESTING.md`; and the
README screenshot-generation script and relevant source assets and license notices under `public/`.

Generated `docs/**`, generated screenshots, Playwright result artifacts, vendored/binary font contents, and the contents
of notes fixture payloads are excluded. The review was based on direct inspection of the listed files and their shared
contracts, the installed dependency tree, and the focused checks recorded below.

## Current status

No unresolved findings or questions remain in the reviewed scope. Resolved entries have been removed.

## Checks and areas not covered

- Confirmed `package.json` and the lockfile root have identical name, version, production dependencies, development
  dependencies, and Node.js engine requirement.
- `npm ls --all --json` and `npm ls --depth=0` completed without invalid, missing, or conflicting dependency reports.
- Full and production-only `npm audit` runs reported zero known vulnerabilities in the current dependency tree on
  2026-08-23.
- The installed browser production tree consists of the five third-party packages represented in
  `public/THIRD_PARTY_NOTICES.txt`; their versions and package-declared licenses match the lockfile. Both self-hosted
  font families have adjacent complete OFL 1.1 texts and are represented in the public notice.
- `tsc -b --pretty false` and `playwright test --list` completed successfully. Playwright discovered 15 cases in each of
  three projects (45 project/case combinations).
- The full Vitest command completed successfully with 13 files and 123 tests.
- Focused development-server Chromium security runs passed through both `localhost` and `127.0.0.1`, including the
  development CSP and HMR connection check. A separate occupied-port probe confirmed that the production-preview
  workflow refuses to reuse an existing process on port 4173.
- The repository-wide Prettier check passed. Notice, license, and SVG files with no inferred Prettier parser were
  inspected directly.
- No additional unresolved findings were identified in manifest/lockfile consistency, TypeScript or Vitest
  configuration, `index.html`, the testing catalog, or the current JavaScript/font notices. This is not a guarantee that
  those areas are defect-free.
- No build, deployment, full multi-browser suite, or screenshot regeneration was performed.
- Individual test cases, assertions, fixture payloads, generated output, screenshots, and binary font data were not
  reviewed.
