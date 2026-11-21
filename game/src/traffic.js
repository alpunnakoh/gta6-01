// SUNSET SHORES — traffic.js
// TrafficSystem: ~14 AI cars that drive the road grid (lane offsets, turns at
// intersections, slowing for the car ahead). PedestrianSystem: ~20 walkers on
// the sidewalks who stroll, cross at corners, and run when shots are fired.
(function () {
  'use strict';
  var CFG = Game.CFG;

  var TRAFFIC_COLORS = [0xd8443c, 0x3c7ad8, 0xe8e8e8, 0x2a2f38, 0xffd21f, 0x7a4ec8, 0x4ec8a0, 0xc8c8c8];
  var PED_SHIRTS = [0xe86a6a, 0x6a9ae8, 0x7ac86a, 0xe8c86a, 0xc86ad8, 0x6ad8d0, 0xe8e8e8, 0x8a6ad8];

  function TrafficSystem(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    for (var i = 0; i < CFG.TRAFFIC_COUNT; i++) {
      this.spawnCar(true);
    }
  }

  TrafficSystem.prototype.spawnCar = function (anywhere) {
    var r = this.rng;
    var p = Game.city.randomRoadPoint(r);
    var horizontal = Math.abs(p.z - Game.nearestRoadCoord(p.z)) < 1;
    var dir = r() < 0.5 ? 1 : -1;
    var heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    var car = Game.VehicleFactory.createCar({
      x: p.x, z: p.z, heading: heading,
      color: TRAFFIC_COLORS[Math.floor(r() * TRAFFIC_COLORS.length)]
    });
    car.ai = {
      speed: CFG.TRAFFIC_SPEED * (0.8 + r() * 0.45),
      horizontal: horizontal,
      dir: dir,
      road: horizontal ? p.z : p.x,
      lane: horizontal ? p.z : p.x,
      nextTurnAt: 0
    };
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  };

  TrafficSystem.prototype.update = function (dt, playerCar) {
    var self = this;
    this.cars.forEach(function (car) {
      var ai = car.ai;
      // slow for the car ahead (any car, incl. the player's)
      var f = Game.CarController.forward(car);
      var aheadDist = 999;
      var all = self.cars.concat(playerCar ? [playerCar] : []);
      all.forEach(function (other) {
        if (other === car) return;
        var dx = other.x - car.x, dz = other.z - car.z;
        var along = dx * f.x + dz * f.z;
        var side = Math.abs(dx * f.z - dz * f.x);
        if (along > 0 && along < 16 && side < 2.4 && along < aheadDist) aheadDist = along;
      });
      var target = ai.speed;
      if (aheadDist < 13) target = Math.max(0, ai.speed * (aheadDist - 6) / 7);
      // move along current road
      var move = Math.min(target, ai.speed) * dt;
      if (ai.horizontal) car.x += ai.dir * move;
      else car.z += ai.dir * move;
      car.speed = target;
      // at an intersection, maybe turn onto a cross road
      var alongCoord = ai.horizontal ? car.x : car.z;
      var nearest = Game.nearestRoadCoord(alongCoord);
      var distToCross = Math.abs(alongCoord - nearest);
      if (distToCross < 2.5 && Math.abs(alongCoord - ai.nextTurnAt) > 20) {
        ai.nextTurnAt = nearest;
        if (self.rng() < 0.45) {
          // turn: switch axis, snap to the cross road's lane
          var newDir = self.rng() < 0.5 ? 1 : -1;
          var laneOff = newDir > 0 ? 3.4 : -3.4;
          if (ai.horizontal) {
            car.z = nearest + laneOff;
            car.x = nearest;
            car.heading = newDir > 0 ? 0 : Math.PI;
            ai.horizontal = false; ai.dir = newDir; ai.road = car.x;
          } else {
            car.x = nearest + laneOff;
            car.z = nearest;
            car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
            ai.horizontal = true; ai.dir = newDir; ai.road = car.z;
          }
        }
      }
      // wrap around the city edge
      if (car.x > CFG.CITY_HALF + 20) car.x = -CFG.CITY_HALF - 18;
      if (car.x < -CFG.CITY_HALF - 20) car.x = CFG.CITY_HALF + 18;
      if (car.z > CFG.CITY_HALF + 20) car.z = -CFG.CITY_HALF - 18;
      if (car.z < -CFG.CITY_HALF - 20) car.z = CFG.CITY_HALF + 18;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      var spin = car.speed * dt / 0.42;
      car.wheels.forEach(function (w) { w.rotation.x += spin; });
    });
    // keep traffic cars from overlapping each other (cheap circle push)
    for (var i = 0; i < this.cars.length; i++) {
      for (var j = i + 1; j < this.cars.length; j++) {
        var a = this.cars[i], b = this.cars[j];
        var dx = b.x - a.x, dz = b.z - a.z;
        var d2 = dx * dx + dz * dz;
        if (d2 < 9 && d2 > 0.001) {
          var d = Math.sqrt(d2), push = (3 - d) / 2;
          a.x -= dx / d * push; a.z -= dz / d * push;
          b.x += dx / d * push; b.z += dz / d * push;
        }
      }
    }
  };

  // ---- pedestrians ----

  function buildPedMesh(rng) {
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: PED_SHIRTS[Math.floor(rng() * PED_SHIRTS.length)] });
    var pants = new THREE.MeshLambertMaterial({ color: 0x333a44 });
    var skin = new THREE.MeshLambertMaterial({ color: [0xd9a077, 0x8a5a3a, 0xe8b890][Math.floor(rng() * 3)] });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
    legL.position.set(-0.13, 0.38, 0);
    var legR = legL.clone(); legR.position.x = 0.13;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), shirt);
    torso.position.y = 1.1;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.65;
    g.add(legL, legR, torso, head);
    g.userData = { legL: legL, legR: legR };
    return g;
  }

  function PedestrianSystem(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.peds = [];
    for (var i = 0; i < CFG.PED_COUNT; i++) this.spawnPed();
  }

  PedestrianSystem.prototype.spawnPed = function () {
    var r = this.rng;
    var p = Game.city.randomSidewalkPoint(r);
    var mesh = buildPedMesh(r);
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    var horizontal = Math.abs(p.z - Game.nearestRoadCoord(p.z)) < 3;
    var ped = {
      mesh: mesh, x: p.x, z: p.z,
      horizontal: horizontal,
      dir: r() < 0.5 ? 1 : -1,
      speed: CFG.PED_SPEED * (0.7 + r() * 0.7),
      phase: r() * 6,
      fleeT: 0,
      fleeX: 0, fleeZ: 0
    };
    mesh.rotation.y = horizontal ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
    this.peds.push(ped);
    return ped;
  };

  PedestrianSystem.prototype.scare = function (x, z) {
    this.peds.forEach(function (p) {
      var d = Game.dist2D(p.x, p.z, x, z);
      if (d < 45) {
        p.fleeT = 3 + Math.random() * 2;
        p.fleeX = x; p.fleeZ = z;
      }
    });
  };

  PedestrianSystem.prototype.update = function (dt) {
    this.peds.forEach(function (p) {
      var sp = p.speed;
      var mx = 0, mz = 0;
      if (p.fleeT > 0) {
        p.fleeT -= dt;
        sp = CFG.PED_FLEE_SPEED;
        var dx = p.x - p.fleeX, dz = p.z - p.fleeZ;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        mx = dx / d; mz = dz / d;
        p.mesh.rotation.y = Math.atan2(mx, mz);
      } else {
        if (p.horizontal) mx = p.dir;
        else mz = p.dir;
        // reverse at city edge / randomly at intersections
        var along = p.horizontal ? p.x : p.z;
        if (Math.abs(along) > CFG.CITY_HALF + 10) p.dir *= -1;
        p.mesh.rotation.y = p.horizontal ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      }
      p.x += mx * sp * dt;
      p.z += mz * sp * dt;
      p.phase += dt * sp * 2.2;
      var swing = Math.sin(p.phase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
    });
  };

  Game.TrafficSystem = TrafficSystem;
  Game.PedestrianSystem = PedestrianSystem;
})();
