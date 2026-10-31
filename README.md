# Gator Gotcha

**Play:** https://gator-gotcha.vercel.app

Top-down swamp chase. You're a duck grabbing eggs; a sight-hunting alligator is after you.
Break its line of sight behind logs and reeds, and dash (limited stamina) when spotted.
One catch ends the run.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (add --coverage for the report)
npm run build      # typecheck + production bundle in dist/
npm run lint
```

`?seed=abc123` in the URL replays a specific swamp layout (1–12 lowercase letters/digits).

## Deploy

Hosted on Vercel (static Vite build; config and security headers in `vercel.json`).

```bash
vercel deploy --prod
```

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | drag anywhere (floating joystick) |
| Dash | Shift / Space | **Dash** button |
| Pause | Esc / P | ❚❚ button |
| Mute | M | ♪ button |

## How it plays

- **Gator modes**: *wander* (yellow cone) → *chase* (red, `!`) when you're in its cone with clear
  line of sight → *search* (orange, `?`) at your last-seen spot for 3 s → back to wander.
- Picking up an egg makes a splash the gator can hear within 450 u.
- Difficulty rises with time and eggs: gator speed 150 → 270 (always below your 300 dash), cone
  range 260 → 480, cone angle 70° → 110°.
- Score = eggs × 100 + seconds survived × 10. Best score is stored in localStorage.

All tuning lives in [`src/config.ts`](src/config.ts).

## Architecture

```
src/
  config.ts        tuning constants
  core/            seeded RNG, vector math, fixed-timestep loop
  sim/             pure, deterministic simulation (no DOM) — world.step(world, input, dt) → world
                   mapgen (seeded + connectivity-checked), nav grid + A*, sight cones, gator AI, duck
  render/          Canvas 2D: baked background, procedural sprites, effects
  input/           keyboard + touch joystick merged into one InputState
  audio/           WebAudio synth SFX and procedural bluegrass loop (tempo follows the chase)
  ui/              DOM HUD, overlay screens, guarded localStorage
```

Design choices:

- **Pure sim, impure shell.** `sim/` is immutable and deterministic (RNG state lives in the world),
  so the same seed + inputs replay exactly; that's what the tests lean on. Rendering, audio and
  effects only *consume* the per-step `events`.
- **No engine.** Canvas + ~14 KB gzipped JS. The interesting logic (sight occlusion, nav) is
  custom anyway, and Phaser would add ~1 MB.
- **Fixed 60 Hz sim with render interpolation**, so behaviour is frame-rate independent.
- **Assets are code.** All art and sound are generated; nothing to load except the two web fonts.

## Tests

Vitest covers `src/core` and `src/sim` (≥ 80 % threshold enforced in `vite.config.ts`):
map determinism and connectivity over 200 seeds, sight/occlusion, gator state transitions,
pathing around obstacles, stamina, collision tunnelling, difficulty caps, deterministic replay
and immutability of `step`.
