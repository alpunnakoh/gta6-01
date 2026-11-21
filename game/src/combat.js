// SUNSET SHORES — combat.js
// CombatSystem: Leo's pistol — ammo + reload, muzzle flash light, raycast
// shooting with hit markers, and armed NPC enemies (M4/M5) with HP bars who
// shoot back. Enemies are simple low-poly figures with a red health bar sprite.
(function () {
  'use strict';
  var CFG = Game.CFG;

  function makeHpBarSprite() {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 8;
    var tex = new THREE.CanvasTexture(c);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    spr.scale.set(2.2, 0.28, 1);
    spr.userData.canvas = c;
    spr.userData.tex = tex;
    return spr;
  }

  function drawHpBar(spr, frac) {
    var c = spr.userData.canvas;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 64, 8);
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(0, 0, 64, 8);
    g.fillStyle = frac > 0.5 ? '#3ddc5a' : (frac > 0.25 ? '#ffcc33' : '#ff3333');
    g.fillRect(1, 1, 62 * Math.max(0, frac), 6);
    spr.userData.tex.needsUpdate = true;
  }

  function buildEnemyMesh() {
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: 0x8a1f1f });
    var pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
    legL.position.set(-0.13, 0.38, 0);
    var legR = legL.clone(); legR.position.x = 0.13;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), shirt);
    torso.position.y = 1.12;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.68;
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.3, 0.35);
    g.add(legL, legR, torso, head, gun);
    g.userData = { legL: legL, legR: legR };
    return g;
  }

  function CombatSystem(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.ammo = CFG.PISTOL_MAG;
    this.reserve = 60;
    this.reloadT = 0;
    this.fireCooldown = 0;
    this.enemies = [];
    this.kills = 0; // total enemies killed — missions count shootout progress from this
    this.flashUntil = 0;
    this.keepFlash = false; // staged screenshots hold the muzzle flash
    // muzzle flash: small bright sprite + point light at the gun
    var fc = document.createElement('canvas');
    fc.width = fc.height = 64;
    var fg = fc.getContext('2d');
    var rg = fg.createRadialGradient(32, 32, 2, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,220,1)');
    rg.addColorStop(0.4, 'rgba(255,190,80,0.9)');
    rg.addColorStop(1, 'rgba(255,120,20,0)');
    fg.fillStyle = rg;
    fg.fillRect(0, 0, 64, 64);
    this.flashTex = new THREE.CanvasTexture(fc);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flashTex, transparent: true, depthWrite: false }));
    this.flashSprite.scale.set(1.6, 1.6, 1);
    this.flashSprite.visible = false;
    this.flashLight = new THREE.PointLight(0xffc060, 0, 14);
    scene.add(this.flashSprite);
    scene.add(this.flashLight);
    // tracer: bright line from the muzzle to the hit point, shown briefly
    this.tracer = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe95e, transparent: true, opacity: 0.9 }));
    this.tracer.visible = false;
    scene.add(this.tracer);
    this.tracerUntil = 0;
    this.raycaster = new THREE.Raycaster();
    this.hitMarkerT = 0;
  }

  // Bright tracer line between two points; hidden after ~90ms (or held by
  // keepFlash for staged screenshots).
  CombatSystem.prototype.showTracer = function (from, to) {
    var mid = from.clone().add(to).multiplyScalar(0.5);
    var len = from.distanceTo(to);
    this.tracer.position.copy(mid);
    this.tracer.scale.set(1, 1, len);
    this.tracer.lookAt(to);
    this.tracer.visible = true;
    this.tracerUntil = performance.now() + 90;
  };

  CombatSystem.prototype.canShoot = function () {
    return this.reloadT <= 0 && this.fireCooldown <= 0 && this.ammo > 0;
  };

  // Fire from the player toward the camera aim point. Returns 'hit'|'miss'|'empty'.
  CombatSystem.prototype.shoot = function (origin, direction) {
    if (this.reloadT > 0 || this.fireCooldown > 0) return 'wait';
    if (this.ammo <= 0) {
      if (Game.audio) Game.audio.clickEmpty();
      this.reload();
      return 'empty';
    }
    this.ammo--;
    this.fireCooldown = CFG.PISTOL_FIRE_RATE;
    this.flashUntil = performance.now() + 90;
    this.flashSprite.visible = true;
    this.flashLight.intensity = 3;
    // place flash at the player's gun hand
    this.flashSprite.position.copy(origin).add(direction.clone().multiplyScalar(1.2));
    this.flashSprite.position.y += 0.4;
    this.flashLight.position.copy(this.flashSprite.position);
    // tracer from muzzle toward the aim point
    var end = origin.clone().add(direction.clone().multiplyScalar(30));
    this.showTracer(this.flashSprite.position, end);
    if (Game.audio) Game.audio.gunshot();
    // raycast against enemies — meshes only: the HP-bar Sprites above their
    // heads have no raycast without a camera, so they are excluded.
    this.raycaster.set(origin, direction);
    this.raycaster.far = CFG.PISTOL_RANGE;
    var meshes = [];
    this.enemies.forEach(function (e) {
      e.mesh.traverse(function (o) { if (o.isMesh) meshes.push(o); });
    });
    var hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      var hitObj = hits[0].object;
      var enemy = null;
      this.enemies.forEach(function (e) {
        if (e.mesh === hitObj || e.mesh.children.indexOf(hitObj) >= 0) enemy = e;
      });
      if (enemy) {
        enemy.hp -= CFG.PISTOL_DAMAGE;
        this.hitMarkerT = 0.25;
        drawHpBar(enemy.hpBar, enemy.hp / CFG.ENEMY_HP);
        if (Game.audio) Game.audio.hit();
        if (enemy.hp <= 0) this.killEnemy(enemy);
        return 'hit';
      }
    }
    return 'miss';
  };

  CombatSystem.prototype.reload = function () {
    if (this.reloadT > 0 || this.ammo >= CFG.PISTOL_MAG || this.reserve <= 0) return;
    this.reloadT = CFG.PISTOL_RELOAD_S;
    if (Game.audio) Game.audio.reload();
  };

  CombatSystem.prototype.spawnEnemies = function (positions) {
    var self = this;
    positions.forEach(function (p) {
      var mesh = buildEnemyMesh();
      mesh.position.set(p.x, 0, p.z);
      self.scene.add(mesh);
      var hpBar = makeHpBarSprite();
      hpBar.position.set(0, 2.35, 0);
      mesh.add(hpBar);
      drawHpBar(hpBar, 1);
      self.enemies.push({
        mesh: mesh, hpBar: hpBar, x: p.x, z: p.z,
        hp: CFG.ENEMY_HP, shootT: 1 + self.rng() * 1.5, phase: self.rng() * 6
      });
    });
  };

  CombatSystem.prototype.clearEnemies = function () {
    var self = this;
    this.enemies.forEach(function (e) { self.scene.remove(e.mesh); });
    this.enemies = [];
  };

  CombatSystem.prototype.enemiesAlive = function () {
    return this.enemies.length;
  };

  CombatSystem.prototype.killEnemy = function (enemy) {
    var i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    this.kills++;
    this.scene.remove(enemy.mesh);
    if (Game.audio) Game.audio.enemyDown();
    if (Game.hud) Game.hud.notify('Target down — ' + this.enemies.length + ' left', 'good');
  };

  // Enemies strafe toward the player and shoot back when in range.
  CombatSystem.prototype.update = function (dt, player) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        var need = CFG.PISTOL_MAG - this.ammo;
        var take = Math.min(need, this.reserve);
        this.ammo += take; this.reserve -= take;
      }
    }
    if (this.hitMarkerT > 0) this.hitMarkerT -= dt;
    if (!this.keepFlash && performance.now() > this.flashUntil) {
      this.flashSprite.visible = false;
      this.flashLight.intensity = 0;
    }
    if (!this.keepFlash && this.tracer.visible && performance.now() > this.tracerUntil) {
      this.tracer.visible = false;
    }
    var self = this;
    this.enemies.forEach(function (e) {
      var dx = player.x - e.x, dz = player.z - e.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      // close to ~14m, strafe slowly
      if (dist > 16) {
        e.x += dx / dist * 3.2 * dt;
        e.z += dz / dist * 3.2 * dt;
      } else if (dist < 8) {
        e.x -= dx / dist * 1.5 * dt;
        e.z -= dz / dist * 1.5 * dt;
      }
      e.phase += dt * 4;
      e.mesh.userData.legL.rotation.x = Math.sin(e.phase) * 0.4;
      e.mesh.userData.legR.rotation.x = -Math.sin(e.phase) * 0.4;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      // shoot back
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < CFG.ENEMY_RANGE) {
        e.shootT = CFG.ENEMY_SHOT_INTERVAL * (0.8 + self.rng() * 0.5);
        var hitChance = dist < 14 ? 0.45 : 0.25;
        if (self.rng() < hitChance) {
          if (player.damage(CFG.ENEMY_DAMAGE)) {
            if (Game.onPlayerWasted) Game.onPlayerWasted();
          } else if (Game.audio) Game.audio.playerHit();
        }
        // enemy muzzle flash
        self.flashSprite.position.set(e.x, 1.4, e.z);
        self.flashSprite.visible = true;
        self.flashLight.position.set(e.x, 1.4, e.z);
        self.flashLight.intensity = 2;
        self.flashUntil = performance.now() + 70;
        if (Game.audio) Game.audio.enemyShot(dist);
      }
    });
  };

  Game.CombatSystem = CombatSystem;
})();
