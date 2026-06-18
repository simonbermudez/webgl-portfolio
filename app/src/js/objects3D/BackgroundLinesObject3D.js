'use strict';
  
import jQuery from 'jquery';
import * as THREE from 'three';

import random from '../utils/randomUtil.js';

/**
 * Background floating lines
 *
 * @class BackgroundLines
 * @constructor
 * @param {Object} [options]
 * @param {Number} [options.count=200] Number of lines
 * @param {Array} [options.rangeY=[-100, 100]] Y range for the random
 * @requires jQuery, THREE, random
 */
function BackgroundLines (options) {
  var parameters = jQuery.extend(BackgroundLines.defaultOptions, options);

  var group = new THREE.Object3D();

  var line = this.getLine();

  for (var i = 0; i < parameters.count; i++) {
    var lineCopy = line.clone();

    lineCopy.position.x = random(-20, 20);
    lineCopy.position.y = random(parameters.rangeY[0], parameters.rangeY[1]);
    lineCopy.position.z = random(-50, 50);

    group.add(lineCopy);
  }

  this.el = group;
  this.line = line;
}

BackgroundLines.defaultOptions = {
  count: 200,
  rangeY: [-100, 100]
};

/**
 * Get base line
 *
 * @method getLine
 * @return {THREE.Line} 
 */
BackgroundLines.prototype.getLine = function () {
  var material = new THREE.LineBasicMaterial();

  var positions = new Float32Array(2 * 3);
  positions[0] = 0; positions[1] = 0.2; positions[2] = 0; // vertex 0: (0, 0.2, 0)
  positions[3] = 0; positions[4] = 0;   positions[5] = 0; // vertex 1: (0, 0, 0)

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  var line = new THREE.Line(geometry, material);
  line.userData.positions = positions;

  return line;
};

/**
 * Update lines Y size
 *
 * @method updateY
 * @param {Number} [speed]
 */
BackgroundLines.prototype.updateY = function (speed) {
  this.line.userData.positions[1] = speed + 0.2; // vertex 0 y = index 0*3 + 1
  this.line.geometry.attributes.position.needsUpdate = true;
  this.line.geometry.computeBoundingSphere();
};

/**
 * Update lines Z size
 *
 * @method updateZ
 * @param {Number} [speed]
 */
BackgroundLines.prototype.updateZ = function (speed) {
  this.line.userData.positions[2] = speed; // vertex 0 z = index 0*3 + 2
  this.line.geometry.attributes.position.needsUpdate = true;
  this.line.geometry.computeBoundingSphere();
};

export default BackgroundLines;