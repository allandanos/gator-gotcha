# Phase 1 — one-more-run: death cam, juice, pace, hints (sim frozen)

**Step 0:** Read `docs/prompts/00-shared-context.md` in full (especially §5.1 gameplay vs cosmetics,
§7.3 the golden-snapshot STOP, and the "Retry today" row in §3). This prompt assumes it.

## Objective

When this phase ends, a death is readable and a retry is instant:
- a 3 s **death cam** replays the catch from the recorded input log;
- the catch has **hitstop and shake**;
- being spotted pulses the screen edge;
- **near-miss** callouts appear;
- the HUD shows **pace against your personal best**;
- the game-over card shows **run stats**;
- first-time players get **three contextual hints**;
- **Space** also retries.

All of it is render, UI or audio only. `src/sim/` is untouched and the golden replay snapshot does
not change.

## Baseline check

```bash
npm test && npm run lint && npm run build      # all green
git diff --stat HEAD -- src/sim                 # empty
grep -c "| 0 | done" PROGRESS.md                # 1
```

The KPI gate for Phase 0 is 7 days of events. Run the Phase 0 count query from
`docs/prompts/phase-0-measure.md` (Appendix). Also run `select min(created_at) from events`; you
can do this from the Supabase SQL editor, so ask the owner. Record the baseline values for
retries per session and D1 from `events_session_runs` and `events_retention` in `PROGRESS.md`.
These are the "before" numbers for this phase's gate. If there are fewer than 7 days of data,
still record them; the owner decides whether to proceed.

## Scope

**In:**
- death cam
- hitstop and shake
- spotted pulse
- near-miss callouts
- pace readout
- run stats
- first-run hints
- Space to retry
- reduced-motion handling

**Out:**
- any scoring or sim change (Phase 2)
- ghosts of other players (Phase 3)
- cosmetics (Phase 3)

## Tasks

1. **Snapshots for the death cam.** In `src/main.ts`, keep a ring buffer of the last 180 rendered
   `World` values; that is 3 s at 60 Hz. Worlds are immutable, so storing references costs
   nothing extra. Do **not** re-simulate. Put the buffer in a pure module,
   `src/render/rewind.ts`, with tests in `src/render/rewind.test.ts`, and add it to the coverage
   `include` in `vite.config.ts`.
2. **Death cam playback.** During the existing `CAUGHT_DELAY`, or a new `phase === 'deathcam'`
   that replaces it:
   - play the buffer at 0.6× speed, centred between duck and gator;
   - draw the gator's sight cone at full opacity;
   - mark the frame where the duck first entered the cone with a "Spotted here" label;
   - let any key or tap skip to game over;
   - honour `prefers-reduced-motion` by showing a single still frame instead.
   The camera transform lives in `src/render/renderer.ts`.
3. **Hitstop and shake.** In `src/render/effects.ts`, add an 80 ms hitstop on `caught` (render
   only; the sim has already ended) and a 250 ms decaying shake. Add a red edge vignette pulse on
   `spotted`. Disable the shake under reduced motion.
4. **Near-miss detection** (client only, not scored). This is a pure function
   `nearMisses(prev, next)` in `src/render/nearMiss.ts`. It emits when the duck's distance to the
   gator snout drops below `GATOR.catchRadius + DUCK.radius + 24` and the duck survives the next
   30 ticks. Show "Close shave!" with a short SFX in `src/audio/sfx.ts`. Write tests first.
5. **Pace against best.** Store `bestTimeline` in `src/ui/storage.ts` as an array of score
   checkpoints per 10 s of the best run, saved when a new best is set. The HUD (`src/ui/hud.ts`)
   shows "+12s ahead" or "−8s behind", with semantic colour plus an icon so it does not rely on
   colour alone.
6. **Run stats.** Track these in a small pure accumulator, `src/ui/runStats.ts`, fed by the world
   each tick:
   - time unseen (the gator was not in `chase`)
   - closest call distance
   - eggs per minute
   - number of times spotted
   Render them on the game-over card (`index.html` `#screen-over`, `src/ui/screens.ts`
   `fillGameOver`).
7. **First-run hints.** Show three one-time tips, each stored as seen in `src/ui/storage.ts`:
   - on the first `spotted`: "Break line of sight behind logs and reeds"
   - on the first sprint: "Dash drains stamina; it refills when you walk"
   - after the first egg: "Splashes are loud: the gator hears pickups"
   Each tip appears for 3 s and never pauses the sim.
8. **Retry keys.** Add `Space` to the global key handler in `src/main.ts`, beside `Enter`. It
   applies on `over` only, and not while the board is open or the player is typing.
9. **Events.** Add a `deathcam_skip` event (props `{ at: number }`), and add `nearMisses` and
   `spottedCount` to `run_end` props. This needs the Phase 0 zod schema and catalogue to be
   updated, plus a test.
10. **Accessibility.** The game-over stats must be readable by screen readers: use a `dl` list
    and `aria-live="polite"` on the score. Keyboard focus stays on Retry.

## Acceptance criteria

- [ ] `npm test` passes; the new tests cover `rewind`, `nearMiss` and `runStats`; coverage
      thresholds are met.
- [ ] `npm run lint && npm run build` exits 0.
- [ ] `git diff --stat main -- src/sim src/config.ts` is empty (the sim is frozen), and the
      golden snapshot test passes unchanged.
- [ ] Browser check using `npx vite preview --port 4173` with chrome-devtools MCP:
      - Force a catch through `window.__gator` (DEV) or by playing. The death cam renders and a
        key press skips it.
      - Space on game over starts a new run.
      - Emulating `prefers-reduced-motion: reduce` shows a still frame and no shake.
- [ ] Take screenshots at 320, 768, 1024 and 1440 widths of the game-over card with stats. Save
      them to the session scratchpad and list them in `PROGRESS.md`.
- [ ] The production bundle stays small: `npm run build` reports the main chunk at ≤ 26 KB (baseline 19.2 KB on 2026-10-31)
      gzipped. Record the before and after sizes.

## Checkpoint protocol

1. Run the acceptance list. Paste the evidence into `PROGRESS.md` under `### Phase 1`, and add
   the row `| <date> | 1 | done | death cam + juice |`.
2. Commit `feat: death cam, catch juice, pace and first-run hints (phase 1)`.
3. Stop and summarize: what exists, deferrals, decisions and VERIFY results. The KPI gate for
   this phase is **retries/session ≥ 3 and D1 ≥ 20 %**, measured over 7 days after deploy. Phase
   2's baseline check reads it. Await the go-ahead.

## Appendix

### Tuning constants (put them in `src/render/feel.ts`, not `src/config.ts`, which is sim-only)

| name | value |
|---|---|
| `DEATHCAM_SECONDS` | 3 |
| `DEATHCAM_SPEED` | 0.6 |
| `HITSTOP_MS` | 80 |
| `SHAKE_MS` / `SHAKE_PX` | 250 / 8 |
| `NEAR_MISS_MARGIN` | 24 u |
| `NEAR_MISS_SURVIVE_TICKS` | 30 |
| `HINT_MS` | 3000 |
| `PACE_CHECKPOINT_S` | 10 |

### Storage keys (all under the existing `gator-gotcha:` prefix)

`hints-seen` (bitmask), `best-timeline` (JSON number array, at most 120 entries).
