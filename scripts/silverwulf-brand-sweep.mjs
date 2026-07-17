/*
 * SilverWulf brand sweep — runs over the built dist/ on every build, so it
 * self-heals across upstream rebases. Two jobs:
 *
 *  1. Replace the product name "BentoPDF" (case-sensitive) with the brand name
 *     in rendered HTML and the runtime locale JSON. Case-sensitivity is load-
 *     bearing: it swaps the PRODUCT NAME while leaving lowercase infra URLs
 *     (bentopdf-cors-proxy.bentopdf.workers.dev, github.com/alam00000/bentopdf)
 *     untouched so nothing functional breaks.
 *  2. Redirect the upstream author's monetization links (GitHub Sponsors, Ko-fi,
 *     the DigitalOcean referral) to our own source repo. A customer-facing
 *     deploy must not solicit donations for a third party.
 *
 * AGPL note: this only rewrites rendered marketing copy and links. The license
 * notices and copyright headers in the SOURCE tree are untouched, and the footer
 * links to our published Corresponding Source — so §5/§13 stay satisfied.
 *
 * .js bundles are intentionally excluded — replacing tokens inside compiled JS
 * risks corrupting identifiers, cache keys, or string tables.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const BRAND = process.env.VITE_BRAND_NAME || 'BentoPDF';
const SOURCE_URL =
  process.env.VITE_SOURCE_URL ||
  'https://github.com/SilverWulf212/silverwulf-pdf/tree/silverwulf';

if (BRAND === 'BentoPDF') {
  console.log('[brand-sweep] VITE_BRAND_NAME unset — nothing to do');
  process.exit(0);
}
if (!fs.existsSync(DIST)) {
  console.error('[brand-sweep] dist/ not found — run after vite build');
  process.exit(1);
}

// Author monetization links -> our source. Ordered, applied before the name swap.
const LINK_REDIRECTS = [
  [/https:\/\/github\.com\/sponsors\/alam00000/g, SOURCE_URL],
  [/https:\/\/ko-fi\.com\/alio01/g, SOURCE_URL],
  [
    /https:\/\/www\.digitalocean\.com\/\?refcode=[^"'\s)]*/g,
    SOURCE_URL,
  ],
  [/@BentoPDF/g, '@SilverWulf'], // twitter:site handle -> plausible handle, before name swap
];

const walk = (dir, exts, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
};

let filesChanged = 0;
let nameReplacements = 0;
for (const file of walk(DIST, ['.html', '.json', '.webmanifest'])) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  for (const [re, to] of LINK_REDIRECTS) s = s.replace(re, to);
  const nameHits = (s.match(/BentoPDF/g) || []).length;
  s = s.replace(/BentoPDF/g, BRAND);
  if (s !== before) {
    fs.writeFileSync(file, s);
    filesChanged++;
    nameReplacements += nameHits;
  }
}
console.log(
  `[brand-sweep] ${BRAND}: ${filesChanged} files rewritten, ${nameReplacements} name refs swapped, author links -> ${SOURCE_URL}`
);
