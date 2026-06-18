'use strict';
  
import jQuery from 'jquery';
import * as THREE from 'three';
import { TweenLite } from 'gsap';

import random from '../utils/randomUtil.js';

/**
 * Animated strip
 *
 * @class Strip
 * @constructor
 * @param {Object} [options]
 * @pram {Number} [options.count=10] Strips count
 * @pram {Array} [options.colors=['#ffffff']] Strips colors
 * @pram {Number} [options.width=10] Strip width
 * @pram {Number} [options.height=3] Strip height
 * @pram {Number} [options.speed=1] Animations speed
 * @pram {Array} [options.rangeX=[-50, 50]] X position range
 * @pram {Array} [options.rangeY=[-50, 50]] Y position range
 * @pram {Array} [options.rangeZ=[-50, 50]] Z position range
 * @requires jQuery, THREE, TweenLite, random
 */
function cornerIndex (pos, signX, signY, w, h) {
  var tx = signX * w / 2, ty = signY * h / 2;
  for (var i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i) - tx) < 1e-4 && Math.abs(pos.getY(i) - ty) < 1e-4) return i;
  }
  return -1;
}

function Strip (options) {
  this.parameters = jQuery.extend(Strip.defaultOptions, options);

  this.geometry = new THREE.PlaneGeometry(this.parameters.width, this.parameters.height);

  this.el = new THREE.Object3D();

  var materials = {};

  for (var i = 0; i < this.parameters.count; i++) {
    var x = random(this.parameters.rangeX[0], this.parameters.rangeX[1]);
    var y = random(this.parameters.rangeY[0], this.parameters.rangeY[1]);
    var z = random(this.parameters.rangeZ[0], this.parameters.rangeZ[1]);

    var color = this.parameters.colors[random(0, this.parameters.colors.length, true)];

    if (!materials[color]) {
      var material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide
      });

      materials[color] = material;
    }

    var mesh = new THREE.Mesh(this.geometry, materials[color]);
    mesh.position.set(x, y, z);
    this.el.add(mesh);
  }

  var pos = this.geometry.attributes.position;

  // r68 index 0 = top-left (-x,+y), 1 = top-right (+x,+y), 3 = bottom-right (+x,-y)
  this._topLeftIndex = cornerIndex(pos, -1, 1, this.parameters.width, this.parameters.height);
  this._topRightIndex = cornerIndex(pos, 1, 1, this.parameters.width, this.parameters.height);
  this._bottomRightIndex = cornerIndex(pos, 1, -1, this.parameters.width, this.parameters.height);

  this.from = pos.getX(this._topLeftIndex);
  this.to = pos.getX(this._topRightIndex);
  this.cache =  { x: this.from };

  pos.setX(this._topRightIndex, this.from);
  pos.setX(this._bottomRightIndex, this.from);
  pos.needsUpdate = true;
};

Strip.prototype.update = function () {
  var pos = this.geometry.attributes.position;
  pos.setX(this._topRightIndex, this.cache.x);
  pos.setX(this._bottomRightIndex, this.cache.x);
  pos.needsUpdate = true;
  this.geometry.computeBoundingSphere();
};

Strip.prototype.in = function () {
  TweenLite.to(this.cache, this.parameters.speed, { x: this.to,
    onUpdate: this.update.bind(this)
  });
};

Strip.prototype.out = function () {
  TweenLite.to(this.cache, this.parameters.speed, { x: this.from,
    onUpdate: this.update.bind(this)
  });
};

Strip.defaultOptions = {
  count: 10,
  colors: ['#ffffff'],
  width: 10,
  height: 3,
  speed: 1,
  rangeX: [-50, 50],
  rangeY: [-50, 50],
  rangeZ: [-50, 50]
};

export default Strip;