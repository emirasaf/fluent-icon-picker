import MiniSearch from 'minisearch';
import rawMeta from '../data/icon-meta.json';
import rawSynonyms from '../data/synonyms.json';
import type { IconGlyph } from '../icons/svg';

export interface EnrichedGlyph extends IconGlyph {
  name: string;
  words: string[];
  categories: string[];
  tags: string[];
  customTags: string[];
  isDocumented: boolean;
}

export interface SearchFilterOptions {
  query: string;
  category: string; // 'all', 'favorites', 'recent', or a category id like 'media-controls'
  showLegacy: boolean;
  favorites?: Set<string>;
  recents?: string[];
}

interface MiniSearchDoc {
  id: string;
  hex: string;
  name: string;
  words: string;
  categories: string;
  tags: string;
}

export class SearchEngine {
  private miniSearch: MiniSearch<MiniSearchDoc>;
  private glyphMap: Map<string, EnrichedGlyph> = new Map();
  private allGlyphs: EnrichedGlyph[] = [];
  private synonyms: Record<string, string[]> = rawSynonyms as Record<string, string[]>;
  private customTagsMap: Record<string, string[]> = {};

  constructor(fontGlyphs: IconGlyph[], initialCustomTags: Record<string, string[]> = {}) {
    const metaMap = rawMeta as Record<string, any>;
    this.customTagsMap = initialCustomTags;

    this.allGlyphs = fontGlyphs.map(g => {
      const meta = metaMap[g.hex];
      const custom = this.customTagsMap[g.hex] || [];
      if (meta) {
        return {
          ...g,
          name: meta.name,
          words: meta.words,
          categories: meta.categories,
          tags: Array.from(new Set([...meta.tags, ...custom])),
          customTags: [...custom],
          isDocumented: true,
        };
      }
      return {
        ...g,
        name: `Unnamed ${g.hex}`,
        words: ['unnamed', g.hex.toLowerCase()],
        categories: ['misc'],
        tags: Array.from(new Set(['unnamed', g.hex.toLowerCase(), ...custom])),
        customTags: [...custom],
        isDocumented: false,
      };
    });

    for (const g of this.allGlyphs) {
      this.glyphMap.set(g.hex, g);
    }

    this.miniSearch = new MiniSearch<MiniSearchDoc>({
      fields: ['name', 'tags', 'words', 'categories', 'hex'],
      storeFields: ['hex'],
      searchOptions: {
        boost: {
          name: 3,
          tags: 2.5,
          words: 2,
          categories: 2,
          hex: 3,
        },
        prefix: true,
        fuzzy: (term: string) => (term.length >= 3 ? 0.2 : false),
      },
    });

    const docs: MiniSearchDoc[] = this.allGlyphs.map(g => ({
      id: g.hex,
      hex: g.hex,
      name: g.name,
      words: g.words.join(' '),
      categories: g.categories.join(' '),
      tags: g.tags.join(' '),
    }));

    this.miniSearch.addAll(docs);
  }

  public getAllGlyphs(): EnrichedGlyph[] {
    return this.allGlyphs;
  }

  public getGlyph(hex: string): EnrichedGlyph | undefined {
    return this.glyphMap.get(hex.toUpperCase());
  }

  public addCustomTag(hex: string, tag: string): string[] {
    const g = this.glyphMap.get(hex.toUpperCase());
    if (!g) return [];

    const cleanTag = tag.trim().toLowerCase();
    if (!cleanTag || g.customTags.includes(cleanTag)) {
      return g.customTags;
    }

    g.customTags.push(cleanTag);
    if (!g.tags.includes(cleanTag)) {
      g.tags.push(cleanTag);
    }

    this.customTagsMap[g.hex] = [...g.customTags];

    // Update MiniSearch document
    this.miniSearch.replace({
      id: g.hex,
      hex: g.hex,
      name: g.name,
      words: g.words.join(' '),
      categories: g.categories.join(' '),
      tags: g.tags.join(' '),
    });

    return g.customTags;
  }

