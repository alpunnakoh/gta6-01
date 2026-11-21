// SUNSET SHORES — weather.js
// WeatherSystem: Palmera Bay finally has weather. The sky rolls through
// five states — CLEAR, CLOUDY, RAIN, STORM and FOG — on a slow scheduler,
// and each one changes how the city looks and drives. Rain falls as a
// particle sheet that follows the player, storms throw lightning with a
// delayed thunder crack, fog pulls the view distance in close, and wet
// roads cut the car's grip, so a rainy getaway genuinely feels different
// from a dry one. The HUD shows the current sky and the grip it costs.
(function () {
  'use strict';
  var CFG = Game.CFG;

  // What each sky does to the world. fogNear/fogFar are the THREE.Fog
  // distances, grip multiplies the car's throttle, rain is the 0..1
  // strength of the particle sheet, and light dims the sun + hemisphere
  // after the day-night cycle has set them for the hour.
  var STATES = {
    CLEAR:  { label: 'CLEAR',  fogNear: 180, fogFar: 520, grip: 1.0,  rain: 0,    light: 1.0,  weight: 3 },
    CLOUDY: { label: 'CLOUDY', fogNear: 150, fogFar: 460, grip: 1.0,  rain: 0,    light: 0.9,  weight: 3 },
    RAIN:   { label: 'RAIN',   fogNear: 120, fogFar: 380, grip: CFG.WEATHER_RAIN_GRIP, rain: 0.7, light: 0.72, weight: 3 },
    STORM:  { label: 'STORM',  fogNear: 90,  fogFar: 300, grip: CFG.WEATHER_STORM_GRIP, rain: 1.0, light: 0.55, weight: 2 },
    FOG:    { label: 'FOG',    fogNear: 55,  fogFar: 210, grip: CFG.WEATHER_FOG_GRIP, rain: 0,    light: 0.8,  weight: 2 }
  };
  var STATE_NAMES = ['CLEAR', 'CLOUDY', 'RAIN', 'STORM', 'FOG'];

  function WeatherSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng || Math.random;
    this.world = world || {};
    this.current = 'CLEAR';
    this.nextIn = 60 + this.rng() * 60;
    this.mix = 1;              // 0..1 blend toward the current state
    this.fogNear = 180;
    this.fogFar = 520;
    this.rainLevel = 0;        // 0..1, eased toward the state's rain
    this.flashT = 0;           // seconds until the next lightning strike
    this.flashUntil = 0;       // performance.now() ms while the sky is white
    this.thunderIn = -1;       // seconds until the thunder sound plays
    this.windX = 3;            // rain slant
    this.rain = this._buildRain();
    this.rain.visible = false;
    scene.add(this.rain);
    this._applyHud();
  }

  // A sheet of falling drops in a box around the player. The Points object
  // itself is re-centred on the player every frame, so the rain never runs
  // out — drops that hit the ground respawn at the top of the box.
  WeatherSystem.prototype._buildRain = function () {
    var n = CFG.WEATHER_RAIN_DROPS;
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (this.rng() - 0.5) * 70;
      pos[i * 3 + 1] = this.rng() * 34;
      pos[i * 3 + 2] = (this.rng() - 0.5) * 70;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xaac8e0, size: 0.32, transparent: true, opacity: 0,
      sizeAttenuation: true, depthWrite: false
    });
    var pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.drops = n;
    return pts;
  };

  WeatherSystem.prototype._state = function () {
    return STATES[this.current];
  };

  // Pick the next sky. Storms never follow storms, fog never follows fog,
  // and the roll is weighted so clear and cloudy stay the most common.
  WeatherSystem.prototype._rollNext = function () {
    var total = 0;
    for (var i = 0; i < STATE_NAMES.length; i++) {
      var s = STATE_NAMES[i];
      if (s === this.current && (s === 'STORM' || s === 'FOG')) continue;
      total += STATES[s].weight;
    }
    var roll = this.rng() * total;
    for (var j = 0; j < STATE_NAMES.length; j++) {
      var name = STATE_NAMES[j];
      if (name === this.current && (name === 'STORM' || name === 'FOG')) continue;
      roll -= STATES[name].weight;
      if (roll <= 0) return name;
    }
    return 'CLEAR';
  };

  WeatherSystem.prototype.setWeather = function (name, instant) {
    if (!STATES[name]) return false;
    this.current = name;
    this.mix = instant ? 1 : 0;
    this.nextIn = CFG.WEATHER_CHANGE_MIN_S +
      this.rng() * (CFG.WEATHER_CHANGE_MAX_S - CFG.WEATHER_CHANGE_MIN_S);
    if (name === 'STORM') this.flashT = 2 + this.rng() * 4;
    if (name === 'RAIN' || name === 'STORM') {
      if (this.world.audio) this.world.audio.setRain(name === 'STORM' ? 1 : 0.55);
    } else if (this.world.audio) {
      this.world.audio.setRain(0);
    }
    this._applyHud();
    if (this.world.hud && !instant) {
      this.world.hud.notify('Weather changing — ' + STATES[name].label +
        (STATES[name].grip < 1 ? ' (wet roads, less grip)' : ''), '');
    }
    return true;
  };

  WeatherSystem.prototype.gripFactor = function () {
    var st = this._state();
    return Game.lerp(1, st.grip, this.mix);
  };

  WeatherSystem.prototype.isRaining = function () {
    return this.rainLevel > 0.15;
  };

  WeatherSystem.prototype.label = function () {
    var st = this._state();
    var g = this.gripFactor();
    var txt = st.label;
    if (g < 0.99) txt += ' • GRIP ' + Math.round(g * 100) + '%';
    return txt;
  };

  WeatherSystem.prototype._applyHud = function () {
    if (this.world.hud && this.world.hud.setWeather) {
      this.world.hud.setWeather(this.label());
    }
  };

  // Lightning: a white flash across the whole sky, then thunder a beat
  // later. The flash is done by overexposing the background for a few
  // frames — the day-night cycle repaints it the next frame, so the flash
  // can never stick.
  WeatherSystem.prototype._lightning = function (dt) {
    if (this.current !== 'STORM') return;
    this.flashT -= dt;
    if (this.flashT <= 0) {
      this.flashT = 6 + this.rng() * 9;
      this.flashUntil = performance.now() + 110;
      this.thunderIn = 0.35 + this.rng() * 0.9;
      if (this.world.audio) this.world.audio.thunder(0.5 + this.rng() * 0.5);
    }
    if (this.thunderIn > 0) {
      this.thunderIn -= dt;
      if (this.thunderIn <= 0) {
        this.thunderIn = -1;
      }
    }
  };

  WeatherSystem.prototype.update = function (dt, hour, player) {
    var st = this._state();
    // scheduler: roll a new sky when the timer runs out
    this.nextIn -= dt;
    if (this.nextIn <= 0) this.setWeather(this._rollNext(), false);
    if (this.mix < 1) this.mix = Math.min(1, this.mix + dt / 3);
    // fog distances ease toward the state's values
    var k = Math.min(1, dt * 0.6);
    this.fogNear += (st.fogNear - this.fogNear) * k;
    this.fogFar += (st.fogFar - this.fogFar) * k;
    if (this.scene.fog) {
      this.scene.fog.near = this.fogNear;
      this.scene.fog.far = this.fogFar;
    }
    // rain sheet: fade in/out, fall, slant with the wind, follow the player
    var targetRain = st.rain * this.mix;
    this.rainLevel += (targetRain - this.rainLevel) * Math.min(1, dt * 1.5);
    this.rain.visible = this.rainLevel > 0.02;
    if (this.rain.visible) {
      this.rain.material.opacity = 0.55 * this.rainLevel;
      if (player) this.rain.position.set(player.x, 0, player.z);
      var pos = this.rain.geometry.attributes.position.array;
      var n = this.rain.userData.drops;
      var fall = 42 * dt;
      for (var i = 0; i < n; i++) {
        pos[i * 3 + 1] -= fall;
        pos[i * 3] += this.windX * dt;
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3 + 1] = 30 + this.rng() * 4;
          pos[i * 3] = (this.rng() - 0.5) * 70;
          pos[i * 3 + 2] = (this.rng() - 0.5) * 70;
        }
        if (pos[i * 3] > 35) pos[i * 3] = -35;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    // storms dim the light and throw lightning; the dim is applied after
    // the day-night cycle set the light for this hour, so it never sticks
    // across a weather change.
    var dim = Game.lerp(1, st.light, this.mix);
    if (Game.city) {
      if (Game.city.sun) Game.city.sun.intensity *= dim;
      if (Game.city.hemi) Game.city.hemi.intensity *= (0.6 + 0.4 * dim);
    }
    if (performance.now() < this.flashUntil && this.scene.background) {
      this.scene.background.setHex(0xf4f6ff);
      if (Game.city && Game.city.sun) Game.city.sun.intensity = 3.2;
    }
    this._lightning(dt);
    // the HUD label only changes when the state or the grip changes
    var want = this.label();
    if (want !== this._lastLabel) {
      this._lastLabel = want;
      this._applyHud();
    }
  };

  Game.WeatherSystem = WeatherSystem;
})();
