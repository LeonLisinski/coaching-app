# Billing Setup — UnitLift coaching-app

## Sadržaj

1. [Planovi i cijene](#planovi-i-cijene)
2. [Stripe API verzija](#stripe-api-verzija)
3. [Promo logika — 50% za prvih 12 plaćenih mjeseci](#promo-logika)
4. [Free trial — 14 dana, jednom po računu](#free-trial)
5. [Scale overage — metered billing](#scale-overage)
6. [Upgrade/Downgrade logika](#upgradedowngrade)
7. [Otkazivanje pretplate](#otkazivanje)
8. [Failed payment — grace period](#failed-payment)
9. [Ambassador plan](#ambassador-plan)
10. [Customer Portal](#customer-portal)
11. [Webhookovi i idempotency](#webhookovi)
12. [Cronovi](#cronovi)
13. [Stripe TEST setup vodič](#stripe-test-setup)
14. [Env varijable](#env-varijable)
15. [Testni scenariji](#testni-scenariji)

---

## Planovi i cijene

| Plan       | Cijena | Limit aktivnih klijenata | Napomena                        |
|------------|-------:|-------------------------:|----------------------------------|
| Starter    |  29 €/mj |                      10 | Hard limit                      |
| Pro        |  59 €/mj |                      30 | Hard limit                      |
| Scale      |  99 €/mj |                      75 | +10 €/mj po svakih 25 iznad 75 |
| Ambassador |       0 € |            Neograničeno | Samo ručnom dodjelom admina     |

U limite ulaze isključivo klijenti gdje je `active = true`. Deaktivirani ne zauzimaju slot.

---

## Stripe API verzija

**Pinana verzija: `2025-02-24.acacia`**

Razlog: ovo je posljednja Stripe API verzija koja podržava legacy `subscriptionItems.createUsageRecord` s `action='set'` i `aggregate_usage='max'`. Metoda je uklonjena u verziji `2025-03-31.basil`. Scale overage **mora** koristiti `aggregate_usage='max'` jer se naplaćuje **maksimum** dosegnutog tiera, ne zbroj. Noviji Billing Meters ne podržavaju `max` agregaciju. Ne upgradeaj API verziju bez promjene cijelog overage modela.

Sve Stripe instance u kodu su pinane na `apiVersion: '2025-02-24.acacia'`.

---

## Promo logika

### Poslovni uvjeti za dobivanje promo prava

Korisnik dobiva promo pravo (**jednom, trajno**) ako:
- Se prvi put pretplaćuje **dok** je `NEXT_PUBLIC_FOUNDING_PROMO_END` u budućnosti
- Prethodno nikada nije dobio promo pravo (`promo_granted_at IS NULL`)

### Stripe coupon konfiguracija

```
Naziv: Founding Coaches 50% — First Year
Postotak: 50% off
Duration: repeating
Duration in months: 12
Applies to products: UnitLift Starter, UnitLift Pro, UnitLift Scale
```

**Bitno:** UnitLift Scale Overage je **drugi price unutar istog Stripe proizvoda `UnitLift Scale`** (nije zaseban product). Coupon koji se primjenjuje na proizvod `UnitLift Scale` automatski diskontira **i** osnovnu cijenu od 99 €/mj **i** metered overage cijenu (+10 €/blok) — što je upravo i poslovna namjera.

### KRITIČNO: Trial i coupon

**Stripe `repeating` coupon broji `duration_in_months` od trenutka aplikacije, uključujući trial dane.**

Implementacija u kodu:

1. **Promo korisnik BEZ triala** → coupon se primjenjuje odmah na checkout sesiji
   - `subscription_create` je prvi plaćeni invoice → 12 promo mjeseci počinju odmah
   - Stripe automatski postavlja `subscription.discount.end = now + 12 months`

2. **Promo korisnik S trialom** → coupon se **NE** primjenjuje na checkout
   - Webhook `invoice.created` (okida se kad Stripe generira **draft** prvi plaćeni invoice nakon kraja triala) primjenjuje coupon na Stripe subscription
   - Stripe finalizira draft invoice s discountom već u snazi
   - `repeating/12` brojač počinje od trenutka primjene = početak prvog plaćenog perioda
   - Time DB `promo_ends_at` i Stripe `discount.end` ostaju **identični**

3. **`promo_ends_at` je STVARNI Stripe `discount.end`**
   - Webhook `invoice.payment_succeeded` na prvom plaćenom invoiceu čita `subscription.discount.end` (ili `subscription.discounts[0].end`) iz Stripe API-ja i pohranjuje točan timestamp u DB
   - Nema lokalnog `+12 months` izračuna → nema mogućnosti DB/Stripe mismatch-a
   - Posebno bitno za upgrade/downgrade u zadnjim danima promo perioda

4. **Promo kodovi su `allow_promotion_codes: false`**
   - Niti jedan checkout ne dopušta ručni unos promo kodova
   - Promo je 100% kontroliran server-side kroz DB-backed `isPromoEligible()`

### DB tracking polja (u `subscriptions`)

| Polje | Opis |
|-------|------|
| `promo_granted_at` | Kada je pravo na promo dodijeljeno (checkout). NULL = nikad. Nikad se ne briše. |
| `promo_paid_period_started_at` | Datum prvog plaćenog invoicea. NULL dok se ne naplati. |
| `promo_ends_at` | `promo_paid_period_started_at + 12 months`. NULL dok se ne naplati. |
| `promo_lost_at` | Datum otkazivanja. Promo je trajno izgubljen. NULL dok ne otkaže. |

### Promo cijena Scale overage confirmacija

Kad Scale korisnik prelazi novi tier, modal prikazuje **promo cijenu ako je `promo_ends_at > now()`**. Promo coupon vrijedi i na osnovnu Scale cijenu i na overage:

- Tier 76–100:  49,50 € + 5 €  = **54,50 €/mj** (promo) ili 109 €/mj (regular)
- Tier 101–125: 49,50 € + 10 € = **59,50 €/mj** (promo) ili 119 €/mj (regular)
- Tier 126–150: 49,50 € + 15 € = **64,50 €/mj** (promo) ili 129 €/mj (regular)
- Pravilo: +5 €/mj (promo) ili +10 €/mj (regular) za svakih dodatnih započetih 25 aktivnih klijenata iznad 75

### Upgrade/downgrade s promom

- Promjena plana **ne resetira** niti produžuje `promo_ends_at`
- Stripe nativno zadržava coupon na subscription-level discountu kroz plan change
- `promo_ends_at` ostaje originalni datum; Stripe `repeating` coupon istječe na isti datum

### Promo se gubi

- Na `customer.subscription.deleted` → webhook postavlja `promo_lost_at = now()`
- Nikad se ne može ponovo dodijeliti (`promo_granted_at IS NOT NULL` blokira)
- Failed payment, grace period, retry → `promo_ends_at` se ne mijenja
- Prorated upgrade invoice (`billing_reason = 'subscription_update'`) → `promo_ends_at` se ne mijenja

---

## Free trial

- 14 dana, jednom po UnitLift korisničkom računu (`profiles.trial_used_at`)
- Kartica se unosi na početku (Stripe `payment_method_collection: 'always'`)
- Provjera: DB (`trial_used_at`) + Stripe (provjera prethodnih subscriptiona s `trial_start`)
- Po završetku triala → Stripe automatski naplaćuje plan
- Po otkazivanju triala → nema naplate, trial slot ostaje potrošen zauvijek
- Email podsjetnici: 7d i 2d prije isteka putem cron `/api/cron/reminders`
- Webhook `trial_will_end` se NE koristi za email (samo za coupon aplikaciju) → nema duplikata

---

## Scale overage

### Tier struktura

Promo cijene tijekom prvih 12 plaćenih mjeseci primjenjuju se na cjelokupnu Scale naplatu (i osnovnu i overage cijenu).

| Maksimum aktivnih klijenata u periodu | Cijena (regular) | Cijena (promo, prvih 12 mj) |
|--------------------------------------:|-----------------:|----------------------------:|
| 0–75                                  |         99 €/mj  |                  49,50 €/mj |
| 76–100                                |        109 €/mj  |                  54,50 €/mj |
| 101–125                               |        119 €/mj  |                  59,50 €/mj |
| 126–150                               |        129 €/mj  |                  64,50 €/mj |
| 151–175                               |        139 €/mj  |                  69,50 €/mj |
| dalje: +10 €/mj redovno, +5 €/mj promo, po svakih dodatnih započetih 25 klijenata                  |

### Mehanizam

1. Korisnik prelazi tier → modal traži potvrdu s točnom cijenom (promo-aware)
2. Atomski RPC `set_active_with_overage_peak` ili `insert_client_with_overage_peak`:
   - Update `subscriptions.max_overage_blocks = GREATEST(max_overage_blocks, p_blocks)`
   - Create/activate client
   - **Ili oba uspiju, ili ništa** (jedna DB transakcija)
3. Best-effort immediate Stripe usage report
4. Dnevni cron `/api/cron/scale-overage` čita `max_overage_blocks` i prijavljuje Stripeu → backup
5. `max_overage_blocks` se **resetira** samo na `invoice.payment_succeeded` s `billing_reason IN ('subscription_cycle', 'subscription_create')`, nikada na prorated invoiceu

### Kreiranje Scale Overage priceId u Stripu

Overage je **drugi price unutar istog Stripe proizvoda `UnitLift Scale`**. Skripta kreira metered price (10 €/jedinica/mjesec, `aggregate_usage='max'`) i veže ga uz postojeći `UnitLift Scale` product.

Dashboard UI ne prikazuje `aggregate_usage = max` opciju, pa je skripta obavezna:

```bash
# TEST mode
STRIPE_PRODUCT_SCALE=prod_xxx STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/setup-stripe-overage-price.ts

# LIVE mode
STRIPE_PRODUCT_SCALE=prod_xxx STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/setup-stripe-overage-price.ts
```

Skripta koristi API verziju `2025-02-24.acacia` (jedina verzija koja podržava `aggregate_usage='max'`). Pohrani vraćeni `price_...` ID u env kao `STRIPE_PRICE_SCALE_OVERAGE`. Nema zasebnog `STRIPE_PRODUCT_SCALE_OVERAGE` — overage price je dio `STRIPE_PRODUCT_SCALE`.

---

## Upgrade/Downgrade

### Upgrade (npr. Starter → Pro)

- Odmah, s proration (`proration_behavior: 'always_invoice'`)
- Razlika se naplaćuje odmah
- Stripe zadržava promo coupon nativno (subscription-level discount), pa se 50% popust automatski prenosi i na novu osnovnu cijenu i na overage
- `promo_ends_at` se ne mijenja
- Limit dostupan odmah

### Downgrade (npr. Pro → Starter)

- Zakazuje se za kraj trenutnog perioda (`scheduled_plan_change` + `scheduled_plan_change_at`)
- Cron `/api/cron/apply-scheduled-changes` (svakih 15 min) primjenjuje downgrade kad `scheduled_plan_change_at <= now()`
- Cron re-validira broj aktivnih klijenata — ako ne stane, downgrade se otkazuje s email notifikacijom
- Stripe: `proration_behavior: 'none'` (čist prijelaz bez proration)
- `promo_ends_at` se ne mijenja

---

## Otkazivanje

- Stripe: `cancel_at_period_end = true` (korisnik zadržava pristup do kraja perioda)
- Ne postoji opcija u Customer Portalu — vlastiti cancellation UI
- Na `customer.subscription.deleted` webhook: postavlja `status = 'canceled'` i `promo_lost_at = now()`
- Promo pravo trajno izgubljeno, čak i ako globalni promo datum još traje
- Isti account ne može dobiti novi trial ni promo nakon re-pretplate

---

## Failed payment

- `invoice.payment_failed` → `status = 'past_due'`
- `first_failed_at` se postavlja **samo jednom** (prvi fail) i ne resetira se ponovnim failovima
- `locked_at = first_failed_at + 3 dana`
- Tijekom grace perioda (`locked_at > now()`): korisnik ne smije dodavati/aktivirati klijente, ne smije upgradeati
- Set-active, create-client, change-plan odbijaju `past_due` status
- Na uspješno plaćanje: `first_failed_at = null, locked_at = null`
- `promo_ends_at` se ne mijenja zbog failed paymenta

---

## Ambassador plan

- Isključivo ručna dodjela (SQL ili admin panel)
- `is_ambassador = true, plan = 'ambassador', client_limit = NULL`
- Ambassador se ne može dobiti kroz UI, API, checkout, change-plan, webhook ili metadata manipulaciju
- Svi billing endpointovi eksplicitno odbijaju `is_ambassador = true`
- Webhook `checkout.session.completed` odbija overwrite ambassador redaka
- RLS: authenticated korisnik nema INSERT/UPDATE/DELETE na `subscriptions` tablici
- Ambassador `stripe_subscription_id` i `stripe_customer_id` su placeholderi, nisu pravi Stripe IDs

---

## Customer Portal

Portal je konfiguriran **isključivo** za:
- Izmjena payment metode
- Pregled invoice historije
- Izmjena billing detalja

Portal **ne smije** imati:
- Promjena plana (subscription upgrade/downgrade)
- Cancellation pretplate
- Unos promo koda
- Bilo što što zaobilazi UnitLift poslovnu logiku

Ovo se konfigurira ručno u Stripe Dashboard → Customer Portal.

---

## Webhookovi

### Evente koje webhook sluša

| Event | Akcija |
|-------|--------|
| `checkout.session.completed` | Kreiranje/update subscription reda, pohrana `promo_granted_at` |
| `invoice.created` | (Trial+promo only) Apply founding coupon na DRAFT prvi plaćeni invoice (`billing_reason='subscription_cycle'`) |
| `invoice.payment_succeeded` | Clear failure tracking, sync period dates, set `promo_paid_period_started_at` i `promo_ends_at = stvarni Stripe discount.end` na prvom plaćenom invoiceu |
| `invoice.payment_failed` | Set `past_due`, anchor `first_failed_at` (jednom), izračun `locked_at` |
| `customer.subscription.updated` | Sync status, plan, dates |
| `customer.subscription.deleted` | Set `status = canceled`, `promo_lost_at = now()` |

### Idempotency

Tablica `processed_webhook_events` (unique `stripe_event_id`) sprječava dvostruku obradu.

### Sigurnost

- Stripe signature verifikacija na svakom zahtjevu
- Ambassador redci nikada nisu overwrote od webhookova
- `metadata.plan` se uvijek prolazi kroz `safePlan()` whitelist (`starter|pro|scale`)

---

## Cronovi

| Endpoint | Raspored | Svrha |
|----------|----------|-------|
| `/api/cron/reminders` | `0 7 * * *` (07:00 UTC) | Trial podsjetnici (7d, 2d), package expiry, pending payments |
| `/api/cron/scale-overage` | `0 6 * * *` (06:00 UTC) | Backup reporting DB-spremljenog Scale peaka Stripeu |
| `/api/cron/apply-scheduled-changes` | `15 * * * *` (svaki sat) | Primjena zakazanih downgradeova |

Svi cronovi zahtijevaju `Authorization: Bearer $CRON_SECRET`.

---

## Stripe TEST setup vodič

### Korak 1 — Stripe API ključevi

Idi u Stripe Dashboard → Developers → API keys.
Pohrani u Vercel env:
- `STRIPE_SECRET_KEY = sk_test_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_...`

### Korak 2 — Produkti i cijene

Kreiraj ove produkte i cijene:

| Product name | Price | Billing | Interval |
|---|---|---|---|
| UnitLift Starter | 29.00 € | Recurring | Monthly |
| UnitLift Pro | 59.00 € | Recurring | Monthly |
| UnitLift Scale | 99.00 € | Recurring | Monthly |

Pohrani Price IDs u env:
```
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_SCALE=price_xxx
```

### Korak 3 — Scale Overage price (OBAVEZNO kroz skriptu)

Overage **nije zaseban product** — to je drugi price unutar istog `UnitLift Scale` proizvoda. Skripta veže metered price (`aggregate_usage='max'`) uz postojeći Scale product.

Stripe Dashboard UI ne prikazuje `aggregate_usage = max` opciju. Koristi skriptu:

```bash
# Postavi env: STRIPE_SECRET_KEY (sk_test_) i STRIPE_PRODUCT_SCALE (prod_ ID iz koraka 2)
npx tsx scripts/setup-stripe-overage-price.ts
```

Skripta ispisuje Price ID. Pohrani u env:
```
STRIPE_PRICE_SCALE_OVERAGE=price_xxx
```

### Korak 4 — Founding coupon

U Stripe Dashboard → Coupons → Create coupon:

```
Name: Founding Coaches 50% — First Year
ID: founding_50_first_year   (ili što ti odgovara)
Type: Percentage
Percent off: 50
Duration: Repeating
Duration in months: 12
Applies to products: UnitLift Starter, UnitLift Pro, UnitLift Scale
Redemption limits: ne postavljaj (handled by code logic)
```

**Bitno:** UnitLift Scale je jedan product s dvije cijene (osnovna 99 €/mj recurring + metered overage 10 €/jedinica). Coupon koji applies_to product `UnitLift Scale` automatski diskontira **obje** cijene unutar tog proizvoda — i osnovnu i overage — što je željeno ponašanje za promo.

Pohrani Coupon ID:
```
STRIPE_COUPON_FOUNDING=founding_50_first_year
```

### Korak 5 — Customer Portal

Stripe Dashboard → Settings → Billing → Customer Portal:

**Uključi:**
- Payment methods (update)
- Invoice history
- Billing information

**Isključi / ne uključuj:**
- Subscriptions → Cancel subscription
- Subscriptions → Upgrade/downgrade plans
- Promotion codes

Pohrani portal URL ako treba, ili ostavi default.

### Korak 6 — Webhook endpoint

Stripe Dashboard → Developers → Webhooks → Add endpoint:

```
URL: https://app.unitlift.com/api/webhooks/stripe
Events to listen to:
  - checkout.session.completed
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.created
  - invoice.payment_succeeded
  - invoice.payment_failed
```

**Bitno:** `invoice.created` mora biti uključen za pravilno funkcioniranje promo coupona kod trial korisnika.

Pohrani Webhook Signing Secret:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Korak 7 — Vercel env varijable

Postavi sve env varijable u Vercel projekt → Settings → Environment Variables.

---

## Env varijable

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Stripe
STRIPE_SECRET_KEY=                    # sk_test_... ili sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # pk_test_... ili pk_live_...
STRIPE_WEBHOOK_SECRET=                # whsec_...
STRIPE_COUPON_FOUNDING=               # ID coupona za 50% / 12 mj
STRIPE_PRICE_STARTER=                 # price_... (29 €/mj recurring)
STRIPE_PRICE_PRO=                     # price_... (59 €/mj recurring)
STRIPE_PRICE_SCALE=                   # price_... (99 €/mj recurring)
STRIPE_PRICE_SCALE_OVERAGE=           # price_... metered overage cijena (drugi price unutar istog UnitLift Scale producta)
STRIPE_PRODUCT_SCALE=                 # prod_... UnitLift Scale (parent product koji sadrži i osnovnu i overage cijenu)

# App
NEXT_PUBLIC_APP_URL=https://app.unitlift.com
NEXT_PUBLIC_FOUNDING_PROMO_END=       # ISO-8601 datum, npr. 2026-09-01T00:00:00Z

# Cron
CRON_SECRET=                          # random string, mora biti identičan Vercel cron headeru

# Email
RESEND_API_KEY=

# Timezone za cron podsjetnik emails
REMINDER_TIMEZONE=Europe/Zagreb
```

---

## Testni scenariji

1. Novi account dobiva 14-dnevni trial i mora unijeti karticu
2. Isti account nakon otkazivanja ne dobiva novi trial
3. Trial podsjetnici stižu točno 7 i 2 dana prije isteka, bez duplikata
4. Nakon triala slijedi automatska naplata odgovarajuće cijene
5. Promo korisnik s trialom: 14-dnevni trial ne troši dio njegovih 12 promo mjeseci
   - `invoice.created` primjenjuje coupon na DRAFT prvi plaćeni invoice (`billing_reason='subscription_cycle'`)
   - `promo_paid_period_started_at` i `promo_ends_at` se postavljaju iz **stvarnog** Stripe `discount.end`
6. Korisnik koji se kvalificirao tijekom javnog promo roka, a trial mu završi nakon isteka roka, dobiva svojih 12 promo mjeseci
7. Promo korisnik ima 50% popusta točno 12 plaćenih billing perioda, zatim puna cijena
8. Korisnik koji je otkazao promo pretplatu više ne može dobiti promo (`promo_granted_at IS NOT NULL` → `isPromoEligible()` vraća false)
9. Upgrade tijekom promo: coupon ostaje, `promo_ends_at` se ne mijenja, Stripe coupon se automatski prenosi na novu cijenu
10. Downgrade s promom: ista logika
11. Scale overage je diskontirano u promo periodu (50% i na osnovnu cijenu i na overage, jer je overage drugi price unutar istog Stripe Scale producta)
12. Starter s 10 aktivnih ne može dodati/aktivirati 11. → `UPGRADE_REQUIRED` + modal
13. Pro s 30 aktivnih → ista logika
14. Direct Supabase `clients.update({ active: true })` odbija trigger `enforce_active_via_api_trigger`
15. Scale 75→76 → modal prikazuje 109 €/mj (regular) ili 54,50 €/mj (promo)
16. Scale 100→101 → 119 €/mj (regular) ili 59,50 €/mj (promo); Scale 125→126 → 129 €/mj (regular) ili 64,50 €/mj (promo)
17. Atomski test: ako klijent ne može biti aktiviran, `max_overage_blocks` se ne mijenja
18. Trener prijeđe Scale prag pa odmah deaktivira: overage se i dalje naplati (DB peak ostaje)
19. Failed immediate Stripe usage report → cron sutra iz DB peaka nadoknadi
20. Prorated upgrade invoice → `max_overage_blocks` se NE resetira
21. Novi redovni billing period → `max_overage_blocks = 0` (jedanput, na `subscription_cycle`)
22. Upgrade Starter→Pro, Pro→Scale → odmah, samo prorated razlika
23. Downgrade zakazan → otkazuje se ako broj klijenata ne stane u niži plan
24. Failed payment → grace 3 dana od prvog faila, ne od ponovnih failova
25. Failed payment → `promo_ends_at` ostaje nepromijenjen
26. Cancellation → pristup do period end, bez nove naplate
27. Cancellation → `promo_lost_at` se postavlja, trajno gasi promo pravo
28. Ambassador kroz UI/API/Supabase/webhook/metadata → svuda odbijen
29. Ponovljeni webhook → deduplication tablica sprječava duplikat
30. Customer Portal → ne postoji plan change, cancellation ni promo kod
31. Re-checkout → reuse postojećeg Stripe customer ID-a, nema duplikata

---

## Finalni opis billing logike

1. **Registracija** — novi trainer odabire plan (Starter/Pro/Scale), prolazi Stripe Checkout sa 14-dnevnim trialom (jednom po accountu) i unosom kartice.

2. **Promo pravo** — ako je globalni promo datum aktivan, promo pravo se trajno pohranjuje u DB. Coupon se aplicira odmah (bez triala) ili putem `trial_will_end` webhookova (s trialom) kako bi svih 12 promo mjeseci pokrivalo isključivo plaćene invoice.

3. **Plaćeni periodom** — svaki billing period (monthly) pokreće `invoice.payment_succeeded`. Na prvom plaćenom invoiceu baza pamti `promo_paid_period_started_at` i `promo_ends_at`. Stripe `repeating/12` coupon automatski istječe nakon 12 perioda.

4. **Hard limiti** — Starter max 10, Pro max 30 aktivnih klijenata. Svaki pokušaj prelaska vraća `UPGRADE_REQUIRED`. Limit je enforced server-side; direktni Supabase update `active` sprječava DB trigger.

5. **Scale overage** — svaki tier crossing zahtijeva korisnikovu potvrdu s točnom cijenom (promo-aware). Potvrda pokretuje atomski RPC koji simultano ažurira `max_overage_blocks` i aktivira klijenta. Daily cron izvještava Stripe o DB peaku.

6. **Failed payment** — 3 dana grace period od prvog faila. Korisnik ne može povećavati billing rizik. Na naplatu se vraćaju sva prava.

7. **Cancellation** — `cancel_at_period_end = true`. Po brisanju subscriptiona: status canceled, promo trajno izgubljen.

8. **Ambassador** — isključivo ručna dodjela, svuda je blokiran.

---

> **UPOZORENJE:** Ne upgradeaj Stripe API verziju bez procjene utjecaja na Scale Overage. `createUsageRecord` je uklonjen u `2025-03-31.basil` i novijima.
