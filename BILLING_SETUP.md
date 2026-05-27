# UnitLift Billing Setup Guide

Complete steps for configuring Stripe (test and live), deploying to production,
and migrating existing trainers to the Ambassador plan.

---

## Plan structure

| Plan | Price | Active client limit |
|------|-------|---------------------|
| Starter | €29/mo | 10 |
| Pro | €59/mo | 30 |
| Scale | €99/mo | 75 (+ €10/mo per additional 25) |
| Ambassador | Free | Unlimited (internal, hidden) |

**Scale overage:** metered Stripe item, synced daily via `/api/cron/scale-overage`.

**Founding promo:** 50%-off-forever coupon applied to all checkouts while
`NEXT_PUBLIC_FOUNDING_PROMO_END` is in the future.

---

## Step 1 — Create Stripe products and prices (TEST mode first)

In **Stripe Dashboard → Test mode**:

### 1a. Products and prices

Create one Product per plan, each with a **monthly recurring price** in EUR:

| Product name | Price | Env var |
|---|---|---|
| UnitLift Starter | €29.00/mo | `STRIPE_PRICE_STARTER` |
| UnitLift Pro | €59.00/mo | `STRIPE_PRICE_PRO` |
| UnitLift Scale | €99.00/mo | `STRIPE_PRICE_SCALE` |
| UnitLift Scale Overage | €10.00/mo metered (max) | `STRIPE_PRICE_SCALE_OVERAGE` |

For the **Scale Overage** price:
- Billing model: `Metered`
- Metered usage: `Maximum during billing period` (not sum)
- Aggregation: `Maximum` (so reducing clients below threshold resets the charge)

Copy each price ID (`price_...`) and set it in `.env.local`:
```
STRIPE_PRICE_STARTER=price_test_...
STRIPE_PRICE_PRO=price_test_...
STRIPE_PRICE_SCALE=price_test_...
STRIPE_PRICE_SCALE_OVERAGE=price_test_...
```

### 1b. Founding promo coupon

Create a coupon in **Stripe Dashboard → Coupons**:
- Name: `Founding Coaches 50%`
- ID (custom): `founding_50`
- Discount: 50% off
- Duration: Forever
- **Do NOT set a redemption limit** — the app controls eligibility by date

Copy the coupon ID and set:
```
STRIPE_COUPON_FOUNDING=founding_50
```

### 1c. Customer billing portal

In **Stripe Dashboard → Settings → Billing → Customer portal**:
- Enable the portal
- Allow customers to: cancel subscriptions, update payment methods, view invoices
- Set return URL: `https://app.unitlift.com/dashboard/billing`

---

## Step 2 — Set env vars

### coaching-app (`.env.local` or Vercel Dashboard → Environment Variables)

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...       # switch to sk_live_... before going live
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_test_...
STRIPE_PRICE_PRO=price_test_...
STRIPE_PRICE_SCALE=price_test_...
STRIPE_PRICE_SCALE_OVERAGE=price_test_...
STRIPE_COUPON_FOUNDING=founding_50

# Founding promo end date (ISO-8601). Remove or set to past date to disable.
NEXT_PUBLIC_FOUNDING_PROMO_END=2026-07-01T00:00:00Z

# Cron authentication
CRON_SECRET=<random secret for cron endpoints>
```

### coaching-app-web (`.env.local`)

```bash
NEXT_PUBLIC_APP_URL=https://app.unitlift.com
NEXT_PUBLIC_FOUNDING_PROMO_END=2026-07-01T00:00:00Z
```

---

## Step 3 — Run the DB migration

The migration `20260527000001_billing_rework.sql` has already been applied to
the remote Supabase project. It:
- Adds `ambassador` to the `subscriptions.plan` CHECK constraint
- Adds `subscriptions.is_ambassador boolean` column
- Allows `client_limit` to be NULL (unlimited for ambassador)
- Migrates all existing trainers to the Ambassador plan

If rerunning locally with Supabase CLI:
```bash
supabase db push
```

---

## Step 4 — Cancel test-mode Stripe subscriptions

Run the cancel script **once**, while `STRIPE_SECRET_KEY` is still the test key:

```bash
npx tsx scripts/cancel-test-stripe-subs.ts
```

This cancels all test-mode subscriptions (so existing trainers won't be
re-billed when you switch to live mode). Their DB records already say
`plan=ambassador, status=active` so they keep full access.

---

## Step 5 — Switch to live mode

1. In Stripe Dashboard, repeat **Step 1** in **Live mode** (not test).
2. Copy live price IDs and set them in Vercel env vars:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_PRICE_STARTER=price_live_...`
   - `STRIPE_PRICE_PRO=price_live_...`
   - `STRIPE_PRICE_SCALE=price_live_...`
   - `STRIPE_PRICE_SCALE_OVERAGE=price_live_...`
   - `STRIPE_COUPON_FOUNDING=founding_50` (recreate in live mode if different ID)
3. Create webhook endpoint in **Stripe Dashboard → Webhooks** (live mode):
   - URL: `https://app.unitlift.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.trial_will_end`
4. Copy the webhook signing secret (`whsec_...`) and set `STRIPE_WEBHOOK_SECRET`.
5. Deploy coaching-app to Vercel (trigger redeploy after env var changes).

---

## Step 6 — Assign Ambassador plan to specific trainers

To manually grant ambassador access to a trainer after the initial migration:

```sql
-- Replace with the trainer's actual profile UUID
UPDATE subscriptions SET
  plan = 'ambassador',
  is_ambassador = true,
  status = 'active',
  client_limit = NULL,
  cancel_at_period_end = false,
  locked_at = NULL,
  updated_at = now()
WHERE trainer_id = 'TRAINER_UUID_HERE';
```

Run via Supabase Dashboard → SQL Editor or via MCP.

---

## Step 7 — Extend or end the founding promo

To **extend** the promo:
- Update `NEXT_PUBLIC_FOUNDING_PROMO_END` in Vercel env to a later date.
- Redeploy both projects.

To **end** the promo immediately:
- Set `NEXT_PUBLIC_FOUNDING_PROMO_END` to a past date (or remove it).
- Redeploy. New registrations will no longer receive the founding coupon.
- Existing subscribers who already received the coupon keep it (Stripe `forever` duration).

---

## Cron schedule

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/reminders` | Daily 07:00 UTC | Check-in, package, payment, trial reminders |
| `/api/cron/scale-overage` | Daily 06:00 UTC | Sync Scale plan overage quantities to Stripe |

Both require `Authorization: Bearer $CRON_SECRET` in production.
Vercel runs them automatically via `vercel.json`.

---

## Founding coupon behaviour

- Applied automatically at Stripe Checkout while `NEXT_PUBLIC_FOUNDING_PROMO_END` is in the future
- Stripe `duration: forever` — applies to every invoice until the subscription is cancelled
- **If the trainer cancels and re-subscribes**: the coupon is NOT re-applied (Stripe deletes it from the customer after cancellation). This enforces "valid while subscription is uninterrupted"
- Founding discount shows as 50% reduction on invoices and in the Stripe customer portal
