# Doug Francisco — Phase 1

Foundation + Home page. Static HTML/CSS/vanilla JS, zero runtime dependencies.

```
npm run verify     # build everything, then run both audits
npm run serve      # http://localhost:8080
```

---

## Where things live

```
src/css/*.css       ← author styles here (6 modules, cascade order = filename order)
src/html/*.html     ← author pages here (use <x-img>, not hand-written <picture>)
tools/              ← the build (140 lines of Node + Python, no bundler)
assets/             ← BUILT output. Do not edit by hand.
index.html          ← BUILT output. Do not edit by hand.
```

Three build steps, all independent:

| Command | Does |
|---|---|
| `node tools/build-css.js` | concatenates `src/css/*` → `assets/css/main.css` + `.min.css` |
| `node tools/build-html.js` | expands `<x-img>` → `<picture>`, writes pages to root |
| `python3 tools/build-images.py` | raw photos → responsive WebP + JPEG + LQIP + manifest |

Two audits, both exit non-zero on failure so they can gate a deploy:

| Command | Checks |
|---|---|
| `node tools/check-contrast.js` | every token pair against WCAG 2.1, parsed live from the CSS |
| `node tools/audit.js` | alt text, CLS, LCP, heading order, aria wiring, dead classes, type floor |

---

## Adding an image

Drop the file in the source folder, add one row to `LIBRARY` in
`tools/build-images.py` (slug, filename, alt text, credit, tags), run
`npm run images`. Then in any page:

```html
<x-img slug="red-rebel-crowd" sizes="(min-width: 62rem) 42vw, 100vw">
```

You get WebP + JPEG srcsets at every rendered width, intrinsic `width`/`height`
(so CLS stays at zero), the alt text and photographer credit from the manifest,
an inlined blur-up placeholder, and correct loading hints. Add `priority` to the
one image that is the LCP element — and only that one.

---

## Decisions that departed from the brief

Four, each with a reason. Push back on any of them.

**1. Three service lines, not eleven disciplines.**
The brief lists 8 job titles and 11 practice areas. Rendered as a flat grid that
reads as unfocused — which is the "scattered archive" problem restated in nouns.
All 11 are still on the page, grouped under the three things a client can
actually write a purchase order for. The brief asked for "one clear professional
story"; a list of eleven is not one story.

**2. Special Elite was cut. Three fonts, not four.**
It was doing one job — tiny stamped labels — and every one of those labels was
between 0.42rem and 0.55rem (7–9px). That is the largest accessibility failure
in the original comp. The flyposter character now comes from DM Sans in wide
uppercase tracking at 12px minimum. One fewer font request, and `tools/audit.js`
fails the build if anything under 11px ever reappears.

**3. No Lenis, no GSAP.**
Lenis hijacks scroll: it fights trackpad momentum, breaks `scroll-behavior`, and
is a WCAG 2.2.2 risk. Native smooth scroll already does the job. GSAP is ~70KB
gzipped to animate a fade and an 18px translate — IntersectionObserver does it in
under 1KB. Total shipped JS is 5.5KB. If a later phase needs a genuinely
choreographed timeline (a project page hero, say), load GSAP on that page alone.

**4. "Available for [five vague tags]" became a named-credits bar.**
Wake the Tiger, Boomtown Fair, Arcadia Spectacular, Invisible Circus, Red Rebel
Brigade. Five real names do more for credibility in three seconds than any list
of adjectives, and it puts Proof at hierarchy position 3 where the brief wants it.

---

## Blocking content gaps

**Wake the Tiger has no photography.** It is flagship #1 — the strongest
consultancy proof point — and the only flagship with no real asset. The home
page currently uses an Andre Pattenden stand-in, flagged in an HTML comment.
Needs real images *and* confirmed usage rights: it is a commercial attraction
and Doug being art director does not mean he holds the photo licence.

**No testimonials.** The brief puts Proof at position 3; there is nothing to put
there. One named quote from Wake the Tiger or Boomtown would outperform anything
else on this page. The slot is built and commented in `src/html/index.html`.

**Doug's actual service offering is inferred, not supplied.** The three service
lines are drafted from his track record. Engagement models, typical project
shapes and rate bands are unknown, and `work-with-doug.html` — the primary
conversion page — cannot be written properly without them.

**`doug-directing-red-rebels` is the most commercially valuable photo in the
library and it is 1290×848.** It is the only image showing Doug *directing*
rather than performing. Everything else shows an artist; this one shows a
director. Worth hunting for the original.

---

## Before launch

- Self-host the three fonts as woff2 and `preload` them — worth ~200ms of LCP on
  cold 4G versus the Google Fonts hop.
- Serve `main.min.css` instead of `main.css`.
- Add `Cache-Control: public, max-age=31536000, immutable` on `/assets/img/`.
- Enable Brotli. The CSS is 19.1KB raw, ~4.6KB gzipped, less under Brotli.
- Run real Lighthouse against the deployed URL. The audits here catch structural
  regressions, not field metrics.
- Test with an actual screen reader. Automated checks catch roughly 30% of WCAG
  issues; the rest need a human.

---

## Not yet built

`work-with-doug.html`, `projects/` (index + 3 flagship pages), `performances.html`,
`about.html`, `contact.html`. The audit reports these as warnings until they exist.
