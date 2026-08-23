# Repository Guide

## Project layout

- `src/` contains the React application and Vitest unit tests.
- `playwright/` contains the browser integration tests.
- `public/` contains static source assets.
- `docs/` is generated, tracked deployment output for GitHub Pages.

## Working conventions

- Do not build or otherwise regenerate `docs/` unless the user explicitly asks. In particular, do not run
  `npm run build` or `npm run deploy` as routine validation.

## Tests and development servers

- Run unit tests with `npm test`; pass a test file after `--` when a focused run is sufficient.
- Before starting a development server, check for an already-running server and reuse it.
- By default, the Playwright configuration uses the production preview server at `http://localhost:4173`. To test
  against an already-running development server instead, set `BASE_URL` and use `npm run integration:dev`; this skips
  the production build and preview server.
- If you start a server yourself, keep track of its process and stop it when validation is complete. A server started by
  Playwright is stopped automatically when Playwright exits.
- Avoid running the full integration suite during routine work. Run the relevant Playwright file or test against the
  development server, preferably in Chromium, for example:

  ```bash
  BASE_URL=http://localhost:5173 npm run integration:dev -- playwright/about.spec.ts --project=chromium
  ```

- Run the full multi-browser integration suite only when the user asks for it or when the scope of the change clearly
  requires it.
