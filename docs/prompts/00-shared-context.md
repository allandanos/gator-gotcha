# 00 — Shared context (loaded by every phase, never run on its own)

This file is the single source of truth for the series. **It wins over any phase doc and over
`docs/ROADMAP.md`.** If a phase doc contradicts it, follow this file and note the conflict in
`PROGRESS.md`.

## 1. Mission

Turn Gator Gotcha (https://www.gatorgotcha.com) from a one-session toy into a game players return
to daily, then monetize it **without pay-to-win** through web portals (ad revenue share) and
cosmetic-only purchases on gatorgotcha.com. The design rationale is in `docs/ROADMAP.md`.

Success = the KPI gates in §5.6 pass in order, and the game stays fair: every score-affecting
rule is in the deterministic sim and replayed by the server.

## 2. Operating rules

1. **One phase per fresh session.** Read this file in full, then the phase doc.
2. **Baseline check first.** Run the previous phase's gate commands. Red base = fix forward or
   STOP; never build on red.
3. **Never edit:** `.env.local`, `.env.supabase.local`, applied files in `supabase/migrations/`
   (add a new migration instead), `public/share-redirect.js` behaviour (see §6.4).
4. **Never print secrets.** Load env with `set -a; . ./.env.local; set +a` and reference variables.
5. **Real players exist.** Never delete users or scores in bulk. Remove only your own test data,
   by specific user id, with a service-role script that lives in the project temporarily.
6. **Commit/push policy:** conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), no
   attribution lines. Commit at each checkpoint. Push to `main` deploys production; push only
   when the owner has approved the phase plan in this session.
7. **Before every commit:** `npm test && npm run lint && npm run build` all green.
8. **`VERIFY` markers** flag facts that must be checked against the live environment or current
   vendor docs before acting. Record each result in `PROGRESS.md`. They are features, not debt.
9. **STOP conditions (§7)** end the session: write `docs/prompts/BLOCKERS.md`, commit it, stop.
10. **Report honestly.** Failing tests, skipped steps and unverified claims are stated as such.
11. **Plan mode for multi-part phases.** Present the plan, wait for approval, then execute.

## 3. Verified facts (2026-10-31)

| Fact | Value | Re-verify |
|---|---|---|
| Repo | `/Users/allan/workspace/100ai/dino-game`, remote `github.com/allandanos/gator-gotcha`, branch `main` | `git remote -v` |
| Stack | Vite 5.4, TypeScript 5.9, Canvas 2D, no engine | `cat package.json` |
| Node (local) | v22.12.0 | `node -v` |
| Tests | 114 passing (vitest 2.1) | `npm test` |
| Coverage thresholds | lines 80, functions 80, branches 75, statements 80 | `grep -n thresholds -A2 vite.config.ts` |
| Coverage scope | `src/core/**`, `src/sim/**`, `src/ui/{pendingRuns,bootSeed,storage}.ts`, `api/_lib/**` | `grep -n "include:" vite.config.ts` |
| Hosting | Vercel, account `allandanos`; push to `main` auto-deploys | `vercel ls` |
| Backend | Supabase project ref `ecjoimtngyohebssnxrw` + Vercel Functions in `api/` | `cat supabase/config.toml` |
| Migrations | `20261031000000_leaderboard.sql`, `20261101000000_events.sql`, `20261102000000_modes.sql` (adds `scores.mode`, per-mode `leaderboard`/`rank_for`) | `ls supabase/migrations` |
| Validation lib | zod 4 (`api/_lib/submitScore.ts` `BodySchema`) | `grep -n zod package.json` |
| Sim rate | fixed 60 Hz (`SIM_DT = 1/60` in `src/config.ts`) | `grep -n SIM_DT src/config.ts` |
| Score formula | Classic/Night `eggs × 100 + floor(seconds) × 10`; Rush `eggs × 100` + 500 if the clock runs out (`scoreOf` in `src/sim/scoring.ts`) | `cat src/sim/scoring.ts` |
| Modes | ranked `classic` / `rush` / `night` (`RunRules`, `src/sim/rules.ts`); submit body `mode` (default classic); boards per mode; daily board classic-only | `grep -n MODE_IDS src/sim/rules.ts` |
| Replay bound | 20 min (`MAX_REPLAY_TICKS`), encoded log ≤ 64 KB (`MAX_ENCODED_LOG`) | `grep -n MAX_ src/sim/replay.ts` |
| Submit rate limit | 10 per user per minute (`RATE_LIMIT_PER_MINUTE`) | `grep -n RATE_LIMIT api/_lib/submitScore.ts` |
| Submit rejections | 400 bad body/seed/log, 401 no session, 409 duplicate, 413 too big, 422 replay fail, 429 rate | `api/_lib/submitScore.ts`, `api/scores.ts` |
| Offline queue | `src/ui/pendingRuns.ts`, max 25; `flushDecision` removes on 2xx/400/409/413/422, stops on network/429, keeps on 404/5xx | `npx vitest run src/ui/pendingRuns.test.ts` |
| Retry today | Enter on title/over starts a run; "Retry this swamp" (`#retry-btn`) is autofocused; 1.1 s `CAUGHT_DELAY` | `grep -n "CAUGHT_DELAY\|KeyM\|Enter" src/main.ts` |
| CSP | `script-src 'self'`, `frame-ancestors 'none'`, `connect-src 'self' https://ecjoimtngyohebssnxrw.supabase.co` | `grep -n Content-Security vercel.json` |
| PWA | `vite-plugin-pwa` 0.21.2, `registerType: 'prompt'`, `injectRegister: false`, registered in `src/ui/updates.ts` | `grep -n registerType vite.config.ts` |
| Facebook Login | built, off via `VITE_FB_LOGIN_ENABLED=false` | `grep -rn FB_LOGIN src` |
| Dev hook | `window.__gator` (`get`/`set`/`phase`), DEV builds only | `grep -n __gator src/main.ts` |

