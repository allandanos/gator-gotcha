/** All gameplay tuning lives here. Units: world units (u), seconds, radians. */
export const ARENA = { width: 1600, height: 1000 } as const;

export const NAV_CELL = 25;

export const MAP = {
  obstacleTarget: 14,
  maxPlacementTries: 400,
  maxRegenerations: 40,
  /** Minimum clear gap between obstacles (and obstacles vs walls) so the gator always fits. */
  minGap: 80,
  spawnClearRadius: 140,
  minSpawnDistance: 900,
  log: { minLength: 140, maxLength: 260, thickness: 36 },
  reeds: { minSize: 70, maxSize: 130 },
} as const;

export const DUCK = {
  radius: 16,
  walkSpeed: 180,
  sprintSpeed: 300,
  accel: 1400,
  staminaMax: 100,
  staminaDrain: 40,
  staminaRegen: 25,
  regenDelay: 0.6,
  /** After hitting zero, sprint is locked until stamina recovers to this. */
  exhaustedRecover: 30,
} as const;

export const GATOR = {
  radius: 24,
  snoutOffset: 26,
  catchRadius: 20,
  turnRate: 3.2,
  baseSpeed: 150,
  maxSpeed: 270,
  /** Speed multiplier while not chasing. */
  patrolFactor: 0.55,
  coneRangeMin: 260,
  coneRangeMax: 480,
  coneAngleMin: (70 * Math.PI) / 180,
  coneAngleMax: (110 * Math.PI) / 180,
  /** Within this distance the gator senses the duck regardless of facing (still needs LOS). */
  proximitySense: 70,
  searchSweepTime: 3,
  searchArriveRadius: 30,
  wanderPauseMin: 0.6,
  wanderPauseMax: 1.6,
  splashHearRadius: 450,
  repathInterval: 0.5,
  spawnGrace: 1.5,
} as const;

export const DIFFICULTY = {
  /** Seconds to reach full difficulty from time alone. */
  timeToMax: 150,
  /** Difficulty gained per egg (0..1 scale). */
  perEgg: 0.03,
} as const;

export const EGGS = {
  onField: 5,
  radius: 12,
  minDistFromDuck: 250,
  minDistFromGator: 150,
} as const;

export const SCORE = { perEgg: 100, perSecond: 10 } as const;

/** Season 1: eggs hatch into ducklings that trail the duck. Units: u, sim ticks. */
export const TRAIL = {
  max: 12,
  /** Gap kept between each duckling and the one ahead of it. */
  spacing: 22,
  /** Each duckling steers for where the one ahead was this many ticks ago. */
  lag: 6,
  /** From this many ducklings on, the gator can spot the tail as well as the duck. */
  visibleFrom: 4,
} as const;

/** The gator snapping the last duckling instead of the duck. */
export const SNAP = { stunSeconds: 1.2 } as const;

/** The nest sits on the duck's spawn; walking into it banks the trail. */
export const NEST = {
  radius: 48,
  /** New eggs never spawn this close to the nest, so banking always means a trip. */
  eggClearance: 200,
} as const;

export const GOLDEN = { chance: 0.08, ducklings: 5, splashFactor: 2 } as const;

/** `bankValue(n) = round(base × n × (1 + growth × n))`: longer chains pay more per duckling. */
export const BANK = { base: 100, growth: 0.1 } as const;

export const SIM_DT = 1 / 60;

/**
 * Version of every score-affecting rule (= season). Bump it with any sim change and regenerate
 * the golden replay snapshot; the server rejects runs from any other ruleset. 0 = pre-seasons.
 */
export const RULESET = 1;

/** Ranked mode tuning. Classic must stay at the neutral values: its scores are replayed as-is. */
export const MODES = {
  rush: { timeLimit: 90, eggsOnField: 8, startLevel: 0.2, clutchBonus: 500 },
  night: { coneRangeFactor: 0.65, hearFactor: 1.5, lanternRadius: 210 },
} as const;

/**
 * Campaign: 12 curated levels in 3 worlds. A level is a fixed seed plus rules; stars beyond the
 * first (clearing it) come from the `star2` / `star3` conditions. Season 1: egg goals are
 * "bank N ducklings", with par times and clocks loosened for the trips home (needs a playtest).
 */
export const CAMPAIGN = {
  worlds: [
    { name: 'Reed Shallows', starsToUnlock: 0 },
    { name: 'Moonlit Marsh', starsToUnlock: 6 },
    { name: 'Bayou Rush', starsToUnlock: 15 },
  ],
  levelsPerWorld: 4,
  levels: [
    { name: 'First Waddle', goal: { ducklings: 3 }, star2: { parSec: 45 }, star3: { maxSpotted: 0 } },
    { name: 'Log Hopper', goal: { ducklings: 6 }, star2: { parSec: 70 }, star3: { maxSpotted: 0 } },
    { name: 'Hold Still', goal: { surviveSec: 45 }, star2: { minEggs: 3 }, star3: { maxSpotted: 0 } },
    { name: 'Greedy Duck', startLevel: 0.3, goal: { ducklings: 10 }, star2: { parSec: 110 }, star3: { maxSpotted: 1 } },
    { name: 'Lantern Light', night: true, goal: { ducklings: 4 }, star2: { parSec: 60 }, star3: { maxSpotted: 0 } },
    { name: 'Ears Everywhere', night: true, goal: { surviveSec: 60 }, star2: { minEggs: 4 }, star3: { maxSpotted: 0 } },
    { name: 'Dark Dash', night: true, startLevel: 0.3, goal: { ducklings: 8 }, star2: { parSec: 100 }, star3: { maxSpotted: 1 } },
    { name: 'Moon Rush', night: true, timeLimit: 75, goal: { ducklings: 6 }, star2: { parSec: 55 }, star3: { maxSpotted: 0 } },
    { name: 'Quick Pickings', timeLimit: 60, goal: { ducklings: 6 }, star2: { parSec: 45 }, star3: { maxSpotted: 0 } },
    { name: 'Stay Alive', startLevel: 0.5, goal: { surviveSec: 90 }, star2: { minEggs: 6 }, star3: { maxSpotted: 1 } },
    { name: 'Feeding Frenzy', timeLimit: 105, eggsOnField: 8, goal: { ducklings: 12 }, star2: { parSec: 90 }, star3: { maxSpotted: 2 } },
    { name: 'The Long Night', night: true, startLevel: 0.4, goal: { ducklings: 15 }, star2: { parSec: 180 }, star3: { maxSpotted: 2 } },
  ],
} as const;
