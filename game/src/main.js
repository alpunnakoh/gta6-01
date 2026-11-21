// SUNSET SHORES — main.js
// Game bootstrap: renderer/scene/loop, input (keyboard + mouse orbit), game
// states (menu / playing / paused / busted / wasted), car enter/exit, crime
// detection (stolen cars, hit pedestrians), save/load, the in-game clock,
// and the #debug status line used for automated validation.
(function () {
  'use strict';
  var CFG = Game.CFG;

  function params() {
    var q = new URLSearchParams(window.location.search);
    return {
      seed: parseInt(q.get('seed') || '1', 10) || 1,
      shot: q.get('shot') || ''
    };
  }

  function GameApp() {
    var p = params();
    this.seed = p.seed;
    this.shot = p.shot;
    this.state = 'menu'; // menu | playing | paused | busted | wasted
    this.cash = 0;
    this.hour = CFG.START_HOUR;
    this.parkedCars = [];
    this.dragging = false;
    this.lastMouseX = 0; this.lastMouseY = 0;
    this.movedMouse = 0;
    this.driveCamOffset = 0;
    this.saveT = 0;
    this.mapT = 0;
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsT = 0;
    this.keys = {};
    this._initThree();
    this._initSystems();
    this._initInput();
    this._initMenus();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    // staged screenshot? apply it once the first frame exists
    if (this.shot) {
      var self = this;
      setTimeout(function () {
        try { Game.ShotStaging.apply(self.shot, self); } catch (e) { self._showError(e); }
      }, 350);
    }
  }

  GameApp.prototype._initThree = function () {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('game').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(-40, 60, 200);
    this.camera.lookAt(0, 10, 0);
    var self = this;
    window.addEventListener('resize', function () {
      self.camera.aspect = window.innerWidth / window.innerHeight;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  };

  GameApp.prototype._initSystems = function () {
    var rng = Game.rng(this.seed);
    this.rng = rng;
    Game.buildCity(this.scene, this.seed);
    this.player = new Game.PlayerController(this.scene);
    this.player.reset(0, 8);
    this.traffic = new Game.TrafficSystem(this.scene, rng);
    this.peds = new Game.PedestrianSystem(this.scene, rng);
    this.wanted = new Game.WantedSystem();
    this.police = new Game.PoliceSystem(this.scene, rng);
    this.combat = new Game.CombatSystem(this.scene, rng);
    this.audio = new Game.AudioSystem();
    Game.audio = this.audio;
    this.hud = new Game.HudSystem();
    Game.hud = this.hud;
    this.missions = new Game.MissionSystem(this.scene, rng, {
      player: this.player,
      combat: this.combat,
      wanted: this.wanted,
      police: this.police,
      hud: this.hud,
      audio: this.audio,
      onMissionComplete: this._onMissionComplete.bind(this)
    });
    // Leo's own car (orange) parked on the road by the spawn, facing along it,
    // plus stealable parked cars at the roadside
    this.playerCar = this._spawnParkedCar(-3.4, 24, 0, CFG.PLAYER_CAR_COLOR, true);
    var parkedColors = [0x3c7ad8, 0xe8e8e8, 0x2a2f38, 0x7a4ec8, 0x4ec8a0, 0xd8443c, 0xffd21f];
    for (var i = 0; i < 7; i++) {
      var pt = Game.city.randomRoadPoint(rng);
      var horiz = Math.abs(pt.z - Game.nearestRoadCoord(pt.z)) < 1;
      var heading = horiz ? (pt.x > 0 ? Math.PI / 2 : -Math.PI / 2) : (pt.z > 0 ? 0 : Math.PI);
      // pull to the roadside
      if (horiz) pt.z += 5.6; else pt.x += 5.6;
      this._spawnParkedCar(pt.x, pt.z, heading, parkedColors[i % parkedColors.length], false);
    }
    this.hud.setCash(this.cash);
    this.hud.setWanted(0);
    this.hud.setHealth(this.player.hp);
    this.hud.showMenu(true, Game.SaveSystem.hasSave());
    this.hud.showCrosshair(false);
  };

  GameApp.prototype._spawnParkedCar = function (x, z, heading, color, owned) {
    var car = Game.VehicleFactory.createCar({ x: x, z: z, heading: heading, color: color });
    car.owned = !!owned;
    car.parked = true;
    this.scene.add(car.mesh);
    this.parkedCars.push(car);
    return car;
  };

  GameApp.prototype._initInput = function () {
    var self = this;
    var canvas = this.renderer.domElement;
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      self.keys[e.code] = true;
      if (e.code === 'KeyM') {
        self.audio.ensure();
        self.audio.setMuted(!self.audio.muted);
        self.hud.notify(self.audio.muted ? 'Sound muted (M)' : 'Sound on (M)', '');
      }
      if (e.code === 'Escape') {
        if (self.state === 'playing') self.pauseGame();
        else if (self.state === 'paused') self.resumeGame();
      }
      if (e.code === 'KeyH') self.hud.showHelp(self.helpVisible = !self.helpVisible);
      if (e.code === 'KeyJ' && self.state === 'playing') {
        if (self.missions.startNext()) self.hud.notify('Job started', 'mission');
        else if (self.missions.completedAll) self.hud.notify('All jobs done — Palmera Bay is yours.', 'good');
      }
      if (e.code === 'KeyE' && self.state === 'playing') self._toggleCar();
      if (e.code === 'KeyR' && self.state === 'playing') self.combat.reload();
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    canvas.addEventListener('mousedown', function (e) {
      self.dragging = true;
      self.movedMouse = 0;
      self.lastMouseX = e.clientX; self.lastMouseY = e.clientY;
      self.audio.ensure();
    });
    window.addEventListener('mousemove', function (e) {
      if (!self.dragging) return;
      var dx = e.clientX - self.lastMouseX;
      var dy = e.clientY - self.lastMouseY;
      self.lastMouseX = e.clientX; self.lastMouseY = e.clientY;
      self.movedMouse += Math.abs(dx) + Math.abs(dy);
      if (self.state !== 'playing') return;
      if (self.player.inCar) {
        self.driveCamOffset += dx * 0.004;
      } else {
        self.player.camYaw -= dx * 0.005;
        self.player.camPitch = Game.clamp(self.player.camPitch + dy * 0.003, -0.1, 1.1);
      }
    });
    window.addEventListener('mouseup', function (e) {
      if (self.dragging && self.movedMouse < 6 && e.button === 0) self._tryShoot();
      self.dragging = false;
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.player.camDist = Game.clamp(self.player.camDist + Math.sign(e.deltaY) * 1.2, 4, 14);
    }, { passive: false });
    window.addEventListener('blur', function () { self.keys = {}; });
  };

  GameApp.prototype._initMenus = function () {
    var self = this;
    this.hud.btnNew.addEventListener('click', function () {
      self.audio.ensure(); self.audio.uiClick();
      Game.SaveSystem.clear();
      self.startGame({ silent: false });
    });
    this.hud.btnContinue.addEventListener('click', function () {
      self.audio.ensure(); self.audio.uiClick();
      self.startGame({ silent: false, loadSave: true });
    });
    this.hud.btnHelp.addEventListener('click', function () {
      self.audio.ensure();
      self.hud.showHelp(true);
    });
    this.hud.btnRespawn.addEventListener('click', function () {
      self.audio.ensure(); self.audio.uiClick();
      self._respawn();
    });
    document.getElementById('btn-close-help').addEventListener('click', function () {
      self.hud.showHelp(false);
    });
    document.getElementById('btn-resume').addEventListener('click', function () { self.resumeGame(); });
    document.getElementById('btn-quit-menu').addEventListener('click', function () {
      self.state = 'menu';
      self.hud.showPause(false);
      self.hud.showMenu(true, Game.SaveSystem.hasSave());
    });
  };

  GameApp.prototype.startGame = function (opts) {
    opts = opts || {};
    var save = null;
    if (opts.loadSave) save = Game.SaveSystem.load();
    if (save) {
      this.cash = save.cash || 0;
      this.missions.index = Math.min(save.missionIndex || 0, 4);
      this.player.reset(save.x || 0, save.z || 8);
      if (save.hp) this.player.hp = save.hp;
      if (save.hour) this.hour = save.hour;
      if (!opts.silent) this.hud.notify('Save loaded — welcome back to Palmera Bay.', 'good');
    } else {
      this.cash = 0;
      this.missions.index = 0;
      this.player.reset(0, 8);
    }
    this.wanted.clear();
    this.police.clearAll();
    this.combat.clearEnemies();
    this.combat.ammo = CFG.PISTOL_MAG;
    this.combat.reserve = 60;
    this.state = 'playing';
    this.hud.showMenu(false);
    this.hud.hideEnd();
    this.hud.showPause(false);
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.hp);
    this.hud.setObjective(this.missions.objectiveText());
    this.hud.showCrosshair(true);
    this.player.snapCamera(this.camera);
    if (!opts.silent) {
      this.hud.notify('Welcome to Palmera Bay. Press J to start the first job.', 'mission');
    }
  };

  GameApp.prototype.pauseGame = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause(true);
    this.audio.setEngine(0, false);
    this.audio.setSiren(0);
  };

  GameApp.prototype.resumeGame = function () {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.showPause(false);
  };

  GameApp.prototype._respawn = function () {
    this.hud.hideEnd();
    this.player.reset(0, 8);
    this.player.hp = CFG.PLAYER_HP;
    this.wanted.clear();
    this.police.clearAll();
    this.combat.clearEnemies();
    this.combat.ammo = CFG.PISTOL_MAG;
    this.combat.reserve = 60;
    if (this.player.inCar) this._exitCar();
    this.state = 'playing';
    this.player.snapCamera(this.camera);
    this.hud.setHealth(this.player.hp);
    this.hud.notify('Back on the streets of Palmera Bay.', 'good');
  };

  GameApp.prototype._onMissionComplete = function (def) {
    this.cash += def.reward;
    this.hud.setCash(this.cash);
    this.audio.cashSound();
    Game.SaveSystem.save({
      missionIndex: this.missions.index,
      cash: this.cash, x: this.player.x, z: this.player.z,
      hp: this.player.hp, hour: this.hour
    });
  };

  GameApp.prototype._onBusted = function () {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.setEngine(0, false);
    this.audio.setSiren(0);
    this.hud.showEnd('busted', 'The Palmera Bay PD caught up with Leo. The job will have to wait.');
  };

  GameApp.prototype._onWasted = function () {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.audio.setEngine(0, false);
    this.audio.setSiren(0);
    this.hud.showEnd('wasted', 'Leo is down. Palmera Bay keeps its secrets — for now.');
  };

  GameApp.prototype._nearestEnterableCar = function () {
    var best = null, bestD = 4.5;
    var px = this.player.x, pz = this.player.z;
    var all = this.parkedCars.concat(this.traffic.cars);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.police) continue;
      var d = Game.dist2D(px, pz, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  };

  GameApp.prototype.enterCar = function (car, silent) {
    // stealing a traffic car removes it from traffic
    var ti = this.traffic.cars.indexOf(car);
    if (ti >= 0) this.traffic.cars.splice(ti, 1);
    var pi = this.parkedCars.indexOf(car);
    if (pi >= 0) this.parkedCars.splice(pi, 1);
    car.parked = false;
    car.isPlayerCar = true;
    this.player.inCar = car;
    this.player.mesh.visible = false;
    this.driveCamOffset = 0;
    if (!car.owned && !silent) {
      this.wanted.addCrime(1, 'car stolen');
      this.hud.notify('Stolen car — the heat is on.', 'bad');
    }
    this.audio.setEngine(0, true);
  };

  GameApp.prototype._exitCar = function () {
    var car = this.player.inCar;
    if (!car) return;
    car.isPlayerCar = false;
    var f = Game.CarController.forward(car);
    this.player.x = car.x - f.x * 2.5;
    this.player.z = car.z - f.z * 2.5;
    this.player.y = 0;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.inCar = null;
    car.speed = 0;
    car.parked = true;
    this.parkedCars.push(car);
    this.audio.setEngine(0, false);
  };

  GameApp.prototype._toggleCar = function () {
    if (this.player.inCar) { this._exitCar(); return; }
    var car = this._nearestEnterableCar();
    if (car) this.enterCar(car, false);
    else this.hud.notify('No car nearby — get closer and press E.', '');
  };

  GameApp.prototype._tryShoot = function () {
    if (this.state !== 'playing' || this.player.inCar) return;
    if (!this.combat.canShoot()) return;
    var dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    var origin = this.camera.position.clone();
    var result = this.combat.shoot(origin, dir);
    if (result === 'hit' || result === 'miss') {
      this.peds.scare(this.player.x, this.player.z);
      if (this.wanted.stars === 0) this.wanted.addCrime(1, 'shots fired');
    }
  };

  GameApp.prototype._hitPedestrianCheck = function () {
    // the player's car ploughing into a pedestrian is a crime
    if (!this.player.inCar) return;
    var car = this.player.inCar;
    if (Math.abs(car.speed) < 4) return;
    for (var i = 0; i < this.peds.peds.length; i++) {
      var p = this.peds.peds[i];
      if (Game.dist2D(car.x, car.z, p.x, p.z) < 2.2) {
        this.wanted.addCrime(2, 'pedestrian down!');
        this.peds.scare(car.x, car.z);
        // respawn that pedestrian elsewhere
        this.scene.remove(p.mesh);
        this.peds.peds.splice(i, 1);
        this.peds.spawnPed();
        this.audio.thud();
        break;
      }
    }
  };

  GameApp.prototype._carCollisions = function () {
    var pc = this.player.inCar;
    if (!pc) return;
    var all = this.traffic.cars.concat(this.police.cars);
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      var dx = o.x - pc.x, dz = o.z - pc.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < 10.2 && d2 > 0.001) {
        var d = Math.sqrt(d2), push = (3.2 - d) / 2;
        pc.x -= dx / d * push; pc.z -= dz / d * push;
        o.x += dx / d * push; o.z += dz / d * push;
        if (Math.abs(pc.speed) > 6) {
          pc.speed *= 0.6;
          if (o.police) this.wanted.addCrime(1, 'rammed a cruiser');
        }
      }
    }
  };

  GameApp.prototype._updateDebug = function () {
    var d = this.hud.debug;
    if (!d) return;
    d.textContent = 'state=' + this.state +
      ' fps=' + this.fps +
      ' pos=(' + Math.round(this.player.x) + ',' + Math.round(this.player.z) + ')' +
      ' wanted=' + this.wanted.stars +
      ' hp=' + Math.round(this.player.hp) +
      ' cash=$' + this.cash +
      ' mission=' + (this.missions.active ? this.missions.active.def.id + ' s' + this.missions.active.stage : (this.missions.completedAll ? 'DONE' : 'none')) +
      ' enemies=' + this.combat.enemiesAlive() +
      ' ammo=' + this.combat.ammo;
  };

  GameApp.prototype._loop = function () {
    requestAnimationFrame(this._loop);
    var dt = Math.min(0.05, this._clockDelta());
    // fps counter: real frames per real second (dt is clamped, so the
    // counter must use wall-clock time, not accumulated dt)
    this._fpsFrames++;
    var nowMs = performance.now();
    if (!this._fpsWindowStart) this._fpsWindowStart = nowMs;
    if (nowMs - this._fpsWindowStart >= 1000) {
      this.fps = Math.round(this._fpsFrames * 1000 / (nowMs - this._fpsWindowStart));
      this._fpsFrames = 0;
      this._fpsWindowStart = nowMs;
    }
    // clouds drift
    if (Game.cityClouds) {
      Game.cityClouds.forEach(function (c) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 380) c.position.x = -380;
      });
    }
    if (this.state === 'menu') {
      // slow vista orbit behind the start menu
      var t = performance.now() * 0.00004;
      this.camera.position.set(Math.sin(t) * 190, 85, Math.cos(t) * 190 + 40);
      this.camera.lookAt(0, 12, 0);
      this.traffic.update(dt, null);
      this.peds.update(dt);
      this.renderer.render(this.scene, this.camera);
      this._updateDebug();
      return;
    }
    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.shot && this.state === 'playing') {
      // Staged screenshot: hold the composed frame exactly as shots.js set
      // it — no drift from traffic, police or the car coasting. Just render
      // and refresh the HUD once so the minimap and readouts are painted.
      this.hud.setWanted(this.wanted.stars);
      this.hud.setClock(this.hour);
      this.hud.setHealth(this.player.hp);
      this.hud.setSpeed(this.player.inCar ? Math.abs(this.player.inCar.speed) * 3.6 : 0);
      if (!this.player.inCar) {
        this.hud.setAmmo(this.combat.ammo, this.combat.reserve, this.combat.reloadT > 0);
      } else {
        this.hud.ammoEl.textContent = '';
      }
      this.hud.showCrosshair(!this.player.inCar);
      this.hud.drawMinimap({
        player: this.player,
        missionTarget: this.missions.target,
        policeCars: this.police.cars,
        enemies: this.combat.enemies
      });
      this._updateDebug();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // ---- playing ----
    this.hour += dt * 24 / CFG.DAY_LENGTH_S;
    if (this.hour >= 24) this.hour -= 24;
    var input = {
      f: !!this.keys.KeyW, b: !!this.keys.KeyS,
      l: !!this.keys.KeyA, r: !!this.keys.KeyD,
      run: !!this.keys.ShiftLeft || !!this.keys.ShiftRight,
      jump: !!this.keys.Space
    };
    if (this.player.inCar) {
      var car = this.player.inCar;
      var throttle = (this.keys.KeyW ? 1 : 0) + (this.keys.KeyS ? -1 : 0);
      var steer = (this.keys.KeyA ? -1 : 0) + (this.keys.KeyD ? 1 : 0);
      Game.CarController.step(car, {
        throttle: throttle, steer: steer,
        handbrake: !!this.keys.Space
      }, dt);
      Game.CarController.chaseCamera(this.camera, car, dt, false, this.driveCamOffset);
      this.player.x = car.x; this.player.z = car.z;
      this.player.speedNow = Math.abs(car.speed);
      this.audio.setEngine(Math.abs(car.speed) / CFG.CAR_MAX_SPEED, true);
      this._carCollisions();
      this._hitPedestrianCheck();
      this.hud.setSpeed(Math.abs(car.speed) * 3.6);
      this.hud.setAmmo(0, 0, false);
      this.hud.ammoEl.textContent = '';
      this.hud.showCrosshair(false);
    } else {
      this.player.updateOnFoot(input, dt);
      this.player.updateCamera(this.camera, dt);
      this.audio.setEngine(0, false);
      this.hud.setSpeed(0);
      this.hud.showCrosshair(true);
    }
    this.traffic.update(dt, this.player.inCar);
    this.peds.update(dt);
    this.police.matchWanted(this.wanted.stars, this.player.x, this.player.z);
    var nearestPolice = this.police.nearestDistance(this.player.x, this.player.z);
    this.wanted.update(dt, nearestPolice);
    var policeResult = this.police.update(dt, this.player, this.wanted.stars);
    if (policeResult === 'busted') this._onBusted();
    if (this.player.hp <= 0) this._onWasted();
    this.combat.update(dt, this.player);
    this.missions.update(dt);
    // HUD
    this.hud.setWanted(this.wanted.stars);
    this.hud.setClock(this.hour);
    this.hud.setHealth(this.player.hp);
    this.hud.setAmmo(this.combat.ammo, this.combat.reserve, this.combat.reloadT > 0);
    this.hud.showHitMarker(this.combat.hitMarkerT > 0);
    this.mapT += dt;
    if (this.mapT > 0.12) {
      this.mapT = 0;
      this.hud.drawMinimap({
        player: this.player,
        missionTarget: this.missions.target,
        policeCars: this.police.cars,
        enemies: this.combat.enemies
      });
    }
    // autosave
    this.saveT += dt;
    if (this.saveT > 20) {
      this.saveT = 0;
      Game.SaveSystem.save({
        missionIndex: this.missions.index,
        cash: this.cash, x: this.player.x, z: this.player.z,
        hp: this.player.hp, hour: this.hour
      });
    }
    this._updateDebug();
    this.renderer.render(this.scene, this.camera);
  };

  GameApp.prototype._clockDelta = function () {
    var now = performance.now();
    var d = this._lastT ? (now - this._lastT) / 1000 : 0.016;
    this._lastT = now;
    return d;
  };

  GameApp.prototype._showError = function (e) {
    var d = this.hud ? this.hud.debug : document.getElementById('debug');
    if (d) d.textContent = 'ERROR: ' + (e && e.message ? e.message : e);
    if (window.console) console.error(e);
  };

  // Wasted hook used by CombatSystem when an enemy kills the player.
  Game.onPlayerWasted = function () {
    if (window.__game) window.__game._onWasted();
  };

  window.addEventListener('error', function (e) {
    var d = document.getElementById('debug');
    if (d) d.textContent = 'ERROR: ' + e.message;
  });

  window.__game = new GameApp();
  Game.GameApp = GameApp;
})();
