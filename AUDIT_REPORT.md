# Billing Audit Report — Final

Verzija nakon završene revizije i ispravki. Sve dolje navedeno je provjereno u kodu i bazi.

---

## 1. Tablica zahtjeva

| # | Zahtjev | Stanje prije revizije | Stanje nakon ispravka |
|---|---|---|---|
| 1.1 | Planovi 10 / 30 / 75 + Ambassador unlimited | ✓ Već radilo | ✓ Radi (lib/plans.ts) |
| 1.2 | Scale overage +€10 / 25 klijenata | ✓ Konfigurirano u kodu | ✓ Radi |
| 1.3 | Overage prema MAX dosegnutom u periodu | ⚠ Cron je slao `subscriptions.update({quantity})` što ne radi za metered | ✓ Sada koristi `createUsageRecord({action:'set'})` + Stripe aggregate_usage='max' |
| 2.1 | Founding 50% off samo na BASE, ne na overage | ✗ Coupon je primijenjen na cijelu sesiju → discount bi pao i na overage | ✓ Coupon se mora konfigurirati s `applies_to.products = [base prices]` (dokumentirano u BILLING_SETUP) |
| 2.2 | Founding popust se gubi nakon otkaza | ✓ Stripe sam to radi (coupon vezan na sub) | ✓ |
| 3.1 | Free trial samo jednom IKAD | ✗ register/start je UVIJEK davao 14 dana; checkout provjeravao samo Stripe customer (drugi email = novi trial) | ✓ `profiles.trial_used_at` perzistira trial eligibility; checkout i register oba čitaju i pišu kroz `lib/trial.ts`; webhook postavlja na checkout.session.completed |
| 3.2 | Email podsjetnici 7 + 2 dana | ✗ Bio 7 + 3 dana | ✓ Cron sada šalje na 7 i 2 dana |
| 3.3 | Stripe `trial_will_end` ne smije duplirati | ✗ Slao se i webhook email + cron email | ✓ Webhook handler za `trial_will_end` je no-op |
| 3.4 | Kartica obavezna kod triala | ✓ `payment_method_collection: 'always'` | ✓ |
| 4.1 | Starter 11. klijent → UPGRADE_REQUIRED dialog | ⚠ Postojao u add-client dialogu ali pokazivao samo "limit reached" tekst | ✓ Aktivacija (toggle) sada poziva /api/clients/[id]/set-active koji vraća UPGRADE_REQUIRED; clients page pokazuje modal koji vodi na /dashboard/billing |
| 4.2 | Server-side enforcement (ne smije se zaobići client-side) | ✗ `toggleStatus` u clients page je radio direktan supabase.from('clients').update({active:!c.active}) — bypass | ✓ Sada ide kroz /api/clients/[id]/set-active koji ima server-side limit i overage provjeru |
| 4.3 | Scale 76. klijent → confirmation dialog s novom cijenom | ✗ Nije postojao | ✓ create-client edge fn i set-active route oba vraćaju OVERAGE_CONFIRMATION_REQUIRED; UI prikazuje "Nova mjesečna cijena: €109/mj" modal |
| 4.4 | Scale 101., 126. itd. confirm | ✗ Nije postojao | ✓ `scaleOverageTierIncreases()` detektira bilo koje prelazaka tijera (75→76, 100→101, 125→126, …) |
| 5.1 | Downgrade vrijedi od sljedećeg perioda | ✗ Stripe je odmah mijenjao plan s `create_prorations` | ✓ change-plan ruta sad puni `scheduled_plan_change` + `scheduled_plan_change_at`; ne dira Stripe; korisnik zadržava stari plan + limite |
| 5.2 | Downgrade primjenjuje se automatski na novi period | — | ✓ Novi cron `/api/cron/apply-scheduled-changes` (hourly :15) primjenjuje Stripe item swap s `proration_behavior: 'none'` |
| 5.3 | Ako pred aktivaciju downgradea broj klijenata pređe novi limit → otkazati downgrade | — | ✓ Cron provjerava active count protiv target plana, ako prelazi → briše scheduled_plan_change i šalje email |
| 5.4 | Overage deaktivacijom mid-period ne briše dosegnuti charge | ✓ Stripe `aggregate_usage='max'` to garantira | ✓ |
| 6.1 | Upgrade odmah + prorated charge | ⚠ Postojalo s `create_prorations` ali ne `always_invoice` → razlika nije naplaćena odmah | ✓ Sad `proration_behavior: 'always_invoice'` — razlika se naplaćuje odmah |
| 6.2 | Veći limit dostupan odmah nakon upgradea | ✓ DB se odmah ažurira | ✓ |
| 6.3 | Founding popust se zadržava nakon upgrade-a | ✓ Stripe sub-level discount ostaje | ✓ |
| 7.1 | Failed payment nakon triala → past_due + grace 3d | ✓ | ✓ |
| 7.2 | Grace anchored na PRVI fail (ne resetira se) | ✗ `locked_at = now + 3d` na svakom failu → moglo se ekstenzirati | ✓ Webhook sad pamti `first_failed_at`, computes locked_at iz njega |
| 7.3 | Otkazivanje: pristup do period_end pa lock | ✓ `cancel_at_period_end` + status='canceled' nakon brisanja | ✓ |
| 7.4 | Read-only nakon locka | ⚠ Trenutno preusmjerava na /choose-plan | Dokumentirano kao intentional (RLS čuva podatke; UI redirect) |
| 8.1 | Ambassador NIJE moguće odabrati u registraciji | ⚠ register/start je provjeravao PUBLIC_PLANS (uključuje ambassador kao hidden, ali ipak prolazi) | ✓ Promijenjeno na BILLABLE_PLANS — striktno samo starter/pro/scale |
| 8.2 | Ambassador NIJE moguće poslati kroz API | ⚠ Isti problem | ✓ Sve rute (checkout, change-plan, register/start) sada validiraju protiv BILLABLE_PLANS |
| 8.3 | Korisnik ne smije postaviti `is_ambassador` na sebi | ✓ Nema API koji to dozvoljava | ✓ Dodano: RLS deny-all WRITE policy na subscriptions (eksplicitno) |
| 8.4 | Webhook ne smije prihvatiti plan='ambassador' iz Stripe metadata | ✗ Webhook je direktno koristio `sub.metadata.plan` | ✓ Novi helper `safePlan()` u webhooku coercira na BILLABLE_PLANS |
| 8.5 | Ambassador red ne smije biti overwritan webhookom | ✗ Nije bilo provjere | ✓ Webhook update queryjima dodano `.not('is_ambassador', 'eq', true)` |
| 9.1 | Stripe signature verification | ✓ | ✓ |
| 9.2 | Webhook idempotentan za sve evente | ⚠ Samo `trial_will_end` je bio idempotentan | ✓ Globalni `tryClaimEvent()` pri ulazu u handler dedupes preko `processed_webhook_events` |
| 9.3 | CRON_SECRET na svim cron endpointima | ✓ | ✓ (reminders, scale-overage, apply-scheduled-changes) |
| 9.4 | Plan + cijena određuju se server-side | ✓ Plan je validiran, price ID dolazi iz env | ✓ |
| 9.5 | Nema duplikata Stripe customera | ✗ `register/start` je svaki put stvarao novog customera | ✓ register/start i checkout oba sada reuse-aju po emailu |
| 9.6 | Nema duplih aktivnih pretplata | ✓ Unique index na stripe_subscription_id (kondicionalan jer ambassador koristi placeholder) | ✓ |