**Launch-day data** (42 runs, 19 players, median 1 run/player, run p50 72 s). Re-run read-only:

```bash
set -a; . ./.env.local; set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/scores?select=user_id,eggs,ticks,created_at&limit=1000" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d);
    const u=new Set(r.map(s=>s.user_id));const t=r.map(s=>s.ticks/60).sort((a,b)=>a-b);
    console.log({runs:r.length,players:u.size,p50sec:t[Math.floor(t.length/2)]})})'
```

## 4. Reference map

| Concern | Path | Reuse |
|---|---|---|
| Tuning constants | `src/config.ts` | all new gameplay numbers go here |
| Sim step | `src/sim/world.ts` (`createWorld(seed, rules)`, `step`, `isCaught`) | extend; keep pure and immutable |
| Run rules / modes | `src/sim/rules.ts` (`RunRules`, `rulesForMode`, `parseMode`) | a new mode or level is a `RunRules` value |
| Sim types / events | `src/sim/types.ts` (`World`, `GameEvent`) | add fields and event kinds here |
| Gator AI | `src/sim/gator.ts` (`updateGator`, `snoutOf`) | |
| Sight | `src/sim/sight.ts` | Phase 2 tail-visibility check |
| Difficulty | `src/sim/difficulty.ts` (`gatorStats`) | |
| Deterministic math | `src/core/dmath.ts` | **only** trig/hypot allowed inside `sim/` |
| Seeded RNG | `src/core/rng.ts` (`Rng`, `hashSeed`, `parseSeed`) | |
| Replay | `src/sim/replay.ts` (`replayRun`, `encodeLog`, `decodeLog`, `dailySeed`, `dailyDateOf`) | |
| Golden replay test | `src/sim/replay.test.ts` + `src/sim/__fixtures__/recordBot.ts` | regenerate per ruleset |
| Input quantization | `src/sim/input.ts` | |
| Score submit | `api/scores.ts` → `api/_lib/submitScore.ts` | template for new endpoints |
| HTTP helpers | `api/_lib/http.ts` (`ok`, `fail`, `logError`, `bearerToken`) | reuse in every function |
| Data access | `api/_lib/repository.ts` (`ScoreRepository`, `supabaseRepository`) | add interfaces the same way |
| Share / OG | `api/share.ts`, `api/og.ts`, `api/_lib/format.ts` | |
| Main loop / screens | `src/main.ts`, `src/ui/screens.ts`, `index.html` | |
| HUD | `src/ui/hud.ts` | |
| Online UI | `src/ui/onlineUi.ts`; lazy chunk `src/online/` | |
| Offline queue | `src/ui/pendingRuns.ts` | pattern for the event queue |
| Storage | `src/ui/storage.ts` | guarded localStorage, reuse |
| Rendering | `src/render/renderer.ts`, `src/render/sprites.ts`, `src/render/effects.ts`, `src/render/palette.ts` | cosmetics live here |
| Audio | `src/audio/sfx.ts`, `src/audio/music.ts` | |
| Updates | `src/ui/updates.ts` | |
| Headers / CSP | `vercel.json` | an invalid `vercel.json` silently blocks Git deploys |

**Do not copy:** any old "delete all users" cleanup script; any meta-refresh share redirect.

## 5. Decisions

1. **Gameplay vs cosmetics.** Anything that can change a score lives in `src/sim/`, is
   deterministic (uses `dmath`, RNG state lives in the world), and comes with a `RULESET` bump and
   regenerated golden snapshot. Cosmetics live in `src/render/` and never import from `sim/` state
   they could change. *Rejected:* client-trusted bonuses.
2. **Rulesets.** `RULESET` is an integer in `src/config.ts`, starting at `1` in Phase 2 (current
   rules = ruleset `0`). The server replays only the current ruleset; a mismatch returns 409.
   Boards are filtered by ruleset (= season). *Rejected:* keeping old sim versions runnable server-side.
