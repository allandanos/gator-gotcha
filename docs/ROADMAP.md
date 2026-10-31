# Gator Gotcha — Game Design & Monetization Roadmap

Status as of 2026-10-31 (launch day). Execution lives in [`docs/prompts/`](prompts/README.md);
this document is the *why*. When the two disagree, `docs/prompts/00-shared-context.md` wins and
this file gets corrected.

## 1. Where we are

Gator Gotcha is technically strong: a deterministic, immutable sim; server-side replay anti-cheat;
a Daily Swamp; Facebook share cards; an installable offline PWA; a ~19 KB gzipped main chunk, no engine.

The first-day numbers (public `scores` table, 2026-10-31 06:02–13:58 UTC):

| Metric | Value |
|---|---|
| Verified runs | 42 |
| Players | 19 |
| Runs per player (median / max) | **1** / 6 |
| Players active on > 1 day | 0 (launch day) |
| Run length p10 / p50 / p90 | 32 s / 72 s / 170 s |
| Eggs per run (median) | 16 |
| Daily Swamp share of runs | 14 / 42 |

To refresh these numbers, run the read-only query in `docs/prompts/00-shared-context.md` §3.

**Reading:** the chase itself holds attention for about a minute, which is a healthy length for a
session-based arcade game. The problem is what happens *after* the catch: half the players never
start a second run. There is no reason to return tomorrow and no revenue path at all.

**Strategy:** retention first, revenue second. Every phase has a KPI gate; monetization phases
(4–5) only start once players come back.

## 2. Design pillars

1. **Stealth with greed.** Every interesting decision trades safety for points. Today the only
   greed lever is "grab the next egg"; Season 1 adds a real one (nest banking).
2. **Retry in under a second.** Death must be fast, readable ("I see why I died") and immediately
   restartable.
3. **Fair and verifiable.** Everything that affects score is in the deterministic sim and replayed
   by the server. Money and ads buy *looks*, never advantage. No revives, no boosts, ever.
4. **Assets are code.** Art and sound are procedural, so cosmetics are cheap parameter variants,
   not art contracts. That keeps a solo-built content pipeline viable.

## 3. Phase overview

| # | Phase | Changes the sim? | Gate to move on |
|---|---|---|---|
| 0 | Measure: events + retention views | No | 7 days of event data queryable |
| 1 | "One more run" loop: death cam, juice, pace, hints | No | retries/session ≥ 3, D1 ≥ 20 % |
| 2 | Rulesets + Season 1: ducklings, nest banking, golden egg | **Yes** | median run 60–150 s, banking in ≥ 70 % of runs |
| 3 | Meta: Feathers, daily missions, streaks, cosmetics, ghosts, account linking | Missions only (read-only checks) | D7 ≥ 8 %, ≥ 25 % of players complete a mission |
| 4 | Portal build (CrazyGames first) with ads | No | build accepted; eCPM and playtime/DAU tracked |
| 5 | Cosmetic store on gatorgotcha.com (Stripe) | No | ≥ 1 % of D7 players convert |
| 6 | Live ops: 6-week seasons, weekly tournaments | Each season | seasonal D30 trend flat or rising |

Gates are measured, recorded in `PROGRESS.md`, and reviewed by the owner. A missed gate means
iterate inside the phase, not skip ahead.

## 4. Phase rationale

### Phase 0 — Measure
We currently only see *verified* runs from players who were online. We can't see title-screen
bounces, retries, quits, installs or the share funnel. A first-party events table in Supabase (no
third-party script, so the CSP stays `script-src 'self'`) gives us D1/D7 and funnel views in SQL.
Cheap, private, and required to judge every later gate.

### Phase 1 — "One more run"
The highest-leverage fixes don't touch the sim:
- **Death cam**: replay the last 3 s of the run from the gator's side, using the input log we
  already record. Players learn *why* they died, which is what makes retrying feel fair.
- **Juice**: hitstop and shake on the catch, a pulse when spotted, "close shave!" callouts.
- **Pace vs best**: "+12 s ahead of your best" makes every run a race against yourself.
- **Run-end stats**: time unseen, closest call, eggs per minute; small brags that feed sharing.
- **First-run hints**: three contextual tips (cone, hide, dash). The median player plays once,
  so the first run must teach the hide-behind-logs idea.

Retry already works (Enter, or the autofocused "Retry this swamp" button after a 1.1 s catch
delay); Phase 1 adds Space and makes the game-over card faster to read, not a new flow.

### Phase 2 — Rulesets + Season 1
Any sim change alters scores for the same inputs, so first we introduce a **ruleset version**:
it rides along with every submission, is stored per score, and leaderboards are filtered by it.
Today's scores become the *Season 0 Hall of Fame*. Then the Season 1 mechanics, all original:

