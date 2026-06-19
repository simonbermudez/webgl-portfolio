# a WebGL experiment

A scroll-driven 3D portfolio built with [three.js](https://threejs.org/) and
[Vite](https://vite.dev/).

## Requirements

- Node.js (tested on Node 22) and npm

## Instructions

```
$ npm install     # install dependencies (three, gsap, jquery, vite, ...)
$ npm run dev      # start the dev server at http://localhost:8000
$ npm run build    # production build -> dist/
$ npm run preview  # serve the production build locally
```

### Development

`npm run dev` starts Vite with hot-module reload — the page updates as you save.
This is a **multi-page** build with two entries:

- [`index.html`](index.html) — the landing experience. Loads
  [`app/src/js/index.js`](app/src/js/index.js), which feature-detects WebGL and
  lazy-loads either the full 3D experience (`main3D.js`) or the 2D fallback
  (`main2D.js`).
- [`story/index.html`](story/index.html) — a scroll-driven 3D **storytelling
  resume** served at `/story/` (linked as "3D Story" from the About panel; the
  "Resume" button still points to the `/resume` PDF). Self-contained: a single
  fixed three.js canvas ([`app/src/js/story3D.js`](app/src/js/story3D.js)) whose
  centerpiece, camera and starfield are driven by scroll progress. The hero
  centerpiece is the SB logo (`app/public/3D/sb.obj`) loaded via `OBJLoader` and
  rendered in the same wireframe style; project cards, a studio portrait and the
  Dean's List certificates are shown as monochrome imagery that colours on hover.
  The DOM choreography (reveal-on-scroll, chapter rail, count-up stats,
  print-to-PDF) is plain DOM + IntersectionObserver. It reuses the site's
  monochrome aesthetic but does not touch the legacy scene engine. Because the
  page lives one directory deep, its assets use root-absolute paths
  (`/app/public/...`).

Both pages are wired into the production build via `rollupOptions.input` in
[`vite.config.js`](vite.config.js).

### Production

`npm run build` outputs a self-contained site to `dist/` (hashed JS/CSS bundles
plus the static assets under `dist/app/public/`). Deploy the contents of `dist/`.

## Dependencies

All front-end libraries are installed from npm (`package.json`): three.js,
jQuery 4, GSAP 3, howler 2, skrollr, normalize.css. There is no longer a Bower or
gulp step.

A couple of things worth knowing:

- **GSAP compatibility shim.** GSAP 3 dropped the old `jquery.gsap.js` plugin the
  project relied on, so a hand-written replacement lives in
  [`app/src/shims/jquery.gsap.js`](app/src/shims/jquery.gsap.js). It is wired up
  (along with the legacy `window.gsap` / ease globals the scene code reads) by
  [`app/src/js/vendor/gsapSetup.js`](app/src/js/vendor/gsapSetup.js), imported
  first from each entry point.
- **3D models** load from `app/public/3D/*.js` via
  [`app/src/js/utils/legacyModelUtil.js`](app/src/js/utils/legacyModelUtil.js), a
  small parser for the legacy three.js JSON model format (the removed
  `THREE.JSONLoader`).

History of the dependency upgrades — including the three.js r68 → r184 migration —
is in [`UPGRADE-NOTES.md`](UPGRADE-NOTES.md).
