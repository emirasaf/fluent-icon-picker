import './style.css';
import {
  loadSystemFont,
  loadFontFromFile,
  loadFontFromDB,
  clearFontFromDB,
  registerFontFace,
  isQueryLocalFontsSupported,
} from './font/access';
import {
  parseAndAnalyzeFont,
  type FontMetrics,
  type GlyphToSvgOptions,
} from './icons/svg';
import { IconGrid } from './ui/grid';
import { SearchEngine, type EnrichedGlyph } from './search/engine';
import { InspectorDrawer } from './ui/inspector';
import type opentype from 'opentype.js';

// LocalStorage Keys
const STORAGE_KEYS = {
  MODE: 'fluent-picker:mode',
  SVG_SIZE: 'fluent-picker:svg-size',
  BOUNDING_MODE: 'fluent-picker:bounding-mode',
  SVG_COLOR: 'fluent-picker:svg-color',
  SHOW_LEGACY: 'fluent-picker:show-legacy',
  CATEGORY: 'fluent-picker:category',
  FAVORITES: 'fluent-picker:favorites',
  RECENTS: 'fluent-picker:recents',
  CUSTOM_TAGS: 'fluent-picker:custom-tags',
};

// Base Category taxonomy
const BASE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'media-controls', label: 'Media' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'system', label: 'System' },
  { id: 'editing', label: 'Editing' },
  { id: 'files-folders', label: 'Files' },
  { id: 'communication', label: 'Communication' },
  { id: 'devices', label: 'Devices' },
  { id: 'connectivity', label: 'Connectivity' },
  { id: 'windows-ui', label: 'Windows UI' },
  { id: 'security', label: 'Security' },
  { id: 'text-format', label: 'Text' },
  { id: 'time-calendar', label: 'Time' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'accessibility', label: 'Accessibility' },
];

// Application State
let loadedFont: opentype.Font | null = null;
let currentMetrics: FontMetrics | null = null;
let searchEngine: SearchEngine | null = null;
let gridInstance: IconGrid | null = null;
let inspectorInstance: InspectorDrawer | null = null;
let toastTimeout: number | undefined;

// Settings State with LocalStorage Persistence
let currentMode: 'SVG' | 'Glyph' =
  (localStorage.getItem(STORAGE_KEYS.MODE) as 'SVG' | 'Glyph') || 'SVG';

let currentSvgSize: number =
  parseInt(localStorage.getItem(STORAGE_KEYS.SVG_SIZE) || '24', 10);

let currentBoundingMode: 'em' | 'tight' =
  (localStorage.getItem(STORAGE_KEYS.BOUNDING_MODE) as 'em' | 'tight') || 'em';

let currentSvgColor: string =
  localStorage.getItem(STORAGE_KEYS.SVG_COLOR) || '#000000';

let showLegacy: boolean =
  localStorage.getItem(STORAGE_KEYS.SHOW_LEGACY) === 'true';

let currentCategory: string =
  localStorage.getItem(STORAGE_KEYS.CATEGORY) || 'all';

// Favorites & Recents Collections
let favoritesSet: Set<string> = new Set(
  JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || '[]')
);

let recentsList: string[] = JSON.parse(
  localStorage.getItem(STORAGE_KEYS.RECENTS) || '[]'
);

let customTagsMap: Record<string, string[]> = JSON.parse(
  localStorage.getItem(STORAGE_KEYS.CUSTOM_TAGS) || '{}'
);

