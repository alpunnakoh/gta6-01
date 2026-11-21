// SUNSET SHORES — collectibles.js
// RelicSystem: the Sunset Relics — ten golden idols hidden in the corners
// of Palmera Bay that the smuggler packages never reached: the port crane
// base, the lighthouse rocks, the end of the pier, a beach umbrella, the
// plaza, the safehouse garden, the garage forecourt, the bank steps, and
// two quiet sidewalks. Each one pays $250 on the spot, the fifth unlocks
// the rifle, and all ten pay a $2,000 bonus. A gold beacon marks every
// idol from across the street, the HUD counts them, and the minimap
// points at the nearest one still out there, so the hunt is a hunt —
// not a guessing game.
(function () {
  'use strict';
  var CFG = Game.CFG;

  // Fixed hiding spots: memorable places a player can learn, spread over
  // the whole map so the hunt takes Leo everywhere, including the new
  // Port North district.
  var RELIC_SPOTS = [
    { x: -60, z: -242, hint: 'port crane base' },
    { x: -134, z: 306, hint: 'lighthouse rocks' },
    { x: -108, z: 292, hint: 'end of the pier' },
    { x: 40, z: 254, hint: 'beach umbrella' },
    { x: 135, z: 135, hint: 'the plaza' },
    { x: -81, z: 62, hint: 'safehouse garden' },
    { x: 27, z: -100, hint: 'garage forecourt' },
    { x: 81, z: 66, hint: 'bank steps' },
    { x: -135, z: 81, hint: 'west sidewalk' },
    { x: 189, z: 27, hint: 'east sidewalk' }
  ];

  function buildRelicMesh() {
    var g = new THREE.Group();
    var gold = new THREE.MeshLambertMaterial({ color: 0xffd21f });
    var darkGold = new THREE.MeshLambertMaterial({ color: 0xb8860b });
    // the idol: a little golden figure on a plinth, arms raised to the sun
    var base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 1.0), darkGold);
    base.position.y = 0.18;
    var body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 6), gold);
    body.position.y = 0.9;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), gold);
    head.position.y = 1.65;
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), gold);
    armL.position.set(-0.4, 1.35, 0);
    armL.rotation.z = 0.7;
    var armR = armL.clone();
    armR.position.x = 0.4;
    armR.rotation.z = -0.7;
    // gold beacon: a thin light pillar so the idol reads from far away
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 13;
    var glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.18 }));
    glow.position.y = 1.0;
    g.add(base, body, head, armL, armR, beam, glow);
    g.userData = { body: body, glow: glow, beam: beam };
    return g;
  }

  function RelicSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng || Math.random;
    this.world = world || {};
    this.relics = [];
    this.found = 0;
    this.foundIds = {};
    this.total = CFG.RELIC_COUNT;
    this._spawnRelics();
  }

  RelicSystem.prototype._spawnRelics = function () {
    var self = this;
    RELIC_SPOTS.forEach(function (spot, i) {
      var mesh = buildRelicMesh();
      mesh.position.set(spot.x, 0, spot.z);
      self.scene.add(mesh);
      self.relics.push({
        id: i, mesh: mesh, x: spot.x, z: spot.z, hint: spot.hint,
        taken: false, phase: self.rng() * 6
      });
    });
  };

  RelicSystem.prototype.restore = function (foundIds) {
    var self = this;
    (foundIds || []).forEach(function (id) {
      var r = self.relics[id];
      if (r && !r.taken) {
        r.taken = true;
        self.scene.remove(r.mesh);
        self.foundIds[id] = true;
        self.found++;
      }
    });
    if (this.world.hud) this.world.hud.setRelics(this.found, this.total);
  };

  // The nearest relic still out there — the minimap points at it.
  RelicSystem.prototype.nearest = function () {
    var w = this.world;
    if (!w.player) return null;
    var best = null, bestD = 1e9;
    for (var i = 0; i < this.relics.length; i++) {
      var r = this.relics[i];
      if (r.taken) continue;
      var d = Game.dist2D(w.player.x, w.player.z, r.x, r.z);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best ? { x: best.x, z: best.z, dist: Math.round(bestD), hint: best.hint } : null;
  };

  RelicSystem.prototype.update = function (dt) {
    var w = this.world;
    // idols bob and spin; the beacon breathes
    for (var i = 0; i < this.relics.length; i++) {
      var r = this.relics[i];
      if (r.taken) continue;
      r.phase += dt * 1.6;
      r.mesh.userData.body.rotation.y += dt * 1.1;
      r.mesh.userData.body.position.y = 0.9 + Math.sin(r.phase) * 0.12;
      r.mesh.userData.glow.material.opacity = 0.14 + Math.sin(r.phase) * 0.07;
      r.mesh.userData.beam.material.opacity = 0.11 + Math.sin(r.phase * 0.7) * 0.05;
    }
    if (!w.player || w.player.inCar) return;
    // walk over an idol to collect it
    for (var j = 0; j < this.relics.length; j++) {
      var relic = this.relics[j];
      if (relic.taken) continue;
      if (Game.dist2D(w.player.x, w.player.z, relic.x, relic.z) < 2.4) {
        relic.taken = true;
        this.foundIds[relic.id] = true;
        this.found++;
        this.scene.remove(relic.mesh);
        if (w.onCash) w.onCash(CFG.RELIC_CASH);
        if (w.audio) w.audio.relicChime();
        if (w.player) w.player.heal(10);
        if (w.hud) {
          w.hud.setRelics(this.found, this.total);
          w.hud.notify('Sunset Relic found (' + relic.hint + ') — +$' + CFG.RELIC_CASH +
            '. ' + (this.total - this.found) + ' left.', 'good');
        }
        // fifth relic: the rifle unlocks. tenth: the big bonus.
        if (this.found === 5 && w.arsenal) w.arsenal.grantRifle();
        if (this.found === this.total) {
          if (w.onCash) w.onCash(CFG.RELIC_ALL_BONUS);
          if (w.hud) {
            w.hud.notify('ALL ' + this.total + ' RELICS — the set is complete! +$' +
              CFG.RELIC_ALL_BONUS + ' bonus.', 'mission');
            w.hud.centerMessage('RELIC HUNTER — SET COMPLETE', 3600);
          }
        }
        return;
      }
    }
  };

  Game.RelicSystem = RelicSystem;
})();
