# Phase 3 — meta: Feathers, daily missions, streaks, cosmetics, ghosts, account linking

**Step 0:** Read `docs/prompts/00-shared-context.md` in full (especially §5.3 data writes, §5.6
gates, §5.9 identity, §6.7 iOS storage, §6.10 `site_url`). This prompt assumes it.

## Objective

When this phase ends, players have reasons to come back tomorrow, and their progress survives
device changes:
- **Feathers.** A server-computed soft currency, credited from verified runs.
- **Daily missions.** Three per UTC day, checked during the server replay.
- **Streaks and achievements.** A day-streak counter and achievements.
- **Cosmetics.** Render-only cosmetics (duck color, hat, trail style, nest decor), bought with
  Feathers and stored as entitlements.
- **Ghost challenges.** Share links let a friend race your ghost on the same swamp.
- **Account linking.** Players can link Facebook or Google to their anonymous account.

The sim rules do not change. Missions *read* sim state; they never alter it.

## Baseline check

```bash
npm test && npm run lint && npm run build
grep -c "| 2 | done" PROGRESS.md     # 1
```

Record the Phase 2 gate: median run length, and the share of runs with at least one bank, over
the 7 days after the Season 1 deploy. You get it from the `scores` (`ticks`, `banked`) and
`run_end` events. Ask the owner to confirm before continuing if the gate missed.

**Owner prerequisite:** they must have run `supabase config push --project-ref ecjoimtngyohebssnxrw`
(gotcha §6.10). Ask; if they have not, the account-linking tasks (13–15) wait, and the rest proceeds.

## Scope

**In:** wallet ledger; mission generator and checker; streaks; achievements (10); cosmetics
catalogue (12 items) and Feather shop; log storage and retention; ghosts; Facebook and Google linking.

**Out:** paid items (Phase 5); ad rewards (Phase 4); season-specific cosmetic tracks (Phase 6).

## Tasks

### A. Server-side progression

1. **Migration** `supabase/migrations/20261201000000_meta.sql`:
   - Tables `wallet_ledger`, `mission_progress`, `achievements_earned`, `cosmetics`,
     `entitlements`, `player_equipped` and `run_logs` (Appendix).
   - RLS: players may **select** their own rows (`auth.uid() = user_id`). `cosmetics` is public
     read. Only the `player_equipped` update goes through a function that checks ownership.
   - All writes go through the service role. Add a `wallet_balance` view.
2. **Mission generator** `src/meta/missions.ts`. It is pure, shared by client and server, and has
   tests first. `missionsFor(dateIso)` picks 3 templates with an `Rng` seeded from
   `hashSeed('m' + date)`. Templates and their rewards are in the Appendix.
3. **Run facts.** `src/sim/replay.ts` gains `replayFacts(seed, inputs)`. It wraps `replayRun` and
   collects facts from the per-step events: maximum single bank, longest unseen streak, total
   banked, golden eggs, snaps survived. This is pure and has no effect on the score. **The golden snapshot must not change**
   (STOP §7.3).
4. **Credit on submit** (`api/_lib/submitScore.ts`). After the insert, a `ProgressRepository`
   (new, in `api/_lib/repository.ts`):
   - inserts `wallet_ledger(+banked ducklings)`, capped by `FEATHERS.dailyCap` per UTC day;
   - updates `mission_progress` for today's missions;
   - awards achievements;
   - updates the streak, a `profiles.streak_days` / `profiles.last_play_date` pair (added by
     the migration).
   The response gains `{ feathers, missionsCompleted, achievements }`. Write the tests first
   against a fake repository.
5. **Store the log** in `run_logs(score_id, log)`. A daily retention job removes logs that are
   both older than 30 days and not the player's best. Implement it as a Vercel cron:
   - `api/cron/prune-logs.ts`;
   - `crons` in `vercel.json`;
   - authorised by the `CRON_SECRET` env var (VERIFY the current Vercel cron auth header).
6. **Feather shop** `POST /api/shop/buy { cosmeticId }`:
   - checks that the balance covers the price;
   - checks that the item is `currency = 'feathers'`;
   - inserts the entitlement and a negative ledger row in **one** SQL function,
     `buy_cosmetic(user, id)`, using `security definer` and service role only, to avoid races;
   - is idempotent on (user, cosmetic).
   `POST /api/equip { slot, cosmeticId }` is validated by ownership.

### B. Client

7. **Profile panel** (`index.html` gets a new `#screen-profile`; logic in `src/ui/profileUi.ts`;
   data calls in `src/online/`). It shows balance, streak, today's 3 missions with progress,
   achievements, the shop grid and the equipped items. All of it lazy-loads with the online chunk.
8. **Cosmetics rendering** (`src/render/cosmetics.ts`). These are parameterised procedural
   variants: duck tint (palette swap), hats as small vector shapes, trail style (classic,
   rainbow, glow) and nest decor. Equipped items are cached in `src/ui/storage.ts`, so offline play shows them. They must not
   import mutable sim state.
9. **Game-over additions:**
   - "+n Feathers" with a counting animation;
   - mission ticks;
   - "Streak: 4 days 🔥", with text alongside the emoji for screen readers.
