// SUNSET SHORES — shots.js
// ShotStaging: deterministic setups for the 4 competition screenshots, driven
// by ?shot=chase|street|combat|menu (plus ?shot=vista). Each one puts the
// player, police, wanted level, mission objective and camera in a fixed,
// readable state so the screenshot shows several systems at once.
(function () {
  'use strict';

  var ShotStaging = {
    apply: function (shot, game) {
      var g = game;
      document.body.classList.add('shot-mode');
      if (shot === 'menu') {
        // menu stays up; main.js runs the vista orbit camera behind it
        return;
      }
      g.startGame({ skipMenu: true, silent: true });
      if (shot === 'chase') {
        // M2 escape: Leo driving, 2 cruisers closing in head-on, 3 wanted stars
        g.missions.startMission(1);
        g.missions.removePassenger();
        g.missions.active.stage = 1;
        g.missions.enterStage();
        g.wanted.addCrime(1, 'heat is on');
        var car = g.playerCar;
        car.x = 0; car.z = -60; car.heading = 0; car.speed = 19;
        car.mesh.position.set(0, 0, -60);
        g.enterCar(car, true);
        g.police.matchWanted(g.wanted.stars, g.player.x, g.player.z);
        // cruisers ahead, facing the player — visible in the chase cam
        g.police.cars.forEach(function (pc, i) {
          pc.x = (i === 0 ? -3.4 : 3.4);
          pc.z = -28 - i * 10;
          pc.heading = Math.PI;
          pc.speed = 12;
          pc.mesh.position.set(pc.x, 0, pc.z);
        });
        // traffic ahead on the same road for density
        g.traffic.cars.slice(0, 3).forEach(function (tc, i) {
          tc.x = (i % 2 === 0 ? -3.4 : 3.4);
          tc.z = -14 - i * 12;
          tc.heading = 0;
          tc.ai.horizontal = false; tc.ai.dir = 1; tc.ai.road = tc.x;
          tc.mesh.position.set(tc.x, 0, tc.z);
        });
        g.player.camYaw = Math.PI;
        Game.CarController.chaseCamera(g.camera, car, 0.016, true);
      } else if (shot === 'street') {
        // on foot on a busy sidewalk: traffic, pedestrians, buildings
        g.missions.startMission(0);
        g.player.reset(-3, 54 + 9.4);
        g.player.camYaw = Math.PI * 0.92;
        g.player.camPitch = 0.28;
        g.player.snapCamera(g.camera);
        g.wanted.clear();
        // pull pedestrians onto the same sidewalk, in view
        g.peds.peds.slice(0, 6).forEach(function (p, i) {
          p.x = -18 + i * 7;
          p.z = 54 + 9.4 + (i % 2) * 1.5;
          p.horizontal = true;
          p.dir = i % 2 === 0 ? 1 : -1;
          p.fleeT = 0;
          p.mesh.position.set(p.x, 0, p.z);
        });
        // traffic passing on the road in front of the player
        g.traffic.cars.slice(0, 3).forEach(function (tc, i) {
          tc.x = -30 + i * 22;
          tc.z = 54 + (i % 2 === 0 ? -3.4 : 3.4);
          tc.heading = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
          tc.ai.horizontal = true; tc.ai.dir = i % 2 === 0 ? 1 : -1; tc.ai.road = tc.z;
          tc.mesh.position.set(tc.x, 0, tc.z);
        });
      } else if (shot === 'combat') {
        // M4 shootout: enemies ahead, muzzle flash held, 2 wanted stars
        g.missions.startMission(3);
        g.missions.active.stage = 1;
        g.missions.enterStage();
        g.wanted.addCrime(2, 'shots fired');
        g.player.reset(0, 20);
        g.player.camYaw = Math.PI;
        g.player.camPitch = 0.22;
        // enemies in a line ahead of the player, close enough to read
        g.combat.enemies.forEach(function (e, i) {
          e.x = -8 + i * 5.5;
          e.z = 20 - 12 - (i % 2) * 3;
          e.mesh.position.set(e.x, 0, e.z);
        });
        g.player.snapCamera(g.camera);
        // fire once toward the middle enemy and hold the flash at the gun
        var origin = g.camera.position.clone();
        var dir = new THREE.Vector3(-0.1, -0.05, -1).normalize();
        g.combat.shoot(origin, dir);
        g.combat.ammo = 10;
        g.combat.keepFlash = true;
        g.combat.flashSprite.visible = true;
        g.combat.flashLight.intensity = 3;
        g.combat.flashSprite.scale.set(2.6, 2.6, 1);
        g.combat.flashSprite.position.set(0.9, 1.6, 18.2);
        g.combat.flashLight.position.set(0.9, 1.6, 18.2);
        // tracer from Leo's gun to the middle enemy
        g.combat.showTracer(
          new THREE.Vector3(0.9, 1.6, 18.2),
          new THREE.Vector3(-2.5, 1.3, 8));
      } else if (shot === 'vista') {
        g.player.reset(0, 0);
        g.camera.position.set(-40, 90, 190);
        g.camera.lookAt(0, 10, 0);
      }
      if (g.hud) g.hud.setObjective(g.missions.objectiveText());
    }
  };

  Game.ShotStaging = ShotStaging;
})();
