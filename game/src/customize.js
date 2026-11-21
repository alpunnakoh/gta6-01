// SUNSET SHORES — customize.js
// CustomizeSystem: the Marina Garage. Press G while driving and Leo's
// ride gets the works — paint, wheels, a spoiler, neon underglow, and
// real performance parts (engine levels that raise the top speed, armor
// levels that raise the car's max health). Everything costs cash, the
// mods stick to the car they're bought for, and the setup is saved, so
// the orange coupe Leo wakes up in is the one he built. The panel is a
// DOM overlay like the help screen: buttons, swatches, prices, no
// mouse-look fighting, because the game keeps running behind it.
(function () {
  'use strict';
  var CFG = Game.CFG;

  var PAINTS = [
    { name: 'Sunset Orange', color: 0xff7a1a },
    { name: 'Crimson', color: 0xd8443c },
    { name: 'Ocean Blue', color: 0x3c7ad8 },
    { name: 'Palm Green', color: 0x4ec8a0 },
    { name: 'Royal Purple', color: 0x7a4ec8 },
    { name: 'Pearl White', color: 0xe8e8e8 },
    { name: 'Midnight', color: 0x2a2f38 },
    { name: 'Taxi Yellow', color: 0xffd21f }
  ];
  var NEONS = [
    { name: 'Off', color: null },
    { name: 'Cyan', color: 0x4ecdc4 },
    { name: 'Pink', color: 0xff6bd8 },
    { name: 'Gold', color: 0xffd21f },
    { name: 'Green', color: 0x3ddc5a },
    { name: 'Purple', color: 0x9a6bff }
  ];
  var WHEELS = ['Stock', 'Sport', 'Chunky'];

  function CustomizeSystem(scene, rng, world) {
    this.scene = scene;
    this.world = world || {};
    this.open = false;
    this.mods = { paint: 0xff7a1a, wheels: 0, spoiler: false, neon: null, engine: 0, armor: 0 };
    this._panel = null;
    this._cashLine = null;
    this._buildPanel();
  }

  CustomizeSystem.prototype._row = function (title) {
    var row = document.createElement('div');
    row.className = 'garage-row';
    var lab = document.createElement('div');
    lab.className = 'garage-label';
    lab.textContent = title;
    row.appendChild(lab);
    var btns = document.createElement('div');
    btns.className = 'garage-btns';
    row.appendChild(btns);
    this._panel.appendChild(row);
    return btns;
  };

  CustomizeSystem.prototype._btn = function (parent, text, fn, active) {
    var b = document.createElement('button');
    b.className = 'garage-btn' + (active ? ' active' : '');
    b.textContent = text;
    b.addEventListener('click', fn);
    parent.appendChild(b);
    return b;
  };

  CustomizeSystem.prototype._buildPanel = function () {
    var self = this;
    var panel = document.createElement('div');
    panel.className = 'garage';
    panel.style.display = 'none';
    var title = document.createElement('div');
    title.className = 'garage-title';
    title.textContent = 'MARINA GARAGE — CUSTOMIZE YOUR RIDE';
    panel.appendChild(title);
    var sub = document.createElement('div');
    sub.className = 'garage-sub';
    sub.textContent = 'Mods stick to the car you are driving. Press G to close.';
    panel.appendChild(sub);
    this._panel = panel;
    // paint swatches
    var paints = this._row('PAINT — $' + CFG.CUSTOM_PAINT_COST);
    PAINTS.forEach(function (p) {
      var b = self._btn(paints, p.name, function () { self._buyPaint(p); }, p.color === self.mods.paint);
      b.style.borderLeft = '6px solid #' + ('000000' + p.color.toString(16)).slice(-6);
      b.dataset.paint = p.color;
    });
    // wheels
    var wheels = this._row('WHEELS — $' + CFG.CUSTOM_WHEEL_COST);
    WHEELS.forEach(function (w, i) {
      var b = self._btn(wheels, w, function () { self._buyWheels(i); }, i === self.mods.wheels);
      b.dataset.wheels = i;
    });
    // spoiler + neon
    var spoiler = this._row('SPOILER — $' + CFG.CUSTOM_SPOILER_COST);
    this._spoilerBtn = this._btn(spoiler, 'Add spoiler', function () { self._buySpoiler(); }, this.mods.spoiler);
    var neon = this._row('NEON UNDERGLOW — $' + CFG.CUSTOM_NEON_COST);
    NEONS.forEach(function (n) {
      var b = self._btn(neon, n.name, function () { self._buyNeon(n.color); }, n.color === self.mods.neon);
      if (n.color) b.style.borderLeft = '6px solid #' + ('000000' + n.color.toString(16)).slice(-6);
      b.dataset.neon = n.color === null ? 'off' : n.color;
    });
    // engine levels
    var engine = this._row('ENGINE — +3 top speed / level');
    for (var e = 1; e <= 3; e++) {
      (function (lvl) {
        var b = self._btn(engine, 'Lv' + lvl + ' $' + CFG.CUSTOM_ENGINE_COSTS[lvl - 1],
          function () { self._buyEngine(lvl); }, lvl === self.mods.engine);
        b.dataset.engine = lvl;
      })(e);
    }
    // armor levels
    var armor = this._row('ARMOR — +50 max health / level');
    for (var a = 1; a <= 2; a++) {
      (function (lvl) {
        var b = self._btn(armor, 'Lv' + lvl + ' $' + CFG.CUSTOM_ARMOR_COSTS[lvl - 1],
          function () { self._buyArmor(lvl); }, lvl === self.mods.armor);
        b.dataset.armor = lvl;
      })(a);
    }
    this._cashLine = document.createElement('div');
    this._cashLine.className = 'garage-cash';
    panel.appendChild(this._cashLine);
    var close = document.createElement('button');
    close.className = 'btn primary garage-close';
    close.textContent = 'BACK TO THE STREETS (G)';
    close.addEventListener('click', function () { self.toggle(); });
    panel.appendChild(close);
    document.body.appendChild(panel);
  };

  CustomizeSystem.prototype._refresh = function () {
    var app = this.world.app;
    if (this._cashLine && app) {
      this._cashLine.textContent = 'Cash: $' + app.cash.toLocaleString('en-US') +
        '  •  Engine Lv' + this.mods.engine + '  •  Armor Lv' + this.mods.armor +
        (this.mods.spoiler ? '  •  Spoiler' : '') +
        (this.mods.neon ? '  •  Neon' : '');
    }
    // mark the active buttons without rebuilding the panel — every row
    // carries its own dataset key (paint, wheels, neon, engine, armor),
    // so buying a mod moves the highlight to the new button
    var btns = this._panel.querySelectorAll('.garage-btn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.dataset.paint) {
        b.classList.toggle('active', Number(b.dataset.paint) === this.mods.paint);
      }
      if (b.dataset.wheels !== undefined && b.dataset.wheels !== '') {
        b.classList.toggle('active', Number(b.dataset.wheels) === this.mods.wheels);
      }
      if (b.dataset.neon !== undefined && b.dataset.neon !== '') {
        b.classList.toggle('active',
          b.dataset.neon === 'off' ? this.mods.neon === null : Number(b.dataset.neon) === this.mods.neon);
      }
      if (b.dataset.engine !== undefined && b.dataset.engine !== '') {
        b.classList.toggle('active', Number(b.dataset.engine) === this.mods.engine);
      }
      if (b.dataset.armor !== undefined && b.dataset.armor !== '') {
        b.classList.toggle('active', Number(b.dataset.armor) === this.mods.armor);
      }
    }
    if (this._spoilerBtn) {
      this._spoilerBtn.classList.toggle('active', this.mods.spoiler);
      this._spoilerBtn.textContent = this.mods.spoiler ? 'Spoiler fitted ✓' : 'Add spoiler';
    }
  };

  CustomizeSystem.prototype._spend = function (amount) {
    var app = this.world.app;
    if (!app || app.cash < amount) {
      if (this.world.hud) this.world.hud.notify('Not enough cash — you need $' + amount + '.', 'bad');
      return false;
    }
    app.cash -= amount;
    if (app.hud) app.hud.setCash(app.cash);
    if (this.world.audio) this.world.audio.cashSound();
    return true;
  };

  CustomizeSystem.prototype._car = function () {
    var w = this.world;
    return w.player ? w.player.inCar : null;
  };

  CustomizeSystem.prototype._buyPaint = function (p) {
    if (this.mods.paint === p.color) return;
    if (!this._spend(CFG.CUSTOM_PAINT_COST)) return;
    this.mods.paint = p.color;
    var car = this._car();
    if (car) Game.VehicleFactory.applyPaint(car, p.color);
    if (this.world.hud) this.world.hud.notify('Fresh paint: ' + p.name + '.', 'good');
    this._refresh();
    this._save();
  };

  CustomizeSystem.prototype._buyWheels = function (i) {
    if (this.mods.wheels === i) return;
    if (!this._spend(CFG.CUSTOM_WHEEL_COST)) return;
    this.mods.wheels = i;
    var car = this._car();
    if (car) Game.VehicleFactory.applyWheelSize(car, i);
    if (this.world.hud) this.world.hud.notify('Wheels: ' + WHEELS[i] + '.', 'good');
    this._refresh();
    this._save();
  };

  CustomizeSystem.prototype._buySpoiler = function () {
    if (this.mods.spoiler) return;
    if (!this._spend(CFG.CUSTOM_SPOILER_COST)) return;
    this.mods.spoiler = true;
    var car = this._car();
    if (car) Game.VehicleFactory.addSpoilerMesh(car);
    if (this.world.hud) this.world.hud.notify('Spoiler fitted — downforce and looks.', 'good');
    this._refresh();
    this._save();
  };

  CustomizeSystem.prototype._buyNeon = function (color) {
    if (this.mods.neon === color) return;
    if (color && !this._spend(CFG.CUSTOM_NEON_COST)) return;
    this.mods.neon = color;
    var car = this._car();
    if (car) Game.VehicleFactory.addNeonMesh(car, color);
    if (this.world.hud) {
      this.world.hud.notify(color ? 'Neon underglow on — the bay will see you coming.' : 'Neon off.', 'good');
    }
    this._refresh();
    this._save();
  };

  CustomizeSystem.prototype._buyEngine = function (lvl) {
    if (this.mods.engine === lvl) return;
    if (lvl < this.mods.engine) return; // no downgrades
    var cost = CFG.CUSTOM_ENGINE_COSTS[lvl - 1];
    if (!this._spend(cost)) return;
    this.mods.engine = lvl;
    var car = this._car();
    if (car) this.applyTo(car);
    if (this.world.hud) {
      this.world.hud.notify('Engine Lv' + lvl + ' fitted — top speed up.', 'good');
    }
    this._refresh();
    this._save();
  };

  CustomizeSystem.prototype._buyArmor = function (lvl) {
    if (this.mods.armor === lvl) return;
    if (lvl < this.mods.armor) return;
    var cost = CFG.CUSTOM_ARMOR_COSTS[lvl - 1];
    if (!this._spend(cost)) return;
    this.mods.armor = lvl;
    var car = this._car();
    if (car) this.applyTo(car);
    if (this.world.hud) {
      this.world.hud.notify('Armor Lv' + lvl + ' fitted — the car takes more punishment.', 'good');
    }
    this._refresh();
    this._save();
  };

  // Put every bought mod onto a car: paint, wheels, spoiler, neon, and
  // the performance parts (engine top speed, armor max health).
  CustomizeSystem.prototype.applyTo = function (car) {
    if (!car) return;
    if (car.baseTopSpeed === undefined) car.baseTopSpeed = car.topSpeed;
    Game.VehicleFactory.applyPaint(car, this.mods.paint);
    Game.VehicleFactory.applyWheelSize(car, this.mods.wheels);
    if (this.mods.spoiler) Game.VehicleFactory.addSpoilerMesh(car);
    Game.VehicleFactory.addNeonMesh(car, this.mods.neon);
    car.topSpeed = car.baseTopSpeed + this.mods.engine * 3;
    car.maxHealth = CFG.CAR_HEALTH + this.mods.armor * 50;
    if (car.health > car.maxHealth) car.health = car.maxHealth;
  };

  CustomizeSystem.prototype.toggle = function () {
    var w = this.world;
    if (this.open) {
      this.open = false;
      this._panel.style.display = 'none';
      return;
    }
    if (!w.player || !w.player.inCar) {
      if (w.hud) w.hud.notify('Get in a car first — the garage works on the ride you are driving.', '');
      return;
    }
    this.open = true;
    this._panel.style.display = 'block';
    this._refresh();
    if (w.audio) w.audio.uiClick();
  };

  CustomizeSystem.prototype.restore = function (mods) {
    if (!mods) return;
    this.mods = {
      paint: mods.paint !== undefined ? mods.paint : 0xff7a1a,
      wheels: mods.wheels || 0,
      spoiler: !!mods.spoiler,
      neon: mods.neon === undefined ? null : mods.neon,
      engine: mods.engine || 0,
      armor: mods.armor || 0
    };
  };

  CustomizeSystem.prototype._save = function () {
    var app = this.world.app;
    if (app && app._saveNow) app._saveNow();
  };

  // Neon pulse: the underglow breathes while the panel is open or the
  // car drives at night.
  CustomizeSystem.prototype.update = function (dt) {
    var car = this._car();
    if (!car || !car.mesh || !car.mesh.userData.neonGlow) return;
    var glow = car.mesh.userData.neonGlow;
    glow.material.opacity = 0.45 + Math.sin(performance.now() * 0.004) * 0.15;
  };

  Game.CustomizeSystem = CustomizeSystem;
})();
