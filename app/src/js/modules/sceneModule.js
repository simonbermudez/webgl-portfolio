'use strict';

var jQuery = require('jquery');
var THREE = require('three');
var TweenLite = require('tweenlite');

var SPRITE3D = require('../libs/sprite3DLib');

var SOUNDS = require('../modules/soundsModule');

var Events = require('../classes/EventsClass');

var MapObj = require('../objects2D/MapObject2D');

var BackgroundParticles = require('../objects3D/BackgroundParticlesObject3D');
var BackgroundLines = require('../objects3D/BackgroundLinesObject3D');

var MobileUtils = require('../utils/mobileUtils');

/**
 * 3D Scene
 *
 * @module SCENE
 * @event [section:changeBegin]
 * @event [section:changeComplete]
 * @requires jQuery, THREE, TweenLite, SPRITE3D, SOUNDS, Events, MapObj, BackgroundParticles, BackgroundLines
 */
var SCENE = (function () {
  var instance;

  function init () {
    // Get mobile optimizations
    var mobileOpts = MobileUtils.getOptimizations();
    
    // params
    var parameters = {
      fogColor: '#0a0a0a',
      quality: mobileOpts.quality,
      sectionHeight: 50,
      particleCount: mobileOpts.particles,
      backgroundLineCount: mobileOpts.backgroundLines,
      antialias: mobileOpts.antialias,
      shadowMap: mobileOpts.shadowMap
    };

    // DOM element
    var $viewport;
    var width;
    var height;

    // THREE Scene
    var resolution;
    var renderer;
    var scene;
    var light;
    var camera;
    var frameId;
    var cameraShakeY = 0;

    // mouse
    var mouseX = 0;

    // general
    var isLocked = false; // used to prevent additional event when slide() called from outside
    var isActive;
    var isStarted = false;

    // camera
    var cameraCache = { speed: 0 };
    var isScrolling = false;

    // background lines
    var backgroundLines;

    // sections
    var sections = [];
    var sectionsMap = {}; // map name with index
    var totalSections;
    var currentIndex = 0;
    var previousIndex = 0;
    
    // events
    var events = new Events();

    function navigation () {
      function next () {
        if (currentIndex === totalSections) {
          if (!isLocked) {
            events.trigger('end');  
          }
          
          return false;
        }

        currentIndex++;

        animateCamera(currentIndex);
      }

      function prev () {
        if (currentIndex === 0) {
          return false;
        }

        currentIndex--;

        animateCamera(currentIndex);
      }

      // scroll
      var newDate;
      var oldDate = new Date();
      
      function onScroll (event) {
        event.preventDefault();
        
        newDate = new Date();
        var elapsed = newDate.getTime() - oldDate.getTime();

        // Free scroll implementation for all devices
        if (elapsed > 8 && !isScrolling) { // Increased frequency for smoother scrolling
          var delta = 0;
          
          // Better mouse wheel detection
          if (event.originalEvent.wheelDelta) {
            delta = event.originalEvent.wheelDelta / 120;
          } else if (event.originalEvent.deltaY) {
            delta = -event.originalEvent.deltaY / 100;
          } else if (event.originalEvent.detail) {
            delta = -event.originalEvent.detail / 3;
          }

          // Apply scroll movement with improved sensitivity
          var scrollSpeed = 4; // Increased sensitivity for faster scrolling
          var targetCameraY = camera.position.y + (delta * scrollSpeed);
          
          // Check if user is trying to scroll past the last section (thank you section)
          var maxY = parameters.sectionHeight;
          var minY = (-sections.length * parameters.sectionHeight) - parameters.sectionHeight;
          
          // Detect if user is trying to scroll down past the thank you section
          if (targetCameraY < minY && delta < 0 && !isLocked) {
            // User is trying to scroll past thank you section, trigger about me page
            events.trigger('end');
            return false;
          }
          
          // Constrain to section bounds
          var newCameraY = Math.max(minY, Math.min(maxY, targetCameraY));
          
          // Update camera position directly for immediate response
          camera.position.y = newCameraY;
          
          // Update section tracking
          var newIndex = Math.round(-camera.position.y / parameters.sectionHeight);
          newIndex = Math.max(0, Math.min(sections.length - 1, newIndex));
          
          if (newIndex !== currentIndex) {
            var previousIndexLocal = currentIndex;
            currentIndex = newIndex;
            
            var way = newIndex < previousIndexLocal ? -1 : 1;
            var data = {
              from: {
                name: sectionsMap[previousIndexLocal],
                index: previousIndexLocal
              },
              to: {
                name: sectionsMap[newIndex],
                index: newIndex
              },
              way: way === -1 ? 'up' : 'down'
            };
            
            events.trigger('section:changeBegin', data);
          }
        }

        oldDate = new Date();
        return false;
      }

      function onKeyDown (event) {
        // Enable smooth keyboard navigation for all devices
        if (!isScrolling && isActive) {
          var keyCode = event.keyCode;
          var scrollAmount = parameters.sectionHeight * 0.3; // Smaller increments for smoother movement
          
          if (keyCode === 40) { // Down arrow
            var targetCameraY = camera.position.y - scrollAmount;
            var minY = (-sections.length * parameters.sectionHeight) - parameters.sectionHeight;
            
            // Check if user is trying to go past the thank you section with keyboard
            if (targetCameraY < minY && !isLocked) {
              // User is trying to navigate past thank you section, trigger about me page
              setTimeout(function() {
                events.trigger('end');
              }, 100);
              return false;
            }
            
            var newCameraY = Math.max(minY, targetCameraY);
            
            TweenLite.to(camera.position, 0.5, { 
              y: newCameraY,
              ease: window.Quart.easeOut,
              onUpdate: function() {
                var newIndex = Math.round(-camera.position.y / parameters.sectionHeight);
                newIndex = Math.max(0, Math.min(sections.length - 1, newIndex));
                
                if (newIndex !== currentIndex) {
                  var previousIndexLocal = currentIndex;
                  currentIndex = newIndex;
                  
                  var data = {
                    from: {
                      name: sectionsMap[previousIndexLocal],
                      index: previousIndexLocal
                    },
                    to: {
                      name: sectionsMap[newIndex],
                      index: newIndex
                    },
                    way: 'down'
                  };
                  
                  events.trigger('section:changeBegin', data);
                }
              }
            });
          } else if (keyCode === 38) { // Up arrow
            var newCameraY = camera.position.y + scrollAmount;
            var maxY = parameters.sectionHeight;
            newCameraY = Math.min(maxY, newCameraY);
            
            TweenLite.to(camera.position, 0.5, { 
              y: newCameraY,
              ease: window.Quart.easeOut,
              onUpdate: function() {
                var newIndex = Math.round(-camera.position.y / parameters.sectionHeight);
                newIndex = Math.max(0, Math.min(sections.length - 1, newIndex));
                
                if (newIndex !== currentIndex) {
                  var previousIndexLocal = currentIndex;
                  currentIndex = newIndex;
                  
                  var data = {
                    from: {
                      name: sectionsMap[previousIndexLocal],
                      index: previousIndexLocal
                    },
                    to: {
                      name: sectionsMap[newIndex],
                      index: newIndex
                    },
                    way: 'up'
                  };
                  
                  events.trigger('section:changeBegin', data);
                }
              }
            });
          }
        }
      }

      $viewport.on('DOMMouseScroll mousewheel wheel', onScroll);
      jQuery(document).on('keydown', onKeyDown);

      // Add touch navigation for mobile devices
      if (MobileUtils.isTouchCapable()) {
        var touchStartY = 0;
        var touchEndY = 0;
        var minSwipeDistance = 50;
        var lastTouchY = 0;
        var touchVelocity = 0;
        
        // Add light throttling for mobile touch events
        var lastTouchTime = new Date();

        function onTouchStart(event) {
          touchStartY = event.originalEvent.touches[0].clientY;
          lastTouchY = touchStartY;
          touchVelocity = 0;
          lastTouchTime = new Date();
        }

        function onTouchMove(event) {
          if (MobileUtils.isMobile()) {
            // Light throttling for mobile - more responsive than before
            var currentTime = new Date();
            var elapsed = currentTime.getTime() - lastTouchTime.getTime();
            
            // Reduced throttling and allow touches during momentum for better responsiveness
            if (elapsed > 0) { // Reduced from 8ms to 4ms for better touch detection
              var currentTouchY = event.originalEvent.touches[0].clientY;
              var deltaY = lastTouchY - currentTouchY;
              touchVelocity = deltaY;
              
              // Process even small movements for smooth feel
              if (Math.abs(deltaY) > 0.2) { // Reduced threshold for better responsiveness
                // Calculate new camera position based on touch movement
                var sensitivity = 0.12; // Slightly reduced for smoother control
                var newCameraY = camera.position.y - (deltaY * sensitivity);
                
                // Constrain to section bounds
                var maxY = parameters.sectionHeight;
                var minY = (-sections.length * parameters.sectionHeight) - parameters.sectionHeight;
                newCameraY = Math.max(minY, Math.min(maxY, newCameraY));
                
                // Direct camera position update for immediate response
                camera.position.y = newCameraY;
                
                // Update current section index based on position
                var newIndex = Math.round(-camera.position.y / parameters.sectionHeight);
                newIndex = Math.max(0, Math.min(sections.length - 1, newIndex));
                
                if (newIndex !== currentIndex) {
                  var previousIndexLocal = currentIndex;
                  currentIndex = newIndex;
                  
                  // Trigger section change events for smooth transitions
                  var way = newIndex < previousIndexLocal ? -1 : 1;
                  var data = {
                    from: {
                      name: sectionsMap[previousIndexLocal],
                      index: previousIndexLocal
                    },
                    to: {
                      name: sectionsMap[newIndex],
                      index: newIndex
                    },
                    way: way === -1 ? 'up' : 'down'
                  };
                  
                  events.trigger('section:changeBegin', data);
                }
              }
              
              lastTouchY = currentTouchY;
              lastTouchTime = currentTime;
            }
            
            event.preventDefault(); // Prevent default scrolling
          }
        }

        function onTouchEnd(event) {
          if (MobileUtils.isMobile()) {
            // Add momentum scrolling for mobile with lower threshold
            if (Math.abs(touchVelocity) > 1.5) { // Lower threshold for more responsive momentum
              var momentum = touchVelocity * 0.6; // Moderate momentum factor
              var targetY = camera.position.y - momentum;
              
              // Constrain momentum to section bounds
              var maxY = parameters.sectionHeight;
              var minY = (-sections.length * parameters.sectionHeight) - parameters.sectionHeight;
              targetY = Math.max(minY, Math.min(maxY, targetY));
              
              // Animate to momentum target with quick response
              TweenLite.to(camera.position, 0.6, { // Faster momentum animation
                y: targetY, 
                ease: window.Quart.easeOut,
                onUpdate: function() {
                  // Update section tracking during momentum scroll
                  var newIndex = Math.round(-camera.position.y / parameters.sectionHeight);
                  newIndex = Math.max(0, Math.min(sections.length - 1, newIndex));
                  
                  if (newIndex !== currentIndex) {
                    var previousIndexLocal = currentIndex;
                    currentIndex = newIndex;
                    
                    var way = newIndex < previousIndexLocal ? -1 : 1;
                    var data = {
                      from: {
                        name: sectionsMap[previousIndexLocal],
                        index: previousIndexLocal
                      },
                      to: {
                        name: sectionsMap[newIndex],
                        index: newIndex
                      },
                      way: way === -1 ? 'up' : 'down'
                    };
                    
                    events.trigger('section:changeBegin', data);
                  }
                }
              });
            }
            touchVelocity = 0;
          } else {
            // Original swipe navigation for tablets and touch-capable desktops
            touchEndY = event.originalEvent.changedTouches[0].clientY;
            var swipeDistance = Math.abs(touchEndY - touchStartY);
            
            if (swipeDistance > minSwipeDistance && !isScrolling && isActive) {
              if (touchEndY < touchStartY) {
                // Swipe up - go to next section
                next();
              } else if (touchEndY > touchStartY) {
                // Swipe down - go to previous section
                prev();
              }
            }
          }
        }

        $viewport.on('touchstart', onTouchStart);
        $viewport.on('touchmove', onTouchMove);
        $viewport.on('touchend', onTouchEnd);
      }
    }

    function setup () {
      if (!$viewport) {
        console.warn('set viewport first');
        return false;
      }

      resolution = parameters.quality;

      renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: parameters.antialias
      });
      // for transparent bg, also set alpha: true
      // renderer.setClearColor(0x000000, 0);
      renderer.setClearColor('#0a0a0a', 1);
      renderer.setSize(width * resolution, height * resolution);
      $viewport.append(renderer.domElement);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(parameters.fogColor, 0.01);

      light = new THREE.DirectionalLight('#ffffff', 0.5);
      light.position.set(0.2, 1, 0.5);
      scene.add(light);

      camera = new THREE.PerspectiveCamera(20, width / height, 1, 4000);
      camera.position.set(0, 0, 40);

      function onMouseMove (event) {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      }

      function onTouchMove (event) {
        if (event.originalEvent.touches.length === 1) {
          var touch = event.originalEvent.touches[0];
          mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
        }
      }

      jQuery(window).on('resize', onResize);
      $viewport.on('mousemove', onMouseMove);
      
      if (MobileUtils.isTouchCapable() && !MobileUtils.isMobile()) {
        // Only bind for mouse tracking on non-mobile touch devices (like tablets)
        $viewport.on('touchmove', onTouchMove);
      }

      navigation();
      draw();

      return SCENE.getInstance();
    }

    function setupBackground () {
      // add background particles and lines
      // rangeY based on the size and the number of sections
      var rangeY = [
        parameters.sectionHeight,
        (-sections.length * parameters.sectionHeight) - parameters.sectionHeight
      ];

      var backgroundParticles = new BackgroundParticles({ rangeY: rangeY, count: parameters.particleCount });
      scene.add(backgroundParticles.el);

      backgroundLines = new BackgroundLines({ rangeY: rangeY, count: parameters.backgroundLineCount });
      scene.add(backgroundLines.el);
    }

    function draw () {
      SPRITE3D.update();
      render();
      frameId = window.requestAnimationFrame(draw);
    }

    function render () {
      // camera noise
      camera.position.y += Math.cos(cameraShakeY) / 50;
      cameraShakeY += 0.02;

      // mouse camera move - skip on mobile to keep camera centered
      if (!MobileUtils.isMobile()) {
        camera.position.x += ((mouseX * 5) - camera.position.x) * 0.03;
      } else {
        // Keep camera centered on mobile
        camera.position.x += (0 - camera.position.x) * 0.03;
      }

      renderer.render(scene, camera);
    }

    function onResize () {
      width = $viewport.width();
      height = $viewport.height();

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width * resolution, height * resolution);
    }

    function animateCamera (index) {
      // in case goTo is called
      // otherwise navigation set currentIndex
      currentIndex = index;

      var nextPosition = index * -parameters.sectionHeight;
      
      // which way are we animating?
      var way = index < previousIndex ? -1 : 1;

      // event's data
      var data = {
        from: {
          name: sectionsMap[previousIndex],
          index: previousIndex
        },
        to: {
          name: sectionsMap[index],
          index: index
        },
        way: way === -1 ? 'up' : 'down'
      };

      TweenLite.to(camera.position, 1.5, { y: nextPosition, ease: window.Quart.easeInOut,
        onStart: function () {
          isScrolling = true;
          SOUNDS.wind.play();
          events.trigger('section:changeBegin', data);
        },
        onComplete: function () {
          if (previousIndex === index) {
            return false;
          }

          isScrolling = false;
          events.trigger('section:changeComplete', data);
          previousIndex = index;
        }
      });

      TweenLite.to(cameraCache, 1.5, {
        bezier: { type: 'soft', values: [{ speed: 10 }, { speed: 0 }] },
        onUpdate: function () {
          backgroundLines.updateY(this.target.speed);
        }
      });
    }

    return {
      /**
       * Set the SCENE viewport
       *
       * @method setViewport
       * @param {jQuery} [$el] $viewport DOM element
       */
      setViewport: function ($el) {
        $viewport = $el;

        width = $viewport.width();
        height = $viewport.height();

        setup();
      },

      /**
       * Set config
       *
       * @method config
       * @param {Object} [options]
       * @param {String} [options.fogColor='#0a0a0a'] Fog color
       * @param {Number} [options.quality=1] Quality
       * @param {Number} [options.sectionHeight=50] Height of each section
       * @param {Boolean} [screenshot=false] If set on true, press P to output imgData to the console
       */
      config: function (options) {
        parameters = jQuery.extend(parameters, options);
      },

      /**
       * Add sections
       *
       * @method addSections
       * @param {Array} [sections] Array of Sections
       */
      addSections: function (_sections) {
        sections = _sections;
        totalSections = sections.length - 1;

        for (var i = 0, j = sections.length; i < j; i++) {
          var section = sections[i];

          sectionsMap[i] = section.name;

          section.el.position.y = i * -parameters.sectionHeight;
          scene.add(section.el);
        }

        setupBackground();
      },

      /**
       * Listen to SCENE event bus
       *
       * @method on
       * @param {String} [event]
       * @param {Function} [callback]
       **/
      on: function () {
        events.on.apply(events, arguments);
      },

      /**
       * Animate camera to section
       *
       * @method goTo
       * @param {Number} [index] Section's index
       */
      goTo: function (index) {
        if (index === currentIndex) {
          return false;
        }

        animateCamera(index);
      },

      /**
       * Get SCENE map
       *
       * @method getMap
       * @return {Map}
       */
      getMap: function () {

        var map = new MapObj();

        for (var i = 0, j = sections.length; i < j; i++) {
          map.addNode(i);
        }

        return map;
      },

      /**
       * Start drawing loop
       *
       * @method stop
       */
      start: function () {
        isActive = true;

        if (!isStarted) {
          // first event
          var data = {
            from: {
              name: sectionsMap[previousIndex],
              index: previousIndex
            },
            to: {
              name: sectionsMap[currentIndex],
              index: currentIndex
            },
            way: 'down'
          };

          events.trigger('section:changeBegin', data);

          isStarted = true;
        }

        if (!frameId) {
          draw();
        }
      },

      /**
       * Stop drawing loop
       *
       * @method stop
       */
      stop: function () {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = undefined;
          isActive = false;
        }
      },

      /**
       * Set scene quality
       *
       * @method quality
       * @param {Number} [ratio]
       */
      quality: function (value) {
        resolution = value;
        renderer.setSize(width * resolution, height * resolution);
      },

      /**
       * Return current scene quality
       *
       * @method getQuality
       * @return {Number}
       */
      getQuality: function () {
        return resolution;
      },

      /**
       * Lock scene (forbid triggering end event)
       *
       * @method lock
       */
      lock: function () {
        isLocked = true;
      },

      /**
       * Unlock scene (allow triggering end event)
       *
       * @method unlock
       */
      unlock: function () {
        isLocked = false;
      },

      /**
       * in animation
       *
       * @method in
       */
      in: function () {
        TweenLite.to({ fov: 200, speed: 0 }, 2, {
          bezier: { type: 'soft', values: [{ speed: 20 }, { speed: 0 }]},
          fov: 60,
          ease: 'easeOutCubic',
          onUpdate: function () {
            backgroundLines.updateZ(this.target.speed);
            camera.fov = this.target.fov;
            camera.updateProjectionMatrix();
          }
        });
      }
    };
  }

  return {
    /**
     * Return SCENE instance
     *
     * @method getInstance
     * @return {SCENE}
     */
    getInstance: function () {
      if (!instance) {
        instance = init();
      }

      return instance;
    }
  };
})();

module.exports = SCENE.getInstance();