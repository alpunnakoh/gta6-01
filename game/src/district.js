// SUNSET SHORES — district.js
// buildPortDistrict: Port North — the new district north of the grid,
// where the container ships come in and where M7's crew waits. It is a
// working yard: an asphalt lot with two internal roads that meet the grid
// road at z = -216, three warehouses, stacked containers in the yard,
// two gantry cranes that slide along the dock (their trolleys move and
// their hooks rise and fall), a dock office, a dry dock with a hull under
// repair, fences with real gate gaps so the player can drive in, a big
// PORT NORTH sign, and lamp posts for the night. The yard is M7's
// territory and the crate and relic spots anchor there too.
(function () {
  'use strict';
  var CFG = Game.CFG;

  // Yard bounds: x from -180 to 180, z from -232 down to -312. The yard's
  // two internal roads run down to the grid road at z = -216, at x = -108
  // and x = +108, so traffic can drive straight in from the city.
  var YARD = { x0: -180, x1: 180, z0: -312, z1: -232 };
  var GATE_X = [-108, 108];

  function box(mat, w, h, d, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  function buildContainer(rng, x, y, z, color) {
    var g = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: color });
    var body = box(mat, 6, 2.6, 2.6, 0, 0, 0);
    body.position.y = 1.3;
    g.add(body);
    // corrugation ribs so the box reads as a container, not a plain cube
    for (var i = -2; i <= 2; i++) {
      var rib = box(new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
        0.18, 2.4, 2.64, i * 1.2, 1.3, 0);
      g.add(rib);
    }
    g.position.set(x, y, z);
    return g;
  }

  function buildWarehouse(rng, x, z, w, d, h, color, label) {
    var g = new THREE.Group();
    var wall = new THREE.MeshLambertMaterial({ color: color });
    var body = box(wall, w, h, d, 0, h / 2, 0);
    g.add(body);
    // shallow gable roof
    var roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.62, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
    roof.position.y = h + 1.2;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = d / w;
    g.add(roof);
    // big sliding door on the south face
    var door = box(new THREE.MeshLambertMaterial({ color: 0x222222 }), w * 0.4, h * 0.65, 0.2, 0, h * 0.33, d / 2 + 0.1);
    g.add(door);
    // label canvas over the door
    if (label) {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 64;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#22252a';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#ffd21f';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 34);
      var tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, w * 0.14),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      sign.position.set(0, h * 0.85, d / 2 + 0.12);
      g.add(sign);
    }
    g.position.set(x, 0, z);
    return g;
  }

  // A gantry crane: two legs, a top beam, a trolley that slides along it,
  // and a hook on a cable that rises and falls. update(dt) keeps it alive.
  function buildCrane(x, z, span, rng) {
    var g = new THREE.Group();
    var steel = new THREE.MeshLambertMaterial({ color: 0xffd21f });
    var dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
    var legL = box(steel, 1.4, 26, 1.4, -span / 2, 13, 0);
    var legR = box(steel, 1.4, 26, 1.4, span / 2, 13, 0);
    var beam = box(steel, span + 6, 1.6, 1.6, 0, 26, 0);
    var cab = box(dark, 4, 3, 3, -span / 2, 24.5, 0);
    var trolley = new THREE.Group();
    var tBody = box(dark, 2.4, 1.4, 2.4, 0, 25, 0);
    var cable = box(dark, 0.12, 8, 0.12, 0, 20.5, 0);
    var hook = box(steel, 1.6, 1.2, 1.6, 0, 16, 0);
    var load = box(new THREE.MeshLambertMaterial({ color: 0x3c7ad8 }), 4, 2.4, 2.4, 0, 14.4, 0);
    trolley.add(tBody, cable, hook, load);
    g.add(legL, legR, beam, cab, trolley);
    g.position.set(x, 0, z);
    g.userData = {
      trolley: trolley, cable: cable, hook: hook, load: load,
      span: span, phase: rng() * 10, speed: 0.25 + rng() * 0.2
    };
    return g;
  }

  Game.buildPortDistrict = function (scene, rng, colliders) {
    var group = new THREE.Group();
    var asphalt = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    var concrete = new THREE.MeshLambertMaterial({ color: 0x4a4d55 });
    var fenceMat = new THREE.MeshLambertMaterial({ color: 0x8a8f98 });

    // the yard floor, then two internal roads down to the grid
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(YARD.x1 - YARD.x0, YARD.z1 - YARD.z0),
      asphalt);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.02, (YARD.z0 + YARD.z1) / 2);
    floor.receiveShadow = true;
    group.add(floor);
    GATE_X.forEach(function (gx) {
      var road = new THREE.Mesh(new THREE.PlaneGeometry(12, 82),
        roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(gx, 0.04, -273);
      group.add(road);
      // centre line dashes
      for (var d = -308; d < -232; d += 8) {
        var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3),
          new THREE.MeshBasicMaterial({ color: 0xffd21f }));
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(gx, 0.06, d);
        group.add(dash);
      }
    });

    // three warehouses along the back of the yard
    var wh1 = buildWarehouse(rng, -120, -292, 44, 22, 10, 0x6a4a3a, 'WAREHOUSE A');
    var wh2 = buildWarehouse(rng, -30, -296, 52, 24, 12, 0x3a5a6a, 'WAREHOUSE B');
    var wh3 = buildWarehouse(rng, 80, -292, 44, 22, 10, 0x5a6a3a, 'WAREHOUSE C');
    group.add(wh1, wh2, wh3);
    // colliders match the city's format: {minX, maxX, minZ, maxZ}
    [[-120, -292, 44, 22], [-30, -296, 52, 24], [80, -292, 44, 22]].forEach(function (b) {
      colliders.push({ minX: b[0] - b[2] / 2, maxX: b[0] + b[2] / 2, minZ: b[1] - b[3] / 2, maxZ: b[1] + b[3] / 2 });
    });

    // container stacks: three rows of two-high boxes in the yard
    var colors = [0xd8443c, 0x3c7ad8, 0x4ec8a0, 0xffd21f, 0x7a4ec8];
    var stacks = [
      { x: -60, z: -252 }, { x: -30, z: -252 }, { x: 40, z: -252 },
      { x: 130, z: -252 }, { x: 160, z: -270 }, { x: -150, z: -270 }
    ];
    stacks.forEach(function (s, i) {
      var c1 = buildContainer(rng, s.x, 0, s.z, colors[i % colors.length]);
      var c2 = buildContainer(rng, s.x + 0.6, 2.6, s.z, colors[(i + 2) % colors.length]);
      c2.rotation.y = (i % 2 === 0) ? 0.05 : -0.05;
      group.add(c1, c2);
      colliders.push({ minX: s.x - 3, maxX: s.x + 3, minZ: s.z - 1.3, maxZ: s.z + 1.3 });
    });

    // two gantry cranes over the north edge of the yard
    var cranes = [
      buildCrane(-70, -290, 36, rng),
      buildCrane(60, -290, 36, rng)
    ];
    cranes.forEach(function (c) { group.add(c); });
    cranes.forEach(function (c) {
      colliders.push({ minX: c.position.x - 1, maxX: c.position.x + 1, minZ: c.position.z - 1, maxZ: c.position.z + 1 });
    });

    // dock office, small and lit
    var office = new THREE.Group();
    var ob = box(new THREE.MeshLambertMaterial({ color: 0xe8e4d8 }), 12, 5, 8, 0, 2.5, 0);
    var orf = box(new THREE.MeshLambertMaterial({ color: 0x2a4a6a }), 13, 0.4, 9, 0, 5.2, 0);
    var win = box(new THREE.MeshBasicMaterial({ color: 0xffd21f }), 8, 1.6, 0.2, 0, 3, 4.1);
    office.add(ob, orf, win);
    office.position.set(150, 0, -292);
    group.add(office);
    colliders.push({ minX: 144, maxX: 156, minZ: -296, maxZ: -288 });

    // dry dock: a concrete basin with a ship hull under repair
    var dock = new THREE.Group();
    var basin = box(concrete, 30, 1, 14, 0, 0.5, 0);
    var hull = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 18, 10, 1, false, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x8a2a2a }));
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.position.y = 2.6;
    var mast = box(new THREE.MeshLambertMaterial({ color: 0x666666 }), 0.4, 9, 0.4, 0, 8, 0);
    dock.add(basin, hull, mast);
    dock.position.set(20, 0, -300);
    group.add(dock);
    colliders.push({ minX: 5, maxX: 35, minZ: -307, maxZ: -293 });

    // a forklift, parked by the containers
    var fork = new THREE.Group();
    var fBody = box(new THREE.MeshLambertMaterial({ color: 0xffd21f }), 2.2, 1.6, 3, 0, 0.9, 0);
    var fMast = box(new THREE.MeshLambertMaterial({ color: 0x222222 }), 0.2, 3, 1.8, 0, 1.6, 1.6);
    var fWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    fWheel.rotation.z = Math.PI / 2;
    fWheel.position.set(1, 0.5, 0.8);
    fork.add(fBody, fMast, fWheel);
    fork.position.set(100, 0, -260);
    fork.rotation.y = 0.6;
    group.add(fork);

    // fences around the yard, with gaps at the two gate roads
    var fenceH = 3.2;
    function fenceRun(x0, x1, z, gapAt) {
      var segs = [];
      var cur = x0;
      var gaps = gapAt || [];
      gaps.sort(function (a, b) { return a - b; });
      gaps.forEach(function (g) {
        if (g - 7 > cur) segs.push([cur, g - 7]);
        cur = g + 7;
      });
      if (x1 > cur) segs.push([cur, x1]);
      segs.forEach(function (s) {
        var w = s[1] - s[0];
        if (w <= 0) return;
        var f = box(fenceMat, w, fenceH, 0.25, (s[0] + s[1]) / 2, fenceH / 2, z);
        group.add(f);
        for (var px = s[0] + 2; px < s[1]; px += 6) {
          var post = box(fenceMat, 0.3, fenceH + 0.4, 0.3, px, (fenceH + 0.4) / 2, z);
          group.add(post);
        }
      });
    }
    fenceRun(YARD.x0, YARD.x1, YARD.z1, GATE_X);
    fenceRun(YARD.x0, YARD.x1, YARD.z0, []);
    // side fences
    [-1, 1].forEach(function (side) {
      var x = side < 0 ? YARD.x0 : YARD.x1;
      var f = box(fenceMat, 0.25, fenceH, YARD.z1 - YARD.z0, x, fenceH / 2, (YARD.z0 + YARD.z1) / 2);
      group.add(f);
    });

    // big PORT NORTH sign on the south fence, facing the city
    var sc = document.createElement('canvas');
    sc.width = 512; sc.height = 96;
    var sctx = sc.getContext('2d');
    sctx.fillStyle = '#14161a';
    sctx.fillRect(0, 0, 512, 96);
    sctx.fillStyle = '#ffd21f';
    sctx.font = 'bold 54px sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('PORT NORTH', 256, 52);
    var stex = new THREE.CanvasTexture(sc);
    stex.colorSpace = THREE.SRGBColorSpace;
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.5),
      new THREE.MeshBasicMaterial({ map: stex }));
    sign.position.set(0, 5, YARD.z1 + 0.3);
    group.add(sign);
    var postL = box(fenceMat, 0.4, 5, 0.4, -11, 2.5, YARD.z1 + 0.1);
    var postR = box(fenceMat, 0.4, 5, 0.4, 11, 2.5, YARD.z1 + 0.1);
    group.add(postL, postR);

    // dock lamps for the night shift
    var lamps = [];
    GATE_X.forEach(function (gx) {
      [-238, -262, -286].forEach(function (z) {
        var pole = box(new THREE.MeshLambertMaterial({ color: 0x222222 }), 0.3, 8, 0.3, gx + 7, 4, z);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
        head.position.set(gx + 7, 8.2, z);
        group.add(pole, head);
        lamps.push(head);
      });
    });

    scene.add(group);
    return {
      group: group, cranes: cranes, lamps: lamps,
      bounds: YARD, gates: GATE_X,
      update: function (dt) {
        // cranes work all day: trolley slides, hook rises and falls
        cranes.forEach(function (c) {
          c.userData.phase += dt * c.userData.speed;
          var t = Math.sin(c.userData.phase) * 0.55;
          c.userData.trolley.position.x = t * c.userData.span;
          var drop = 8 + (Math.sin(c.userData.phase * 0.5) * 0.5 + 0.5) * 7;
          c.userData.cable.scale.y = drop / 8;
          c.userData.cable.position.y = 25 - drop / 2;
          c.userData.hook.position.y = 25 - drop - 1;
          c.userData.load.position.y = 25 - drop - 2.6;
        });
      }
    };
  };
})();