  public removeCustomTag(hex: string, tag: string): string[] {
    const g = this.glyphMap.get(hex.toUpperCase());
    if (!g) return [];

    const cleanTag = tag.trim().toLowerCase();
    g.customTags = g.customTags.filter(t => t !== cleanTag);
    g.tags = g.tags.filter(t => t !== cleanTag);

    if (g.customTags.length > 0) {
      this.customTagsMap[g.hex] = [...g.customTags];
    } else {
      delete this.customTagsMap[g.hex];
    }

    // Update MiniSearch document
    this.miniSearch.replace({
      id: g.hex,
      hex: g.hex,
      name: g.name,
      words: g.words.join(' '),
      categories: g.categories.join(' '),
      tags: g.tags.join(' '),
    });

    return g.customTags;
  }

  public getAllCustomTags(): Record<string, string[]> {
    return this.customTagsMap;
  }

  public search(options: SearchFilterOptions): EnrichedGlyph[] {
    const { query, category, showLegacy, favorites, recents } = options;
    const clean = query.trim().toLowerCase();

    // Base filter helper
    const matchesFilter = (g: EnrichedGlyph): boolean => {
      if (!showLegacy && g.isLegacy) return false;

      if (category === 'favorites') {
        if (!favorites || !favorites.has(g.hex)) return false;
      } else if (category === 'recent') {
        if (!recents || !recents.includes(g.hex)) return false;
      } else if (category !== 'all' && !g.categories.includes(category)) {
        return false;
      }

      return true;
    };

    // If query is empty, return inventory
    if (!clean) {
      if (category === 'recent' && recents && recents.length > 0) {
        // Return in recents order (most recent first)
        const recentGlyphs: EnrichedGlyph[] = [];
        for (const h of recents) {
          const g = this.glyphMap.get(h);
          if (g && matchesFilter(g)) {
            recentGlyphs.push(g);
          }
        }
        return recentGlyphs;
      }
      return this.allGlyphs.filter(matchesFilter);
    }

    // Handle Hex search normalization
    let hexQuery = clean;
    if (hexQuery.startsWith('0x')) hexQuery = hexQuery.slice(2);
    else if (hexQuery.startsWith('u+')) hexQuery = hexQuery.slice(2);
    else if (hexQuery.startsWith('#')) hexQuery = hexQuery.slice(1);

    const exactHexGlyph = this.glyphMap.get(hexQuery.toUpperCase());

    // Expand search query with curated synonyms dictionary
    let expandedTerms = [clean];
    if (this.synonyms[clean]) {
      expandedTerms.push(...this.synonyms[clean]);
    } else {
      for (const [key, synList] of Object.entries(this.synonyms)) {
        if (clean.includes(key)) {
          expandedTerms.push(...synList);
        }
      }
    }

    // MiniSearch query execution
    const results = this.miniSearch.search(expandedTerms.join(' '));
    const resultGlyphs: EnrichedGlyph[] = [];
    const seenHexes = new Set<string>();

    // Priority 1: Exact hex match if present and matches category/legacy
    if (exactHexGlyph && matchesFilter(exactHexGlyph)) {
      resultGlyphs.push(exactHexGlyph);
      seenHexes.add(exactHexGlyph.hex);
    }

    // Add search hits that match category & legacy
    for (const r of results) {
      if (!seenHexes.has(r.id)) {
        const glyph = this.glyphMap.get(r.id);
        if (glyph && matchesFilter(glyph)) {
          resultGlyphs.push(glyph);
          seenHexes.add(glyph.hex);
        }
      }
    }

    // Fallback prefix hex matching (e.g. user typed "E7")
    if (hexQuery.length >= 2) {
      for (const g of this.allGlyphs) {
        if (!seenHexes.has(g.hex) && g.hex.toLowerCase().startsWith(hexQuery)) {
          if (matchesFilter(g)) {
            resultGlyphs.push(g);
            seenHexes.add(g.hex);
          }
        }
      }
    }

    return resultGlyphs;
  }
}
