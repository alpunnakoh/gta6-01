// SUNSET SHORES — vehicles.js
// VehicleFactory builds low-poly procedural cars (body, cabin, wheels, lights,
// police light bar). CarController is the arcade driving model: acceleration,
// braking, reverse, steering scaled by speed, handbrake, building + car
// collisions, and a smoothed chase camera.
(function () {
  'use strict';
  var CFG = Game.CFG;

  function makeWheel() {
    var w = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10),
      new THREE.MeshLambertMaterial({ color: 0x14161a }));
    w.rotation.z = Math.PI / 2;
    return w;
  }

  function buildCarMesh(opts) {
    opts = opts || {};
    var color = opts.color !== undefined ? opts.color : 0xd8443c;
    var police = !!opts.police;
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
    body.position.y = 0.62;
    g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1),
      new THREE.MeshLambertMaterial({ color: police ? 0x1c2430 : 0x20262e }));
    cabin.position.set(0, 1.18, -0.25);
    g.add(cabin);
    // windows: light band on the cabin
    var glass = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.3, 2.0),
      new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }));
    glass.position.set(0, 1.22, -0.25);
    g.add(glass);
    // headlights + taillights
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    var tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    [-0.62, 0.62].forEach(function (x) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), hl);
      h.position.set(x, 0.66, 2.22);
      g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tl);
      t.position.set(x, 0.66, -2.22);
      g.add(t);
    });
    // wheels
    var wheels = [];
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
      var w = makeWheel();
      w.position.set(p[0], 0.42, p[1]);
      g.add(w);
      wheels.push(w);
    });
    g.userData.wheels = wheels;
    if (police) {
      // black hood + trunk panels for the classic two-tone cruiser
      var hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 1.1),
        new THREE.MeshLambertMaterial({ color: CFG.COLORS.policeBlack }));
      hood.position.set(0, 0.95, 1.55);
      g.add(hood);
      var bar = new THREE.Group();
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      red.position.x = -0.35;
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x2060ff }));
      blue.position.x = 0.35;
      bar.add(red); bar.add(blue);
      bar.position.set(0, 1.55, -0.25);
      g.add(bar);
      g.userData.lightBar = bar;
      g.userData.lightRed = red;
      g.userData.lightBlue = blue;
    }
    return g;
  }

  function VehicleFactory() {}

  VehicleFactory.createCar = function (opts) {
    var mesh = buildCarMesh(opts);
    var car = {
      mesh: mesh,
      wheels: mesh.userData.wheels,
      x: opts.x || 0,
      z: opts.z || 0,
      heading: opts.heading || 0,   // radians, 0 = facing -Z... we use -Z forward? see below
      speed: 0,
      steer: 0,
      color: opts.color || 0xd8443c,
      police: !!opts.police,
      isPlayerCar: false,
      ai: null,                      // TrafficSystem hooks an AI driver here
      health: 100,
      flashT: 0
    };
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    return car;
  };

  // Forward is (sin(heading), cos(heading)) in (x, z) — heading 0 faces +Z.
  function forward(car) {
    return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
  }

  // Arcade car step. input: {throttle: -1..1, steer: -1..1, handbrake: bool}
  // dt in seconds. Returns nothing; mutates car.
  function stepCar(car, input, dt) {
    var f = forward(car);
    if (input.handbrake) {
      car.speed -= Math.sign(car.speed) * CFG.CAR_HANDBRAKE * dt;
      if (Math.abs(car.speed) < 0.5) car.speed = 0;
    } else if (input.throttle > 0) {
      car.speed += CFG.CAR_ACCEL * input.throttle * dt;
    } else if (input.throttle < 0) {
      if (car.speed > 0.5) car.speed += CFG.CAR_BRAKE * input.throttle * dt; // brake
      else car.speed += CFG.CAR_REVERSE_ACCEL * input.throttle * dt;         // reverse
    } else {
      car.speed -= Math.sign(car.speed) * CFG.CAR_DRAG * 4 * dt;
      if (Math.abs(car.speed) < 0.3) car.speed = 0;
    }
    car.speed = Game.clamp(car.speed, -CFG.CAR_MAX_REVERSE, CFG.CAR_MAX_SPEED);
    // steering: less bite at very low speed, more at speed; reverse flips it
    var steerTarget = input.steer * CFG.CAR_STEER;
    var speedFactor = Game.clamp(Math.abs(car.speed) / 8, 0, 1);
    var dir = car.speed >= 0 ? 1 : -1;
    car.heading += steerTarget * speedFactor * dir * dt * (input.handbrake ? 1.6 : 1);
    car.steer = input.steer;
    car.x += f.x * car.speed * dt;
    car.z += f.z * car.speed * dt;
    // building collision: push out + scrub speed
    var hit = Game.city.collideCircle(car.x, car.z, CFG.CAR_RADIUS);
    if (hit) {
      car.x = hit.x; car.z = hit.z;
      car.speed *= 0.45;
    }
    // world bounds
    car.x = Game.clamp(car.x, -CFG.WORLD_HALF, CFG.WORLD_HALF);
    car.z = Game.clamp(car.z, -CFG.WORLD_HALF, CFG.WORLD_HALF + 40);
    // write to mesh
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // wheel spin + front-wheel steer visual
    var spin = car.speed * dt / 0.42;
    car.wheels.forEach(function (w, i) {
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = -input.steer * 0.4;
    });
    // police light bar flash
    if (car.police && car.mesh.userData.lightBar) {
      car.flashT += dt;
      var on = Math.floor(car.flashT * 6) % 2 === 0;
      car.mesh.userData.lightRed.material.color.setHex(on ? 0xff2020 : 0x551010);
      car.mesh.userData.lightBlue.material.color.setHex(on ? 0x102050 : 0x2060ff);
    }
  }

  function CarController() {}
  CarController.step = stepCar;
  CarController.forward = forward;

  // Chase camera: position behind the car, look slightly ahead.
  // yawOffset lets the player look around with the mouse while driving.
  function chaseCamera(camera, car, dt, snap, yawOffset) {
    var f = forward(car);
    var yaw = (yawOffset || 0);
    var bx = Math.sin(car.heading + yaw);
    var bz = Math.cos(car.heading + yaw);
    var back = 8.2 + Math.abs(car.speed) * 0.12;
    var tx = car.x - bx * back;
    var tz = car.z - bz * back;
    var ty = 3.8 + Math.abs(car.speed) * 0.03;
    if (snap) {
      camera.position.set(tx, ty, tz);
    } else {
      var k = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
      camera.position.x += (tx - camera.position.x) * k;
      camera.position.y += (ty - camera.position.y) * k;
      camera.position.z += (tz - camera.position.z) * k;
    }
    camera.lookAt(car.x + f.x * 6, 1.6, car.z + f.z * 6);
  }
  CarController.chaseCamera = chaseCamera;

  window.Game = window.Game || {};
  Game.VehicleFactory = VehicleFactory;
  Game.CarController = CarController;
})();
