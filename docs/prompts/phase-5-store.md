# Phase 5 — store: cosmetic purchases on gatorgotcha.com with Stripe Checkout

**Step 0:** Read `docs/prompts/00-shared-context.md` in full, especially:
- §5.3 on data writes
- §5.6 on no pay-to-win
- §5.8 on payments
- §5.9 on identity
- §6.3 on CSP

This prompt assumes it.

## Objective

When this phase ends, linked players on gatorgotcha.com can buy cosmetic-only products through
Stripe Checkout by redirect:
- a Supporter Pack
- small cosmetic bundles
- a cosmetic Season Pass track

A signed, idempotent webhook grants the entitlements with the service role. Purchases show up in
the profile and render immediately. The CSP stays unchanged. Refunds revoke the entitlements.
Nothing purchasable changes the sim.

## Baseline check

```bash
npm test && npm run lint && npm run build && npm run build:crazygames
grep -c "| 4 | done" PROGRESS.md     # 1
```

Record the Phase 4 metrics: portal eCPM and playtime per DAU over 14 days, from `events`
filtered to `platform = 'crazygames'`. Confirm that account linking from Phase 3 is live, since
purchases depend on it. If it is not, STOP §7.5.

## Scope

**In:**
- the Stripe integration through the Vercel Marketplace
- the product catalogue
- checkout session endpoint
- webhook
- refund and dispute handling
- the store UI on web
- receipts via Stripe's emails
- regional pricing

**Out:**
- purchases on portals (their terms; record as a follow-up)
- subscriptions (not planned)
- any consumable or randomised item (never)

## Tasks

1. **Provision Stripe the platform way.** Load the `vercel:marketplace` skill and follow it to
   find and provision Stripe for the `gator-gotcha` project. Env vars land in Vercel; pull them
   locally with `vercel env pull .env.local` and check only that the variable names exist; never
   print values. Use test mode until the owner says to switch. If provisioning needs a dashboard
   action, the owner does it (STOP §7.5).
2. **VERIFY payments and pricing.** Confirm in the current Stripe docs:
   - which payment methods Checkout supports for PH customers (e.g. GCash, cards);
   - multi-currency prices in PHP and USD;
   - tax handling for digital goods.
   Record the findings in `PROGRESS.md`. Prices are in the Appendix.
3. **Catalogue.**
   - Migration `supabase/migrations/20270101000000_store.sql` adds `products(id, stripe_price_ids jsonb, grants text[] references cosmetics, active bool)`.
   - It also adds a `purchases(id, user_id, product_id, stripe_session_id unique, stripe_event_id unique, status, created_at)` table.
   - Seed the premium cosmetics into `cosmetics` with `currency = 'premium'`.
4. **Checkout endpoint** `POST /api/store/checkout { productId }`:
   - requires a session whose user has a **linked identity**, not anonymous; otherwise 403
     "Link your account to buy";
   - zod validation;
   - a rate limit of 5 per minute;
   - creates a Checkout Session with `client_reference_id = user_id` and
     `metadata.product_id`, and success/cancel URLs on `https://www.gatorgotcha.com/?store=success|cancel`;
   - returns `{ url }`, and the client does `location.assign(url)`;
   - so no Stripe script is ever loaded and the CSP stays as it is.
5. **Webhook** `POST /api/store/webhook`:
   - verifies the raw-body signature with the webhook secret (VERIFY how to read a raw body in
     Vercel Functions for this runtime);
   - is idempotent on `event.id`;
   - on `checkout.session.completed`, inserts the purchase and its entitlements
     (`source = 'purchase'`) in one SQL function;
   - on `charge.refunded` or `charge.dispute.created`, marks the purchase and deletes those
     entitlements;
   - always returns 2xx after a valid signature, so the logic must not throw.
   Tests use a fake repository and recorded fixture payloads (no network).
6. **Client store** (`src/ui/storeUi.ts`, a section of `#screen-profile`):
   - product cards with procedural previews, rendered with `src/render/cosmetics.ts` onto a
     small canvas;
   - prices shown in the local currency;
   - a "Link account to buy" prompt for anonymous players;
   - the `?store=success` handler polls `GET /api/me/entitlements` until the grant appears
     (deterministic retry: 1 s, 2 s, 4 s, then "Purchase pending — it will appear shortly").
7. **Season Pass.**
   - A purchase unlocks the premium track of the current season's cosmetics. The free track is
     Feather-priced items.
   - Progress on both tracks comes from missions completed during the season.
   - The pass grants **only** cosmetics.
8. **Legal pages:**
   - add to `public/privacy.html`: payments processed by Stripe, and what is stored (product,
     date, Stripe ids);
   - add `public/terms.html` covering digital cosmetic goods, refunds and contact;
   - link both from the store.
9. **Events:** `store_view`, `checkout_start{productId}` and `purchase{productId}`, where
   `purchase` is emitted by the server inside the webhook.
10. **Security.** Run the `security-review` skill on `api/store/*`. Required items:
    - signature check before parsing;
    - no secrets in logs;
    - entitlement writes by the service role only;
    - the checkout endpoint cannot be used to grant anything.

## Acceptance criteria

- [ ] `npm test` passes. New tests cover:
      - checkout auth: anonymous gets 403
      - the webhook rejects an invalid signature, is idempotent on a replayed event id, and
        revokes on refund
      - success polling backoff
- [ ] `npm run lint && npm run build` exits 0. The `vercel.json` CSP is unchanged
      (`git diff main -- vercel.json` shows no CSP diff).
- [ ] Stripe test mode end to end, under `vercel dev` with Stripe's CLI forwarding (VERIFY the
      current command): buy the Supporter Pack, the entitlement appears, the hat renders, then a
      refund removes it.
- [ ] The golden snapshot is unchanged and `git diff main -- src/sim` is empty.
- [ ] The owner switches to live mode and makes one real purchase themselves, then refunds it.
      Record the result.

## Checkpoint protocol

1. Put the evidence in `PROGRESS.md` under `### Phase 5`, with the row
   `| <date> | 5 | done | store live |`.
2. Commit `feat: cosmetic store with Stripe Checkout (phase 5)`.
3. Stop and summarize. The gate is that at least 1 % of D7 players purchase within 30 days,
   measured from `purchases` and `events_retention`. Await the go-ahead.

## Appendix

### Launch catalogue (prices VERIFY against Stripe's PHP support; round to local price points)

| id | contents | USD | PHP |
|---|---|---|---|
| `supporter` | Golden crown hat, gold nest, nickname color, "Supporter" badge | 2.99 | 149 |
| `bundle_swamp` | 3 tints + mossy nest | 1.49 | 75 |
| `bundle_party` | Party hat + confetti trail | 0.99 | 49 |
| `season_pass_s1` | Season premium track (8 cosmetics) | 3.99 | 199 |

### Rules

- Premium items are never sold for Feathers. Feather items are never sold for money within the
  same season.
- No randomised contents. No limited-time pressure beyond the season ending.
- Prices include tax where Stripe Tax applies (VERIFY).
