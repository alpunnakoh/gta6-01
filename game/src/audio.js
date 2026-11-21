// SUNSET SHORES — audio.js
// AudioSystem: 100% synthesised WebAudio — engine hum that follows speed, a
// two-tone police siren, a helicopter rotor thump, gunshots (pistol crack and
// SMG rattle), mission chimes, pickup and cash sounds, punch and explosion
// thuds, and a simple bass-line music loop. No audio files. Starts on the
// first user gesture; M toggles mute.
(function () {
  'use strict';

  function AudioSystem() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenT = 0;
    this.rotorOsc = null;
    this.rotorGain = null;
    this.rotorLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  AudioSystem.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine: sawtooth through a lowpass, pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      var lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // siren: square wave, frequency flipped by setSiren's timer
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      // helicopter rotor: low square wave chopped by a 13 Hz LFO — the
      // classic whomp-whomp, silent until the chopper is overhead
      this.rotorOsc = this.ctx.createOscillator();
      this.rotorOsc.type = 'square';
      this.rotorOsc.frequency.value = 90;
      this.rotorGain = this.ctx.createGain();
      this.rotorGain.gain.value = 0;
      this.rotorLfo = this.ctx.createOscillator();
      this.rotorLfo.type = 'sine';
      this.rotorLfo.frequency.value = 13;
      var lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.5;
      this.rotorLfo.connect(lfoGain);
      lfoGain.connect(this.rotorGain.gain);
      this.rotorOsc.connect(this.rotorGain); this.rotorGain.connect(this.master);
      this.rotorOsc.start();
      this.rotorLfo.start();
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  };

  AudioSystem.prototype.setMuted = function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  };

  AudioSystem.prototype.setEngine = function (speed01, on) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.1);
  };

  // level 0..1 — siren volume + two-tone flip; call every frame.
  AudioSystem.prototype.setSiren = function (level) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(level * 0.05, t, 0.2);
    if (level > 0.02) {
      this.sirenT += 1;
      if (this.sirenT % 30 === 0) {
        this.sirenOsc.frequency.setTargetAtTime(
          this.sirenOsc.frequency.value > 800 ? 660 : 920, t, 0.02);
      }
    }
  };

  // level 0..1 — rotor thump while the police chopper is up.
  AudioSystem.prototype.setRotor = function (level) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    this.rotorGain.gain.setTargetAtTime(level * 0.09, t, 0.3);
  };

  AudioSystem.prototype._noiseBurst = function (dur, freq, vol) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * dur);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    var f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    var g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  };

  AudioSystem.prototype._tone = function (freq, dur, type, vol, when) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime + (when || 0);
    var o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };

  AudioSystem.prototype.gunshot = function () { this._noiseBurst(0.14, 1800, 0.5); };
  AudioSystem.prototype.smgShot = function () { this._noiseBurst(0.07, 2400, 0.32); };
  // a short two-tone siren blip — the roadblock going up, or a near-miss
  AudioSystem.prototype.sirenBlip = function () {
    this._tone(700, 0.14, 'square', 0.12);
    this._tone(950, 0.14, 'square', 0.12, 0.16);
  };
  // the shotgun: a long low boom with a metallic click after it
  AudioSystem.prototype.shotgunBlast = function () {
    this._noiseBurst(0.35, 500, 0.7);
    this._tone(70, 0.3, 'sine', 0.45);
    this._tone(1800, 0.05, 'square', 0.12, 0.4);
  };
  // the rusher's knife swing: a fast whoosh, no impact yet
  AudioSystem.prototype.swipe = function () { this._noiseBurst(0.1, 3000, 0.2); };
  // a traffic horn: two short notes, a little flat, very impatient
  AudioSystem.prototype.honk = function () {
    this._tone(370, 0.16, 'square', 0.12);
    this._tone(370, 0.16, 'square', 0.12, 0.2);
  };
  // Pay 'n Spray: a spray-gun hiss and a happy little jingle
  AudioSystem.prototype.spray = function () {
    this._noiseBurst(0.5, 5000, 0.15);
    this._tone(880, 0.12, 'sine', 0.2, 0.3);
    this._tone(1174, 0.18, 'sine', 0.2, 0.42);
  };
  // stunt jump: a rising whistle as the car leaves the ramp
  AudioSystem.prototype.stuntWhoosh = function () {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.5);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.6);
  };
  AudioSystem.prototype.enemyShot = function (dist) {
    this._noiseBurst(0.12, 1200, Math.max(0.05, 0.3 - dist * 0.005));
  };
  AudioSystem.prototype.hit = function () { this._tone(1400, 0.06, 'square', 0.12); };
  AudioSystem.prototype.enemyDown = function () { this._tone(220, 0.25, 'triangle', 0.2); };
  AudioSystem.prototype.playerHit = function () { this._tone(160, 0.15, 'sawtooth', 0.18); };
  AudioSystem.prototype.thud = function () { this._noiseBurst(0.12, 300, 0.35); };
  AudioSystem.prototype.punch = function () { this._noiseBurst(0.09, 500, 0.4); this._tone(90, 0.1, 'sine', 0.3); };
  AudioSystem.prototype.pickup = function () {
    this._tone(880, 0.1, 'sine', 0.2);
    this._tone(1174, 0.14, 'sine', 0.2, 0.08);
  };
  AudioSystem.prototype.explosion = function () {
    this._noiseBurst(0.6, 240, 0.7);
    this._tone(60, 0.5, 'sine', 0.5);
  };
  AudioSystem.prototype.doorSlam = function () { this._noiseBurst(0.08, 400, 0.3); };
  AudioSystem.prototype.skid = function () { this._noiseBurst(0.25, 900, 0.12); };
  AudioSystem.prototype.clickEmpty = function () { this._tone(900, 0.04, 'square', 0.1); };
  AudioSystem.prototype.reload = function () {
    this._tone(500, 0.05, 'square', 0.12);
    this._tone(700, 0.05, 'square', 0.12, 0.35);
  };
  AudioSystem.prototype.missionChime = function () {
    this._tone(660, 0.18, 'sine', 0.22);
    this._tone(880, 0.22, 'sine', 0.22, 0.14);
    this._tone(1320, 0.3, 'sine', 0.18, 0.28);
  };
  AudioSystem.prototype.cashSound = function () {
    this._tone(990, 0.1, 'triangle', 0.2);
    this._tone(1320, 0.16, 'triangle', 0.2, 0.09);
  };
  AudioSystem.prototype.uiClick = function () { this._tone(700, 0.05, 'square', 0.1); };

  // Three radio stations, one bass loop each, plus a melody line on top:
  // SUNSET FM (Am–F–C–G, mellow), BAY 104 (Dm–Bb–F–C, faster, minor),
  // PALMERA GOLD (C–Am–F–G, bright). Key R cycles the station.
  AudioSystem.prototype.startMusic = function () {
    var self = this;
    if (this.musicTimer) return;
    var stations = [
      { roots: [110, 87.31, 130.81, 98], melody: [440, 523.25, 659.25, 587.33, 523.25, 440, 392, 523.25], step: 300 },
      { roots: [146.83, 116.54, 174.61, 130.81], melody: [587.33, 698.46, 880, 698.46, 587.33, 523.25, 440, 587.33], step: 240 },
      { roots: [130.81, 110, 87.31, 98], melody: [523.25, 659.25, 783.99, 659.25, 523.25, 659.25, 440, 523.25], step: 340 }
    ];
    this.radioStation = this.radioStation || 0;
    this.musicStep = 0;
    this.musicTimer = setInterval(function () {
      if (!self.ctx || self.muted) return;
      var st = stations[self.radioStation];
      var bar = Math.floor(self.musicStep / 8) % 4;
      var root = st.roots[bar];
      var note = (self.musicStep % 8 === 0 || self.musicStep % 8 === 3 || self.musicStep % 8 === 6)
        ? root : root * 1.5;
      self._tone(note, 0.22, 'triangle', 0.07);
      // melody: one soft sine note per beat on the off-beats
      if (self.musicStep % 2 === 0) {
        var m = st.melody[(self.musicStep / 2) % st.melody.length];
        self._tone(m, 0.18, 'sine', 0.04);
      }
      self.musicStep++;
    }, stations[this.radioStation].step);
  };

  // Cycle to the next station and restart the loop at its tempo.
  AudioSystem.prototype.cycleRadio = function () {
    this.radioStation = ((this.radioStation || 0) + 1) % 3;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    var step = this.musicStep;
    this.musicStep = 0;
    this.startMusic();
    this.musicStep = step;
    if (Game.hud) Game.hud.setRadio(Game.CFG.RADIO_STATIONS[this.radioStation]);
    return Game.CFG.RADIO_STATIONS[this.radioStation];
  };

  Game.AudioSystem = AudioSystem;
})();