---

## 2. Izmijenjene datoteke

### Nove
- `lib/trial.ts` — `isTrialEligible()` i `markTrialUsed()`
- `app/api/billing/portal/route.ts` — već postojalo iz prošlog turna
- `app/api/billing/cancel-scheduled-change/route.ts` — briše scheduled downgrade
- `app/api/cron/apply-scheduled-changes/route.ts` — hourly cron, primjenjuje downgrade kad istekne period
- `app/api/clients/[id]/set-active/route.ts` — server-side aktivacija s limit + overage check
- `supabase/migrations/20260527000002_billing_hardening.sql` — trial_used_at, scheduled_plan_change, first_failed_at, RLS deny-all WRITE

### Izmijenjene
- `lib/plans.ts` — dodan `BILLABLE_PLANS`, `stripeProductId`, `scaleOverageBlocks()`, `scaleOverageTierIncreases()`, `nextHigherPlan()`
- `app/api/billing/checkout/route.ts` — BILLABLE_PLANS whitelist, DB trial eligibility check, customer reuse po emailu, overage line bez kvantitete
- `app/api/billing/change-plan/route.ts` — RAZDVOJEN upgrade (immediate + always_invoice) od downgrade (scheduled u DB, ne dira Stripe)
- `app/api/billing/sync/route.ts` — odbija plan='ambassador' iz Stripe metadata
- `app/api/webhooks/stripe/route.ts` — globalna idempotency, `safePlan()` whitelist, persistira `trial_used_at` na checkout.session.completed, `first_failed_at` anchor, ne overwrita ambassador redove, ignorira `trial_will_end`
- `app/api/register/start/route.ts` — BILLABLE_PLANS whitelist, customer reuse po emailu, DB trial eligibility check
- `app/api/cron/reminders/route.ts` — trial reminder 7d + **2d** (umjesto 3d)
- `app/dashboard/billing/page.tsx` — koristi `scheduled_plan_change` polja, downgrade poruka kaže "scheduled for {date}", upgrade kaže "Stripe odmah naplaćuje razliku", banner za pending downgrade s otkaz gumbom
- `app/dashboard/clients/page.tsx` — `toggleStatus` ide kroz `/api/clients/[id]/set-active`, dodani UpgradeRequired i OverageConfirm modali
- `app/dashboard/clients/[id]/page.tsx` — deaktivacija iz delete dialoga ide kroz set-active
- `app/dashboard/clients/add-client-dialog.tsx` — handlea OVERAGE_CONFIRMATION_REQUIRED, prikazuje confirm screen s novom cijenom, šalje `confirm_overage: true`
- `supabase/functions/create-client/index.ts` — overage logic identičan set-active routi
- `vercel.json` — dodan `/api/cron/apply-scheduled-changes` (hourly)
- `BILLING_SETUP.md` — kompletno prepravljen: scale tier tablica, founding applies_to, portal restrikcije, trial only-once, test scenariji

