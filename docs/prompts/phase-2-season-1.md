# Phase 2 — season-1: ruleset versioning, ducklings, nest banking, golden egg

**Step 0:** Read `docs/prompts/00-shared-context.md` in full (especially §5.1–5.2 gameplay rules
and rulesets, §6.5 the queue, §6.6 determinism, and the "Submit rejections" row in §3). This
prompt assumes it.

## Objective

When this phase ends, the game has its first real greed mechanic, and the infrastructure lets
rules change safely:
- **Rulesets.** A `RULESET` integer travels with every submission and is stored per score.
  Boards are per season. The server rejects stale rulesets with a 409. Today's scores become
  Season 0.
- **Ducklings.** Eggs hatch into ducklings that trail the duck. The gator can snap the last one
  instead of you.
- **Nest banking.** Leading ducklings into the nest converts them into score, and the payout
  grows faster than the chain length.
- **Golden egg.** A rare golden egg is worth 5 ducklings and makes a louder splash.

Everything is deterministic and replayed by the server.

## Baseline check

```bash
npm test && npm run lint && npm run build
grep -c "| 1 | done" PROGRESS.md      # 1
```

Read the Phase 1 gate from the events views: retries per session and D1 over the last 7 days.
Record both in `PROGRESS.md`. If the gate missed, report it and ask the owner whether to proceed;
do not decide alone.

## Scope

**In:**
- ruleset plumbing (client, API, DB, boards)
- Season 0 archive
- the three mechanics
- HUD, render and audio for them
- tuning
- fixtures and tests
- updating the help text on the title screen and in `README.md` "How it plays"

**Out:** currency, missions and cosmetics (Phase 3); new predators and a season-select UI beyond
"current season / Season 0" (Phase 6).

## Tasks

### A. Ruleset plumbing (first commit; no rule changes yet)

1. Add `export const RULESET = 1;` to `src/config.ts`. Ruleset `0` is the implicit legacy value.
2. Migration `supabase/migrations/20261115000000_rulesets.sql`:
   - `alter table public.scores add column ruleset smallint not null default 0;`
   - `leaderboard(board, day, lim, mode, season smallint default null)` and
     `rank_for(board, day, player, value, mode, season smallint default null)`; the `mode`
     parameter already exists (migration `20261102000000_modes.sql`), add `season` after it.
     The Season 0 archive is per mode. Season 1 mechanics apply to every ranked mode unless the
     owner decides otherwise (ask before Task B). A null season means the current one; the
     function reads it from a new one-row table, `public.app_config(current_ruleset smallint)`,
     which the service role writes and anyone can read.
   - Index `(ruleset, score desc)` and `(ruleset, daily_date, score desc)`.
   - VERIFY that changing a function signature needs `drop function` first. If so, recreate
     the function with the same grants.
3. `api/_lib/submitScore.ts`:
   - add `ruleset: z.number().int()` to `BodySchema`;
   - reject `ruleset !== RULESET` with **409** `'Game updated: please reload'`, so the existing
     `flushDecision` drops it;
   - store `ruleset` on insert (update `NewScore` in `api/_lib/repository.ts`).
   Test this first in `api/_lib/submitScore.test.ts`.
4. Client: `src/online/scores.ts` sends `ruleset`. `src/ui/pendingRuns.ts` stores `ruleset` on
   each `PendingRun`. When reading, a missing ruleset counts as `0`, and the server will 409 it.
5. The board UI (`src/ui/onlineUi.ts`) shows the current season, plus a "Season 0 Hall of Fame"
   tab that calls `leaderboard('all', null, 50, 0)`.
6. Commit `feat: ruleset versioning and per-season boards (phase 2a)`. All tests pass, and the
   golden snapshot is unchanged at this point.

### B. Season 1 mechanics (in `src/sim/`, pure and deterministic)

7. **Types** (`src/sim/types.ts`):
   - `World` gains `ducklings: readonly Vec[]` (trail positions), `banked: number` (score value),
     `nest: Vec` and `goldenEggs` (the count collected).
   - `Egg` gains `golden: boolean`.
   - New events: `hatch`, `snapped{pos}`, `banked{count,value}`, `goldenPickup{pos}`.
8. **Trail** (`src/sim/trail.ts`, new):
   - each duckling follows the point ahead of it at `TRAIL.spacing`, with no physics, using a
     deterministic follow toward the leader's position from `TRAIL.lag` ticks ago;
   - store a short position history in the world, capped at `TRAIL.max × lag`;
   - write tests first in `src/sim/trail.test.ts`.
9. **Snap rule** (`src/sim/world.ts` `step`):
   - check `isCaught` against the **last** duckling before the duck;
   - if the gator's snout touches the tail, remove that duckling, emit `snapped`, and give the
     gator a `SNAP.stunSeconds` pause; the duck survives;
   - the duck itself is still caught as before.
   - Order: duck move → pickups → gator → tail snap → duck catch.
10. **Visibility** (`src/sim/sight.ts`): the gator also spots the duck when it can see the trail
    tail, but only when there are at least `TRAIL.visibleFrom` ducklings. Add tests.
