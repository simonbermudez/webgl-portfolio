'use strict';
  
import Section from '../classes/SectionClass.js';
import MobileUtils from '../utils/mobileUtils.js';

import TextPanel from '../objects3D/TextPanelObject3D.js';
import LookAtField from '../objects3D/LookAtFieldObject3D.js';

var endSection = new Section('end');

// Mobile-responsive text settings
var isMobile = MobileUtils.isMobile();
var textOptions = {
  align: 'center', // Keep center alignment
  style: isMobile ? 'Bold' : '',
  size: isMobile ? 30 : 50, // Smaller text on mobile
  lineSpacing: isMobile ? 25 : 40 // Reduced line spacing on mobile
};

var text = new TextPanel(
  'T  H  A  N  K  S \n F  O  R    W  A  T  C  H  I  N  G',
  textOptions
);
endSection.add(text.el);

var field = new LookAtField({
  count: 50
});
endSection.add(field.el);

endSection.onIn(function () {
  text.in();
  field.in();
});

endSection.onOut(function (way) {
  text.out(way);
  field.out(way);
});

export default endSection;