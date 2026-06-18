'use strict';

/**
 * App entry. Feature-detects WebGL and lazy-loads either the full 3D
 * experience (main3D) or the 2D fallback (main2D). Vite code-splits these into
 * separate chunks, so the heavy three.js bundle is only fetched when WebGL is
 * available.
 */

function webGLAvailable() {
  try {
    var canvas = document.createElement('canvas');
    return !!window.WebGLRenderingContext &&
      !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

// Silence console noise in production (matches the old inline loader behaviour).
if (import.meta.env.PROD && window.console) {
  ['log', 'debug', 'warn', 'info'].forEach(function (method) {
    console[method] = function () {};
  });
}

if (webGLAvailable()) {
  import('./main3D.js');
} else {
  import('./main2D.js');
}
