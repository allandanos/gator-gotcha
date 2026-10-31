# Progress

| date | phase | status | notes |
|---|---|---|---|

## Evidence

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
