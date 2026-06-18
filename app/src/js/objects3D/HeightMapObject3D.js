/* jshint laxbreak: true */
/* jshint shadow:true */

'use strict';

import jQuery from 'jquery';
import * as THREE from 'three';
import { TweenLite } from 'gsap';

import Events from '../classes/EventsClass.js';

import random from '../utils/randomUtil.js';
import map from '../utils/mapUtil.js';

/**
 * Animated height map
 *
 * @class HeightMap
 * @constructor
 * @param {Object} [options]
 * @param {Boolean} [options.horizontal=true] Horizontal lines?
 * @param {Boolean} [options.vertical=false] Vertical lines?
 * @param {Boolean} [options.plane=false] Plane?
 * @param {Boolean} [options.points=false] Points?
 * @param {Number} [options.divisionsX=30] X axis divisions
 * @param {Number} [options.divisionsY=30] Y axis divisions
 * @param {String} [options.fromColor='#4c4c4c'] Height min color
 * @param {String} [options.toColor='#ffffff'] Height max color
 * @param {Array} [options.maps=[]] Maps sources
 * @requires jQuery, THREE, TweenLite, Events, random, map
 */
function HeightMap (options) {
  this.parameters = jQuery.extend(HeightMap.defaultOptions, options);

  this.events = new Events();

  this.fromColor = new THREE.Color(this.parameters.fromColor);
  this.toColor = new THREE.Color(this.parameters.toColor);
  this.colorsCache = {};
  this.faceIndices = ['a', 'b', 'c', 'd'];

  this.ready = false;
  this.data = null;
  this.total = this.parameters.maps.length;
  this.previous = undefined;
  this.current = undefined;

  var group = new THREE.Object3D();

  this.geometry = new THREE.PlaneGeometry(50, 50, this.parameters.divisionsX, this.parameters.divisionsY);

  // Per-vertex colour attribute for the plane/points. Modern BufferGeometry
  // stores colours per vertex (not per face-vertex like the old Face3); since
  // the colour is derived purely from each vertex's height (z), the collapse is
  // exact.
  this.geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(this.geometry.attributes.position.count * 3), 3)
  );

  if (this.parameters.plane) {
    this.plane = this.getPlane();
    group.add(this.plane);
  }

  if (this.parameters.points) {
    this.points = this.getPoints();
    group.add(this.points);
  }

  if (this.parameters.horizontal || this.parameters.vertical) {
    this.lines = this.getLines();
    group.add(this.lines);
  }

  this.loadMaps();

  this.el = group;

  this.start = function () {};
  
  this.stop = this.start;

  this.on('ready', function () {
    this.ready = true;

    var idleTween = this.getIdleTween();

    this.start = function () {
      idleTween.resume();
    };

    this.stop = function () {
      idleTween.pause();
    };
  }.bind(this));
}

HeightMap.defaultOptions = {
  horizontal: true,
  vertical: false,
  plane: false,
  points: false,
  divisionsX: 30,
  divisionsY: 30,
  fromColor: '#4c4c4c',
  toColor: '#ffffff',
  maps: []
};

/**
 * Get plane
 *
 * @method getPlane
 * @param {THREE.Geometry} geometry
 * @return {THREE.Mesh}
 */
HeightMap.prototype.getPlane = function () {
  var material = new THREE.MeshLambertMaterial({
    flatShading: true,
    vertexColors: true
  });

  var plane = new THREE.Mesh(this.geometry, material);

  return plane;
};

/**
 * Get points
 *
 * @method getPoints
 * @param {THREE.Geometry} geometry
 * @return {THREE.Points}
 */
HeightMap.prototype.getPoints = function () {
  var material = new THREE.PointsMaterial({ size: 0.3 });
  var points = new THREE.Points(this.geometry, material);

  return points;
};

/**
 * Get lines
 *
 * @method getLines
 * @param {THREE.Geometry} geometry
 * @return {THREE.Object3D}
 */
