'use strict';

/**
 * Vendor bootstrap for the npm/ESM build.
 *
 * Under the old browserify+bower setup, jQuery and GSAP were loaded as UMD
 * globals (window.jQuery, window.gsap, window.TweenLite, window.Quart, ...) and
 * the scene code reads several of them directly (e.g. `ease: window.Quart.easeOut`).
 * Now that everything resolves through npm/ESM, re-expose those globals here and
 * install the jquery.gsap compatibility shim, so the ~70 legacy modules keep
 * working without touching every call site.
 *
 * Import this module first from each entry point (main3D.js / main2D.js).
 */
import $ from 'jquery';
import * as gsapAll from 'gsap';
import installJqueryGsap from '../../shims/jquery.gsap.js';

var gsap = gsapAll.gsap;

// jQuery globals (plugins and inline HTML may expect them)
window.jQuery = window.$ = $;

// GSAP core globals used by the scene code
window.gsap = gsap;
window.TweenLite = gsapAll.TweenLite;
window.TweenMax = gsapAll.TweenMax;
window.TimelineLite = gsapAll.TimelineLite;
window.TimelineMax = gsapAll.TimelineMax;

// Legacy ease globals (window.Quart.easeOut, window.Linear.easeNone, ...).
// Only expose the ones GSAP 3 actually re-exports.
[
  'Quad', 'Cubic', 'Quart', 'Quint', 'Linear', 'Elastic', 'Back', 'Sine',
  'Strong', 'Expo', 'Circ', 'Bounce', 'SteppedEase',
  'Power0', 'Power1', 'Power2', 'Power3', 'Power4'
].forEach(function (name) {
  if (gsapAll[name]) { window[name] = gsapAll[name]; }
});

// jQuery .animate()/.delay()/.stop() -> gsap, plus the `this.target` callback shim
installJqueryGsap($, gsap);

// Default ease for all tweens (was TweenLite.defaultEase in GSAP 1)
gsap.defaults({ ease: 'quad.inOut' });

export { gsap };
export default $;
