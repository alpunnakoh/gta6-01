// SUNSET SHORES — nightlife.js
// NightlifeSystem: Palmera Bay after dark. When the sun drops, the beach
// road lights up — three club fronts with pulsing neon signs, a night
// market in the plaza with four stalls and string lights, and a crowd
// that walks the strip until dawn. The clubs are facades with real
// silhouettes in the windows, the market stalls sell fruit and clothes
// under canvas awnings, and the crowd uses the same pedestrian system as
// the day, tagged so it can be cleared when the sun comes up. Taxis pay
// a night premium too, because of course they do.
(function () {
  'use strict';
  var CFG = Game.CFG;

  var CLUBS = [
    { name: 'NEON PALM', x: -108, color: 0xff6bd8, sign: 0xff6bd8 },
    { name: 'THE LAGOON', x: 0, color: 0x4ecdc4, sign: 0x4ecdc4 },
    { name: 'SUNSET ROOM', x: 108, color: 0xffd21f, sign: 0xffd21f }
  ];

  var STALLS = [
    { color: 0xd8443c, x: 126, z: 126, goods: 'fruit' },
    { color: 0x3c7ad8, x: 144, z: 126, goods: 'shirts' },
    { color: 0x4ec8a0, x: 126, z: 144, goods: 'flowers' },
    { color: 0xffd21f, x: 144, z: 144, goods: 'snacks' }
  ];

  function neonSign(text, color) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    var g = c.getContext('2d');
    g.fillStyle = '#0a0a12';
    g.fillRect(0, 0, 512, 96);
    g.font = 'bold 52px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // glow: the text drawn three times, wide and faint to tight and bright
    g.shadowColor = '#' + ('000000' + color.toString(16)).slice(-6);
    g.shadowBlur = 28;
    g.fillStyle = '#' + ('000000' + color.toString(16)).slice(-6);
    g.fillText(text, 256, 50);
    g.shadowBlur = 10;
    g.fillText(text, 256, 50);
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.fillText(text, 256, 50);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    mesh.userData = { baseColor: color, canvas: c, ctx: g, text: text };
    return mesh;
  }

  function buildClubFront(club) {
    var g = new THREE.Group();
    var wall = new THREE.MeshLambertMaterial({ color: 0x1a1d24 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 6), wall);
    body.position.y = 4.5;
    g.add(body);
    // door with a bouncer silhouette in front
    var door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    door.position.set(0, 2.5, 3.1);
    g.add(door);
    var bouncer = new THREE.Group();
    var bShirt = new THREE.MeshLambertMaterial({ color: 0x111111 });
    var bSkin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
    var bBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.5), bShirt);
    bBody.position.y = 1.1;
    var bHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), bSkin);
    bHead.position.y = 2.05;
    var bLegL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), bShirt);
    bLegL.position.set(-0.25, 0.45, 0);
    var bLegR = bLegL.clone(); bLegR.position.x = 0.25;
    bouncer.add(bBody, bHead, bLegL, bLegR);
    bouncer.position.set(3.2, 0, 4.2);
    g.add(bouncer);
    // windows with silhouettes: two dancers and a DJ behind the glass
    var winMat = new THREE.MeshBasicMaterial({ color: club.color, transparent: true, opacity: 0.85 });
    [-5.5, 5.5].forEach(function (wx) {
      var win = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.5), winMat);
      win.position.set(wx, 5.5, 3.05);
      g.add(win);
    });
    var silhouettes = [];
    for (var i = 0; i < 3; i++) {
      var s = new THREE.Group();
      var sBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
      sBody.position.y = 0.8;
      var sHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.2),
        new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
      sHead.position.y = 1.6;
      s.add(sBody, sHead);
      s.position.set(-6.5 + i * 2.2, 4.2, 3.15);
      s.userData = { phase: i * 2, arm: sBody };
      g.add(s);
      silhouettes.push(s);
    }
    // neon sign above the door
    var sign = neonSign(club.name, club.sign);
    sign.position.set(0, 8.2, 3.15);
    g.add(sign);
    // a rope line: two posts and a sagging rope
    [-2.5, 2.5].forEach(function (rx) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8),
        new THREE.MeshLambertMaterial({ color: 0xffd21f }));
      post.position.set(rx, 0.55, 5.2);
      g.add(post);
    });
    g.userData = { sign: sign, silhouettes: silhouettes, baseColor: club.color };
    return g;
  }

  function buildMarketStall(stall) {
    var g = new THREE.Group();
    var awn = new THREE.MeshLambertMaterial({ color: stall.color });
    var roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 3.5), awn);
    roof.position.y = 2.6;
    roof.rotation.x = 0.12;
    var counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 2.6),
      new THREE.MeshLambertMaterial({ color: 0x6a4a3a }));
    counter.position.y = 0.55;
    g.add(roof, counter);
    // goods on the counter: a row of little coloured boxes by type
    var goodCols = { fruit: 0xff7a1a, shirts: 0x3c7ad8, flowers: 0xff6bd8, snacks: 0xffd21f };
    for (var i = 0; i < 4; i++) {
      var good = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5),
        new THREE.MeshLambertMaterial({ color: goodCols[stall.goods] || 0xffffff }));
      good.position.set(-1.2 + i * 0.8, 1.3, 0);
      g.add(good);
    }
    // a warm bulb hanging under the awning
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    bulb.position.y = 2.3;
    g.add(bulb);
    g.position.set(stall.x, 0, stall.z);
    g.userData = { bulb: bulb };
    return g;
  }

  function NightlifeSystem(scene, rng, world) {
    this.scene = scene;
    this.rng = rng || Math.random;
    this.world = world || {};
    this.clubs = [];
    this.stalls = [];
    this.light = null;
    this.wasNight = false;
    this.crowdSpawned = false;
    this._buildClubs();
    this._buildMarket();
  }

  NightlifeSystem.prototype._buildClubs = function () {
    var self = this;
    CLUBS.forEach(function (club) {
      var front = buildClubFront(club);
      // club fronts face south onto the beach road (z = 222), fronts at z = 222
      front.position.set(club.x, 0, 216);
      front.rotation.y = Math.PI;
      self.scene.add(front);
      self.clubs.push(front);
    });
    // one magenta point light over the whole strip, only on at night
    var light = new THREE.PointLight(0xff6bd8, 0, 60, 1.6);
    light.position.set(0, 12, 214);
    this.scene.add(light);
    this.light = light;
  };

  NightlifeSystem.prototype._buildMarket = function () {
    var self = this;
    STALLS.forEach(function (s) {
      var stall = buildMarketStall(s);
      self.scene.add(stall);
      self.stalls.push(stall);
    });
    // string lights: two rows of bulbs across the plaza
    var bulbGeo = new THREE.SphereGeometry(0.18, 6, 5);
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    this.stringLights = [];
    [132, 140].forEach(function (z) {
      for (var x = 122; x <= 150; x += 4) {
        var b = new THREE.Mesh(bulbGeo, bulbMat);
        b.position.set(x, 4.4 - Math.abs(x - 136) * 0.02, z);
        self.scene.add(b);
        self.stringLights.push(b);
      }
    });
    // the wires they hang from
    [132, 140].forEach(function (z) {
      var wire = new THREE.Mesh(new THREE.BoxGeometry(30, 0.06, 0.06),
        new THREE.MeshBasicMaterial({ color: 0x222222 }));
      wire.position.set(136, 4.5, z);
      self.scene.add(wire);
    });
  };

  NightlifeSystem.prototype.isNight = function (hour) {
    return Game.DayNight && Game.DayNight.prototype.isNight ?
      Game.DayNight.prototype.isNight(hour) : (hour < 5 || hour >= 19);
  };

  NightlifeSystem.prototype._spawnCrowd = function () {
    var t = this.world.traffic;
    if (!t || !t.spawnPed) return;
    for (var i = 0; i < CFG.NIGHT_CROWD; i++) {
      var ped = t.spawnPed();
      if (!ped) break;
      // walk the strip: beach road z between 216 and 236
      ped.x = -160 + this.rng() * 320;
      ped.z = 214 + this.rng() * 22;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.tagged = ped.tagged || {};
      ped.tagged.nightlife = true;
    }
    this.crowdSpawned = true;
  };

  NightlifeSystem.prototype._clearCrowd = function () {
    var t = this.world.traffic;
    if (!t || !t.peds) return;
    for (var i = t.peds.length - 1; i >= 0; i--) {
      var ped = t.peds[i];
      if (ped.tagged && ped.tagged.nightlife) {
        this.scene.remove(ped.mesh);
        t.peds.splice(i, 1);
      }
    }
    this.crowdSpawned = false;
  };

  NightlifeSystem.prototype.update = function (dt, hour) {
    var night = this.isNight(hour);
    var w = this.world;
    // dusk: crowd arrives, lights come on. dawn: crowd leaves.
    if (night && !this.wasNight) {
      this._spawnCrowd();
      if (w.hud) w.hud.notify('Night falls — the beach road lights up. Taxis pay 1.5x after dark.', 'mission');
    }
    if (!night && this.wasNight) {
      this._clearCrowd();
    }
    this.wasNight = night;
    // club signs pulse, dancers sway, stall bulbs breathe
    var t = performance.now() * 0.003;
    this.clubs.forEach(function (club, i) {
      var s = club.userData.sign;
      var pulse = 0.75 + Math.sin(t * 2 + i * 1.7) * 0.25;
      s.material.opacity = night ? pulse : 0.35;
      club.userData.silhouettes.forEach(function (sil) {
        sil.rotation.z = night ? Math.sin(t * 3 + sil.userData.phase) * 0.25 : 0;
        sil.position.y = 4.2 + (night ? Math.abs(Math.sin(t * 2 + sil.userData.phase)) * 0.25 : 0);
      });
    });
    this.stalls.forEach(function (stall, i) {
      stall.userData.bulb.material.color.setHex(night ? 0xffe9a8 : 0x888888);
      stall.userData.bulb.scale.setScalar(night ? 1 + Math.sin(t * 2 + i) * 0.15 : 1);
    });
    this.stringLights.forEach(function (b, i) {
      b.material = b.material; // shared material; brightness comes from the light below
      b.visible = night;
    });
    if (this.light) {
      this.light.intensity = night ? 1.6 + Math.sin(t * 1.5) * 0.4 : 0;
      this.light.color.setHex(night ? 0xff6bd8 : 0xffffff);
    }
  };

  Game.NightlifeSystem = NightlifeSystem;
})();
