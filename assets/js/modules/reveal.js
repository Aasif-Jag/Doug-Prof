/**
 * Scroll reveal — IntersectionObserver, no animation library.
 *
 * GSAP is ~70KB gzipped and would buy us nothing here: a fade and a 18px
 * translate is two CSS properties. GSAP earns its weight on timelines and
 * morphing, not on entrance transitions. If a later phase needs a genuinely
 * choreographed sequence, load it on that page only.
 *
 * Elements unobserve after firing — reveals do not replay on scroll-up,
 * which reads as jitter rather than delight.
 */

export function initReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  // Respect the OS setting: show everything, observe nothing.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const delay = Number(entry.target.dataset.revealDelay || 0);
      setTimeout(() => entry.target.classList.add('is-visible'), delay);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  items.forEach((el) => io.observe(el));
}
