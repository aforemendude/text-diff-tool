# Text Diff Tool

A modern, lightweight web application for comparing text differences, focusing on simplicity and a premium user experience.

## ✨ Features

- **Split-View Interface**: Side-by-side comparison for "Original" and "Modified" text.
- **Modern Design**: Clean aesthetics using the Inter font, subtle shadows, and a responsive layout.
- **Developer Experience**: Powered by Vite for instant HMR and fast builds.
- **Visual Feedback**: Clear distinctions between read-only and editable panes.

## 🛠️ Tech Stack

- **Build Tool**: [Vite](https://vitejs.dev/)
- **Frontend**: HTML5, CSS3, JavaScript (ES Modules)
- **Dependencies**: React (Configured for future expansion)
- **Code Formatter**: Prettier

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd text-diff-tool
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the local development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in your terminal).

### Production Build

Build the application for production:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## 📝 Roadmap

- [ ] Implement text difference algorithm (Myers' diff algorithm or similar).
- [ ] Add syntax highlighting or diff coloring.
- [ ] Migrate UI components to React for better state management.
