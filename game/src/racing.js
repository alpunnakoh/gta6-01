// SUNSET SHORES — racing.js
// RacingSystem: street racing in Palmera Bay. Three circuits are painted
// on the road grid — the Boardwalk Sprint down the beachfront, the Harbor
// Loop around the north side, and the Neon Mile through downtown — each
// with a striped start gate, glowing checkpoint rings, a 3-2-1 countdown
// and three AI rivals in sports coupes who rubber-band to keep the race
// honest. Press N near a start gate while driving to enter. Positions are
// tracked live (checkpoint, then distance), the winner takes the prize,
// and every best time is saved, so each circuit has a record to beat.
(function () {
  'use strict';
  var CFG = Game.CFG;

  // Routes are lists of road points. Every point sits on a road centre
  // line (multiples of 54, lane offset 3.4), so the route is always
  // drivable and the rivals can follow it with plain steering.
  var RACE_DEFS = [
    {
      id: 'R1', name: 'Boardwalk Sprint', prize: 1500,
      start: { x: -162, z: 216, heading: Math.PI / 2 },
      checkpoints: [
        { x: -54, z: 216 }, { x: 54, z: 216 }, { x: 162, z: 216 },
        { x: 162, z: 108 }, { x: 162, z: 0 }
      ]
    },
    {
      id: 'R2', name: 'Harbor Loop', prize: 2500,
      start: { x: 0, z: -216, heading: -Math.PI / 2 },
      checkpoints: [
        { x: -108, z: -216 }, { x: -162, z: -108 }, { x: -162, z: 54 },
        { x: -54, z: 54 }, { x: 54, z: 54 }
      ]
    },
    {
      id: 'R3', name: 'Neon Mile', prize: 3500,
      start: { x: 216, z: -54, heading: Math.PI },
      checkpoints: [
        { x: 108, z: -54 }, { x: 108, z: 54 }, { x: 0, z: 54 },
        { x: -108, z: 54 }, { x: -108, z: 162 }
      ]
    }
  ];

  var RIVAL_COLORS = [0xd8443c, 0x3c7ad8, 0x7a4ec8];
  var RIVAL_NAMES = ['Vex', 'Marlo', 'Kit'];

  function makeGateLabel(text) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = '#14161a';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#ffd21f';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 34);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 3),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    return spr;
  }

  function makeRing(color) {
    var g = new THREE.Group();
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.35, 10, 28),
      new THREE.MeshBasicMaterial({ color: color }));
    ring.rotation.y = Math.PI / 2;
    var glow = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.25, 24),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 }));
    glow.position.y = 0.15;
    var diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    diamond.position.y = 7;
    g.add(ring, glow, diamond);
    g.userData = { ring: ring, diamond: diamond };
    return g;
  }

  function RacingSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng || Math.random;
    this.world = world || {};
    this.active = null;      // {def, cp, time, countdown, rivals, finished}
    this.bestTimes = {};     // race id -> best ms
    this.racesWon = 0;
    this.racesRun = 0;
    this._wrongWayT = 0;
    this._lastCpDist = 0;
    this._buildGates();
  }

  RacingSystem.prototype._buildGates = function () {
    var self = this;
    this.gates = [];
    RACE_DEFS.forEach(function (def) {
      var gate = new THREE.Group();
      // two striped posts and a START banner across the road
      [-4.4, 4.4].forEach(function (dx) {
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.4, 0.6),
          new THREE.MeshLambertMaterial({ color: 0x14161a }));
        post.position.set(dx, 2.2, 0);
        gate.add(post);
        var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.66),
          new THREE.MeshBasicMaterial({ color: 0xffffff }));
        stripe.position.set(dx, 3.6, 0);
        gate.add(stripe);
      });
      var banner = makeGateLabel(def.id + ' START');
      banner.position.set(0, 5.2, 0);
      gate.add(banner);
      // a glowing ring flat on the asphalt marks the start line
      var line = new THREE.Mesh(
        new THREE.CylinderGeometry(4.6, 4.6, 0.2, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.5 }));
      line.position.y = 0.12;
      gate.add(line);
      gate.position.set(def.start.x, 0, def.start.z);
      gate.rotation.y = def.start.heading;
      self.scene.add(gate);
      self.gates.push({ def: def, mesh: gate });
      // checkpoint rings, dim until the race runs
      def.rings = def.checkpoints.map(function (cp, i) {
        var ring = makeRing(i === def.checkpoints.length - 1 ? 0x3ddc5a : 0xffd21f);
        ring.position.set(cp.x, 0, cp.z);
        ring.visible = false;
        self.scene.add(ring);
        return ring;
      });
    });
  };

  // The nearest start gate, if Leo is close enough to enter.
  RacingSystem.prototype.nearestRace = function () {
    var w = this.world;
    if (!w.player) return null;
    var best = null, bestD = 14;
    RACE_DEFS.forEach(function (def) {
      var d = Game.dist2D(w.player.x, w.player.z, def.start.x, def.start.z);
      if (d < bestD) { bestD = d; best = def; }
    });
    return best;
  };

  RacingSystem.prototype.tryStart = function () {
    var w = this.world;
    if (this.active) {
      if (w.hud) w.hud.notify('Race already running — finish it first.', '');
      return false;
    }
    var def = this.nearestRace();
    if (!def) {
      if (w.hud) w.hud.notify('No race start nearby — look for the striped START gates.', '');
      return false;
    }
    if (!w.player.inCar) {
      if (w.hud) w.hud.notify('Get in a car first — street races are won on wheels.', '');
      return false;
    }
    // line the player up on the gate, facing down the route
    var car = w.player.inCar;
    car.x = def.start.x; car.z = def.start.z;
    car.heading = def.start.heading;
    car.speed = 0;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // three rivals in sports coupes, gridded behind the player
    var rivals = [];
    var self = this;
    RIVAL_NAMES.forEach(function (name, i) {
      var back = 8 + i * 4;
      var fx = Math.sin(def.start.heading), fz = Math.cos(def.start.heading);
      var rx = def.start.x - fx * back + (i % 2 === 0 ? -3.4 : 3.4) * Math.cos(def.start.heading);
      var rz = def.start.z - fz * back - (i % 2 === 0 ? -3.4 : 3.4) * Math.sin(def.start.heading);
      var rc = Game.VehicleFactory.createCar({
        x: rx, z: rz, heading: def.start.heading,
        color: RIVAL_COLORS[i], variant: 'sport'
      });
      self.scene.add(rc.mesh);
      rivals.push({
        car: rc, name: name, cp: 0, finished: false, finishMs: 0,
        progress: 0
      });
    });
    def.rings.forEach(function (r) { r.visible = true; });
    this.active = {
      def: def, cp: 0, time: 0, countdown: CFG.RACE_COUNTDOWN_S,
      rivals: rivals, go: false, place: 4, done: false
    };
    this._wrongWayT = 0;
    this._lastCpDist = 9999;
    if (w.hud) {
      w.hud.notify(def.name + ' — 3 rivals, ' + def.checkpoints.length +
        ' checkpoints, $' + def.prize + ' for the win. Get ready…', 'mission');
      w.hud.setRace(def.name + ' • READY');
    }
    if (w.audio) w.audio.raceBeep(1);
    return true;
  };

  // Position by checkpoint first, then by distance to the next one.
  RacingSystem.prototype._raceProgress = function (x, z, cp) {
    var def = this.active.def;
    var next = def.checkpoints[Math.min(cp, def.checkpoints.length - 1)];
    var d = Game.dist2D(x, z, next.x, next.z);
    return cp * 1000 - d;
  };

  RacingSystem.prototype._position = function () {
    var me = this._raceProgress(this.world.player.x, this.world.player.z, this.active.cp);
    var place = 1;
    this.active.rivals.forEach(function (r) {
      if (!r.finished && r.progress > me) place++;
      if (r.finished) place++;
    });
    return place;
  };

  RacingSystem.prototype._finishRace = function (place, timeMs) {
    var w = this.world;
    var def = this.active.def;
    var prize = place === 1 ? def.prize :
      (place === 2 ? CFG.RACE_PRIZES[1] : (place === 3 ? CFG.RACE_PRIZES[2] : 0));
    this.racesRun++;
    if (place === 1) this.racesWon++;
    var best = this.bestTimes[def.id];
    var isBest = !best || timeMs < best;
    if (isBest) this.bestTimes[def.id] = timeMs;
    def.rings.forEach(function (r) { r.visible = false; });
    var rivals = this.active.rivals;
    this.active = null;
    rivals.forEach(function (r) { w.scene.remove(r.car.mesh); });
    if (w.onCash && prize > 0) w.onCash(prize);
    if (w.audio) w.audio.cashSound();
    if (w.hud) {
      w.hud.setRace('');
      w.hud.centerMessage(place === 1 ? 'RACE WON — $' + prize : 'P' + place + ' — $' + prize, 3200);
      w.hud.notify(def.name + ': P' + place + ' in ' + this._fmtTime(timeMs) +
        (prize > 0 ? ' — +$' + prize : ' — no prize') +
        (isBest ? ' — NEW BEST TIME!' : ' — best ' + this._fmtTime(this.bestTimes[def.id])), 'good');
    }
  };

  RacingSystem.prototype._fmtTime = function (ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var ds = Math.floor((ms % 1000) / 100);
    return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60) + '.' + ds;
  };

  // One rival's brain: steer at the next checkpoint, lift off in tight
  // turns, and rubber-band — faster when behind the player, slower when
  // ahead — so every race stays a race to the last checkpoint.
  RacingSystem.prototype._driveRival = function (r, dt) {
    var def = this.active.def;
    var car = r.car;
    if (r.finished) {
      car.speed = Math.max(0, car.speed - 20 * dt);
      Game.CarController.step(car, { throttle: 0, steer: 0, handbrake: false }, dt);
      return;
    }
    var next = def.checkpoints[Math.min(r.cp, def.checkpoints.length - 1)];
    var dx = next.x - car.x, dz = next.z - car.z;
    var dist = Math.sqrt(dx * dx + dz * dz) || 1;
    if (dist < 8) {
      r.cp++;
      if (r.cp >= def.checkpoints.length) {
        r.finished = true;
        r.finishMs = this.active.time * 1000;
        return;
      }
      next = def.checkpoints[r.cp];
      dx = next.x - car.x; dz = next.z - car.z;
      dist = Math.sqrt(dx * dx + dz * dz) || 1;
    }
    var desired = Math.atan2(dx, dz);
    var diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = Game.clamp(diff * 2.2, -1, 1);
    var throttle = Math.abs(diff) > 1.1 ? 0.35 : 1;
    // rubber-band: the further behind the player, the faster the rival
    var myProg = this._raceProgress(this.world.player.x, this.world.player.z, this.active.cp);
    var gap = myProg - r.progress;
    var boost = Game.clamp(gap / 400, -0.25, 0.3);
    var savedTop = car.topSpeed;
    car.topSpeed = CFG.SPORT_TOP_SPEED * (1 + boost);
    Game.CarController.step(car, { throttle: throttle, steer: steer, handbrake: false }, dt);
    car.topSpeed = savedTop;
    r.progress = this._raceProgress(car.x, car.z, r.cp);
  };

  RacingSystem.prototype.update = function (dt) {
    if (!this.active) return;
    var w = this.world;
    var a = this.active;
    var def = a.def;
    // countdown: hold the cars, beep each second, GO on zero
    if (!a.go) {
      a.countdown -= dt;
      var n = Math.ceil(a.countdown);
      if (w.hud) w.hud.setRace(def.name + ' • ' + (n > 0 ? n : 'GO!'));
      if (n !== a._lastBeep) {
        a._lastBeep = n;
        if (w.audio) w.audio.raceBeep(n > 0 ? 1 : 2);
      }
      if (a.countdown <= 0) {
        a.go = true;
        a.time = 0;
        if (w.hud) w.hud.notify('GO!', 'good');
      }
      return;
    }
    a.time += dt;
    var px = w.player.x, pz = w.player.z;
    var next = def.checkpoints[Math.min(a.cp, def.checkpoints.length - 1)];
    var d = Game.dist2D(px, pz, next.x, next.z);
    // wrong way: the next checkpoint keeps getting further away
    if (d > this._lastCpDist + 0.5) {
      this._wrongWayT += dt;
      if (this._wrongWayT > 4 && w.hud) {
        w.hud.notify('Wrong way! Turn around for the next checkpoint.', 'bad');
        this._wrongWayT = 0;
      }
    } else {
      this._wrongWayT = 0;
    }
    this._lastCpDist = d;
    if (d < 8) {
      a.cp++;
      if (w.audio) w.audio.missionChime();
      if (a.cp >= def.checkpoints.length) {
        this._finishRace(this._position(), Math.round(a.time * 1000));
        return;
      }
      if (w.hud) w.hud.notify('Checkpoint ' + a.cp + '/' + def.checkpoints.length + ' — keep going!', 'good');
    }
    // rivals drive their race
    for (var i = 0; i < a.rivals.length; i++) this._driveRival(a.rivals[i], dt);
    // live HUD: position, checkpoint, time
    var place = this._position();
    if (w.hud) {
      w.hud.setRace(def.name + ' • P' + place + ' • CP ' +
        Math.min(a.cp + 1, def.checkpoints.length) + '/' + def.checkpoints.length +
        ' • ' + this._fmtTime(Math.round(a.time * 1000)));
    }
    // checkpoint rings spin; the next one pulses
    def.rings.forEach(function (ring, i) {
      ring.userData.diamond.rotation.y += dt * 2;
      ring.userData.diamond.position.y = 7 + Math.sin(performance.now() * 0.004 + i) * 0.6;
      var active = i === a.cp;
      ring.userData.ring.material.opacity = active ? 1 : 0.55;
    });
  };

  RacingSystem.prototype.restore = function (bestTimes) {
    if (bestTimes) this.bestTimes = bestTimes;
  };

  RacingSystem.RACES = RACE_DEFS;
  Game.RacingSystem = RacingSystem;
})();
