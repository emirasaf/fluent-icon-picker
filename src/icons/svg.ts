import opentype from 'opentype.js';

export interface GlyphToSvgOptions {
  size: number;
  color: string;
  mode: 'em' | 'tight';
}

export interface IconGlyph {
  codepoint: number;
  hex: string;
  char: string;
  isLegacy: boolean;
  name: string;
}

export interface FontMetrics {
  postscriptName: string;
  fullName: string;
  fontFamily: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  puaCount: number;
  legacyCount: number;
  modernCount: number;
  glyphs: IconGlyph[];
}

/**
 * Extracts a named string metadata field from an opentype.Font instance.
 */
function getFontNameProperty(font: opentype.Font, propertyName: string): string {
  const names = font.names as Record<string, any>;
  if (!names) return '';

  return (
    names.windows?.[propertyName]?.en ||
    names.macintosh?.[propertyName]?.en ||
    names[propertyName]?.en ||
    (typeof names[propertyName] === 'string' ? names[propertyName] : '') ||
    ''
  );
}

/**
 * Extracts all non-empty glyphs in the Unicode Private Use Area (0xE000 - 0xF8FF).
 */
export function extractGlyphList(font: opentype.Font): IconGlyph[] {
  const cmap = (font.tables as Record<string, any>).cmap?.glyphIndexMap || {};
  const glyphs: IconGlyph[] = [];

  for (const [key, glyphIndex] of Object.entries(cmap)) {
    const code = parseInt(key, 10);
    if (code >= 0xe000 && code <= 0xf8ff && (glyphIndex as number) > 0) {
      const glyph = font.glyphs.get(glyphIndex as number);
      if (glyph && glyph.path && glyph.path.commands && glyph.path.commands.length > 0) {
        glyphs.push({
          codepoint: code,
          hex: code.toString(16).toUpperCase(),
          char: String.fromCodePoint(code),
          isLegacy: code >= 0xe000 && code <= 0xe5ff,
          name: glyph.name || '',
        });
      }
    }
  }

  glyphs.sort((a, b) => a.codepoint - b.codepoint);
  return glyphs;
}

/**
 * Parses the font buffer and extracts full metrics and PUA glyph list.
 */
export function parseAndAnalyzeFont(buffer: ArrayBuffer): {
  font: opentype.Font;
  metrics: FontMetrics;
} {
  const font = opentype.parse(buffer);

  const postscriptName =
    getFontNameProperty(font, 'postScriptName') ||
    getFontNameProperty(font, 'postscriptName') ||
    'SegoeFluentIcons';
  const fullName = getFontNameProperty(font, 'fullName') || 'Segoe Fluent Icons';
  const fontFamily = getFontNameProperty(font, 'fontFamily') || 'Segoe Fluent Icons';
  const unitsPerEm = font.unitsPerEm || 2048;
  const ascender = font.ascender || unitsPerEm;
  const descender = font.descender || 0;

  const glyphs = extractGlyphList(font);
  const legacyCount = glyphs.filter(g => g.isLegacy).length;
  const modernCount = glyphs.length - legacyCount;

  return {
    font,
    metrics: {
      postscriptName,
      fullName,
      fontFamily,
      unitsPerEm,
      ascender,
      descender,
      puaCount: glyphs.length,
      legacyCount,
      modernCount,
      glyphs,
    },
  };
}

/**
 * Converts a glyph by codepoint into clean, valid, Figma-ready SVG markup.
 * 
 * Accurately aligns the glyph vertically and horizontally using the font's
 * ascender, descender, and unitsPerEm metrics so icons sit properly centered
 * inside the viewBox without vertical clipping.
 */
export function glyphToSvg(
  font: opentype.Font,
  codepoint: number,
  options: GlyphToSvgOptions
): string {
  const { size, color, mode } = options;
  const glyph = font.charToGlyph(String.fromCharCode(codepoint));

  if (!glyph || !glyph.path || !glyph.path.commands || glyph.path.commands.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none"></svg>`;
  }

  const unitsPerEm = font.unitsPerEm || 2048;
  const ascender = font.ascender || unitsPerEm;
  const descender = font.descender || 0;
  const fontHeight = ascender - descender || unitsPerEm;

  if (mode === 'tight') {
    const bbox = glyph.getBoundingBox();
    const gw = bbox.x2 - bbox.x1;
    const gh = bbox.y2 - bbox.y1;

    if (gw > 0 && gh > 0) {
      const maxDim = Math.max(gw, gh);
      const scale = size / maxDim;
      const tw = +(gw * scale).toFixed(2);
      const th = +(gh * scale).toFixed(2);
      const x = -bbox.x1 * scale;
      const y = bbox.y2 * scale;
      const path = glyph.getPath(x, y, unitsPerEm * scale);
      const d = path.toPathData(2);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}" fill="none"><path d="${d}" fill="${color}" fill-rule="nonzero"/></svg>`;
    }
  }

  // 'em' mode: aligns using the font's design em box
  const glyphAdv = typeof glyph.advanceWidth === 'number' ? glyph.advanceWidth : unitsPerEm;
  const advWidth = glyphAdv > 0 ? glyphAdv : unitsPerEm;
  const maxSpan = Math.max(unitsPerEm, fontHeight, advWidth);
  const scale = size / maxSpan;
  const offsetX = (size - advWidth * scale) / 2;
  const topPadding = (size - fontHeight * scale) / 2;
  const baselineY = topPadding + ascender * scale;

  const path = glyph.getPath(offsetX, baselineY, unitsPerEm * scale);
  const d = path.toPathData(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none"><path d="${d}" fill="${color}" fill-rule="nonzero"/></svg>`;
}

/**
 * In-memory SVG cache:
 * Stores generated SVG strings keyed by `${codepoint}-${size}-${color}-${mode}`.
 * Only generated on-demand when clicked (never pre-generated).
 */
const svgCache = new Map<string, string>();

export function clearSvgCache(): void {
  svgCache.clear();
}

export function getCachedSvg(
  font: opentype.Font,
  codepoint: number,
  options: GlyphToSvgOptions
): string {
  const cacheKey = `${codepoint}-${options.size}-${options.color}-${options.mode}`;
  const cached = svgCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const svg = glyphToSvg(font, codepoint, options);
  svgCache.set(cacheKey, svg);
  return svg;
}