- **Ducklings.** Each egg hatches a duckling that trails behind you. The gator can snap up the
  *last* duckling instead of you: a second chance that costs you points. A long trail is easier
  to spot, because the sight check also tests the tail.
- **Nest banking.** Ducklings score only when you lead them home to the nest (the duck's spawn
  point). Payout `100 × n × (1 + 0.1 n)` rewards long chains super-linearly. This is the core
  greed decision the game lacks: bank 3 safely, or push for 10 with a gator on your tail.
- **Golden egg.** Rare, worth 5 ducklings, and its splash carries twice as far. A high-value,
  high-noise target.

Score becomes banked value + seconds × 10. Expect runs to get slightly longer and much more
varied, which is the intent.

### Phase 3 — Meta progression, identity, ghosts
- **Feathers**, a soft currency computed by the server from *verified* runs (1 per banked
  duckling). The client never writes it.
- **Daily missions** (three a day, generated from the date, checked during replay), a **streak**,
  and **achievements**: reasons to come back tomorrow.
- **Cosmetics** (duck colors, hats, trail styles, nest decor) unlocked with Feathers. They're pure
  render data, so they cannot affect fairness.
- **Ghost challenges.** Store each run's input log (≤ 64 KB, already validated) so a share link
  becomes "race my ghost on this swamp". Social challenge built on infrastructure we already have.
- **Account linking** (Facebook Login is built; add Google). Durable identity is a prerequisite
  for owning cosmetics and for purchases, and it fixes the iOS home-screen identity split.

### Phase 4 — Portals (first revenue)
Web game portals bring traffic we can't buy and pay an ad revenue share. One codebase, a
`PlatformAdapter` (gameplay start/stop, mid-game ad, rewarded ad, portal user), and a
`VITE_PLATFORM` build flag. The portal build drops the PWA/service worker and ships as a zip.
Rewarded ads grant **only** Feathers ×2 or a 24 h cosmetic trial: never a revive. CrazyGames
first; others evaluated after its review.

### Phase 5 — Cosmetic store
Stripe Checkout (redirect, so the CSP is unchanged), provisioned through the Vercel Marketplace.
A signed, idempotent webhook writes entitlements with the service role. Products are cosmetic
only: Supporter Pack, small bundles, and a cosmetic Season Pass. Requires a linked account.

### Phase 6 — Live ops
Six-week seasons, each with one new mechanic or predator, a cosmetic set and a board reset.
Candidates: **Lurker** (a submerged ambush gator, eyes and bubbles only, appearing after 60 s) and
**Heron** (a swoop telegraphed by its shadow). Plus a weekly Tournament Swamp on a fixed seed.

## 5. Economy

| Source | Earns | Spends on |
|---|---|---|
| Banked ducklings (verified) | 1 Feather each | Feather cosmetics |
| Daily mission | 25–75 Feathers | |
| Streak milestone (3/7/14 days) | cosmetic + Feathers | |
| Rewarded ad (portal) | ×2 Feathers on one run | |
| Purchase (store) | premium cosmetics, Season Pass track | |

Rules: premium cosmetics are never purchasable with Feathers and vice versa within a season, so
neither economy undercuts the other. No item, currency or ad changes the sim.

## 6. Monetization — stated honestly

- **Costs** are near zero today (Vercel + Supabase free tiers). The first cost driver is storing
  input logs (Phase 3): retain each player's best run plus the last 30 days.
- **Ad revenue scales with volume, not quality.** Portal revenue share pays cents per daily active
  user; current figures get verified in Phase 4 before we set targets.
- **Cosmetics only pay once D7 retention exists.** Typical web-game payer conversion is low single
  digit percent of engaged players; the Phase 5 gate (≥ 1 % of D7 players) reflects that.
- **The order is the strategy.** Phases 0–3 create the retention that 4–5 convert. Shipping ads to
  a game people play once only monetizes one session per player.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Sim change breaks replays / old clients | Ruleset version; old builds get rejected and drop the run (`flushDecision` removes on 409/422); auto-update reloads clients |
| Ducklings make the game too forgiving | The snap costs the duckling and its banked-value potential; tune via `src/config.ts`, gate on run-length median |
| Currency farming with bots | Feathers come only from server-replayed runs; existing rate limit (10/min); daily Feather cap |
| Portal policy / CSP rejects Supabase calls | Phase 4 verifies first; fallback is an offline-only portal build with portal-SDK leaderboards |
| Payment disputes on anonymous accounts | Purchases require a linked account |
| Scope creep in live ops | One new mechanic per season, maximum |

## 8. Out of scope (for now)

Real-time multiplayer, native apps beyond an optional Play Store TWA, user-generated maps,
loot boxes or any randomized paid item.
