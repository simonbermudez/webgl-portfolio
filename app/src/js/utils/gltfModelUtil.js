'use strict';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Load a .glb and hand the first mesh's BufferGeometry to the callback. Any node
 * transform from the glTF scene graph is baked into the geometry, so callers get
 * geometry in the same space the source .obj was authored in (the scale/position
 * the object code applies afterwards then matches the old JSONLoader behaviour).
 *
 * Drop-in shape-compatible with loadLegacyModel(url, onLoad).
 *
 * @module gltfModelUtil
 */

var loader = new GLTFLoader();

export default function loadGltfGeometry (url, onLoad) {
  loader.load(url, function (gltf) {
    var geometry = null;

    gltf.scene.updateWorldMatrix(true, true);
    gltf.scene.traverse(function (child) {
      if (!geometry && child.isMesh) {
        geometry = child.geometry.clone();
        geometry.applyMatrix4(child.matrixWorld);
      }
    });

    onLoad(geometry);
  });
}
