'use strict';

import jQuery from 'jquery';
import { gsap } from '../vendor/gsapSetup.js';

/**
 * ABOUT_FX
 *
 * The interaction layer for the about/portfolio panel (`.tails`). Keeps the
 * minimalist monochrome look of the presentation but makes it feel alive:
 *
 *   - a custom cursor ring that grows + inverts over interactive elements
 *   - magnetic buttons that lean toward the pointer
 *   - project cards that tilt in 3D toward the pointer
 *   - stat numbers that count up when they scroll into view
 *   - the hero name split onto two lines (SIMON / BERMUDEZ)
 *
 * Everything degrades gracefully on touch devices and when the user prefers
 * reduced motion. DOM build + event binding happen once; start()/stop() just
 * toggle the active state as the panel slides in and out.
 *
 * @module ABOUT_FX
 * @requires jQuery, gsap
 */

var ABOUT_FX = (function () {
  var instance;

  function init () {
    var $scroll;
    var built = false;

    var isTouch = false;
    var reduced = false;
    try {
      isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* defaults */ }

    var cursor, cursorX, cursorY;
    var counted = false;

    // ---- custom cursor ----------------------------------------------------

    function buildCursor () {
      if (isTouch || reduced) { return; }

      var panel = document.querySelector('.tails.about');
      cursor = document.createElement('div');
      cursor.className = 'about__cursor';
      // Mount on <body>, not the panel: `.tails` has a transform (the slide) and
      // is the scroll container, so a fixed child there scrolls away with the
      // content. On <body> the fixed cursor stays locked to the viewport.
      document.body.appendChild(cursor);
      panel.classList.add('has-cursor');

      gsap.set(cursor, { xPercent: -50, yPercent: -50, opacity: 0 });
      cursorX = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
      cursorY = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });

      window.addEventListener('pointermove', function (e) {
        cursorX(e.clientX);
        cursorY(e.clientY);
      });

      // Grow / invert over interactive targets.
      var selector = 'a, button, .about__project, .about__service, .about__stat, .about__cert';
      jQuery(document).on('mouseenter.aboutfx', selector, function () {
        cursor.classList.add('is-active');
      });
      jQuery(document).on('mouseleave.aboutfx', selector, function () {
        cursor.classList.remove('is-active');
      });
    }

    // ---- magnetic buttons -------------------------------------------------

    function bindMagnetic () {
      if (isTouch || reduced) { return; }

      jQuery('.about__btn').each(function () {
        var el = this;
        var setX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
        var setY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });

        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          setX((e.clientX - (r.left + r.width / 2)) * 0.4);
          setY((e.clientY - (r.top + r.height / 2)) * 0.4);
        });
        el.addEventListener('pointerleave', function () {
          setX(0);
          setY(0);
        });
      });
    }

    // ---- 3D card tilt -----------------------------------------------------

    function bindTilt () {
      if (isTouch || reduced) { return; }

      jQuery('.about__project').each(function () {
        var el = this;

        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(el, {
            rotationY: px * 10,
            rotationX: -py * 10,
            y: -8,
            scale: 1.02,
            transformPerspective: 900,
            transformOrigin: 'center',
            duration: 0.4,
            ease: 'power2.out'
          });
        });
        el.addEventListener('pointerleave', function () {
          gsap.to(el, {
            rotationY: 0,
            rotationX: 0,
            y: 0,
            scale: 1,
            duration: 0.6,
            ease: 'power3.out'
          });
        });
      });
    }

    // ---- stat counters ----------------------------------------------------

    function runCounters () {
      if (counted) { return; }
      counted = true;

      jQuery('.about__stat__num').each(function () {
        var el = this;
        var raw = (el.textContent || '').trim();
        var target = parseInt(raw, 10) || 0;
        var suffix = raw.replace(/[0-9]/g, '');

        if (reduced) {
          el.textContent = target + suffix;
          return;
        }

        var obj = { v: 0 };
        el.textContent = '0' + suffix;
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: function () {
            el.textContent = Math.round(obj.v) + suffix;
          }
        });
      });
    }

    function watchCounters () {
      var nums = document.querySelectorAll('.about__stat__num');
      if (!nums.length) { return; }

      if (!('IntersectionObserver' in window)) {
        runCounters();
        return;
      }

      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            runCounters();
            io.disconnect();
            break;
          }
        }
      }, { root: $scroll && $scroll[0], threshold: 0.4 });

      for (var i = 0; i < nums.length; i++) {
        io.observe(nums[i]);
      }
    }

    // ---- hero name layout -------------------------------------------------

    function splitHero () {
      var name = document.querySelector('.about__name');
      if (!name || name.getAttribute('data-split')) { return; }

      var text = name.textContent.trim();
      name.setAttribute('data-split', '1');
      name.setAttribute('aria-label', text);
      name.textContent = '';

      // Each word becomes its own (block-level) line: "SIMON" over "BERMUDEZ".
      var words = text.split(/\s+/);
      for (var w = 0; w < words.length; w++) {
        var wordEl = document.createElement('span');
        wordEl.className = 'about__name__word';
        var word = words[w];

        for (var i = 0; i < word.length; i++) {
          var span = document.createElement('span');
          span.className = 'about__name__char';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = word[i];
          wordEl.appendChild(span);
        }

        name.appendChild(wordEl);
      }
    }

    // ---- dynamic year -----------------------------------------------------

    function setYear () {
      var year = new Date().getFullYear();
      var els = document.querySelectorAll('.js-year');
      for (var i = 0; i < els.length; i++) {
        els[i].textContent = year;
      }
    }

    // ---- lifecycle --------------------------------------------------------

    function build () {
      if (built) { return; }
      built = true;

      setYear();
      splitHero();
      buildCursor();
      bindMagnetic();
      bindTilt();
      watchCounters();
    }

    function start ($scrollEl) {
      $scroll = $scrollEl;
      build();

      if (cursor) {
        gsap.to(cursor, { opacity: 1, duration: 0.4 });
      }
    }

    function stop () {
      if (cursor) {
        gsap.to(cursor, { opacity: 0, duration: 0.3 });
        cursor.classList.remove('is-active');
      }
    }

    return {
      start: start,
      stop: stop
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

export default ABOUT_FX.getInstance();
