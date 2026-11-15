/**
 * Local Font Access Layer & IndexedDB persistence
 * 
 * Complies with strict copyright guardrails:
 * No font binaries are bundled or committed. Font buffers are loaded strictly
 * from the user's OS via window.queryLocalFonts() or user file selection,
 * then cached locally in browser IndexedDB.
 */

export interface LocalFontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob(): Promise<Blob>;
}

declare global {
  interface Window {
    queryLocalFonts?: (options?: { postscriptNames?: string[] }) => Promise<LocalFontData[]>;
  }
}

const DB_NAME = 'fluent-font-db';
const DB_VERSION = 1;
const STORE_NAME = 'font-cache';
const FONT_STORAGE_KEY = 'segoe-fluent-icons-buffer';

/**
 * Opens or upgrades the IndexedDB instance for storing font buffers.
 */
export function openFontDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a font ArrayBuffer to IndexedDB.
 */
export async function saveFontToDB(buffer: ArrayBuffer): Promise<void> {
  const db = await openFontDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(buffer, FONT_STORAGE_KEY);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves the cached font ArrayBuffer from IndexedDB if present.
 */
export async function loadFontFromDB(): Promise<ArrayBuffer | null> {
  const db = await openFontDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(FONT_STORAGE_KEY);

    req.onsuccess = () => {
      const result = req.result as ArrayBuffer | undefined;
      resolve(result || null);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clears the cached font ArrayBuffer from IndexedDB.
 */
export async function clearFontFromDB(): Promise<void> {
  const db = await openFontDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(FONT_STORAGE_KEY);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Checks whether the browser supports window.queryLocalFonts().
 */
export function isQueryLocalFontsSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function';
}

/**
 * Requests access to system fonts via window.queryLocalFonts(),
 * filters for "Segoe Fluent Icons", extracts ArrayBuffer, and caches it in IndexedDB.
 */
export async function loadSystemFont(): Promise<ArrayBuffer> {
  if (!isQueryLocalFontsSupported() || !window.queryLocalFonts) {
    throw new Error(
      'The Local Font Access API (window.queryLocalFonts) is not supported in this browser. Please use a Chromium-based browser (Chrome/Edge) or select your font file manually.'
    );
  }

  let fonts: LocalFontData[];
  try {
    fonts = await window.queryLocalFonts();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      throw new Error('Permission to access local fonts was denied by the user. You can load the font file manually instead.');
    }
    throw error;
  }

  // Filter strictly by family or name "Segoe Fluent Icons"
  const fontData = fonts.find(
    f =>
      f.family === 'Segoe Fluent Icons' ||
      f.fullName === 'Segoe Fluent Icons' ||
      f.postscriptName === 'SegoeFluentIcons'
  );

  if (!fontData) {
    throw new Error(
      '"Segoe Fluent Icons" was not found among your installed system fonts. If you are on Windows, ensure it is installed in C:\\Windows\\Fonts\\SegoeIcons.ttf, or use the file picker to load it.'
    );
  }

  const blob = await fontData.blob();
  const buffer = await blob.arrayBuffer();
  await saveFontToDB(buffer);
  return buffer;
}

/**
 * Fallback loader for browsers where queryLocalFonts is unavailable or restricted.
 * Saves the selected file's buffer into IndexedDB so it persists across reloads.
 */
export async function loadFontFromFile(file: File): Promise<ArrayBuffer> {
  if (!file.name.match(/\.(ttf|otf)$/i)) {
    throw new Error('Please select a valid .ttf or .otf font file.');
  }

  const buffer = await file.arrayBuffer();
  await saveFontToDB(buffer);
  return buffer;
}

/**
 * Dynamically registers the font buffer in the browser document via the FontFace API
 * so that font-family: "Segoe Fluent Icons" renders identically and crisply across all browsers.
 */
export async function registerFontFace(
  buffer: ArrayBuffer,
  familyName = 'Segoe Fluent Icons'
): Promise<FontFace> {
  // Use a copy of the buffer to avoid potential detachment
  const bufferCopy = buffer.slice(0);
  const fontFace = new FontFace(familyName, bufferCopy);
  const loadedFace = await fontFace.load();
  document.fonts.add(loadedFace);
  return loadedFace;
}

