'use strict';

import Section from '../classes/SectionClass.js';
import MobileUtils from '../utils/mobileUtils.js';

import TextPanel from '../objects3D/TextPanelObject3D.js';
import Drop from '../objects3D/DropObject3D.js';

var dropSection = new Section('drop');

var drop = new Drop({ amplitude: 4 });
drop.el.rotation.x = -1.2;
drop.el.position.y = -10;
dropSection.add(drop.el);

// Mobile-responsive text settings
var isMobile = MobileUtils.isMobile();
var textOptions = {
  align: 'center', // Always center on mobile
  style: isMobile ? 'Bold' : '',
  size: isMobile ? 30 : 50, // Smaller text on mobile
  lineSpacing: isMobile ? 25 : 40 // Reduced line spacing on mobile
};

var text = new TextPanel(
  'F  R  O  M \n A N   I D E A',
  textOptions
);
text.el.position.set(isMobile ? 0 : -10, 8, 0); // Center position on mobile
dropSection.add(text.el);

drop.el.visible = false;

dropSection.onIn(function () {
  drop.in();
  text.in();
});

dropSection.onOut(function (way) {
  drop.out(way);
  text.out(way);
});

dropSection.onStart(function () {
  drop.start();

  drop.el.visible = true;
});

dropSection.onStop(function () {
  drop.stop();

  drop.el.visible = false;
});

export default dropSection;