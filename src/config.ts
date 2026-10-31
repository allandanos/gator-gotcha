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

export const SIM_DT = 1 / 60;
