# Progress

| date | phase | status | notes |
|---|---|---|---|
| 2026-11-01 | 0 | done | events live |
| 2026-11-02 | modes | live |  egg rush, night swamp, campaign (out of band, before phase 1) |
| 2026-11-02 | 1 | done | death cam + juice |

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
