'use strict';

import * as THREE from 'three';

/**
 * Dilate a geometry along the normals
 *
 * @method dilate
 * @param {THREE.Object3D} [geometry] Geometry to dilate
 * @param {Number} [offset] Desired offset
 */
function dilate (geometry, offset) {
  // Smooth (averaged) per-vertex normals. On an indexed BufferGeometry
  // computeVertexNormals averages across shared faces, matching what the old
  // Geometry.computeVertexNormals did before offsetting.
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }

  var position = geometry.attributes.position;
  var normal = geometry.attributes.normal;

  for (var i = 0, j = position.count; i < j; i++) {
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * offset,
      position.getY(i) + normal.getY(i) * offset,
      position.getZ(i) + normal.getZ(i) * offset
    );
  }

  position.needsUpdate = true;
}

export default dilate;