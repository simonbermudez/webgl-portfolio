'use strict';

import * as THREE from 'three';

/**
 * Minimal re-implementation of the (removed) THREE.JSONLoader geometry parse for
 * the three.js model format v3.1 produced by the old OBJConverter. Returns an
 * INDEXED BufferGeometry (position + index) with smooth vertex normals computed
 * from the welded vertices — matching the original Geometry's shared-vertex
 * behaviour (important for the city's inverted-hull outline, which dilates along
 * averaged normals). UVs are not emitted: none of the materials that consume
 * these models (matcap, flat-shaded lambert, the outline shader) sample a
 * uv-mapped texture.
 *
 * Face bitmask (per the v3.1 spec):
 *   1: quad   2: hasMaterial   8: faceVertexUv   16: faceNormal
 *   32: faceVertexNormal   64: faceColor   128: faceVertexColor
 *
 * @module legacyModelUtil
 */

function parse (json) {
  var faces = json.faces;
  var vertices = json.vertices;
  var uvLayers = json.uvs || [];

  var nUvLayers = 0;
  for (var u = 0; u < uvLayers.length; u++) {
    if (uvLayers[u] && uvLayers[u].length > 0) { nUvLayers++; }
  }

  var indices = [];
  var offset = 0;

  while (offset < faces.length) {
    var type = faces[offset++];

    var isQuad             = type & 1;
    var hasMaterial        = type & 2;
    var hasFaceVertexUv    = type & 8;
    var hasFaceNormal      = type & 16;
    var hasFaceVertexNormal = type & 32;
    var hasFaceColor       = type & 64;
    var hasFaceVertexColor = type & 128;

    var nVertices = isQuad ? 4 : 3;

    var faceVerts = [];
    for (var v = 0; v < nVertices; v++) {
      faceVerts.push(faces[offset++]);
    }

    if (hasMaterial)        { offset += 1; }
    if (hasFaceVertexUv)    { offset += nUvLayers * nVertices; }
    if (hasFaceNormal)      { offset += 1; }
    if (hasFaceVertexNormal) { offset += nVertices; }
    if (hasFaceColor)       { offset += 1; }
    if (hasFaceVertexColor) { offset += nVertices; }

    // Triangulate. Quads split (a,b,c,d) -> (a,b,d) + (b,c,d), matching the old
    // JSONLoader.
    if (isQuad) {
      indices.push(faceVerts[0], faceVerts[1], faceVerts[3]);
      indices.push(faceVerts[1], faceVerts[2], faceVerts[3]);
    } else {
      indices.push(faceVerts[0], faceVerts[1], faceVerts[2]);
    }
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

var fileLoader = new THREE.FileLoader();

/**
 * Load a legacy v3.1 JSON model and hand its BufferGeometry to the callback.
 * Drop-in replacement for `new THREE.JSONLoader().load(url, onLoad)`.
 *
 * @param {String} url
 * @param {Function} onLoad  called with the parsed BufferGeometry
 */
export default function loadLegacyModel (url, onLoad) {
  fileLoader.load(url, function (text) {
    onLoad(parse(JSON.parse(text)));
  });
}
