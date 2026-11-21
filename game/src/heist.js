// SUNSET SHORES — heist.js
// HeistSystem: the second act of "The Palmera Job" — M7 "The Setup" and
// M8 "The Sunset Heist". Where M1–M6 were Leo working alone, the finale
// brings a crew: Maya the driver, Doc the safecracker and Slim the
// lookout, waiting at Port North. The system watches the mission state
// and stages the finale around it — the crew at the docks, a steel vault
// door on the Bank of Palmera, drill sparks while Leo cracks it, cash
// duffels to grab on the way out, and a fireworks finish at the
// lighthouse when the whole bay is behind him. The missions themselves
// (M7/M8) live in missions.js; this file is the show around them.
(function () {
  'use strict';
  var CFG = Game.CFG;

  var CREW = [
    { name: 'Maya', shirt: 0xe86a1f, skin: 0xd9a077, role: 'driver' },
    { name: 'Doc', shirt: 0x3c7ad8, skin: 0x8a5a3a, role: 'safecracker' },
    { name: 'Slim', shirt: 0x7a4ec8, skin: 0xe8b890, role: 'lookout' }
  ];

  function buildCrewFigure(c) {
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: c.shirt });
    var pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
    var skin = new THREE.MeshLambertMaterial({ color: c.skin });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
    legL.position.set(-0.13, 0.38, 0);
    var legR = legL.clone(); legR.position.x = 0.13;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), shirt);
    torso.position.y = 1.12;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.68;
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x14161a }));
    cap.position.y = 1.9;
    g.add(legL, legR, torso, head, cap);
    g.userData = { legL: legL, legR: legR, name: c.name, role: c.role, phase: Math.random() * 6 };
    return g;
  }

  function buildVaultDoor() {
    var g = new THREE.Group();
    var door = new THREE.Mesh(new THREE.BoxGeometry(5, 6.5, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x5a6068 }));
    door.position.y = 3.25;
    var wheel = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 8, 20),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    wheel.position.set(0, 3.2, 0.45);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(6, 7.4, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2a2f38 }));
    frame.position.set(0, 3.7, -0.25);
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    lamp.position.set(2.4, 6.2, 0.45);
    g.add(frame, door, wheel, lamp);
    g.userData = { lamp: lamp, wheel: wheel };
    return g;
  }

  function buildDuffel() {
    var g = new THREE.Group();
    var bag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x1c4a6a }));
    bag.position.y = 0.3;
    var strap = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.12, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    strap.position.y = 0.5;
    var glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.2 }));
    glow.position.y = 0.4;
    g.add(bag, strap, glow);
    g.userData = { glow: glow };
    return g;
  }

  // Drill sparks: a small burst of bright points that lives for a second
  // at the vault door while Leo holds the crack.
  function buildSparks() {
    var n = 40;
    var pos = new Float32Array(n * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffd21f, size: 0.3, transparent: true, opacity: 0.95,
      sizeAttenuation: true, depthWrite: false
    }));
    pts.visible = false;
    pts.frustumCulled = false;
    pts.userData = { n: n, vel: [], life: 0 };
    for (var i = 0; i < n; i++) {
      pts.userData.vel.push({ x: 0, y: 0, z: 0 });
    }
    return pts;
  }

  function HeistSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng || Math.random;
    this.world = world || {};
    this.done = false;          // M8 finished: the job is complete
    this.crew = [];             // crew figures at the port
    this.vault = null;          // vault door prop at the bank
    this.bags = [];             // cash duffels on the ground
    this.sparks = buildSparks();
    this.scene.add(this.sparks);
    this._lastId = null;
    this._lastStage = -1;
    this._bagsPaid = 0;
    this._finaleT = 0;
    this._finaleDone = false;
    this._alarmT = 0;
  }

  HeistSystem.prototype._spawnCrew = function () {
    if (this.crew.length > 0) return;
    var port = Game.MissionSystem.PLACES.port;
    var self = this;
    CREW.forEach(function (c, i) {
      var fig = buildCrewFigure(c);
      fig.position.set(port.x - 6 + i * 6, 0, port.z + 4);
      fig.rotation.y = Math.PI * (0.25 + i * 0.1);
      self.scene.add(fig);
      self.crew.push(fig);
    });
    if (this.world.hud) {
      this.world.hud.notify('The crew is waiting at Port North — Maya, Doc and Slim.', 'mission');
    }
  };

  HeistSystem.prototype._spawnVault = function () {
    if (this.vault) return;
    var bank = Game.MissionSystem.PLACES.bank;
    var v = buildVaultDoor();
    // the bank's NORTH face is at z = 81 - 12 = 69 (the signed front faces
    // south, the hold marker is on the north street). The door is 0.7 deep,
    // so it stands at z = 68.5 with its wheel facing the player — at 69.5
    // it sat buried inside the wall and only the wheel poked out.
    v.position.set(bank.x, 0, 68.5);
    v.rotation.y = Math.PI;
    this.scene.add(v);
    this.vault = v;
  };

  HeistSystem.prototype._spawnBags = function () {
    if (this.bags.length > 0) return;
    var bank = Game.MissionSystem.PLACES.bank;
    var self = this;
    for (var i = 0; i < CFG.HEIST_BAG_COUNT; i++) {
      var bag = buildDuffel();
      bag.position.set(bank.x - 6 + i * 6, 0, bank.z - 4);
      self.scene.add(bag);
      self.bags.push({ mesh: bag, x: bag.position.x, z: bag.position.z, taken: false, phase: i * 2 });
    }
    if (this.world.hud) {
      this.world.hud.notify('The vault is open — grab the cash duffels!', 'good');
    }
  };

  HeistSystem.prototype._burstSparks = function (x, y, z) {
    var pts = this.sparks;
    var pos = pts.geometry.attributes.position.array;
    for (var i = 0; i < pts.userData.n; i++) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      var a = this.rng() * Math.PI * 2;
      var sp = 2 + this.rng() * 5;
      pts.userData.vel[i] = {
        x: Math.cos(a) * sp, y: 1 + this.rng() * 4, z: Math.sin(a) * sp
      };
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.userData.life = 0.9;
    pts.visible = true;
  };

  // Fireworks over the lighthouse: three coloured bursts, one after the
  // other, while the finale message is on screen.
  HeistSystem.prototype._fireworks = function (dt) {
    if (this._finaleDone) return;
    this._finaleT += dt;
    var marks = [0.4, 1.4, 2.4];
    var cols = [0xffd21f, 0x3ddc5a, 0x4ecdc4];
    for (var i = 0; i < marks.length; i++) {
      if (this._finaleT >= marks[i] && !this['_fw' + i]) {
        this['_fw' + i] = true;
        var bx = CFG.PIER_X + (this.rng() - 0.5) * 30;
        var bz = CFG.PIER_END_Z + (this.rng() - 0.5) * 20;
        this._burstSparks(bx, 26, bz);
        this.sparks.material.color.setHex(cols[i]);
        if (this.world.audio) this.world.audio.explosion();
      }
    }
    if (this._finaleT > 3.5) this._finaleDone = true;
  };

  HeistSystem.prototype.markDone = function (def) {
    if (def && def.id === 'M8') this.done = true;
  };

  HeistSystem.prototype.restoreDone = function () {
    this.done = true;
    this._finaleDone = true;
  };

  // Watch the mission state machine and stage the finale around it. The
  // missions own the objectives; this file owns the show.
  HeistSystem.prototype.update = function (dt) {
    var w = this.world;
    var m = w.missions;
    if (!m) return;
    var active = m.active;
    var id = active ? active.def.id : null;
    var stage = active ? active.stage : -1;
    var changed = id !== this._lastId || stage !== this._lastStage;
    if (changed) {
      if (id === 'M7' && this._lastId !== 'M7') this._spawnCrew();
      if (id === 'M8') {
        // the vault goes up at stage 0 — or stage 1, because a player who
        // finishes M7 standing at the bank clears the driveTo in the very
        // first frame, and missions.update runs before this one, so stage 0
        // is never observed (the door stayed buried — or absent — until now)
        if (stage === 0 || stage === 1) this._spawnVault();
        if (stage === 2) {
          // cracking the vault: alarm light + drill sparks + the alarm sound
          if (this.vault) this.vault.userData.lamp.material.color.setHex(0xff2020);
          if (w.audio) w.audio.heistAlarm();
        }
        if (stage === 3) this._spawnBags();
      }
      this._lastId = id;
      this._lastStage = stage;
    }
    // crew idle sway
    for (var i = 0; i < this.crew.length; i++) {
      var c = this.crew[i];
      c.userData.phase += dt * 1.4;
      c.userData.legL.rotation.x = Math.sin(c.userData.phase) * 0.08;
      c.userData.legR.rotation.x = -Math.sin(c.userData.phase) * 0.08;
    }
    // vault wheel turns and the alarm lamp blinks while M8 holds the crack
    if (this.vault && id === 'M8' && stage === 2) {
      this.vault.userData.wheel.rotation.z += dt * 3;
      var on = Math.floor(performance.now() / 250) % 2 === 0;
      this.vault.userData.lamp.material.color.setHex(on ? 0xff2020 : 0x551010);
      var vpos = this.vault.position;
      // sparks burst on the player's side of the door (north, -z)
      if (Math.random() < dt * 6) this._burstSparks(vpos.x, 3.2, vpos.z - 0.8);
      this._alarmT -= dt;
      if (this._alarmT <= 0) {
        this._alarmT = 2.2;
        if (w.audio) w.audio.heistAlarm();
      }
    }
    // sparks physics: fly out, fall, fade
    if (this.sparks.visible) {
      var pts = this.sparks;
      pts.userData.life -= dt;
      if (pts.userData.life <= 0) {
        pts.visible = false;
      } else {
        var pos = pts.geometry.attributes.position.array;
        for (var j = 0; j < pts.userData.n; j++) {
          var v = pts.userData.vel[j];
          v.y -= 12 * dt;
          pos[j * 3] += v.x * dt;
          pos[j * 3 + 1] += v.y * dt;
          pos[j * 3 + 2] += v.z * dt;
          if (pos[j * 3 + 1] < 0) pos[j * 3 + 1] = 0;
        }
        pts.geometry.attributes.position.needsUpdate = true;
        pts.material.opacity = Math.min(0.95, pts.userData.life);
      }
    }
    // cash duffels: bob, glow, and pay when Leo walks over one
    for (var b = 0; b < this.bags.length; b++) {
      var bag = this.bags[b];
      if (bag.taken) continue;
      bag.phase += dt * 2;
      bag.mesh.userData.glow.material.opacity = 0.16 + Math.sin(bag.phase) * 0.08;
      bag.mesh.position.y = Math.sin(bag.phase) * 0.1;
      if (w.player && Game.dist2D(w.player.x, w.player.z, bag.x, bag.z) < 2.4) {
        bag.taken = true;
        this.scene.remove(bag.mesh);
        this._bagsPaid++;
        if (w.onCash) w.onCash(CFG.HEIST_BAG_CASH);
        if (w.audio) w.audio.cashSound();
        if (w.player.setCarrying) w.player.setCarrying(true);
        if (w.hud) {
          w.hud.notify('Cash duffel grabbed — +$' + CFG.HEIST_BAG_CASH +
            ' (' + this._bagsPaid + '/' + CFG.HEIST_BAG_COUNT + ')', 'good');
        }
      }
    }
    // finale: the whole job is done — fireworks over the lighthouse
    if (this.done && !this._finaleDone) {
      if (this._finaleT === 0 && w.hud) {
        w.hud.centerMessage('THE SUNSET HEIST — COMPLETE', 4200);
      }
      this._fireworks(dt);
    }
  };

  Game.HeistSystem = HeistSystem;
})();
