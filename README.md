# TextDiffTool

A modern, browser-based text comparison tool that highlights differences between
two text inputs with line-level and character-level diff visualization.

https://aforemendude.github.io/text-diff-tool/

## Features

- **Side-by-side comparison** – View original and modified text in a split
  display
- **Line-level diffing** – Highlights added, removed, and modified lines
- **Character-level diffing** – Shows exact character changes within modified
  lines
- **Collapsible unchanged sections** – Automatically hides large blocks of
  identical lines to focus on changes
- **Edit/Compare toggle** – Switch between editing text and viewing differences
- **JSON Mode** – Normalizes JSON by sorting keys and formatting with consistent
  indentation before comparison
- **Static deployment** – Builds to static files for easy hosting (e.g., GitHub
  Pages)

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **diff-match-patch** for diff computation
- **Prettier** for code formatting

## Getting Started

### Prerequisites

- Node.js v24

### Installation

```bash
npm install
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

```bash
npm run playwright:local
```

### Format Code

```bash
npm run format
```

## Usage

1. Enter or paste text in the **Original** and **Modified** text areas
2. Click the **Compare** button to view the diff
3. Click **Edit** to return to editing mode

## Libraries

### diff-match-patch

This project uses the `diff-match-patch` library for computing text differences.

https://github.com/google/diff-match-patch

## AI Use Disclosure

This project was built with the assistance of AI coding tools. AI was used to
help with code generation, documentation, and development workflow optimization.
