'use strict';

import jQuery from 'jquery';
import MobileUtils from '../utils/mobileUtils.js';

/**
 * Menu
 *
 * @class Menu
 * @constructor
 * @requires jQuery
 */
function Menu () {
  var $el = jQuery('.menu');
  var $button = $el.find('.menu__button');
  var $itemsContainer = $el.find('.menu__items');
  var $items = $el.find('.menu__item');

  var _callback = function () {};
  var timeouts = [];
  var isMobile = MobileUtils.isMobile();
  var isMenuOpen = false;

  function onMouseover () {
    if (isMenuOpen) return;
    
    $items.on('click', _callback);

    $itemsContainer.css('display', 'block');

    $el.stop().animate({ left: 0 }, { duration: 400, easing: 'easeOutQuart' });
    $button.stop().animate({ opacity: 0 }, 400);

    $items.each(function (i) {
      var $el = jQuery(this);

      var timeout = window.setTimeout(function () {
        $el.stop().animate({ opacity: 1 }, 400);
      }, i * 200);

      timeouts.push(timeout);
    });

    isMenuOpen = true;

    if (!isMobile) {
      $el.one('mouseleave', onMouseout);
    }
  }

  function onMouseout () {
    if (!isMenuOpen) return;
    
    if (timeouts) {
      for (var i = 0, j = timeouts.length; i < j; i++) {
        window.clearTimeout(timeouts[i]);
      }
      timeouts = [];
    }

    $el.stop().animate({ left: 30 }, { duration: 400, easing: 'easeOutQuart' });
    $button.stop().animate({ opacity: 0.5 }, 400);
    $items.stop().animate({ opacity: 0 }, 400, function () {
      $itemsContainer.css('display', 'none');
      $items.off('click', _callback);
    });

    isMenuOpen = false;

    if (!isMobile) {
      $button.one('mouseover click', onMouseover);
    }
  }

  // Mobile-specific touch handling
  if (isMobile) {
    $button.on('click touchend', function(e) {
      e.preventDefault();
      if (isMenuOpen) {
        onMouseout();
      } else {
        onMouseover();
      }
    });
    
    // Close menu when clicking outside on mobile
    jQuery(document).on('click touchend', function(e) {
      if (!$el.is(e.target) && $el.has(e.target).length === 0 && isMenuOpen) {
        onMouseout();
      }
    });
  } else {
    $button.one('mouseover click', onMouseover);
  }

  return {
    in: function () {
      $el.animate({ top: 0, opacity: 1 }, 500);
    },

    onClick: function (callback) {
      _callback = callback;
    }
  };
}

export default Menu;