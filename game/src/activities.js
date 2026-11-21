// SUNSET SHORES — activities.js
// Activities: the free-roam side content that pays between jobs.
//  1. Smuggler packages — 12 glowing parcels hidden around Palmera Bay
//     (rooftop ledges, alleys, the pier, the plaza). Walk over one for
//     cash + a health top-up. The minimap shows them as green dots.
//  2. Taxi jobs — get in a yellow cab and press T: a passenger flags you
//     down, you drive them to the drop-off before the meter runs out, and
//     the fare is yours. Repeatable all day.
(function () {
  'use strict';
  var CFG = Game.CFG;

  // Fixed hiding spots for the packages: memorable places a player can
  // learn, not random dots — the pier, the plaza, behind the bank, the
  // beach, and the park corners.
  var PACKAGE_SPOTS = [
    { x: CFG.PIER_X + 5, z: CFG.PIER_END_Z - 8 },
    { x: -180, z: 246 },
    { x: 180, z: -162 },
    { x: -27, z: -135 },
    { x: 135, z: 135 },
    { x: -135, z: 81 },
    { x: 27, z: 189 },
    { x: -189, z: -27 },
    { x: 189, z: 27 },
    { x: -81, z: -189 },
    { x: 81, z: -27 },
    { x: -27, z: 81 }
  ];

  function buildPackageMesh() {
    var g = new THREE.Group();
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x3ddc5a }));
    box.position.y = 0.7;
    var band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.14, 0.94),
      new THREE.MeshLambertMaterial({ color: 0x1a5a1a }));
    band.position.y = 0.7;
    var glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x3ddc5a, transparent: true, opacity: 0.18 }));
    glow.position.y = 0.7;
    g.add(box, band, glow);
    g.userData = { box: box, glow: glow };
    return g;
  }

  function Activities(scene, rng, world) {
    this.scene = scene;
    this.rng = rng;
    this.world = world; // {player, hud, audio, onCash}
    this.packages = [];
    this.packagesFound = 0;
    this.foundIds = {};   // id -> true, so a save can restore them
    this.taxi = null;     // active fare {target, passenger, fare, timeLeft, marker}
    this.taxiEarned = 0;
    this.taxiJobs = 0;
    this.spawnPackages();
  }

  Activities.prototype.spawnPackages = function () {
    var self = this;
    PACKAGE_SPOTS.forEach(function (spot, i) {
      var mesh = buildPackageMesh();
      mesh.position.set(spot.x, 0, spot.z);
      self.scene.add(mesh);
      self.packages.push({
        id: i, mesh: mesh, x: spot.x, z: spot.z,
        taken: false, phase: self.rng() * 6
      });
    });
  };

  // Restore which packages were already collected (from a save).
  Activities.prototype.restoreFound = function (foundIds) {
    var self = this;
    (foundIds || []).forEach(function (id) {
      var pk = self.packages[id];
      if (pk && !pk.taken) {
        pk.taken = true;
        self.scene.remove(pk.mesh);
        self.foundIds[id] = true;
        self.packagesFound++;
      }
    });
  };

  Activities.prototype.packagesLeft = function () {
    return this.packages.length - this.packagesFound;
  };

  // Walk over a package to collect it. Returns the package or null.
  Activities.prototype.collectPackage = function (px, pz) {
    for (var i = 0; i < this.packages.length; i++) {
      var pk = this.packages[i];
      if (pk.taken) continue;
      if (Game.dist2D(px, pz, pk.x, pk.z) < 2.4) {
        pk.taken = true;
        this.foundIds[pk.id] = true;
        this.packagesFound++;
        this.scene.remove(pk.mesh);
        if (this.world.audio) this.world.audio.pickup();
        if (this.world.player) this.world.player.heal(CFG.PACKAGE_HEAL);
        if (this.world.onCash) this.world.onCash(CFG.PACKAGE_CASH);
        if (this.world.hud) {
          this.world.hud.notify('Smuggler package found — +$' + CFG.PACKAGE_CASH +
            ' (+' + CFG.PACKAGE_HEAL + ' HP). ' + this.packagesLeft() + ' left.', 'good');
          this.world.hud.setPackages(this.packagesFound, this.packages.length);
        }
        return pk;
      }
    }
    return null;
  };

  // ---- taxi jobs ----

  Activities.prototype.startTaxi = function () {
    var w = this.world;
    if (this.taxi) return false;
    if (!w.player.inCar || !w.player.inCar.taxi) return false;
    var from = Game.city.randomRoadPoint(this.rng);
    var to = Game.city.randomRoadPoint(this.rng);
    var dist = Game.dist2D(from.x, from.z, to.x, to.z);
    if (dist < 60) { to.x += 120; to.z += 60; dist = Game.dist2D(from.x, from.z, to.x, to.z); }
    var fare = Math.round(CFG.TAXI_FARE_BASE + dist * CFG.TAXI_FARE_PER_M);
    // passenger waits at the pickup point (a pedestrian in a yellow shirt)
    var mesh = new THREE.Group();
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32),
      new THREE.MeshLambertMaterial({ color: 0xffd21f }));
    torso.position.y = 1.1;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
    head.position.y = 1.65;
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    legs.position.y = 0.38;
    mesh.add(torso, head, legs);
    mesh.position.set(from.x + 2, 0, from.z + 2);
    this.scene.add(mesh);
    // marker ring at the pickup, then at the drop-off
    var marker = new THREE.Group();
    var ring = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 0.3, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.55 }));
    ring.position.y = 0.2;
    marker.add(ring);
    marker.position.set(from.x, 0, from.z);
    this.scene.add(marker);
    this.taxi = {
      stage: 'pickup',
      pickup: from, dest: to, fare: fare,
      timeLeft: CFG.TAXI_TIMEOUT_S,
      passenger: mesh, marker: marker,
      startX: from.x, startZ: from.z
    };
    if (w.hud) {
      w.hud.notify('TAXI JOB: pick up the passenger — $' + fare + ' if you make it in time.', 'mission');
      w.hud.setTaxi('PICK UP  •  $' + fare + '  •  ' + CFG.TAXI_TIMEOUT_S + 's');
    }
    if (w.audio) w.audio.missionChime();
    return true;
  };

  Activities.prototype.cancelTaxi = function (reason) {
    if (!this.taxi) return;
    this.scene.remove(this.taxi.passenger);
    this.scene.remove(this.taxi.marker);
    this.taxi = null;
    if (this.world.hud) {
      this.world.hud.setTaxi('');
      if (reason) this.world.hud.notify('Taxi job cancelled — ' + reason + '.', 'bad');
    }
  };

  Activities.prototype.update = function (dt) {
    var self = this;
    // packages bob and spin
    this.packages.forEach(function (pk) {
      if (pk.taken) return;
      pk.phase += dt * 2;
      pk.mesh.userData.box.position.y = 0.7 + Math.sin(pk.phase) * 0.15;
      pk.mesh.userData.box.rotation.y += dt * 1.2;
      pk.mesh.userData.glow.material.opacity = 0.14 + Math.sin(pk.phase) * 0.06;
    });
    if (!this.taxi) return;
    var t = this.taxi;
    var w = this.world;
    var px = w.player.x, pz = w.player.z;
    t.timeLeft -= dt;
    if (t.timeLeft <= 0) {
      this.cancelTaxi('out of time');
      return;
    }
    if (!w.player.inCar) {
      // the passenger waits while Leo is on foot, but the meter runs
      if (w.hud) w.hud.setTaxi((t.stage === 'pickup' ? 'PICK UP' : 'DROP OFF') +
        '  •  $' + t.fare + '  •  ' + Math.ceil(t.timeLeft) + 's  •  GET BACK IN THE CAB');
      return;
    }
    var target = t.stage === 'pickup' ? t.pickup : t.dest;
    var d = Game.dist2D(px, pz, target.x, target.z);
    if (d < 7) {
      if (t.stage === 'pickup') {
        // passenger hops in: remove the waiting figure, retarget the marker
        this.scene.remove(t.passenger);
        t.passenger = null;
        t.stage = 'dropoff';
        t.marker.position.set(t.dest.x, 0, t.dest.z);
        if (w.hud) w.hud.notify('Passenger in. Take them to the marker.', 'good');
      } else {
        // fare complete
        var fare = t.fare;
        this.taxiEarned += fare;
        this.taxiJobs++;
        this.scene.remove(t.marker);
        this.taxi = null;
        if (w.onCash) w.onCash(fare);
        if (w.audio) w.audio.cashSound();
        if (w.hud) {
          w.hud.setTaxi('');
          w.hud.notify('Fare complete — +$' + fare + '. Total taxi earnings: $' + this.taxiEarned + '.', 'good');
        }
        return;
      }
    }
    if (w.hud) {
      w.hud.setTaxi((t.stage === 'pickup' ? 'PICK UP' : 'DROP OFF') +
        '  •  $' + t.fare + '  •  ' + Math.ceil(t.timeLeft) + 's  •  ' + Math.round(d) + 'm');
    }
  };

  Game.Activities = Activities;
})();