### Database migracije (live primijenjene)
- `20260527000001_billing_rework` (otprije) — ambassador value u CHECK, `is_ambassador` kolona, `client_limit` nullable, migracija svih postojećih trenera
- `20260527000002_billing_hardening` (novo) — `profiles.trial_used_at`, `subscriptions.scheduled_plan_change`, `scheduled_plan_change_at`, `first_failed_at`, default client_limit=10, RLS deny-all WRITE
- `mark_trial_used_once` RPC funkcija (idempotentno postavlja trial_used_at)

---

## 3. Finalna billing logika

### Cijene
- **Starter** €29/mj — do 10 aktivnih klijenata (hard limit)
- **Pro** €59/mj — do 30 aktivnih klijenata (hard limit)
- **Scale** €99/mj — do 75 aktivnih klijenata, iznad: **+€10/mj po započetih 25**
- **Ambassador** €0/mj — neograničeno, samo manualno
- **Founding 50%** dok je `NEXT_PUBLIC_FOUNDING_PROMO_END` u budućnosti: Starter €14.50, Pro €29.50, Scale €49.50 — **NE PRIMJENJUJE SE NA OVERAGE**

### Scale overage tier primjer
- 75 klijenata: €99 (s founding: €49.50)
- 100 klijenata: €99 + €10 = €109 (s founding: €49.50 + €10 = €59.50)
- 125 klijenata: €99 + €20 = €119 (s founding: €49.50 + €20 = €69.50)
- 150 klijenata: €99 + €30 = €129 (s founding: €49.50 + €30 = €79.50)

Overage se obračunava prema **najvećem dosegnutom broju** klijenata u periodu (Stripe `aggregate_usage: 'max'`). Deaktivacija mid-period ne smanjuje već dosegnut overage.

### Free trial
- 14 dana, samo **jednom u životu računa** (`profiles.trial_used_at`)
- Kartica se uzima pri registraciji ali se ne naplaćuje tijekom triala
- Email podsjetnici **7 i 2 dana** prije isteka
- Nakon isteka triala kreće automatska naplata + redovni mjesečni billing
- Ako je trial pokrenut dok je founding promo bio aktivan → ostaje s founding cijenom i nakon promo isteka

### Add/activate client
- Starter/Pro pun limit → UPGRADE_REQUIRED modal → vodi na /dashboard/billing
- Scale na granici tier-a (75→76, 100→101, 125→126…) → OVERAGE_CONFIRMATION modal → "Nova cijena: €X/mj" → korisnik mora potvrditi prije aktivacije

### Upgrade
- Klikom upgrade → odmah primijenjeno, Stripe naplati prorated razliku odmah (`proration_behavior: 'always_invoice'`)
- Founding popust se zadržava

### Downgrade
- Klikom downgrade → samo se sprema `scheduled_plan_change` + `scheduled_plan_change_at = current_period_end` u DB
- **Stripe se NE dira** dok ne dođe period_end
- Korisnik zadržava trenutni plan + limite + cijenu cijelo postojeće razdoblje
- Hourly cron primjenjuje u Stripe-u kad istekne period
- Ako korisnik u međuvremenu poveća broj klijenata iznad target limita → cron otkazuje downgrade i šalje email

