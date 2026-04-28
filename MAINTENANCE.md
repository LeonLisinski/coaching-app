# Maintenance Procedures

## Kako promijeniti cijene pretplate

Kad mijenjaš cijene pretplate, **obavezno uskladi sva 3 mjesta**:

1. **Stripe Dashboard (produkt cijena)**
   - Ažuriraj cijene na Stripe produktu/cijenama koje koristi UnitLift pretplata.
   - Provjeri da su aktivni ispravni Price ID-jevi za `starter`, `pro`, `scale`.

2. **`coaching-app/lib/plans.ts`**
   - Ažuriraj mapu planova i Price ID-jeve koje backend koristi za checkout i billing.
   - Ovdje je izvor istine za Stripe checkout u aplikaciji.

3. **`coaching-app-web/components/landing/Pricing.tsx`**
   - Ažuriraj prikazane cijene na marketing stranici.
   - Ovo je javni prikaz cijena koji korisnici vide prije registracije.

### Važno upozorenje

- **Redoslijed nije bitan**, ali **sva 3 mjesta moraju biti usklađena**.
- Ako jedno mjesto ostane staro, korisnici mogu vidjeti jednu cijenu, a biti naplaćeni po drugoj.

---

## Dodavanje linkova u `messages/hr.json` i `messages/en.json`

Svaki link prema aplikaciji (`app.unitlift.com`) u message JSON fajlovima mora koristiti `__APP_URL__` prefiks umjesto direktnog URL-a.

**Ispravno:**
```json
["Prijava", "__APP_URL__/login"]
["Registracija", "__APP_URL__/register"]
```

**Neispravno:**
```json
["Prijava", "https://app.unitlift.com/login"]
```

### Kako runtime zamjena funkcionira

Runtime zamjena `__APP_URL__` → `process.env.NEXT_PUBLIC_APP_URL` vrši se u `coaching-app-web/components/landing/Footer.tsx` kroz funkciju `resolveAppUrl()`.

Samo linkovi koje renderira `Footer.tsx` prolaze kroz tu zamjenu. Ako se isti JSON linkovi renderiraju u nekoj drugoj komponenti, ona mora koristiti isti `resolveAppUrl()` ili ekvivalent.

### Upozorenje

Ako se link doda **bez `__APP_URL__` prefiksa**, neće se koristiti env varijabla i link će biti neispravan u svim environmentima osim produkcije (staging, local, preview deployovi vodit će na `https://app.unitlift.com` umjesto na lokalni/staging URL).

---

## Povlačenje RLS snapshota iz produkcije

Većina RLS politika trenutno postoji samo u Supabase Dashboardu, ne u `supabase/migrations/`. Da bi RLS bio code-reviewable i verzioniran, povuci snapshot kad god dodaš/mijenjaš politiku u Dashboardu.

### Procedura

1. Pokreni Docker Desktop (Supabase CLI ga koristi za `db dump`).
2. U korijenu projekta `coaching-app` pokreni:

   ```sh
   supabase db dump --schema public --linked -f rls-snapshot.sql
   ```

3. Output je SQL fajl s cijelom `public` schema definicijom uključujući `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` i sve `CREATE POLICY` naredbe.
4. Pregledaj `rls-snapshot.sql` i razreži po tablici u zasebne migracije pod `supabase/migrations/<timestamp>_rls_<table>.sql`.
5. Commit migracije; **NE commit-aj** `rls-snapshot.sql` (privremena datoteka, dodaj u `.gitignore`).

### Alternativa bez Dockera

Ako nemaš Docker, koristi `pg_dump` direktno:

```sh
pg_dump --schema-only --no-owner --no-acl \
  "postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres" \
  > rls-snapshot.sql
```

`<DB_PASSWORD>` i `<PROJECT_REF>` (npr. `nvlrlubvxelrwdzggmno`) su u Supabase Dashboard → Settings → Database.

### Zašto ovo

- Bez snapshota nije moguće u code reviewu reći koje politike štite koju tablicu po operaciji (SELECT/INSERT/UPDATE/DELETE).
- Migration history u Gitu trenutno pokriva samo `expo_push_tokens` i `reminder_sent`; svi ostali RLS-ovi su "hidden state" u Dashboardu.
- Ako Supabase projekt ikad mora biti restoran iz nule, bez snapshota gubiš sve politike.
