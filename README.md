# Fluent Icon Picker

A fast, local-first web tool that reads the **Segoe Fluent Icons** font directly from your Windows machine, displays all 2,033 glyphs in a searchable grid, and copies clean **Figma-ready `<svg>`** code or Unicode text to your clipboard with a single click.

![Stack](https://img.shields.io/badge/Stack-Vite_·_TypeScript_·_Vanilla_CSS-3178C6)
![Icons](https://img.shields.io/badge/Glyphs-2%2C033-brightgreen)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Why?

Third-party icon sites rarely ship the complete Segoe Fluent Icons set — and when they do, names and search terms are often wrong or missing. Windows Character Map can show them, but getting a clean vector into Figma still means exporting, cleaning paths, and fixing viewBoxes by hand.

**Fluent Icon Picker** removes that entire workflow: browse the full font, search by name or concept, and one-click copy a pixel-perfect SVG that pastes directly into Figma as an editable vector.

---

## Key Features

### 🔌 Zero-Bundle Local Font Access
Reads `Segoe Fluent Icons` directly from your OS via the browser's **Local Font Access API** (`queryLocalFonts()`). A drag-and-drop / file picker fallback is available for browsers that restrict the API. The font buffer is cached in **IndexedDB** so you only need to grant access once.

> **No font files are ever bundled, committed, or distributed with this project.**

### 🎯 100% Glyph Coverage (2,033 Glyphs)
Extracts every non-empty glyph in the font's Private Use Area:
- **1,628** modern Fluent icons (`E600`–`F8FF`) — visible by default
- **405** legacy glyphs (`E000`–`E5FF`) — behind a "Show Legacy" toggle

### ✂️ Figma-Ready Instant Copy
One-click copy with a **SVG | Glyph** segmented control:
- **SVG mode** — clean `<svg>` markup with `fill-rule="nonzero"`, proper `viewBox`, and optical baseline centering
- **Glyph mode** — raw Unicode character for pasting into text layers
- **Size presets:** 16 · 20 · 24 · 32 · 48 · 64 px
- **Bounding modes:** Em Box (square, consistent sizing) or Tight Crop (ink-only bounds)
- **Custom fill color** via color picker

### 🔍 Smart Search Engine
Powered by [MiniSearch](https://github.com/lucaong/minisearch) indexing **1,574** officially documented icons from Microsoft's [Segoe Fluent Icons reference](https://learn.microsoft.com/windows/apps/design/style/segoe-fluent-icons-font) and [WinUI Gallery](https://github.com/microsoft/WinUI-Gallery):
- Full-text search across names, tags, categories, and hex codes
- **Synonym expansion** — search `gear` → finds `Settings`, `magnifier` → `Search`, `x` → `Cancel`, `wifi` → `Wifi`
- Hex code lookup — type `E713`, `0xE713`, or `U+E713`
- Custom user tags searchable instantly after adding them

### 📋 Category Filtering
16 curated categories: Media · Navigation · Arrows · System · Editing · Files · Communication · Devices · Connectivity · Windows UI · Security · People · Emoji · Accessibility · Maps · and more.

Plus priority filter pills for **★ Favorites** and **Recent** copies.

### 🔎 Inspector Drawer
Right-click any icon (or press <kbd>i</kbd>) to open a non-blocking slide-over panel:
- **88 px vector preview** with dark/light background toggle
- Official name, Unicode hex, decimal codepoint, category badges
- Clickable tag chips that search instantly
- **Custom user tags** — add aliases to any icon (great for the 459 unnamed glyphs), persisted in localStorage
- **5 export actions:** Copy SVG · Copy Glyph · Copy Hex · Copy XAML (`&#xE893;`) · Download `.svg` file
- Inline SVG code viewer with quick-copy button

### ⌨️ Full Keyboard Navigation
Navigate entirely without a mouse — see [Keyboard Shortcuts](#keyboard-shortcuts) below.

### ⭐ Favorites & Recents
Star icons you use often, and automatically track your last 24 copies. Both persist across sessions via localStorage.

---

## Getting Started

### Prerequisites

| Requirement | Details |
| :--- | :--- |
| **Node.js** | v18 or later |
| **Operating System** | Windows 10 / 11 with `Segoe Fluent Icons` installed (ships by default) |
| **Browser** | Chromium-based recommended for `queryLocalFonts()`; any modern browser works with file picker fallback |

### Install & Run

```bash
# Clone the repository
git clone https://github.com/<your-username>/fluent-icon-picker.git
cd fluent-icon-picker

# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

### Regenerate Icon Metadata (optional)

The repo ships with pre-built `src/data/icon-meta.json`. To re-fetch from Microsoft's official sources:

```bash
npm run build:meta
```

---

## Browser Compatibility

| Browser | Local Font Access (`queryLocalFonts`) | Fallback (`.ttf` file picker) |
| :--- | :---: | :---: |
| **Chrome 103+** | ✅ Full | ✅ Full |
| **Edge 103+** | ✅ Full | ✅ Full |
| **Brave / Chromium** | ✅ Full | ✅ Full |
| **Firefox** | ❌ Use fallback | ✅ Full |
| **Safari** | ❌ Use fallback | ✅ Full |

> When `queryLocalFonts` is unavailable, click **"Or Choose Local Font"** and select `C:\Windows\Fonts\SegoeIcons.ttf`. The font buffer is cached in IndexedDB — you only need to do this once.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>/</kbd> | Focus the search input |
| <kbd>Esc</kbd> | Close inspector / clear search |
| <kbd>Arrow Keys</kbd> | Navigate grid tiles |
| <kbd>Enter</kbd> | Copy the focused icon |
| <kbd>f</kbd> | Toggle favorite on focused icon |
| <kbd>i</kbd> | Toggle inspector drawer for focused icon |
| <kbd>Alt</kbd> + <kbd>M</kbd> | Toggle SVG / Glyph copy mode |
| <kbd>?</kbd> | Open shortcuts legend |
| **Left-click** | **Instant copy** (SVG or Glyph) |
| **Right-click** | Open inspector drawer |

---

## Project Structure

```
fluent-icon-picker/
├── public/
│   └── favicon.svg
├── scripts/
│   ├── build-meta.mjs         # Fetches Microsoft docs → generates icon-meta.json
│   └── verify-search.mjs      # Search acceptance test suite (10 queries)
├── src/
│   ├── data/
│   │   ├── icon-meta.json     # 1,574 documented icon definitions
│   │   └── synonyms.json      # Designer synonym expansion dictionary
│   ├── font/
│   │   └── access.ts          # queryLocalFonts(), IndexedDB cache, FontFace registration
│   ├── icons/
│   │   └── svg.ts             # opentype.js parser, viewBox math, SVG generation & cache
│   ├── search/
│   │   └── engine.ts          # MiniSearch engine, synonym expansion, custom tags
│   ├── ui/
│   │   ├── grid.ts            # Responsive grid, tile interactions, keyboard navigation
│   │   └── inspector.ts       # Slide-over inspector, multi-format export, custom tags
│   ├── main.ts                # App bootstrap, keyboard routing, state persistence
│   └── style.css              # Pure black (#000) dark theme design system
├── index.html
├── package.json
├── tsconfig.json
├── LICENSE
└── PROGRESS.md                # Development log across all build phases
```

---

## How It Works

1. **Font Loading** — On first visit, the app requests access to `Segoe Fluent Icons` via the Local Font Access API (or accepts a manual `.ttf` upload). The raw font binary is cached in IndexedDB and registered as a `FontFace` for native glyph rendering.

2. **Glyph Discovery** — [opentype.js](https://github.com/opentypejs/opentype.js) parses the font binary and walks the `cmap` table to find every non-empty glyph in the Private Use Area (`U+E000`–`U+F8FF`).

3. **SVG Generation** — Each glyph's vector path is converted to an `<svg>` element with proper `viewBox`, baseline centering using the font's `ascender` / `descender` / `unitsPerEm` metrics, and `fill-rule="nonzero"`. Generated SVGs are cached in memory.

4. **Search & Metadata** — A pre-built metadata file (`icon-meta.json`) maps codepoints to official Microsoft names, tags, and categories. MiniSearch indexes this data with prefix and fuzzy matching, boosted fields, and a curated synonym dictionary for designer-friendly queries.

5. **Copy** — A single left-click writes the SVG markup (or Unicode glyph) to the clipboard via the Clipboard API. Toast feedback confirms the action.

---

## Copyright & Font Disclaimer

This application connects to fonts **legally installed on the user's machine**. No font binaries (`*.ttf`, `*.otf`, `*.woff`, etc.) are distributed, bundled, or committed to this repository. The `.gitignore` explicitly blocks all font file extensions as a guardrail.

Icon metadata (names, categories, tags) is derived from Microsoft's publicly available [Segoe Fluent Icons documentation](https://learn.microsoft.com/windows/apps/design/style/segoe-fluent-icons-font) and the open-source [WinUI Gallery](https://github.com/microsoft/WinUI-Gallery) dataset.

---

## License

[MIT](./LICENSE)
