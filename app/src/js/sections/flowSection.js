'use strict';

import * as THREE from 'three';

import Section from '../classes/SectionClass.js';
import MobileUtils from '../utils/mobileUtils.js';

import FlowField from '../objects3D/FlowFieldObject3D.js';
import TextPanel from '../objects3D/TextPanelObject3D.js';

var flowSection = new Section('flow');

var points = [
  new THREE.Vector3(0, 50, 20),
  new THREE.Vector3(20, 0, -10),
  new THREE.Vector3(-20, -100, 0)
];

var field = new FlowField(points, {
  subsAmplitude: 50,
  subsNumber: 10
});
flowSection.add(field.el);

// Mobile-responsive text settings
var isMobile = MobileUtils.isMobile();
var textOptions = {
  align: 'center', // Keep center alignment
  style: isMobile ? 'Bold' : '',
  size: isMobile ? 30 : 50, // Smaller text on mobile
  lineSpacing: isMobile ? 25 : 40 // Reduced line spacing on mobile
};

var text = new TextPanel(
  'F  O  L  L  O  W \n T  H  E    T  R  E  N  D  S',
  textOptions
);
text.el.position.z = -10;
text.el.rotation.y = isMobile ? 0 : 0.4; // No rotation on mobile for better readability
flowSection.add(text.el);

field.el.visible = false;

var fieldIn = false;

flowSection.fieldIn = function () {
  if (fieldIn) {
    return false;
  }

  fieldIn = true;

  field.in();
};

flowSection.onIn(function () {
  text.in();
});

flowSection.onOut(function (way) {
  text.out(way);
});

flowSection.onStart(function () {
  field.start();

  field.el.visible = true;
});

flowSection.onStop(function () {
  field.stop();

  field.el.visible = false;
});

export default flowSection;