import { SIM_DT } from '../config';

const MAX_FRAME = 0.25;

/** Fixed-timestep loop: `update` runs at SIM_DT, `render` gets the interpolation alpha. */
export function createLoop(update: (dt: number) => void, render: (alpha: number, frameDt: number) => void) {
  let raf = 0;
  let last = 0;
  let acc = 0;
  const frame = (now: number) => {
    const frameDt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    acc += frameDt;
    while (acc >= SIM_DT) {
      update(SIM_DT);
      acc -= SIM_DT;
    }
    render(acc / SIM_DT, frameDt);
    raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      cancelAnimationFrame(raf);
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
  };
}
