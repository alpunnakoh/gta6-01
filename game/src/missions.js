// SUNSET SHORES — missions.js
// MissionSystem: "The Palmera Job" — 6 story missions for Leo Marin, played
// in order, each with staged objectives, a yellow 3D marker + light beacon,
// a big intro card, and a cash reward. Between missions the player
// free-roams; J starts the next job. Stage types: enterCar, driveTo,
// pickup, timed, shootout, hold, escape.
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
    },
    {
      id: 'M6', name: 'The Last Sunset',
      briefing: 'The whole bay is looking for Leo now. One boat, one sunset, no looking back.',
      reward: 8000,
      stages: [
        { type: 'driveTo', text: 'Get to the pier', markerAt: 'pier' },
        { type: 'hold', text: 'Untie the boat — stay in the marker', holdS: 4 },
        { type: 'escape', text: 'Reach the boat and vanish', markerAt: 'boat', wanted: 4 }
      ]
    },
    {
      // Act two — the crew job. M6 was Leo alone; M7 brings the crew in.
      // Maya drives, Doc cracks, Slim watches — and Leo does the running.
      id: 'M7', name: 'The Setup',
      briefing: 'The crew is waiting at Port North. Maya, Doc and Slim — and a job that needs four people.',
      reward: 2500,
      stages: [
        { type: 'driveTo', text: 'Drive to Port North and meet the crew', markerAt: 'port' },
        { type: 'pickup', text: 'Pick up Doc at the port yard' },
        { type: 'timed', text: 'Scout the bank — get there in time', markerAt: 'bank', time: 60 },
        { type: 'hold', text: 'Hold the lookout post — stay in the marker', holdS: 4 }
      ]
    },
    {
      // The finale: the vault again, but bigger — five guards, a six-second
      // crack, three duffels on the floor, and a five-star run to the boat
      // past the lighthouse. Finish this and the Palmera Job is done.
      id: 'M8', name: 'The Sunset Heist',
      briefing: 'The vault. The whole crew. Five stars on the way out. This is the one they will tell stories about.',
      reward: 15000,
      stages: [
        { type: 'driveTo', text: 'Get to the bank — the crew is in place', markerAt: 'bank' },
        { type: 'shootout', text: 'Take down the vault guards (5)', enemies: 5 },
        { type: 'hold', text: 'Crack the vault — stay in the marker', holdS: 6 },
        { type: 'escape', text: 'Escape to the boat — 5 stars on your tail', markerAt: 'boat', wanted: 5 }
      ]
    }
  ];

  // Fixed story places on the map. The marker sits on the street outside
  // each landmark (never inside the building's collider), so the player can
  // always reach it: garage on Marina Row, bank front, safehouse street,
  // pier deck, and the boat past the pier's end.
  var PLACES = {
    garage: { x: 27, z: -108 },
    bank: { x: 81, z: 54 },
    pier: { x: CFG.PIER_X, z: CFG.BEACH_Z + 4 },
    boat: { x: CFG.PIER_X, z: CFG.PIER_END_Z + 6 },
    safehouse: { x: -81, z: 54 },
    // Port North yard, where the M7 crew waits by the containers.
    port: { x: 0, z: -260 }
  };

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
    if (this.world.hud) {
      this.world.hud.notify('NEW JOB: ' + def.name + ' — ' + def.briefing, 'mission');
      this.world.hud.centerMessage(def.id + ' — ' + def.name, 2600);
    }
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

  // Each stage type has two handlers: one that sets the stage up when it
  // starts (targets, timers, spawns) and one that checks, every frame,
  // whether the stage is done. Adding a stage type means adding one entry
  // here — enterStage/update never grow a new if-chain again.
  var STAGE_SETUP = {
    enterCar: function (m) { m.clearTarget(); },
    driveTo: function (m, st) { m._setDriveTarget(st); },
    escape: function (m, st) { m._setDriveTarget(st); },
    timed: function (m, st) {
      m._setDriveTarget(st);
      if (st.time) m.timer = st.time;
    },
    pickup: function (m) {
      var pp = m.roadTarget();
      m.setTarget(pp.x, pp.z);
      m.spawnPassenger(pp.x, pp.z);
    },
    shootout: function (m, st) {
      m.clearTarget();
      var n = st.enemies || 4;
      var spots = [];
      for (var i = 0; i < n; i++) {
        spots.push({ x: m.world.player.x + (m.rng() - 0.5) * 36, z: m.world.player.z + (m.rng() - 0.5) * 36 });
      }
      m.world.combat.spawnEnemies(spots);
      m.killsAtEntry = m.world.combat.kills;
    },
    hold: function (m) {
      var hp = m.roadTarget();
      // M5 cracks the vault at the bank, M6 unties the boat at the pier,
      // M7 holds the lookout post by the bank, M8 cracks the vault again
      if (m.active.def.id === 'M5') hp = PLACES.bank;
      if (m.active.def.id === 'M6') hp = PLACES.pier;
      if (m.active.def.id === 'M7') hp = PLACES.bank;
      if (m.active.def.id === 'M8') hp = PLACES.bank;
      m.setTarget(hp.x, hp.z);
    }
  };

  var STAGE_DONE = {
    enterCar: function (m) { return !!m.world.player.inCar; },
    driveTo: function (m) { return m._nearTarget(7); },
    escape: function (m) { return m._nearTarget(7); },
    pickup: function (m) {
      if (!m._nearTarget(6)) return false;
      m.removePassenger();
      // M2 picks up Ray; M7 picks up Doc from the port crew
      var who = (m.active.def.id === 'M7') ? 'Doc' : 'Ray';
      if (m.world.hud) m.world.hud.notify(who + ' is in the car. Go!', 'good');
      return true;
    },
    timed: function (m) {
      if (m.timer <= 0) { m.failMission('out of time'); return 'failed'; }
      return m._nearTarget(7);
    },
    shootout: function (m, st) {
      return (m.world.combat.kills - (m.killsAtEntry || 0)) >= (st.enemies || 4);
    },
    hold: function (m, st) {
      if (m._nearTarget(6)) {
        m.holdT += m._lastDt;
        return m.holdT > st.holdS;
      }
      m.holdT = 0;
      return false;
    }
  };

  MissionSystem.prototype._setDriveTarget = function (st) {
    var p;
    if (st.markerAt && PLACES[st.markerAt]) p = PLACES[st.markerAt];
    else if (st.type === 'escape' && this.active.def.id === 'M5') p = { x: -54, z: 252 }; // beach boat
    else if (st.type === 'escape' && this.active.def.id === 'M2') p = PLACES.safehouse;
    else p = this.roadTarget();
    this.setTarget(p.x, p.z);
    if (st.wanted) this.world.wanted.addCrime(st.wanted, 'the job went loud');
  };

  MissionSystem.prototype._nearTarget = function (radius) {
    if (!this.target) return false;
    return Game.dist2D(this.world.player.x, this.world.player.z, this.target.x, this.target.z) < radius;
  };

  MissionSystem.prototype.enterStage = function () {
    var st = this.currentStage();
    if (!st) { this.finishMission(); return; }
    this.holdT = 0;
    var setup = STAGE_SETUP[st.type];
    if (setup) setup(this, st);
    if (this.world.hud) this.world.hud.setObjective(this.objectiveText());
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
    // clean getaway: finish a job without ever raising the heat and Leo
    // pockets a bonus — the PD never even knew he was there. The cash is
    // added by the caller through onMissionComplete(def, cleanBonus).
    var cleanBonus = (this.world.wanted && this.world.wanted.stars === 0)
      ? CFG.CLEAN_BONUS : 0;
    if (this.world.onMissionComplete) this.world.onMissionComplete(def, cleanBonus);
    if (this.world.hud) {
      if (cleanBonus > 0) {
        this.world.hud.notify('CLEAN GETAWAY — no stars, no witnesses: +$' + cleanBonus, 'good');
      }
      this.world.hud.notify('JOB DONE: ' + def.name + ' — +$' + def.reward,
        this.completedAll ? 'mission' : 'good');
      if (this.completedAll) {
        this.world.hud.centerMessage('THE PALMERA JOB — COMPLETE', 4000);
      }
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
    var stageNo = (this.active.stage + 1) + '/' + this.active.def.stages.length;
    var txt = this.active.def.name + ' [' + stageNo + ']: ' + st.text;
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
    this._lastDt = dt;
    var st = this.currentStage();
    if (st.type === 'timed') this.timer -= dt;
    var done = STAGE_DONE[st.type];
    var result = done ? done(this, st) : false;
    if (result === 'failed') return; // failMission already ran
    if (result) this.advanceStage();
    if (this.world.hud) this.world.hud.setObjective(this.objectiveText());
  };

  MissionSystem.DEFS = MISSION_DEFS;
  MissionSystem.PLACES = PLACES;
  Game.MissionSystem = MissionSystem;
})();
