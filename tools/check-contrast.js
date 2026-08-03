#!/usr/bin/env node
/**
 * WCAG 2.1 contrast audit for the token palette.
 * Parses 01-tokens.css so it can never drift from the real values.
 * Exits non-zero if any declared pair fails its stated requirement.
 *
 * Run: node tools/check-contrast.js
 */

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'css', '01-tokens.css'), 'utf8');

const tokens = {};
for (const [, name, hex] of css.matchAll(/(--c-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
  tokens[name] = hex;
}

const lum = (hex) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// [foreground, background, minimum required, why]
const PAIRS = [
  ['c-paper',            'c-ink',   4.5, 'primary body copy on dark'],
  ['c-paper-dim',        'c-ink',   4.5, 'secondary copy on dark'],
  ['c-paper-mute',       'c-ink',   4.5, 'captions / meta on dark'],
  ['c-red-text',         'c-ink',   4.5, 'small red text on dark'],
  ['c-brass',            'c-ink',   4.5, 'brass accents on dark'],
  ['c-red',              'c-ink',   3.0, 'LARGE display red + UI borders on dark'],

  ['c-ink-on-paper',     'c-paper', 4.5, 'primary body copy on paper'],
  ['c-ink-on-paper-dim', 'c-paper', 4.5, 'secondary copy on paper'],
  ['c-ink-on-paper-mute','c-paper', 4.5, 'captions / meta on paper'],
  ['c-red-on-paper',     'c-paper', 4.5, 'small red text on paper'],
  ['c-brass-dim',        'c-paper', 4.5, 'brass accents on paper'],

  ['c-focus',            'c-ink',   3.0, 'focus ring on dark'],
  ['c-focus-on-paper',   'c-paper', 3.0, 'focus ring on paper'],
  ['c-paper',            'c-ink-raised', 4.5, 'copy on raised card'],
];

let failed = 0;
console.log('\n  WCAG 2.1 contrast audit — Doug Francisco tokens\n');
console.log('  ratio   req   result  pair');
console.log('  ' + '─'.repeat(74));

for (const [fg, bg, min, why] of PAIRS) {
  if (!tokens[`--${fg}`] || !tokens[`--${bg}`]) {
    console.log(`  MISSING TOKEN: ${fg} / ${bg}`);
    failed++;
    continue;
  }
  const r = ratio(tokens[`--${fg}`], tokens[`--${bg}`]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(
    `  ${r.toFixed(2).padStart(5)}  ${min.toFixed(1)}   ${ok ? ' PASS ' : ' FAIL '}  ` +
    `${fg} on ${bg} — ${why}`
  );
}

console.log('  ' + '─'.repeat(74));
if (failed) {
  console.log(`\n  ${failed} pair(s) FAILED. Fix the tokens before shipping.\n`);
  process.exit(1);
}
console.log(`\n  All ${PAIRS.length} pairs pass.\n`);
