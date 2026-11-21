// SUNSET SHORES — config.js
// All tuning constants, colours and world layout for the Palmera Bay open world.
// One place to tune the whole game: no magic numbers scattered in systems.
(function () {
  'use strict';

  var CFG = {
    // ---- world layout ----
    GRID_ROADS: 9,            // roads per axis (9x9 road grid)
    PITCH: 54,                // distance between road centre lines
    ROAD_WIDTH: 14,           // asphalt width
    BLOCK: 40,                // building block size (PITCH - ROAD_WIDTH)
    CITY_HALF: 4 * 54 + 7,    // 223: half extent of the road grid
    BEACH_Z: 246,             // sand strip starts here (south edge)
    OCEAN_Z: 262,             // water starts here
    WORLD_HALF: 320,          // hard boundary for the player

    // ---- time / sun ----
    DAY_LENGTH_S: 600,        // full in-game day in real seconds
    START_HOUR: 17.4,         // golden-hour start (sunset vibe)

    // ---- player on foot ----
    WALK_SPEED: 6,
    RUN_SPEED: 10.5,
    JUMP_VELOCITY: 8.5,
    GRAVITY: 24,
    PLAYER_RADIUS: 0.7,
    PLAYER_HEIGHT: 1.8,
    PLAYER_HP: 100,

    // ---- cars (arcade physics) ----
    CAR_ACCEL: 16,
    CAR_BRAKE: 30,
    CAR_REVERSE_ACCEL: 10,
    CAR_MAX_SPEED: 34,        // ~122 km/h feel
    CAR_MAX_REVERSE: 10,
    CAR_STEER: 0.55,          // rad/s at full lock, scaled by speed
    CAR_DRAG: 0.6,
    CAR_HANDBRAKE: 22,
    CAR_RADIUS: 1.6,
    PLAYER_CAR_COLOR: 0xff7a1a,
    TAXI_COLOR: 0xffd21f,

    // ---- traffic / pedestrians ----
    TRAFFIC_COUNT: 14,
    TRAFFIC_SPEED: 9,
    PED_COUNT: 22,
    PED_SPEED: 2.2,
    PED_FLEE_SPEED: 5.5,

    // ---- police / wanted ----
    WANTED_MAX: 5,
    POLICE_CAR_MAX: 4,
    POLICE_FOOT_MAX: 4,
    POLICE_RAM_DAMAGE: 8,
    POLICE_BUST_RANGE: 2.4,
    POLICE_BUST_TIME: 1.4,
    WANTED_DECAY_HIDE_S: 10,  // seconds unseen before stars start dropping
    WANTED_DECAY_STEP_S: 7,   // seconds per star lost while hidden

    // ---- combat ----
    PISTOL_DAMAGE: 34,
    PISTOL_MAG: 12,
    PISTOL_RELOAD_S: 1.1,
    PISTOL_RANGE: 90,
    PISTOL_FIRE_RATE: 0.22,
    ENEMY_HP: 100,
    ENEMY_DAMAGE: 9,
    ENEMY_SHOT_INTERVAL: 1.4,
    ENEMY_RANGE: 38,

    // ---- missions ("The Palmera Job") ----
    MISSION_REWARDS: [500, 800, 1200, 2000, 5000],
    M3_TIME_LIMIT_S: 95,

    // ---- palette (sun-soaked Palmera Bay) ----
    COLORS: {
      skyTop: 0x2e4a7a,
      skyHorizon: 0xff9a5c,
      sun: 0xffd9a0,
      fog: 0xe8966a,
      ocean: 0x1e6f8e,
      sand: 0xe8c98f,
      asphalt: 0x3a3f46,
      sidewalk: 0x9a938a,
      grass: 0x5f8f4e,
      buildingPalette: [0xd8c9a8, 0xc9b18a, 0xb7a6c9, 0x9fb8c8, 0xe0d6c2, 0xc98f7a, 0x8fb8a0, 0xd9c1e0],
      palmTrunk: 0x8a6b46,
      palmLeaf: 0x3f8f4f,
      policeWhite: 0xf2f2f2,
      policeBlack: 0x1c2430
    },

    // ---- save ----
    SAVE_KEY: 'sunset-shores-save-v1'
  };

  // Deterministic RNG (mulberry32) so the city and every staged screenshot
  // are identical on every load for a given seed.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2D(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }
  // Snap a world coordinate to the nearest road centre line.
  function nearestRoadCoord(v) { return Math.round(v / CFG.PITCH) * CFG.PITCH; }
  function isOnRoad(x, z) {
    var rx = Math.abs(x - nearestRoadCoord(x));
    var rz = Math.abs(z - nearestRoadCoord(z));
    return rx <= CFG.ROAD_WIDTH / 2 + 0.6 || rz <= CFG.ROAD_WIDTH / 2 + 0.6;
  }

  window.Game = window.Game || {};
  Game.CFG = CFG;
  Game.rng = mulberry32;
  Game.clamp = clamp;
  Game.lerp = lerp;
  Game.dist2D = dist2D;
  Game.nearestRoadCoord = nearestRoadCoord;
  Game.isOnRoad = isOnRoad;
})();
