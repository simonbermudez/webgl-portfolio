'use strict';

import Section from '../classes/SectionClass.js';
import MobileUtils from '../utils/mobileUtils.js';

import TextPanel from '../objects3D/TextPanelObject3D.js';
import Galaxy from '../objects3D/GalaxyObject3D.js';

var galaxySection = new Section('galaxy');

var galaxy = new Galaxy();
galaxy.el.rotation.x = -1;
galaxySection.add(galaxy.el);

galaxy.el.visible = false;

// Mobile-responsive text settings
var isMobile = MobileUtils.isMobile();
var textOptions = {
  align: 'center', // Keep center alignment
  style: isMobile ? 'Bold' : '',
  size: isMobile ? 30 : 50, // Smaller text on mobile
  lineSpacing: isMobile ? 25 : 40 // Reduced line spacing on mobile
};

var text = new TextPanel(
  'W  O  R  K \n A  S    A    T  E  A  M',
  textOptions
);
text.el.position.set(0, isMobile ? 10 : 20, -20); // Adjust Y position for mobile
galaxySection.add(text.el);

galaxySection.onIn(function (way) {
  galaxy.in(way);
  text.in();
});

galaxySection.onOut(function (way) {
  galaxy.out(way);
  text.out(way);
});

galaxySection.onStart(function () {
  galaxy.start();

  galaxy.el.visible = true;
});

galaxySection.onStop(function () {
  galaxy.stop();

  galaxy.el.visible = false;
});

export default galaxySection;