HeightMap.prototype.getLines = function () {
  var material = new THREE.LineBasicMaterial({
    vertexColors: true
  });

  var lines = new THREE.Object3D();

  var divX = this.parameters.divisionsX;
  var divY = this.parameters.divisionsY;
  var pos = this.geometry.attributes.position;

  // grid vertex index (matches PlaneGeometry's row-major ordering)
  function gridIndex (x, y) {
    return (y * (divX + 1)) + x;
  }

  // Each line is its own BufferGeometry; it mirrors a row/column of the shared
  // plane grid. We keep, per line, the plane vertex indices it spans plus its
  // position/colour buffers, so applyMap/setColors can copy height & colour
  // from the plane grid each frame (the r68 code shared the actual Vector3s).
  this.lineData = [];

  var buildLine = function (indices) {
    var count = indices.length;
    var positions = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);

    for (var n = 0; n < count; n++) {
      var gi = indices[n];
      positions[n * 3] = pos.getX(gi);
      positions[n * 3 + 1] = pos.getY(gi);
      positions[n * 3 + 2] = pos.getZ(gi);
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var colorAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('color', colorAttr);

    var line = new THREE.Line(geometry, material);
    lines.add(line);

    this.lineData.push({ line: line, indices: indices, positions: positions, colorAttr: colorAttr });
  }.bind(this);

  // Jitter the left/right edges of the shared plane grid (the r68 code did this
  // inline while building horizontal lines, mutating the shared vertices).
  if (this.parameters.horizontal) {
    for (var jy = 0; jy < divY + 1; jy++) {
      var left = gridIndex(0, jy);
      var right = gridIndex(divX, jy);
      pos.setX(left, pos.getX(left) - random(0, 20));
      pos.setX(right, pos.getX(right) + random(0, 20));
    }
    pos.needsUpdate = true;
  }

  if (this.parameters.vertical) {
    for (var x = 0; x < divX + 1; x++) {
      var vIndices = [];
      for (var vy = 0; vy < divY + 1; vy++) {
        vIndices.push(gridIndex(x, vy));
      }
      buildLine(vIndices);
    }
  }

  if (this.parameters.horizontal) {
    for (var y = 0; y < divY + 1; y++) {
      var hIndices = [];
      for (var hx = 0; hx < divX + 1; hx++) {
        hIndices.push(gridIndex(hx, y));
      }
      buildLine(hIndices);
    }
  }

  return lines;
};

/**
 * Get animations
 *
 * @method getIdleTween
 * @return {TweenLite}
 */
HeightMap.prototype.getIdleTween = function () {
  var _this = this;

  return TweenLite.to({}, 2, { paused: true,
      onComplete: function () {
        _this.current++;

        if (_this.current === _this.total) {
          _this.current = 0;
        }

        _this.applyMap();

        this.duration(random(1.5, 5));
        this.restart();
      }
    });
};

/**
 * Load maps
 *
 * @method loadMaps
 */
HeightMap.prototype.loadMaps = function () {
  var totalData = (this.parameters.divisionsX + 1) * (this.parameters.divisionsY + 1);
  this.data = { default: new Float32Array(totalData) };
  
  var loader = new THREE.ImageLoader();
  var total = this.parameters.maps.length;
  var loaded = 0;

  var addMap = function (name, image) {
    var width = image.width;
    var height = image.height;

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    var context = canvas.getContext('2d');

    context.drawImage(image, 0, 0);

    var stepX = width / this.parameters.divisionsX;
    var stepY = height / this.parameters.divisionsY;

    var data = new Float32Array(totalData);
    var i = 0;

    for (var y = 0; y < height; y += stepY) {
      for (var x = 0; x < width; x += stepX) {
        var pixelData = context.getImageData(x, y, 1, 1).data;

        // Luminance = R + G + B
        // int8 must be in the [-127, 127] range
        // Max luminance = 765 (255 * 3), dividing by 10 ensures it can only be 76.5 at max
        data[i++] = (pixelData[0] + pixelData[1] + pixelData[2]) / 100;
      }
    }

    _this.data[name] = data;
  }.bind(this);

  var _this = this;
  
  function loadMap (map, index) {
    loader.load(map.url, function (image) {
      addMap(map.name, image);

      loaded++;

      if (loaded === 1) {
        _this.current = index;
        _this.applyMap();
      }

      if (loaded === total) {
        _this.trigger('ready');
      }
    });
  }

  for (var i = 0; i < total; i++) {
    var map = this.parameters.maps[i];
    loadMap(map, i);
  }
};

