import type opentype from 'opentype.js';
import { getCachedSvg, type GlyphToSvgOptions } from '../icons/svg';
import type { EnrichedGlyph } from '../search/engine';

export interface InspectorConfig {
  getSvgOptions: () => GlyphToSvgOptions;
  isFavorite: (hex: string) => boolean;
  onToggleFavorite: (hex: string) => void;
  onTagClick: (tag: string) => void;
  onAddCustomTag: (hex: string, tag: string) => void;
  onRemoveCustomTag: (hex: string, tag: string) => void;
  onCopySuccess: (message: string) => void;
}

export class InspectorDrawer {
  private drawerElement: HTMLElement;
  private font: opentype.Font;
  private config: InspectorConfig;
  private currentGlyph: EnrichedGlyph | null = null;
  private previewTheme: 'dark' | 'light' = 'dark';
  private isOpen: boolean = false;

  constructor(drawerElement: HTMLElement, font: opentype.Font, config: InspectorConfig) {
    this.drawerElement = drawerElement;
    this.font = font;
    this.config = config;

    this.setupListeners();
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public getCurrentGlyph(): EnrichedGlyph | null {
    return this.currentGlyph;
  }

  public open(glyph: EnrichedGlyph) {
    this.currentGlyph = glyph;
    this.isOpen = true;
    this.drawerElement.classList.add('open');
    document.body.classList.add('inspector-open');
    this.render();
  }

  public close() {
    this.isOpen = false;
    this.drawerElement.classList.remove('open');
    document.body.classList.remove('inspector-open');
  }

  public toggle(glyph: EnrichedGlyph) {
    if (this.isOpen && this.currentGlyph?.hex === glyph.hex) {
      this.close();
    } else {
      this.open(glyph);
    }
  }

  public refresh() {
    if (this.isOpen && this.currentGlyph) {
      this.render();
    }
  }

  private setupListeners() {
    this.drawerElement.addEventListener('click', async (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Close button
      if (target.closest('.inspector-close-btn')) {
        this.close();
        return;
      }

      if (!this.currentGlyph) return;

      // Favorite toggle
      if (target.closest('.inspector-fav-btn')) {
        this.config.onToggleFavorite(this.currentGlyph.hex);
        this.render();
        return;
      }

      // Preview theme toggle
      if (target.closest('.preview-theme-toggle')) {
        this.previewTheme = this.previewTheme === 'dark' ? 'light' : 'dark';
        this.render();
        return;
      }

      // Tag chip click
      const tagChip = target.closest<HTMLButtonElement>('.tag-chip:not(.custom-tag-chip)');
      if (tagChip && tagChip.dataset.tag) {
        this.config.onTagClick(tagChip.dataset.tag);
        return;
      }

      // Remove custom tag
      const removeCustomBtn = target.closest<HTMLButtonElement>('.remove-custom-tag');
      if (removeCustomBtn && removeCustomBtn.dataset.tag) {
        const tag = removeCustomBtn.dataset.tag;
        this.config.onRemoveCustomTag(this.currentGlyph.hex, tag);
        this.render();
        return;
      }

      // Copy Action buttons
      const copyBtn = target.closest<HTMLButtonElement>('.action-btn');
      if (copyBtn && copyBtn.dataset.action) {
        const action = copyBtn.dataset.action;
        await this.handleAction(action);
      }
    });

    // Custom Tag Form Submit
    this.drawerElement.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      if (!this.currentGlyph) return;

      const input = this.drawerElement.querySelector<HTMLInputElement>('#custom-tag-input');
      if (!input) return;

      const tag = input.value.trim();
      if (tag) {
        this.config.onAddCustomTag(this.currentGlyph.hex, tag);
        input.value = '';
        this.render();
      }
    });
  }

  private async handleAction(action: string) {
    if (!this.currentGlyph) return;
    const g = this.currentGlyph;
    const svgOptions = this.config.getSvgOptions();
    const svg = getCachedSvg(this.font, g.codepoint, svgOptions);

    switch (action) {
      case 'svg':
        await navigator.clipboard.writeText(svg);
        this.config.onCopySuccess(`Copied ${g.name} · SVG`);
        break;

      case 'glyph':
        await navigator.clipboard.writeText(g.char);
        this.config.onCopySuccess(`Copied ${g.name} · Glyph (${g.char})`);
        break;

      case 'hex':
        await navigator.clipboard.writeText(g.hex);
        this.config.onCopySuccess(`Copied Hex · ${g.hex}`);
        break;

      case 'xaml':
        const xaml = `&#x${g.hex};`;
        await navigator.clipboard.writeText(xaml);
        this.config.onCopySuccess(`Copied XAML · ${xaml}`);
        break;

      case 'download':
        downloadSvgFile(`${g.name || g.hex}.svg`, svg);
        this.config.onCopySuccess(`Downloaded ${g.name || g.hex}.svg`);
        break;
    }
  }

  public render() {
    if (!this.currentGlyph) return;

    const g = this.currentGlyph;
    const svgOptions = this.config.getSvgOptions();
    const svg = getCachedSvg(this.font, g.codepoint, svgOptions);
    const isFav = this.config.isFavorite(g.hex);

    const isLightCanvas = this.previewTheme === 'light';

    this.drawerElement.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-title-wrap">
          <span class="inspector-title">Icon Details</span>
          <button class="inspector-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from favorites (f)' : 'Add to favorites (f)'}">
            ${isFav ? '★' : '☆'}
          </button>
        </div>
        <button class="inspector-close-btn" title="Close inspector (Esc)">✕</button>
      </div>

      <div class="inspector-body">
        <!-- Large Vector Preview -->
        <div class="inspector-preview-section">
          <div class="inspector-preview-box ${isLightCanvas ? 'light-canvas' : 'dark-canvas'}">
            <div class="preview-svg-wrapper">
              ${svg}
            </div>
            <button class="preview-theme-toggle" title="Toggle preview surface (Light / Dark)">
              ${isLightCanvas ? 'Dark Canvas' : 'Light Canvas'}
            </button>
          </div>
        </div>

        <!-- Metadata Section -->
        <div class="inspector-section">
          <h2 class="inspector-icon-name">${escapeHtml(g.name)}</h2>
          <div class="inspector-meta-row">
            <span class="meta-tag"><strong>Unicode:</strong> U+${g.hex}</span>
            <span class="meta-tag"><strong>Dec:</strong> ${g.codepoint}</span>
          </div>
          <div class="category-badges-row">
            ${g.categories
              .map(
                cat => `<span class="category-badge">${escapeHtml(cat)}</span>`
              )
              .join('')}
            ${g.isLegacy ? `<span class="category-badge legacy">legacy</span>` : ''}
          </div>
        </div>

        <!-- Multi-Format Copy Actions -->
        <div class="inspector-section">
          <div class="section-label">Quick Copy & Download</div>
          <div class="actions-grid">
            <button class="action-btn primary" data-action="svg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy SVG
            </button>
            <button class="action-btn" data-action="glyph">
              Copy Glyph (${escapeHtml(g.char)})
            </button>
            <button class="action-btn" data-action="hex">
              Copy Hex (${g.hex})
            </button>
            <button class="action-btn" data-action="xaml">
              Copy XAML (&amp;#x${g.hex};)
            </button>
            <button class="action-btn full-width" data-action="download">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download .svg File
            </button>
          </div>
        </div>

        <!-- Tags & Synonyms -->
        <div class="inspector-section">
          <div class="section-label">Tags &amp; Keywords</div>
          <div class="tag-chips-wrap">
            ${g.tags
              .filter(t => !g.customTags.includes(t))
              .map(
                t =>
                  `<button class="tag-chip" data-tag="${escapeHtml(t)}" title="Filter by tag">${escapeHtml(t)}</button>`
              )
              .join('')}
            ${g.customTags
              .map(
                ct =>
                  `<span class="tag-chip custom-tag-chip" title="Custom user tag">
                    <span>${escapeHtml(ct)}</span>
                    <button class="remove-custom-tag" data-tag="${escapeHtml(ct)}" title="Remove custom tag">✕</button>
                  </span>`
              )
              .join('')}
          </div>

          <!-- Add Custom Tag Form -->
          <form class="custom-tag-form" style="margin-top: 0.65rem;">
            <input
              type="text"
              id="custom-tag-input"
              class="custom-tag-input"
              placeholder="+ Add custom tag (Enter)..."
              autocomplete="off"
            />
            <button type="submit" class="custom-tag-add-btn">Add</button>
          </form>
        </div>

        <!-- Raw SVG Monospace Code Box -->
        <div class="inspector-section">
          <div class="section-label" style="display: flex; justify-content: space-between; align-items: center;">
            <span>Generated SVG Code</span>
            <button class="action-btn mini-copy-btn" data-action="svg" title="Copy SVG code">Copy</button>
          </div>
          <pre class="inspector-code-box">${escapeHtml(svg)}</pre>
        </div>
      </div>
    `;
  }
}

function downloadSvgFile(filename: string, svgContent: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
