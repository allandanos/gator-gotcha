import { DUCK } from '../config';
import { add, angleOf, len, limit, scale, sub, type Vec } from '../core/vec';
import { moveCircle } from './collision';
import type { Duck, InputState, Obstacle } from './types';

export function createDuck(pos: Vec): Duck {
  return {
    pos,
    vel: { x: 0, y: 0 },
    facing: 0,
    stamina: DUCK.staminaMax,
    exhausted: false,
    sinceSprint: DUCK.regenDelay,
    sprinting: false,
  };
}

function nextStamina(d: Duck, sprinting: boolean, dt: number): Pick<Duck, 'stamina' | 'exhausted' | 'sinceSprint'> {
  if (sprinting) {
    const stamina = Math.max(0, d.stamina - DUCK.staminaDrain * dt);
    return { stamina, exhausted: stamina === 0, sinceSprint: 0 };
  }
  const sinceSprint = d.sinceSprint + dt;
  const stamina =
    sinceSprint >= DUCK.regenDelay
      ? Math.min(DUCK.staminaMax, d.stamina + DUCK.staminaRegen * dt)
      : d.stamina;
  const exhausted = d.exhausted && stamina < DUCK.exhaustedRecover;
  return { stamina, exhausted, sinceSprint };
}

export function updateDuck(
  d: Duck,
  input: InputState,
  obstacles: readonly Obstacle[],
  dt: number,
): Duck {
  const move = limit(input.move, 1);
  const moving = len(move) > 0.1;
  const sprinting = input.sprint && moving && !d.exhausted && d.stamina > 0;
  const targetVel = scale(move, sprinting ? DUCK.sprintSpeed : DUCK.walkSpeed);
  const dv = limit(sub(targetVel, d.vel), DUCK.accel * dt);
  const vel = add(d.vel, dv);
  const pos = moveCircle(d.pos, scale(vel, dt), DUCK.radius, obstacles);
  // Use actual displacement so velocity doesn't build up against walls.
  const actualVel = scale(sub(pos, d.pos), 1 / dt);
  const facing = len(actualVel) > 10 ? angleOf(actualVel) : d.facing;
  return { ...d, ...nextStamina(d, sprinting, dt), pos, vel: actualVel, facing, sprinting };
}
