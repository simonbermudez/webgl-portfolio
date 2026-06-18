'use strict';

import Section from '../classes/SectionClass.js';
import MobileUtils from '../utils/mobileUtils.js';

import TextPanel from '../objects3D/TextPanelObject3D.js';
import Wave from '../objects3D/WaveObject3D.js';

var waveSection = new Section('wave');

var wave = new Wave();
waveSection.add(wave.el);

// Mobile-responsive text settings
var isMobile = MobileUtils.isMobile();
var textOptions = {
  align: 'center', // Keep center alignment
  style: isMobile ? 'Bold' : '',
  size: isMobile ? 30 : 50, // Smaller text on mobile
  lineSpacing: isMobile ? 25 : 40 // Reduced line spacing on mobile
};

var text = new TextPanel(
  'E  Y  E  S    O  N    T  H  E \n H  O  R  I  Z  O  N',
  textOptions
);
text.el.position.y = 10;
text.el.rotation.x = isMobile ? 0 : 0.2; // No rotation on mobile for better readability
waveSection.add(text.el);

wave.el.visible = false;

waveSection.onIn(function (way) {
  text.in();
  wave.in(way);
});

waveSection.onOut(function (way) {
  text.out(way);
  wave.out(way);
});

waveSection.onStart(function () {
  wave.start();

  wave.el.visible = true;
});

waveSection.onStop(function () {
  wave.stop();

  wave.el.visible = false;
});

export default waveSection;