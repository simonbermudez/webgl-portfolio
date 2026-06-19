/* jshint laxbreak: true */

'use strict';

import './polyfills/animFramePolyfill.js';
import './polyfills/bindPolyfill.js';
import './polyfills/indexOfPolyfill.js';

// Wire up jQuery/GSAP globals + the jquery.gsap shim before anything uses them.
import './vendor/gsapSetup.js';

// Styles (Vite bundles these into the 2D chunk's CSS)
import 'normalize.css';
import '../less/main2D.less';

import jQuery from 'jquery';
import skrollr from 'skrollr';
import './libs/waypointLib.js';
  
import HASH from './modules/hashModule.js';

import ImagesLoader from './classes/LoaderClass.js';

import Loader from './objects2D/LoaderObject2D.js';
import Menu from './objects2D/menuObject2D.js';
import Wireframe from './objects2D/WireframeObject2D.js';

function mobile () {
  return navigator.userAgent.match(/Android/i)
    || navigator.userAgent.match(/webOS/i)
    || navigator.userAgent.match(/iPhone/i)
    || navigator.userAgent.match(/iPad/i)
    || navigator.userAgent.match(/iPod/i)
    || navigator.userAgent.match(/BlackBerry/i)
    || navigator.userAgent.match(/Windows Phone/i);
}

jQuery(function () {
  HASH.replacePlaceholders();

  var loader = new Loader();
  var menu = new Menu();
  var imagesLoader = new ImagesLoader([
    './app/public/img/part-beam.png',
    './app/public/img/part-drop.png',
    './app/public/img/part-sphere.png',
    './app/public/img/part-grid.png',
    './app/public/img/part-field.png',
    './app/public/img/part-stars.png'
  ]);

  imagesLoader.onProgress(function (percent) {
    loader.update(percent);
  });

  imagesLoader.start();

  // heads
  skrollr.init({ skrollrBody: 'mobile-body' });

  // tails
  var wireframe = new Wireframe(jQuery('.wireframe'));

  if (!mobile()) {
    var $tails = jQuery('.tails');
    var $tailsSections = $tails.find('.tails__section');

    // prepare els — but keep the hero static: it's on-screen the instant the
    // panel opens and never enters the waypoint band, so hiding it would leave
    // it stuck (only the name shows). Sections you scroll to still fade up.
    $tailsSections.find('.tails__section__el').not('.about__hero *').animate({ opacity: 0, y: 100 }, 0);

    var waypoint = $tailsSections.waypoint({
      offset: 30,
      startAt: $tails.offset().top - 1000
    });

    waypoint.start();

    $tailsSections.on('active', function () {
      var $el = jQuery(this);
      
      if ($el.attr('data-appeared')) {
        return false;
      }

      jQuery(this).find('.tails__section__el').each(function (i) {
        jQuery(this).stop().delay(i * 100).animate({ opacity: 1, y: 0 }, 500);
      });

      $el.attr('data-appeared', true);
    });

    jQuery('.tails__section--site').on('stateChange', function (e, state) {
      if (state === 'active') {
        wireframe.start();
        wireframe.in();
      } else {
        wireframe.stop();
      }
    });
  } else {
    wireframe.in();
  }

  imagesLoader.onComplete(function () {
    loader.out();

    setTimeout(function () {
      menu.in();
    }, 1500);
  });
});