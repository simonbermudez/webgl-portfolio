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

  // Print / PDF buttons
  document.querySelectorAll('#print-btn, #print-btn-2').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.print();
    });
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

  // --- Morphing centerpiece ----------------------------------------------
  // One geometry per chapter; we cross-fade scale between them as the story
  // advances so the central object "transforms" with each scroll chapter.
  const detail = window.innerWidth < 768 ? 0 : 1;
  const shapes = [
    new THREE.IcosahedronGeometry(2.4, detail),
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

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  });
  const fillMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c10,
    metalness: 0.6,
    roughness: 0.35,
    transparent: true,
    opacity: 0.9,
  });

  // Holographic grid shader for the SB logo: a dense, static triplanar grid
  // with a fresnel rim glow and a soft constant body glow. Additive blending
  // makes it luminesce on the black backdrop.
  const logoUniforms = {
    uScale: { value: 4.6 }, // grid density (cells per local unit)
    uColor: { value: new THREE.Color(0x0a1018) }, // dim base fill
    uGlow: { value: new THREE.Color(0xaecbff) }, // line / rim colour (tracks accent)
    uOpacity: { value: 1.0 },
  };
  const logoMat = new THREE.ShaderMaterial({
    uniforms: logoUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    extensions: { derivatives: true }, // fwidth() (no-op on WebGL2)
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vLocal = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uScale;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform vec3 uGlow;
      varying vec3 vLocal;
      varying vec3 vNormal;
      varying vec3 vView;

      // Anti-aliased triplanar grid: 1.0 on the lines, 0.0 between them.
      float gridLines(vec3 p) {
        vec3 d = fwidth(p);
        vec3 a = abs(fract(p - 0.5) - 0.5) / max(d, vec3(1e-5));
        float line = min(min(a.x, a.y), a.z);
        return 1.0 - clamp(line, 0.0, 1.0);
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vView);
        float fres = pow(1.0 - abs(dot(n, v)), 2.0);

        float grid = gridLines(vLocal * uScale);

        // dense grid lines + fresnel rim + a faint constant body glow
        float glow = grid * 0.9 + fres * 1.3 + 0.14;
        vec3 col = uColor + uGlow * glow;
        float alpha = clamp(grid * 0.6 + fres * 0.9 + 0.14, 0.0, 1.0) * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const meshes = shapes.map((geo) => {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(geo, fillMat);
    const wire = new THREE.Mesh(geo, wireMat);
    wire.scale.setScalar(1.001);
    g.add(fill);
    g.add(wire);
    g.scale.setScalar(0.0001);
    g.visible = false;
    coreGroup.add(g);
    return g;
  });

  // Hero centerpiece: the SB logo (app/public/3D/sb.obj) rendered with the
  // animated holographic grid shader above. Loads async; until then the
  // icosahedron stands in. We bake the centre/scale transform into the geometry
  // (so the grid is in object space and rotates with the logo) and swap it into
  // the first chapter's slot (meshes[0]) to inherit the scroll blend/spin.
  new OBJLoader().load(
    '/app/public/3D/sb.obj',
    (obj) => {
      const geos = [];
      obj.traverse((child) => {
        if (child.isMesh && child.geometry) geos.push(child.geometry);
      });
      if (!geos.length) return;

      // Combined bounding box across all sub-meshes (they share object space).
      const box = new THREE.Box3();
      geos.forEach((g) => {
        g.computeBoundingBox();
        box.union(g.boundingBox);
      });
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const fit = 4.2 / (Math.max(size.x, size.y, size.z) || 1);

      const logo = new THREE.Group();
      geos.forEach((g) => {
        g.translate(-center.x, -center.y, -center.z);
        g.scale(fit, fit, fit);
        g.computeVertexNormals(); // ensure normals exist for the fresnel term
        logo.add(new THREE.Mesh(g, logoMat));
      });

      const slot = meshes[0];
      slot.clear(); // drop the placeholder icosahedron
      slot.add(logo);
    },
    undefined,
    () => {
      /* keep the icosahedron fallback on error */
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
  // Fixed world orientation for the hero logo: face-on to the camera, matching
  // the flat /logo.png monogram. Never spins (just floats).
  const logoFixedQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, -Math.PI / 2, 0)
  );

  function render() {
    const now = performance.now();
    elapsed += (now - lastTime) / 1000;
    lastTime = now;
    const t = elapsed;
    const p = scrollProgress; // 0..1 across the whole page

    // Which chapter are we in? Cross-fade the matching shape in, others out.
    const seg = p * (meshes.length - 1);
    meshes.forEach((g, i) => {
      const dist = Math.abs(i - seg);
      const target = dist < 1 ? 1 - dist : 0; // triangular blend with neighbours
      const cur = g.scale.x;
      const next = cur + (target - cur) * 0.08;
      g.visible = next > 0.01;
      g.scale.setScalar(Math.max(0.0001, next));
      // Hero slot (i === 0) holds the SB logo — orientation handled after the
      // coreGroup rotation below so it can be cancelled out. Other shapes tumble.
      if (i !== 0) {
        g.rotation.x += 0.0015 + i * 0.0001;
        g.rotation.y += 0.0022 + i * 0.0001;
      }
    });

    // The whole core group rotates with scroll + time, and dollies subtly.
    coreGroup.rotation.y = t * 0.06 + p * Math.PI * 1.5;
    coreGroup.rotation.x = Math.sin(t * 0.15) * 0.12 + pointer.y * 0.15;
    coreGroup.position.y = Math.sin(t * 0.4) * 0.18;

    // Hero logo: cancel the parent's rotation so it never spins, then let it
    // drift gently as if floating in place.
    const logo = meshes[0];
    logo.quaternion.copy(coreGroup.quaternion).invert().multiply(logoFixedQuat);
    logo.position.set(Math.sin(t * 0.5) * 0.1, Math.sin(t * 0.75) * 0.22, 0);

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

    // The logo grid is static; only its glow colour tracks the scene accent.
    logoUniforms.uGlow.value.copy(accent);

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
