# Phase 0 — measure: first-party events pipeline and retention views

**Step 0:** Read `docs/prompts/00-shared-context.md` in full (especially §2 operating rules, §5.3–5.5
on writes, endpoints and analytics, and §6.5 on the offline queue). This prompt assumes it.

## Objective

When this phase ends, the client records a small set of gameplay events, buffers them offline,
and posts them in batches to a new `POST /api/events` Vercel Function. The function validates
them, rate-limits them, and writes them with the service role to a Supabase `events` table that
clients cannot read. SQL views answer D1/D7 retention, runs per session, retry rate and
time-to-death. `PROGRESS.md` exists with the phase-0 evidence. No gameplay or sim change.

## Baseline check

This is the first phase, so verify the starting state instead of a previous gate:

```bash
git status --short            # expect: empty
npm test                      # expect: 114 passed
npm run lint && npm run build # expect: exit 0
ls supabase/migrations        # expect: only 20261031000000_leaderboard.sql
test ! -e PROGRESS.md && echo "no ledger yet"
```

If the test count differs, record the new count in `PROGRESS.md` instead of STOPping, as long as
everything is green.

## Scope

**In:** events table + views migration; `/api/events`; client event queue and emit points;
`PROGRESS.md`; tests.
**Out:** any UI change (Phase 1), dashboards beyond SQL views (not planned), portal analytics
(Phase 4), purchase events (Phase 5).

## Tasks

1. **Create `PROGRESS.md`** at the repo root with the table header from the Appendix and an
   `## Evidence` section.
2. **Migration** `supabase/migrations/20261101000000_events.sql` (new file, never edit the old one):
   - Table `public.events` per the Appendix schema. `user_id` nullable (events can precede the
     anonymous session); `session_id` is a client-generated UUID per page load.
   - `alter table public.events enable row level security;` with **no** policies, and
     `revoke all on public.events from anon, authenticated;`.
   - Indexes: `(created_at)`, `(user_id, created_at)`, `(session_id)`.
   - Views (`security_invoker = true`, granted to no client role): `events_daily_active`,
     `events_retention` (D1, D7 by first-seen cohort day), `events_session_runs`
     (runs + retries per session), `events_death_histogram` (10 s buckets of `run_end.sec`).
   - Apply with `supabase db push` (VERIFY the CLI is linked: `supabase projects list`). If the
     CLI isn't linked, STOP condition §7.5.
3. **Pure validation module** `api/_lib/events.ts`: a zod schema for a batch (1–50 events), the
   allowed event names and per-name `props` shape (Appendix), and a `normalizeBatch()` that
   clamps numbers and drops unknown props. Tests in `api/_lib/events.test.ts` (TDD: write first).
4. **Repository**: add an `EventRepository` interface and `supabaseEventRepository()` in
   `api/_lib/repository.ts` following `ScoreRepository` (`insertMany`, `countSince` per session).
5. **Function** `api/events.ts`: mirrors `api/scores.ts`. Body cap 16 KB → 413. Optional bearer
   token (resolve `user_id` if present, never required). Rate limit: 120 events per session per
   minute → 429. Returns 202 `{ accepted: n }`. Errors go through `logError`.
6. **`vercel.json`**: add `/api/events` beside the existing `/api/scores` header rule (same
   no-store caching). Validate the file parses: `node -e 'JSON.parse(require("fs").readFileSync("vercel.json","utf8"))'`.
7. **Client queue** `src/ui/eventQueue.ts`: same shape as `src/ui/pendingRuns.ts` (storage
   injected, max 200 events, oldest dropped first). Reuse `flushDecision` from
   `src/ui/pendingRuns.ts` for the response policy (§6.5). Unit tests in `src/ui/eventQueue.test.ts`;
   add the file to the coverage `include` list in `vite.config.ts`.
