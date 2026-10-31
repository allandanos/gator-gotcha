# Phase 6 — live-ops: season rollover tooling, Season 2 Lurker, weekly Tournament Swamp

**Step 0:** Read `docs/prompts/00-shared-context.md` in full, especially:
- §5.1–5.2 on rulesets
- §6.4 on share pages
- §6.6 on determinism
- §7.3 on the snapshot STOP, which does **not** apply to this phase's sim work

This prompt assumes it.

## Objective

When this phase ends, three things exist:
- **Season rollover tooling.** Starting a new 6-week season is a scripted, repeatable procedure:
  bump the ruleset, regenerate the fixtures, archive the board, ship the cosmetics, refresh the
  share cards. A runbook documents it.
- **Season 2.** It ships with one new predator, the **Lurker**, and its cosmetic set.
- **Weekly Tournament Swamp.** It runs on a fixed seed per ISO week, with a cosmetic reward for
  the top 10.

This phase becomes the template every later season copies.

## Baseline check

```bash
npm test && npm run lint && npm run build && npm run build:crazygames
grep -c "| 5 | done" PROGRESS.md     # 1
```

Record the Phase 5 gate (purchase conversion) and the Season 1 retention trend: D7 and D30 by
weekly cohort. If Season 1 hasn't run for at least 6 weeks, ask the owner whether to start
Season 2 early.

## Scope

**In:**
- `scripts/new-season.ts`
- the runbook `docs/LIVEOPS.md`
- the Lurker mechanic (ruleset 2)
- the Season 2 cosmetics and pass track
- Tournament Swamp
- the end-of-season reward job

