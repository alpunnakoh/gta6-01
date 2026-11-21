// SUNSET SHORES — hud.js
// HudSystem: the whole DOM overlay — cash, health bar, ammo + weapon name,
// wanted stars, in-game clock, speedometer, mission objective panel,
// collectibles counter, taxi fare meter, notifications, the top-down MINIMAP
// canvas (player / mission / police / enemy / package blips), a red damage
// vignette that flashes when Leo is hurt, the start menu, pause screen with
// run statistics, help panel, and Busted / Wasted screens.
(function () {
  'use strict';
  var CFG = Game.CFG;

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function HudSystem() {
    var root = document.getElementById('hud');
    this.root = root;
    // damage vignette: red flash at the screen edges when Leo takes a hit
    this.vignette = el('div', 'vignette', root);
    // top-left: mission objective
    this.objectivePanel = el('div', 'panel objective', root);
    el('div', 'panel-title', this.objectivePanel).textContent = 'THE PALMERA JOB';
    this.objectiveText = el('div', 'objective-text', this.objectivePanel);
    this.objectiveText.textContent = 'Free roam';
    // mission timer bar (timed stages): fills as the clock runs down
    this.timerWrap = el('div', 'timer-wrap', this.objectivePanel);
    this.timerBar = el('div', 'timer-bar', this.timerWrap);
    this.timerWrap.style.display = 'none';
    // top-right: cash + wanted + clock + packages
    var tr = el('div', 'top-right', root);
    this.cashEl = el('div', 'cash', tr);
    this.cashEl.textContent = '$0';
    this.starsEl = el('div', 'stars', tr);
    this.clockEl = el('div', 'clock', tr);
    this.clockEl.textContent = '17:24';
    this.packagesEl = el('div', 'packages', tr);
    this.packagesEl.textContent = 'PACKAGES 0/12';
    // bottom-left: minimap + health
    var bl = el('div', 'bottom-left', root);
    this.mapCanvas = el('canvas', 'minimap', bl);
    this.mapCanvas.width = 190; this.mapCanvas.height = 190;
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.healthWrap = el('div', 'health-wrap', bl);
    this.healthBar = el('div', 'health-bar', this.healthWrap);
    this.healthText = el('div', 'health-text', this.healthWrap);
    this.healthText.textContent = 'LEO';
    // stamina bar (thin, under health): sprinting drains it, walking restores
    this.staminaWrap = el('div', 'stamina-wrap', bl);
    this.staminaBar = el('div', 'stamina-bar', this.staminaWrap);
    // bottom-right: speed + weapon + taxi fare + radio station
    var br = el('div', 'bottom-right', root);
    this.radioEl = el('div', 'radio', br);
    this.radioEl.textContent = '♪ SUNSET FM';
    this.taxiEl = el('div', 'taxi', br);
    this.speedEl = el('div', 'speed', br);
    this.speedEl.textContent = '';
    this.weaponEl = el('div', 'weapon', br);
    this.weaponEl.textContent = 'PISTOL';
    this.ammoEl = el('div', 'ammo', br);
    this.ammoEl.textContent = 'PISTOL  12 / 60';
    // centre: crosshair + notifications + hit marker
    this.crosshair = el('div', 'crosshair', root);
    this.crosshair.textContent = '+';
    this.notifyBox = el('div', 'notify-box', root);
    this.hitMarker = el('div', 'hitmarker', root);
    this.hitMarker.textContent = '✕';
    this.centerMsg = el('div', 'center-msg', root);
    // menus
    this.menu = document.getElementById('menu');
    this.menuTitle = this.menu.querySelector('h1');
    this.menuSub = this.menu.querySelector('.subtitle');
    this.btnNew = document.getElementById('btn-new');
    this.btnContinue = document.getElementById('btn-continue');
    this.btnHelp = document.getElementById('btn-help');
    this.pauseScreen = document.getElementById('pause');
    this.pauseStats = document.getElementById('pause-stats');
    this.endScreen = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.endText = document.getElementById('end-text');
    this.btnRespawn = document.getElementById('btn-respawn');
    this.helpPanel = document.getElementById('help');
    this.debug = document.getElementById('debug');
    this._notifyT = {};
  }

  HudSystem.prototype.setCash = function (cash) {
    this.cashEl.textContent = '$' + cash.toLocaleString('en-US');
  };

  HudSystem.prototype.setWanted = function (stars) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
    this.starsEl.textContent = s;
    this.starsEl.className = 'stars' + (stars > 0 ? ' hot' : '');
  };

  HudSystem.prototype.setClock = function (hour) {
    var h = Math.floor(hour) % 24;
    var m = Math.floor((hour % 1) * 60);
    this.clockEl.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  };

  HudSystem.prototype.setHealth = function (hp) {
    this.healthBar.style.width = Math.max(0, hp) + '%';
    this.healthBar.style.background = hp > 50 ? '#3ddc5a' : (hp > 25 ? '#ffcc33' : '#ff4444');
  };

  // Stamina: thin bar under health. Turns red while Leo is exhausted and
  // cannot sprint until it recovers.
  HudSystem.prototype.setStamina = function (value, max, exhausted) {
    var pct = Math.max(0, Math.min(100, value / max * 100));
    this.staminaBar.style.width = pct + '%';
    this.staminaBar.className = 'stamina-bar' + (exhausted ? ' exhausted' : '');
  };

  HudSystem.prototype.setRadio = function (stationName) {
    this.radioEl.textContent = '♪ ' + stationName;
  };

  // A red flash at the screen edges: the harder the hit, the stronger it is.
  HudSystem.prototype.flashDamage = function (strength) {
    var v = this.vignette;
    v.style.opacity = String(Math.min(0.85, 0.25 + (strength || 0.3)));
    setTimeout(function () { v.style.opacity = '0'; }, 260);
  };

  HudSystem.prototype.setAmmo = function (ammo, reserve, reloading) {
    this.ammoEl.textContent = reloading ? 'RELOADING…' : ('PISTOL  ' + ammo + ' / ' + reserve);
  };

  HudSystem.prototype.setWeapon = function (name, ammo, reserve) {
    this.weaponEl.textContent = name;
    this.ammoEl.textContent = name + '  ' + ammo + ' / ' + reserve;
  };

  HudSystem.prototype.setPackages = function (found, total) {
    this.packagesEl.textContent = 'PACKAGES ' + found + '/' + total;
    this.packagesEl.className = 'packages' + (found === total ? ' done' : '');
  };

  HudSystem.prototype.setTaxi = function (text) {
    this.taxiEl.textContent = text || '';
    this.taxiEl.style.display = text ? 'block' : 'none';
  };

  // Timed-mission countdown bar: frac 1 = full time left, 0 = out of time.
  HudSystem.prototype.setTimer = function (frac) {
    if (frac === null || frac === undefined) {
      this.timerWrap.style.display = 'none';
      return;
    }
    this.timerWrap.style.display = 'block';
    this.timerBar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    this.timerBar.style.background = frac > 0.35 ? '#ffd21f' : '#ff4444';
  };

  HudSystem.prototype.setSpeed = function (kmh) {
    this.speedEl.textContent = kmh > 0.5 ? Math.round(kmh) + ' km/h' : '';
  };

  HudSystem.prototype.setObjective = function (text) {
    this.objectiveText.textContent = text;
  };

  HudSystem.prototype.showCrosshair = function (show) {
    this.crosshair.style.display = show ? 'block' : 'none';
  };

  HudSystem.prototype.showHitMarker = function (show) {
    this.hitMarker.style.display = show ? 'block' : 'none';
  };

  HudSystem.prototype.notify = function (text, kind) {
    var n = el('div', 'notify ' + (kind || ''), this.notifyBox);
    n.textContent = text;
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 4200);
    while (this.notifyBox.children.length > 3) {
      this.notifyBox.removeChild(this.notifyBox.firstChild);
    }
  };

  HudSystem.prototype.clearNotifies = function () {
    while (this.notifyBox.firstChild) this.notifyBox.removeChild(this.notifyBox.firstChild);
  };

  HudSystem.prototype.centerMessage = function (text, ms) {
    this.centerMsg.textContent = text;
    this.centerMsg.style.opacity = '1';
    var self = this;
    setTimeout(function () { self.centerMsg.style.opacity = '0'; }, ms || 2200);
  };

  HudSystem.prototype.showMenu = function (show, canContinue) {
    this.menu.style.display = show ? 'flex' : 'none';
    this.btnContinue.style.display = canContinue ? 'block' : 'none';
    this.root.style.display = show ? 'none' : 'block';
  };

  HudSystem.prototype.showPause = function (show, stats) {
    this.pauseScreen.style.display = show ? 'flex' : 'none';
    if (show && stats && this.pauseStats) {
      this.pauseStats.innerHTML =
        'Cash $' + stats.cash.toLocaleString('en-US') +
        ' &nbsp;•&nbsp; Jobs ' + stats.missionsDone + '/6' +
        ' &nbsp;•&nbsp; Kills ' + stats.kills +
        ' &nbsp;•&nbsp; Cars stolen ' + stats.carsStolen +
        ' &nbsp;•&nbsp; Packages ' + stats.packages + '/12' +
        ' &nbsp;•&nbsp; Taxi $' + stats.taxiEarned.toLocaleString('en-US') +
        ' &nbsp;•&nbsp; ' + stats.playTime;
    }
  };

  HudSystem.prototype.showHelp = function (show) {
    this.helpPanel.style.display = show ? 'flex' : 'none';
  };

  HudSystem.prototype.showEnd = function (kind, text) {
    this.endScreen.style.display = 'flex';
    this.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    this.endTitle.className = kind;
    this.endText.textContent = text;
  };

  HudSystem.prototype.hideEnd = function () {
    this.endScreen.style.display = 'none';
  };

  // ---- minimap ----
  // world: {player, missionTarget, policeCars, policeCops, enemies, traffic,
  //         packages, taxiTarget, blocks, buses}
  HudSystem.prototype.drawMinimap = function (world) {
    var ctx = this.mapCtx;
    var S = 190, half = CFG.CITY_HALF + 40;
    function toMap(x, z) {
      return [S / 2 + x / half * (S / 2 - 4), S / 2 + z / half * (S / 2 - 4)];
    }
    // one helper for every dot on the map: a filled circle or a square
    function blip(x, z, color, radius, square) {
      var p = toMap(x, z);
      ctx.fillStyle = color;
      if (square) ctx.fillRect(p[0] - radius, p[1] - radius, radius * 2, radius * 2);
      else { ctx.beginPath(); ctx.arc(p[0], p[1], radius, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20,26,36,0.85)';
    ctx.fillRect(0, 0, S, S);
    // ocean (south)
    ctx.fillStyle = '#1e6f8e';
    var oc = toMap(0, CFG.OCEAN_Z);
    ctx.fillRect(0, oc[1], S, S - oc[1]);
    ctx.fillStyle = '#e8c98f';
    var bc = toMap(0, CFG.BEACH_Z);
    ctx.fillRect(0, bc[1], S, oc[1] - bc[1]);
    // roads
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 4;
    for (var i = -4; i <= 4; i++) {
      var c = i * CFG.PITCH;
      var a = toMap(c, -half), b = toMap(c, half);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      var d = toMap(-half, c), e = toMap(half, c);
      ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    }
    // smuggler packages (green dots)
    (world.packages || []).forEach(function (pk) {
      if (!pk.taken) blip(pk.x, pk.z, '#3ddc5a', 2.5);
    });
    // mission marker
    if (world.missionTarget) {
      var m = toMap(world.missionTarget.x, world.missionTarget.z);
      blip(world.missionTarget.x, world.missionTarget.z, '#ffd21f', 6);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m[0], m[1], 8, 0, Math.PI * 2); ctx.stroke();
    }
    // taxi target (cyan ring)
    if (world.taxiTarget) {
      var tt = toMap(world.taxiTarget.x, world.taxiTarget.z);
      ctx.strokeStyle = '#4ecdc4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tt[0], tt[1], 5, 0, Math.PI * 2); ctx.stroke();
    }
    // enemies (red squares)
    (world.enemies || []).forEach(function (en) {
      blip(en.x, en.z, '#ff3333', 2, true);
    });
    // roadblocks (orange squares) — avoid them or ram through
    (world.blocks || []).forEach(function (bk) {
      blip(bk.x, bk.z, '#ff8c42', 3, true);
    });
    // city buses (cyan) — slow, predictable, good cover
    (world.buses || []).forEach(function (bus) {
      blip(bus.x, bus.z, '#4ecdc4', 2.5, true);
    });
    // police (blue, flashing)
    var flash = Math.floor(performance.now() / 400) % 2 === 0;
    (world.policeCars || []).forEach(function (c) {
      blip(c.x, c.z, flash ? '#3a86ff' : '#ff2020', 3.5);
    });
    // police chopper (bigger flashing dot)
    if (world.heli) {
      blip(world.heli.x, world.heli.z, flash ? '#ff2020' : '#ffffff', 5);
    }
    // player arrow (white, rotated by heading)
    var pp = toMap(world.player.x, world.player.z);
    ctx.save();
    ctx.translate(pp[0], pp[1]);
    ctx.rotate(world.player.heading || 0);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // north label
    ctx.fillStyle = '#cfd6de';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S - 16, 14);
  };

  Game.HudSystem = HudSystem;
})();
