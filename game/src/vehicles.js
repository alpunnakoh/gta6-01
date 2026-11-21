// SUNSET SHORES — vehicles.js
// VehicleFactory builds low-poly procedural cars in four variants — the
// plain sedan, a taxi with a roof sign, a sports coupe with a spoiler and
// a higher top speed, and a boxy delivery van. CarController is the arcade
// driving model: acceleration, braking, reverse, steering scaled by speed,
// handbrake, building + car collisions, damage (a battered car smokes, a
// wrecked one will not drive), and a smoothed chase camera.
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

  // One shared smoke puff texture: a soft grey radial blob, tinted darker
  // the worse the damage is.
  var smokeTex = null;
  function getSmokeTexture() {
    if (smokeTex) return smokeTex;
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    rg.addColorStop(0, 'rgba(120,120,120,0.85)');
    rg.addColorStop(0.6, 'rgba(90,90,90,0.45)');
    rg.addColorStop(1, 'rgba(60,60,60,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    smokeTex = new THREE.CanvasTexture(c);
    return smokeTex;
  }

  function buildCarMesh(opts) {
    opts = opts || {};
    var color = opts.color !== undefined ? opts.color : 0xd8443c;
    var police = !!opts.police;
    var variant = opts.variant || 'sedan';
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var bodyH = variant === 'van' ? 1.05 : (variant === 'bus' ? 1.5 : 0.62);
    var bodyL = variant === 'van' ? 4.9 : (variant === 'bus' ? 8.5 : 4.4);
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, bodyL), bodyMat);
    body.position.y = variant === 'van' ? 0.85 : (variant === 'bus' ? 1.05 : 0.62);
    g.add(body);
    if (variant === 'bus') {
      // long window band down both sides + a destination board up front
      var band = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.6, 7.6),
        new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }));
      band.position.set(0, 1.5, 0);
      g.add(band);
      var dest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffd21f }));
      dest.position.set(0, 1.9, 4.28);
      g.add(dest);
    }
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, variant === 'van' ? 1.2 : 2.1),
      new THREE.MeshLambertMaterial({ color: police ? 0x1c2430 : 0x20262e }));
    cabin.position.set(0, variant === 'van' ? 1.65 : 1.18, variant === 'van' ? 0.9 : -0.25);
    if (variant !== 'bus') g.add(cabin);
    // windows: light band on the cabin
    var glass = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.3, variant === 'van' ? 1.1 : 2.0),
      new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }));
    glass.position.set(0, variant === 'van' ? 1.68 : 1.22, variant === 'van' ? 0.9 : -0.25);
    if (variant !== 'bus') g.add(glass);
    // headlights + taillights
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    var tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    [-0.62, 0.62].forEach(function (x) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), hl);
      h.position.set(x, 0.66, bodyL / 2 + 0.02);
      g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tl);
      t.position.set(x, 0.66, -bodyL / 2 - 0.02);
      g.add(t);
    });
    // wheels
    var wheels = [];
    var wz = variant === 'van' ? 1.7 : (variant === 'bus' ? 3.2 : 1.45);
    [[-0.95, wz], [0.95, wz], [-0.95, -wz], [0.95, -wz]].forEach(function (p) {
      var w = makeWheel();
      w.position.set(p[0], 0.42, p[1]);
      g.add(w);
      wheels.push(w);
    });
    g.userData.wheels = wheels;
    if (variant === 'taxi') {
      // lit TAXI roof sign — the car Leo can work as a cab driver
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffe95e }));
      sign.position.set(0, 1.62, -0.25);
      g.add(sign);
      var signBar = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.06, 0.44),
        new THREE.MeshLambertMaterial({ color: 0x14161a }));
      signBar.position.set(0, 1.48, -0.25);
      g.add(signBar);
    }
    if (variant === 'sport') {
      // rear spoiler + lower stance read: the fastest car in the bay
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x14161a }));
      spoiler.position.set(0, 1.05, -2.05);
      g.add(spoiler);
      [-0.7, 0.7].forEach(function (x) {
        var strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08),
          new THREE.MeshLambertMaterial({ color: 0x14161a }));
        strut.position.set(x, 0.92, -2.05);
        g.add(strut);
      });
    }
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
    // damage smoke, hidden until the car is battered
    var smoke = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSmokeTexture(), transparent: true, opacity: 0, depthWrite: false }));
    smoke.scale.set(2.4, 2.4, 1);
    smoke.position.set(0, 1.6, 0.8);
    smoke.visible = false;
    g.add(smoke);
    g.userData.smoke = smoke;
    return g;
  }

  function VehicleFactory() {}

  VehicleFactory.createCar = function (opts) {
    var mesh = buildCarMesh(opts);
    var variant = opts.variant || 'sedan';
    var topSpeed = CFG.CAR_MAX_SPEED;
    if (variant === 'sport') topSpeed = CFG.SPORT_TOP_SPEED;
    else if (variant === 'van') topSpeed = CFG.VAN_TOP_SPEED;
    else if (variant === 'taxi') topSpeed = CFG.TAXI_TOP_SPEED;
    else if (variant === 'bus') topSpeed = CFG.VAN_TOP_SPEED;
    var car = {
      mesh: mesh,
      wheels: mesh.userData.wheels,
      x: opts.x || 0,
      z: opts.z || 0,
      heading: opts.heading || 0,   // radians, 0 = facing +Z (see forward)
      speed: 0,
      steer: 0,
      color: opts.color || 0xd8443c,
      variant: variant,
      taxi: variant === 'taxi',
      police: !!opts.police,
      isPlayerCar: false,
      ai: null,                      // TrafficSystem hooks an AI driver here
      health: CFG.CAR_HEALTH,
      wrecked: false,
      topSpeed: topSpeed,
      flashT: 0,
      smokeT: 0
    };
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    return car;
  };

  // Forward is (sin(heading), cos(heading)) in (x, z) — heading 0 faces +Z.
  function forward(car) {
    return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
  }

  // Smash a car: health drops, the smoke thickens, and at 0 the car is a
  // wreck that will not drive again. Returns true when it just became a wreck.
  function damageCar(car, amount) {
    if (car.wrecked || amount <= 0) return false;
    car.health -= amount;
    if (car.health <= 0) {
      car.health = 0;
      car.wrecked = true;
      car.speed = 0;
      return true;
    }
    return false;
  }
  VehicleFactory.damageCar = damageCar;

  // Arcade car step. input: {throttle: -1..1, steer: -1..1, handbrake: bool}
  // dt in seconds. Returns nothing; mutates car.
  function stepCar(car, input, dt) {
    if (car.wrecked) {
      car.speed = 0;
      car.mesh.position.set(car.x, 0, car.z);
      return;
    }
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
    car.speed = Game.clamp(car.speed, -CFG.CAR_MAX_REVERSE, car.topSpeed);
    // steering: less bite at very low speed, more at speed; reverse flips it
    var steerTarget = input.steer * CFG.CAR_STEER;
    var speedFactor = Game.clamp(Math.abs(car.speed) / 8, 0, 1);
    var dir = car.speed >= 0 ? 1 : -1;
    car.heading += steerTarget * speedFactor * dir * dt * (input.handbrake ? 1.6 : 1);
    car.steer = input.steer;
    car.x += f.x * car.speed * dt;
    car.z += f.z * car.speed * dt;
    // building collision: push out + scrub speed + take damage on hard hits
    var hit = Game.city.collideCircle(car.x, car.z, CFG.CAR_RADIUS);
    if (hit) {
      var impact = Math.abs(car.speed);
      car.x = hit.x; car.z = hit.z;
      car.speed *= 0.45;
      if (impact > 12) damageCar(car, (impact - 12) * 1.5);
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
    // damage smoke: the worse the health, the thicker and darker
    var smoke = car.mesh.userData.smoke;
    if (smoke) {
      if (car.health < CFG.CAR_SMOKE_BELOW) {
        car.smokeT += dt;
        smoke.visible = true;
        smoke.material.opacity = 0.25 + (1 - car.health / CFG.CAR_SMOKE_BELOW) * 0.55;
        var s = 2.2 + Math.sin(car.smokeT * 7) * 0.5;
        smoke.scale.set(s, s, 1);
        smoke.position.y = 1.6 + Math.sin(car.smokeT * 3) * 0.3;
      } else {
        smoke.visible = false;
      }
    }
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
