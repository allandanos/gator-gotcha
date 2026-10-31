import { len } from '../core/vec';
import type { InputState } from '../sim/types';
import type { Keyboard } from './keyboard';
import type { TouchControls } from './touch';

/** Merge keyboard and touch into one InputState; touch wins when active. */
export function readInput(keyboard: Keyboard, touch: TouchControls): InputState {
  const touchMove = touch.move;
  const move = len(touchMove) > 0 ? touchMove : keyboard.move;
  return { move, sprint: keyboard.sprint || touch.sprint };
}
