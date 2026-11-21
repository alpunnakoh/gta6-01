// SUNSET SHORES — save.js
// SaveSystem: localStorage persistence — mission progress, cash, player
// position and health, the smuggler packages already found, taxi earnings,
// and run statistics (kills, cars stolen). The start menu offers Continue
// when a save exists. Saves are versioned: an older save key is ignored, so
// a stale save from a previous build never loads half-broken state.
(function () {
  'use strict';
  var CFG = Game.CFG;

  var SaveSystem = {
    hasSave: function () {
      try { return !!window.localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; }
    },
    save: function (state) {
      try {
        window.localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({
          missionIndex: state.missionIndex,
          cash: state.cash,
          x: state.x,
          z: state.z,
          hp: state.hp,
          hour: state.hour,
          packages: state.packages || [],
          taxiEarned: state.taxiEarned || 0,
          kills: state.kills || 0,
          carsStolen: state.carsStolen || 0,
          savedAt: Date.now()
        }));
        return true;
      } catch (e) { return false; }
    },
    load: function () {
      try {
        var raw = window.localStorage.getItem(CFG.SAVE_KEY);
        if (!raw) return null;
        var s = JSON.parse(raw);
        if (typeof s.missionIndex !== 'number' || typeof s.cash !== 'number') return null;
        if (!Array.isArray(s.packages)) s.packages = [];
        return s;
      } catch (e) { return null; }
    },
    clear: function () {
      try { window.localStorage.removeItem(CFG.SAVE_KEY); } catch (e) {}
    }
  };

  Game.SaveSystem = SaveSystem;
})();
