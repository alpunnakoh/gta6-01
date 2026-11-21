// SUNSET SHORES — missions.js
// MissionSystem: "The Palmera Job" — 5 story missions for Leo Marin, played in
// order, each with staged objectives, a yellow 3D marker + light beacon, and a
// cash reward. Between missions the player free-roams; J starts the next job.
// Stage types: enterCar, driveTo, pickup, timed, shootout, hold, escape.
(function () {
  'use strict';
  var CFG = Game.CFG;

  var MISSION_DEFS = [
    {
      id: 'M1', name: 'First Wheels',
      briefing: 'Leo needs wheels. Steal a car and bring it to the garage on Marina Row.',
      reward: 500,
      stages: [
        { type: 'enterCar', text: 'Steal a car — walk up to any car and press E' },
        { type: 'driveTo', text: 'Drive to the garage', markerAt: 'garage' }
      ]
    },
    {
      id: 'M2', name: 'The Pickup',
      briefing: 'A friend of a friend needs a ride — and the cops are already looking.',
      reward: 800,
      stages: [
        { type: 'pickup', text: 'Pick up Ray at the pier' },
        { type: 'escape', text: 'Lose the heat — get Ray to the safehouse', wanted: 2 }
      ]
    },
    {
      id: 'M3', name: 'Getaway',
      briefing: 'Three drops, one clock. Leo has 95 seconds to hit every checkpoint.',
      reward: 1200,
      stages: [
        { type: 'timed', text: 'Checkpoint 1 of 3', time: 95 },
        { type: 'timed', text: 'Checkpoint 2 of 3' },
        { type: 'timed', text: 'Checkpoint 3 of 3 — finish the run' }
      ]
    },
    {
      id: 'M4', name: 'Deal Gone Wrong',
      briefing: 'The buyer brought friends with guns. Leo did not bring friends.',
      reward: 2000,
      stages: [
        { type: 'driveTo', text: 'Go to the alley behind the market' },
        { type: 'shootout', text: 'Take down the crew (4)', enemies: 4 }
      ]
    },
    {
      id: 'M5', name: 'The Big Score',
      briefing: 'One last job: the Palmera Bay vault. Grab the cash and vanish down the beach.',
      reward: 5000,
      stages: [
        { type: 'driveTo', text: 'Get to the bank' },
        { type: 'hold', text: 'Crack the vault — stay in the marker', holdS: 3 },
        { type: 'escape', text: 'Escape to the boat at the beach', wanted: 4 }
      ]
    }
  ];

  function MissionSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng;
    this.world = world; // {player, combat, wanted, police, hud, audio}
    this.index = 0;     // next mission to play
    this.active = null; // {def, stage}
    this.target = null; // {x, z}
    this.timer = 0;
    this.holdT = 0;
    this.passenger = null; // NPC mesh for M2 pickup
    this.completedAll = false;
    // marker: glowing cylinder + light pillar + floating diamond
    this.marker = new THREE.Group();
    var ring = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.35, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.55 }));
    ring.position.y = 0.2;
    var pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.6, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.y = 21;
    var diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4),
      new THREE.MeshBasicMaterial({ color: 0xffe95e }));
    diamond.position.y = 9;
    this.marker.add(ring, pillar, diamond);
    this.marker.userData.diamond = diamond;
    this.marker.visible = false;
    scene.add(this.marker);
  }

  MissionSystem.prototype.setTarget = function (x, z) {
    this.target = { x: x, z: z };
    this.marker.position.set(x, 0, z);
    this.marker.visible = true;
  };

  MissionSystem.prototype.clearTarget = function () {
    this.target = null;
    this.marker.visible = false;
  };

  MissionSystem.prototype.roadTarget = function () {
    var p = Game.city.randomRoadPoint(this.rng);
    return p;
  };

  MissionSystem.prototype.startMission = function (i) {
    var def = MISSION_DEFS[i];
    if (!def) return false;
    this.index = i;
    this.active = { def: def, stage: 0 };
    this.timer = 0; this.holdT = 0;
    if (this.world.hud) this.world.hud.notify('NEW JOB: ' + def.name + ' — ' + def.briefing, 'mission');
    if (this.world.audio) this.world.audio.missionChime();
    this.enterStage();
    return true;
  };

  MissionSystem.prototype.startNext = function () {
    if (this.completedAll) return false;
    if (this.active) return false;
    return this.startMission(this.index);
  };

  MissionSystem.prototype.currentStage = function () {
    if (!this.active) return null;
    return this.active.def.stages[this.active.stage];
  };

  MissionSystem.prototype.enterStage = function () {
    var st = this.currentStage();
    if (!st) { this.finishMission(); return; }
    var w = this.world;
    this.holdT = 0;
    if (st.type === 'driveTo' || st.type === 'timed' || st.type === 'escape') {
      var p;
      if (st.markerAt === 'garage') p = { x: 54, z: -108 };
      else if (st.type === 'escape' && this.active.def.id === 'M5') p = { x: -54, z: 252 }; // beach boat
      else p = this.roadTarget();
      this.setTarget(p.x, p.z);
      if (st.type === 'timed' && st.time) this.timer = st.time;
      if (st.wanted) w.wanted.addCrime(st.wanted, 'the job went loud');
    } else if (st.type === 'pickup') {
      var pp = this.roadTarget();
      this.setTarget(pp.x, pp.z);
      this.spawnPassenger(pp.x, pp.z);
    } else if (st.type === 'shootout') {
      this.clearTarget();
      var n = st.enemies || 4;
      var spots = [];
      for (var i = 0; i < n; i++) {
        spots.push({ x: w.player.x + (this.rng() - 0.5) * 36, z: w.player.z + (this.rng() - 0.5) * 36 });
      }
      w.combat.spawnEnemies(spots);
      this.killsAtEntry = w.combat.kills;
    } else if (st.type === 'hold') {
      var hp = this.roadTarget();
      this.setTarget(hp.x, hp.z);
    } else if (st.type === 'enterCar') {
      this.clearTarget();
    }
    if (w.hud) w.hud.setObjective(this.objectiveText());
  };

  MissionSystem.prototype.spawnPassenger = function (x, z) {
    if (this.passenger) this.scene.remove(this.passenger);
    var g = new THREE.Group();
    var shirt = new THREE.MeshLambertMaterial({ color: 0xe86a6a });
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), shirt);
    torso.position.y = 1.1;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
    head.position.y = 1.65;
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    legs.position.y = 0.38;
    g.add(torso, head, legs);
    g.position.set(x + 3, 0, z + 3);
    this.scene.add(g);
    this.passenger = g;
  };

  MissionSystem.prototype.removePassenger = function () {
    if (this.passenger) { this.scene.remove(this.passenger); this.passenger = null; }
  };

  MissionSystem.prototype.advanceStage = function () {
    var st = this.currentStage();
    if (this.world.hud) this.world.hud.notify('Objective complete', 'good');
    if (this.world.audio) this.world.audio.missionChime();
    this.active.stage++;
    if (this.active.stage >= this.active.def.stages.length) this.finishMission();
    else this.enterStage();
  };

  MissionSystem.prototype.finishMission = function () {
    var def = this.active.def;
    this.clearTarget();
    this.removePassenger();
    this.active = null;
    this.index++;
    if (this.index >= MISSION_DEFS.length) this.completedAll = true;
    if (this.world.onMissionComplete) this.world.onMissionComplete(def);
    if (this.world.hud) {
      this.world.hud.notify('JOB DONE: ' + def.name + ' — +$' + def.reward,
        this.completedAll ? 'mission' : 'good');
      this.world.hud.setObjective(this.completedAll ?
        'The Palmera Job is complete. Free roam — Palmera Bay is yours.' :
        'Job complete. Press J to start the next job: ' + MISSION_DEFS[this.index].name);
    }
  };

  MissionSystem.prototype.failMission = function (reason) {
    var def = this.active.def;
    this.clearTarget();
    this.removePassenger();
    if (this.world.combat) this.world.combat.clearEnemies();
    this.active = null;
    if (this.world.hud) this.world.hud.notify('JOB FAILED: ' + reason + ' — press J to retry ' + def.name, 'bad');
  };

  MissionSystem.prototype.objectiveText = function () {
    if (!this.active) {
      if (this.completedAll) return 'The Palmera Job — COMPLETE. Free roam.';
      return 'Free roam — press J to start: ' + MISSION_DEFS[this.index].name;
    }
    var st = this.currentStage();
    var txt = this.active.def.name + ': ' + st.text;
    if (this.target) {
      var d = Math.round(Game.dist2D(this.world.player.x, this.world.player.z, this.target.x, this.target.z));
      txt += '  (' + d + 'm)';
    }
    if (st.type === 'timed' && this.timer > 0) txt += '  — ' + Math.ceil(this.timer) + 's';
    if (st.type === 'shootout') txt += '  — ' + this.world.combat.enemiesAlive() + ' left';
    return txt;
  };

  MissionSystem.prototype.update = function (dt) {
    // animate the marker
    if (this.marker.visible) {
      this.marker.userData.diamond.rotation.y += dt * 2;
      this.marker.userData.diamond.position.y = 9 + Math.sin(performance.now() * 0.003) * 0.8;
    }
    if (!this.active) return;
    var st = this.currentStage();
    var w = this.world;
    var px = w.player.x, pz = w.player.z;
    if (st.type === 'enterCar') {
      if (w.player.inCar) this.advanceStage();
    } else if (st.type === 'driveTo' || st.type === 'escape') {
      if (this.target && Game.dist2D(px, pz, this.target.x, this.target.z) < 7) this.advanceStage();
    } else if (st.type === 'pickup') {
      if (this.target && Game.dist2D(px, pz, this.target.x, this.target.z) < 6) {
        this.removePassenger();
        if (w.hud) w.hud.notify('Ray is in the car. Go!', 'good');
        this.advanceStage();
      }
    } else if (st.type === 'timed') {
      this.timer -= dt;
      if (this.timer <= 0) { this.failMission('out of time'); return; }
      if (this.target && Game.dist2D(px, pz, this.target.x, this.target.z) < 7) this.advanceStage();
    } else if (st.type === 'shootout') {
      // kills counted from stage entry — clearing enemies (respawn) must not
      // complete the stage by itself
      if (w.combat.kills - (this.killsAtEntry || 0) >= (st.enemies || 4)) this.advanceStage();
    } else if (st.type === 'hold') {
      if (this.target && Game.dist2D(px, pz, this.target.x, this.target.z) < 6) {
        this.holdT += dt;
        if (this.holdT > st.holdS) this.advanceStage();
      } else this.holdT = 0;
    }
    if (w.hud) w.hud.setObjective(this.objectiveText());
  };

  MissionSystem.DEFS = MISSION_DEFS;
  Game.MissionSystem = MissionSystem;
})();
