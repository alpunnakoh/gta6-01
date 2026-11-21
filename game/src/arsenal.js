// SUNSET SHORES — arsenal.js
// ArsenalSystem: the long gun. The rifle is Palmera Bay's fourth weapon —
// slow, heavy, and the only thing that out-ranges the vault guards'
// pistols: 55 damage a shot, a 140-metre reach, an 8-round magazine and a
// long reload that punishes a miss. Two purple crates hide it, one in the
// Port North yard and one by the lighthouse rocks, and finding all ten
// Sunset Relics unlocks it too. The weapon definition is registered into
// the combat system's table, so switching, ammo and the HUD all work the
// way the pistol, SMG and shotgun already do.
(function () {
  'use strict';
  var CFG = Game.CFG;

  // Register the rifle in the shared weapon table. combat.js owns the
  // table; this file only adds its own entry, after combat.js has loaded.
  if (Game.WEAPONS && !Game.WEAPONS.rifle) {
    Game.WEAPONS.rifle = {
      name: 'RIFLE', damage: CFG.RIFLE_DAMAGE, mag: CFG.RIFLE_MAG,
      reloadS: CFG.RIFLE_RELOAD_S, range: CFG.RIFLE_RANGE,
      fireRate: CFG.RIFLE_FIRE_RATE, auto: false, pellets: 1, spread: 0.01
    };
  }

  var CRATE_SPOTS = [
    { x: -60, z: -250 },   // Port North yard, by the containers
    { x: -134, z: 300 }    // lighthouse rocks, past the pier
  ];

  function buildRifleCrate() {
    var g = new THREE.Group();
    var crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x3a2a5a }));
    crate.position.y = 0.35;
    var lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x5a3a7a }));
    lid.position.y = 0.75;
    // the rifle itself, lying across the lid: long barrel, scope, stock
    var barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barrel.position.set(0, 0.95, 0.1);
    var scope = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    scope.position.set(0, 1.05, -0.1);
    var stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x4a2f1a }));
    stock.position.set(0, 0.92, -0.45);
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.07, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x9a6bff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    g.add(crate, lid, barrel, scope, stock, ring);
    g.userData = { ring: ring, barrel: barrel };
    return g;
  }

  function ArsenalSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng || Math.random;
    this.world = world || {};
    this.crates = [];
    this._spawnCrates();
  }

  ArsenalSystem.prototype._spawnCrates = function () {
    var self = this;
    CRATE_SPOTS.forEach(function (s) {
      var mesh = buildRifleCrate();
      mesh.position.set(s.x, 0, s.z);
      self.scene.add(mesh);
      self.crates.push({
        mesh: mesh, x: s.x, z: s.z, taken: false, phase: self.rng() * 6
      });
    });
  };

  // Hand Leo the rifle from outside (the relic hunt unlocks it this way):
  // flag it owned, top the reserve up, and switch to it on the spot.
  ArsenalSystem.prototype.grantRifle = function () {
    var c = this.world.combat;
    if (!c) return false;
    if (!c.hasRifle) {
      c.hasRifle = true;
      c.rifleAmmo = (c.rifleAmmo || 0) + CFG.RIFLE_PICKUP_AMMO;
      c.switchWeapon('rifle');
      if (this.world.audio) this.world.audio.pickup();
      if (this.world.hud) {
        this.world.hud.notify('RIFLE unlocked — long range, heavy hits. Press 4 to switch.', 'good');
      }
      return true;
    }
    c.rifleAmmo = (c.rifleAmmo || 0) + CFG.RIFLE_PICKUP_AMMO;
    return true;
  };

  ArsenalSystem.prototype.restore = function (saved) {
    if (!saved) return;
    var c = this.world.combat;
    if (!c) return;
    if (saved.has) {
      c.hasRifle = true;
      c.rifleAmmo = saved.ammo || 0;
    }
    (saved.crates || []).forEach(function (i) {
      var crate = this.crates[i];
      if (crate && !crate.taken) {
        crate.taken = true;
        this.scene.remove(crate.mesh);
      }
    }, this);
  };

  ArsenalSystem.prototype.update = function (dt) {
    var w = this.world;
    // crates bob and spin so they catch the eye from down the street
    for (var i = 0; i < this.crates.length; i++) {
      var pk = this.crates[i];
      if (pk.taken) continue;
      pk.phase += dt * 2;
      pk.mesh.userData.ring.rotation.z += dt * 1.5;
      pk.mesh.userData.barrel.position.y = 0.95 + Math.sin(pk.phase) * 0.1;
      pk.mesh.userData.barrel.rotation.y += dt * 0.8;
    }
    // walk over a crate to take the rifle
    if (!w.player || w.player.inCar) return;
    for (var j = 0; j < this.crates.length; j++) {
      var crate = this.crates[j];
      if (crate.taken) continue;
      if (Game.dist2D(w.player.x, w.player.z, crate.x, crate.z) < 2.2) {
        crate.taken = true;
        this.scene.remove(crate.mesh);
        var c = w.combat;
        if (c) {
          c.hasRifle = true;
          c.rifleAmmo = (c.rifleAmmo || 0) + CFG.RIFLE_PICKUP_AMMO;
          c.switchWeapon('rifle');
        }
        if (w.audio) w.audio.pickup();
        if (w.hud) {
          w.hud.notify('RIFLE picked up — 55 damage, 140m range. Press 4 to switch.', 'good');
        }
        return;
      }
    }
  };

  Game.ArsenalSystem = ArsenalSystem;
})();
