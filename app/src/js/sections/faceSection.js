'use strict';

import Section from '../classes/SectionClass.js';
import MobileUtils from '../utils/mobileUtils.js';

import TextPanel from '../objects3D/TextPanelObject3D.js';
import Face from '../objects3D/FaceHpObject3D.js';
import Strips from '../objects3D/StripsObject3D.js';

var faceSection = new Section('face');

// Mobile-responsive text settings
var isMobile = MobileUtils.isMobile();
var textOptions = {
  align: 'center', // Always center on mobile
  style: isMobile ? 'Bold' : '',
  size: isMobile ? 30 : 50, // Smaller text on mobile
  lineSpacing: isMobile ? 25 : 40 // Reduced line spacing on mobile
};

var text = new TextPanel(
  'K  E  E  P \n T  R  Y  I  N  G',
  textOptions
);
text.el.position.set(isMobile ? 0 : 23, 0, 0);
text.el.rotation.y = isMobile ? 0 : -0.4; // No rotation on mobile for better readability
faceSection.add(text.el);

var face = new Face();
face.el.position.y = -5;
face.el.rotation.x = -0.1;
face.el.rotation.z = 0.25;
faceSection.add(face.el);

var strips = new Strips({
  count: 10,
  colors: ['#444444', '#333333', '#222222'],
  rangeY: [-60, 60]
});
faceSection.add(strips.el);

face.el.visible = false;
strips.el.visible = false;

faceSection.onIn(function () {
  face.in();
  strips.in();
  text.in();
});

faceSection.onOut(function (way) {
  face.out(way);
  strips.out();
  text.out();
});

faceSection.onStart(function () {
  face.start();

  face.el.visible = true;
  strips.el.visible = true;
});

faceSection.onStop(function () {
  face.stop();

  face.el.visible = false;
  strips.el.visible = false;
});

export default faceSection;