8. **Emit points** (`src/main.ts`, `src/ui/install.ts`, `src/ui/updates.ts`, `src/ui/onlineUi.ts`):
   `title_view` on boot, `run_start` in `startRun`, `run_end` in `finish`, `retry` when a run starts
   from the game-over screen, `share` on share/copy, `install` on the `appinstalled` event,
   `update_applied` right before an update reload. Flush on `run_end`, `online`, and
   `visibilitychange` → hidden (use `fetch(..., { keepalive: true })`).
9. **Privacy page** `public/privacy.html`: add one paragraph listing the event names and that no
   personal data beyond the anonymous id is collected.
10. **Security pass**: run the `security-review` skill on `api/events.ts` and `api/_lib/events.ts`;
    fix CRITICAL/HIGH.
11. **Deploy and smoke-test** against production (after approval): play one run, then query the
    table count with the service role (Appendix query). Delete nothing.

## Acceptance criteria

- [ ] `npm test` → all pass, count = baseline + new tests; coverage thresholds met.
- [ ] `npm run lint && npm run build` → exit 0.
- [ ] `npx vitest run api/_lib/events.test.ts src/ui/eventQueue.test.ts` → pass, including:
      oversize batch rejected, unknown event dropped, numbers clamped, 404/5xx keep, 422 drops.
- [ ] `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3000/api/events -d '{}'`
      under `vercel dev` → `400`.
- [ ] A valid batch under `vercel dev` → `202`.
- [ ] Anon key cannot read events: `curl -s "$VITE_SUPABASE_URL/rest/v1/events?limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"`
      → an error or `[]`, never rows.
- [ ] Golden snapshot in `src/sim/replay.test.ts` unchanged (`git diff --stat src/sim` → empty).
- [ ] After deploy: service-role count query returns ≥ 1 row for each of `title_view`,
      `run_start`, `run_end`.

## Checkpoint protocol

1. Run every acceptance command; paste outputs into `PROGRESS.md` → `## Evidence` → `### Phase 0`.
   Add the ledger row `| <date> | 0 | done | events live |`.
2. Commit `feat: first-party events pipeline and retention views (phase 0)`.
3. Stop and summarize: what exists, what was deferred, decisions taken, VERIFY results. The KPI
   gate (7 days of data) is checked at the start of Phase 1, not now. Await the owner's go-ahead.

## Appendix

### `PROGRESS.md` skeleton

```markdown
# Progress

| date | phase | status | notes |
|---|---|---|---|

## Evidence
```

### `events` schema

| column | type | notes |
|---|---|---|
| `id` | `bigint generated always as identity primary key` | |
| `session_id` | `uuid not null` | per page load |
| `user_id` | `uuid null references public.profiles(id) on delete set null` | |
| `name` | `text not null check (name ~ '^[a-z_]{3,24}$')` | |
| `props` | `jsonb not null default '{}'` | `check (pg_column_size(props) < 1024)` |
| `platform` | `text not null default 'web'` | Phase 4 adds `crazygames` |
| `app_version` | `text not null` | build id from Vite `define` |
| `client_ts` | `timestamptz not null` | |
| `created_at` | `timestamptz not null default now()` | |

### Event catalogue

| name | props |
|---|---|
| `title_view` | `{ installed: boolean, referrer: string ≤ 64 }` |
| `run_start` | `{ seed: string, daily: boolean, fromOver: boolean }` |
| `run_end` | `{ sec: number 0–1200, eggs: integer 0–10000, score: integer }` |
| `retry` | `{}` |
| `share` | `{ via: 'facebook' \| 'copy' }` |
| `install` | `{}` |
| `update_applied` | `{ from: string, to: string }` |

### Service-role count query (no secrets printed)

```bash
set -a; . ./.env.local; set +a
curl -s "$SUPABASE_URL/rest/v1/events?select=name&limit=1000" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const c={};for(const e of JSON.parse(d))c[e.name]=(c[e.name]||0)+1;console.log(c)})'
```
