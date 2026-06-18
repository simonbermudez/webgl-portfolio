'use strict';

/**
 * Mobile Detection Utility
 *
 * @module MobileUtils
 */
var MobileUtils = (function () {
  
  function isMobile() {
    return navigator.userAgent.match(/Android/i)
      || navigator.userAgent.match(/webOS/i)
      || navigator.userAgent.match(/iPhone/i)
      || navigator.userAgent.match(/iPad/i)
      || navigator.userAgent.match(/iPod/i)
      || navigator.userAgent.match(/BlackBerry/i)
      || navigator.userAgent.match(/Windows Phone/i);
  }

  function isTablet() {
    return navigator.userAgent.match(/iPad/i)
      || (navigator.userAgent.match(/Android/i) && !navigator.userAgent.match(/Mobile/i))
      || (navigator.userAgent.match(/Touch/i) && !navigator.userAgent.match(/Mobile/i));
  }

  function getTouchCapable() {
    return 'ontouchstart' in window 
      || navigator.maxTouchPoints > 0 
      || navigator.msMaxTouchPoints > 0;
  }

  function getPerformanceLevel() {
    // Basic performance detection based on device type and features
    if (isTablet()) {
      return 'medium'; // Tablets usually have better performance
    } else if (isMobile()) {
      return 'low'; // Mobile phones get reduced quality
    } else {
      return 'high'; // Desktop gets full quality
    }
  }

  function getMobileOptimizations() {
    var mobile = isMobile();
    var tablet = isTablet();
    var touchCapable = getTouchCapable();
    var performanceLevel = getPerformanceLevel();

    return {
      isMobile: mobile,
      isTablet: tablet,
      isTouchCapable: touchCapable,
      performanceLevel: performanceLevel,
      // WebGL optimizations
      antialias: performanceLevel === 'high',
      shadowMap: performanceLevel === 'high',
      particles: performanceLevel === 'high' ? 1000 : mobile ? 200 : 500,
      backgroundLines: performanceLevel === 'high' ? 200 : mobile ? 50 : 100,
      quality: performanceLevel === 'high' ? 1 : mobile ? 0.75 : 0.9
    };
  }

  return {
    isMobile: isMobile,
    isTablet: isTablet,
    isTouchCapable: getTouchCapable,
    getPerformanceLevel: getPerformanceLevel,
    getOptimizations: getMobileOptimizations
  };
})();

export default MobileUtils;
