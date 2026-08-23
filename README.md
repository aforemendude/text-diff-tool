# TextDiffTool

A modern, browser-based text comparison tool that highlights differences between two text inputs with line-level and
character-level diff visualization.

![Text Compare Mode](/screenshots/text_compare_mode.png)

<details>

<summary>More Screenshots</summary>

![JSON Edit Mode](/screenshots/json_edit_mode.png)

![JSON Compare Mode](/screenshots/json_compare_mode.png)

</details>

Try it now: https://aforemendude.github.io/text-diff-tool/

## Features

- **Side-by-side comparison** – View original and modified text in a split display
- **Line-level diffing** – Highlights added, removed, and modified lines
- **Character-level diffing** – Shows exact character changes within modified lines
- **Collapsible unchanged sections** – Automatically hides large blocks of identical lines to focus on changes
- **Edit/Compare toggle** – Switch between editing text and viewing differences
- **JSON Mode** – Normalizes JSON by sorting keys and formatting with consistent indentation before comparison
- **Static deployment** – Builds to static files

## Privacy and Security

- **Local Processing** – All data processing happens locally in your browser. No data is ever sent to a remote server.
- **No Trackers** – This tool is free of ads and trackers.

## Getting Started

### Prerequisites

- Node.js v24
- npm (included with Node.js)

### Installation

```bash
npm install
```

Playwright also needs its browser binaries. Choose the command for your environment:

```bash
# macOS or Windows
npm run playwright:install

# Supported Linux distributions and Linux CI/container environments
npm run playwright:install -- --with-deps
```

The Linux command installs both the browsers and their required system packages, and may prompt for `sudo`. If the
browsers are already installed and you only need the system packages, run:

```bash
npm run playwright:install-deps
```

### Development

Start the development server:

```bash
npm run dev
```

### Build

Build for production (outputs to `docs/` for GitHub Pages):

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

### Tests

Run the Playwright end-to-end tests (the production build runs first, then the preview server starts automatically):

```bash
npm run integration
```

To test against an already-running development server, set `BASE_URL` and use the development integration script. This
skips both the production build and preview server. Extra arguments can select a focused spec or browser:

```bash
BASE_URL=http://localhost:5173 npm run integration:dev -- playwright/about.spec.ts --project=chromium
```

Run the Vitest unit tests:

```bash
npm run test
```

### Format Code

```bash
npm run format
```

### Deploy

Install dependencies, verify the lockfile, run all checks, and rebuild the tracked `docs/` deployment without committing
or pushing it:

```bash
npm run deploy
```

## Usage

1. Enter or paste text in the **Original** and **Modified** text areas
2. Click the **Compare** button to view the diff
3. Click **Edit** to return to editing mode

## License and Credits

TextDiffTool is licensed under the [MIT License](./LICENSE).

Copyright and license terms for the JavaScript libraries shipped in the browser bundle are collected in the
[third-party software notices](./public/THIRD_PARTY_NOTICES.txt).

The interface uses [Inter](https://fonts.google.com/specimen/Inter), and editable and compared text uses
[JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono). Both font families are self-hosted and licensed
under the SIL Open Font License 1.1. The required copyright and license notices are distributed beside the font files:

- [Inter license](./public/fonts/inter/OFL.txt)
- [JetBrains Mono license](./public/fonts/jetbrains-mono/OFL.txt)
