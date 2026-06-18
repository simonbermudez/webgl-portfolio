'use strict';

// Disable three.js r152+ colour management before any THREE colour/material is
// created, so the scene keeps its original (r68) appearance.
import './vendor/threeSetup.js';

import './polyfills/animFramePolyfill.js';
import './polyfills/bindPolyfill.js';
import './polyfills/indexOfPolyfill.js';

// Wire up jQuery/GSAP globals + the jquery.gsap shim before anything uses them.
import './vendor/gsapSetup.js';

// Styles (Vite bundles these into the 3D chunk's CSS)
import 'normalize.css';
import '../less/main3D.less';

import jQuery from 'jquery';
import { TweenLite } from 'gsap';

import './libs/waypointLib.js';
  
import APP from './modules/appModule.js';
import SCENE from './modules/sceneModule.js';
import SOUNDS from './modules/soundsModule.js';
import HASH from './modules/hashModule.js';
import ABOUT from './modules/aboutModule.js';
import ABOUT_FX from './modules/aboutInteractionsModule.js';

import ImagesLoader from './classes/LoaderClass.js';

import MobileUtils from './utils/mobileUtils.js';

import Loader from './objects2D/LoaderObject2D.js';
import Menu from './objects2D/menuObject2D.js';
import Help from './objects2D/HelpObject2D.js';
import Wireframe from './objects2D/WireframeObject2D.js';

import helloSection from './sections/helloSection.js';
import beamsSection from './sections/beamsSection.js';
import dropSection from './sections/dropSection.js';
import ballSection from './sections/ballSection.js';
import flowSection from './sections/flowSection.js';
import neonsSection from './sections/neonsSection.js';
import heightSection from './sections/heightSection.js';
import waveSection from './sections/waveSection.js';
import faceSection from './sections/faceSection.js';
import rocksSection from './sections/rocksSection.js';
import galaxySection from './sections/galaxySection.js';
import gravitySection from './sections/gravitySection.js';
import citySection from './sections/citySection.js';
import endSection from './sections/endSection.js';

