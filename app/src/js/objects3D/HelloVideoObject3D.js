'use strict';

import jQuery from 'jquery';
import * as THREE from 'three';
import { TweenLite } from 'gsap';

import MobileUtils from '../utils/mobileUtils.js';

/**
 * Hello video particles (GPU-driven).
 *
 * Replaces the old "HELLO" sprite with a looping video (Simon saying hi)
 * rendered as a dense, interactive point cloud. The video is uploaded once per
 * frame as a THREE.VideoTexture and every particle samples its own pixel inside
 * the vertex shader — colour, size and a brightness "pop" are all computed on
 * the GPU, and the pointer push is a single uniform. There is no per-frame
 * pixel readback or per-particle CPU loop, so the grid can run at high (near
 * full-resolution) density cheaply.
 *
 * Lives inside the scroll-driven scene: exposes the same in/out/start/stop
 * surface as the other section objects, fits phone through desktop viewports,
 * and derives its visibility from the camera each frame so scrolling away/back
 * can never leave it stranded.
 *
 * @class HelloVideo
 * @constructor
 * @param {Object} [options]
 * @param {String} [options.src] Video URL
 * @requires jQuery, THREE, TweenLite, MobileUtils
 */
function HelloVideo (options) {
  var parameters = jQuery.extend({}, HelloVideo.defaultOptions, options);

  var isMobile = MobileUtils.isMobile();

  // Particle grid (16:9). High density now that sampling is on the GPU.
  this.rows = isMobile ? 120 : 208;
  this.cols = Math.round(this.rows * 16 / 9);
  this.count = this.cols * this.rows;

  // Base plane size in world units (16:9). fit() scales el to the viewport.
  this.baseHeight = 18;
  this.baseWidth = this.baseHeight * 16 / 9;

  this.camera = null;
  this.running = false;
  this._revealed = false;
  this._rafId = null;

  // Interaction radius / strength, in plane-local units. Kept gentle so the
  // hover reads as a soft ripple rather than blowing a hole in the image.
  this.radius = this.baseWidth * 0.12;
  this.pushXY = this.baseWidth * 0.05;
  this.pushZ = 3.5;
  this.popZ = 3.2;          // video-brightness relief depth

  this.dpr = Math.min(window.devicePixelRatio || 1, 2);

  this._buildVideo(parameters.src);
  this._buildGeometry();

  this.el = new THREE.Points(this.geometry, this.material);
  this.el.frustumCulled = false;

  // Pointer raycast scratch + eased pointer state.
  this._raycaster = new THREE.Raycaster();
  this._plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  this._ndc = new THREE.Vector2();
  this._hit = new THREE.Vector3();
  this._pointerActive = false;
  this._pointerLocal = new THREE.Vector3();
  this._pointerLerp = new THREE.Vector3();
  this._strength = 0;

  this._bindPointer();
  this.fit();

  this._onResize = this.fit.bind(this);
  jQuery(window).on('resize', this._onResize);
}

HelloVideo.defaultOptions = {
  src: './app/public/video/hi.mp4'
};

// Each particle samples its own pixel from the video texture and is displaced by
// the pointer — all on the GPU.
HelloVideo.vertexShader = [
  'uniform sampler2D uVideo;',
  'uniform float uReveal;',
  'uniform float uPointSize;',
  'uniform vec3 uPointer;',
  'uniform float uPointerStrength;',
  'uniform float uRadius;',
  'uniform float uPushXY;',
  'uniform float uPushZ;',
  'uniform float uPopZ;',
  'attribute vec2 aUv;',
  'attribute vec3 aOffset;',
  'varying vec3 vColor;',
  'void main () {',
  '  vec3 col = texture2D(uVideo, aUv).rgb;',
  '  vColor = col;',
  '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
  '  vec3 p = position;',
  '  if (uPointerStrength > 0.001) {',
  '    vec2 d = p.xy - uPointer.xy;',
  '    float dist = length(d);',
  '    if (dist < uRadius) {',
  '      float f = 1.0 - dist / uRadius;',
  '      f = f * f * uPointerStrength;',
  '      vec2 dir = dist > 0.0001 ? d / dist : vec2(1.0, 0.0);',
  '      p.xy += dir * f * uPushXY;',
  '      p.z += f * uPushZ;',
  '    }',
  '  }',
  '  p.z += lum * uPopZ;',
  '  p += aOffset * (1.0 - uReveal);',
  '  gl_PointSize = uPointSize * (0.5 + lum) * uReveal;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
  '}'
].join('\n');

