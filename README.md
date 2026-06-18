# a WebGL experiment

## Requirements

- Node.js (tested on Node 22) and npm
- The front-end libraries live (vendored) in `app/src/vendor/` — see
  [Front-end libraries](#front-end-libraries) below.

## Instructions

### Out of the box

```
$ npm install
$ npx gulp build
$ npx gulp bundle
$ npx gulp serve
```

> Commands are run with `npx gulp` so the project's local gulp 5 is used — no
> global gulp install required.

### In details

#### Before anything

```
$ npm install
```

This installs the build toolchain (gulp 5, browserify, etc.). It does **not**
fetch the front-end libraries — see [Front-end libraries](#front-end-libraries).

#### For development

Set `debug` and `watch` to **true** in `package.json`.

```
$ npx gulp build
```

The project will now auto rebuild on save.

#### For production

Set `debug` and `watch` to **false** in `package.json`.

```
$ npx gulp build
$ npx gulp bundle
```

`gulp build` compiles the app and vendor bundles; `gulp bundle` concatenates them
into the `bundle.js` that `index.html` loads. You can then grab the `index.html`
at the root, and everything in `app` (except `src`).

#### To serve

```
$ npx gulp serve
```

Go to `localhost:8000`.

## Front-end libraries

The browser libraries (jQuery, three.js, GSAP, howler, skrollr, normalize,
visibly) are vendored under `app/src/vendor/`, which is **git-ignored** — so a
fresh clone won't have them and the build will fail until they're present.

These were historically provisioned with `bower install`, but **bower is
discontinued** and its registry will not resolve the current versions
(jQuery 4, GSAP 3, howler 2, normalize 8). The working files therefore live in
`app/src/vendor/` on disk; `bower.json` only records the intended versions.

To set up `app/src/vendor/` on a new machine, copy it from a working checkout
(or, longer term, commit it / migrate vendoring to npm). The current versions
and the GSAP/howler compatibility notes are documented in
[`UPGRADE-NOTES.md`](UPGRADE-NOTES.md).
