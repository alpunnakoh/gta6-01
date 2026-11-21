// SUNSET SHORES — vigilante.js
// VigilanteSystem: Leo moonlights as the bay's own justice. Press B while
// driving and the PD scanner crackles — a runner in a red sports coupe is
// fleeing the scene, and the job is to stop him. Ram the runner three
// times before the clock runs out and the city pays $300, plus the PD
// looks the other way: one star of heat comes off, because tonight Leo
// did their job for them. Fail — lose him, run out of time, or get out
// of the car — and the job is gone for 45 seconds. Reputation builds
// with every runner stopped, and the payout grows with it.
(function () {
  'use strict';
  var CFG = Game.CFG;

  function VigilanteSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng || Math.random;
    this.world = world || {};
    this.active = null;     // {runner, hits, timeLeft, lastDist, lostT}
    this.cooldown = 0;
    this.rep = 0;           // runners stopped, all time
    this.jobsDone = 0;
    this.jobsFailed = 0;
  }

  VigilanteSystem.prototype.tryStart = function () {
    var w = this.world;
    if (this.active) {
      if (w.hud) w.hud.notify('Vigilante job already running — stop the runner!', '');
      return false;
    }
    if (this.cooldown > 0) {
      if (w.hud) w.hud.notify('Scanner is quiet — next vigilante job in ' + Math.ceil(this.cooldown) + 's.', '');
      return false;
    }
    if (w.missions && w.missions.active) {
      if (w.hud) w.hud.notify('Finish the story job first — one thing at a time.', '');
      return false;
    }
    if (w.racing && w.racing.active) {
      if (w.hud) w.hud.notify('You are in a race — the runner will have to wait.', '');
      return false;
    }
    if (!w.player || !w.player.inCar) {
      if (w.hud) w.hud.notify('Vigilante work needs wheels — get in a car and press B.', '');
      return false;
    }
    // the runner: a red sports coupe on a nearby road, already moving
    var p = Game.city.randomRoadPoint(this.rng);
    var guard = 0;
    while (Game.dist2D(p.x, p.z, w.player.x, w.player.z) < 55 && guard++ < 20) {
      p = Game.city.randomRoadPoint(this.rng);
    }
    var runner = Game.VehicleFactory.createCar({
      x: p.x, z: p.z, heading: this.rng() * Math.PI * 2,
      color: 0xd8443c, variant: 'sport'
    });
    runner.topSpeed = 40;
    this.scene.add(runner.mesh);
    this.active = {
      runner: runner, hits: 0, timeLeft: CFG.VIGILANTE_TIME_S,
      lastDist: 9999, lostT: 0, hitCooldown: 0
    };
    if (w.hud) {
      w.hud.notify('VIGILANTE: a runner in a red coupe is fleeing — ram him ' +
        CFG.VIGILANTE_HITS + ' times in ' + CFG.VIGILANTE_TIME_S + 's!', 'mission');
      w.hud.setVigilante('RUNNER • 0/' + CFG.VIGILANTE_HITS + ' HITS • ' +
        CFG.VIGILANTE_TIME_S + 's');
    }
    if (w.audio) w.audio.sirenBlip();
    return true;
  };

  VigilanteSystem.prototype._end = function (won, reason) {
    var w = this.world;
    var a = this.active;
    if (!a) return;
    this.scene.remove(a.runner.mesh);
    this.active = null;
    this.cooldown = CFG.VIGILANTE_COOLDOWN_S;
    if (w.hud) w.hud.setVigilante('');
    if (won) {
      this.rep++;
      this.jobsDone++;
      var payout = CFG.VIGILANTE_REWARD + this.rep * 50;
      if (w.onCash) w.onCash(payout);
      if (w.wanted && w.wanted.forgive) w.wanted.forgive(1);
      if (w.audio) w.audio.cashSound();
      if (w.hud) {
        w.hud.notify('Runner stopped — +$' + payout + '. The PD drops one star for the help. Rep: ' + this.rep + '.', 'good');
        w.hud.centerMessage('VIGILANTE — RUNNER STOPPED', 2600);
      }
    } else {
      this.jobsFailed++;
      if (w.hud) w.hud.notify('Vigilante job failed — ' + reason + '.', 'bad');
    }
  };

  // The runner flees: steer away from the player with a weave, flat out.
  VigilanteSystem.prototype._driveRunner = function (dt) {
    var a = this.active;
    var w = this.world;
    var car = a.runner;
    var dx = car.x - w.player.x, dz = car.z - w.player.z;
    var dist = Math.sqrt(dx * dx + dz * dz) || 1;
    // weave: the flee direction swings a little so the chase is not a
    // straight line down one road
    var weave = Math.sin(performance.now() * 0.0009) * 0.5;
    var away = Math.atan2(dx, dz) + weave;
    var diff = away - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = Game.clamp(diff * 2.4, -1, 1);
    Game.CarController.step(car, { throttle: 1, steer: steer, handbrake: false }, dt);
    return dist;
  };

  VigilanteSystem.prototype.update = function (dt) {
    var w = this.world;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.active) return;
    var a = this.active;
    var car = a.runner;
    // out of the car, the runner gets away
    if (!w.player.inCar) {
      this._end(false, 'you got out of the car');
      return;
    }
    a.timeLeft -= dt;
    a.hitCooldown -= dt;
    if (a.timeLeft <= 0) {
      this._end(false, 'out of time');
      return;
    }
    var dist = this._driveRunner(dt);
    // lost him: too far away for too long
    if (dist > 150) {
      a.lostT += dt;
      if (a.lostT > 5) {
        this._end(false, 'the runner got away');
        return;
      }
    } else {
      a.lostT = 0;
    }
    // a hit: close and fast, with a short cooldown so one touch is one hit
    var pc = w.player.inCar;
    var relSpeed = Math.abs(pc.speed - car.speed);
    if (dist < 3.8 && relSpeed > 5 && a.hitCooldown <= 0) {
      a.hitCooldown = 1.2;
      a.hits++;
      Game.VehicleFactory.damageCar(car, 34);
      car.speed *= 0.5;
      pc.speed *= 0.75;
      if (w.audio) w.audio.thud();
      if (w.hud) {
        w.hud.notify('HIT ' + a.hits + '/' + CFG.VIGILANTE_HITS + ' — keep ramming him!', 'good');
        w.hud.setVigilante('RUNNER • ' + a.hits + '/' + CFG.VIGILANTE_HITS +
          ' HITS • ' + Math.ceil(a.timeLeft) + 's');
      }
      if (a.hits >= CFG.VIGILANTE_HITS || car.wrecked) {
        this._end(true);
        return;
      }
    }
    if (w.hud) {
      w.hud.setVigilante('RUNNER • ' + a.hits + '/' + CFG.VIGILANTE_HITS +
        ' HITS • ' + Math.ceil(a.timeLeft) + 's • ' + Math.round(dist) + 'm');
    }
  };

  VigilanteSystem.prototype.restore = function (saved) {
    if (!saved) return;
    this.rep = saved.rep || 0;
    this.jobsDone = saved.jobs || 0;
  };

  Game.VigilanteSystem = VigilanteSystem;
})();
