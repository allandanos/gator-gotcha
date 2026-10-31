# Phase 4 — portals: platform adapter and CrazyGames build with fair ads

**Step 0:** Read `docs/prompts/00-shared-context.md` in full, especially:
- §5.6 on no pay-to-win
- §5.7 on portals
- §7.4 and §7.6 on the VERIFY and vendor-terms STOPs
- §6.1–6.2 on the PWA

This prompt assumes it.

## Objective

When this phase ends, one codebase builds two targets:
- `web`, for gatorgotcha.com, which behaves the same as today;
- `crazygames`, a zip with the PWA turned off.

Portal behaviour sits behind `src/platform/PlatformAdapter`. That covers:
- gameplay start and stop signals
- loading progress
- a mid-game ad between runs, at the cadence the portal allows
- a rewarded ad that grants **only** Feathers ×2 for the run just finished, or a 24 h cosmetic
  trial
- the portal's user identity, if the portal offers one

The build is submitted to CrazyGames, and ad and playtime events flow into the Phase 0 table with
`platform = 'crazygames'`.

## Baseline check

```bash
npm test && npm run lint && npm run build
grep -c "| 3 | done" PROGRESS.md     # 1
```

Record the Phase 3 gate in `PROGRESS.md`:
- D7 from `events_retention`
- the percentage of weekly players with a mission done, from `mission_progress`

If the gate missed, the owner decides whether to proceed. Monetizing low retention is allowed
but should be a deliberate choice.

## Scope

**In:**
- the adapter interface
- `web` and `crazygames` adapters
- the build flag
- the zip packaging script
- ad placement rules
- the rewarded-Feather server flow
- the submission checklist

**Out:**
- other portals (evaluate after the CrazyGames review; record them as a follow-up)
- own-site ads (not planned; this is a decision)
- the store (Phase 5)

## Tasks

1. **VERIFY first, before any code.** Read the current CrazyGames developer docs: the SDK
   version, how the SDK is loaded, required calls, ad rules (minimum interval, no ads in the
   first N seconds), restrictions on external network calls and links, technical requirements
   (file size, initial download, mobile support), and whether they allow first-party
   leaderboards on our Supabase. Write a short summary with links in `PROGRESS.md`.
   - If they forbid calls to our API: STOP §7.4. Write `BLOCKERS.md` with two options: an
     offline-only portal build, or the portal's own leaderboard SDK.
   - If their terms require a revive or another gameplay reward for ads: STOP §7.6.
2. **Interface** `src/platform/types.ts`:
   ```ts
   export interface PlatformAdapter {
     readonly id: 'web' | 'crazygames';
     init(): Promise<void>;
     loadingProgress(pct: number): void;
     gameplayStart(): void;
     gameplayStop(): void;
     midgameAd(): Promise<'shown' | 'skipped' | 'error'>;
     rewardedAd(): Promise<'rewarded' | 'skipped' | 'error'>;
     user(): Promise<{ id: string; name: string } | null>;
     readonly supportsInstall: boolean;
   }
   ```
3. **Adapters:**
   - `src/platform/web.ts`: does nothing. `rewardedAd` resolves `'skipped'`, and the UI hides
     reward buttons when `id === 'web'`.
   - `src/platform/crazygames.ts`: wraps the SDK, loaded as an external script file per the
     portal docs. Our CSP doesn't apply on their host, but **keep no inline scripts anyway**.
   - `src/platform/index.ts` selects the adapter from `import.meta.env.VITE_PLATFORM` at build
     time, so the unused adapter is tree-shaken. Check the `web` bundle with
     `grep -c crazygames dist/assets/*.js`, which should give 0.
4. **Ad policy** (pure, with tests first) in `src/platform/adPolicy.ts`:
   `shouldShowMidgame({ runsThisSession, secondsSinceLastAd, sessionNumber })`. Rules from the
   Appendix, then tightened if the portal's rules are stricter.
5. **Wiring** in `src/main.ts`:
   - `gameplayStart` and `gameplayStop` are called on run start, pause, resume and catch;
   - the mid-game ad shows only on the transition from game over to the next run, never during
     a run or the death cam;
   - music is muted while an ad plays.
