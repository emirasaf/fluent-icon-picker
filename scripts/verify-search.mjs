import MiniSearch from 'minisearch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const metaPath = path.resolve(__dirname, '../src/data/icon-meta.json');
const synonymsPath = path.resolve(__dirname, '../src/data/synonyms.json');

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const synonyms = JSON.parse(fs.readFileSync(synonymsPath, 'utf8'));

const items = Object.values(meta).map(item => ({
  id: item.hex,
  hex: item.hex,
  name: item.name,
  words: item.words.join(' '),
  categories: item.categories.join(' '),
  tags: item.tags.join(' '),
  codepoint: item.codepoint,
}));

const miniSearch = new MiniSearch({
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
    fuzzy: term => (term.length >= 3 ? 0.2 : false),
  },
});

miniSearch.addAll(items);

function search(query) {
  let clean = query.trim().toLowerCase();
  if (clean.startsWith('0x')) clean = clean.slice(2);
  else if (clean.startsWith('u+')) clean = clean.slice(2);
  else if (clean.startsWith('#')) clean = clean.slice(1);

  const exactHex = items.find(i => i.hex.toLowerCase() === clean);

  let expanded = [clean];
  if (synonyms[clean]) {
    expanded.push(...synonyms[clean]);
  } else {
    for (const [key, syns] of Object.entries(synonyms)) {
      if (clean.includes(key)) {
        expanded.push(...syns);
      }
    }
  }

  const results = miniSearch.search(expanded.join(' '));
  let resultIds = results.map(r => r.id);

  if (exactHex) {
    resultIds = [exactHex.hex, ...resultIds.filter(id => id !== exactHex.hex)];
  }

  return resultIds;
}

const tests = [
  { query: 'next track', expectedHex: 'E893', expectedName: 'Next' },
  { query: 'media', expectedCategory: 'media-controls' },
  { query: 'gear', expectedHex: 'E713', expectedName: 'Settings' },
  { query: 'close', expectedHex: 'E711', expectedName: 'Cancel' },
  { query: 'x', expectedHex: 'E711', expectedName: 'Cancel' },
  { query: 'plus', expectedHex: 'E710', expectedName: 'Add' },
  { query: 'magnifier', expectedHex: 'E721', expectedName: 'Search' },
  { query: 'e721', expectedHex: 'E721', expectedName: 'Search' },
  { query: '0xE721', expectedHex: 'E721', expectedName: 'Search' },
  { query: 'wifi', expectedHex: 'E701', expectedName: 'Wifi' },
];

console.log('--- Phase 2 Search Verification ---');
let allPassed = true;

for (const t of tests) {
  const results = search(t.query);
  const topHex = results[0];
  const topItem = meta[topHex];

  let passed = false;
  if (t.expectedHex) {
    passed = topHex === t.expectedHex;
  } else if (t.expectedCategory) {
    passed = topItem && topItem.categories.includes(t.expectedCategory);
  }

  if (!passed) allPassed = false;

  console.log(
    `[${passed ? 'PASS' : 'FAIL'}] Query: "${t.query}" -> Top: ${topItem?.name} (0x${topHex}) | Matches: ${results.length}`
  );
}

// Media category coverage verification
const mediaResults = search('media');
const mediaIcons = mediaResults.map(h => meta[h]?.name).slice(0, 10);
console.log('Sample media matches:', mediaIcons.join(', '));

if (!allPassed) {
  console.error('FAILED: Not all acceptance tests passed.');
  process.exit(1);
} else {
  console.log('SUCCESS: All 10 acceptance test queries passed.');
}
