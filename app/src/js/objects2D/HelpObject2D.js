'use strict';

import jQuery from 'jquery';
import MobileUtils from '../utils/mobileUtils.js';

import Slider from '../libs/sliderLib.js';

import Layout from '../objects2D/LayoutObject2D.js';
import Mouse from '../objects2D/MouseObject2D.js';
import Keys from '../objects2D/KeysObject2D.js';

/**
 * Help overlay
 *
 * @class Help
 * @constructor
 * @requires jQuery, Sider, Layout, Mouse, Keys
 */
function Help () {
  this.$el = jQuery('.help');
  this.slider = new Slider(this.$el.find('.slider'));
  this.isMobile = MobileUtils.isMobile();

  this.keys = new Keys(this.$el.find('.keys'));
  this.mouse = new Mouse(this.$el.find('.mouse'));
  this.layout = new Layout(this.$el.find('.layout'));
}

/**
 * In animation
 *
 * @method in
 */
Help.prototype.in = function () {
  this.$el.css({ display: 'block', opacity: 0 });

  this.slider.start();

  this.slider.$el.delay(100).css({ top: '60%', opacity: 0 })
    .animate({ top: '50%', opacity: 1 }, 500);

  this.$el.stop().animate({ opacity: 0.9 }, 500, function () {
    // Only show keyboard/mouse help on desktop
    if (!this.isMobile) {
      this.keys.start();
      this.mouse.start();
    }
    this.layout.start();
  }.bind(this));

  this.$el.on('click touchend', function (event) {
    if (event.target === this) {
      this.out();
    }
  }.bind(this));

  this.$el.find('.help__quit').on('click touchend', function () {
    this.out();
  }.bind(this));
};

/**
 * Out animation
 *
 * @method out
 */
Help.prototype.out = function () {
  this.$el.stop().animate({ opacity: 0 }, 500, function () {
    this.$el.css('display', 'none');

    this.slider.stop();

    this.keys.stop();
    this.mouse.stop();
    this.layout.stop();
  }.bind(this));

  this.$el.off('click touchend');
  this.$el.find('.help__quit').off('click touchend');
};

export default Help;