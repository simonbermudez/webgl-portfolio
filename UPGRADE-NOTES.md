# Dependency upgrade notes

This branch (`dependency-update`) brings the build toolchain and front-end
libraries up to their latest versions. The 3D portfolio was verified running in
a real browser (WebGL scene initialises, sections navigate, no runtime errors)
in both debug and production (minified) builds.

## Build tooling (`package.json` devDependencies)

| Package | Before | After |
|---|---|---|
| gulp | 3.8 | **5.0** |
| browserify | 6 | **17** |
| watchify | 3.7 | **4.0** |
| gulp-less | 1.3 | **5.0** |
| gulp-htmlmin | 1.0 | **5.0** |
| gulp-uglify | 1.0 | **3.0** |
| gulp-rename | 1.2 | **2.1** |
| gulp-concat | 2.4 | **2.6** |
| gulp-connect | 2.2 | **5.7** |
| gulp-jshint + jshint | 1.9 | **2.1** (+ jshint 2.13) |
| jshint-stylish | 1.0 | **2.2** |
| vinyl-source-stream | 1.0 | **2.0** |
| vinyl-buffer | 1.0 | **1.0.1** |
| browserify-shim | 3.8 | **3.8.16** |

Replaced (deprecated, no maintained successor under the old name):

- `gulp-util` → `fancy-log` (logging) + inline terminal bell + `gulp/utils/noop.js`
  (an object-mode `PassThrough` replacing `gutil.noop()`).
- `gulp-minify-css` → `gulp-clean-css`.

### gulp 4/5 migration (`gulp/tasks/*.js`)

- Array-style task dependencies (`gulp.task('build', ['html', ...])`) are gone;
  they now use `gulp.parallel(...)`. The aggregate `build` tasks compose inside
  the task function so task names resolve at run time (the task files are
  required alphabetically, so `build.js` loads before the tasks it references).
- Every task now returns its stream / takes a `done` callback.
- `gulp.watch` callbacks re-run the build function directly (the gulp 4+ watcher
  no longer passes a vinyl file to the handler).
- LESS 4 (via gulp-less 5) disables inline JavaScript by default; the
  `transition` mixin uses it, so `less({ javascriptEnabled: true })` is set.

## Front-end libraries

`app/src/vendor/` is git-ignored and provisioned by `bower install`. `bower.json`
was updated to the new versions; bower still resolves all of them from the GitHub
tags. The `browser` field in `package.json` points at bower's on-disk layout
(e.g. `gsap/dist/gsap.js`, `howler/dist/howler.js`).

| Library | Before | After | Notes |
|---|---|---|---|
| jQuery | 2.1.4 | **4.0.0** | API surface used (animate/on/each/…) is all v4-safe |
| normalize.css | 3.0.3 | **8.0.1** | final release |
| skrollr | 0.6.29 | **0.6.30** | final release (its internal `VERSION` const was never bumped past `0.6.29` upstream) |
| howler | 1.1.25 | **2.2.4** | see below |
| GSAP | 1.15.1 | **3.15.0** | see below |
| three.js | r68 | **r68 (kept)** | see below |

### howler 1 → 2

- `new Howl({ urls: [...] })` → `{ src: [...] }`.
- `Howler.mute()` / `Howler.unmute()` → `Howler.mute(true|false)`.
- `Howl.fadeIn` / `Howl.fadeOut` were removed in favour of
  `fade(from, to, duration)`. To keep the call sites in `main3D.js` unchanged,
  the looping `background` track in `soundsModule.js` gets thin `fadeIn`/`fadeOut`
  helpers that delegate to `fade()`.

### GSAP 1.15 → 3.15

GSAP 3's UMD build (`app/src/vendor/gsap/dist/gsap.js`) exposes the legacy
globals the codebase relies on (`TweenLite`, the `Quad`/`Quart`/`Linear`/`Elastic`
eases) and accepts the legacy `TweenLite.to(target, duration, vars)` signature, so
the ~54 scene tweens migrate as a drop-in. Two compatibility gaps had to be
bridged in `app/src/shims/jquery.gsap.js` — a hand-written shim that replaces the
discontinued GreenSock `jquery.gsap.js` plugin. It lives under `app/src/shims/`
(version-controlled) rather than `app/src/vendor/` because the vendor directory
is git-ignored and rewritten by `bower install`, which would clobber it:

