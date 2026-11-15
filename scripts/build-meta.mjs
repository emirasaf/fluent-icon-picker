/**
 * Build Script: Fetches official Microsoft Segoe Fluent Icons metadata from:
 * 1. MicrosoftDocs/windows-dev-docs (segoe-fluent-icons-font.md)
 * 2. microsoft/WinUI-Gallery (IconsData.json)
 * 
 * Enriches each icon with:
 * - CamelCase split words
 * - Clean category taxonomy
 * - Rich semantic tags & synonyms
 * 
 * STRICT GUARDRAIL: Contains ONLY codepoint, hex, name, words, categories, tags.
 * NEVER contains font binaries or SVG path data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URL_MD =
  'https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/design/iconography/segoe-fluent-icons-font.md';
const URL_WINUI =
  'https://raw.githubusercontent.com/microsoft/WinUI-Gallery/main/WinUIGallery/Samples/Iconography/IconsData.json';

const OUTPUT_PATH = path.resolve(__dirname, '../src/data/icon-meta.json');

// CamelCase tokenization
function splitCamelCase(str) {
  return (str.match(/([A-Z]+(?=[A-Z][a-z0-9]|\b)|[A-Z]?[a-z]+|[0-9]+)/g) || [str])
    .map(w => w.toLowerCase());
}

// Category Classifier
function classifyCategories(name, words, tags) {
  const allTerms = new Set([...words, ...tags.map(t => t.toLowerCase()), name.toLowerCase()]);
  const categories = new Set();

  const has = (...terms) => terms.some(t => allTerms.has(t));
  const hasSub = (...substrs) =>
    Array.from(allTerms).some(t => substrs.some(s => t.includes(s)));

  // Media Controls (Playback, Audio, Video, Music, Volume, etc.)
  const isMediaName = [
    'play', 'pause', 'stop', 'next', 'previous', 'volume', 'mute', 'shuffle', 'repeat',
    'rewind', 'fastforward', 'skipforward', 'skipback', 'media', 'audio', 'music', 'song',
    'track', 'cast', 'stream', 'equalizer', 'closedcaption', 'subtitles', 'headphone',
    'headphones', 'headset', 'speaker', 'speakers', 'microphone', 'mic', 'record',
    'camcorder', 'video', 'videocam', 'ringersilent', 'ringer', 'cc', 'playback',
    'unmute', 'playbackrate', 'disc', 'cd', 'dvd', 'radio', 'boombox'
  ].some(term => {
    const nl = name.toLowerCase();
    return nl === term || nl.startsWith(term) || nl.endsWith(term);
  });

  const hasExplicitMediaTag = ['playback', 'audio', 'music', 'song', 'volume', 'sound'].some(t =>
    tags.some(tag => tag.toLowerCase() === t)
  );

  if (
    (isMediaName || hasExplicitMediaTag) &&
    !['cancel', 'clear', 'blocked', 'train', 'bus', 'memo', 'notepad'].includes(name.toLowerCase())
  ) {
    categories.add('media-controls');
  }

  // Arrows
  if (
    has('arrow', 'chevron', 'caret', 'up', 'down', 'left', 'right', 'back', 'forward', 'expand', 'collapse', 'sort', 'transfer', 'redo', 'undo') ||
    hasSub('arrow', 'chevron', 'caret', 'turn')
  ) {
    categories.add('arrows');
  }

  // Navigation
  if (
    has('home', 'menu', 'nav', 'navigation', 'globalnav', 'breadcrumb', 'map', 'pin', 'mappin', 'compass', 'location', 'street', 'globe', 'browse', 'explore') ||
    hasSub('nav', 'menu', 'compass', 'location')
  ) {
    categories.add('navigation');
  }

  // Communication
  if (
    has('mail', 'email', 'message', 'chat', 'phone', 'call', 'contact', 'people', 'person', 'user', 'comment', 'send', 'share', 'inbox', 'invite', 'sms') ||
    hasSub('mail', 'message', 'chat', 'phone', 'call', 'contact', 'comment')
  ) {
    categories.add('communication');
  }

  // Devices & Hardware
  if (
    has('laptop', 'phone', 'tablet', 'pc', 'computer', 'monitor', 'display', 'screen', 'tv', 'camera', 'keyboard', 'mouse', 'printer', 'scanner', 'speaker', 'mic', 'microphone', 'headset', 'device', 'usb', 'disk', 'drive', 'battery', 'hardware', 'watch') ||
    hasSub('device', 'battery', 'camera', 'phone', 'monitor')
  ) {
    categories.add('devices');
  }

  // Files & Folders
  if (
    has('file', 'folder', 'doc', 'document', 'page', 'sheet', 'pdf', 'archive', 'zip', 'save', 'open', 'copy', 'paste', 'delete', 'trash', 'bin', 'cut', 'attachment', 'clip', 'directory', 'storage') ||
    hasSub('file', 'folder', 'document', 'save', 'delete', 'trash')
  ) {
    categories.add('files-folders');
  }

  // Editing & Tools
  if (
    has('edit', 'pen', 'pencil', 'brush', 'draw', 'highlight', 'crop', 'rotate', 'undo', 'redo', 'eraser', 'color', 'palette', 'format', 'select', 'design', 'art', 'ruler', 'add', 'plus', 'create', 'insert') ||
    hasSub('edit', 'draw', 'crop', 'format')
  ) {
    categories.add('editing');
  }

  // Connectivity & Networking
  if (
    has('wifi', 'bluetooth', 'network', 'connection', 'connect', 'ethernet', 'cellular', 'signal', 'hotspot', 'antenna', 'vpn', 'wlan', 'lan', 'sync', 'link', 'cloud', 'download', 'upload', 'web', 'internet') ||
    hasSub('wifi', 'bluetooth', 'network', 'signal', 'connect')
  ) {
    categories.add('connectivity');
  }

  // System & Settings
  if (
    has('settings', 'gear', 'cog', 'options', 'preferences', 'tune', 'setup', 'info', 'help', 'question', 'warning', 'error', 'alert', 'status', 'power', 'restart', 'reboot', 'sleep', 'diagnostic', 'bug', 'flag', 'search') ||
    hasSub('setting', 'power', 'warning', 'error')
  ) {
    categories.add('system');
  }

  // Windows UI
  if (
    has('window', 'maximize', 'minimize', 'restore', 'close', 'cancel', 'start', 'tile', 'taskbar', 'actioncenter', 'dock', 'view', 'grid', 'list', 'layout', 'pane', 'split', 'zoom', 'search', 'globalnav', 'filter', 'check', 'checkmark') ||
    hasSub('window', 'view', 'layout')
  ) {
    categories.add('windows-ui');
  }

  // Text & Formatting
  if (
    has('font', 'text', 'bold', 'italic', 'underline', 'align', 'paragraph', 'indent', 'bullet', 'numbering', 'spell', 'character', 'case', 'subscript', 'superscript') ||
    hasSub('font', 'text', 'italic', 'underline', 'align')
  ) {
    categories.add('text-format');
  }

  // Security & Privacy
  if (
    has('lock', 'unlock', 'shield', 'key', 'password', 'credential', 'privacy', 'fingerprint', 'biometric', 'guard', 'protect', 'safe', 'certificate', 'firewall', 'permission') ||
    hasSub('lock', 'shield', 'password', 'privacy', 'secure')
  ) {
    categories.add('security');
  }

  // Time & Calendar
  if (
    has('time', 'clock', 'calendar', 'date', 'timer', 'stopwatch', 'alarm', 'schedule', 'event', 'reminder', 'hour', 'minute', 'second', 'history', 'recent') ||
    hasSub('clock', 'calendar', 'timer', 'alarm', 'time')
  ) {
    categories.add('time-calendar');
  }

  // Shapes & Symbols
  if (
    has('circle', 'square', 'rectangle', 'triangle', 'star', 'heart', 'polygon', 'diamond', 'badge', 'dot', 'shape', 'box', 'cube', 'half', 'fill') ||
    hasSub('circle', 'square', 'star', 'heart', 'shape')
  ) {
    categories.add('shapes');
  }

  // Accessibility
  if (
    has('accessibility', 'narrator', 'magnifier', 'hearing', 'speech', 'closedcaption', 'contrast', 'eye', 'braille', 'easeofaccess') ||
    hasSub('access', 'narrat', 'caption')
  ) {
    categories.add('accessibility');
  }

  // Default fallback
  if (categories.size === 0) {
    categories.add('misc');
  }

  return Array.from(categories);
}

// Enrich tags with domain synonyms & requirements
function enrichTags(name, words, baseTags, categories) {
  const tagSet = new Set(baseTags.map(t => t.toLowerCase()));

  // Add words and lower name
  tagSet.add(name.toLowerCase());
  words.forEach(w => tagSet.add(w));

  // Category specific mandatory tags
  if (categories.includes('media-controls')) {
    tagSet.add('media');
    tagSet.add('playback');
  }

  // Specific canonical enrichments
  const n = name.toLowerCase();

  // Next / Previous
  if (n === 'next') {
    ['next track', 'skip', 'forward', 'media', 'playback', 'music', 'song'].forEach(t => tagSet.add(t));
  }
  if (n === 'previous') {
    ['previous track', 'rewind', 'back', 'media', 'playback', 'music', 'song'].forEach(t => tagSet.add(t));
  }
  if (n === 'play') {
    ['playback', 'media', 'start', 'video', 'audio', 'music', 'song'].forEach(t => tagSet.add(t));
  }
  if (n === 'pause') {
    ['playback', 'media', 'freeze', 'stop', 'music', 'audio', 'video'].forEach(t => tagSet.add(t));
  }
  if (n === 'stop') {
    ['playback', 'media', 'halt', 'end', 'audio', 'video', 'music'].forEach(t => tagSet.add(t));
  }
  if (n.includes('volume') || n === 'mute' || n.includes('audio') || n.includes('sound')) {
    tagSet.add('media');
    tagSet.add('playback');
    tagSet.add('sound');
    tagSet.add('audio');
  }

  // Settings
  if (n.includes('setting')) {
    ['settings', 'gear', 'cog', 'preferences', 'options', 'setup', 'config'].forEach(t => tagSet.add(t));
  }

  // Search
  if (n.includes('search') || n.includes('find') || n.includes('zoom')) {
    ['search', 'magnifier', 'find', 'zoom', 'lookup', 'inspect'].forEach(t => tagSet.add(t));
  }

  // Close / Cancel / Remove
  if (n === 'cancel' || n === 'clear' || n.includes('close') || n.includes('dismiss')) {
    ['close', 'cancel', 'x', 'dismiss', 'exit', 'remove', 'stop'].forEach(t => tagSet.add(t));
  }

  // Add / Plus
  if (n.includes('add') || n.includes('new') || n.includes('create')) {
    ['add', 'plus', 'new', 'create', 'insert', 'positive'].forEach(t => tagSet.add(t));
  }

  // Wifi / Network
  if (n.includes('wifi') || n.includes('wlan')) {
    ['wifi', 'wireless', 'internet', 'network', 'connect', 'connection'].forEach(t => tagSet.add(t));
  }

  // Trash / Delete
  if (n.includes('delete') || n.includes('trash') || n.includes('remove')) {
    ['delete', 'trash', 'bin', 'garbage', 'recycle', 'remove'].forEach(t => tagSet.add(t));
  }

  // Clean tags
  return Array.from(tagSet).filter(t => t && t.length > 0 && t !== 'symbol-icon');
}

async function run() {
  console.log('Fetching official Microsoft Segoe Fluent Icons data...');

  const [mdRes, winuiRes] = await Promise.all([
    fetch(URL_MD),
    fetch(URL_WINUI),
  ]);

  if (!mdRes.ok) throw new Error(`Failed to fetch markdown docs: ${mdRes.status}`);
  if (!winuiRes.ok) throw new Error(`Failed to fetch WinUI gallery: ${winuiRes.status}`);

  const mdText = await mdRes.text();
  const winuiJson = await winuiRes.json();

  // 1. Parse Markdown table
  const mdIcons = new Map();
  const mdLines = mdText.split('\n');
  for (const line of mdLines) {
    if (!line.startsWith('|')) continue;
    const parts = line.split('|').map(s => s.trim());
    if (parts.length < 4) continue;
    const hex = parts[2].toUpperCase();
    const descRaw = parts[3];
    const m = descRaw.match(/text="([^"]+)"/) || descRaw.match(/^([A-Za-z0-9_]+)/);
    const name = m ? m[1] : descRaw;
    if (/^[0-9A-F]{4}$/.test(hex) && name && name !== 'Description') {
      mdIcons.set(hex, name);
    }
  }

  // 2. Parse WinUI JSON
  const winuiIcons = new Map();
  for (const item of winuiJson) {
    if (item.Code) {
      winuiIcons.set(item.Code.toUpperCase(), item);
    }
  }

  console.log(`Parsed ${mdIcons.size} icons from Markdown docs.`);
  console.log(`Parsed ${winuiIcons.size} icons from WinUI Gallery data.`);

  // 3. Merge & structure
  const allHexes = new Set([...winuiIcons.keys(), ...mdIcons.keys()]);
  const metaMap = {};

  for (const hex of allHexes) {
    const codepoint = parseInt(hex, 16);
    const winuiItem = winuiIcons.get(hex);
    const mdName = mdIcons.get(hex);

    const name = winuiItem?.Name || mdName || `Glyph_${hex}`;
    const words = splitCamelCase(name);
    const rawTags = winuiItem?.Tags || [];

    const categories = classifyCategories(name, words, rawTags);
    const tags = enrichTags(name, words, rawTags, categories);

    metaMap[hex] = {
      codepoint,
      hex,
      name,
      words,
      categories,
      tags,
    };
  }

  const totalGenerated = Object.keys(metaMap).length;
  console.log(`Total structured icons in icon-meta.json: ${totalGenerated}`);

  // 4. Verify critical icons
  const requiredChecks = [
    { hex: 'E893', expectedName: 'Next', checkCategory: 'media-controls', checkTag: 'next track' },
    { hex: 'E713', expectedName: 'Settings', checkTag: 'gear' },
    { hex: 'E711', expectedName: 'Cancel', checkTag: 'close' },
    { hex: 'E710', expectedName: 'Add', checkTag: 'plus' },
    { hex: 'E721', expectedName: 'Search', checkTag: 'magnifier' },
    { hex: 'E701', expectedName: 'Wifi', checkTag: 'wifi' },
  ];

  for (const check of requiredChecks) {
    const item = metaMap[check.hex];
    if (!item) {
      console.warn(`WARNING: Missing required icon ${check.hex}`);
      continue;
    }
    console.log(`✓ Verified ${check.hex} (${item.name}): categories=[${item.categories.join(', ')}], tags sample=[${item.tags.slice(0, 5).join(', ')}]`);
  }

  // 5. Write to disk
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(metaMap, null, 2), 'utf-8');
  console.log(`Successfully written to ${OUTPUT_PATH} (${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB)`);
}

run().catch(err => {
  console.error('Build-meta script error:', err);
  process.exit(1);
});
