# Gator Gotcha — phased prompt series

This series turns `docs/ROADMAP.md` into executable sessions. Each phase is a self-contained
prompt for a **fresh** Claude Code session in this repo.

## How to run

1. Start a new session in `/Users/allan/workspace/100ai/dino-game`, using the strongest available
   Claude model with plan mode on.
2. Paste the one-liner for the next phase:

   ```
   We are starting Phase N. Read and execute @docs/prompts/phase-N-<slug>.md
   ```

3. The session reads `00-shared-context.md`, runs the baseline check, presents a plan, waits for
   approval, executes, records evidence in `PROGRESS.md`, commits, and stops.
4. Review the summary and the KPI numbers, then decide whether to start the next phase.

Phases are sequential. Phases 1–3 each need about a week of live traffic after deploy before the
next phase's baseline can read their KPI gate.

## Rules of the road

- **Never skip ahead.** Each phase's baseline re-runs the previous gate.
- **Fix forward; never proceed on a red base.**
- **Checkpoints belong to the owner.** Every phase ends by stopping and waiting for a go-ahead.
- **The shared context wins.** `00-shared-context.md` overrides phase docs and the roadmap.
- **`VERIFY` markers are features, not debt.** Check them live and record the results.
- **STOP conditions are never worked around.** Write `docs/prompts/BLOCKERS.md`, commit it, and stop.
- **The series is plain markdown.** To re-scope, edit it before the next session.

## Series index

| File | Phase | What exists when done |
|---|---|---|
| `00-shared-context.md` | (all) | Never run on its own. It holds the facts, decisions, gotchas and STOP conditions |
| `phase-0-measure.md` | 0 | `events` table and views, `/api/events`, the offline event queue, `PROGRESS.md` |
| `phase-1-one-more-run.md` | 1 | Death cam, catch juice, near-miss callouts, pace against best, run stats, first-run hints, Space to retry |
| `phase-2-season-1.md` | 2 | Ruleset versioning, per-season boards, Season 0 archive, ducklings, nest banking, golden egg |
| `phase-3-meta.md` | 3 | Feathers, daily missions, streaks, achievements, the Feather shop and cosmetics, ghost challenges, Facebook and Google linking |
| `phase-4-portals.md` | 4 | `PlatformAdapter`, the CrazyGames zip build, fair ad placements, server-checked rewarded Feathers |
| `phase-5-store.md` | 5 | Stripe Checkout (redirect), signed idempotent webhook, premium cosmetics, Season Pass |
| `phase-6-live-ops.md` | 6 | Season rollover script and runbook, Season 2 Lurker, weekly Tournament Swamp |

`PROGRESS.md` at the repo root is created by Phase 0. It is append-only. `BLOCKERS.md` appears
here only when a STOP condition fires.

## Maintenance notes

- Facts in `00-shared-context.md` §3 were observed on 2026-10-31. Each has a re-verification
  command, so re-run any fact you depend on.
- Migration file names use placeholder dates (`20261101…`, `20261115…`, `20261201…`,
  `20270101…`). Rename one to the actual date when you create it, keeping the order.
- When a phase changes a decision, update `00-shared-context.md` §5 in the same commit, so the
  next session inherits it.
