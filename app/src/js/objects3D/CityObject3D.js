'use strict';

import * as THREE from 'three';

import dilate from '../utils/dilateUtil.js';
import loadLegacyModel from '../utils/legacyModelUtil.js';

import outlineMaterial from '../materials/outlineMaterial.js';

function City () {
  this.el = new THREE.Object3D();

  this.groups = {};
  // flatShading restores the faceted look of the buildings: the legacy loader
  // welds vertices and computes smooth normals (needed for the outline's dilate),
  // which would otherwise blur the boxy faces into a flat grey mass.
  this.baseMaterial = new THREE.MeshLambertMaterial({ color: '#333333', flatShading: true });
}

City.prototype.addGroup = function (data) {
  if (!this.groups[data.name]) {
    this.groups[data.name] = new THREE.Object3D();
  }

  if (!data.outline) {
    data.outline = {};
  }

  var groupName = data.name;

  for (var objName in data.objs) {
    if (data.objs.hasOwnProperty(objName)) {
      var url = data.objs[objName];

      if (!data.outline[objName]) {
        data.outline[objName] = {};
      }

      var isSolid = data.outline[objName].solid ? true : false;
      var offset = data.outline[objName].offset
        ? data.outline[objName].offset
        : 0.15;

      this.loadObj(groupName, url, offset, isSolid);
    }
  }
};

City.prototype.loadObj = function (groupName, url, offset, isSolid) {
  var _this = this;

  loadLegacyModel(url, function (geometry) {
    _this.processObj({
      geometry: geometry,
      group: groupName,
      offset: offset,
      solid: isSolid
    });
  });
};

City.prototype.processObj = function (data) {
  var groupName = data.group;
  var geometry = data.geometry;

  var mesh = new THREE.Mesh(geometry, this.baseMaterial);

  this.groups[groupName].add(mesh);

  var outlineGeometry = geometry.clone();
  dilate(outlineGeometry, data.offset);

  var localOutlineMaterial = outlineMaterial.clone();

  var outlineMesh = new THREE.Mesh(outlineGeometry, localOutlineMaterial);

  outlineGeometry.computeBoundingBox();
  var height = outlineGeometry.boundingBox.max.y - outlineGeometry.boundingBox.min.y;

  // Per-vertex rgba is now a `customColor` BufferAttribute on the geometry
  // (bound by name to the shader's `attribute vec4 customColor`).
  var position = outlineGeometry.attributes.position;
  var customColor = new Float32Array(position.count * 4);

  for (var i = 0, j = position.count; i < j; i++) {
    var alpha;

    if (data.solid) {
      alpha = 1.0;
    } else {
      var percent = Math.floor(position.getY(i) * 100 / height) - 10;
      alpha = percent / 100;
    }

    customColor[i * 4] = 0.7;
    customColor[i * 4 + 1] = 0.7;
    customColor[i * 4 + 2] = 0.7;
    customColor[i * 4 + 3] = alpha;
  }

  outlineGeometry.setAttribute('customColor', new THREE.BufferAttribute(customColor, 4));

  this.groups[groupName].add(outlineMesh);
};

City.prototype.showGroup = function (name) {
  this.el.add(this.groups[name]);
};

export default City;