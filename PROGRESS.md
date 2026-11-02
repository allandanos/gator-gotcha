# Progress

| date | phase | status | notes |
|---|---|---|---|
| 2026-11-01 | 0 | done | events live |
| 2026-11-02 | modes | live |  egg rush, night swamp, campaign (out of band, before phase 1) |
| 2026-11-02 | 1 | done | death cam + juice |
| 2026-11-02 | 2 | done | season 1 built locally; ships after the phase 1 KPI gate (on or after 2026-11-09) |
| 2026-11-02 | 2 | re-scoped | classic day/night cycle (night swamp folded in), duckling dash mode, mixed campaign; no seasons. still local |

## Evidence

### Modes (out of band)

**What:** `RunRules` per run (`src/sim/rules.ts`). Ranked modes `classic` / `rush` / `night`,
each replayed by the server with its own board (migration `20261102000000_modes.sql`). A local,
unranked 12-level campaign.

**Classic unchanged:**
- The golden replay snapshot was untouched.
- A full-world-state sha256 over 40 bot runs (every tick) was
  `2907f8e7ce704df96c5f35e3102be40813792dd295725a1c36e999f15231efd7` both before and after the
  rules change.

**Migration:** applied to a throwaway `postgres:17-alpine` with stubbed `auth` and roles. Checks:
- the legacy 3-arg `leaderboard()` call returns Classic only;
- `mode => 'rush'` returns only Rush rows;
- the `mode` check rejects `campaign`;
- `scores_daily_classic_only` rejects a Rush row that carries a `daily_date`.

**Security review (§5.4):** no CRITICAL, HIGH or MEDIUM findings. Two LOW notes were applied: the
daily-only-classic DB constraint, and an import order fix.

**Browser (dev server, Chrome via Playwright, Supabase and `/api` blocked):**
- Modes screen at 1440 and 375.
- Rush counts down, and the chip turns urgent under 10 s. At 0:00 the card shows "Time!" with
  +500, the score is 500 with 0 eggs, and focus is on `#retry-btn`.
- Night fog renders.
- Campaign:
  - level 1 cleared with 3★ unlocks Moonlit Marsh at 6★;
  - a caught run shows CHOMP! with Retry focused and Next hidden;
  - a campaign run submits nothing and leaves the Classic best untouched;
  - no horizontal overflow at 375.

**Level feasibility:** scripted bots clear levels 1, 3 and 5 easily. The bots are far weaker than
players (median 2 eggs per run against 16 for people), so the seeds `lv01`–`lv12` **still need a
human playtest**. If a level is unfair, swap its seed in `CAMPAIGN` and note it here.

**Migration applied (owner, 2026-11-02):** `supabase db push --linked` applied `20261102000000_modes.sql`.
Live read-only checks:
- the legacy 3-arg `leaderboard()` returns the Classic board, so old clients work;
- the Rush board exists and is empty;
- all 106 existing scores read as `classic`.

**Staging (Preview `gator-gotcha-4tiuoj8sd`, commit `8505002`):**
- The Preview serves the Modes and Campaign screens and the board mode switch.
- Via `vercel curl` with one anonymous test session:
  - a bogus mode returns 400;
  - the Rush run (`buzz36`, the deterministic evasive-bot log) returns 201 with score 500 and
    Rush rank #1, no daily rank;
  - the Night run (`golden`) returns 201 with score 310;
  - resubmitting it returns 409;
  - each score appeared only on its own board.
- `/s/<id>` reads "Egg Rush: 0 eggs, survived 1:30", and its link carries `&mode=rush`.
- The OG card says "scored in Egg Rush".
- Test user `f6bc9607-b7ae-4f59-a8e7-a00a04978da6` (anonymous, created seconds before, these
  2 scores only) was deleted by id, which cascaded. Both boards were empty again afterwards.

**Owner actions before deploy:**
1. ~~Run `supabase db push --linked`~~ done.
2. ~~Push `staging` and smoke-test the Preview~~ done. ~~Push `main`~~ done: production deploy `gator-gotcha-nashpk9ws` (commit `647fe77`) is live, serving the Modes/Campaign markup; the classic board answers old-style calls.


### Phase 0

**Baseline (2026-11-01):** `git status` clean · `npm test` 114 passed · lint + build exit 0 ·
only migration `20261031000000_leaderboard.sql` · no `PROGRESS.md`.

**VERIFY results**
- Supabase CLI linked to `ecjoimtngyohebssnxrw` (gator-gotcha): `supabase projects list` → `"linked":true`.
- Vercel Preview env has all five vars (`vercel env ls`); used as the staging environment
  (`staging` branch → Preview deployment). Staging and production share the one Supabase project.