// Root HTML Structure
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <!-- Onboarding Card (shown when font is not loaded) -->
  <div id="onboarding-view" class="onboarding-container" style="display: none;">
    <div class="onboarding-card">
      <div class="onboarding-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      </div>
      <div>
        <h1 class="onboarding-title">Fluent Icon Picker</h1>
        <p class="onboarding-desc">
          Read your OS-installed <code>Segoe Fluent Icons</code> font, browse all 2,000+ glyphs, and copy clean Figma-ready SVG code or Unicode text with one click.
        </p>
      </div>

      <div id="onboarding-banner" class="status-banner"></div>

      <div class="onboarding-actions">
        <button id="connect-system-btn" class="button primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Connect System Font
        </button>

        <div class="file-input-wrapper">
          <button class="button secondary" style="width: 100%;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Or Choose Local Font (.ttf/.otf)
          </button>
          <input type="file" id="onboarding-file-input" accept=".ttf,.otf" />
        </div>
      </div>
    </div>
  </div>

  <!-- Main Application View (shown when font is ready) -->
  <div id="main-view" style="display: none;">
    <!-- Sticky Top Bar -->
    <header class="sticky-header">
      <div class="header-top-row">
        <div class="brand-section">
          <span class="brand-title">Fluent Icon Picker</span>
          <span id="counter-badge" class="counter-badge">Loading...</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button id="shortcuts-help-btn" class="button secondary" style="padding: 0.25rem 0.55rem; font-size: 0.8rem; font-family: var(--font-mono);" title="Keyboard Shortcuts (?)">
            ?
          </button>
          <button id="clear-cache-btn" class="button secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" title="Reset cached font buffer">
            Reset Font
          </button>
        </div>
      </div>

      <div class="header-controls-row">
        <!-- Search Input with / shortcut and Esc clear -->
        <div class="search-wrapper">
          <span class="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            id="search-input"
            class="search-input"
            placeholder="Search icons, keywords or hex... [/]"
            autocomplete="off"
            spellcheck="false"
          />
          <span id="search-shortcut" class="search-shortcut-badge">/</span>
          <button id="search-clear-btn" class="search-clear-btn" title="Clear (Esc)">✕</button>
        </div>

        <!-- Segmented Control: SVG | Glyph -->
        <div class="segmented-control" id="mode-segment">
          <button class="segment-btn active" data-mode="SVG">SVG</button>
          <button class="segment-btn" data-mode="Glyph">Glyph</button>
        </div>

        <!-- SVG Controls Group -->
        <div id="svg-controls-group" class="svg-controls-group">
          <!-- Size Preset Dropdown -->
          <div class="control-item">
            <select id="svg-size-select" class="select-dropdown" title="SVG Export Dimension">
              <option value="16">16px</option>
              <option value="20">20px</option>
              <option value="24" selected>24px</option>
              <option value="32">32px</option>
              <option value="40">40px</option>
              <option value="48">48px</option>
              <option value="64">64px</option>
            </select>
          </div>

          <!-- Bounding Mode Segment: Em Box | Tight Crop -->
          <div class="segmented-control" id="bounding-segment">
            <button class="segment-btn active" data-bounding="em" title="Standard Em Box canvas">Em Box</button>
            <button class="segment-btn" data-bounding="tight" title="Tight bounding box crop">Tight</button>
          </div>

          <!-- Fill Color Picker -->
          <div class="color-picker-wrapper" title="SVG Fill Color">
            <input type="color" id="svg-color-input" class="color-input" value="#000000" />
            <span id="svg-color-label" class="color-hex-label">#000000</span>
          </div>
        </div>

        <!-- Legacy Filter Toggle: E000-E5FF -->
        <label class="toggle-wrapper" title="Show legacy glyphs in 0xE000–0xE5FF">
          <input type="checkbox" id="legacy-toggle" class="toggle-input" />
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
          <span class="toggle-label">Show Legacy (E000–E5FF)</span>
        </label>
      </div>

      <!-- Category Filter Pills Bar (with Favorites & Recents at front) -->
      <nav id="category-bar" class="category-filter-bar" aria-label="Category Filter"></nav>
    </header>

    <!-- High-Performance Icon Grid Container -->
    <main id="icon-grid" class="grid-container"></main>

    <!-- Right-Hand Inspector Drawer -->
    <aside id="inspector-drawer" class="inspector-drawer" aria-label="Icon Inspector"></aside>
  </div>

  <!-- Shortcuts Dialog Overlay -->
  <div id="shortcuts-modal" class="shortcuts-modal-overlay">
    <div class="shortcuts-modal-card">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-weight: 600; font-size: 1rem;">Keyboard Shortcuts</span>
        <button id="shortcuts-close-btn" class="button secondary" style="padding: 0.2rem 0.5rem;">✕</button>
      </div>
      <table class="shortcuts-table">
        <tbody>
          <tr>
            <td><kbd class="shortcut-kbd">/</kbd></td>
            <td>Focus search input from anywhere</td>
          </tr>
          <tr>
            <td><kbd class="shortcut-kbd">Esc</kbd></td>
            <td>Close inspector drawer or clear search</td>
          </tr>
          <tr>
            <td><kbd class="shortcut-kbd">Arrow Keys</kbd></td>
            <td>Navigate grid tiles smoothly across rows &amp; columns</td>
          </tr>
          <tr>
            <td><kbd class="shortcut-kbd">Enter</kbd></td>
            <td>Copy currently active icon tile</td>
          </tr>
          <tr>
            <td><kbd class="shortcut-kbd">f</kbd></td>
            <td>Toggle favorite on focused icon tile</td>
          </tr>
          <tr>
            <td><kbd class="shortcut-kbd">i</kbd></td>
            <td>Open / close Inspector Drawer for focused icon</td>
          </tr>
          <tr>
            <td><kbd class="shortcut-kbd">Alt</kbd> + <kbd class="shortcut-kbd">M</kbd></td>
            <td>Toggle between SVG and Glyph copy mode</td>
          </tr>
          <tr>
            <td><kbd class="shortcut-kbd">Right Click</kbd></td>
            <td>Open Inspector Drawer for clicked tile</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Bottom-Right Non-Blocking Toast -->
  <div id="toast" class="copy-toast">
    <div class="toast-dot"></div>
    <span id="toast-text">Copied to clipboard</span>
  </div>