10. **Ghosts.**
    - `GET /api/ghost/:scoreId` returns `{ seed, ruleset, log }` for a public score of the
      current ruleset, cached in the CDN for 1 day.
    - Opening `/s/<id>` (the existing share redirect) adds `&ghost=<id>`. `src/ui/bootSeed.ts`
      parses it, with validation and tests.
    - During the run, a second `World` is stepped in lockstep from the ghost log, render only.
    - The ghost duck is translucent with its nickname. It stops at its catch tick.
    - VERIFY the CPU cost on a low-end phone profile by running the chrome-devtools performance
      trace with a 4× CPU throttle and holding 60 fps.
11. **Share copy:** "Race my ghost on this swamp", using `api/share.ts` and `api/og.ts`.
12. **Events:** `mission_complete`, `shop_buy`, `equip`, `ghost_start`, `ghost_beaten`.

### C. Account linking

13. Supabase Auth: enable Google (VERIFY the current dashboard steps). Set the Facebook provider
    up per the `README.md` "Enabling Facebook Login" section. The owner does the dashboard work;
    the session does not have that access (STOP §7.5 if it is needed).
14. Client: "Save your progress" on the profile panel, using `supabase.auth.linkIdentity` for
    Facebook or Google (VERIFY the supabase-js 2.x API name and that manual linking is enabled
    for the project). It keeps the same `user_id`, so all rows carry over.
15. Set `VITE_FB_LOGIN_ENABLED=true` and add `VITE_GOOGLE_LOGIN_ENABLED` in Vercel env. Extend
    the CSP `connect-src`/`form-action` only if the OAuth redirect needs it; VERIFY by testing.

## Acceptance criteria

- [ ] `npm test` passes. New tests cover `missionsFor` determinism, `replayFacts`, Feather credit
      with the daily cap, purchase idempotency and insufficient balance, and ghost `bootSeed`
      parsing. Coverage thresholds are met.
- [ ] `npm run lint && npm run build` exits 0. `git diff main -- src/sim/world.ts src/sim/scoring.ts`
      is empty, and the golden snapshot is unchanged.
- [ ] `security-review` passes on `api/shop/*`, `api/equip.ts`, `api/ghost/*` and
      `api/cron/prune-logs.ts`.
- [ ] Under `vercel dev`:
      - a verified run credits Feathers;
      - a second identical submit returns 409 and credits nothing;
      - buying with too few Feathers returns 402;
      - buying twice gives one entitlement.
- [ ] Anon key cannot read another user's `wallet_ledger` (curl with the anon key and another id
      returns `[]`).
- [ ] Browser: opening a share link with `&ghost=` shows the ghost, and beating it emits
      `ghost_beaten`.
- [ ] Linking flow tested on a real phone by the owner. Record the result in `PROGRESS.md`.

## Checkpoint protocol

1. Put the evidence in `PROGRESS.md` under `### Phase 3`, with the row
   `| <date> | 3 | done | meta + ghosts |`.
2. Commit `feat: feathers, daily missions, cosmetics, ghosts, account linking (phase 3)`. The
   commit can be split per section A/B/C if it gets large.
3. Stop and summarize. The gate (D7 ≥ 8 %, and at least 25 % of weekly players completing a
   mission) is read in Phase 4's baseline. Await the go-ahead.

## Appendix

### Tables (essential columns)

| table | columns |
|---|---|
| `wallet_ledger` | `id`, `user_id`, `delta int`, `reason text` (`run`, `mission`, `streak`, `buy`, `ad`), `ref uuid null`, `created_at` |
| `mission_progress` | `user_id`, `day date`, `mission_key text`, `progress int`, `done_at timestamptz null`, PK (`user_id`, `day`, `mission_key`) |
| `achievements_earned` | `user_id`, `key text`, `earned_at`, PK (`user_id`, `key`) |
| `cosmetics` | `id text pk`, `slot text` (`tint`, `hat`, `trail`, `nest`), `currency text` (`feathers`, `premium`), `price int`, `season smallint null` |
| `entitlements` | `user_id`, `cosmetic_id`, `source text` (`feathers`, `purchase`, `reward`), `created_at`, PK (`user_id`, `cosmetic_id`) |
| `player_equipped` | `user_id pk`, `tint`, `hat`, `trail`, `nest` (each a nullable fk to `cosmetics`) |
| `run_logs` | `score_id uuid pk references scores on delete cascade`, `log text check (length(log) <= 65536)` |

### Mission templates

| key | text | target | reward |
|---|---|---|---|
| `bank_chain` | Bank a chain of N | N ∈ {4, 6, 8} | 50 |
| `bank_total` | Bank N ducklings today | N ∈ {15, 25, 40} | 40 |
| `unseen` | Stay unseen for N s | N ∈ {20, 30, 45} | 50 |
| `golden` | Grab a golden egg | 1 | 60 |
| `survive` | Survive N s | N ∈ {60, 90, 120} | 40 |
| `snap_survive` | Lose a duckling and still bank | 1 | 75 |
| `daily_swamp` | Play the Daily Swamp | 1 | 25 |

### Numbers

`FEATHERS.dailyCap` = 400. Streak bonuses: 3 days = 50, 7 days = 150 plus the `hat_reed_crown`
cosmetic, 14 days = 300.

Starter catalogue: 4 tints at 100–200, 4 hats at 250–400, 2 trails at 500, 2 nest decors at 300.
