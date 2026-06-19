'use strict';

import jQuery from 'jquery';
import * as THREE from 'three';
import { Timer } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

import random from '../utils/randomUtil.js';

/**
 * ABOUT
 *
 * A self-contained three.js experience that powers the "about / portfolio"
 * panel (`.tails`). It owns its own WebGLRenderer, scene and camera and renders
 * a living backdrop behind the (crisp, accessible) DOM content:
 *
 *   - an animated nebula gradient (fullscreen fragment shader)
 *   - a parallax starfield
 *   - slowly tumbling wireframe shards
 *   - a ring of floating cards textured with the real project screenshots
 *
 * The whole thing reacts to scroll position (camera dolly + ring rotation) and
 * to the pointer (parallax), and pauses its RAF loop whenever the panel is not
 * on screen. It degrades gracefully: if WebGL is unavailable the CSS gradient
 * background of `.tails` simply shows through.
 *
 * @module ABOUT
 * @requires jQuery, THREE, random
 */

var IMG_BASE = './app/public/img/about/';

// "SB" monogram logo (extruded SVG from Blender) parked at the centre of the
// project ring. Vendored locally so it loads same-origin (no CORS / runtime
// network dependency) and is copied verbatim into the build by Vite.
var LOGO_URL = './app/public/3D/sb.obj';

// Project screenshots shown as floating cards in the backdrop, in display order.
var PROJECTS = [
  'nasa.png',
  'qualifacts.png',
  'renderify.jpg',
  'zeitdice.jpg',
  'chess.jpg',
  'dijkstras.png',
  'dijkstras-maze.png',
  'michael-owen.jpg'
];

// Screenshots that are already dark — don't invert these for dark mode.
var DARK_PROJECTS = ['nasa.png', 'qualifacts.png'];

var BG_VERTEX = [
  'varying vec2 vUv;',
  'void main () {',
  '  vUv = uv;',
  '  gl_Position = vec4(position.xy, 0.0, 1.0);',
  '}'
].join('\n');

