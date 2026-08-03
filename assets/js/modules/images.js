/**
 * Blur-up image loading.
 *
 * The LQIP is inlined as a CSS background on the .fig wrapper, so the box is
 * never empty and never white. The real image fades in over it once decoded.
 * decode() is awaited so the fade starts on a fully painted frame rather than
 * a half-drawn progressive JPEG.
 *
 * Images already in cache (bfcache, repeat visit) resolve synchronously —
 * the complete check below stops them fading in on every navigation.
 */

export function initImages() {
  document.querySelectorAll('.fig > img').forEach((img) => {
    if (img.complete && img.naturalWidth) {
      img.classList.add('is-loaded');
      return;
    }
    const show = () => img.classList.add('is-loaded');
    img.decode ? img.decode().then(show).catch(show)
               : img.addEventListener('load', show, { once: true });
    img.addEventListener('error', show, { once: true });
  });
}