jQuery(function () {
  HASH.replacePlaceholders();

  // Add mobile class to body if on mobile device
  if (MobileUtils.isMobile()) {
    jQuery('body').addClass('mobile');
  }

  var loader = new Loader();
  var help = new Help();
  var menu = new Menu();
  var imagesLoader = new ImagesLoader([
    './app/public/img/texture-ball.png',
    './app/public/img/texture-ballAlpha.png',
    './app/public/img/sprite-smoke.png',
    './app/public/img/sprite-AKQA.png'
  ]);

  // preload
  imagesLoader.start();

  imagesLoader.onProgress(function (percent) {
    loader.update(percent);
  });

  imagesLoader.onComplete(function () {
    loader.out();

    TweenLite.delayedCall(0.8, SCENE.in);
    TweenLite.delayedCall(1.5, function () {
      menu.in();
    });
  });

  menu.onClick(function () {
    var $el = jQuery(this);
    var name = $el.attr('data-button') || '';

    if (name === 'sounds') {
      SOUNDS.toggle();
      $el.html(SOUNDS.isMuted() ? 'UNMUTE' : 'MUTE');
    }
    else if (name === 'help') {
      help.in();
    }
    else if (name === 'quality') {
      var text;
      var quality;

      if (SCENE.getQuality() === 0.5) {
        text = 'QUALITY 1';
        quality = 1;
      } else {
        text = 'QUALITY 0.5';
        quality = 0.5;
      }

      $el.html(text);
      SCENE.quality(quality);
    }
  });  
    
  // scene
  var $heads = jQuery('.heads');
  var $viewport = $heads.find('.heads__viewport');

  SCENE.config({ quality: 1 });
  SCENE.setViewport($viewport);
  SCENE.addSections([
    helloSection,
    beamsSection,
    dropSection,
    ballSection,
    flowSection,
    neonsSection,
    heightSection,
    waveSection,
    faceSection,
    rocksSection,
    galaxySection,
    gravitySection,
    citySection,
    endSection
  ]);

  SCENE.on('section:changeBegin', function () {
    var way = this.way;
    var to = this.to.name;
    // The very first changeBegin (fired by SCENE.start) has from === to, so the
    // "out begin" branch below would reverse the section we're entering and leave
    // it hidden. Treat from as empty when it matches to, so only the in runs.
    var from = this.from.name === this.to.name ? null : this.from.name;

    // in begin
    if (to === 'hello') {
      helloSection.in();
      helloSection.start();
      helloSection.smokeStart();

      beamsSection.out('up');
      beamsSection.start();
    }
    else if (to === 'beams') {
      helloSection.smokeStart();

      beamsSection.in();
      beamsSection.start();
    }
    else if (to === 'drop') {
      beamsSection.out('down');
      beamsSection.start();

      dropSection.in();
      dropSection.start();
    }
    else if (to === 'ball') {
      dropSection.out('down');
      dropSection.start();

      ballSection.in();
      ballSection.start();

      flowSection.fieldIn();
      flowSection.start();
    }
    else if (to === 'flow') {
      flowSection.in();
      flowSection.fieldIn();
      flowSection.start();

      neonsSection.smokeStart();
    }
    else if (to === 'neons') {
      flowSection.fieldIn();
      flowSection.start();

      neonsSection.start();
      neonsSection.smokeStart();

      heightSection.show();
    }
    else if (to === 'height') {
      flowSection.fieldIn();
      flowSection.start();

      neonsSection.smokeStart();

      heightSection.show();
      heightSection.in();
      heightSection.start();
    }
    else if (to === 'wave') {
      heightSection.show();

      waveSection.in(way);
      waveSection.start();
    }
    else if (to === 'face') {
      faceSection.in();
      faceSection.start();

      rocksSection.show();
    }
    else if (to === 'rocks') {
      rocksSection.show();
      rocksSection.in();
      rocksSection.start();
    }
    else if (to === 'galaxy') {
      rocksSection.show();

      galaxySection.in(way);
      galaxySection.start();

      gravitySection.show();
    }
    else if (to === 'gravity') {
      gravitySection.show();
      gravitySection.in();
      gravitySection.start();
    }
    else if (to === 'end') {
      endSection.in();
    }

    // out begin
    if (from === 'hello') {
      helloSection.out(way);
    }
    else if (from === 'beams') {
      beamsSection.out(way);
    }
    else if (from === 'drop') {
      dropSection.out(way);
    }
    else if (from === 'ball') {
      ballSection.out(way);
    }
    else if (from === 'flow') {
      flowSection.out(way);
    }
    else if (from === 'neons') {
      neonsSection.out(way);
    }
    else if (from === 'height') {
      heightSection.out(way);
    }
    else if (from === 'wave') {
      waveSection.out(way);
    }
    else if (from === 'face') {
      faceSection.out(way);
    }
    else if (from === 'rocks') {
      rocksSection.out(way);
    }
    else if (from === 'galaxy') {
      galaxySection.out(way);
    }
    else if (from === 'gravity') {
      gravitySection.out(way);
    }
    else if (from === 'end') {
      endSection.out(way);
    }
  });

  SCENE.on('section:changeComplete', function () {
    var to = this.to.name;
    var from = this.from.name;

    // out complete
    if (from === 'hello') {
      helloSection.stop();

      if (to !== 'beams') {
        helloSection.smokeStop();
      }

      if (to !== 'beams' && to !== 'drop') {
        beamsSection.stop();
      }
    }
    else if (from === 'beams') {
      if (to !== 'hello') {
        helloSection.smokeStop();
      }

      if (to !== 'hello' && to !== 'drop') {
        beamsSection.stop();
      }
    }
    else if (from === 'drop') {
      if (to !== 'hello' && to !== 'beams') {
        beamsSection.stop();
      }

      if (to !== 'ball') {
        dropSection.stop();
      }
    }
    else if (from === 'ball') {
      ballSection.stop();

      if (to !== 'drop') {
        dropSection.stop();
      }

      if (to !== 'flow' && to !== 'neons' && to !== 'height') {
        flowSection.stop();
      }
    }
    else if (from === 'flow') {
      if (to !== 'neons' && to !== 'height') {
        neonsSection.smokeStop();
      }

      if (to !== 'ball' && to !== 'neons' && to !== 'height') {
        flowSection.stop();
      }
    }
    else if (from === 'neons') {
      neonsSection.stop();

      if (to !== 'flow' && to !== 'height') {
        neonsSection.smokeStop();
      }

      if (to !== 'ball' && to !== 'flow' && to !== 'height') {
        flowSection.stop();
      }

      if (to !== 'height' && to !== 'wave') {
        heightSection.hide();
      }
    }
    else if (from === 'height') {
      heightSection.stop();

      if (to !== 'neons' && to !== 'wave') {
        heightSection.hide();
      }

      if (to !== 'flow' && to !== 'neons') {
        neonsSection.smokeStop();
      }

      if (to !== 'ball' && to !== 'flow' && to !== 'neons') {
        flowSection.stop();
      }
    }
    else if (from === 'wave') {
      waveSection.stop();

      if (to !== 'neons' && to !== 'height') {
        heightSection.hide();
      }
    }
    else if (from === 'face') {
      faceSection.stop();

      if (to !== 'rocks' && to !== 'galaxy') {
        rocksSection.hide();
      }
    }
    else if (from === 'rocks') {
      rocksSection.stop();

      if (to !== 'face' && to !== 'galaxy') {
        rocksSection.hide();
      }
    }
    else if (from === 'galaxy') {
      galaxySection.stop();

      if (to !== 'face' && to !== 'rocks') {
        rocksSection.hide();
      }

      if (to !== 'gravity') {
        gravitySection.hide();
      }
    }
    else if (from === 'gravity') {
      gravitySection.stop();

      if (to !== 'galaxy') {
        gravitySection.hide();
      }
    }
  });

  SCENE.on('end', function () {
    SCENE.lock();
    APP.slide(SCENE.unlock);
  });

  // tails
  var wireframe = new Wireframe(jQuery('.wireframe'));

  var $tails = jQuery('.tails');
  var $aboutBg = jQuery('.about__bg');

  var $tailsSections = jQuery('.tails__section');
  $tailsSections.find('.tails__section__el').animate({ opacity: 0, y: 100 }, 0);

  var waypoint = $tailsSections.waypoint({
    $viewport: jQuery('.tails'),
    offset: 30
  });

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

  APP.on('slideBegin', function () {
    if (this.to === 'heads') {
      waypoint.stop();
      ABOUT.stop();
      ABOUT_FX.stop();

      try {
        SOUNDS.background.fadeIn(1, 2000);
      } catch (e) {
        console.warn(e);
      }

    } else {
      // Spin up the about/portfolio backdrop + interactions as it slides in.
      ABOUT.start($aboutBg, $tails);
      ABOUT_FX.start($tails);
      SOUNDS.background.fadeOut(0, 2000);
    }
  });

  APP.on('slideComplete', function () {
    if (this.to === 'tails') {
      waypoint.start();
    }
  });
 
  // SCENE on/off
  APP.on('heads:visible', function () {
    SCENE.start();
  });

  APP.on('heads:invisible', function () {
    SCENE.stop();
  });

  APP.start();
  SCENE.start();

  SOUNDS.background.fadeIn(1, 2000);
});