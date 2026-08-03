#!/usr/bin/env node
/**
 * Pre-flight audit — the checks that actually cause Lighthouse and WCAG
 * failures, run against the BUILT html so it tests what ships.
 *
 * Deliberately dependency-free regex parsing. It is not a browser and does
 * not pretend to be: it catches the structural mistakes (missing dimensions,
 * lazy LCP, skipped headings, dead classes, sub-12px type), which is where
 * regressions actually come from. Contrast lives in check-contrast.js.
 *
 * Run: node tools/audit.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const warnings = [];
const passes = [];

const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);
const pass = (m) => passes.push(m);

const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const css = fs.readFileSync(path.join(ROOT, 'assets/css/main.css'), 'utf8');

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const at = (m) => `${page}: ${m}`;

  /* ---- images ---------------------------------------------------------- */
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  const noAlt = imgs.filter(i => !/\balt=/.test(i));
  const noDims = imgs.filter(i => !/\bwidth=/.test(i) || !/\bheight=/.test(i));
  const lazyEager = imgs.filter(i => /fetchpriority="high"/.test(i) && /loading="lazy"/.test(i));

  noAlt.length ? fail(at(`${noAlt.length} <img> without alt`))
               : pass(at(`all ${imgs.length} images have alt`));
  noDims.length ? fail(at(`${noDims.length} <img> without width/height (causes CLS)`))
                : pass(at('all images have intrinsic dimensions — CLS safe'));
  lazyEager.length ? fail(at('LCP image is lazy-loaded')) : null;

  const eager = imgs.filter(i => /loading="eager"/.test(i));
  eager.length === 0 ? warn(at('no eager image — LCP element may be lazy'))
    : eager.length > 2 ? warn(at(`${eager.length} eager images — only the LCP element should be`))
    : pass(at(`${eager.length} eager image (LCP), ${imgs.length - eager.length} lazy`));

  /* ---- headings -------------------------------------------------------- */
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map(m => +m[1]);
  const h1s = levels.filter(l => l === 1).length;
  h1s === 1 ? pass(at('exactly one <h1>')) : fail(at(`${h1s} <h1> elements (need exactly 1)`));

  let skip = null;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) skip = `h${levels[i - 1]} → h${levels[i]}`;
  }
  skip ? fail(at(`heading level skipped: ${skip}`)) : pass(at('heading order unbroken'));

  /* ---- landmarks & labels --------------------------------------------- */
  /<main\b/.test(html) ? pass(at('<main> landmark present')) : fail(at('no <main>'));
  /class="skip-link"/.test(html) ? pass(at('skip link present')) : fail(at('no skip link'));
  /<html lang=/.test(html) ? pass(at('lang declared')) : fail(at('no lang on <html>'));

  const navs = [...html.matchAll(/<nav\b([^>]*)>/g)].map(m => m[1]);
  navs.every(a => /aria-label/.test(a))
    ? pass(at(`all ${navs.length} <nav> landmarks labelled`))
    : fail(at('a <nav> is missing aria-label'));

  /* ---- aria wiring ----------------------------------------------------- */
  for (const [, id] of html.matchAll(/aria-controls="([^"]+)"/g)) {
    html.includes(`id="${id}"`) ? pass(at(`aria-controls="${id}" resolves`))
                                : fail(at(`aria-controls="${id}" points at nothing`));
  }
  for (const [, id] of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
    if (!html.includes(`id="${id}"`)) fail(at(`aria-labelledby="${id}" points at nothing`));
  }

  /* ---- duplicate ids --------------------------------------------------- */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  dupes.length ? fail(at(`duplicate id: ${[...new Set(dupes)].join(', ')}`))
               : pass(at('no duplicate ids'));

  /* ---- icon-only buttons need names ------------------------------------ */
  for (const btn of html.match(/<button[\s\S]*?<\/button>/g) || []) {
    const named = /aria-label=/.test(btn) || /class="sr-only"/.test(btn);
    named ? pass(at('icon button has accessible name'))
          : fail(at('icon-only <button> has no accessible name'));
  }

  /* ---- links ----------------------------------------------------------- */
  const hrefs = [...html.matchAll(/href="([^"#][^"]*)"/g)].map(m => m[1])
    .filter(h => !/^(https?:|mailto:|tel:|\/$)/.test(h));
  const missing = hrefs.filter(h => {
    const target = h.endsWith('/') ? path.join(ROOT, h, 'index.html') : path.join(ROOT, h);
    return !fs.existsSync(target);
  });
  missing.length
    ? warn(at(`links to pages not yet built: ${[...new Set(missing)].join(', ')}`))
    : pass(at('all internal links resolve'));

  /* ---- x-img must all be compiled away --------------------------------- */
  /<x-img/.test(html) ? fail(at('unexpanded <x-img> in built output'))
                      : pass(at('all <x-img> compiled'));

  /* ---- seo ------------------------------------------------------------- */
  const desc = html.match(/name="description" content="([^"]*)"/)?.[1] || '';
  desc.length >= 70 && desc.length <= 300
    ? pass(at(`meta description ${desc.length} chars`))
    : warn(at(`meta description ${desc.length} chars (aim 120–160)`));

  const title = (html.match(/<title>([^<]*)<\/title>/)?.[1] || '')
    .replace(/&\w+;/g, 'x');   // entities render as one character
  title.length <= 65 ? pass(at(`<title> ${title.length} chars`))
                     : warn(at(`<title> ${title.length} chars — will truncate in SERPs`));

  /<link rel="canonical"/.test(html) ? pass(at('canonical set')) : warn(at('no canonical'));
  /application\/ld\+json/.test(html) ? pass(at('structured data present'))
                                     : warn(at('no JSON-LD'));

  /* ---- dead classes ---------------------------------------------------- */
  const used = new Set();
  for (const [, list] of html.matchAll(/class="([^"]+)"/g)) {
    list.split(/\s+/).forEach(c => c && used.add(c));
  }
  const undefined_ = [...used].filter(c => !css.includes(`.${c}`));
  undefined_.length ? warn(at(`classes with no CSS rule: ${undefined_.join(', ')}`))
                    : pass(at(`all ${used.size} classes are styled`));
}

