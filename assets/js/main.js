/**
 * Doug Francisco — entry point.
 *
 * Native ES modules, no bundler. type="module" is deferred by default, so
 * nothing here blocks the first paint. Total shipped JS is under 4KB.
 * Every module fails soft: if one throws, the others still run and the page
 * remains fully usable without any of them.
 */

import { initNav } from './modules/nav.js';
import { initReveal } from './modules/reveal.js';
import { initImages } from './modules/images.js';

document.documentElement.classList.remove('no-js');

const boot = () => {
  [initNav, initReveal, initImages].forEach((fn) => {
    try { fn(); } catch (err) { console.error(`[df] ${fn.name} failed`, err); }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