HelloVideo.fragmentShader = [
  'uniform float uOpacity;',
  'varying vec3 vColor;',
  'void main () {',
  '  vec2 c = gl_PointCoord - vec2(0.5);',
  '  float d = dot(c, c);',
  '  if (d > 0.25) discard;',
  '  float a = smoothstep(0.25, 0.04, d);',
  '  gl_FragColor = vec4(vColor, a * uOpacity);',
  '}'
].join('\n');

/**
 * Build the looping, muted, inline video + its GPU VideoTexture.
 *
 * @method _buildVideo
 */
HelloVideo.prototype._buildVideo = function (src) {
  var video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  this.video = video;

  var texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  // Video frames arrive top-row-first; sample them un-flipped so the cloud is
  // the right way up.
  texture.flipY = false;
  this.texture = texture;

  video.load();
};

/**
 * Build the point cloud geometry + shader material. Positions, sample UVs and
 * reveal offsets are uploaded once; everything else is per-frame uniforms.
 *
 * @method _buildGeometry
 */
HelloVideo.prototype._buildGeometry = function () {
  var cols = this.cols;
  var rows = this.rows;
  var count = this.count;
  var hw = this.baseWidth / 2;
  var hh = this.baseHeight / 2;

  var positions = new Float32Array(count * 3);
  var uvs = new Float32Array(count * 2);
  var offsets = new Float32Array(count * 3);

  var i = 0;
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      var u = (x + 0.5) / cols;
      var v = (y + 0.5) / rows;

      positions[i * 3] = (u * 2 - 1) * hw;       // left -> right
      positions[i * 3 + 1] = (1 - v * 2) * hh;   // top -> bottom
      positions[i * 3 + 2] = 0;

      // Mirror X so the selfie video reads like a mirror.
      uvs[i * 2] = 1 - u;
      uvs[i * 2 + 1] = v;

      // Deterministic scatter for the reveal (no Math.random in the build path).
      var h1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      h1 = h1 - Math.floor(h1);
      var h2 = Math.sin(x * 39.346 + y * 11.135) * 24634.633;
      h2 = h2 - Math.floor(h2);
      var theta = h1 * Math.PI * 2;
      var spread = 6 + h2 * 10;
      offsets[i * 3] = Math.cos(theta) * spread;
      offsets[i * 3 + 1] = Math.sin(theta) * spread;
      offsets[i * 3 + 2] = (h2 - 0.5) * 8;

      i++;
    }
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
  this.geometry = geometry;

  this.uniforms = {
    uVideo: { value: this.texture },
    uReveal: { value: 0 },
    uOpacity: { value: 0 },
    uPointSize: { value: 2 },
    uPointer: { value: new THREE.Vector3() },
    uPointerStrength: { value: 0 },
    uRadius: { value: this.radius },
    uPushXY: { value: this.pushXY },
    uPushZ: { value: this.pushZ },
    uPopZ: { value: this.popZ }
  };

  this.material = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: HelloVideo.vertexShader,
    fragmentShader: HelloVideo.fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
};

/**
 * Track the pointer (mouse + touch) in normalised device coordinates so the
 * render step can raycast it onto the particle plane.
 *
 * @method _bindPointer
 */