3. **Data writes.** Scores, events, wallet, missions and entitlements are written **only** by the
   service role from Vercel Functions. RLS stays read-only (or no read) for clients. Clients may
   still update only their own nickname.
4. **Endpoints.** Each new function: zod body schema, body size cap, per-user rate limit, the
   `api/_lib/http.ts` helpers, a repository interface with a fake for tests, and a
   `security-review` pass before commit.
5. **Analytics.** First-party `events` table via `/api/events`. *Rejected:* third-party analytics
   scripts (CSP, privacy, bundle).
6. **No pay-to-win.** No revives, boosts, extra stamina, or ad-for-advantage. Rewarded ads grant
   Feathers ×2 or a 24 h cosmetic trial only.
7. **Portals.** One codebase, a `PlatformAdapter` in `src/platform/`, selected by
   `VITE_PLATFORM` (`web` default, `crazygames`). *Rejected:* a forked repo.
8. **Payments.** Stripe Checkout by redirect (CSP unchanged), provisioned through the Vercel
   Marketplace (load the `vercel:marketplace` skill first). Purchases require a linked account.
9. **Identity.** Facebook Login (built) + Google, via Supabase anonymous → identity linking, in
   Phase 3 before any purchasable item exists.
10. **Testing.** New pure logic gets unit tests (TDD), coverage thresholds unchanged. Browser
    checks use `npx vite preview --port 4173` + chrome-devtools MCP with an `isolatedContext`.

### 5.6 KPI gates (measured from Phase 0's views)

| After phase | Gate |
|---|---|
| 0 | 7 consecutive days of events queryable |
| 1 | retries per session ≥ 3 and D1 ≥ 20 % |
| 2 | median run 60–150 s; ≥ 70 % of runs bank at least once |
| 3 | D7 ≥ 8 %; ≥ 25 % of weekly players complete a mission |
| 4 | portal build accepted; eCPM and playtime/DAU recorded |
| 5 | ≥ 1 % of D7 players purchase |

A gate is the owner's call: the session reports the numbers; the owner decides to proceed.

## 6. Gotchas (verbatim from hard-won failures)

1. **PWA update on an uncontrolled page** must be a plain `location.reload()`; `updateSW(true)`
   only reloads when a service worker takes over, which never happens on a first visit.
2. **Old installs** (before `a54367a`) have no update logic; they update only after a full close
   and reopen. `/registerSW.js` returning 404 is expected.
3. **CSP** is `script-src 'self'` with no inline scripts. Every script is an external file.
4. **Share pages:** Facebook's crawler follows `<meta http-equiv=refresh>`. `api/share.ts`
   redirects through `public/share-redirect.js`. Never reintroduce a meta refresh there.
5. **Offline queue:** only 400/409/413/422 drop a queued run. 404 and 5xx keep it, because a dev
   server or bad deploy once wiped the queue. Any new queue (events) follows the same rule.
6. **Determinism:** `Math.sin/cos/atan2/hypot` differ in the last bit across JS engines. Inside
   `sim/` use `src/core/dmath.ts`.
7. **iOS home-screen apps** have storage separate from Safari: a new anonymous player.
8. **chrome-devtools MCP:** awaiting `navigator.serviceWorker.ready` in `evaluate_script` can hang
   120 s on production; use `getRegistration()` with `waitForStableDom: false`.
9. **`.mts` scripts** must live inside the project temporarily to resolve modules; delete after.
10. **Supabase `site_url`** in `supabase/config.toml` is not pushed yet; the owner runs
    `supabase config push --project-ref ecjoimtngyohebssnxrw`, accepting only the auth change and
    answering **n** to storage changes. Required before Facebook Login is enabled.

## 7. STOP conditions

1. Baseline tests, lint or build are red and the cause is outside this phase's scope.
2. A change would require editing an applied migration, or deleting real player data.
3. A golden replay snapshot changes in a phase that must not change the sim (0, 1, 3–5).
4. A `VERIFY` fact contradicts a decision in §5 (e.g. a portal forbids external API calls).
5. A step needs a secret, dashboard action, or account the session doesn't have.
6. A vendor's terms (portal, Stripe) conflict with the no-pay-to-win rule.

Each ends the session with `docs/prompts/BLOCKERS.md` (what, evidence, options) committed.

## 8. Accepted gaps

- Analytics are first-party only: no attribution of external traffic sources beyond `referrer`.
- A Daily Swamp run posted more than a day late counts only on the all-time board.
- Anonymous players who clear storage lose progress until they link an account.
- Portal revenue figures are unverified until Phase 4.

## 9. Glossary

- **Run:** one life, from start to catch. **Ruleset / season:** a numbered version of sim rules;
  boards are per season. **Banking:** leading ducklings into the nest to convert them to score.
- **Feathers:** server-computed soft currency. **Entitlement:** a cosmetic a player owns.
- **Ghost:** a translucent duck driven by replaying another player's input log on the same seed.
