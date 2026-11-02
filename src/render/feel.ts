/** Game-feel tuning: render, UI and audio only. Gameplay numbers live in `src/config.ts`. */
import { SIM_DT } from '../config';

export const DEATHCAM_SECONDS = 3;
export const DEATHCAM_SPEED = 0.6;
/** Sim steps the death cam keeps: the last DEATHCAM_SECONDS of the run. */
export const DEATHCAM_FRAMES = Math.round(DEATHCAM_SECONDS / SIM_DT);
export const HITSTOP_MS = 80;
export const SHAKE_MS = 250;
export const SHAKE_PX = 8;
/** How long the red edge pulse takes to fade after the gator spots the duck. */
export const SPOTTED_PULSE_MS = 600;
export const NEAR_MISS_MARGIN = 24;
export const NEAR_MISS_SURVIVE_TICKS = 30;
export const HINT_MS = 3000;
/** Input in the first moments of the death cam is still the run's, not a request to skip. */
export const DEATHCAM_SKIP_GRACE_S = 0.3;
export const PACE_CHECKPOINT_S = 10;
/** 120 checkpoints × 10 s covers the 20-minute replay bound. */
export const PACE_MAX_CHECKPOINTS = 120;
