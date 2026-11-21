// SUNSET SHORES — city.js
// buildCity(scene, seed): the whole of Palmera Bay — 9x9 road grid, ~120 procedural
// buildings with canvas window textures, palms, street lamps, beach + ocean,
// sunset sky, fog and sun. Exposes Game.city.colliders (building AABBs),
// Game.city.randomRoadPoint(rng) and Game.city.randomSidewalkPoint(rng).
(function () {
  'use strict';
  var CFG = Game.CFG;

  var colliders = [];   // {minX,maxX,minZ,maxZ}
  var palms = [];
  var lamps = [];

  function makeBuildingTexture(rng, baseColor) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = baseColor;
    g.fillRect(0, 0, 128, 256);
    // subtle vertical shading
    var grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.18)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 256);
    // window grid
    var cols = 4 + Math.floor(rng() * 3);
    var rows = 8 + Math.floor(rng() * 8);
    var ww = 128 / cols, wh = 256 / rows;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var lit = rng() < 0.28;
        g.fillStyle = lit ? 'rgba(255,214,140,0.95)' : 'rgba(30,42,60,0.85)';
        g.fillRect(x * ww + ww * 0.22, y * wh + wh * 0.25, ww * 0.56, wh * 0.5);
      }
    }
    // roof line
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, 128, 6);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function cssHex(hex) {
    return '#' + ('000000' + hex.toString(16)).slice(-6);
  }

  function addBuilding(group, rng, x, z, w, d, h, palette) {
    var color = palette[Math.floor(rng() * palette.length)];
    var tex = makeBuildingTexture(rng, cssHex(color));
    // repeat the window grid so windows stay the same size on any building
    tex.repeat.set(Math.max(1, Math.round(w / 15)), Math.max(1, Math.round(h / 15)));
    var mat = new THREE.MeshLambertMaterial({ map: tex });
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    group.add(mesh);
    // rooftop box (AC unit / parapet)
    if (rng() < 0.6) {
      var roof = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(4, w * 0.3), 1.6, Math.min(4, d * 0.3)),
        new THREE.MeshLambertMaterial({ color: 0x6a6a6a }));
      roof.position.set(x + (rng() - 0.5) * w * 0.4, h + 0.8, z + (rng() - 0.5) * d * 0.4);
      group.add(roof);
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  function addPalm(group, rng, x, z) {
    var h = 7 + rng() * 3;
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.38, h, 6),
      new THREE.MeshLambertMaterial({ color: CFG.COLORS.palmTrunk }));
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = (rng() - 0.5) * 0.12;
    group.add(trunk);
    var crown = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.2, 7),
      new THREE.MeshLambertMaterial({ color: CFG.COLORS.palmLeaf, flatShading: true }));
    crown.position.set(x + trunk.rotation.z * -h * 0.5, h + 0.9, z);
    group.add(crown);
    palms.push({ x: x, z: z });
  }

  function addLamp(group, x, z) {
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 5.4, 5),
      new THREE.MeshLambertMaterial({ color: 0x2c313a }));
    pole.position.set(x, 2.7, z);
    group.add(pole);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
    head.position.set(x, 5.5, z);
    group.add(head);
    lamps.push({ x: x, z: z });
  }

  function buildCity(scene, seed) {
    var rng = Game.rng(seed || 1);
    var group = new THREE.Group();
    group.name = 'PalmeraBay';
    var C = CFG.COLORS;

    // ---- sky, fog, lights ----
    scene.background = new THREE.Color(C.skyHorizon);
    scene.fog = new THREE.Fog(C.fog, 180, 520);
    var hemi = new THREE.HemisphereLight(0xffd9b0, 0x4a5a7a, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffc98a, 1.6);
    sun.position.set(-140, 90, 260); // low western sun over the ocean
    scene.add(sun);
    // sun disc + glow sprite
    var sunCanvas = document.createElement('canvas');
    sunCanvas.width = sunCanvas.height = 128;
    var sg = sunCanvas.getContext('2d');
    var rg = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,240,200,1)');
    rg.addColorStop(0.35, 'rgba(255,190,110,0.9)');
    rg.addColorStop(1, 'rgba(255,150,80,0)');
    sg.fillStyle = rg;
    sg.fillRect(0, 0, 128, 128);
    var sunTex = new THREE.CanvasTexture(sunCanvas);
    var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, transparent: true, depthWrite: false, fog: false }));
    sunSprite.position.set(-260, 62, 480);
    sunSprite.scale.set(180, 180, 1);
    scene.add(sunSprite);
    // clouds: flat white blobs drifting slowly
    var cloudMat = new THREE.MeshLambertMaterial({ color: 0xffe8d8, transparent: true, opacity: 0.85 });
    for (var ci = 0; ci < 10; ci++) {
      var cl = new THREE.Group();
      for (var k = 0; k < 3; k++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(6 + rng() * 8, 8, 6), cloudMat);
        puff.scale.y = 0.35;
        puff.position.set(k * 9 - 9 + rng() * 4, rng() * 2, rng() * 4);
        cl.add(puff);
      }
      cl.position.set((rng() - 0.5) * 700, 70 + rng() * 40, (rng() - 0.5) * 500 - 60);
      cl.userData.drift = 0.4 + rng() * 0.6;
      group.add(cl);
      Game.cityClouds = Game.cityClouds || [];
      Game.cityClouds.push(cl);
    }

    // ---- ground: sidewalk base, roads, beach, ocean ----
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: C.sidewalk }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 40);
    group.add(ground);

    var roadMat = new THREE.MeshLambertMaterial({ color: C.asphalt });
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
    var roadGeoX = new THREE.PlaneGeometry(CFG.CITY_HALF * 2 + CFG.ROAD_WIDTH, CFG.ROAD_WIDTH);
    var roadGeoZ = new THREE.PlaneGeometry(CFG.ROAD_WIDTH, CFG.CITY_HALF * 2 + CFG.ROAD_WIDTH);
    var dashGeo = new THREE.PlaneGeometry(3.2, 0.5);
    var edgeGeoX = new THREE.PlaneGeometry(CFG.CITY_HALF * 2 + CFG.ROAD_WIDTH, 0.35);
    var edgeGeoZ = new THREE.PlaneGeometry(0.35, CFG.CITY_HALF * 2 + CFG.ROAD_WIDTH);
    for (var i = -4; i <= 4; i++) {
      var c = i * CFG.PITCH;
      var rx = new THREE.Mesh(roadGeoX, roadMat);
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(0, 0.02, c);
      group.add(rx);
      var rz = new THREE.Mesh(roadGeoZ, roadMat);
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(c, 0.02, 0);
      group.add(rz);
      // white edge lines so the road reads as a road from the chase cam
      [-1, 1].forEach(function (s) {
        var ex = new THREE.Mesh(edgeGeoX, edgeMat);
        ex.rotation.x = -Math.PI / 2;
        ex.position.set(0, 0.04, c + s * (CFG.ROAD_WIDTH / 2 - 0.5));
        group.add(ex);
        var ez = new THREE.Mesh(edgeGeoZ, edgeMat);
        ez.rotation.x = -Math.PI / 2;
        ez.position.set(c + s * (CFG.ROAD_WIDTH / 2 - 0.5), 0.04, 0);
        group.add(ez);
      });
      // centre dashes along each road
      for (var d = -CFG.CITY_HALF; d < CFG.CITY_HALF; d += 9) {
        if (Math.abs(d - c) < CFG.ROAD_WIDTH) continue;
        var dx = new THREE.Mesh(dashGeo, dashMat);
        dx.rotation.x = -Math.PI / 2;
        dx.position.set(d, 0.04, c);
        group.add(dx);
        var dz = new THREE.Mesh(dashGeo, dashMat);
        dz.rotation.x = -Math.PI / 2;
        dz.rotation.z = Math.PI / 2;
        dz.position.set(c, 0.04, d);
        group.add(dz);
      }
    }

    // beach + ocean (south edge, z positive)
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(900, CFG.OCEAN_Z - CFG.BEACH_Z + 30),
      new THREE.MeshLambertMaterial({ color: C.sand }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, (CFG.BEACH_Z + CFG.OCEAN_Z) / 2 + 8);
    group.add(sand);
    var ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 500),
      new THREE.MeshPhongMaterial({ color: C.ocean, shininess: 90, specular: 0xffc890 }));
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.01, CFG.OCEAN_Z + 250);
    group.add(ocean);
    // beach umbrellas
    for (var u = 0; u < 8; u++) {
      var ux = -200 + u * 55 + rng() * 20;
      var uz = CFG.BEACH_Z + 8 + rng() * 8;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5),
        new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
      pole.position.set(ux, 1.3, uz);
      group.add(pole);
      var top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8),
        new THREE.MeshLambertMaterial({ color: [0xff6b6b, 0xffd21f, 0x4ecdc4, 0xff8c42][u % 4] }));
      top.position.set(ux, 2.9, uz);
      group.add(top);
    }

    // ---- blocks: buildings, parks, plaza ----
    var palette = C.buildingPalette;
    var buildingCount = 0;
    for (var bx = -4; bx < 4; bx++) {
      for (var bz = -4; bz < 4; bz++) {
        var blockCx = (bx + 0.5) * CFG.PITCH;
        var blockCz = (bz + 0.5) * CFG.PITCH;
        var roll = rng();
        if (roll < 0.10) {
          // park: grass + palms
          var park = new THREE.Mesh(new THREE.PlaneGeometry(CFG.BLOCK, CFG.BLOCK),
            new THREE.MeshLambertMaterial({ color: C.grass }));
          park.rotation.x = -Math.PI / 2;
          park.position.set(blockCx, 0.03, blockCz);
          group.add(park);
          for (var p = 0; p < 4; p++) {
            addPalm(group, rng,
              blockCx + (rng() - 0.5) * (CFG.BLOCK - 10),
              blockCz + (rng() - 0.5) * (CFG.BLOCK - 10));
          }
          continue;
        }
        if (roll < 0.16) {
          // plaza: open paved square with palms at corners
          addPalm(group, rng, blockCx - 14, blockCz - 14);
          addPalm(group, rng, blockCx + 14, blockCz - 14);
          addPalm(group, rng, blockCx - 14, blockCz + 14);
          addPalm(group, rng, blockCx + 14, blockCz + 14);
          continue;
        }
        // buildings: 1 tall tower or 2-4 mid-rise
        var centreDist = Math.abs(blockCx) + Math.abs(blockCz);
        var tallBoost = centreDist < 110 ? 26 : 0;
        if (rng() < 0.35) {
          var h = 34 + rng() * 34 + tallBoost;
          addBuilding(group, rng, blockCx, blockCz,
            22 + rng() * 10, 22 + rng() * 10, h, palette);
          buildingCount++;
        } else {
          var n = 2 + Math.floor(rng() * 2);
          for (var b = 0; b < n; b++) {
            var ox = (b % 2 === 0 ? -9 : 9) + (rng() - 0.5) * 4;
            var oz = (b < 2 ? -9 : 9) + (rng() - 0.5) * 4;
            var hb = 12 + rng() * 22 + tallBoost * 0.4;
            addBuilding(group, rng, blockCx + ox, blockCz + oz,
              14 + rng() * 5, 14 + rng() * 5, hb, palette);
            buildingCount++;
          }
        }
      }
    }

    // ---- palms + lamps along the roads ----
    for (var li = -4; li <= 4; li++) {
      var lc = li * CFG.PITCH;
      for (var s = -CFG.CITY_HALF + 20; s < CFG.CITY_HALF; s += 54) {
        if (rng() < 0.75) addPalm(group, rng, lc + CFG.ROAD_WIDTH / 2 + 2.5, s + 12);
        if (rng() < 0.5) addLamp(group, lc - CFG.ROAD_WIDTH / 2 - 2.5, s + 30);
        if (rng() < 0.5) addLamp(group, s + 30, lc + CFG.ROAD_WIDTH / 2 + 2.5);
      }
    }

    scene.add(group);
    Game.city = {
      group: group,
      colliders: colliders,
      buildingCount: buildingCount,
      palmCount: palms.length,
      randomRoadPoint: function (r) {
        // random point on a random road, lane offset included
        var horizontal = r() < 0.5;
        var road = (Math.floor(r() * 9) - 4) * CFG.PITCH;
        var along = (r() * 2 - 1) * (CFG.CITY_HALF - 10);
        var lane = (r() < 0.5 ? -3.4 : 3.4);
        return horizontal ? { x: along, z: road + lane } : { x: road + lane, z: along };
      },
      randomSidewalkPoint: function (r) {
        var road = (Math.floor(r() * 9) - 4) * CFG.PITCH;
        var along = (r() * 2 - 1) * (CFG.CITY_HALF - 10);
        var side = (r() < 0.5 ? -1 : 1) * (CFG.ROAD_WIDTH / 2 + 2.2);
        return r() < 0.5 ? { x: along, z: road + side } : { x: road + side, z: along };
      },
      // circle (x,z,r) vs building AABBs: returns push-out correction or null
      collideCircle: function (x, z, radius) {
        for (var i = 0; i < colliders.length; i++) {
          var c = colliders[i];
          var nx = Math.max(c.minX, Math.min(x, c.maxX));
          var nz = Math.max(c.minZ, Math.min(z, c.maxZ));
          var dx = x - nx, dz = z - nz;
          var d2 = dx * dx + dz * dz;
          if (d2 < radius * radius) {
            if (d2 < 0.0001) return { x: x + radius, z: z };
            var d = Math.sqrt(d2);
            return { x: nx + dx / d * radius, z: nz + dz / d * radius };
          }
        }
        return null;
      }
    };
    return Game.city;
  }

  Game.buildCity = buildCity;
})();
