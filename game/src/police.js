// SUNSET SHORES — police.js
// WantedSystem: 0-5 stars. Crimes raise it (steal a car, shoot, hit a
// pedestrian, hit a cop). Stars fall when the player stays out of police sight.
// PoliceSystem: cruisers spawn and chase/ram the player; foot cops chase on
// foot and bust the player if they get close while the player is slow; and
// from 3 stars a police helicopter circles overhead with a searchlight.
// Busted (caught) and Wasted (HP 0) end the run with a respawn.
(function () {
  'use strict';
  var CFG = Game.CFG;

  function WantedSystem() {
    this.stars = 0;
    this.hiddenT = 0;
    this.decayT = 0;
  }

  WantedSystem.prototype.addCrime = function (amount, reason) {
    var before = this.stars;
    this.stars = Math.min(CFG.WANTED_MAX, this.stars + amount);
    this.hiddenT = 0; this.decayT = 0;
    if (this.stars > before && Game.hud) {
      Game.hud.notify('WANTED: ' + this.stars + ' star' + (this.stars > 1 ? 's' : '') +
        (reason ? ' — ' + reason : ''), 'bad');
      if (this.stars >= CFG.HELI_MIN_STARS && before < CFG.HELI_MIN_STARS && Game.hud) {
        Game.hud.notify('PD AIR-1 is overhead — lose the chopper, lose the heat.', 'bad');
      }
    }
    return this.stars;
  };

  WantedSystem.prototype.clear = function () {
    this.stars = 0; this.hiddenT = 0; this.decayT = 0;
  };

  // Call each frame. nearestPoliceDist = distance to the closest cop, or 999.
  WantedSystem.prototype.update = function (dt, nearestPoliceDist) {
    if (this.stars === 0) return;
    if (nearestPoliceDist > 55) {
      this.hiddenT += dt;
      if (this.hiddenT > CFG.WANTED_DECAY_HIDE_S) {
        this.decayT += dt;
        if (this.decayT > CFG.WANTED_DECAY_STEP_S) {
          this.decayT = 0;
          this.stars--;
          if (Game.hud) Game.hud.notify('Heat dying down… ' + this.stars + ' star' + (this.stars === 1 ? '' : 's') + ' left', 'good');
        }
      }
    } else {
      this.hiddenT = 0; this.decayT = 0;
    }
  };

  function buildCopMesh() {
    var g = new THREE.Group();
    var navy = new THREE.MeshLambertMaterial({ color: 0x1c2a4a });
    var skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), navy);
    legL.position.set(-0.13, 0.38, 0);
    var legR = legL.clone(); legR.position.x = 0.13;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), navy);
    torso.position.y = 1.1;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.65;
    var hat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x101828 }));
    hat.position.y = 1.88;
    g.add(legL, legR, torso, head, hat);
    g.userData = { legL: legL, legR: legR };
    return g;
  }

  // PD AIR-1: white body, tail boom, spinning main rotor, and a cone of
  // searchlight that tracks the player from above.
  function buildHeliMesh() {
    var g = new THREE.Group();
    var white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    var navy = new THREE.MeshLambertMaterial({ color: 0x1c2a4a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 3.6), white);
    body.position.y = 0;
    var nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }));
    nose.position.set(0, -0.1, 2.2);
    var boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), white);
    boom.position.set(0, 0.2, -3.6);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.0), navy);
    fin.position.set(0, 0.8, -5.4);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.3, 3.0), navy);
    stripe.position.set(0, 0.3, 0.4);
    var rotor = new THREE.Group();
    var bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    [-1, 1].forEach(function (s) {
      var blade = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.35), bladeMat);
      blade.position.x = s * 3.6;
      rotor.add(blade);
    });
    rotor.position.y = 1.0;
    var skids = new THREE.Group();
    [-0.9, 0.9].forEach(function (x) {
      var skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      skid.position.set(x, -0.95, 0);
      skids.add(skid);
    });
    // searchlight cone: apex at the heli, wide base on the street below.
    // ConeGeometry's apex is at +Y, so with no rotation it already points
    // the right way; the cone is re-centred over the player each frame.
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, CFG.HELI_HEIGHT, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.14,
        side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = -CFG.HELI_HEIGHT / 2;
    g.add(body, nose, boom, fin, stripe, rotor, skids, cone);
    g.userData = { rotor: rotor, cone: cone };
    return g;
  }

  function PoliceSystem(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];   // police cruisers (CarController cars)
    this.cops = [];   // foot cops {mesh,x,z,phase}
    this.blocks = []; // roadblock cruisers, parked across the road (4+ stars)
    this.heli = null; // {mesh, x, z, angle} — the PD chopper, or null
    this.bustT = 0;
    this.sirenT = 0;
  }

  // At 4 stars the PD throws a roadblock across the road ahead of the
  // player: two cruisers parked bumper to bumper. Ram through or go around.
  PoliceSystem.prototype.spawnRoadblock = function (px, pz, heading) {
    var r = this.rng;
    var horizontal = Math.abs(pz - Game.nearestRoadCoord(pz)) < Math.abs(px - Game.nearestRoadCoord(px));
    var road = horizontal ? Game.nearestRoadCoord(pz) : Game.nearestRoadCoord(px);
    var ahead = (horizontal ? px : pz) + (r() < 0.5 ? -1 : 1) * 45;
    ahead = Game.clamp(ahead, -CFG.CITY_HALF, CFG.CITY_HALF);
    var self = this;
    [-3.4, 3.4].forEach(function (lane) {
      var x = horizontal ? ahead : road + lane;
      var z = horizontal ? road + lane : ahead;
      var car = Game.VehicleFactory.createCar({
        x: x, z: z, heading: horizontal ? Math.PI / 2 : 0,
        color: CFG.COLORS.policeWhite, police: true
      });
      car.ai = { block: true };
      self.scene.add(car.mesh);
      self.blocks.push(car);
    });
    if (Game.hud) Game.hud.notify('ROADBLOCK AHEAD — the PD is sealing the streets.', 'bad');
    if (Game.audio) Game.audio.sirenBlip();
  };

  PoliceSystem.prototype.clearRoadblock = function () {
    var self = this;
    this.blocks.forEach(function (c) { self.scene.remove(c.mesh); });
    this.blocks = [];
  };

  PoliceSystem.prototype.nearestDistance = function (px, pz) {
    var best = 999;
    this.cars.forEach(function (c) {
      best = Math.min(best, Game.dist2D(px, pz, c.x, c.z));
    });
    this.cops.forEach(function (c) {
      best = Math.min(best, Game.dist2D(px, pz, c.x, c.z));
    });
    return best;
  };

  PoliceSystem.prototype.spawnPoliceCar = function (px, pz) {
    var r = this.rng;
    // spawn on the player's nearest road, 60-110m away along it, so the
    // response is fast but the cruiser still has to drive in
    var horizontal = Math.abs(pz - Game.nearestRoadCoord(pz)) < Math.abs(px - Game.nearestRoadCoord(px));
    var road = horizontal ? Game.nearestRoadCoord(pz) : Game.nearestRoadCoord(px);
    var along = (horizontal ? px : pz) + (r() < 0.5 ? -1 : 1) * (60 + r() * 50);
    along = Game.clamp(along, -CFG.CITY_HALF, CFG.CITY_HALF);
    var lane = (r() < 0.5 ? -3.4 : 3.4);
    var x = horizontal ? along : road + lane;
    var z = horizontal ? road + lane : along;
    var car = Game.VehicleFactory.createCar({
      x: x, z: z, heading: Math.atan2(px - x, pz - z),
      color: CFG.COLORS.policeWhite, police: true
    });
    car.ai = { police: true };
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  };

  PoliceSystem.prototype.spawnFootCop = function (px, pz) {
    var r = this.rng;
    // on a sidewalk 35-70m from the player
    var horizontal = r() < 0.5;
    var road = horizontal ? Game.nearestRoadCoord(pz) : Game.nearestRoadCoord(px);
    var along = (horizontal ? px : pz) + (r() < 0.5 ? -1 : 1) * (35 + r() * 35);
    along = Game.clamp(along, -CFG.CITY_HALF, CFG.CITY_HALF);
    var side = (r() < 0.5 ? -1 : 1) * (CFG.ROAD_WIDTH / 2 + 2.2);
    var x = horizontal ? along : road + side;
    var z = horizontal ? road + side : along;
    var mesh = buildCopMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    var cop = { mesh: mesh, x: x, z: z, phase: 0 };
    this.cops.push(cop);
    return cop;
  };

  PoliceSystem.prototype.spawnHeli = function (px, pz) {
    var mesh = buildHeliMesh();
    mesh.position.set(px + 40, CFG.HELI_HEIGHT, pz - 40);
    this.scene.add(mesh);
    this.heli = { mesh: mesh, x: px + 40, z: pz - 40, angle: 0 };
    if (Game.audio) Game.audio.setRotor(1);
    return this.heli;
  };

  PoliceSystem.prototype.removeHeli = function () {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    this.heli = null;
    if (Game.audio) Game.audio.setRotor(0);
  };

  // Drop the unit FARTHEST from the player when the heat falls, so the
  // closest pursuit is never the one that despawns.
  PoliceSystem.prototype._removeFarthest = function (list, px, pz) {
    var worst = 0, worstD = -1;
    list.forEach(function (u, i) {
      var d = Game.dist2D(px, pz, u.x, u.z);
      if (d > worstD) { worstD = d; worst = i; }
    });
    var removed = list.splice(worst, 1)[0];
    this.scene.remove(removed.mesh);
  };

  // Keep the number of pursuing units matched to the wanted level.
  PoliceSystem.prototype.matchWanted = function (stars, px, pz) {
    var wantCars = stars === 0 ? 0 : Math.min(CFG.POLICE_CAR_MAX, Math.ceil(stars / 2) + (stars >= 3 ? 1 : 0));
    var wantCops = stars >= 2 ? Math.min(CFG.POLICE_FOOT_MAX, stars - 1) : 0;
    while (this.cars.length < wantCars) this.spawnPoliceCar(px, pz);
    while (this.cops.length < wantCops) this.spawnFootCop(px, pz);
    // release extras when the heat drops — farthest first
    while (this.cars.length > wantCars) this._removeFarthest(this.cars, px, pz);
    while (this.cops.length > wantCops) this._removeFarthest(this.cops, px, pz);
    // the chopper joins at 3 stars and leaves when the heat drops below it
    if (stars >= CFG.HELI_MIN_STARS && !this.heli) this.spawnHeli(px, pz);
    if (stars < CFG.HELI_MIN_STARS && this.heli) this.removeHeli();
    // the roadblock goes up at 4 stars and comes down when the heat drops
    if (stars >= 4 && this.blocks.length === 0) this.spawnRoadblock(px, pz);
    if (stars < 4 && this.blocks.length > 0) this.clearRoadblock();
  };

  PoliceSystem.prototype.clearAll = function () {
    var self = this;
    this.cars.forEach(function (c) { self.scene.remove(c.mesh); });
    this.cops.forEach(function (c) { self.scene.remove(c.mesh); });
    this.cars = []; this.cops = [];
    this.clearRoadblock();
    this.removeHeli();
    this.bustT = 0;
  };

  // dt, player {x,z,inCar,car,speedNow}, wanted, onBusted callback.
  // Returns 'busted' when the player is caught, else null.
  PoliceSystem.prototype.update = function (dt, player, wanted) {
    var px = player.x, pz = player.z;
    var self = this;
    // --- cruisers: steer toward the player, ram on contact ---
    this.cars.forEach(function (car) {
      var dx = px - car.x, dz = pz - car.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      var desired = Math.atan2(dx, dz);
      var diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var steer = Game.clamp(diff * 2.2, -1, 1);
      var throttle = dist > 8 ? 1 : 0.4;
      Game.CarController.step(car, { throttle: throttle, steer: steer, handbrake: false }, dt);
      // ram damage: hitting the player's car or the player on foot
      if (player.inCar) {
        var pc = player.inCar;
        if (Game.dist2D(car.x, car.z, pc.x, pc.z) < 3.4) {
          pc.speed *= 0.7;
          car.speed *= 0.6;
          if (Game.audio) Game.audio.thud();
        }
      } else if (dist < 2.2) {
        if (player.damage(CFG.POLICE_RAM_DAMAGE * dt * 3)) return 'wasted';
        car.speed *= 0.5;
      }
    });
    // --- foot cops: run at the player ---
    var busted = false;
    this.cops.forEach(function (cop) {
      var dx = px - cop.x, dz = pz - cop.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      var sp = 7.5;
      cop.x += dx / dist * sp * dt;
      cop.z += dz / dist * sp * dt;
      cop.phase += dt * sp * 2;
      cop.mesh.userData.legL.rotation.x = Math.sin(cop.phase) * 0.6;
      cop.mesh.userData.legR.rotation.x = -Math.sin(cop.phase) * 0.6;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = Math.atan2(dx, dz);
      // bust: close to a slow / on-foot player for a while
      if (!player.inCar && dist < CFG.POLICE_BUST_RANGE && player.speedNow < 3) {
        self.bustT += dt;
        if (self.bustT > CFG.POLICE_BUST_TIME) busted = true;
      }
    });
    if (!busted && (player.inCar || this.cops.length === 0)) this.bustT = Math.max(0, this.bustT - dt * 2);
    // --- helicopter: circle above the player, rotor spinning, light on them
    if (this.heli) {
      var h = this.heli;
      h.angle += dt * 0.45;
      var orbitR = 22;
      var tx = px + Math.cos(h.angle) * orbitR;
      var tz = pz + Math.sin(h.angle) * orbitR;
      var k = 1 - Math.pow(0.01, dt);
      h.x += (tx - h.x) * k;
      h.z += (tz - h.z) * k;
      h.mesh.position.set(h.x, CFG.HELI_HEIGHT + Math.sin(h.angle * 2) * 1.5, h.z);
      h.mesh.rotation.y = Math.atan2(px - h.x, pz - h.z);
      h.mesh.userData.rotor.rotation.y += dt * 22;
      // the searchlight cone stays centred on the player, not on the orbit:
      // the cone is a child of the heli, so offset it by (player - heli)
      var cone = h.mesh.userData.cone;
      cone.position.set(px - h.x, -CFG.HELI_HEIGHT / 2, pz - h.z);
    }
    // siren volume follows the nearest cruiser
    if (Game.audio) {
      var nd = this.nearestDistance(px, pz);
      Game.audio.setSiren(this.cars.length > 0 ? Game.clamp(1 - nd / 120, 0, 1) : 0);
    }
    if (busted) return 'busted';
    return null;
  };

  Game.WantedSystem = WantedSystem;
  Game.PoliceSystem = PoliceSystem;
})();
