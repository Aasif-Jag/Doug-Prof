/**
 * Navigation — sticky state + accessible mobile drawer.
 *
 * Accessibility contract:
 *   • toggle is a real <button> with aria-expanded and aria-controls
 *   • Escape closes and returns focus to the toggle
 *   • focus is trapped inside the open drawer (WCAG 2.1.2 No Keyboard Trap
 *     is satisfied because Escape always provides an exit)
 *   • body scroll is locked while open
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

export function initNav() {
  const nav = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const panel = document.querySelector('[data-nav-panel]');
  if (!nav) return;

  /* --- sticky state -------------------------------------------------- */
  // A sentinel element is cheaper than a scroll listener: the observer
  // fires twice in the page's life, not sixty times a second.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);

  new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-stuck', !entry.isIntersecting),
    { rootMargin: '-64px 0px 0px 0px' }
  ).observe(sentinel);

  /* --- mobile drawer ------------------------------------------------- */
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    panel.dataset.open = String(open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) panel.querySelector(FOCUSABLE)?.focus();
    else toggle.focus();
  };

  toggle.addEventListener('click', () =>
    setOpen(toggle.getAttribute('aria-expanded') !== 'true'));

  panel.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (toggle.getAttribute('aria-expanded') !== 'true') return;

    if (e.key === 'Escape') { setOpen(false); return; }

    if (e.key === 'Tab') {
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  });

  // Close if the viewport grows past the breakpoint while the drawer is open.
  matchMedia('(min-width: 62rem)').addEventListener('change', (e) => {
    if (e.matches && toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
  });
}