11. **Nest** (`src/sim/mapgen.ts`): `nest = duckSpawn`. Make sure the nest radius is clear of
    obstacles; the mapgen connectivity tests must still pass over 200 seeds. Banking happens
    when the duck is within `NEST.radius` and there is at least 1 duckling. It pays
    `bankValue(n)` (Appendix), clears the trail, and emits `banked`.
12. **Golden egg** (`src/sim/world.ts` `spawnEgg`):
    - each refill has a `GOLDEN.chance` probability of producing a golden egg, decided with the
      world RNG, and at most 1 can be on the field;
    - picking it up adds `GOLDEN.ducklings` ducklings, up to `TRAIL.max`;
    - its splash radius is `GATOR.splashHearRadius × GOLDEN.splashFactor`, passed through the
      existing `splash` argument of `updateGator` (add a `splashRadius` field).
13. **Scoring** (`src/sim/scoring.ts`): `computeScore(banked, time) = banked + floor(time) × perSecond`.
    `replayRun` returns `{ score, eggs, banked, ticks }`. Update `SharedScore`/`format.ts` and
    the OG card copy ("banked 12 ducklings").
14. **Difficulty**: count ducklings carried as eggs in `gatorStats`, so carrying a long trail
    raises the pressure. This is a one-line change in `src/sim/difficulty.ts`; update its test.
15. **Fixtures**: regenerate the golden inline snapshot in `src/sim/replay.test.ts`, and extend
    `src/sim/__fixtures__/recordBot.ts` so the bot banks at least once, which keeps coverage.
    Add a test that replaying the same log twice gives the same results over 50 seeds.

### C. Presentation

16. Render (`src/render/sprites.ts`, `src/render/renderer.ts`):
    - ducklings as small yellow ducks with bobbing offset by index;
    - the nest as a woven ring with a soft glow while the player carries ducklings;
    - a golden egg sparkle.
17. HUD (`src/ui/hud.ts`):
    - a "Carrying ×n → +value" readout;
    - a banked total;
    - an arrow pointing to the nest when it is off-screen or the trail has 5 or more ducklings.
18. Audio (`src/audio/sfx.ts`):
    - a hatch peep with pitch rising per duckling;
    - a snap crunch;
    - a bank chord that gets bigger with `n`.
19. Copy: update the title help, the `README.md` "How it plays" section, and the score formula.

## Acceptance criteria

- [ ] `npm test` passes, with new tests for trail, snap, nest banking, golden egg, visibility,
      the ruleset 409, and 50-seed determinism. Coverage thresholds are met.
- [ ] `npm run lint && npm run build` exits 0.
- [ ] `npx vitest run src/sim/mapgen.test.ts`: connectivity holds over 200 seeds with the nest
      kept clear.
- [ ] Under `vercel dev`, a submission with `ruleset: 0` returns `409`, and a fresh run returns
      `201` with `banked` in the response.
- [ ] Browser check: carry 5 ducklings, let the gator snap one (the count drops and the run
      continues), bank 4 (the score rises by `bankValue(4)` = 560), and see the golden egg spawn
      on a seeded swamp listed in the Appendix.
- [ ] The Season 0 tab lists the pre-migration scores (count = the scores row count before the
      migration).
- [ ] After a 7-day soak, the gate is: median run 60–150 s and at least 70 % of runs bank at
      least once. Phase 3's baseline reads this.

## Checkpoint protocol

1. Paste the evidence into `PROGRESS.md` under `### Phase 2`, and add the row
   `| <date> | 2 | done | season 1 live |`.
2. Commit `feat: season 1 — ducklings, nest banking, golden egg (phase 2)`, in addition to the
   2a commit.
3. Stop and summarize: what exists, deferrals, the final tuning values, and VERIFY results.
   Await the go-ahead.

## Appendix

### Tuning (`src/config.ts`)

| constant | value |
|---|---|
| `TRAIL.max` | 12 |
| `TRAIL.spacing` | 22 u |
| `TRAIL.lag` | 6 ticks |
| `TRAIL.visibleFrom` | 4 |
| `SNAP.stunSeconds` | 1.2 |
| `NEST.radius` | 48 u |
| `GOLDEN.chance` | 0.08 per refill |
| `GOLDEN.ducklings` | 5 |
| `GOLDEN.splashFactor` | 2 |
| `SCORE.perSecond` | 10 (unchanged) |

### Bank value

`bankValue(n) = round(100 × n × (1 + 0.1 × n))` → n=1: 110, 3: 390, 4: 560, 6: 960, 10: 2000, 12: 2640.

### Golden-egg test seed

Find one with a short script that steps `createWorld` until `eggs.some(e => e.golden)`, and
record it here and in `PROGRESS.md` (VERIFY).

**Recorded (2026-11-02):** `gold0`, Classic. A golden egg is on the opening field at
(1008, 94), and the nest is at (280, 560). Other hits: `gold1`, `gold2`, `gold8` and `gold11`.
`gold3` has none. Re-check with `npx vitest run src/sim/world.test.ts -t golden`.
