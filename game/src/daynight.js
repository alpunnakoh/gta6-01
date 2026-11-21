// SUNSET SHORES — daynight.js
// DayNight: the in-game clock drives the light. The city starts at golden
// hour and, over a 10-minute day, slides through dusk into a lamp-lit night
// and back out through dawn into a bright morning — the sun drops and
// climbs, the sky and fog change colour, the lamps glow after dark, and the
// street lamps are the only light left at 2am. The sunset look the game
// opens with is never lost: it comes back every evening.
(function () {
  'use strict';
  var CFG = Game.CFG;

  // Keyframes of the sky, from pre-dawn to late night. Each stop holds the
  // sky colour, fog colour, sun colour, sun height factor and hemisphere
  // strength at that hour; update() lerps between the two nearest stops.
  var STOPS = [
    { h: 0,  sky: 0x0d1526, fog: 0x141c2e, sun: 0x8a9ac0, sunY: -0.4, hemi: 0.35 },
    { h: 5,  sky: 0x0d1526, fog: 0x141c2e, sun: 0x8a9ac0, sunY: -0.4, hemi: 0.35 },
    { h: 6.5, sky: 0xffb37a, fog: 0xe89a7a, sun: 0xffc98a, sunY: 0.15, hemi: 0.7 },
    { h: 9,  sky: 0x7fb2e0, fog: 0xa8c8e0, sun: 0xfff2cc, sunY: 0.9, hemi: 1.0 },
    { h: 15, sky: 0x6fa8d8, fog: 0x9fc0d8, sun: 0xfff2cc, sunY: 0.8, hemi: 1.0 },
    { h: 17.4, sky: 0xff9a5c, fog: 0xe8966a, sun: 0xffd9a0, sunY: 0.3, hemi: 0.9 },
    { h: 19, sky: 0x7a4a6a, fog: 0x8a5a6a, sun: 0xff9a5c, sunY: 0.05, hemi: 0.6 },
    { h: 20, sky: 0x1a2440, fog: 0x1a2233, sun: 0x8a9ac0, sunY: -0.3, hemi: 0.4 },
    { h: 24, sky: 0x0d1526, fog: 0x141c2e, sun: 0x8a9ac0, sunY: -0.4, hemi: 0.35 }
  ];

  function DayNight(scene) {
    this.scene = scene;
    this.city = null;   // set once buildCity has run: {sun, hemi, sunSprite, lampHeads}
    this.lastHour = -1;
  }

  DayNight.prototype.attach = function (city) {
    this.city = city;
  };

  DayNight.prototype.isNight = function (hour) {
    return hour >= CFG.NIGHT_START_HOUR || hour < CFG.DAWN_HOUR;
  };

  // Weather dim: the weather system calls this after update() has set the
  // light for the hour, so a storm can darken the sun and hemisphere
  // without fighting the day-night cycle — update() resets it next frame.
  DayNight.prototype.setWeatherDim = function (factor) {
    if (!this.city) return;
    if (this.city.sun) this.city.sun.intensity *= factor;
    if (this.city.hemi) this.city.hemi.intensity *= (0.6 + 0.4 * factor);
  };

  DayNight.prototype.update = function (hour) {
    if (!this.city) return;
    var h = hour % 24;
    var a = STOPS[0], b = STOPS[STOPS.length - 1];
    for (var i = 0; i < STOPS.length - 1; i++) {
      if (h >= STOPS[i].h && h <= STOPS[i + 1].h) { a = STOPS[i]; b = STOPS[i + 1]; break; }
    }
    var span = Math.max(0.001, b.h - a.h);
    var t = Game.clamp((h - a.h) / span, 0, 1);
    var C = CFG.COLORS;
    var sky = Game.mixHex(a.sky, b.sky, t);
    var fog = Game.mixHex(a.fog, b.fog, t);
    var sunC = Game.mixHex(a.sun, b.sun, t);
    var sunY = Game.lerp(a.sunY, b.sunY, t);
    var hemiI = Game.lerp(a.hemi, b.hemi, t);
    this.scene.background.setHex(sky);
    if (this.scene.fog) this.scene.fog.color.setHex(fog);
    var sun = this.city.sun, hemi = this.city.hemi;
    // the sun swings from east (dawn) across the south to the west
    // (sunset), then below the horizon at night
    var ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
    if (sun) {
      sun.color.setHex(sunC);
      sun.position.set(Math.cos(ang) * 260, 40 + sunY * 160, 260);
      sun.intensity = sunY < -0.1 ? 0.15 : 1.6;
    }
    if (hemi) hemi.intensity = hemiI;
    if (this.city.sunSprite) {
      var sp = this.city.sunSprite;
      sp.position.set(Math.cos(ang) * 380, 30 + sunY * 190, 480);
      sp.material.opacity = sunY < -0.1 ? 0 : 1;
    }
    // lamps glow after dark and dim again at dawn
    var night = this.isNight(h) ? 1 : 0;
    var heads = this.city.lampHeads || [];
    for (var j = 0; j < heads.length; j++) {
      heads[j].material.color.setHex(night ? 0xffe9b0 : 0x8a8a7a);
    }
    this.lastHour = h;
  };

  Game.DayNight = DayNight;
})();
