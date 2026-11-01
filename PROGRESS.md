# Progress

| date | phase | status | notes |
|---|---|---|---|
| 2026-11-01 | 0 | done | events live |
| 2026-11-01 | modes | on staging | egg rush, night swamp, campaign (out of band, before phase 1) |

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
2. ~~Push `staging` and smoke-test the Preview~~ done. Then push `main`.


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
