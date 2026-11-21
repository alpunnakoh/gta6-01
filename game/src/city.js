// SUNSET SHORES — city.js
// buildCity(scene, seed): the whole of Palmera Bay — a 9x9 road grid, ~120
// procedural buildings with canvas window textures and rooftop props,
// billboards and neon signs, palms and street lamps, a boardwalk pier with
// a getaway boat, beach + ocean, and a low sunset sun. Exposes
// Game.city.colliders (building AABBs), Game.city.sun / .hemi /
// .sunSprite / .lampHeads (for the day-night cycle), and
// Game.city.randomRoadPoint(rng) / randomSidewalkPoint(rng).
(function () {
  'use strict';
  var CFG = Game.CFG;

  var colliders = [];   // {minX,maxX,minZ,maxZ}
  var lampHeads = [];   // lamp globe meshes, so night can light them up
  var palmCount = 0;

  function cssHex(hex) {
    return '#' + ('000000' + hex.toString(16)).slice(-6);
  }

  // One canvas texture per building: shaded facade, a window grid with some
  // windows lit, a darker roof line, and — on taller towers — a balcony
  // stripe so the skyline does not read as flat slabs.
  function makeBuildingTexture(rng, baseColor, tall) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = baseColor;
    g.fillRect(0, 0, 128, 256);
    var grad = g.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.20)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0.24)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 256);
    var cols = 4 + Math.floor(rng() * 3);
    var rows = 8 + Math.floor(rng() * 8);
    var ww = 128 / cols, wh = 256 / rows;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var lit = rng() < 0.30;
        g.fillStyle = lit ? 'rgba(255,214,140,0.95)' : 'rgba(28,40,58,0.85)';
        g.fillRect(x * ww + ww * 0.22, y * wh + wh * 0.25, ww * 0.56, ww * 0.5);
      }
    }
    if (tall) {
      // balcony stripes every few floors on the tall towers
      g.fillStyle = 'rgba(0,0,0,0.28)';
      for (var by = 3; by < rows; by += 4) {
        g.fillRect(0, by * wh - 2, 128, 4);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, 128, 6);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // A glowing text sign on a canvas texture — billboards and shop fronts.
  function makeSignTexture(text, fg, bg) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = fg;
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 34);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function addBuilding(group, rng, x, z, w, d, h, palette, opts) {
    opts = opts || {};
    var color = opts.color !== undefined ? opts.color : palette[Math.floor(rng() * palette.length)];
    var tex = makeBuildingTexture(rng, cssHex(color), h > 40);
    tex.repeat.set(Math.max(1, Math.round(w / 15)), Math.max(1, Math.round(h / 15)));
    var mat = new THREE.MeshLambertMaterial({ map: tex });
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    group.add(mesh);
    // rooftop props: AC box and, on some roofs, a water tower
    if (rng() < 0.65) {
      var roof = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(4, w * 0.3), 1.6, Math.min(4, d * 0.3)),
        new THREE.MeshLambertMaterial({ color: 0x6a6a6a }));
      roof.position.set(x + (rng() - 0.5) * w * 0.4, h + 0.8, z + (rng() - 0.5) * d * 0.4);
      group.add(roof);
    }
    if (rng() < 0.22) {
      var tank = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 3.4, 8),
        new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
      tank.position.set(x + (rng() - 0.5) * w * 0.4, h + 3.2, z + (rng() - 0.5) * d * 0.4);
      group.add(tank);
      var legs = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.6, 3.4),
        new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
      legs.position.set(tank.position.x, h + 0.8, tank.position.z);
      group.add(legs);
    }
    // neon sign strip on some mid-rise fronts
    if (opts.sign || rng() < 0.18) {
      var signTex = makeSignTexture(opts.sign || 'PALMERA',
        opts.signFg || '#ffd21f', opts.signBg || '#141a24');
      var sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.8, 18), 3.2),
        new THREE.MeshBasicMaterial({ map: signTex }));
      sign.position.set(x, Math.min(h - 2.5, 12), z + d / 2 + 0.15);
      group.add(sign);
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }

  function addPalm(group, rng, x, z) {
    var h = 7 + rng() * 3;
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.38, h, 6),
      new THREE.MeshLambertMaterial({ color: CFG.COLORS.palmTrunk }));
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = (rng() - 0.5) * 0.12;
    group.add(trunk);
    // layered fronds: two cones so the crown reads as a palm, not a spike
    var crown = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.2, 7),
      new THREE.MeshLambertMaterial({ color: CFG.COLORS.palmLeaf, flatShading: true }));
    crown.position.set(x + trunk.rotation.z * -h * 0.5, h + 0.9, z);
    group.add(crown);
    var crown2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 1.6, 7),
      new THREE.MeshLambertMaterial({ color: 0x55a55f, flatShading: true }));
    crown2.position.set(crown.position.x, h + 1.9, z);
    group.add(crown2);
    palmCount++;
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
    lampHeads.push(head);
  }

  // The boardwalk pier: wooden deck on posts out into the ocean, with the
  // white getaway boat moored at the end (the M6 finale target).
  function buildPier(group) {
    var wood = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
    var darkWood = new THREE.MeshLambertMaterial({ color: 0x6a5238 });
    for (var z = CFG.BEACH_Z + 2; z <= CFG.PIER_END_Z; z += 6) {
      var plank = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 5.6), wood);
      plank.position.set(CFG.PIER_X, 0.9, z);
      group.add(plank);
      [-3.4, 3.4].forEach(function (dx) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), darkWood);
        post.position.set(CFG.PIER_X + dx, 0.2, z);
        group.add(post);
      });
    }
    // railings
    [-4.2, 4.2].forEach(function (dx) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, CFG.PIER_END_Z - CFG.BEACH_Z), darkWood);
      rail.position.set(CFG.PIER_X + dx, 2.0, (CFG.BEACH_Z + CFG.PIER_END_Z) / 2);
      group.add(rail);
    });
    // the boat: white hull, cabin, outboard
    var boat = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    hull.position.y = 0.6;
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 2.6),
      new THREE.MeshLambertMaterial({ color: 0x1f8a8a }));
    cabin.position.set(0, 1.6, -0.6);
    var motor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    motor.position.set(0, 0.7, -4.2);
    boat.add(hull, cabin, motor);
    boat.position.set(CFG.PIER_X, 0.4, CFG.PIER_END_Z + 6);
    group.add(boat);
    return boat;
  }

  // Beachfront extras: a lighthouse with a sweeping beam at the pier's far
  // end, a row of colourful boardwalk shops, stunt ramps on four roads, and
  // the Pay 'n Spray arch at the garage (drive in to repair and lose heat).
  // Returns {ramps, spray, lighthouseBeam} for the game loop.
  function buildBeachExtras(group, rng) {
    // lighthouse: red-white striped tower on the rocks past the pier
    var lh = new THREE.Group();
    var stripeCols = [0xf2f2f2, 0xd8443c];
    for (var s = 0; s < 5; s++) {
      var seg = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2 - s * 0.15, 2.4 - s * 0.15, 3.4, 10),
        new THREE.MeshLambertMaterial({ color: stripeCols[s % 2] }));
      seg.position.y = 1.7 + s * 3.4;
      lh.add(seg);
    }
    var lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2, 8),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    lampRoom.position.y = 19;
    var lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lampBulb.position.y = 19;
    var beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.25 }));
    beam.position.set(15, 19, 0);
    var beamPivot = new THREE.Group();
    beamPivot.position.y = 19;
    beamPivot.add(beam);
    lh.add(lampRoom, lampBulb, beamPivot);
    lh.position.set(CFG.PIER_X - 26, 0, CFG.PIER_END_Z + 14);
    group.add(lh);
    // rocks under the lighthouse: the rifle crate and the lighthouse relic
    // sit on this outcrop, not on open water — the ocean plane starts at
    // OCEAN_Z and the pier ends 14 m short of the tower
    var rockMat = new THREE.MeshLambertMaterial({ color: 0x5a5a52, flatShading: true });
    [
      { x: -134, z: 310, s: 5.5, y: 0.7 },
      { x: -138, z: 304, s: 3.6, y: 0.5 },
      { x: -130, z: 303, s: 3.2, y: 0.45 },
      { x: -134, z: 300, s: 2.6, y: 0.4 },
      { x: -139, z: 312, s: 3.0, y: 0.5 },
      { x: -129, z: 311, s: 2.4, y: 0.4 }
    ].forEach(function (r) {
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r.s, 0), rockMat);
      rock.position.set(r.x, r.y, r.z);
      rock.scale.y = 0.45;
      rock.rotation.y = rng() * Math.PI;
      group.add(rock);
    });
    // boardwalk shops: small striped huts along the sand
    var shopCols = [0xff6b6b, 0x4ecdc4, 0xffd21f, 0x7a4ec8, 0xff8c42];
    for (var i = 0; i < 5; i++) {
      var sx = -160 + i * 80 + rng() * 10;
      var hut = new THREE.Group();
      var walls = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 5),
        new THREE.MeshLambertMaterial({ color: shopCols[i % shopCols.length] }));
      walls.position.y = 1.7;
      var roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2, 4),
        new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
      roof.position.y = 4.4;
      roof.rotation.y = Math.PI / 4;
      var counter = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 1),
        new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
      counter.position.set(0, 1.1, 2.8);
      hut.add(walls, roof, counter);
      hut.position.set(sx, 0, CFG.BEACH_Z + 5);
      group.add(hut);
    }
    // stunt ramps: wedges on four roads, each with a trigger zone
    var ramps = [];
    var rampSpots = [
      { x: 54, z: 0, heading: 0 },
      { x: -54, z: 54, heading: Math.PI / 2 },
      { x: 0, z: -108, heading: Math.PI },
      { x: 108, z: -54, heading: -Math.PI / 2 }
    ];
    rampSpots.forEach(function (rs) {
      var wedge = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 8),
        new THREE.MeshLambertMaterial({ color: 0xffd21f }));
      wedge.position.set(rs.x, 0.8, rs.z);
      wedge.rotation.y = rs.heading;
      wedge.rotation.x = 0; // a flat-topped launch pad reads better than a wedge
      group.add(wedge);
      var chevron = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.2, 1),
        new THREE.MeshBasicMaterial({ color: 0x14161a }));
      chevron.position.set(rs.x, 1.65, rs.z);
      chevron.rotation.y = rs.heading;
      group.add(chevron);
      ramps.push({ x: rs.x, z: rs.z, used: false });
    });
    // Pay 'n Spray arch at the garage: two checkered posts + a SPRAY sign
    var spray = { x: 27, z: -108 };
    var checker = makeSignTexture('SPRAY', '#14161a', '#ffffff');
    [-5, 5].forEach(function (dx) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      post.position.set(spray.x + dx, 2.5, spray.z);
      group.add(post);
    });
    var spraySign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.4),
      new THREE.MeshBasicMaterial({ map: checker }));
    spraySign.position.set(spray.x, 5.4, spray.z);
    group.add(spraySign);
    var sprayPad = new THREE.Mesh(new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({ color: 0x2a6a3a, transparent: true, opacity: 0.5 }));
    sprayPad.rotation.x = -Math.PI / 2;
    sprayPad.position.set(spray.x, 0.05, spray.z);
    group.add(sprayPad);
    return { ramps: ramps, spray: spray, lighthouseBeam: beamPivot };
  }

  function buildCity(scene, seed) {
    var rng = Game.rng(seed || 1);
    var group = new THREE.Group();
    group.name = 'PalmeraBay';
    var C = CFG.COLORS;

    // ---- sky, fog, lights ----
    scene.background = new THREE.Color(C.skyHorizon);
    scene.fog = new THREE.Fog(C.fog, 180, 520);
    // warm hemisphere + a soft eastern fill so the shadow sides of the
    // buildings never go dead black (v1's right-hand blocks did)
    var hemi = new THREE.HemisphereLight(0xffd9b0, 0x4a5a7a, 1.0);
    scene.add(hemi);
    var fill = new THREE.DirectionalLight(0x9fb8d8, 0.45);
    fill.position.set(160, 120, -120);
    scene.add(fill);
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
    var boat = buildPier(group);
    var extras = buildBeachExtras(group, rng);

    // ---- blocks: buildings, parks, plaza, landmarks ----
    var palette = C.buildingPalette;
    var buildingCount = 0;
    // named landmarks, one per story beat, so the city has places — not
    // just a grid. The garage (M1), the bank (M5) and the safehouse (M2).
    var landmarks = [
      { bx: 0, bz: -2, w: 26, d: 20, h: 14, color: 0x8a6a3a, sign: 'MARINA GARAGE', signFg: '#ffd21f' },
      { bx: 1, bz: 1, w: 30, d: 24, h: 46, color: 0xe8e2d2, sign: 'BANK OF PALMERA', signFg: '#ffffff', signBg: '#1c4a6a' },
      { bx: -2, bz: 0, w: 18, d: 16, h: 10, color: 0xc98f7a, sign: 'SAFEHOUSE', signFg: '#7dff8a' }
    ];
    var landmarkKey = {};
    landmarks.forEach(function (lm) { landmarkKey[lm.bx + ',' + lm.bz] = lm; });
    for (var bx = -4; bx < 4; bx++) {
      for (var bz = -4; bz < 4; bz++) {
        var blockCx = (bx + 0.5) * CFG.PITCH;
        var blockCz = (bz + 0.5) * CFG.PITCH;
        var lm = landmarkKey[bx + ',' + bz];
        if (lm) {
          addBuilding(group, rng, blockCx, blockCz, lm.w, lm.d, lm.h, palette,
            { color: lm.color, sign: lm.sign, signFg: lm.signFg, signBg: lm.signBg });
          buildingCount++;
          continue;
        }
        var roll = rng();
        if (roll < 0.10) {
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
          addPalm(group, rng, blockCx - 14, blockCz - 14);
          addPalm(group, rng, blockCx + 14, blockCz - 14);
          addPalm(group, rng, blockCx - 14, blockCz + 14);
          addPalm(group, rng, blockCx + 14, blockCz + 14);
          continue;
        }
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

    // ---- Port North: the new district north of the grid ----
    // district.js builds the yard and pushes its colliders into the same
    // array, so cars and Leo collide with the warehouses and containers
    // exactly like the downtown buildings.
    var port = null;
    if (Game.buildPortDistrict) {
      port = Game.buildPortDistrict(scene, rng, colliders);
    }

    scene.add(group);
    Game.city = {
      group: group,
      colliders: colliders,
      port: port,
      buildingCount: buildingCount,
      palmCount: palmCount,
      sun: sun,
      hemi: hemi,
      sunSprite: sunSprite,
      lampHeads: lampHeads,
      boat: boat,
      ramps: extras.ramps,
      spray: extras.spray,
      lighthouseBeam: extras.lighthouseBeam,
      randomRoadPoint: function (r) {
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
