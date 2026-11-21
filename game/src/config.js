// SUNSET SHORES — config.js
// Every tuning constant, colour and world fact for the Palmera Bay open
// world lives here. One file to tune the whole game: systems read from CFG
// and never carry their own magic numbers, so a balance pass is one edit.
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
    PIER_X: -108,             // boardwalk pier jutting into the ocean
    PIER_END_Z: 296,          // boat at the end of the pier

    // ---- time / sun ----
    DAY_LENGTH_S: 600,        // full in-game day in real seconds
    START_HOUR: 17.4,         // golden-hour start (sunset vibe)
    NIGHT_START_HOUR: 20,     // lamps on, sky dark after this hour
    DAWN_HOUR: 6.5,           // sky brightens again after this hour

    // ---- player on foot ----
    WALK_SPEED: 6,
    RUN_SPEED: 10.5,
    JUMP_VELOCITY: 8.5,
    GRAVITY: 24,
    PLAYER_RADIUS: 0.7,
    PLAYER_HEIGHT: 1.8,
    PLAYER_HP: 100,
    HEALTH_REGEN_DELAY_S: 8,  // seconds without damage before healing starts
    HEALTH_REGEN_RATE: 6,     // HP per second while regenerating
    PUNCH_DAMAGE: 25,
    PUNCH_RANGE: 2.4,
    PUNCH_ARC: 1.1,           // radians either side of the facing direction
    PUNCH_COOLDOWN_S: 0.45,

    // ---- cars (arcade physics) ----
    CAR_ACCEL: 16,
    CAR_BRAKE: 30,
    CAR_REVERSE_ACCEL: 10,
    CAR_MAX_SPEED: 34,        // ~122 km/h feel
    SPORT_TOP_SPEED: 42,      // sports coupe: the fastest wheels in the bay
    VAN_TOP_SPEED: 26,        // delivery van: slow but sturdy
    TAXI_TOP_SPEED: 32,
    CAR_MAX_REVERSE: 10,
    CAR_STEER: 0.55,          // rad/s at full lock, scaled by speed
    CAR_DRAG: 0.6,
    CAR_HANDBRAKE: 22,
    CAR_RADIUS: 1.6,
    CAR_HEALTH: 100,          // collisions wear a car down; at 0 it is wrecked
    CAR_SMOKE_BELOW: 45,      // health under this and the car smokes
    PLAYER_CAR_COLOR: 0xff7a1a,
    TAXI_COLOR: 0xffd21f,

    // ---- traffic / pedestrians ----
    TRAFFIC_COUNT: 14,
    TRAFFIC_SPEED: 9,
    PED_COUNT: 22,
    PED_SPEED: 2.2,
    PED_FLEE_SPEED: 5.5,
    PED_PAUSE_CHANCE: 0.25,   // walkers sometimes stop to check their phone

    // ---- police / wanted ----
    WANTED_MAX: 5,
    POLICE_CAR_MAX: 4,
    POLICE_FOOT_MAX: 4,
    POLICE_RAM_DAMAGE: 8,
    POLICE_BUST_RANGE: 2.4,
    POLICE_BUST_TIME: 1.4,
    WANTED_DECAY_HIDE_S: 10,  // seconds unseen before stars start dropping
    WANTED_DECAY_STEP_S: 7,   // seconds per star lost while hidden
    HELI_MIN_STARS: 3,        // the police chopper joins at 3 stars
    HELI_HEIGHT: 34,
    HELI_SPEED: 17,

    // ---- combat ----
    PISTOL_DAMAGE: 34,
    PISTOL_MAG: 12,
    PISTOL_RELOAD_S: 1.1,
    PISTOL_RANGE: 90,
    PISTOL_FIRE_RATE: 0.22,
    SMG_DAMAGE: 16,
    SMG_MAG: 30,
    SMG_RELOAD_S: 1.4,
    SMG_RANGE: 70,
    SMG_FIRE_RATE: 0.09,      // hold the trigger: full-auto
    SMG_PICKUP_COUNT: 3,      // SMG crates hidden around the city
    SMG_PICKUP_AMMO: 90,
    ENEMY_HP: 100,
    ENEMY_DAMAGE: 9,
    ENEMY_SHOT_INTERVAL: 1.4,
    ENEMY_RANGE: 38,

    // ---- side activities ----
    PACKAGE_COUNT: 12,        // hidden smuggler packages: cash + health
    PACKAGE_CASH: 150,
    PACKAGE_HEAL: 25,
    TAXI_FARE_BASE: 120,      // flat fare for a taxi job
    TAXI_FARE_PER_M: 1.2,     // plus this per metre of the trip
    TAXI_TIMEOUT_S: 90,       // seconds to reach the drop-off
    STUNT_CASH: 50,           // payout for a ramp jump at speed
    STUNT_MIN_SPEED: 18,      // car must be this fast over a ramp
    SPRAY_COST: 200,          // Pay 'n Spray: repair + lose wanted stars
    SPRAY_RADIUS: 9,          // drive into the garage zone to use it
    CLEAN_BONUS: 200,         // finish a mission with 0 stars: clean bonus

    // ---- weapons (third: the shotgun) ----
    SHOTGUN_DAMAGE: 18,       // per pellet, 6 pellets per shell
    SHOTGUN_PELLETS: 6,
    SHOTGUN_MAG: 6,
    SHOTGUN_RELOAD_S: 2.0,
    SHOTGUN_RANGE: 45,
    SHOTGUN_FIRE_RATE: 0.8,
    SHOTGUN_PICKUP_COUNT: 2,  // shotgun crates (red) hidden in the city
    SHOTGUN_PICKUP_AMMO: 24,

    // ---- radio ----
    RADIO_STATIONS: ['SUNSET FM', 'BAY 104', 'PALMERA GOLD'],

    // ---- stamina ----
    STAMINA_MAX: 100,
    STAMINA_DRAIN: 18,        // per second while sprinting
    STAMINA_REGEN: 12,        // per second while not sprinting

    // ---- traffic extras ----
    BUS_COUNT: 2,             // city buses on a fixed loop route
    HORN_RANGE: 18,           // traffic honks when the player blocks the road

    // ---- missions ("The Palmera Job") ----
    MISSION_REWARDS: [500, 800, 1200, 2000, 5000, 8000, 2500, 15000],
    M3_TIME_LIMIT_S: 95,
    M6_HOLD_S: 4,
    M8_HOLD_S: 6,

    // ---- weather (new in v4: rain, storm, fog, clouds) ----
    WEATHER_CHANGE_MIN_S: 75,   // seconds between weather rolls
    WEATHER_CHANGE_MAX_S: 150,
    WEATHER_RAIN_GRIP: 0.85,    // wet roads: less grip
    WEATHER_STORM_GRIP: 0.78,
    WEATHER_FOG_GRIP: 0.95,
    WEATHER_RAIN_DROPS: 900,

    // ---- street racing (new in v4) ----
    RACE_PRIZES: [1500, 800, 400], // 1st / 2nd / 3rd
    RACE_COUNTDOWN_S: 3,
    RACE_RIVALS: 3,

    // ---- the sunset heist (M7-M8, new in v4) ----
    M7_REWARD: 2500,
    M8_REWARD: 15000,
    HEIST_BAG_CASH: 1000,       // each cash duffel grabbed at the vault
    HEIST_BAG_COUNT: 3,

    // ---- sunset relics (new in v4: golden idols hidden in the city) ----
    RELIC_COUNT: 10,
    RELIC_CASH: 250,
    RELIC_ALL_BONUS: 2000,

    // ---- vigilante jobs (new in v4) ----
    VIGILANTE_REWARD: 300,
    VIGILANTE_TIME_S: 90,
    VIGILANTE_COOLDOWN_S: 45,
    VIGILANTE_HITS: 3,

    // ---- vehicle customisation (new in v4, Marina Garage) ----
    CUSTOM_PAINT_COST: 150,
    CUSTOM_WHEEL_COST: 200,
    CUSTOM_SPOILER_COST: 250,
    CUSTOM_NEON_COST: 300,
    CUSTOM_ENGINE_COSTS: [500, 900, 1500], // +3 top speed a level
    CUSTOM_ARMOR_COSTS: [400, 800],        // +50 max car health a level

    // ---- rifle (new in v4: long-range, slow, heavy) ----
    RIFLE_DAMAGE: 55,
    RIFLE_MAG: 8,
    RIFLE_RELOAD_S: 2.2,
    RIFLE_RANGE: 140,
    RIFLE_FIRE_RATE: 0.9,
    RIFLE_PICKUP_COUNT: 2,
    RIFLE_PICKUP_AMMO: 40,

    // ---- nightlife (new in v4: neon clubs + night market) ----
    NIGHT_CROWD_MAX: 8,
    NIGHT_START: 20,            // clubs and market light up after this hour
    NIGHT_END: 5,

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
      policeBlack: 0x1c2430,
      nightSky: 0x0d1526,
      nightFog: 0x1a2233,
      lampGlow: 0xffe9b0
    },

    // ---- save ----
    SAVE_KEY: 'sunset-shores-save-v2'
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
  // Blend two hex colours by t (0..1) and return a hex number.
  function mixHex(a, b, t) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    var r = Math.round(lerp(ar, br, t)), g = Math.round(lerp(ag, bg, t)), bl = Math.round(lerp(ab, bb, t));
    return (r << 16) | (g << 8) | bl;
  }

  window.Game = window.Game || {};
  Game.CFG = CFG;
  Game.rng = mulberry32;
  Game.clamp = clamp;
  Game.lerp = lerp;
  Game.dist2D = dist2D;
  Game.nearestRoadCoord = nearestRoadCoord;
  Game.isOnRoad = isOnRoad;
  Game.mixHex = mixHex;
})();