6. **Rewarded Feathers (server-trusted).**
   - When `rewardedAd()` resolves `'rewarded'`, the client calls `POST /api/reward
     { scoreId, kind: 'double' }`.
   - The server checks: the score belongs to the user, it was created less than 10 minutes ago,
     it has not already been doubled (unique `(score_id, 'ad')` ledger row), and the per-day cap
     of 5 rewards is not exceeded.
   - It then inserts a matching ledger row.
   - Accepted gap: a client could claim without watching. The cap bounds the damage. VERIFY
     whether the SDK offers a server-verifiable token; if it does, use it.
7. **Portal user.** If `user()` returns an id, store it as `profiles.portal_ids jsonb`, written
   by the server through `/api/link-portal` with validation. Account merging is out of scope.
8. **Build.**
   - Add the script `"build:crazygames": "VITE_PLATFORM=crazygames vite build --outDir dist-crazygames"`.
   - The PWA plugin is disabled when `VITE_PLATFORM !== 'web'`, in a conditional in
     `vite.config.ts`.
   - `src/ui/updates.ts` and `src/ui/install.ts` become no-ops on portals.
   - `scripts/zip-portal.ts` writes `dist-crazygames.zip`. Add `dist-crazygames*` to `.gitignore`.
9. **Events:** every event carries `platform`. New events: `ad_midgame{result}`,
   `ad_rewarded{result}` and `portal_user{linked}`.
10. **Submission checklist** (Appendix). The owner submits through the developer portal; the
    session prepares the zip, screenshots and description text in `docs/portal/crazygames.md`.

## Acceptance criteria

- [ ] `npm test` passes. New tests cover `adPolicy` and the `/api/reward` handler (idempotent,
      cap, ownership, age). Coverage is met.
- [ ] `npm run lint && npm run build && npm run build:crazygames` exits 0.
- [ ] `ls dist-crazygames | grep -c "sw.js\|manifest.webmanifest"` returns `0`, and
      `ls dist | grep -c sw.js` returns `1`.
- [ ] `grep -c crazygames dist/assets/*.js` returns `0` (web build untouched).
- [ ] The golden snapshot is unchanged and `git diff main -- src/sim` is empty.
- [ ] The portal's local QA tool or test environment (VERIFY its name) shows the gameplay
      start/stop calls and the ad flow working.
- [ ] `security-review` passes on `api/reward.ts` and `api/link-portal.ts`.
- [ ] `docs/portal/crazygames.md` is complete, and the owner confirms the submission.

## Checkpoint protocol

1. Put the evidence in `PROGRESS.md` under `### Phase 4`, with the row
   `| <date> | 4 | done | portal build submitted |`.
2. Commit `feat: platform adapter and CrazyGames build (phase 4)`. Push the web changes only
   after the owner approves.
3. Stop and summarize, including the VERIFY findings on ad rules and revenue share. The gate is
   build accepted, plus eCPM and playtime per DAU recorded for 14 days. Await the go-ahead.

## Appendix

### Default mid-game ad rules (tighten to the portal's own rules)

| rule | value |
|---|---|
| Never in session 1 (first visit) | yes |
| Minimum runs between ads | 3 |
| Minimum seconds between ads | 180 |
| Never during a run, the death cam, or a typing field | yes |
| Rewarded ads per day per player | 5 |

### Rewarded placements (the only two allowed)

1. Game-over card: "Watch an ad: ×2 Feathers for this run".
2. Shop item: "Try this hat for 24 h". This is a client-side trial with no entitlement row; it
   stores an expiry in `src/ui/storage.ts`.

### Submission kit (`docs/portal/crazygames.md`)

- Title, a 150-character tagline, a long description and a controls table copied from
  `README.md`.
- Screenshots at 1920×1080 and 1280×720, plus the portal's required thumbnail sizes (VERIFY),
  produced with chrome-devtools `take_screenshot`.
- Category: action / stealth (VERIFY the portal's taxonomy).
- Content notes: no violence beyond a cartoon "gotcha", no data collection beyond the anonymous
  id, and a privacy URL of `https://www.gatorgotcha.com/privacy.html`.
