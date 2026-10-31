# Gator Gotcha

**Play:** https://gator-gotcha-ten.vercel.app

Top-down swamp chase. You're a duck grabbing eggs; a sight-hunting alligator is after you.
Break its line of sight behind logs and reeds, and dash (limited stamina) when spotted.
One catch ends the run.

## Run

```bash
npm install
cp .env.example .env.local   # fill in Supabase values (optional: game works offline without them)
npm run dev        # game only, http://localhost:5173
vercel dev         # game + api/ functions (leaderboard submit, share pages), http://localhost:3000
npm test           # unit tests (add --coverage for the report)
npm run build      # typecheck + production bundle in dist/
npm run lint
```

`?seed=abc123` in the URL replays a specific swamp layout (1–12 lowercase letters/digits).

## Deploy

Hosted on Vercel (static Vite build; config and security headers in `vercel.json`).
Pushes to `main` deploy to production automatically; manual deploy:

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

## Online: leaderboards & sharing

- **Accounts**: an anonymous Supabase session is created the first time a player finishes a run.
  Players get a random `Duck####` nickname they can change on the game-over card.
- **Anti-cheat by replay**: the client records one byte of quantized input per sim tick. On game
  over it posts `{ seed, log }` (run-length encoded) to `POST /api/scores`; the Vercel Function
  re-runs the deterministic sim server-side and stores the score *it* computes. Logs that don't end
  in a catch on the final tick, duplicates, and > 10 submissions/min are rejected.
- **Determinism**: `src/core/dmath.ts` replaces `Math.sin/cos/atan2/hypot` inside the sim (their
  last-bit results differ across JS engines). A golden replay test pins the behaviour.
- **Boards**: all-time (best per player) and **Daily Swamp** (seed `dYYYYMMDD`, UTC).
- **Sharing**: "Share on Facebook" shares `/s/<scoreId>`, which serves Open Graph tags and a
  generated 1200×630 PNG (`/api/og`, satori + resvg), then sends visitors to the same swamp with a
  "Beat X's score" banner.
- **Database**: `supabase/migrations/`. RLS makes profiles/scores publicly readable; only the
  service role (the replay validator) can write scores; players may update only their own nickname.

### Enabling Facebook Login (later)

1. Create an app at developers.facebook.com → add **Facebook Login** → Valid OAuth Redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Privacy policy URL: `/privacy.html`.
2. Supabase → Authentication → Providers → Facebook: paste App ID + Secret.
3. Set `VITE_FB_LOGIN_ENABLED=true` in Vercel env and redeploy.

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
  ui/              DOM HUD, overlay screens, guarded localStorage, online UI controller
  online/          lazy-loaded chunk: supabase-js client, submit/leaderboard, share, FB link
api/               Vercel Functions: scores (replay validator), share (OG landing), og (PNG card)
supabase/          config.toml + SQL migrations
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
