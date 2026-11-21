// SUNSET SHORES — save.js
// SaveSystem: localStorage persistence — mission progress, cash, player
// position and health, the smuggler packages already found, taxi earnings,
// and run statistics (kills, cars stolen). The v4 save also carries the
// new systems: race best times, relic ids found, whether the Sunset Heist
// is done, the garage mods on Leo's car, vigilante reputation, the rifle,
// and the current weather, so a continue lands exactly where the player
// left off. The start menu offers Continue when a save exists. Saves are
// versioned: an older save key is ignored, so a stale save from a previous
// build never loads half-broken state.
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
          // v4 systems: races, relics, heist, garage mods, vigilante, rifle, weather
          races: state.races || {},
          relics: state.relics || [],
          heistDone: !!state.heistDone,
          custom: state.custom || null,
          vigilante: state.vigilante || { rep: 0, jobs: 0 },
          rifle: state.rifle || { has: false, ammo: 0 },
          weather: state.weather || 'CLEAR',
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
        // defaults for the v4 fields so an old v2 save still loads cleanly
        if (!s.races) s.races = {};
        if (!Array.isArray(s.relics)) s.relics = [];
        if (typeof s.heistDone !== 'boolean') s.heistDone = false;
        if (!s.custom) s.custom = null;
        if (!s.vigilante) s.vigilante = { rep: 0, jobs: 0 };
        if (!s.rifle) s.rifle = { has: false, ammo: 0 };
        if (typeof s.weather !== 'string') s.weather = 'CLEAR';
        return s;
      } catch (e) { return null; }
    },
    clear: function () {
      try { window.localStorage.removeItem(CFG.SAVE_KEY); } catch (e) {}
    }
  };

  Game.SaveSystem = SaveSystem;
})();
