// SUNSET SHORES — player.js
// PlayerController: Leo Marin on foot — WASD relative to the camera, Shift to
// run, Space to jump, E to enter/exit the nearest car, mouse-drag orbit camera.
// Builds Leo's low-poly figure (teal shirt, dark jeans) with a walk-cycle.
(function () {
  'use strict';
  var CFG = Game.CFG;

  function buildLeoMesh() {
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
    var shirt = new THREE.MeshLambertMaterial({ color: 0x1f8a8a });
    var jeans = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
    var hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
    // legs
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), jeans);
    legL.position.set(-0.14, 0.4, 0);
    var legR = legL.clone();
    legR.position.x = 0.14;
    // torso
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
    torso.position.y = 1.16;
    // arms
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), shirt);
    armL.position.set(-0.42, 1.18, 0);
    var armR = armL.clone();
    armR.position.x = 0.42;
    // head + hair + cap
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
    head.position.y = 1.74;
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.44), hair);
    cap.position.y = 1.98;
    var brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.2), hair);
    brim.position.set(0, 1.93, 0.3);
    g.add(legL, legR, torso, armL, armR, head, cap, brim);
    g.userData = { legL: legL, legR: legR, armL: armL, armR: armR, torso: torso };
    return g;
  }

  function PlayerController(scene) {
    this.mesh = buildLeoMesh();
    scene.add(this.mesh);
    this.x = 0; this.z = 8;
    this.y = 0;               // height above ground (jump)
    this.vy = 0;
    this.heading = 0;         // facing, radians
    this.camYaw = Math.PI;    // camera orbit yaw (behind player)
    this.camPitch = 0.32;
    this.camDist = 7.5;
    this.inCar = null;        // CarController car, or null
    this.hp = CFG.PLAYER_HP;
    this.walkPhase = 0;
    this.moving = false;
    this.speedNow = 0;
    this.mesh.position.set(this.x, 0, this.z);
  }

  PlayerController.prototype.reset = function (x, z) {
    this.x = x; this.z = z;
    this.y = 0; this.vy = 0;
    this.hp = CFG.PLAYER_HP;
    this.inCar = null;
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
  };

  // input: {f,b,l,r,run,jump} — camera-relative movement.
  PlayerController.prototype.updateOnFoot = function (input, dt) {
    var mx = 0, mz = 0;
    if (input.f) mz -= 1;
    if (input.b) mz += 1;
    if (input.l) mx -= 1;
    if (input.r) mx += 1;
    var len = Math.sqrt(mx * mx + mz * mz);
    this.moving = len > 0;
    var speed = input.run ? CFG.RUN_SPEED : CFG.WALK_SPEED;
    if (len > 0) {
      mx /= len; mz /= len;
      // rotate move vector by camera yaw
      var sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      var wx = mx * cos - mz * sin;
      var wz = mx * sin + mz * cos;
      this.x += wx * speed * dt;
      this.z += wz * speed * dt;
      this.heading = Math.atan2(wx, wz);
      this.speedNow = speed;
      this.walkPhase += dt * speed * 1.6;
    } else {
      this.speedNow = 0;
    }
    // jump / gravity
    if (input.jump && this.y === 0) this.vy = CFG.JUMP_VELOCITY;
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= CFG.GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    // building collision
    var hit = Game.city.collideCircle(this.x, this.z, CFG.PLAYER_RADIUS);
    if (hit) { this.x = hit.x; this.z = hit.z; }
    this.x = Game.clamp(this.x, -CFG.WORLD_HALF, CFG.WORLD_HALF);
    this.z = Game.clamp(this.z, -CFG.WORLD_HALF, CFG.WORLD_HALF + 40);
    // write to mesh + walk cycle
    var u = this.mesh.userData;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    var swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    u.torso.position.y = 1.16 + (this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0);
  };

  // Third-person orbit camera while on foot.
  PlayerController.prototype.updateCamera = function (camera, dt) {
    var cx = this.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    var cz = this.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    var cy = this.y + 1.8 + Math.sin(this.camPitch) * this.camDist;
    var k = 1 - Math.pow(0.0005, dt);
    camera.position.x += (cx - camera.position.x) * k;
    camera.position.y += (cy - camera.position.y) * k;
    camera.position.z += (cz - camera.position.z) * k;
    camera.lookAt(this.x, this.y + 1.5, this.z);
  };

  PlayerController.prototype.snapCamera = function (camera) {
    camera.position.set(
      this.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
      this.y + 1.8 + Math.sin(this.camPitch) * this.camDist,
      this.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist);
    camera.lookAt(this.x, this.y + 1.5, this.z);
  };

  PlayerController.prototype.damage = function (amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  };

  PlayerController.prototype.heal = function (amount) {
    this.hp = Math.min(CFG.PLAYER_HP, this.hp + amount);
  };

  Game.PlayerController = PlayerController;
})();
