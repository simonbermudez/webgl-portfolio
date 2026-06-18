/*!
 * jquery.gsap compatibility shim for GSAP 3
 *
 * The original GreenSock jquery.gsap.js plugin (v0.1.9) was discontinued and is
 * hard-wired to GSAP 1's `com.greensock` namespace, so it throws on GSAP 3. This
 * is a minimal replacement that keeps the project's existing `$.fn.animate()` /
 * `$.fn.delay()` / `$.fn.stop()` call sites working by routing them through
 * `gsap.to()`.
 *
 * NOTE: this file lives in app/src/shims/ (version-controlled) rather than in
 * app/src/vendor/ because the vendor directory is git-ignored and rewritten by
 * `bower install`, which would clobber this custom file. It is pulled into the
 * vendor bundle via the `tweenlite.jquery` entry in package.json's `browser`
 * field and the gulp vendor task.
 *
 * Supported: numeric/transform/CSS props (incl. `y`, `x`), the easing names the
 * codebase uses, the (props, duration[, easing][, callback]) and
 * (props, optionsObject) signatures, `.delay()` (mapped to a gsap delay so
 * staggered animations keep their offset) and `.stop()` (kills gsap tweens).
 * Scroll animations and jQuery `step` callbacks fall back to native animate().
 */
export default function installJqueryGsap($, gsap) {
  'use strict';

  if (!gsap) {
    if (window.console && window.console.warn) {
      window.console.warn('gsap compat shim: gsap global is required.');
    }
    return;
  }

  // GSAP 1.x exposed the tween's target as `this.target` inside callbacks;
  // GSAP 3 renamed it to `this.targets()[0]`. Restore the legacy accessor so the
  // scene's onUpdate/onComplete callbacks (this.target.x, this.target.opacity, ...)
  // keep working without touching every call site.
  if (gsap.core && gsap.core.Tween && !('target' in gsap.core.Tween.prototype)) {
    Object.defineProperty(gsap.core.Tween.prototype, 'target', {
      configurable: true,
      get: function () {
        var targets = this.targets();
        return targets[0];
      }
    });
  }

  // The remaining (jQuery) part of the shim only applies when jQuery is present.
  if (!$) {
    return;
  }

  var _animate = $.fn.animate;
  var _delay = $.fn.delay;
  var _stop = $.fn.stop;

  // jQuery easing name -> GSAP ease. jQuery's default "swing" is sine.inOut.
  var EASE_MAP = {
    swing: 'sine.inOut',
    linear: 'none',
    easeoutquart: 'power3.out',
    easeinquart: 'power3.in',
    easeinoutquart: 'power3.inOut',
    easeoutcubic: 'power2.out',
    easeincubic: 'power2.in',
    easeinoutcubic: 'power2.inOut'
  };

  function toCamelCase(key) {
    return key.replace(/-([a-z])/g, function (m, c) {
      return c.toUpperCase();
    });
  }

  function resolveEase(name) {
    if (!name) {
      return 'sine.inOut';
    }
    var mapped = EASE_MAP[('' + name).toLowerCase()];
    return mapped || name;
  }

  $.fn.animate = function (props, speed, easing, callback) {
    props = props || {};

    var stepGiven = (speed && typeof speed === 'object' && typeof speed.step === 'function');

    // gsap has no scroll support out of the box, and we don't reimplement the
    // jQuery `step` feature -> defer to the native implementation.
    if (props.scrollTop != null || props.scrollLeft != null || stepGiven) {
      return _animate.call(this, props, speed, easing, callback);
    }

    var duration, easeName, complete, progress;

    if (speed && typeof speed === 'object') {
      duration = speed.duration;
      easeName = speed.easing;
      complete = speed.complete;
      progress = speed.progress;
    } else {
      duration = speed;
      if (typeof easing === 'function') {
        complete = easing;
      } else {
        easeName = easing;
        if (typeof callback === 'function') {
          complete = callback;
        }
      }
    }

    if (duration == null) {
      duration = 400; // jQuery default
    }

    var base = { duration: duration / 1000, ease: resolveEase(easeName) };

    for (var key in props) {
      if (props.hasOwnProperty(key)) {
        base[toCamelCase(key)] = props[key];
      }
    }

    return this.each(function () {
      var el = this;
      var vars = $.extend({}, base);
      var pending = $.data(el, '_gsapDelay');

      if (pending) {
        vars.delay = pending;
        $.removeData(el, '_gsapDelay');
      }

      if (complete) {
        vars.onComplete = function () {
          complete.call(el);
        };
      }

      if (progress) {
        var tween = gsap.to(el, vars);
        tween.eventCallback('onUpdate', function () {
          progress.call(el, tween, tween.progress());
        });
      } else {
        gsap.to(el, vars);
      }
    });
  };

  // Record the delay so the following .animate() can apply it as a gsap delay.
  $.fn.delay = function (time, type) {
    if (type && type !== 'fx') {
      return _delay.apply(this, arguments);
    }
    return this.each(function () {
      $.data(this, '_gsapDelay', (time || 0) / 1000);
    });
  };

  // Kill any gsap tweens (and clear pending delays) in addition to native stop.
  $.fn.stop = function () {
    this.each(function () {
      gsap.killTweensOf(this);
      $.removeData(this, '_gsapDelay');
    });
    return _stop.apply(this, arguments);
  };

}