/**
 * Apply current map
 *
 * @method applyMap
 */
HeightMap.prototype.applyMap = function () {
  var previousName = typeof this.previous === 'undefined'
    ? 'default'
    : this.parameters.maps[this.previous].name;

  var currentName = this.parameters.maps[this.current].name;

  var previousData = this.data[previousName];
  var currentData = this.data[currentName];

  var _this = this;

  TweenLite.to({ factor: 1 }, 1, { factor: 0, ease: window.Elastic.easeOut,
      onUpdate: function () {
        var pos = _this.geometry.attributes.position;
        var arr = pos.array;

        for (var i = 0, j = pos.count; i < j; i++) {
          var offset = currentData[i] + ((previousData[i] - currentData[i]) * this.target.factor);
          arr[i * 3 + 2] = offset;
        }

        pos.needsUpdate = true;

        // mirror the new heights onto each line's own position buffer
        if (_this.lineData) {
          for (var k = 0, l = _this.lineData.length; k < l; k++) {
            var ld = _this.lineData[k];
            for (var m = 0, n = ld.indices.length; m < n; m++) {
              ld.positions[m * 3 + 2] = arr[ld.indices[m] * 3 + 2];
            }
            ld.line.geometry.attributes.position.needsUpdate = true;
          }
        }

        _this.setColors();
      }
    });

  this.previous = this.current;
};

/**
 * Set lines/points/plane vertices colors
 *
 * @method setColors
 */
HeightMap.prototype.setColors = function () {
  var _this = this;
  var arr = this.geometry.attributes.position.array;

  // (255 + 255 + 255) / 10 = 76.5, 76.5 / 20 = 3.8
  function colorForZ (z) {
    var percent = map(z, [0, 3.8], [0, 2]);
    percent = Math.round(percent * 10) / 10;

    if (!_this.colorsCache[percent]) {
      _this.colorsCache[percent] = _this.fromColor.clone().lerp(_this.toColor, percent);
    }

    return _this.colorsCache[percent];
  }

  // planes/points (per-vertex colours on the shared geometry)
  if (this.plane || this.points) {
    var colorAttr = this.geometry.attributes.color;

    for (var i = 0, j = colorAttr.count; i < j; i++) {
      var c = colorForZ(arr[i * 3 + 2]);
      colorAttr.setXYZ(i, c.r, c.g, c.b);
    }

    colorAttr.needsUpdate = true;
  }

  // lines
  if (this.lineData) {
    for (var k = 0, l = this.lineData.length; k < l; k++) {
      var ld = this.lineData[k];

      for (var m = 0, n = ld.indices.length; m < n; m++) {
        var lc = colorForZ(arr[ld.indices[m] * 3 + 2]);
        ld.colorAttr.setXYZ(m, lc.r, lc.g, lc.b);
      }

      ld.colorAttr.needsUpdate = true;
    }
  }
};

/**
 * Listen to event bus
 *
 * @method on
 */
HeightMap.prototype.on = function () {
  this.events.on.apply(this.events, arguments);
};

/**
 * Trigger event on event bus
 *
 * @method trigger
 */
HeightMap.prototype.trigger = function () {
  this.events.trigger.apply(this.events, arguments);
};

export default HeightMap;