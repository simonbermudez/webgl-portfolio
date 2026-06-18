'use strict';

import * as THREE from 'three';

/**
 * three.js r152+ enables automatic sRGB<->linear colour management by default,
 * which shifts every colour and texture in a scene authored against r68 (where
 * no conversion happened). This portfolio is a finished piece whose look we want
 * to preserve exactly, so we opt out of colour management — colours and textures
 * then render the same way they did under r68.
 *
 * Imported first by the 3D entry so the flag is set before any THREE.Color /
 * material / texture is created.
 */
THREE.ColorManagement.enabled = false;
