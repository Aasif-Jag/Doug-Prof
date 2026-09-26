#!/usr/bin/env node
/**
 * HTML build — expands <x-img> into production <picture> markup.
 *
 * Hand-written srcset is where performance regressions come from: someone
 * adds an image, forgets a width, forgets width/height, and CLS appears
 * three sprints later. Authors write this:
 *
 *   <x-img slug="red-rebel-crowd" sizes="100vw" class="fig--cover" priority>
 *
 * and get this: a <picture> with WebP + JPEG srcsets at every rendered
 * width, intrinsic width/height (zero layout shift), the alt text and
 * photographer credit from the manifest, an inlined LQIP background, and
 * correct loading/fetchpriority/decoding hints.
 *
 * Run: node tools/build-html.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'html');
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets', 'img', 'manifest.json'), 'utf8'));

const attrs = (tag) => {
  const out = {};
  for (const [, k, , v] of tag.matchAll(/([\w-]+)(="([^"]*)")?/g)) {
    if (k !== 'x-img') out[k] = v === undefined ? true : v;
  }
  return out;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function picture(a, depth) {
  const m = MANIFEST[a.slug];
  if (!m) throw new Error(`unknown image slug: "${a.slug}"`);

  const base = `${'../'.repeat(depth)}assets/img/images/`;
  const set = (ext) => m.widths.map(w => `${base}${m.slug}-${w}.${ext} ${w}w`).join(', ');

  // Above-the-fold images must not be lazy — lazy-loading the LCP element
  // is the single most common cause of a poor LCP score.
  const priority = a.priority === true;
  const loading = priority ? 'eager' : 'lazy';
  const fetchpri = priority ? ' fetchpriority="high"' : '';
  const sizes = a.sizes || '100vw';
  const cls = ['fig', a.class].filter(Boolean).join(' ');

  const credit = m.credit
    ? `\n  <span class="credit">Photo: ${esc(m.credit)}</span>` : '';

  return `<figure class="${cls}" style="background-image:url(${m.lqip})">
  <picture>
    <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
    <img src="${base}${m.slug}-${m.widths[Math.min(2, m.widths.length - 1)]}.jpg"
         srcset="${set('jpg')}" sizes="${sizes}"
         width="${m.width}" height="${m.height}"
         alt="${esc(a.alt !== undefined ? a.alt : m.alt)}"
         loading="${loading}" decoding="${priority ? 'sync' : 'async'}"${fetchpri}>
  </picture>${credit}
</figure>`;
}

let count = 0;
function build(file, rel) {
  let html = fs.readFileSync(file, 'utf8');
  const depth = rel.split(path.sep).length - 1;

  html = html.replace(/<x-img\b([^>]*?)\/?>(?:<\/x-img>)?/g, (_, raw) => {
    count++;
    return picture(attrs(raw), depth);
  });

  const dest = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  console.log(`    · ${rel}  ${(html.length / 1024).toFixed(1)}KB`);
}

function walk(dir, base = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) walk(full, rel);
    else if (entry.name.endsWith('.html')) build(full, rel);
  }
}

console.log('  building HTML →');
walk(SRC);
console.log(`\n  ${count} <x-img> expanded to <picture>\n`);