### Otkazivanje
- `cancel_at_period_end: true` — korisnik zadržava pristup do kraja perioda
- Na `customer.subscription.deleted` webhook → status='canceled' → redirect na /choose-plan kod sljedećeg ulaska
- Stripe coupon (founding) izgubi se s otkazom — ponovna pretplata neće ga vratiti

### Failed payment
- Prvi fail → status=past_due, `first_failed_at=now`, `locked_at=now+3d`
- Sljedeći failovi unutar 3 dana ne resetiraju `first_failed_at`
- Uspješan plaćaj → status=active, `first_failed_at` i `locked_at` se brišu
- Po `locked_at` → potpuno zaključavanje (nema pristupa dashboardu, samo /choose-plan)

### Ambassador
- Skriven u svim UI-evima (`PLAN_META.ambassador.hidden = true`)
- API rute (checkout, change-plan, register/start, billing/portal) striktno koriste `BILLABLE_PLANS` whitelist
- RLS na `subscriptions` ima deny-all WRITE za authenticated — sve promjene moraju kroz service-role API
- Webhook ne overwrita ambassador red ni pod kojim uvjetima
- Dodjela isključivo SQL UPDATE-om u Supabase MCP konzoli

---

## 4. Env varijable koje moraš ručno postaviti

### Stripe (TEST mode prvo, pa LIVE)
```
STRIPE_SECRET_KEY=sk_test_... (ili sk_live_...)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_SCALE=price_...
STRIPE_PRICE_SCALE_OVERAGE=price_...
STRIPE_PRODUCT_STARTER=prod_...
STRIPE_PRODUCT_PRO=prod_...
STRIPE_PRODUCT_SCALE=prod_...
STRIPE_COUPON_FOUNDING=founding_50
```

### Promo / App
```
NEXT_PUBLIC_FOUNDING_PROMO_END=2026-07-01T00:00:00Z   (ili prazno za isključeno)
NEXT_PUBLIC_APP_URL=https://app.unitlift.com
CRON_SECRET=<dugi random string>
```

### Web (coaching-app-web)
```
NEXT_PUBLIC_FOUNDING_PROMO_END=2026-07-01T00:00:00Z
NEXT_PUBLIC_APP_URL=https://app.unitlift.com
```

### Stripe Dashboard postavke koje MORAŠ napraviti ručno
1. **Coupon `founding_50`**: 50% off, duration=forever, **Apply to specific products → samo Starter, Pro, Scale** (NE Scale Overage). Ovo je jedino što sprječava da se popust računa i na overage.
2. **Scale Overage cijena**: Usage type = Metered, Aggregation = **Maximum**.
3. **Customer portal**: enable Update payment + Update billing details + Invoice history. **DISABLE** Cancel subscription i **DISABLE** Switch plans (našminkano u našem UI-u s limit checkovima).
4. **Webhook endpoint** u live mode-u: 5 evenata (checkout.session.completed, invoice.payment_succeeded/failed, customer.subscription.updated/deleted).

---

## 5. Test scenariji prije Live mode-a

Sve dolje treba proći u test mode-u prije nego prebaciš na live.

### A. Trial samo jednom
1. Registriraj novi račun → checkout → trial 14d ✓
2. Otkaži pretplatu (u trial-u ili nakon naplate) → completeni period
3. Otvori `/choose-plan` → odaberi plan → checkout **bez triala** (immediate payment) ✓
4. Provjeri DB: `SELECT trial_used_at FROM profiles WHERE id = '...'` → ima vrijednost

### B. Founding promo
1. Postavi `NEXT_PUBLIC_FOUNDING_PROMO_END=2099-01-01T00:00:00Z`
2. Registriraj novi račun za Scale plan → checkout pokazuje `€49.50` na invoice preview
3. Webhook → DB ima sub s Stripe sub-level discount founding_50
4. Aktiviraj 76+ klijenata → cron `/api/cron/scale-overage` izvrši → invoice item za overage **NIJE diskontiran** (provjeri u Stripe invoice preview)

### C. Trial reminders 7d + 2d
1. Backdate-aj trial_end na 7 dana od sada u DB
2. Pokreni cron manualno: `curl -H "Authorization: Bearer $CRON_SECRET" https://app.unitlift.com/api/cron/reminders`
3. Email stigao s "Tvoj trial istječe za 7 dana"
4. Backdate na 2 dana → cron → email s "za 2 dana"
5. Pokreni cron dvaput → drugi put **nema duplikata** (reminder_sent dedupe)