var BG_FRAGMENT = [
  'precision highp float;',
  'uniform float uTime;',
  'uniform float uScroll;',
  'uniform vec2 uMouse;',
  'uniform float uAspect;',
  'varying vec2 vUv;',
  'float hash (vec2 p) {',
  '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
  '}',
  'float noise (vec2 p) {',
  '  vec2 i = floor(p);',
  '  vec2 f = fract(p);',
  '  vec2 u = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
  '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
  '}',
  'float fbm (vec2 p) {',
  '  float v = 0.0;',
  '  float a = 0.5;',
  '  for (int i = 0; i < 5; i++) {',
  '    v += a * noise(p);',
  '    p *= 2.0;',
  '    a *= 0.5;',
  '  }',
  '  return v;',
  '}',
  'void main () {',
  '  vec2 uv = vUv;',
  '  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);',
  '  float t = uTime * 0.03;',
  '  vec2 q = p * 2.2 + vec2(t, -t * 0.6) + uMouse * 0.25;',
  '  float n = fbm(q + fbm(q * 0.5 + uScroll));',
  '  vec3 deep = vec3(0.035, 0.035, 0.045);',
  '  vec3 smoke = vec3(0.16, 0.16, 0.19);',
  '  vec3 glow = vec3(0.92, 0.92, 1.0);',
  '  vec3 col = deep;',
  '  col = mix(col, smoke, smoothstep(0.25, 0.95, n));',
  '  col += glow * 0.06 * smoothstep(0.6, 1.05, fbm(q * 1.4 + 10.0));',
  '  col += glow * 0.05 * smoothstep(0.85, 1.0, fbm(p * 3.0 + uScroll * 2.0));',
  '  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));',
  '  col *= vig * 1.12;',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

var ABOUT = (function () {
  var instance;

  function init () {
    var renderer, camera, scene;
    var bgScene, bgCamera, bgMaterial;
    var timer = new Timer();

    var $container, $scroll;
    var width = 1, height = 1;

    var frameId = null;
    var created = false;
    var running = false;

    var reducedMotion = false;
    try {
      reducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { reducedMotion = false; }

    // Scroll progress in [0,1] (smoothed), pointer parallax (smoothed).
    var scrollTarget = 0, scrollValue = 0;
    var mouseTargetX = 0, mouseTargetY = 0;
    var mouseX = 0, mouseY = 0;

    var stars, shards, ring, logo;
    var cards = [];

    // ---- builders ---------------------------------------------------------

    function starSprite () {
      var size = 64;
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      var ctx = canvas.getContext('2d');
      var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.6, 'rgba(140,200,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      var tex = new THREE.CanvasTexture(canvas);
      return tex;
    }

    function buildBackground () {
      bgScene = new THREE.Scene();
      bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      bgMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
          uAspect: { value: 1 }
        },
        vertexShader: BG_VERTEX,
        fragmentShader: BG_FRAGMENT,
        depthTest: false,
        depthWrite: false
      });
      bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));
    }

    function buildStars () {
      var count = 1800;
      var positions = new Float32Array(count * 3);
      var colors = new Float32Array(count * 3);
      var palette = [
        new THREE.Color('#ffffff'),
        new THREE.Color('#cfd6e6'),
        new THREE.Color('#9aa3b8')
      ];

      for (var i = 0; i < count; i++) {
        positions[i * 3] = random(-340, 340);
        positions[i * 3 + 1] = random(-300, 300);
        positions[i * 3 + 2] = random(-640, 60);

        var c = palette[Math.floor(random(0, palette.length))];
        var b = random(0.4, 1);
        colors[i * 3] = c.r * b;
        colors[i * 3 + 1] = c.g * b;
        colors[i * 3 + 2] = c.b * b;
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      var material = new THREE.PointsMaterial({
        size: 2.6,
        map: starSprite(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });

      stars = new THREE.Points(geometry, material);
      scene.add(stars);
    }

    function buildShards () {
      shards = new THREE.Group();

      var geometries = [
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.OctahedronGeometry(1, 0),
        new THREE.TetrahedronGeometry(1, 0)
      ];
      var colors = ['#ffffff', '#cfd6e6', '#aab2c8'];

      for (var i = 0; i < 16; i++) {
        var base = geometries[Math.floor(random(0, geometries.length))];
        var edges = new THREE.EdgesGeometry(base);
        var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: colors[Math.floor(random(0, colors.length))],
          transparent: true,
          opacity: random(0.12, 0.32),
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }));

        // Push shards out toward the sides / depth so they frame, not cover.
        var side = i % 2 === 0 ? 1 : -1;
        line.position.set(
          side * random(18, 60),
          random(-70, 70),
          random(-180, 10)
        );
        var s = random(2.5, 9);
        line.scale.set(s, s, s);
        line.rotation.set(random(0, 6.28), random(0, 6.28), random(0, 6.28));

        line.userData.spin = new THREE.Vector3(
          random(-0.15, 0.15),
          random(-0.2, 0.2),
          random(-0.15, 0.15)
        );
        line.userData.bob = random(0, 6.28);
        line.userData.baseY = line.position.y;

        shards.add(line);
      }

      scene.add(shards);
    }

    function buildRing () {
      ring = new THREE.Group();
      ring.rotation.x = -0.08;
      scene.add(ring);

      var loader = new THREE.TextureLoader();
      var radius = 30;
      var n = PROJECTS.length;

      PROJECTS.forEach(function (file, i) {
        var angle = (i / n) * Math.PI * 2;
        var holder = new THREE.Group();
        holder.position.set(
          Math.sin(angle) * radius,
          random(-12, 12),
          Math.cos(angle) * radius
        );
        // Face outward from the central axis.
        holder.rotation.y = angle;

        var material = new THREE.MeshBasicMaterial({
          color: '#0b0d16',
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        var card = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), material);

        // Thin glowing frame behind the card.
        var frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.PlaneGeometry(16.8, 10.8)),
          new THREE.LineBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        holder.add(frame);
        holder.add(card);

        holder.userData.bob = random(0, 6.28);
        holder.userData.baseY = holder.position.y;
        ring.add(holder);
        cards.push({ holder: holder, mesh: card });

        loader.load(IMG_BASE + file, function (tex) {
          var img = tex.image;
          var map = tex;

          // Dark-mode the screenshot: redraw it inverted so the floating cards
          // match the dark theme instead of glowing as bright white panels.
          // Images that are already dark are left as-is.
          if (img && img.width && img.height) {
            if (DARK_PROJECTS.indexOf(file) === -1) {
              try {
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.filter = 'invert(1) hue-rotate(180deg)';
                ctx.drawImage(img, 0, 0);
                map = new THREE.CanvasTexture(canvas);
              } catch (e) {
                map = tex;
              }
            }

            // Match the plane aspect to the image so screenshots aren't squashed.
            var aspect = img.width / img.height;
            var h = 10;
            var w = h * aspect;
            card.scale.set(w / 16, h / 10, 1);
          }

          map.minFilter = THREE.LinearFilter;
          map.generateMipmaps = false;
          material.map = map;
          material.color.set('#ffffff');
          material.needsUpdate = true;
        });
      });
    }

    // The rest of the backdrop is unlit (basic / points / line materials, which
    // ignore lights). These lights exist solely to give the central logo real
    // 3D form; they have no effect on the stars, shards or cards.
    function buildLights () {
      scene.add(new THREE.AmbientLight('#6b7280', 0.55));

      var key = new THREE.DirectionalLight('#ffffff', 2.1);
      key.position.set(18, 26, 30);
      scene.add(key);

      var rim = new THREE.DirectionalLight('#7aa2ff', 1.4);
      rim.position.set(-22, 6, -28);
      scene.add(rim);

      var fill = new THREE.DirectionalLight('#cfd6e6', 0.6);
      fill.position.set(-10, -14, 18);
      scene.add(fill);
    }

    // Procedural environment for the glass logo's reflections / refraction. A
    // gradient "studio" (cool horizon band + a couple of soft highlights) baked
    // through PMREM. `scene.environment` only affects the physical glass
    // material — the unlit basic / points / line backdrop ignores it.
    function buildEnvironment () {
      var w = 512, h = 256;
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');

      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.0, '#070b18');
      g.addColorStop(0.42, '#202a47');
      g.addColorStop(0.5, '#9fb4e6');
      g.addColorStop(0.58, '#202a47');
      g.addColorStop(1.0, '#04050b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      function blob (x, y, r, color, alpha) {
        var rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, color);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha;
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      blob(w * 0.28, h * 0.4, 90, '#eef3ff', 0.9);
      blob(w * 0.74, h * 0.52, 130, '#7e9cdb', 0.6);

      var tex = new THREE.CanvasTexture(canvas);
      tex.mapping = THREE.EquirectangularReflectionMapping;

      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(tex).texture;

      tex.dispose();
      pmrem.dispose();
    }

    // Central "SB" monogram: load the extruded-SVG OBJ, recentre + scale it to a
    // fixed height, give it a glowing blue-metal look (metallic material +
    // emissive core + additive edge outline + halo), then slow-spin it.
    function buildLogo () {
      logo = new THREE.Group();
      scene.add(logo);

      // Glowing bloom behind the monogram so it reads against the nebula even
      // before / if the OBJ fails to load. Two stacked additive sprites give a
      // soft, hot-centred halo.
      var halo = new THREE.Group();
      halo.userData.isHalo = true;
      [[17, '#9bb4ff', 0.4], [10, '#dfe8ff', 0.5]].forEach(function (h) {
        halo.add(new THREE.Mesh(
          new THREE.CircleGeometry(h[0], 48),
          new THREE.MeshBasicMaterial({
            map: starSprite(),
            color: h[1],
            transparent: true,
            opacity: h[2],
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        ));
      });
      logo.add(halo);

      // Polished blue metal that glows: fully metallic, so the environment map
      // (see buildEnvironment) and lights give it bright reflections, plus a
      // blue emissive so it glows from within. Opaque (no transmission) — that
      // removes the self-intersection artefacts the glass version showed where
      // the monogram's own faces overlapped.
      var material = new THREE.MeshStandardMaterial({
        color: '#5b8cff',
        metalness: 1,
        roughness: 0.22,
        emissive: '#3a5cff',
        emissiveIntensity: 0.8,
        envMapIntensity: 1.6
      });

      // Glowing outline: only the sharp silhouette / extrusion edges survive the
      // 32° threshold, so it traces the logo rather than fogging it with a full
      // wireframe.
      var edgeMaterial = new THREE.LineBasicMaterial({
        color: '#bcd6ff',
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      new OBJLoader().load(LOGO_URL, function (obj) {
        obj.traverse(function (child) {
          if (child.isMesh) {
            child.material = material;
            child.geometry.computeVertexNormals();
            child.add(new THREE.LineSegments(
              new THREE.EdgesGeometry(child.geometry, 32),
              edgeMaterial
            ));
          }
        });

        // Recentre on the geometry centroid and scale so the tallest dimension
        // is a fixed size, regardless of the model's authored units.
        var box = new THREE.Box3().setFromObject(obj);
        var center = box.getCenter(new THREE.Vector3());
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var scale = 17 / maxDim;

        obj.position.sub(center);

        var spinner = new THREE.Group();
        spinner.scale.setScalar(scale);
        spinner.add(obj);
        spinner.userData.isSpinner = true;
        logo.add(spinner);
      }, undefined, function () {
        // OBJ unavailable — the halo alone marks the ring's centre.
      });
    }

    // ---- events -----------------------------------------------------------

    function readSize () {
      var el = $container && $container[0];
      width = (el && el.clientWidth) || window.innerWidth;
      height = (el && el.clientHeight) || window.innerHeight;
    }

    function onResize () {
      if (!created) { return; }
      readSize();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      bgMaterial.uniforms.uAspect.value = width / height;
      if (!running) { render(); }
    }

    function onScroll () {
      var el = $scroll && $scroll[0];
      if (!el) { return; }
      var max = el.scrollHeight - el.clientHeight;
      scrollTarget = max > 0 ? Math.min(Math.max(el.scrollTop / max, 0), 1) : 0;
      if (reducedMotion && !running) { render(); }
    }

    function onPointerMove (e) {
      if (reducedMotion) { return; }
      mouseTargetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTargetY = (e.clientY / window.innerHeight) * 2 - 1;
    }

    // ---- render -----------------------------------------------------------

    function render () {
      timer.update();
      var elapsed = timer.getElapsed();
      var t = reducedMotion ? 0 : elapsed;
      var dt = reducedMotion ? 0 : 1;

      // Smooth scroll + pointer.
      scrollValue += (scrollTarget - scrollValue) * 0.08;
      mouseX += (mouseTargetX - mouseX) * 0.05;
      mouseY += (mouseTargetY - mouseY) * 0.05;

      // Background shader.
      bgMaterial.uniforms.uTime.value = t;
      bgMaterial.uniforms.uScroll.value = scrollValue;
      bgMaterial.uniforms.uMouse.value.set(mouseX, -mouseY);

      // Camera: gentle parallax + scroll dolly.
      camera.position.x += (mouseX * 11 - camera.position.x) * 0.05;
      camera.position.y += (8 - mouseY * 7 - camera.position.y) * 0.05;
      camera.position.z = 66 - scrollValue * 22;
      camera.lookAt(0, 0, 0);

      // Starfield drift + parallax.
      if (stars) {
        stars.rotation.y = t * 0.01 + mouseX * 0.12;
        stars.rotation.x = -scrollValue * 0.2;
        stars.position.y = scrollValue * 40;
      }

      // Tumbling shards — the whole field also leans toward the pointer.
      if (shards) {
        shards.rotation.y += (mouseX * 0.35 - shards.rotation.y) * 0.04;
        shards.rotation.x += (mouseY * 0.25 - shards.rotation.x) * 0.04;
        shards.children.forEach(function (s) {
          s.rotation.x += s.userData.spin.x * 0.01 * dt;
          s.rotation.y += s.userData.spin.y * 0.01 * dt;
          s.rotation.z += s.userData.spin.z * 0.01 * dt;
          s.position.y = s.userData.baseY + Math.sin(t * 0.5 + s.userData.bob) * 3;
        });
      }

      // Central monogram: slow vertical spin, gentle bob + pointer lean. The
      // halo is billboarded to always face the camera; the spinner turns.
      if (logo) {
        logo.position.y = Math.sin(t * 0.5) * 1.4;
        logo.rotation.z = mouseX * 0.12;
        logo.children.forEach(function (child) {
          if (child.userData.isSpinner) {
            child.rotation.y = t * 0.35;
            child.rotation.x = -0.1 + mouseY * 0.18;
          } else if (child.userData.isHalo) {
            child.quaternion.copy(camera.quaternion);
          }
        });
      }

      // Project ring: orbit with time + scroll, depth-fade each card.
      if (ring) {
        ring.rotation.y = t * 0.05 + scrollValue * Math.PI * 1.6;
        var v = new THREE.Vector3();
        cards.forEach(function (c) {
          c.holder.position.y = c.holder.userData.baseY +
            Math.sin(t * 0.6 + c.holder.userData.bob) * 1.6;
          c.holder.getWorldPosition(v);
          // Closer to the camera (higher world z) => more opaque.
          var op = THREE.MathUtils.clamp((v.z + 34) / 68, 0, 1);
          c.mesh.material.opacity = 0.16 + op * 0.7;
        });
      }

      renderer.clear();
      renderer.render(bgScene, bgCamera);
      renderer.clearDepth();
      renderer.render(scene, camera);
    }

    function loop () {
      frameId = window.requestAnimationFrame(loop);
      render();
    }

    // ---- lifecycle --------------------------------------------------------

    function create () {
      if (created) { return true; }

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch (e) {
        // No WebGL — the CSS gradient backdrop stays visible.
        return false;
      }

      renderer.autoClear = false;
      renderer.setClearColor('#06070c', 1);

      readSize();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      $container.append(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
      camera.position.set(0, 8, 66);

      buildBackground();
      bgMaterial.uniforms.uAspect.value = width / height;
      buildStars();
      buildShards();
      buildLights();
      buildEnvironment();
      buildLogo();
      buildRing();

      window.addEventListener('resize', onResize);
      window.addEventListener('pointermove', onPointerMove);
      $scroll.on('scroll.about', onScroll);

      created = true;
      return true;
    }

    function start ($containerEl, $scrollEl) {
      $container = $containerEl;
      $scroll = $scrollEl;

      if (!create()) { return; }
      if (running) { return; }

      running = true;
      onScroll();

      if (reducedMotion) {
        render();
      } else {
        loop();
      }
    }

    function stop () {
      if (!running) { return; }
      running = false;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    }

    return {
      start: start,
      stop: stop,
      resize: onResize
    };
  }

  return {
    getInstance: function () {
      if (!instance) {
        instance = init();
      }
      return instance;
    }
  };
})();

export default ABOUT.getInstance();
