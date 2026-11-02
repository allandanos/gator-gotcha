# Gator Gotcha

**Play:** https://www.gatorgotcha.com

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

Without a link the game opens on today's Daily Swamp; **New swamp** on the game-over card rolls a
random one. `?seed=abc123` in the URL replays a specific swamp layout (1–12 lowercase letters/digits);
add `&mode=rush` or `&mode=ducklings` for another mode.

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
- **Day and night (Classic).** Every run starts in daylight. After 40 s night falls for 20 s,
  then the cycle repeats. At night the swamp goes dark except for a lantern around the duck. The
  gator sees less (cone × 0.65) but hears more (splash × 1.5). The HUD warns 5 s ahead.
- Difficulty rises with time and eggs: gator speed 150 → 270 (always below your 300 dash), cone
  range 260 → 480, cone angle 70° → 110°.
- Score = eggs × 100 + seconds survived × 10. Best score is stored in localStorage, per mode.
- **Rulesets.** Every score-affecting rule is versioned (`RULESET` in `src/config.ts`). Each
  score records the ruleset it was replayed under. The server rejects runs from an older build
  with a 409 ("please reload").

### Modes

Pick one from **Modes** on the title screen; **Play** starts the last mode you picked. Each ranked
mode is replayed by the server and has its own leaderboard. The Daily Swamp is always Classic.

| Mode | Rules | Score |
|---|---|---|
| Classic | the endless chase above, with the day/night cycle | eggs × 100 + seconds × 10 |
| Egg Rush | 90 s clock, 8 eggs on the field, gator starts at 20 % difficulty; no night | eggs × 100, +500 if you're still alive at 0:00 |
| Duckling Dash | ducklings, nest banking, tail snap, golden egg (below); always daylight | banked value + seconds × 10 |

Modes are `RunRules` values (`src/sim/rules.ts`); `?mode=rush|ducklings` in the URL picks one.
Night Swamp was a separate mode until it was folded into Classic's cycle. Its old scores stay in
the database, but no board shows them.

#### Duckling Dash

- Each egg hatches a duckling that trails behind you (up to 12). Lead them into the **nest** (the
  woven ring where you started) to bank them. Banking `n` at once pays
  `round(100 × n × (1 + 0.1 × n))`: 1 → 110, 4 → 560, 12 → 2,640. Ducklings you haven't banked
  are worth nothing when you're caught.
- **Greed has a cost.** Carried ducklings count as eggs for difficulty. From 4 ducklings on, the
  gator can spot you by seeing the tail of the line. And it can snap the last duckling instead of
  you, then stops for 1.2 s to swallow.
- **Golden egg.** About 1 refill in 12 is golden: it hatches 5 ducklings, and its splash carries
  twice as far. There's never more than one on the field.

### Campaign

12 curated levels in three worlds (Reed Shallows, Moonlit Marsh at 6 ★, Bayou Rush at 15 ★).
Each level is a fixed seed plus rules. The goal is to grab N eggs, bank N ducklings (Duckling Dash
rules), or survive N seconds. Some levels add a clock, permanent night, or a higher starting
difficulty. Night levels are always egg or survival levels. Clearing earns ★; the other two stars come from a
par time, an egg count, or how rarely you were spotted. Within a world, clearing a level opens
the next. Progress is local (`gator-gotcha:campaign` in localStorage) and unranked: campaign runs
are never submitted. Levels live in `CAMPAIGN` in `src/config.ts`; logic in `src/sim/campaign.ts`.

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
  "Beat X's score" banner. The hop happens in `public/share-redirect.js`, **not** a meta refresh:
  link-preview crawlers follow meta refreshes and would scrape the untagged game page instead.
  After changing share tags, re-scrape in the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).
- **Database**: `supabase/migrations/`. RLS makes profiles/scores publicly readable; only the
  service role (the replay validator) can write scores; players may update only their own nickname.

## Install & offline play

The game is a PWA (`vite-plugin-pwa`, generated service worker). Everything needed to play,
including the self-hosted fonts and the online chunk, is precached, so an installed copy runs with
no connection. "Install app" appears on the title screen where the browser supports it; iOS Safari
shows an "Add to Home Screen" hint instead.

Runs finished offline are queued in localStorage (`src/ui/pendingRuns.ts`, max 25) and posted
oldest-first on launch, on the browser's `online` event, and after any successful submit. The
server still replays every run, so queued runs get no extra trust. **Limit**: a Daily Swamp run
posted more than a day after its date counts only on the all-time board.

**Updates** (`src/ui/updates.ts`): the app checks for a new build every 30 minutes, whenever it
returns to the foreground, and when it comes back online. The browser downloads the new build in the
background, and the app reloads into it as soon as that can't interrupt a run: immediately on the
title screen, or when the app is backgrounded from the title or game-over screen. Players can also
tap "Update now". `registerType: 'prompt'` keeps a downloaded build waiting until then.

**What's remembered on this device**: the nickname (`gator-gotcha:nickname`, refreshed from the server for
returning players), best score, mute, and the Supabase session. On iOS a home-screen app has its
own storage, separate from Safari, so the installed app starts as a new anonymous player until
accounts can be linked (Facebook Login).

Icons are generated by `npx tsx scripts/make-icons.ts` into `public/icons/`.

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
- **Assets are code.** All art and sound are generated; the only binary assets are two
  self-hosted fonts and the app icons.

## Tests

Vitest covers `src/core` and `src/sim` (≥ 80 % threshold enforced in `vite.config.ts`):
map determinism and connectivity over 200 seeds, sight/occlusion, gator state transitions,
pathing around obstacles, stamina, collision tunnelling, difficulty caps, deterministic replay
and immutability of `step`.