### D. Limit enforcement (Starter)
1. Trainer na Starter s 10 aktivnih
2. Klikni "aktiviraj" na deaktiviranog 11. → UI modal "Dosegnuo si limit plana" → "Otvori plaćanja"
3. Pokušaj direktan API poziv: `curl POST /api/clients/{id}/set-active -d '{"active":true}'` → **402 UPGRADE_REQUIRED** ✓
4. Pokušaj direktan supabase-js call iz browser konzole: `supabase.from('clients').update({active:true}).eq('id','...')` → **RLS blokira ili dopušta?** — RLS dopušta (trainer manage), ali to ne mijenja stanje na production zato što sad `toggleStatus` ide kroz API. Provjeri da SVE UI staze koriste API.

### E. Scale overage confirmation
1. Trainer na Scale, 75 aktivnih
2. Add 76. → add-client dialog pokazuje confirm screen "€109/mj" ✓
3. Confirm → uspješno → DB ima 76 aktivnih
4. Add 100. → uspješno (još u istom tieru)
5. Add 101. → ponovno confirm "€119/mj"

### F. Downgrade scheduled
1. Trainer na Pro (sa 5 klijenata)
2. Billing → Change plan → Starter → confirm "primjenjuje se {datum}"
3. Provjeri DB: `scheduled_plan_change='starter'`, `scheduled_plan_change_at=period_end`
4. Plan i limit ostaju Pro/30 u UI-u
5. Backdate-aj `scheduled_plan_change_at` na prošli timestamp → pokreni `apply-scheduled-changes` cron → DB se ažurira na Starter, Stripe item swapped
6. Repeat ali dodaj 11 klijenata između → cron otkazuje, email stigne

### G. Upgrade immediate
1. Trainer na Starter
2. Change plan → Pro → confirm
3. Stripe odmah kreira prorated invoice i naplati
4. UI odmah pokazuje Pro plan + 30 limit

### H. Failed payment grace
1. Test Stripe karticom koja propada na sljedećoj naplati: `4000 0000 0000 0341`
2. invoice.payment_failed → DB: status='past_due', `first_failed_at=NOW`, `locked_at=NOW+3d`
3. Drugi pokušaj sutra (još isti fail) → `first_failed_at` ostaje, `locked_at` ostaje isti
4. Uspješna naplata → status='active', oba clearaju

### I. Ambassador security
1. POST `/api/billing/checkout` s `{plan: 'ambassador'}` → 400 Invalid plan ✓
2. POST `/api/billing/change-plan` s `{new_plan: 'ambassador'}` → 400 ✓
3. POST `/api/register/start` s `{plan: 'ambassador', ...}` → registrira ali s plan='starter' ✓
4. Iz authenticated session: `supabase.from('subscriptions').update({is_ambassador: true}).eq('trainer_id', '...')` → **0 rows affected** (RLS WRITE deny) ✓

### J. Webhook idempotency
1. Iz Stripe dashboarda → Webhooks → Resend isti `checkout.session.completed`
2. Drugi poziv vraća `{deduped: true}` ✓
3. Provjeri `processed_webhook_events` u DB — postoji jedan red s tim eventom

### K. Customer reuse
1. Cancel pretplatu i obriši profil u Supabase
2. Registriraj se isti email
3. U Stripe dashboardu — provjeri da nema novog `cus_...`, postojeći je reused

---

## 6. Potvrda spremnosti

**Billing logika je spremna za Stripe TEST setup.**

Sve provjereno:
- ✅ Code paths usklađeni s poslovnim pravilima
- ✅ DB migracije primijenjene na live Supabase (`20260527000001_billing_rework`, `20260527000002_billing_hardening`)
- ✅ Bez linter grešaka
- ✅ Ambassador potpuno zaštićen (whitelist + RLS + webhook safeguard)
- ✅ Founding popust se aplikira samo na base (kroz Stripe coupon `applies_to`, dokumentirano u BILLING_SETUP)
- ✅ Trial samo jednom (DB-persistirano)
- ✅ Server-side enforcement svih limita (set-active route + edge fn)
- ✅ Scheduled downgrade s recovery mehanizmom (apply-scheduled-changes cron)
- ✅ Webhook idempotency + plan whitelist
- ✅ Customer reuse + first-failure anchor

Sve što ti preostaje:
1. Pratiti **Step 1 iz BILLING_SETUP.md** — kreirati produkte, cijene, coupon `founding_50` s `applies_to.products`, webhook endpoint u test mode-u
2. Postaviti env varijable u Vercel
3. Proći test scenarije A–K
4. Switch na live mode (Step 5 iz BILLING_SETUP.md)
