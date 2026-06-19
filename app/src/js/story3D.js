'use strict';

/**
 * Scroll-driven 3D storytelling backdrop for the story page (story.html).
 *
 * Self-contained: it does NOT use the legacy scene engine that powers the
 * landing experience. A single fixed-position three.js canvas sits behind the
 * glass content panels; its state (camera dolly, the morphing centerpiece, the
 * starfield drift and the accent colour) is driven entirely by overall scroll
 * progress, so scrolling the resume "tells the story" chapter by chapter.
 *
 * The DOM choreography (reveal-on-scroll, chapter dots, progress bar, count-up
 * stats, print) is plain DOM + IntersectionObserver — no GSAP dependency, which
 * keeps this page bulletproof and light.
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const prefersReduced =
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------------------------------------------------- */
/*  DOM choreography                                                           */
/* -------------------------------------------------------------------------- */

function initDom() {
  // Current year
  document.querySelectorAll('.js-year').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // Reveal-on-scroll
  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && !prefersReduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // Count-up stats
  const stats = Array.from(document.querySelectorAll('.stat__num'));
  if ('IntersectionObserver' in window && !prefersReduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    stats.forEach((el) => io.observe(el));
  } else {
    stats.forEach((el) => {
      el.textContent = el.dataset.target + (el.dataset.suffix || '');
    });
  }

  // Chapter rail (built from the sections)
  buildRail();
}