`;

// Element References
const onboardingView = document.querySelector<HTMLDivElement>('#onboarding-view')!;
const onboardingBanner = document.querySelector<HTMLDivElement>('#onboarding-banner')!;
const connectSystemBtn = document.querySelector<HTMLButtonElement>('#connect-system-btn')!;
const onboardingFileInput = document.querySelector<HTMLInputElement>('#onboarding-file-input')!;

const mainView = document.querySelector<HTMLDivElement>('#main-view')!;
const counterBadge = document.querySelector<HTMLSpanElement>('#counter-badge')!;
const clearCacheBtn = document.querySelector<HTMLButtonElement>('#clear-cache-btn')!;
const shortcutsHelpBtn = document.querySelector<HTMLButtonElement>('#shortcuts-help-btn')!;
const shortcutsModal = document.querySelector<HTMLDivElement>('#shortcuts-modal')!;
const shortcutsCloseBtn = document.querySelector<HTMLButtonElement>('#shortcuts-close-btn')!;

const searchInput = document.querySelector<HTMLInputElement>('#search-input')!;
const searchShortcut = document.querySelector<HTMLSpanElement>('#search-shortcut')!;
const searchClearBtn = document.querySelector<HTMLButtonElement>('#search-clear-btn')!;

const modeSegment = document.querySelector<HTMLDivElement>('#mode-segment')!;
const svgControlsGroup = document.querySelector<HTMLDivElement>('#svg-controls-group')!;
const svgSizeSelect = document.querySelector<HTMLSelectElement>('#svg-size-select')!;
const boundingSegment = document.querySelector<HTMLDivElement>('#bounding-segment')!;
const svgColorInput = document.querySelector<HTMLInputElement>('#svg-color-input')!;
const svgColorLabel = document.querySelector<HTMLSpanElement>('#svg-color-label')!;
const legacyToggle = document.querySelector<HTMLInputElement>('#legacy-toggle')!;
const categoryBar = document.querySelector<HTMLElement>('#category-bar')!;

const iconGridContainer = document.querySelector<HTMLElement>('#icon-grid')!;
const inspectorDrawerElement = document.querySelector<HTMLElement>('#inspector-drawer')!;
const toast = document.querySelector<HTMLDivElement>('#toast')!;
const toastText = document.querySelector<HTMLSpanElement>('#toast-text')!;

function saveFavorites() {
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(favoritesSet)));
  renderCategoryBar();
}

function saveRecents() {
  localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(recentsList));
  renderCategoryBar();
}

function saveCustomTags() {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_TAGS, JSON.stringify(customTagsMap));
}

function addRecent(hex: string) {
  const upper = hex.toUpperCase();
  recentsList = [upper, ...recentsList.filter(h => h !== upper)].slice(0, 24);
  saveRecents();
}

function toggleFavorite(hex: string): boolean {
  const upper = hex.toUpperCase();
  if (favoritesSet.has(upper)) {
    favoritesSet.delete(upper);
  } else {
    favoritesSet.add(upper);
  }
  saveFavorites();
  return favoritesSet.has(upper);
}

function isFavorite(hex: string): boolean {
  return favoritesSet.has(hex.toUpperCase());
}

interface CategoryItem {
  id: string;
  label: string;
  special?: boolean;
}

function renderCategoryBar() {
  const favCount = favoritesSet.size;
  const recentCount = recentsList.length;

  const categories: CategoryItem[] = [
    {
      id: 'favorites',
      label: `★ Favorites${favCount > 0 ? ` (${favCount})` : ''}`,
      special: true,
    },
    {
      id: 'recent',
      label: `Recent${recentCount > 0 ? ` (${recentCount})` : ''}`,
      special: true,
    },
    ...BASE_CATEGORIES,
  ];

  categoryBar.innerHTML = categories
    .map(
      cat => `
      <button
        class="category-pill ${cat.special ? 'special-pill' : ''} ${cat.id === currentCategory ? 'active' : ''}"
        data-category="${cat.id}">
        ${cat.label}
      </button>
    `
    )
    .join('');
}

function syncControlsWithState() {
  modeSegment.querySelectorAll<HTMLButtonElement>('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });
  svgControlsGroup.classList.toggle('disabled', currentMode === 'Glyph');

  svgSizeSelect.value = currentSvgSize.toString();

  boundingSegment.querySelectorAll<HTMLButtonElement>('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bounding === currentBoundingMode);
  });

  svgColorInput.value = currentSvgColor;
  svgColorLabel.textContent = currentSvgColor.toUpperCase();

  legacyToggle.checked = showLegacy;

  renderCategoryBar();
}

function showToast(message: string) {
  toastText.textContent = message;
  toast.classList.add('visible');

  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('visible');
  }, 2000);
}

function showOnboardingBanner(message: string, type: 'error' | 'info') {
  onboardingBanner.textContent = message;
  onboardingBanner.className = `status-banner show ${type}`;
}

function getSvgOptions(): GlyphToSvgOptions {
  return {
    size: currentSvgSize,
    color: currentSvgColor,
    mode: currentBoundingMode,
  };
}

function performSearch() {
  if (!searchEngine || !gridInstance) return;

  const query = searchInput.value;
  const results = searchEngine.search({
    query,
    category: currentCategory,
    showLegacy,
    favorites: favoritesSet,
    recents: recentsList,
  });

  gridInstance.render(results, query);

  const baseTotal = showLegacy
    ? currentMetrics?.puaCount || 2033
    : currentMetrics?.modernCount || 1628;

  const isFiltering =
    query.trim().length > 0 || currentCategory !== 'all';

  if (isFiltering) {
    counterBadge.textContent = `${results.length.toLocaleString()} / ${baseTotal.toLocaleString()} icons`;
    counterBadge.classList.add('highlight');
  } else {
    counterBadge.textContent = `${results.length.toLocaleString()} icons`;
    counterBadge.classList.remove('highlight');
  }

  inspectorInstance?.refresh();
}

async function bootWithFontBuffer(buffer: ArrayBuffer) {
  try {
    await registerFontFace(buffer, 'Segoe Fluent Icons');

    const { font, metrics } = parseAndAnalyzeFont(buffer);
    loadedFont = font;
    currentMetrics = metrics;

    // Initialize Smart Search Engine with custom tags
    searchEngine = new SearchEngine(metrics.glyphs, customTagsMap);

    // Switch view
    onboardingView.style.display = 'none';
    mainView.style.display = 'block';

    // Initialize Inspector Drawer
    inspectorInstance = new InspectorDrawer(inspectorDrawerElement, loadedFont, {
      getSvgOptions,
      isFavorite,
      onToggleFavorite: (hex: string) => {
        toggleFavorite(hex);
        gridInstance?.render(
          searchEngine!.search({
            query: searchInput.value,
            category: currentCategory,
            showLegacy,
            favorites: favoritesSet,
            recents: recentsList,
          }),
          searchInput.value
        );
      },
      onTagClick: (tag: string) => {
        searchInput.value = tag;
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      },
      onAddCustomTag: (hex: string, tag: string) => {
        searchEngine?.addCustomTag(hex, tag);
        customTagsMap = searchEngine ? searchEngine.getAllCustomTags() : {};
        saveCustomTags();
        performSearch();
        showToast(`Added tag "${tag}" to ${hex}`);
      },
      onRemoveCustomTag: (hex: string, tag: string) => {
        searchEngine?.removeCustomTag(hex, tag);
        customTagsMap = searchEngine ? searchEngine.getAllCustomTags() : {};
        saveCustomTags();
        performSearch();
        showToast(`Removed tag "${tag}" from ${hex}`);
      },
      onCopySuccess: (message: string) => {
        if (inspectorInstance?.getCurrentGlyph()) {
          addRecent(inspectorInstance.getCurrentGlyph()!.hex);
        }
        showToast(message);
      },
    });

    // Initialize Grid
    gridInstance = new IconGrid(iconGridContainer, loadedFont, searchEngine.getAllGlyphs(), {
      getMode: () => currentMode,
      getSvgOptions,
      isFavorite,
      onCopy: (name: string, hex: string, mode: 'SVG' | 'Glyph') => {
        addRecent(hex);
        showToast(`Copied ${name} (${hex}) · ${mode}`);
      },
      onToggleFavorite: (hex: string) => {
        toggleFavorite(hex);
        inspectorInstance?.refresh();
      },
      onInspect: (glyph: EnrichedGlyph) => {
        inspectorInstance?.open(glyph);
      },
    });

    // Initial render
    performSearch();

    // Auto-focus search input
    setTimeout(() => {
      searchInput.focus();
    }, 50);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to boot font:', error);
    onboardingView.style.display = 'flex';
    mainView.style.display = 'none';
    showOnboardingBanner(`Failed to load font: ${error.message}`, 'error');
  }
}

async function init() {
  syncControlsWithState();

  if (!isQueryLocalFontsSupported()) {
    showOnboardingBanner(
      'Notice: Local Font Access API (window.queryLocalFonts) is restricted or not supported in this browser. Please use "Choose Local Font" to select SegoeIcons.ttf (typically in C:\\Windows\\Fonts\\SegoeIcons.ttf).',
      'info'
    );
  }

  try {
    const cachedBuffer = await loadFontFromDB();
    if (cachedBuffer) {
      await bootWithFontBuffer(cachedBuffer);
      return;
    }
  } catch (err) {
    console.warn('IndexedDB check failed:', err);
  }

  onboardingView.style.display = 'flex';
  mainView.style.display = 'none';
}

// Onboarding Event Listeners
connectSystemBtn.addEventListener('click', async () => {
  connectSystemBtn.disabled = true;
  connectSystemBtn.textContent = 'Connecting...';

  try {
    const buffer = await loadSystemFont();
    await bootWithFontBuffer(buffer);
  } catch (err: unknown) {
    const error = err as Error;
    showOnboardingBanner(error.message, 'error');
  } finally {
    connectSystemBtn.disabled = false;
    connectSystemBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
      Connect System Font
    `;
  }
});