**Out:**
- the Heron predator (Season 3, which reuses this phase's runbook)
- a Play Store TWA (optional follow-up, recorded in `PROGRESS.md` as a candidate)
- real-time multiplayer (never planned)

## Tasks

### A. Season tooling

1. **`scripts/new-season.ts`** (run with `npx tsx`). It:
   - bumps `RULESET` in `src/config.ts`;
   - prints the commands to regenerate the golden snapshot (`npx vitest run src/sim/replay.test.ts -u`);
   - writes a migration skeleton that updates `app_config.current_ruleset` and inserts the
     season's `cosmetics` rows;
   - adds a `seasons(id, ruleset, name, starts_at, ends_at)` row.
   It refuses to run on a dirty tree. Tests cover its pure parts in `scripts/new-season.test.ts`.
2. **End-of-season job** `api/cron/season-close.ts`, a Vercel cron that runs daily and acts only
   on a season's end date. It:
   - grants the top 100 of the closing season a rank cosmetic (`source = 'reward'`), idempotently;
   - freezes that board by recording the final ranks in `season_results`.
   It is authorised by `CRON_SECRET`.
3. **Board UI:** a season selector (current, previous seasons, Season 0 Hall of Fame) in
   `src/ui/onlineUi.ts`. The `leaderboard()` season argument already exists from Phase 2.
4. **`docs/LIVEOPS.md` runbook:** the checklist in the Appendix, with the exact command for each
   step.

### B. Season 2: the Lurker (ruleset 2)

5. **Design.** After `LURKER.spawnAfter` seconds, a second gator spawns. It submerges at a seeded
   pond point and is visible only as eyes and periodic bubbles. It has no cone and does not move
   while submerged. When the duck comes within `LURKER.triggerRadius` with LOS, it lunges:
   - a telegraph of `LURKER.telegraph` seconds, with the eyes rising and a ripple ring;
   - then a straight dash of `LURKER.lungeDistance`;
   - then it re-submerges at a new seeded point after `LURKER.cooldown`.
   It catches the duck the same way, and snaps ducklings the same way.
6. **Sim.**
   - `src/sim/lurker.ts`, a pure module with tests first.
   - `World` gains `lurker: Lurker | null`.
   - Events: `lurkerTelegraph`, `lurkerLunge` and `lurkerSubmerge`.
   - Its RNG draws come from the world RNG *after* the existing draws in `step`, so the order
     stays stable.
   - Use `dmath` only.
7. **Interactions:**
   - the main gator hears the Lurker's lunge splash, using the existing splash path;
   - the Lurker never spawns within `LURKER.minFromNest` of the nest;
   - the mapgen tests must still pass with the pond points over 200 seeds.
8. **Fixtures:** regenerate the golden snapshot (expected in this phase). The recording bot must
   survive at least one lunge on the fixture seed. Add a 50-seed determinism test.
9. **Presentation:**
   - eyes and bubble sprites;
   - a telegraph ripple;
   - the lunge with motion lines, and no shake under reduced motion;
   - a distinct sting SFX;
   - the death cam (Phase 1) labels "Lurker!" when the Lurker made the catch.
10. **Season 2 content:**
    - 8 premium pass cosmetics (lurker-eye hat, bubble trail, and so on) and 4 Feather items;
    - the OG share card shows the season badge;
    - re-scrape a `/s/<id>` URL in the Facebook Sharing Debugger (owner task).

### C. Weekly Tournament Swamp

11. **Seed.** `tournamentSeed(date)` gives `w` + ISO year + week, e.g. `w202650`. It is pure, lives
    in `src/sim/replay.ts` beside `dailySeed`, and has tests. VERIFY the seed fits `parseSeed`'s
    1–12 character `[a-z0-9]` rule.
12. **Data.**
    - `scores.tournament_week text null`, set by `submitScore` when the seed is this or last
      week's tournament seed;
    - a board variant `'week'` in `leaderboard()`;
    - top 10 at week close get a cosmetic through the season-close cron, now also run weekly.
13. **UI:** a "Tournament" button on the title screen with a countdown to the week's end, and a
    weekly board tab.

## Acceptance criteria

- [ ] `npm test` passes. New tests cover the Lurker states, tournament seed, the season-close
      idempotency, and the `new-season` pure helpers. Coverage is met.
- [ ] `npm run lint && npm run build && npm run build:crazygames` exits 0.
- [ ] Under `vercel dev`, a ruleset-1 submission returns 409 and a ruleset-2 run returns 201.
- [ ] Browser: at `spawnAfter` the Lurker appears, telegraphs and lunges, and the death cam
      labels it.
- [ ] Running the season-close cron twice for the same season grants exactly one cosmetic per
      winner.
- [ ] `docs/LIVEOPS.md` exists and every command in it was executed once in this session.

## Checkpoint protocol

1. Put the evidence in `PROGRESS.md` under `### Phase 6`, with the row
   `| <date> | 6 | done | season 2 + tournaments |`.
2. Commit `feat: season tooling, Lurker, weekly tournament (phase 6)`.
3. Stop and summarize. From here, each new season is a fresh session that reads
   `docs/LIVEOPS.md` plus a short season brief written by the owner. Await the go-ahead.

## Appendix

### Lurker tuning (`src/config.ts`)

| constant | value |
|---|---|
| `LURKER.spawnAfter` | 60 s |
| `LURKER.triggerRadius` | 140 u |
| `LURKER.telegraph` | 0.7 s |
| `LURKER.lungeDistance` | 260 u |
| `LURKER.lungeSpeed` | 520 u/s |
| `LURKER.cooldown` | 6 s |
| `LURKER.minFromNest` | 250 u |

### Season rollover checklist (copy into `docs/LIVEOPS.md`)

1. `npx tsx scripts/new-season.ts --name "<name>"` on a clean tree.
2. Implement the season mechanic; regenerate the golden snapshot; run the 50-seed determinism test.
3. Apply the migration (`supabase db push`), which sets the current ruleset and adds cosmetics.
4. `npm test && npm run lint && npm run build && npm run build:crazygames`.
5. Deploy web. Upload the new portal zip.
6. The season-close cron archives the previous board on its end date.
7. Refresh the OG card badge, then re-scrape it in the Facebook Sharing Debugger (owner).
8. Announce: in-game banner on the title screen, plus the share copy.
