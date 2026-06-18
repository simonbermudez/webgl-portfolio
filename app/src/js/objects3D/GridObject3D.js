'use strict';

import jQuery from 'jquery';
import * as THREE from 'three';
import { TweenLite } from 'gsap';

import random from '../utils/randomUtil.js';
import yoyo from '../utils/yoyoUtil.js';

/**
 * Animated grid
 *
 * @class Grid
 * @constructor
 * @param {Object} [options]
 * @param {Boolean} [options.points=false] Points?
 * @param {Number} [options.divisionsSize=10] Divisions size
 * @param {Number} [options.divisionsX=11] X axis divisions
 * @param {Number} [options.divisionsY=11] Y axis divisions
 * @param {String} [options.fromColor='#ffffff'] On color
 * @param {String} [options.toColor='#0a0a0a'] Off color
 * @requires jQuery, THREE, TweenLite, random, yoyo
 */
function Grid (options) {
  this.parameters = jQuery.extend(Grid.defaultOptions, options);

  this.width = (this.parameters.divisionsX - 1) * this.parameters.divisionsSize;
  this.height = (this.parameters.divisionsY - 1) * this.parameters.divisionsSize;

  var group = new THREE.Object3D();

  var vertices = this.getVertices();

  if (this.parameters.points) {
    var pointsPositions = [];

    for (var i = 0, j = vertices.length; i < j; i++) {
      pointsPositions.push(vertices[i][0]);
      pointsPositions.push(vertices[i][1]);
      pointsPositions.push(vertices[i][2]);
    }

    var pointsGeometry = new THREE.BufferGeometry().setFromPoints(pointsPositions);

    var pointsMaterial = new THREE.PointsMaterial({ size: 0.2 });
    var points = new THREE.Points(pointsGeometry, pointsMaterial);

    group.add(points);
  }

  var lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    linewidth: 1
  });

  var colorsCache = {};
  var fromColor = new THREE.Color(this.parameters.fromColor);
  var toColor = new THREE.Color(this.parameters.toColor);

  var idleTweens = [];

  for (var k = 0, l = vertices.length; k < l; k++) {
    var firstTo = vertices[k][0].clone();
    var secondTo = vertices[k][2].clone();

    var lineVertices = [
      vertices[k][1].clone(),
      vertices[k][1],
      vertices[k][1].clone()
    ];

    var lineGeometry = new THREE.BufferGeometry().setFromPoints(lineVertices);

    var colorAttr = new THREE.BufferAttribute(new Float32Array(lineVertices.length * 3), 3);
    lineGeometry.setAttribute('color', colorAttr);

    for (var m = 0, n = lineVertices.length; m < n; m++) {

      var color = null;
      var percent = null;

      if (k >= this.parameters.divisionsX) {
        // horizontal
        var y = lineVertices[m].y;
        percent = Math.abs((y * 100 / this.height) / 100);
      } else {
        // vertical
        var x = lineVertices[m].x;
        percent = Math.abs((x * 100 / this.width) / 100);
      }

      if (!colorsCache[percent]) {
        color = fromColor.clone().lerp(toColor, percent + 0.2);
        colorsCache[percent] = color;
      } else {
        color = colorsCache[percent];
      }

      colorAttr.setXYZ(0, toColor.r, toColor.g, toColor.b);
      colorAttr.setXYZ(1, color.r, color.g, color.b);
      colorAttr.setXYZ(2, toColor.r, toColor.g, toColor.b);
    }
    colorAttr.needsUpdate = true;

    var line = new THREE.Line(lineGeometry, lineMaterial);

    var linePositions = lineGeometry.attributes.position.array;

    idleTweens.push(this.getTween(line, linePositions, 0, firstTo));
    idleTweens.push(this.getTween(line, linePositions, 2, secondTo));

    group.add(line);
  }

  this.el = group;

  this.start = function () {
    for (var i = 0, j = idleTweens.length; i < j; i++) {
      idleTweens[i].resume();
    }
  };

  this.stop = function () {
    for (var i = 0, j = idleTweens.length; i < j; i++) {
      idleTweens[i].pause();
    }
  };

  this.in = function () {
    TweenLite.to(group.position, 1, { y: 0 });
  };

  this.out = function (way) {
    var y = way === 'up' ? -50 : 50;
    TweenLite.to(group.position, 1, { y: y });
  };
}

Grid.defaultOptions = {
  points: false,
  divisionsSize: 10,
  divisionsX: 11,
  divisionsY: 11,
  fromColor: '#ffffff',
  toColor: '#0a0a0a'
};

/**
 * Get vertices
 *
 * @method getVertices
 * @return {Array} vertices
 */
Grid.prototype.getVertices = function () {
  var vertices = [];

  // horizontal
  for (var x = 0; x < this.parameters.divisionsX; x++) {
    var xPosH = (x * this.parameters.divisionsSize) - (this.width / 2);
    var yPosH = this.height - (this.height / 2);

    vertices.push([
      new THREE.Vector3(xPosH, -this.height / 2, 0),
      new THREE.Vector3(xPosH, yPosH - (this.height / 2) , 0),
      new THREE.Vector3(xPosH, yPosH, 0)
    ]);
  }

  // vertical
  for (var y = 0; y < this.parameters.divisionsY; y++) {
    var xPosV = this.width - (this.width / 2);
    var yPosV = (y * this.parameters.divisionsSize) - (this.height / 2);

    vertices.push([
      new THREE.Vector3(-this.width / 2, yPosV, 0),
      new THREE.Vector3(xPosV - (this.width / 2), yPosV, 0),
      new THREE.Vector3(xPosV, yPosV, 0)
    ]);
  }

  return vertices;
};

/**
 * Get line animation
 *
 * @method getTween
 * @param {THREE.Line} [line] Line to animate
 * @param {Float32Array} [positions] Geometry position buffer to mutate
 * @param {Number} [vertexIndex] Index of the vertex to animate
 * @param {THREE.Vector3} [to] End coordinates
 */
Grid.prototype.getTween = function (line, positions, vertexIndex, to) {
  var offset = vertexIndex * 3;

  var from = {
    x: positions[offset + 0],
    y: positions[offset + 1],
    z: positions[offset + 2]
  };

  var parameters = {
    paused: true,
    delay: random(0, 2),
    onUpdate: function () {
      positions[offset + 0] = from.x;
      positions[offset + 1] = from.y;
      positions[offset + 2] = from.z;
      line.geometry.attributes.position.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    },
    onComplete: yoyo,
    onReverseComplete: yoyo,
    x: to.x,
    y: to.y,
    z: to.z
  };

  return TweenLite.to(from, random(1, 2), parameters);
};

export default Grid;