**Decisions taken**
- Staging first: push `staging` → Vercel Preview, smoke-test, then promote to `main` on owner approval.
- `update_applied` is emitted by the *new* build on boot, from a `from` marker saved right before
  the update reload; only the new build knows its own version (`to`).
- `retry` = any run started from the game-over screen (Retry, New swamp, Enter); mirrors `run_start.fromOver`.
- Retention keys on `user_id` (created on a player's first submitted run); title-only visitors are
  not in cohorts. Days are UTC, matching `dailySeed`.
- `referrer` is the referring hostname only (≤ 64 chars), empty for direct visits and same-site reloads.
- Events also flush once on boot (drains a queue left by an earlier visit), besides run_end / online / hidden.
- Bearer token attached only if the online chunk is already loaded; analytics never loads supabase-js.

**Security review** (`api/events.ts`, `api/_lib/events.ts`, `supabaseEventRepository`, migration):
no CRITICAL/HIGH. MEDIUM (accepted): unauthenticated endpoint, per-session limit is bypassable by
rotating client session ids → recommend a Vercel Firewall rate-limit rule on `/api/events`. LOW:
the rate-limit count-then-insert is not atomic.

**Migration:** `20261101000000_events.sql` applied by the owner with `supabase db push`
(the session's auto-mode classifier blocked the push).

**Acceptance (local, 2026-11-01)**
- `npm test` → 18 files, **146 passed** (baseline 114 + 32 new); coverage All files 97.46 % lines,
  `api/_lib/events.ts` 100 % lines, `src/ui/eventQueue.ts` 100 % lines; thresholds met.
- `npm run lint && npm run build` → exit 0; `tsc --noEmit` clean.
- `npx vitest run api/_lib/events.test.ts src/ui/eventQueue.test.ts` → pass (oversize batch rejected,
  unknown event dropped, numbers clamped, 404/5xx keep, 422 drops).
- `vercel dev`: `POST /api/events -d '{}'` → `400`; valid batch → `202 {"accepted":1}` (unknown event
  dropped); 17 KB body → `413`.
- Anon key on `events` and all four views → `42501 permission denied`; service role reads
  `events_daily_active` → `[{"day":"2026-10-31","players":0,"sessions":1,"runs":0}]`.
  Local test row: session `b92a7b34-38fe-4a51-86d2-ac95b4d1003e`, `app_version = 'local-test'`.
- `git diff --stat src/sim` → empty (golden snapshot unchanged).

**Staging (Vercel Preview `gator-gotcha-17dchk4gl-allandanos.vercel.app`, commit `c8869f6`)**
- `vercel curl /api/events --deployment <preview> -- -X POST -d '{}'` → `400 Invalid events batch`.
- Headless Chrome (Playwright, `x-vercel-trusted-oidc-idp-token` scoped to the preview origin) played
  one idle run on seed `stagetest`: `title_view`, `run_start`, `run_end` each → `202`, `appVersion=c8869f6`.
- Service-role count: `{ 'local-test title_view': 1, 'c8869f6 title_view': 2, 'c8869f6 run_start': 1, 'c8869f6 run_end': 1 }`.
- Test sessions (kept, per "delete nothing"): `b92a7b34-38fe-4a51-86d2-ac95b4d1003e` (local),
  `2898c67f-6461-4b6b-b571-793b58e30f38`, `1d9a06db-0118-4d88-8148-8fdc336ce51c` (staging).
- Side effect cleaned up: the staging run also submitted a score to the shared leaderboard (anonymous
  user `80bcff6d-f585-4673-a36a-d19f11682662`, Duck8127, 350 on `stagetest`). Verified as the session's
  own (anonymous, created 3 s before the score, no other scores) and deleted by id via the auth admin
  API; profile and score cascaded.
- Observed: a brand-new player's first-run events carry no `user_id`, because the `run_end` flush races
  the anonymous sign-in that the score submit performs. Later batches in that session (and return
  visits) carry it. Accepted for Phase 0.

**Staging caveat:** Preview shares the production Supabase project, so staging plays post real scores.
A separate staging Supabase project would remove this; not in Phase 0 scope.

**Production (`main` fast-forwarded to `16b5889`, deployment `gator-gotcha-7o0ln84h4`, owner-approved)**
- `curl -X POST https://www.gatorgotcha.com/api/events -d '{}'` → `400`; `/privacy.html` lists the events.
- Headless run on seed `prodsmoke` with `/api/scores` and Supabase blocked (no account, no score):
  `title_view`, `run_start`, `run_end` → `202`, `appVersion=16b5889`, session `bf6f3947-cfcc-4cae-b143-aee2419cd1fa`.
  `scores?seed=eq.prodsmoke` → `[]`.
- Service-role count query (all events): `{ title_view: 8, run_start: 3, run_end: 3 }`; version
  `16b5889` alone: `{ title_view: 3, run_start: 1, run_end: 1 }` (real players already arriving).
- `events_death_histogram` → buckets 30, 100, 270 s (1 run each).
- KPI gate (7 consecutive days of events) is checked at the start of Phase 1.

### Phase 1

**Baseline (2026-11-02, `4013b03`):** `npm test` 24 files / 205 passed · lint + build exit 0 ·
`git diff --stat HEAD -- src/sim` empty · `grep -c "| 0 | done" PROGRESS.md` → 1.

**KPI baseline ("before" numbers; read-only, service role).** Events start
`2026-10-31T16:21:32Z`, so only ~2.5 days of data, short of the 7-day gate. The owner decided to
proceed. Retries are Classic only (`run_start.mode` = `classic` or absent), because modes add runs.
Session `local-test` rows are excluded.
- Classic retries per session: **mean 1.56, median 1** (32 sessions, 92 Classic run starts of 105 in total;
  runs/session mean 2.88).
- D1 (`events_retention`): 2026-10-31 cohort 1/1 (100 %, one player); 2026-11-01 cohort
  **2/14 = 14.3 %**; 2026-11-02 cohort not yet measurable.
- `events_daily_active`: 10-31 1 player / 13 sessions / 4 runs; 11-01 15 / 96 / 71; 11-02 (partial) 3 / 15 / 2.

**Decisions taken**
- Death cam: the 1.1 s live chomp plays first, with an 80 ms hitstop and a 250 ms / 8 px shake. A
  `deathcam` phase follows. It replays the last 180 sim worlds (3 s) at 0.6×, about 5 s. The camera sits
  midway between duck and gator, capped at 60 % of the half-view from the duck so the duck never leaves frame.
  The sight cone is drawn full strength, also in Night. "Spotted here" pins the duck's position at the most
  recent switch into `chase` in the buffer. Any key or pointerdown skips. The skipping keydown is swallowed,
  so Space or Enter can't also press the newly focused Retry.
- Reduced motion: no shake; the death cam holds one still frame (the spot, else the catch) for 3 s.
  The red spotted pulse is an opacity fade and stays on.
- The death cam runs on every catch (campaign too). Rush time-ups and campaign clears keep the old ending.
- Worlds are buffered per sim step (60 Hz), not per rendered frame, so playback speed doesn't depend on refresh rate.
- Pace is per mode (`best-timeline`, `best-timeline:rush`, `best-timeline:night`), saved only on a new best,
  hidden until one exists and while the score is 0. "Past your best" shows beyond the timeline's end.
- The death cam ignores modifier keys, Tab, and the first 0.3 s, so a player still steering at the catch doesn't skip it by accident.
- Space retries only when focus isn't on a button. A focused button already reacts to Space, so
  handling it here too would start two runs.
- Closest call is shown in duck lengths (gap to the jaws ÷ 32 u), measured only on ticks the duck survived.
- **Bundle budget raised to 30 KB gzipped (owner, this session):** the modes work had already taken the main
  chunk to 25.32 KB against the old 26 KB budget.
- DEV-only `window.__gator.shake()` was added for browser checks; it is stripped from production builds.

**Security review (§5.4, catalogue change only, no new endpoint):** `deathcam_skip.at` is clamped
to 0–10 s (float). `run_end.nearMisses` and `spottedCount` are clamped integers, 0–10 000. Unknown
props are still dropped, and the batch size, body cap and rate limit are unchanged. No CRITICAL/HIGH/MEDIUM.
LOW: the props are client-reported, like every other event prop; they are analytics only and never scored.

**Acceptance (local, 2026-11-02)**
- `npm test` → 29 files, **238 passed** (205 + 33). Coverage: all files 98.46 % lines; `rewind.ts`,
  `nearMiss.ts`, `runStats.ts` and `hints.ts` 100 % lines; `pace.ts` 100 % lines / 95.45 % branches.
  Thresholds met.
- `npm run lint && npm run build` → exit 0.
- `git diff --stat main -- src/sim src/config.ts` → empty; the golden replay test passes unchanged.
- Browser, dev server (`vite --port 5179`, Supabase pointed at a dead host, `/api` 404, so nothing was posted):
  - A catch forced through `window.__gator` goes `ending` → `deathcam` (HUD hidden, "Replay" badge shown) → `over`.
  - A real Space press during the death cam → `over`, Retry focused, one `deathcam_skip {at: 0.7}` queued, no extra run.
  - Space on the card → a new run. Each press started exactly one `run_start`.
  - `run_end` carries `nearMisses: 0, spottedCount: 1`.
  - Under `prefers-reduced-motion: reduce`: two canvas captures 0.8 s apart during the death cam were identical (still frame), and max `fx.shake` was 0 (1 without the emulation).
  - HUD pace chip read "▼ −2s behind" against a seeded timeline.
  - The first spot showed "Break line of sight behind logs and reeds" and cleared after 3 s; `hints-seen` became 1.
- `vite preview` (production build, Supabase blocked): boots and plays; the DEV hook is absent; the only console
  error is the expected `/api/events` 404 (no functions under preview). A catch was not forced there, because
  the hook is DEV-only.
- Screenshots (session scratchpad), each with no horizontal overflow:
  - `/private/tmp/claude-501/-Users-allan-workspace-100ai-dino-game/b8c38821-fbb0-4cf6-b502-a664ce21c3cd/scratchpad/over-320.png` (stats wrap to 2×2)
  - `/private/tmp/claude-501/-Users-allan-workspace-100ai-dino-game/b8c38821-fbb0-4cf6-b502-a664ce21c3cd/scratchpad/over-768.png`
  - `/private/tmp/claude-501/-Users-allan-workspace-100ai-dino-game/b8c38821-fbb0-4cf6-b502-a664ce21c3cd/scratchpad/over-1024.png`
  - `/private/tmp/claude-501/-Users-allan-workspace-100ai-dino-game/b8c38821-fbb0-4cf6-b502-a664ce21c3cd/scratchpad/over-1440.png`
  - `/private/tmp/claude-501/-Users-allan-workspace-100ai-dino-game/b8c38821-fbb0-4cf6-b502-a664ce21c3cd/scratchpad/deathcam-1440.png` (cone + "Spotted here")
- Main chunk gzipped: **before 25.32 KB → after 27.90 KB** (budget 30 KB; 19.2 KB on 2026-10-31 before modes).

**Code review (independent agent):** no CRITICAL/HIGH. Fixed:
- MEDIUM: a Space retry left Space held, so the new run started sprinting. It is now released
  (`Keyboard.release`). Re-checked in the browser: stamina 100, not sprinting.
- MEDIUM: "Past your best" showed in the best run's last, unrecorded seconds. Pace now hides there
  and says "Past your best" only once the best score is beaten. Test added.
- LOW: hints could linger over the death cam and card, or carry into the next run. They are now
  cleared on run start and death cam start.
- LOW: the death cam skipped on modifier keys and Tab, and on input in its first instant. It now
  ignores modifiers and Tab, and has a 0.3 s grace (`DEATHCAM_SKIP_GRACE_S`). Re-checked: a key at
  50 ms and Shift did not skip; a key after 0.3 s did.
- Not changed (LOW, cosmetic): "Close shave!" appears at the duck's current position, 0.5 s after
  the pass, where the player is looking.

**KPI gate for this phase:** retries/session ≥ 3 and D1 ≥ 20 %, measured over 7 days after deploy (Classic only).

**Staging (Vercel Preview `gator-gotcha-c1pmfao4x-allandanos.vercel.app`, commit `a3dcb44`)**
- `vercel curl /` serves the new markup (`#deathcam`, `#hud-pace`, `#over-unseen`).
- `POST /api/events` with `deathcam_skip {at: 1.2}` and `run_end {…, nearMisses: 2, spottedCount: 1}` → `202 {"accepted":2}`.
  A service-role read returned both props as sent. Test session `95f3e970-c690-4bf1-a780-575d98ef17da`,
  `app_version = 'phase1-smoke'`, kept in the shared project per "delete nothing"; exclude it from KPI queries.

**Production (`main` fast-forwarded to `a3dcb44` by the owner; deployment `gator-gotcha-1igic4l4k`)**
- https://www.gatorgotcha.com serves the new markup. `POST /api/events -d '{}'` → `400`.
- Chrome, fresh isolated context: the title shows today's seed `d20261102`; the card has 4 run-stat fields;
  `window.__gator` is absent; there are no console errors or warnings. No run was played on production.
- KPI gate window starts 2026-11-02: retries/session ≥ 3 and D1 ≥ 20 %, Classic only, after 7 days.

### Phase 2

**Baseline (2026-11-02, `d834aee`):** `npm test` 29 files / 238 passed · lint + build exit 0 ·
`grep -c "| 1 | done" PROGRESS.md` → 1.

**Phase 1 KPI gate: not measurable yet.** Read with the service role, read-only, Classic only, with
`local-test` and `phase1-smoke` excluded.
- Phase 1 went live at about 01:00 UTC today. The latest event was at `2026-11-02T01:10Z`.
- Retries per session since then: 1 session, mean 1.0. That is too few to judge (target ≥ 3).
- D1 (`events_retention`): the 2026-11-01 cohort is 3/14 = 21.4 % (target ≥ 20 %), but those
  players arrived before Phase 1.

**Owner decisions (this session):**
- **Build now, ship after the gate.** Phase 2 is built and committed locally but not pushed until
  the Phase 1 gate is read on or after 2026-11-09, so Season 1 doesn't muddy Phase 1's numbers.
- **Where Season 1 applies:** Classic, Night and Campaign. **Egg Rush keeps its old rules**
  (`RunRules.ducklings = false`). Its sim is bit-identical: the `buzz36` 500-point replay and the
  Rush bot replays pass unchanged.

**Decisions taken:**
- **Missing `ruleset`:** a submission without one counts as `0`, so clients from before seasons
  get a **409** "Game updated: please reload" and their queues drop the run. A bad type is
  still a 400. The ruleset check runs before the replay, which keeps stale runs cheap.
- **Dedupe hash:** it is now `sha256("r<RULESET>:<mode>:<seed>:<log>")`. The same log under new
  rules is a new run. Runs queued before Season 1 can't collide, because they 409 first.
- **`app_config.current_ruleset` is seeded `0`,** so live boards don't change before the Season 1
  client ships. The new client always asks for `season = RULESET` explicitly; only old cached
  clients use the null default. **At deploy:** `update public.app_config set current_ruleset = 1;`
- **`season` is an `integer` parameter,** not `smallint`. A plain `1` doesn't resolve to a
  `smallint` parameter (verified), so `integer` saves every caller from needing a cast. The
  column stays `smallint`.
- **New `scores.banked` column:** it records ducklings banked, for share and OG copy ("banked 12
  ducklings"). `replayRun` returns `banked` (a ducklings count), and so does the submit response.
- **Step order:**
  1. The duck moves, and the trail follows.
  2. Pickups hatch ducklings.
  3. The trail banks if the duck is in the nest.
  4. The gator moves.
  5. Tail snap.
  6. Duck catch.

  Banking comes before the gator, so arriving at the nest pays out even if the gator lands on
  the tail that tick.
- **Trail:**
  - Each duckling steers for the duck's position `lag × place` ticks ago, but only if that point
    is at least one spacing back from the duckling ahead and closer than the leader.
  - Otherwise it holds its ground, and it is then held at exactly `TRAIL.spacing` from its leader.
  - Ducklings stay put when the duck stops, and new ones line up behind the tail.
- **Snap and stun:**
  - A snap gives `Gator.stun = 1.2 s`. While stunned the gator can't move, see, hear or snap.
  - The duck itself can still walk into its mouth.
  - Snapping uses `isCaught` against the tail.
- **Tail sight:** `spotsDuck` sees the duck, or the tail once there are 4 or more ducklings.
  Seeing the tail starts a chase toward the duck.
- **Golden egg:**
  - The chance is rolled only under Season 1 rules, so other modes draw the same random numbers.
  - Only one golden egg can be on the field at once.
  - Its splash radius is the gator's hearing radius × 2. That includes Night's ×1.5 hearing,
    which the spec's `GATOR.splashHearRadius × 2` didn't mention.
- **Nest:** the nest is `World.nest = map.duckSpawn`. Spawn clearance (140 u) already exceeds the
  nest radius plus the duck radius (64 u), and the test now asserts it. A new
  `NEST.eggClearance = 200` keeps new eggs out of the nest, so every bank means a trip.
- **Difficulty:** `gatorStats(time, eggs, rules, carried)`. Carried ducklings count on top of the
  eggs collected.
- **Campaign:**
  - Egg goals became "Bank N ducklings" (same N).
  - Par times rose by about 30 % (for example 30 → 45 s).
  - The clocks on levels 8, 9 and 11 went from 60/45/90 to 75/60/105 s.
  - The banking bot clears levels 1, 3 and 5 (8/8, 8/8 and 5/8 bot seeds) and sometimes 8 and 9.
    It is far weaker than people, so **the campaign still needs a human playtest.**
- **HUD:**
  - A "Carrying ×n → +value" chip (amber while carrying) and a "Banked" count replace the Eggs
    chip under Season 1. Rush keeps the Eggs chip.
  - The nest arrow is drawn on the canvas (`Renderer.drawNestArrow`), not in `hud.ts`, because
    only the renderer knows the camera. It shows when the nest is off screen, or the trail has
    5 or more ducklings.
- **Events:** `run_end` gains a `banked` prop (clamped integer, 0–10 000) for the Phase 2 gate
  ("≥ 70 % of runs bank at least once").
- **Bundle:** Season 1 took the esbuild main chunk to 30.61 KB, over the 30 KB budget. The build
  now uses **terser** (`build.minify`). `terser@5.51.2` was already installed through
  `vite-plugin-pwa` and is now pinned as a devDependency. That brings the main chunk to
  **29.27 KB**, and the online chunk drops from 60.34 to 58.78 KB. Terser's default compress has
  no unsafe float math, and two checks confirm it:
  - The sim and the bot were bundled with esbuild, then minified with terser
    (`--compress --mangle`). Over 100 bot runs (50 seeds × Classic and Night, 98 of them banking),
    the minified and plain bundles gave byte-identical results.
  - A real keyboard-driven run on the terser production build (`vite preview`) queued its log
    (`ruleset: 1`). The server's `replayRun` reproduced the card's score exactly: 1240 = 1240.

**VERIFY results:**
- **Changing a function signature needs `drop function`:** confirmed. Adding a parameter creates a
  new overload, so the 4-arg `leaderboard` / 5-arg `rank_for` are dropped and recreated with the
  same grants (`anon, authenticated`, plus `service_role` on `rank_for`).
- **Golden-egg seed:** **`gold0`** (Classic). A golden egg is on the opening field at (1008, 94),
  and the nest is at (280, 560). It is also recorded in the phase doc Appendix.

**Migration `20261115000000_rulesets.sql`:** applied in order after the three earlier migrations on
a throwaway `postgres:17-alpine`, with stubbed `auth` and roles. Checks:
- the legacy 3- and 4-arg `leaderboard()` and the 4-arg `rank_for()` still return Season 0
  while `current_ruleset = 0`;
- `season => 1` returns only ruleset-1 rows;
- after `update app_config set current_ruleset = 1`, the null season reads Season 1;
- anon can read `app_config`, but not insert or update it;
- the one-row check (`id` must be true) holds.

**Not applied to production.** The owner runs `supabase db push --linked` before deploying.

**Season 0 count:** 117 production `scores` rows at `2026-11-02T01:52Z` (Classic 109, Rush 3,
Night 5; read-only, anon key). The count grows until the migration runs, so re-count right before
`db push`. Afterwards, `count(*) where ruleset = 0` must equal it.

**Acceptance (local, 2026-11-02):**
- `npm test`: 30 files, **280 passed** (238 + 42). Coverage is 98.6 % lines over all files;
  `trail.ts`, `scoring.ts` and `sight.ts` are 100 % lines, and `world.ts` is 100 % lines /
  98.76 % branches. Thresholds are met.
  - New tests: trail (8), tail sight (3), gator stun, tail spotting and loud splash (3),
    Season 1 world (10: hatch, Rush no-hatch, bank, no-bank, snap and stun, duck still caught,
    golden on `gold0`, golden ×5 with cap and loud splash, egg clearance), bank values and
    carried difficulty, ruleset 409 ×3 / 400 / ruleset storage, queue ruleset (2), share and
    OG copy, `run_end.banked`, the campaign banking goal, and 50-seed determinism.
- `npm run lint && npm run build`: exit 0.
- `npx vitest run src/sim/mapgen.test.ts`: connectivity holds over 200 seeds, with the nest
  radius clear on all of them.
- **Golden replay snapshot regenerated** for ruleset 1 (bot 4 on `golden`, which banks):
  `{ banked: 4, eggs: 4, score: 780, ticks: 1832 }`. That is two banks of 2 (2 × 240), plus
  30 s × 10.
- `grep Math.(sin|cos|atan2|hypot|pow) src/sim` (non-test): none.
- **Browser** (dev server on port 5179 with Supabase blocked; Playwright Chromium, because the
  chrome-devtools MCP profile was held by another session):
  - On seed `gold0`, a golden egg is on the field.
  - With 5 ducklings carried, the HUD read `×5 → +750`.
  - The gator's snout was placed on the tail: the trail went to 4, the run continued
    (`playing`), the gator was stunned for 0.92 s, and the HUD read `×4 → +560`.
  - Walking into the nest: banked 560, 4 ducklings, the trail cleared, and the score rose by
    exactly 560 beyond the time points.
  - The caught card shows "Banked 4".
  - Rush has no trail, no golden egg and keeps the Eggs chip.
  - No page errors. No horizontal overflow at 320, 768, 1024 or 1440.
  - Fixed during the check: the Carrying chip and the board tabs wrapped at 320. They are now
    `nowrap`, with clamped padding.
- **Screenshots** (session scratchpad):
  `/private/tmp/claude-501/-Users-allan-workspace-100ai-dino-game/8e1db280-f5c1-439c-808b-e2443fd296e2/scratchpad/shots/`
  holds `carry5-1440.png`, `snap-1440.png`, `banked-1440.png`, `trail-{320,768,1024,1440}.png`,
  `over-{320,1440}.png`, `title-{320,1440}.png` and `board-{320,1440}.png`.
- **Main chunk gzipped:** 27.90 KB (Phase 1) → 28.06 KB (2a) → **29.27 KB** (terser; 30.61 KB with
  esbuild). The budget is 30 KB.

**Code review (independent agent):** no CRITICAL or HIGH findings. Fixed:
- MEDIUM: the gator could snap a duckling through a log, because the snap was a distance test
  only. A snap now also needs line of sight from the snout to the tail. Ducklings are clamped
  inside the arena; they still ignore obstacles, by design. Tests were added for both.
- MEDIUM: local bests and pace timelines were keyed by mode only. A Season 0 Classic or Night best
  (eggs × 100) would hide Season 1 new-best feedback. Modes with ducklings now use `…:s1` keys.
  Rush keeps its key, since its rules didn't change, and the old keys stay untouched as Season 0.
- LOW: a snap and a catch could land on the same tick, which wasted the sacrifice. On a snap
  tick the duck can't be caught. Tested.
- LOW: the sight cone was drawn while the gator was stunned and blind. It is now hidden while
  stunned.
- LOW: the board reopened on the Season 0 tab. It now opens on the current season.
- Kept as designed: a stunned gator can still catch a duck that walks into its jaws.
  Carried ducklings count on top of the eggs collected for difficulty, as the spec says. The
  `spawnEgg` fallback after 200 tries can break the nest clearance, which matches the existing
  behaviour for the other spacing rules.

**Security review (§5.4):** the endpoint change is one validated integer (`z.number().int()`),
checked before the replay and before the rate-limit read. The migration:
- enables RLS on `app_config`, with a select-only policy;
- revokes insert, update and delete from anon and authenticated;
- keeps both functions `security invoker` with `search_path = ''` and fully qualified names;
- recreates the grants after the drop.

`run_end.banked` is a clamped integer, analytics only. No CRITICAL, HIGH or MEDIUM findings.

**Not yet done (owner or staging):**
- `vercel dev` / staging: `ruleset: 0` → 409, and a fresh run → 201 with `banked`. Under
  `vercel dev` the API writes to the production Supabase, which doesn't have the new columns
  yet, and the check would create real anonymous users. Run it on staging after `db push`. The
  same paths are covered by `api/_lib/submitScore.test.ts`.
- The Phase 2 KPI gate (after a 7-day soak): median run 60–150 s, and ≥ 70 % of runs bank at
  least once (`run_end.banked > 0`, or `scores.banked > 0` with `ruleset = 1`).

**Release order (when the owner gives the go-ahead after 2026-11-09):**
1. Re-count `scores`.
2. `supabase db push --linked`. This is safe before the deploy: old code ignores the new columns,
   and the old 4-/5-arg board calls still read Season 0.
3. `git push origin main:staging`, then smoke-test the Preview.
4. The owner pushes `main`.
5. `update public.app_config set current_ruleset = 1;`


### Phase 2 re-scope (2026-11-02)

**Owner decisions** (they supersede the season design above; also noted at the top of
`docs/prompts/phase-2-season-1.md`):
- **No seasons and no Season 0 tab.** Classic keeps its existing scores as its board. The
  `ruleset` column and the stale-client 409 stay. `app_config` and the `season` board parameter
  are gone.
- **Classic** goes back to Phase 1 egg scoring and gets a **day/night cycle**: 40 s of day, then
  20 s of night with the `MODES.night` factors (cone × 0.65, hearing × 1.5).
  - The fog fades in over 2 s at dusk and out over 2 s at dawn (render only).
  - The HUD shows "Night in 5…", then "Dawn 0:20" through the night.
  - On the first night, a one-time tip shows: "Night falls: the gator sees less but hears more".
  - Nightfall and daybreak each play a sound.
- **Night Swamp** is retired as a ranked mode. Its 5 production rows are kept untouched and
  shown on no board.
- **Duckling Dash** (`ducklings`) is a new ranked mode with the trail, nest, snap and golden
  egg. It is always in daylight.
- **Egg Rush** is unchanged.
- **Campaign mixes level types:**
  - Levels 4, 9 and 11 are bank-N-duckling levels, with the Phase 2 par times and clocks.
  - Every other level is back to its Phase 1 values.
  - The night levels (5–8 and 12) stay egg or survive levels.

**Decisions taken:**
- **Cycle math.** It runs on the accumulated `World.time`, the same value the server replays.
  `cycle.ts` owns the phase math (`isNightAt`, `senseFactors`, `fogAlpha`, `secondsToNight`,
  `secondsToDawn`). Night levels use `rules.night`; `rules.dayNight` drives the cycle.
- **Stale clients.** `submitScore` now checks the ruleset before the mode. An old cached client
  sending `mode: 'night'` gets the 409 "please reload". On the current ruleset, `night` is a
  400. Queued `night` runs and a saved `night` mode fall back to Classic or are dropped
  client-side.
- **Local bests are back on the Phase 1 keys.** Classic bests stay valid; Duckling Dash uses
  `best:ducklings`.
- **The migration was rewritten (still unapplied).** It adds `ruleset` and `banked`, and swaps
  `scores_mode_check` to `classic|rush|night|ducklings`. `night` stays allowed for the old rows.
  `leaderboard` and `rank_for` are untouched.

**Accepted gaps (from the code review, no CRITICAL or HIGH findings):**
- **The Classic board mixes ruleset 0 (no cycle) and ruleset 1 (cycle) scores.** This is
  deliberate, by owner decision. `ruleset` is recorded, so the board can be split later if
  needed.
- **Old Night Swamp share links.** `getShared` maps a stored `night` row to Classic. Such a link
  shows no mode label and opens a Classic challenge. Only the 5 hidden rows are affected.

**Fixed from the review:** cycle phase math now lives only in `cycle.ts` (new `secondsToDawn`); a
duplicate import; leftover season naming.

**Acceptance (local):**
- `npm test`: 32 files, **297 passed**. Coverage: 98.7 % lines; `cycle.ts`, `scoring.ts`,
  `campaign.ts` and `difficulty.ts` 100 %.
- `npm run lint && npm run build` exit 0. The main chunk is **29.78 KB** gzipped (budget 30 KB).
- **Golden snapshots** (ruleset 1):
  - Classic, with the evasive bot on `golden` through a full night:
    `{ eggs: 0, score: 700, ticks: 4257 }`.
  - Duckling Dash, with bot 4 on `golden`: `{ banked: 4, eggs: 4, score: 780, ticks: 1832 }`.
  - The 50-seed determinism test now runs both modes.
- **Migration on a throwaway `postgres:17-alpine`** (after the three earlier migrations, with
  pre-existing `classic` and `night` rows):
  - existing rows read `ruleset 0` and `banked 0`;
  - the Classic board lists the old Classic row;
  - the `night` row survives but is on no board;
  - a `ducklings` insert appears on its own board, and `rank_for` works;
  - a `turbo` mode and a daily `ducklings` row are both rejected.
- **Browser** (dev server, Supabase and `/api` blocked, Playwright Chromium):
  - Classic on `gold0`: no trail, and the Eggs chip shows. At 36.8 s the HUD read "Night in 4".
    At 40.8 s it read "Dawn 0:20", with the fog and the tip. An egg counted with no duckling.
    At 62.8 s the chip had cleared.
  - Duckling Dash: golden egg present, Carrying chip, no night chip at 41 s. Banking 4 paid 560.
  - Modes screen: Classic / Egg Rush / Duckling Dash / Campaign. The board switch is
    Classic / Egg Rush / Ducklings, with no Season 0 tab.
  - Campaign tiles: L4 "Bank 10 ducklings", L5 night "Grab 4 eggs".
  - No overflow at 320, 768, 1024 or 1440. No page errors.
- Screenshots: `rescope-*.png` in the session scratchpad `shots/`.

**Release order (supersedes the one above, after the go-ahead on or after 2026-11-09):**
1. `supabase db push --linked`. It's safe before the deploy: old code ignores the new columns.
2. `git push origin main:staging`, then smoke-test the Preview:
   - `ruleset: 0` → 409;
   - `mode: 'night'` from an old client → 409;
   - a fresh Classic run → 201;
   - a Duckling Dash run → 201 with `banked`.
3. The owner pushes `main`.

**Still open:**
- A human playtest of the campaign duckling levels and of the cycle pacing.
- The Phase 2 KPI gate after a 7-day soak:
  - median run 60–150 s;
  - ≥ 70 % of **Duckling Dash** runs bank at least once.

**Cycle retune (2026-11-02, owner):** the cycle went from 40/20/2 to **55 s day + 5 s dusk + 30 s
night = 90 s**. Dusk is now its own phase.
- **Dusk:** the fog fades in and the HUD shows "Night in 5…", while the gator keeps its daytime
  senses.
- **Night:** night senses from 60 s to 90 s.
- **Dawn:** the fog lifts over the first 5 s of the next day (render only).

Ruleset 1 had never reached production, and its only scores (the staging smoke runs) were deleted,
so there was no `RULESET` bump. The Classic golden snapshot moved to the evasive bot on `dusk4`
(124 s, through nightfall at 60 s and daybreak at 90 s): `{ eggs: 0, score: 1240, ticks: 7456 }`.
The same run without the cycle is caught at 5045 ticks, and a test asserts the two differ.