1. **`$.fn.animate` / `$.fn.delay` / `$.fn.stop`** — the project animates DOM via
   `$(el).animate({ y: '50%' }, { easing: 'easeOutQuart' })`, which the old
   plugin routed through GSAP. The shim re-implements this on top of `gsap.to()`:
   maps jQuery easing names to GSAP eases, supports transform props (`y`, `x`),
   carries `.delay()` through as a gsap `delay` (so staggered animations keep
   their offset), and makes `.stop()` kill gsap tweens. Scroll animations
   (`scrollTop`) and jQuery `step` callbacks fall back to native `animate()`.
2. **`this.target` in callbacks** — GSAP 1 exposed the tween's target as
   `this.target` inside `onUpdate`/`onComplete`; GSAP 3 renamed it to
   `this.targets()[0]`. The shim restores a `target` getter on
   `gsap.core.Tween.prototype`, so the ~25 scene callbacks (`this.target.opacity`,
   `this.target.factor`, …) keep working without editing every call site.

`main3D.js` also sets the default ease via `gsap.defaults({ ease: 'quad.inOut' })`
instead of the removed `TweenLite.defaultEase`.

One behavioural fix was needed in `main3D.js`: the first `section:changeBegin`
(fired by `SCENE.start()`) has `from === to === 'hello'`, so the handler ran both
the section's `in()` (play) and `out()` (reverse). Under GSAP 1 the title still
appeared; under GSAP 3, `play()` immediately followed by `reverse()` leaves the
tween `reversed` at progress 0 (hidden), so the HELLO title only showed up after
the first scroll. The handler now treats `from` as empty when it equals `to`, so
the initial event only runs the entrance.

### three.js — r68 → r184 (migrated)

> **Update:** three.js has since been migrated from r68 to **r184**. This was a
> re-authoring effort (not a version bump) and is described in its own PR. The
> rest of this section documents what that migration entailed; it is no longer
> "out of scope". The build also moved from gulp/browserify/bower to **Vite +
> npm** as part of that work — see [`README.md`](README.md).

Bumping three.js to the current release is **not a version bump, it is a
re-authoring project**. What the migration required:

- **3D models** (`app/public/3D/*.js`) are in three.js' legacy JSON model format
  (`formatVersion 3.1`, produced by the old OBJ converter) and load via
  `THREE.JSONLoader`, which was **removed in r99**. They would have to be
  reconverted from the source `.obj` files (`assets/objs/…`) to glTF and loaded
  with `GLTFLoader`.
- Removed APIs used throughout the ~25 `objects3D/*` files: `THREE.Geometry`,
  `Face3`/`Face4`, `PointCloud`/`PointCloudMaterial`, `ImageUtils.loadTexture`,
  `SplineCurve3`, plus `ShaderMaterial` attribute changes.
- The r152 sRGB colour-management change shifts every colour in the scene.

This touches essentially every file in `objects3D/` and `materials/` and cannot
be verified without re-checking the visuals, so it is out of scope for a
dependency bump.

## Provisioning / reproducibility

A fresh clone is set up with `npm install` (toolchain) followed by
`bower install` (front-end libs into the git-ignored `app/src/vendor/`). Bower
still resolves the pinned versions, so the upgrade is reproducible today.

The one custom file that is **not** bower-managed is the GSAP shim at
`app/src/shims/jquery.gsap.js` — it is version-controlled precisely so that
`bower install` (which rewrites `app/src/vendor/`) cannot clobber it.

Bower itself is deprecated, so the eventual clean path is to migrate vendoring to
npm (or commit `app/src/vendor/`). That is a pre-existing architectural decision,
out of scope here.

## Verifying locally

```sh
npm install
bower install
npx gulp build && npx gulp bundle   # build vendor+app, then concat into bundle.js
npx gulp serve                      # http://localhost:8000
```

`package.json` flags: `debug: true` skips minification, `watch: true` rebuilds on
change.
