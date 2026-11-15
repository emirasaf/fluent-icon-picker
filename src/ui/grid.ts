import type opentype from 'opentype.js';
import { getCachedSvg, type GlyphToSvgOptions } from '../icons/svg';
import type { EnrichedGlyph } from '../search/engine';

export interface GridConfig {
  getMode: () => 'SVG' | 'Glyph';
  getSvgOptions: () => GlyphToSvgOptions;
  isFavorite: (hex: string) => boolean;
  onCopy: (name: string, hex: string, mode: 'SVG' | 'Glyph') => void;
  onToggleFavorite: (hex: string) => void;
  onInspect: (glyph: EnrichedGlyph) => void;
}

export class IconGrid {
  private container: HTMLElement;
  private font: opentype.Font;
  private config: GridConfig;
  private currentVisibleGlyphs: EnrichedGlyph[] = [];
  private activeIndex: number = -1;

  constructor(
    container: HTMLElement,
    font: opentype.Font,
    _allGlyphs: EnrichedGlyph[],
    config: GridConfig
  ) {
    this.container = container;
    this.font = font;
    this.config = config;

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Left click handling
    this.container.addEventListener('click', async (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. Favorite button click
      const favBtn = target.closest<HTMLButtonElement>('.tile-fav-btn');
      if (favBtn && favBtn.dataset.hex) {
        e.stopPropagation();
        const hex = favBtn.dataset.hex;
        this.config.onToggleFavorite(hex);
        const isFav = this.config.isFavorite(hex);
        favBtn.classList.toggle('active', isFav);
        favBtn.textContent = isFav ? '★' : '☆';
        favBtn.closest('.icon-tile')?.classList.toggle('is-fav', isFav);
        return;
      }

      // 2. Info / Inspector button click
      const infoBtn = target.closest<HTMLButtonElement>('.tile-info-btn');
      if (infoBtn && infoBtn.dataset.hex) {
        e.stopPropagation();
        const glyph = this.getGlyphByHex(infoBtn.dataset.hex);
        if (glyph) {
          this.config.onInspect(glyph);
        }
        return;
      }

      // 3. Tile body click -> INSTANT COPY
      const tile = target.closest<HTMLElement>('.icon-tile');
      if (!tile) return;

      const hex = tile.dataset.hex;
      if (!hex) return;

      const glyph = this.getGlyphByHex(hex);
      if (!glyph) return;

      // Update active tile index
      const idx = parseInt(tile.dataset.index || '-1', 10);
      if (idx >= 0) {
        this.setActiveIndex(idx, false);
      }

      await this.copyTile(glyph, tile);
    });

    // Right click (contextmenu) -> open Inspector Drawer
    this.container.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tile = target.closest<HTMLElement>('.icon-tile');
      if (!tile || !tile.dataset.hex) return;

      e.preventDefault();
      const glyph = this.getGlyphByHex(tile.dataset.hex);
      if (glyph) {
        const idx = parseInt(tile.dataset.index || '-1', 10);
        if (idx >= 0) {
          this.setActiveIndex(idx, false);
        }
        this.config.onInspect(glyph);
      }
    });
  }

  public async copyTile(glyph: EnrichedGlyph, tileElement?: HTMLElement) {
    const tile =
      tileElement ||
      this.container.querySelector<HTMLElement>(`.icon-tile[data-hex="${glyph.hex}"]`);

    if (tile) {
      tile.classList.add('copied');
      setTimeout(() => tile.classList.remove('copied'), 350);
    }

    const mode = this.config.getMode();

    try {
      if (mode === 'SVG') {
        const svgOptions = this.config.getSvgOptions();
        const svg = getCachedSvg(this.font, glyph.codepoint, svgOptions);
        await navigator.clipboard.writeText(svg);
      } else {
        await navigator.clipboard.writeText(glyph.char);
      }

      this.config.onCopy(glyph.name, glyph.hex, mode);
    } catch (err) {
      console.warn('Clipboard write error:', err);
      this.config.onCopy(glyph.name, glyph.hex, mode);
    }
  }

  public getGlyphByHex(hex: string): EnrichedGlyph | undefined {
    return this.currentVisibleGlyphs.find(g => g.hex.toUpperCase() === hex.toUpperCase());
  }

  public getVisibleGlyphs(): EnrichedGlyph[] {
    return this.currentVisibleGlyphs;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getActiveGlyph(): EnrichedGlyph | null {
    if (this.activeIndex >= 0 && this.activeIndex < this.currentVisibleGlyphs.length) {
      return this.currentVisibleGlyphs[this.activeIndex];
    }
    return null;
  }

  public setActiveIndex(index: number, scrollIntoView: boolean = true) {
    const total = this.currentVisibleGlyphs.length;
    if (total === 0) {
      this.activeIndex = -1;
      return;
    }

    const clamped = Math.max(0, Math.min(total - 1, index));
    this.activeIndex = clamped;

    const tiles = this.container.querySelectorAll<HTMLElement>('.icon-tile');
    tiles.forEach((t, i) => {
      if (i === clamped) {
        t.classList.add('keyboard-active');
        if (scrollIntoView) {
          t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else {
        t.classList.remove('keyboard-active');
      }
    });
  }

  public clearActiveIndex() {
    this.activeIndex = -1;
    this.container.querySelectorAll('.icon-tile.keyboard-active').forEach(t => {
      t.classList.remove('keyboard-active');
    });
  }

  public getGridColumns(): number {
    const tiles = this.container.querySelectorAll<HTMLElement>('.icon-tile');
    if (tiles.length < 2) return 1;

    const firstTop = tiles[0].offsetTop;
    for (let i = 1; i < tiles.length; i++) {
      if (tiles[i].offsetTop > firstTop) {
        return i;
      }
    }
    return tiles.length;
  }

  public render(glyphs: EnrichedGlyph[], emptySearchQuery: string = '') {
    this.currentVisibleGlyphs = glyphs;
    this.activeIndex = -1;

    if (glyphs.length === 0) {
      const cleaned = emptySearchQuery.trim();
      this.container.innerHTML = `
        <div class="empty-grid-state">
          <div class="empty-icon">∅</div>
          <div class="empty-title">No icons found</div>
          <div class="empty-desc">
            ${
              cleaned
                ? `No glyphs match "<strong>${escapeHtml(cleaned)}</strong>" in the selected filter.`
                : 'No glyphs match the selected filter.'
            }
          </div>
          ${
            cleaned
              ? `<button id="clear-search-btn" class="button secondary" style="margin-top: 0.75rem;">Clear search (Esc)</button>`
              : ''
          }
        </div>
      `;

      const clearBtn = this.container.querySelector<HTMLButtonElement>('#clear-search-btn');
      clearBtn?.addEventListener('click', () => {
        const searchInput = document.querySelector<HTMLInputElement>('#search-input');
        if (searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
          searchInput.focus();
        }
      });
      return;
    }

    const mode = this.config.getMode();

    // High performance HTML string assembly
    const html = glyphs
      .map((g, index) => {
        const isFav = this.config.isFavorite(g.hex);
        return `
          <div
            class="icon-tile ${isFav ? 'is-fav' : ''}"
            data-codepoint="${g.codepoint}"
            data-hex="${g.hex}"
            data-index="${index}"
            tabindex="-1"
            title="${escapeHtml(g.name)} (0x${g.hex}) · Click to copy ${mode}">
            
            <button
              class="tile-fav-btn ${isFav ? 'active' : ''}"
              data-hex="${g.hex}"
              tabindex="-1"
              title="${isFav ? 'Remove favorite' : 'Add favorite'}">
              ${isFav ? '★' : '☆'}
            </button>

            <button
              class="tile-info-btn"
              data-hex="${g.hex}"
              tabindex="-1"
              title="Inspect details (i)">
              ⓘ
            </button>

            <span class="tile-glyph">${g.char}</span>
            <span class="tile-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
            <span class="tile-hex">${g.hex}</span>
          </div>
        `;
      })
      .join('');

    this.container.innerHTML = html;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