onboardingFileInput.addEventListener('change', async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const buffer = await loadFontFromFile(file);
    await bootWithFontBuffer(buffer);
  } catch (err: unknown) {
    const error = err as Error;
    showOnboardingBanner(error.message, 'error');
  }
});

clearCacheBtn.addEventListener('click', async () => {
  await clearFontFromDB();
  window.location.reload();
});

// Shortcuts Help Modal
shortcutsHelpBtn.addEventListener('click', () => {
  shortcutsModal.classList.add('open');
});

shortcutsCloseBtn.addEventListener('click', () => {
  shortcutsModal.classList.remove('open');
});

shortcutsModal.addEventListener('click', (e: MouseEvent) => {
  if (e.target === shortcutsModal) {
    shortcutsModal.classList.remove('open');
  }
});

// Search input handling
searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  const hasText = query.length > 0;
  searchClearBtn.classList.toggle('visible', hasText);
  searchShortcut.style.display = hasText ? 'none' : 'block';

  performSearch();
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchClearBtn.classList.remove('visible');
  searchShortcut.style.display = 'block';
  performSearch();
  searchInput.focus();
});

// Global Shortcuts & Full Keyboard Navigation
window.addEventListener('keydown', (e: KeyboardEvent) => {
  const activeElement = document.activeElement;
  const isInputFocused =
    activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

  // 1. Esc: close modal/inspector or clear search
  if (e.key === 'Escape') {
    if (shortcutsModal.classList.contains('open')) {
      shortcutsModal.classList.remove('open');
      return;
    }
    if (inspectorInstance?.getIsOpen()) {
      inspectorInstance.close();
      return;
    }
    if (searchInput.value) {
      searchInput.value = '';
      searchClearBtn.classList.remove('visible');
      searchShortcut.style.display = 'block';
      performSearch();
      searchInput.focus();
      return;
    }
    return;
  }

  // 2. Alt + M: toggle SVG / Glyph mode from anywhere
  if (e.altKey && (e.key === 'm' || e.key === 'M')) {
    e.preventDefault();
    currentMode = currentMode === 'SVG' ? 'Glyph' : 'SVG';
    localStorage.setItem(STORAGE_KEYS.MODE, currentMode);
    syncControlsWithState();
    showToast(`Mode: ${currentMode}`);
    return;
  }

  // 3. '?' (Shift + /): show keyboard shortcuts
  if (e.key === '?' && !isInputFocused) {
    e.preventDefault();
    shortcutsModal.classList.toggle('open');
    return;
  }

  // 4. '/' key: focus search input
  if (e.key === '/' && !isInputFocused) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  // 5. Grid Keyboard Navigation
  if (!gridInstance) return;
  const visibleGlyphs = gridInstance.getVisibleGlyphs();
  if (visibleGlyphs.length === 0) return;

  // ArrowDown from search bar moves focus to grid
  if (isInputFocused && activeElement === searchInput && e.key === 'ArrowDown') {
    e.preventDefault();
    searchInput.blur();
    gridInstance.setActiveIndex(0);
    return;
  }

  // Keyboard navigation when not typing in an input
  if (!isInputFocused) {
    const currentIndex = gridInstance.getActiveIndex();
    const cols = gridInstance.getGridColumns();

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = currentIndex < 0 ? 0 : currentIndex + 1;
      gridInstance.setActiveIndex(next);
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = currentIndex <= 0 ? 0 : currentIndex - 1;
      gridInstance.setActiveIndex(prev);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIndex < 0 ? 0 : currentIndex + cols;
      gridInstance.setActiveIndex(next);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex - cols < 0) {
        gridInstance.clearActiveIndex();
        searchInput.focus();
      } else {
        gridInstance.setActiveIndex(currentIndex - cols);
      }
      return;
    }

    // Enter: copy active tile
    if (e.key === 'Enter') {
      const activeGlyph = gridInstance.getActiveGlyph();
      if (activeGlyph) {
        e.preventDefault();
        gridInstance.copyTile(activeGlyph);
      }
      return;
    }

    // 'f': toggle favorite on active tile
    if (e.key === 'f' || e.key === 'F') {
      const activeGlyph = gridInstance.getActiveGlyph();
      if (activeGlyph) {
        e.preventDefault();
        const isFav = toggleFavorite(activeGlyph.hex);
        performSearch();
        inspectorInstance?.refresh();
        showToast(isFav ? `Added ${activeGlyph.name} to Favorites` : `Removed ${activeGlyph.name} from Favorites`);
      }
      return;
    }

    // 'i': open/close inspector for active tile
    if (e.key === 'i' || e.key === 'I') {
      const activeGlyph = gridInstance.getActiveGlyph();
      if (activeGlyph) {
        e.preventDefault();
        inspectorInstance?.toggle(activeGlyph);
      }
      return;
    }
  }
});