/* ---- type floor -------------------------------------------------------- */
// The original comp had labels at 0.42rem (~7px). This is the guard against
// that ever coming back.
const tiny = [...css.matchAll(/font-size:\s*([\d.]+)rem/g)]
  .map(m => +m[1]).filter(v => v < 0.6875);
tiny.length ? fail(`${tiny.length} font-size below 11px: ${[...new Set(tiny)].join('rem, ')}rem`)
            : pass('no font-size below 11px anywhere in the CSS');

/* ---- reduced motion ---------------------------------------------------- */
/prefers-reduced-motion/.test(css) ? pass('prefers-reduced-motion honoured')
                                   : fail('no prefers-reduced-motion handling');

/* ---- focus visibility -------------------------------------------------- */
/:focus-visible\s*{[^}]*outline:/.test(css) ? pass('focus-visible outline defined')
                                            : fail('no visible focus style');
/outline:\s*(none|0)/.test(css.replace(/:focus:not\(:focus-visible\)\s*{[^}]*}/g, ''))
  ? fail('outline removed somewhere outside the :focus-visible guard')
  : pass('focus outline never blanket-removed');

/* ---- tap targets ------------------------------------------------------- */
/min-height:\s*3rem/.test(css) ? pass('buttons ≥48px tall (WCAG 2.5.8)')
                               : warn('button min-height not enforced');

/* ---- report ------------------------------------------------------------ */
const line = '─'.repeat(72);
console.log(`\n  Pre-flight audit — ${pages.length} page(s)\n  ${line}`);
console.log(`\n  PASS  ${passes.length}`);
passes.forEach(p => console.log(`    ✓ ${p}`));
if (warnings.length) {
  console.log(`\n  WARN  ${warnings.length}`);
  warnings.forEach(w => console.log(`    ! ${w}`));
}
if (problems.length) {
  console.log(`\n  FAIL  ${problems.length}`);
  problems.forEach(p => console.log(`    ✗ ${p}`));
}
console.log(`\n  ${line}`);
console.log(problems.length ? `  ${problems.length} blocking issue(s).\n`
                            : `  No blocking issues.\n`);
process.exit(problems.length ? 1 : 0);