HelloVideo.prototype._bindPointer = function () {
  var _this = this;

  function set (clientX, clientY) {
    _this._ndc.x = (clientX / window.innerWidth) * 2 - 1;
    _this._ndc.y = -((clientY / window.innerHeight) * 2 - 1);
    _this._pointerActive = true;
  }

  this._onPointerMove = function (e) { set(e.clientX, e.clientY); };
  this._onTouchMove = function (e) {
    if (e.touches && e.touches.length) {
      set(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  this._onPointerLeave = function () { _this._pointerActive = false; };

  window.addEventListener('pointermove', this._onPointerMove, { passive: true });
  window.addEventListener('touchmove', this._onTouchMove, { passive: true });
  window.addEventListener('touchend', this._onPointerLeave, { passive: true });
  window.addEventListener('mouseout', this._onPointerLeave, { passive: true });
};

/**
 * Give the object the live scene camera so pointer raycasting is exact.
 *
 * @method setCamera
 * @param {THREE.Camera} camera
 */
HelloVideo.prototype.setCamera = function (camera) {
  this.camera = camera;
  this.fit();
};

/**
 * Scale the cloud to fit the current viewport and size the points to the grid
 * spacing so they read as a near-continuous image at any size.
 *
 * @method fit
 */
HelloVideo.prototype.fit = function () {
  // Size against the camera's SETTLED fov (the scene zooms fov 200 -> 60 on
  // entry); the pointer raycast still uses the live camera, so it stays exact.
  var fov = 60;
  var dist = (this.camera && this.camera.position) ? this.camera.position.z : 40;
  var aspect = window.innerWidth / Math.max(1, window.innerHeight);

  var visibleH = 2 * dist * Math.tan((fov * Math.PI) / 360);
  var visibleW = visibleH * aspect;

  var scale = Math.min(
    (visibleW * 0.92) / this.baseWidth,
    (visibleH * 0.64) / this.baseHeight
  );
  if (!isFinite(scale) || scale <= 0) {
    scale = 1;
  }

  this._scale = scale;
  this.el.scale.set(scale, scale, scale);

  // Point diameter ~= on-screen spacing between adjacent particles, so the grid
  // fills in without big gaps or heavy overdraw.
  var planeScreenPx = (this.baseHeight * scale / visibleH) * window.innerHeight;
  var spacingPx = planeScreenPx / this.rows;
  this.uniforms.uPointSize.value = Math.max(1.5, spacingPx * 1.7);
};

/**
 * Fade factor (0..1) for how centred this section is on the camera.
 *
 * @method _visibility
 * @return {Number}
 */
HelloVideo.prototype._visibility = function () {
  if (!this.camera) {
    return 1;
  }
  var sectionY = this.el.parent ? this.el.parent.position.y : 0;
  var d = Math.abs(this.camera.position.y - sectionY);
  var v = 1 - (d - 15) / 25; // visible within 15 units, gone by 40 (spacing 50)
  return Math.max(0, Math.min(1, v));
};

/**
 * Raycast the pointer onto the particle plane (object-local space).
 *
 * @method _raycastPointer
 * @return {Boolean} whether a usable pointer position is available
 */
HelloVideo.prototype._raycastPointer = function () {
  this._raycaster.setFromCamera(this._ndc, this.camera);
  if (!this._raycaster.ray.intersectPlane(this._plane, this._hit)) {
    return false;
  }
  this.el.updateWorldMatrix(true, false);
  this._pointerLocal.copy(this._hit);
  this.el.worldToLocal(this._pointerLocal);
  return true;
};

/**
 * Per-frame update: camera-driven fade, video upload, eased pointer uniform.
 * All particle work happens on the GPU, so this stays O(1).
 *
 * @method _update
 */
HelloVideo.prototype._update = function () {
  if (!this.running) {
    return;
  }
  this._rafId = window.requestAnimationFrame(this._loop);

  // Camera-driven visibility (self-correcting; immune to stray scroll events).
  var vis = this._visibility();
  var uo = this.uniforms.uOpacity;
  uo.value += (vis - uo.value) * 0.1;

  if (vis < 0.02) {
    if (!this.video.paused) {
      try { this.video.pause(); } catch (e) { /* noop */ }
    }
  } else {
    if (this.video.paused) {
      var resume = this.video.play();
      if (resume && resume.catch) {
        resume.catch(function () {});
      }
    }
    // Push the current video frame to the GPU.
    if (this.video.readyState >= 2) {
      this.texture.needsUpdate = true;
    }
  }

  // Eased pointer: the displacement field smoothly follows the cursor and
  // deflates when it leaves, without per-particle CPU state.
  var targetStrength = (this._pointerActive && this.camera) ? 1 : 0;
  this._strength += (targetStrength - this._strength) * 0.12;

  if (targetStrength > 0 && this._raycastPointer()) {
    this._pointerLerp.lerp(this._pointerLocal, 0.25);
  }

  this.uniforms.uPointer.value.copy(this._pointerLerp);
  this.uniforms.uPointerStrength.value = this._strength;
};

/**
 * Reveal. Visibility itself is camera-driven; in() just ensures the loop is live
 * and plays the one-time scatter-in the first time we appear.
 *
 * @method in
 */
HelloVideo.prototype.in = function () {
  this.start();
};

/**
 * No-op: the camera-driven fade in _update handles hiding, so a stray out()
 * from the scroll system can never leave the video stuck invisible.
 *
 * @method out
 */
HelloVideo.prototype.out = function () {};

/**
 * Start the loop + video playback.
 *
 * @method start
 */
HelloVideo.prototype.start = function () {
  if (!this._revealed) {
    this._revealed = true;
    TweenLite.to(this.uniforms.uReveal, 1.6, { value: 1, ease: 'power3.out' });
  }

  if (this.running) {
    return;
  }
  this.running = true;

  var play = this.video.play();
  if (play && play.catch) {
    play.catch(function () {});
  }

  var _this = this;
  this._loop = function () { _this._update(); };
  this._update();
};

/**
 * Pause the loop + playback. Visibility is restored automatically by start()
 * (called whenever the section becomes current again).
 *
 * @method stop
 */
HelloVideo.prototype.stop = function () {
  if (!this.running) {
    return;
  }
  this.running = false;

  if (this._rafId) {
    window.cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  try {
    this.video.pause();
  } catch (e) { /* noop */ }
};

export default HelloVideo;
