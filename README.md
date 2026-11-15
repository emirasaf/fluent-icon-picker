# Fluent Icon Picker

A fast, local-first web tool that reads the **Segoe Fluent Icons** font directly from your Windows machine, displays all 2,033 glyphs in a searchable grid, and copies clean **Figma-ready `<svg>`** code or Unicode text to your clipboard with a single click.

👉 **Live App:** **[emirasaf.github.io/fluent-icon-picker](https://emirasaf.github.io/fluent-icon-picker/)**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Open_App-0078D4?style=flat&logo=githubpages)](https://emirasaf.github.io/fluent-icon-picker/)
![Stack](https://img.shields.io/badge/Stack-Vite_·_TypeScript_·_Vanilla_CSS-3178C6)
![Icons](https://img.shields.io/badge/Glyphs-2%2C033-brightgreen)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Why?

Third-party icon sites rarely ship the complete Segoe Fluent Icons set — and when they do, names and search terms are often wrong or missing. Windows Character Map can show them, but getting a clean vector into Figma still means exporting, cleaning paths, and fixing viewBoxes by hand.

**Fluent Icon Picker** removes that entire workflow: browse the full font, search by name or concept, and one-click copy a pixel-perfect SVG that pastes directly into Figma as an editable vector.

---

## Getting Started

You can use the tool directly in your browser without installing anything, or clone and run it locally.

### Option 1: Use Online (No Setup Required)

1. Open **[https://emirasaf.github.io/fluent-icon-picker/](https://emirasaf.github.io/fluent-icon-picker/)** in a Chromium-based browser on Windows (Chrome, Edge, Brave, Helium).
2. Click **"Connect System Font"** to grant read access to your local `Segoe Fluent Icons` font.
3. Search any icon and click to copy it straight into Figma (`Ctrl + V`).

### Option 2: Run Locally

**Prerequisites:** Node.js v18+ on Windows 10/11.

```bash
# Clone the repository
git clone [https://github.com/emirasaf/fluent-icon-picker.git](https://github.com/emirasaf/fluent-icon-picker.git)
cd fluent-icon-picker

# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