// Category Filter Bar Pills
categoryBar.addEventListener('click', (e: MouseEvent) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.category-pill');
  if (!btn || !btn.dataset.category) return;

  currentCategory = btn.dataset.category;
  localStorage.setItem(STORAGE_KEYS.CATEGORY, currentCategory);

  categoryBar.querySelectorAll<HTMLButtonElement>('.category-pill').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  performSearch();
});

// Segmented Mode (SVG | Glyph)
modeSegment.addEventListener('click', (e: MouseEvent) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.segment-btn');
  if (!btn || !btn.dataset.mode) return;

  currentMode = btn.dataset.mode as 'SVG' | 'Glyph';
  localStorage.setItem(STORAGE_KEYS.MODE, currentMode);

  modeSegment.querySelectorAll<HTMLButtonElement>('.segment-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  svgControlsGroup.classList.toggle('disabled', currentMode === 'Glyph');
  showToast(`Mode: ${currentMode}`);
});

// SVG Size
svgSizeSelect.addEventListener('change', () => {
  currentSvgSize = parseInt(svgSizeSelect.value, 10) || 24;
  localStorage.setItem(STORAGE_KEYS.SVG_SIZE, currentSvgSize.toString());
  inspectorInstance?.refresh();
  showToast(`SVG Size: ${currentSvgSize}px`);
});