function countUp(el) {
  const target = parseInt(el.dataset.target, 10) || 0;
  const suffix = el.dataset.suffix || '';
  const duration = 1100;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function buildRail() {
  const rail = document.getElementById('rail');
  const sections = Array.from(document.querySelectorAll('.chapter'));
  if (!rail) return;

  const dots = sections.map((section) => {
    const dot = document.createElement('button');
    dot.className = 'rail__dot';
    dot.setAttribute('aria-label', section.dataset.chapter || 'Chapter');
    const label = document.createElement('span');
    label.textContent = section.dataset.chapter || '';
    dot.appendChild(label);
    dot.addEventListener('click', () => {
      section.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
    });
    rail.appendChild(dot);
    return dot;
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const i = sections.indexOf(entry.target);
          dots.forEach((d, j) => d.classList.toggle('is-active', i === j));
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((s) => io.observe(s));
  }
}

/* Scroll progress (0..1) shared by the bar and the 3D scene. */
let scrollProgress = 0;
function updateScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  const bar = document.getElementById('progress');
  if (bar) bar.style.width = (scrollProgress * 100).toFixed(2) + '%';
}

/* -------------------------------------------------------------------------- */
/*  three.js storytelling scene                                               */
/* -------------------------------------------------------------------------- */

function initScene() {
  const mount = document.getElementById('scene');
  if (!mount) return;

  // WebGL feature check — leave the CSS gradient fallback if unavailable.
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070709, 0.055);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 12);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  mount.appendChild(renderer.domElement);

  // --- Lighting (for the matcap-free standard material centerpiece) -------
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.PointLight(0xffffff, 1.2, 60);
  key.position.set(8, 10, 14);
  scene.add(key);
  const rim = new THREE.PointLight(0x88aaff, 0.8, 60);
  rim.position.set(-12, -6, 6);
  scene.add(rim);

  // --- Starfield ----------------------------------------------------------
  const STAR_COUNT = 2600;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Distribute in a large spherical shell around the camera path.
    const r = 18 + Math.random() * 42;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi) - 20;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.07,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- Morphing point-cloud centerpiece ----------------------------------
  // Every chapter is a different 3D form, but instead of swapping meshes we
  // render ONE point cloud whose points flow from one shape into the next as
  // the story scrolls. Each shape is surface-sampled into the same number of
  // points (ordered into latitude/longitude bands so point N maps to a similar
  // direction across shapes), so the form genuinely morphs rather than one
  // shape shrinking away and another reappearing. The SB logo (chapter 0) is
  // sampled the same way once it loads and joins the morph.
  const isMobile = window.innerWidth < 768;
  const POINTS = isMobile ? 2800 : 5400;
  const detail = isMobile ? 0 : 1;

  const shapes = [
    new THREE.IcosahedronGeometry(2.4, detail), // chapter 0: SB logo swaps in
    new THREE.TorusKnotGeometry(1.6, 0.45, 140, 16),
    new THREE.OctahedronGeometry(2.6, 0),
    new THREE.DodecahedronGeometry(2.4, 0),
    new THREE.TorusGeometry(2.1, 0.5, 16, 80),
    new THREE.IcosahedronGeometry(2.5, detail),
    new THREE.TorusKnotGeometry(1.5, 0.5, 160, 20, 2, 3),
    new THREE.SphereGeometry(2.3, 28, 22),
  ];

  const coreGroup = new THREE.Group();
  scene.add(coreGroup);

  // Surface-sample a geometry into POINTS points, ordered by (elevation,
  // azimuth) about the origin. The shared ordering means index N lands in a
  // similar direction on every shape, so lerping index-to-index reads as a
  // coherent, band-by-band morph instead of random point scramble.
  function sampleShape(geometry) {
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build();
    const tmp = new THREE.Vector3();
    const raw = new Float32Array(POINTS * 3);
    for (let i = 0; i < POINTS; i++) {
      sampler.sample(tmp);
      raw[i * 3] = tmp.x;
      raw[i * 3 + 1] = tmp.y;
      raw[i * 3 + 2] = tmp.z;
    }
    const elev = (i) =>
      Math.atan2(raw[i * 3 + 1], Math.hypot(raw[i * 3], raw[i * 3 + 2]));
    const azim = (i) => Math.atan2(raw[i * 3 + 2], raw[i * 3]);
    const order = Array.from({ length: POINTS }, (_, i) => i).sort((a, b) => {
      const ea = elev(a);
      const eb = elev(b);
      return Math.abs(ea - eb) > 1e-3 ? ea - eb : azim(a) - azim(b);
    });
    const out = new Float32Array(POINTS * 3);
    for (let i = 0; i < POINTS; i++) {
      const s = order[i];
      out[i * 3] = raw[s * 3];
      out[i * 3 + 1] = raw[s * 3 + 1];
      out[i * 3 + 2] = raw[s * 3 + 2];
    }
    return out;
  }

  const shapeSamples = shapes.map((geo) => sampleShape(geo));

  const morphGeo = new THREE.BufferGeometry();
  const morphPos = new Float32Array(POINTS * 3);
  morphPos.set(shapeSamples[0]); // start settled on the first shape
  morphGeo.setAttribute('position', new THREE.BufferAttribute(morphPos, 3));
  const morphMat = new THREE.PointsMaterial({
    color: 0xaecbff,
    size: isMobile ? 0.06 : 0.05,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const morph = new THREE.Points(morphGeo, morphMat);
  coreGroup.add(morph);

  // Hero centerpiece: the SB logo (app/public/3D/sb.obj). Loads async; until
  // then chapter 0's icosahedron sample stands in. We centre, fit and orient it
  // face-on to the camera, strip non-position attributes so the sub-meshes
  // merge cleanly, then surface-sample it into the same point budget and drop
  // it into the first chapter's slot so it morphs like every other shape.
  new OBJLoader().load(
    '/app/public/3D/sb.obj',
    (obj) => {
      const geos = [];
      obj.traverse((child) => {
        if (child.isMesh && child.geometry) geos.push(child.geometry);
      });
      if (!geos.length) return;

      const box = new THREE.Box3();
      geos.forEach((g) => {
        g.computeBoundingBox();
        box.union(g.boundingBox);
      });
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const fit = 4.6 / (Math.max(size.x, size.y, size.z) || 1);
      const orient = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(0, -Math.PI / 2, 0) // flat monogram faces the camera
      );

      geos.forEach((g) => {
        g.translate(-center.x, -center.y, -center.z);
        g.scale(fit, fit, fit);
        g.applyMatrix4(orient);
        g.deleteAttribute('uv'); // keep attributes uniform for the merge
        g.deleteAttribute('normal');
      });

      let merged;
      try {
        merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
      } catch (e) {
        merged = geos[0];
      }
      if (merged) shapeSamples[0] = sampleShape(merged);
    },
    undefined,
    () => {
      /* keep the icosahedron-sample fallback on error */
    }
  );

  // Glowing point cloud that haloes the centerpiece.
  const haloCount = 900;
  const haloGeo = new THREE.BufferGeometry();
  const haloPos = new Float32Array(haloCount * 3);
  for (let i = 0; i < haloCount; i++) {
    const r = 3.2 + Math.random() * 1.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    haloPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    haloPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    haloPos[i * 3 + 2] = r * Math.cos(phi);
  }
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const haloMat = new THREE.PointsMaterial({
    color: 0xaecbff,
    size: 0.05,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const halo = new THREE.Points(haloGeo, haloMat);
  coreGroup.add(halo);

  // --- Pointer parallax ---------------------------------------------------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );

  // --- Resize -------------------------------------------------------------
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // --- Render loop --------------------------------------------------------
  // Track elapsed time manually (THREE.Clock is deprecated) so the gap accrued
  // while the tab was hidden can be discarded, avoiding a rotation jump.
  let elapsed = 0;
  let lastTime = performance.now();
  const accent = new THREE.Color();

  function render() {
    const now = performance.now();
    elapsed += (now - lastTime) / 1000;
    lastTime = now;
    const t = elapsed;
    const p = scrollProgress; // 0..1 across the whole page

    // Morph the point cloud between the current and next chapter's shape. Each
    // point eases toward its interpolated target every frame, so the form flows
    // from one shape into the next instead of one shrinking away and another
    // appearing. shapeSamples[0] is swapped to the SB logo once it loads, so the
    // hero joins the same morph automatically.
    const seg = p * (shapeSamples.length - 1);
    const i0 = Math.min(shapeSamples.length - 1, Math.floor(seg));
    const i1 = Math.min(shapeSamples.length - 1, i0 + 1);
    let f = seg - i0;
    f = f * f * (3 - 2 * f); // smoothstep between the two shapes
    const from = shapeSamples[i0];
    const to = shapeSamples[i1];
    for (let k = 0; k < morphPos.length; k++) {
      const target = from[k] + (to[k] - from[k]) * f;
      morphPos[k] += (target - morphPos[k]) * 0.16;
    }
    morphGeo.attributes.position.needsUpdate = true;

    // The whole core group gently rocks (so the SB logo stays roughly face-on
    // near the top) and rotates through as the story scrolls, dollying subtly.
    coreGroup.rotation.y = Math.sin(t * 0.25) * 0.25 + p * Math.PI * 1.4;
    coreGroup.rotation.x = Math.sin(t * 0.15) * 0.12 + pointer.y * 0.15;
    coreGroup.position.y = Math.sin(t * 0.4) * 0.18;

    halo.rotation.y = -t * 0.08;
    halo.rotation.x = t * 0.04;

    // Starfield slow drift + scroll-coupled roll.
    stars.rotation.y = t * 0.01 + p * 0.6;
    stars.rotation.x = p * 0.3;

    // Accent colour shifts across the story (cool white -> blue -> warm).
    const hue = 0.6 - p * 0.18; // 0.6 (blue) toward 0.42 (cyan/green-ish)
    accent.setHSL(hue, 0.5, 0.72);
    rim.color.copy(accent);
    haloMat.color.copy(accent);
    morphMat.color.copy(accent); // the morphing point cloud tracks the accent

    // Camera: smooth pointer parallax + a slight push-in past mid-story.
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    camera.position.x += (pointer.x * 1.6 - camera.position.x) * 0.05;
    camera.position.y += (-pointer.y * 1.0 - camera.position.y) * 0.05;
    const targetZ = 12 - Math.sin(p * Math.PI) * 2.4; // closest near the middle
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(render);
  }

  let rafId = requestAnimationFrame(render);

  // Pause the loop when the tab is hidden to save battery.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      lastTime = performance.now(); // discard the hidden gap
      rafId = requestAnimationFrame(render);
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Boot                                                                       */
/* -------------------------------------------------------------------------- */

function boot() {
  initDom();
  updateScrollProgress();
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);
  if (!prefersReduced) initScene();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
