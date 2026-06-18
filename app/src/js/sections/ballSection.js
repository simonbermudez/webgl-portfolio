'use strict';

import Section from '../classes/SectionClass.js';
import MobileUtils from '../utils/mobileUtils.js';

import TextPanel from '../objects3D/TextPanelObject3D.js';
import Ball from '../objects3D/BallObject3D.js';
import Grid from '../objects3D/GridObject3D.js';

var ballSection = new Section('ball');

var ball = new Ball();
ball.el.rotation.z = 2;
ballSection.add(ball.el);

var grid = new Grid({
  step: 5,
  stepsX: 11,
  stepsY: 11,
  loop: true
});
grid.el.rotation.set(1.5, 1, 2);
grid.el.position.x = -20;
ballSection.add(grid.el);

// Mobile-responsive text settings
var isMobile = MobileUtils.isMobile();
var textOptions = {
  align: 'center', // Always center on mobile
  style: isMobile ? 'Bold' : '',
  size: isMobile ? 30 : 50, // Smaller text on mobile
  lineSpacing: isMobile ? 25 : 40 // Reduced line spacing on mobile
};

var text = new TextPanel(
  'G  I  V  E \n S  H  A  P  E',
  textOptions
);
text.el.position.set(isMobile ? 0 : 15, 0, 15);
text.el.rotation.y = isMobile ? 0 : -0.4; // No rotation on mobile for better readability
ballSection.add(text.el);

ball.el.visible = false;
grid.el.visible = false;

ballSection.onIn(function () {
  ball.in();
  grid.in();
  text.in();
});

ballSection.onOut(function (way) {
  text.out(way);
  grid.out(way);

  if (way === 'up') {
    ball.out();
  }
});

ballSection.onStart(function () {
  ball.start();
  grid.start();

  ball.el.visible = true;
  grid.el.visible = true;
});

ballSection.onStop(function () {
  ball.stop();
  grid.stop();

  ball.el.visible = false;
  grid.el.visible = false;
});

export default ballSection;