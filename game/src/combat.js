// SUNSET SHORES — combat.js
// CombatSystem: Leo's weapons — a pistol (starting weapon) and a full-auto
// SMG found in crates around the city — with ammo, reload, muzzle flash,
// tracer lines, raycast shooting with hit markers, and armed NPC enemies
// (M4/M5) with HP bars who shoot back. F throws a punch up close: it knocks
// pedestrians down and hurts enemies. Enemies are simple low-poly figures
// with a red health bar sprite.
(function () {
  'use strict';
  var CFG = Game.CFG;

  var WEAPONS = {
    pistol: {
      name: 'PISTOL', damage: CFG.PISTOL_DAMAGE, mag: CFG.PISTOL_MAG,
      reloadS: CFG.PISTOL_RELOAD_S, range: CFG.PISTOL_RANGE,
      fireRate: CFG.PISTOL_FIRE_RATE, auto: false, pellets: 1
    },
    smg: {
      name: 'SMG', damage: CFG.SMG_DAMAGE, mag: CFG.SMG_MAG,
      reloadS: CFG.SMG_RELOAD_S, range: CFG.SMG_RANGE,
      fireRate: CFG.SMG_FIRE_RATE, auto: true, pellets: 1
    },
    shotgun: {
      name: 'SHOTGUN', damage: CFG.SHOTGUN_DAMAGE, mag: CFG.SHOTGUN_MAG,
      reloadS: CFG.SHOTGUN_RELOAD_S, range: CFG.SHOTGUN_RANGE,
      fireRate: CFG.SHOTGUN_FIRE_RATE, auto: false,
      pellets: CFG.SHOTGUN_PELLETS, spread: 0.07
    }
  };

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

  function buildEnemyMesh(kind) {
    var g = new THREE.Group();
    var rusher = kind === 'rusher';
    var shirt = new THREE.MeshLambertMaterial({ color: rusher ? 0xe86a1f : 0x8a1f1f });
    var pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
    legL.position.set(-0.13, 0.38, 0);
    var legR = legL.clone(); legR.position.x = 0.13;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), shirt);
    torso.position.y = 1.12;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.68;
    head.userData.isHead = true; // headshots deal double damage
    if (rusher) {
      // rushers carry no gun — they run at Leo and swing. Orange shirt,
      // and a knife glint in the hand so they read differently up close.
      var knife = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xcccccc }));
      knife.position.set(0.3, 1.2, 0.35);
      g.add(legL, legR, torso, head, knife);
    } else {
      var gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.3, 1.3, 0.35);
      g.add(legL, legR, torso, head, gun);
    }
    g.userData = { legL: legL, legR: legR };
    return g;
  }

  // A weapon crate: green for the SMG, red for the shotgun, with a glowing
  // ring. Walk over it to take the weapon and its ammo.
  function buildPickupMesh(kind) {
    var g = new THREE.Group();
    var crateCol = kind === 'shotgun' ? 0x5a2a2a : 0x2a5a2a;
    var lidCol = kind === 'shotgun' ? 0x7a3a3a : 0x3a7a3a;
    var ringCol = kind === 'shotgun' ? 0xff6b4a : 0x3ddc5a;
    var crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1),
      new THREE.MeshLambertMaterial({ color: crateCol }));
    crate.position.y = 0.35;
    var lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.2),
      new THREE.MeshLambertMaterial({ color: lidCol }));
    lid.position.y = 0.75;
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0, 1.05, 0);
    gun.rotation.y = 0.6;
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.07, 8, 24),
      new THREE.MeshBasicMaterial({ color: ringCol }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    g.add(crate, lid, gun, ring);
    g.userData = { ring: ring, gun: gun };
    return g;
  }

  function CombatSystem(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.weapon = 'pistol';
    this.hasSmg = false;
    this.hasShotgun = false;
    this.hasRifle = false;   // the v4 long gun — unlocked from crates or relics
    this.ammo = CFG.PISTOL_MAG;
    this.reserve = 60;
    this.smgAmmo = 0;      // reserve ammo for the SMG, kept separately
    this.shotgunAmmo = 0;  // reserve shells for the shotgun, kept separately
    this.rifleAmmo = 0;    // reserve rounds for the rifle, kept separately
    this.reloadT = 0;
    this.fireCooldown = 0;
    this.enemies = [];
    this.pickups = [];     // SMG crates {mesh, x, z, taken}
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
    this.spawnPickups();
  }

  CombatSystem.prototype.weaponDef = function () {
    return WEAPONS[this.weapon];
  };

  // Weapon crates at fixed, memorable spots: SMGs at the pier, the plaza
  // and the garage; shotguns at the bank and the safehouse.
  CombatSystem.prototype.spawnPickups = function () {
    var self = this;
    var spots = [
      { kind: 'smg', x: CFG.PIER_X + 6, z: CFG.BEACH_Z + 4 },
      { kind: 'smg', x: 81, z: 81 },
      { kind: 'smg', x: 54, z: -108 + 12 },
      { kind: 'shotgun', x: 81, z: 54 - 12 },
      { kind: 'shotgun', x: -81, z: 54 + 8 }
    ];
    spots.forEach(function (s) {
      var mesh = buildPickupMesh(s.kind);
      mesh.position.set(s.x, 0, s.z);
      self.scene.add(mesh);
      self.pickups.push({ mesh: mesh, x: s.x, z: s.z, kind: s.kind, taken: false, phase: self.rng() * 6 });
    });
  };

  // Walk over a crate to take it. Returns the pickup or null.
  CombatSystem.prototype.collectPickup = function (px, pz) {
    for (var i = 0; i < this.pickups.length; i++) {
      var pk = this.pickups[i];
      if (pk.taken) continue;
      if (Game.dist2D(px, pz, pk.x, pk.z) < 2.2) {
        pk.taken = true;
        this.scene.remove(pk.mesh);
        if (pk.kind === 'shotgun') {
          this.hasShotgun = true;
          this.shotgunAmmo += CFG.SHOTGUN_PICKUP_AMMO;
          this.switchWeapon('shotgun');
          if (Game.audio) Game.audio.pickup();
          if (Game.hud) Game.hud.notify('SHOTGUN picked up — 6 pellets a shell, close range only. Press Q to switch.', 'good');
        } else {
          this.hasSmg = true;
          this.smgAmmo += CFG.SMG_PICKUP_AMMO;
          this.switchWeapon('smg');
          if (Game.audio) Game.audio.pickup();
          if (Game.hud) Game.hud.notify('SMG picked up — hold click for full-auto. Press Q to switch.', 'good');
        }
        return pk;
      }
    }
    return null;
  };

  CombatSystem.prototype.reserveFor = function (name) {
    if (name === 'smg') return this.smgAmmo;
    if (name === 'shotgun') return this.shotgunAmmo;
    if (name === 'rifle') return this.rifleAmmo;
    return this.reserve;
  };

  CombatSystem.prototype.takeReserve = function (name, amount) {
    if (name === 'smg') this.smgAmmo -= amount;
    else if (name === 'shotgun') this.shotgunAmmo -= amount;
    else if (name === 'rifle') this.rifleAmmo -= amount;
    else this.reserve -= amount;
  };

  CombatSystem.prototype.stashReserve = function (name, amount) {
    if (name === 'smg') this.smgAmmo += amount;
    else if (name === 'shotgun') this.shotgunAmmo += amount;
    else if (name === 'rifle') this.rifleAmmo += amount;
    else this.reserve += amount;
  };

  CombatSystem.prototype.switchWeapon = function (name) {
    if (name === 'smg' && !this.hasSmg) return false;
    if (name === 'shotgun' && !this.hasShotgun) return false;
    if (name === 'rifle' && !this.hasRifle) return false;
    if (!WEAPONS[name]) return false;
    if (this.weapon === name) return true;
    // stash the current magazine's ammo in the right reserve first
    this.stashReserve(this.weapon, this.ammo);
    this.weapon = name;
    this.reloadT = 0;
    var w = WEAPONS[name];
    this.ammo = Math.min(w.mag, this.reserveFor(name));
    this.takeReserve(name, this.ammo);
    if (Game.hud) Game.hud.setWeapon(w.name, this.ammo, this.reserveFor(name));
    return true;
  };

  CombatSystem.prototype.cycleWeapon = function () {
    var order = ['pistol'];
    if (this.hasSmg) order.push('smg');
    if (this.hasShotgun) order.push('shotgun');
    if (this.hasRifle) order.push('rifle');
    var i = order.indexOf(this.weapon);
    return this.switchWeapon(order[(i + 1) % order.length]);
  };

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

  // One ray against the enemies. Returns 'hit' (with headshot doubling) or
  // 'miss'. The shotgun calls it once per pellet with a spread direction.
  CombatSystem.prototype._fireRay = function (origin, direction, damage, range) {
    var w = this.weaponDef();
    this.raycaster.set(origin, direction);
    this.raycaster.far = range || w.range;
    var meshes = [];
    this.enemies.forEach(function (e) {
      e.mesh.traverse(function (o) { if (o.isMesh) meshes.push(o); });
    });
    var hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return 'miss';
    var hitObj = hits[0].object;
    var enemy = null;
    this.enemies.forEach(function (e) {
      if (e.mesh === hitObj || e.mesh.children.indexOf(hitObj) >= 0) enemy = e;
    });
    if (!enemy) return 'miss';
    var headshot = hitObj.userData && hitObj.userData.isHead;
    var dealt = headshot ? damage * 2 : damage;
    enemy.hp -= dealt;
    this.hitMarkerT = 0.25;
    drawHpBar(enemy.hpBar, enemy.hp / CFG.ENEMY_HP);
    if (Game.audio) Game.audio.hit();
    if (headshot && Game.hud) Game.hud.notify('HEADSHOT — double damage.', 'good');
    if (enemy.hp <= 0) this.killEnemy(enemy);
    return 'hit';
  };

  // Fire from the player toward the camera aim point. Returns 'hit'|'miss'|'empty'.
  CombatSystem.prototype.shoot = function (origin, direction) {
    if (this.reloadT > 0 || this.fireCooldown > 0) return 'wait';
    var w = this.weaponDef();
    if (this.ammo <= 0) {
      if (Game.audio) Game.audio.clickEmpty();
      this.reload();
      return 'empty';
    }
    this.ammo--;
    this.fireCooldown = w.fireRate;
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
    if (Game.audio) {
      if (this.weapon === 'smg') Game.audio.smgShot();
      else if (this.weapon === 'shotgun') Game.audio.shotgunBlast();
      else if (this.weapon === 'rifle') Game.audio.rifleShot();
      else Game.audio.gunshot();
    }
    // raycast against enemies — meshes only: the HP-bar Sprites above their
    // heads have no raycast without a camera, so they are excluded.
    var result = 'miss';
    for (var p = 0; p < (w.pellets || 1); p++) {
      var dir = direction.clone();
      if (w.spread) {
        dir.x += (this.rng() - 0.5) * w.spread * 2;
        dir.y += (this.rng() - 0.5) * w.spread;
        dir.normalize();
      }
      if (this._fireRay(origin, dir, w.damage, w.range) === 'hit') result = 'hit';
    }
    return result;
  };

  // A punch: anything in front of Leo inside range and arc takes damage.
  // Pedestrians get knocked down and flee; enemies take the hit.
  // Returns 'ped' when a pedestrian was hit, 'enemy' for an enemy, 'miss'.
  CombatSystem.prototype.punch = function (player, peds, enemies) {
    var fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    var hitWhat = 'miss';
    var self = this;
    (enemies || []).forEach(function (e) {
      var dx = e.x - player.x, dz = e.z - player.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      if (d > CFG.PUNCH_RANGE) return;
      var dot = (dx * fx + dz * fz) / d;
      if (dot < Math.cos(CFG.PUNCH_ARC)) return;
      e.hp -= CFG.PUNCH_DAMAGE;
      drawHpBar(e.hpBar, e.hp / CFG.ENEMY_HP);
      self.hitMarkerT = 0.25;
      if (e.hp <= 0) self.killEnemy(e);
      hitWhat = 'enemy';
    });
    (peds || []).forEach(function (p) {
      var dx = p.x - player.x, dz = p.z - player.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      if (d > CFG.PUNCH_RANGE) return;
      var dot = (dx * fx + dz * fz) / d;
      if (dot < Math.cos(CFG.PUNCH_ARC)) return;
      // knocked flat: shoved away and sent running
      p.x += dx / d * 2.5;
      p.z += dz / d * 2.5;
      p.mesh.position.set(p.x, 0, p.z);
      p.fleeT = 3;
      p.fleeX = player.x; p.fleeZ = player.z;
      hitWhat = 'ped';
    });
    if (hitWhat !== 'miss' && Game.audio) Game.audio.punch();
    return hitWhat;
  };

  CombatSystem.prototype.reload = function () {
    var w = this.weaponDef();
    if (this.reloadT > 0 || this.ammo >= w.mag) return;
    if (this.reserveFor(this.weapon) <= 0) return;
    this.reloadT = w.reloadS;
    if (Game.audio) Game.audio.reload();
  };

  // positions: [{x,z}]; kinds (optional): 'gunman' or 'rusher' per slot.
  // Rushers (orange shirts, no gun) charge Leo and swing a knife up close;
  // one in four spawns is a rusher unless kinds say otherwise.
  CombatSystem.prototype.spawnEnemies = function (positions, kinds) {
    var self = this;
    positions.forEach(function (p, i) {
      var kind = (kinds && kinds[i]) || (self.rng() < 0.25 ? 'rusher' : 'gunman');
      var mesh = buildEnemyMesh(kind);
      mesh.position.set(p.x, 0, p.z);
      self.scene.add(mesh);
      var hpBar = makeHpBarSprite();
      hpBar.position.set(0, 2.35, 0);
      mesh.add(hpBar);
      drawHpBar(hpBar, 1);
      self.enemies.push({
        mesh: mesh, hpBar: hpBar, x: p.x, z: p.z, kind: kind,
        hp: CFG.ENEMY_HP, shootT: 1 + self.rng() * 1.5, phase: self.rng() * 6,
        swingT: 0
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
        var w = this.weaponDef();
        var need = w.mag - this.ammo;
        var take = Math.min(need, this.reserveFor(this.weapon));
        this.ammo += take;
        this.takeReserve(this.weapon, take);
        if (Game.hud) Game.hud.setWeapon(w.name, this.ammo, this.reserveFor(this.weapon));
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
    // pickups bob and spin so they catch the eye from down the street
    this.pickups.forEach(function (pk) {
      if (pk.taken) return;
      pk.phase += dt * 2;
      pk.mesh.userData.ring.rotation.z += dt * 1.5;
      pk.mesh.userData.gun.position.y = 1.05 + Math.sin(pk.phase) * 0.12;
      pk.mesh.userData.gun.rotation.y += dt * 0.8;
    });
    var self = this;
    this.enemies.forEach(function (e) {
      var dx = player.x - e.x, dz = player.z - e.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      if (e.kind === 'rusher') {
        // rushers run Leo down and swing a knife up close — no gun, no range
        e.swingT -= dt;
        e.x += dx / dist * 6.5 * dt;
        e.z += dz / dist * 6.5 * dt;
        if (dist < 1.8 && e.swingT <= 0) {
          e.swingT = 1.0;
          if (Game.audio) Game.audio.swipe();
          if (player.damage(12)) {
            if (Game.onPlayerWasted) Game.onPlayerWasted();
          } else {
            if (Game.audio) Game.audio.playerHit();
            if (Game.hud) Game.hud.flashDamage();
          }
        }
      } else if (dist > 16) {
        // close to ~14m, strafe slowly
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
      // shoot back (gunmen only — rushers swing instead)
      e.shootT -= dt;
      if (e.kind !== 'rusher' && e.shootT <= 0 && dist < CFG.ENEMY_RANGE) {
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
  Game.WEAPONS = WEAPONS;
})();