// Bounding Mode (Em Box | Tight Crop)
boundingSegment.addEventListener('click', (e: MouseEvent) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.segment-btn');
  if (!btn || !btn.dataset.bounding) return;

  currentBoundingMode = btn.dataset.bounding as 'em' | 'tight';
  localStorage.setItem(STORAGE_KEYS.BOUNDING_MODE, currentBoundingMode);

  boundingSegment.querySelectorAll<HTMLButtonElement>('.segment-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  inspectorInstance?.refresh();
  showToast(`Bounding: ${currentBoundingMode === 'em' ? 'Em Box' : 'Tight Crop'}`);
});

// SVG Color
svgColorInput.addEventListener('input', () => {
  currentSvgColor = svgColorInput.value;
  svgColorLabel.textContent = currentSvgColor.toUpperCase();
  localStorage.setItem(STORAGE_KEYS.SVG_COLOR, currentSvgColor);
  inspectorInstance?.refresh();
});

// Legacy Toggle
legacyToggle.addEventListener('change', () => {
  showLegacy = legacyToggle.checked;
  localStorage.setItem(STORAGE_KEYS.SHOW_LEGACY, showLegacy ? 'true' : 'false');
  performSearch();
  showToast(showLegacy ? 'Legacy Glyphs Included (2,033)' : 'Modern Glyphs Only (1,628)');
});

// Boot
init();
