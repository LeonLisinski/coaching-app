# UnitLift — Tehnička dokumentacija

> Zadnje ažuriranje: April 2026  
> Verzija dokumenta: 1.0

---

## Sadržaj

1. [Pregled projekta](#1-pregled-projekta)
2. [Tech stack](#2-tech-stack)
3. [Struktura projekta](#3-struktura-projekta)
4. [Baza podataka](#4-baza-podataka)
5. [API & integracije](#5-api--integracije)
6. [Autentifikacija & korisnici](#6-autentifikacija--korisnici)
7. [Environment varijable](#7-environment-varijable)
8. [Deployment](#8-deployment)
9. [Lokalni razvoj](#9-lokalni-razvoj)
10. [Poznati problemi & TODO](#10-poznati-problemi--todo)

---

## 1. Pregled projekta

### Što je UnitLift?

UnitLift je **SaaS coaching platforma za fitness trenere**. Trenerima pruža centraliziran alat za upravljanje klijentima, treninzima, prehranom, check-inovima, komunikacijom i financijama. Klijenti pristupaju platformi putem **mobilne aplikacije**.

### Za koga je namijenjen?

- **Treneri** — koriste web aplikaciju (`app.unitlift.com`) za kreiranje planova, praćenje klijenata i komunikaciju
- **Klijenti** — koriste mobilnu aplikaciju (iOS/Android) za praćenje vlastitog napretka, komunikaciju s trenerom i dostavljanje tjednih check-inova

---

### Arhitekturni dijagram (tekstualni opis)

```
┌─────────────────────────────────────────────────────────────────┐
│                        KORISNICI                                 │
│                                                                  │
│   Treneri (web)              Klijenti (mobile)                   │
│   app.unitlift.com           iOS / Android app                   │
└────────────┬─────────────────────────┬───────────────────────────┘
             │                         │
             ▼                         ▼
┌────────────────────────┐   ┌────────────────────────┐
│  coaching-app          │   │  coaching-app-mobile   │
│  Next.js 16            │   │  Expo 54 / React Native│
│  Vercel                │   │  EAS Build             │
└────────────┬───────────┘   └──────────┬─────────────┘
             │                          │
             │   ┌──────────────────────┤
             ▼   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                            │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ PostgreSQL  │  │  Supabase Auth   │  │  Supabase Storage│   │
│  │ (baza pod.) │  │  (JWT, SSR)      │  │  (avatari, slike)│   │
│  └─────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Edge Functions (Deno runtime)                          │   │
│  │  · create-client     · send-client-password-reset      │   │
│  │  · send-push         · delete-account                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VANJSKE INTEGRACIJE                           │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │  Stripe  │  │   Resend   │  │  Expo Push    │  │   VAPID  │ │
│  │ (naplata)│  │  (email)   │  │  (mob. push)  │  │(web push)│ │
│  └──────────┘  └────────────┘  └───────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OSTALE APLIKACIJE                             │
│                                                                  │
│  coaching-app-admin     coaching-app-web                        │
│  (interni admin panel)  (marketing site — unitlift.com)         │
└─────────────────────────────────────────────────────────────────┘
```

### Repozitoriji / projekti

| Projekt              | Opis                            | URL                      | Platforma  |
|---------------------|---------------------------------|--------------------------|------------|
| `coaching-app`       | Web app za trenere              | app.unitlift.com         | Vercel     |
| `coaching-app-mobile`| Mobilna app za klijente         | App Store / Google Play  | EAS Build  |
| `coaching-app-web`   | Marketing stranica              | unitlift.com             | Vercel     |
| `coaching-app-admin` | Interni admin panel             | nije javno               | Vercel     |

---

## 2. Tech stack

### 2.1 Web app za trenere (`coaching-app`)

| Kategorija         | Tehnologija / Verzija                          |
|-------------------|------------------------------------------------|
| Framework          | Next.js 16.1.6 (App Router)                   |
| React              | React 19.2.3                                  |
| TypeScript         | ^5                                             |
| CSS                | Tailwind CSS ^4                                |
| UI komponente      | Radix UI ^1.4.3, shadcn/ui                     |
| Ikone              | lucide-react ^0.575.0                          |
| Grafovi            | recharts ^3.7.0                                |
| Drag & drop        | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/modifiers |
| Internacionalizacija | next-intl ^4.8.3 (hr, en)                   |
| Teme               | next-themes ^0.4.6                             |
| Onboarding tour    | driver.js ^1.4.0                               |
| Supabase (browser) | @supabase/ssr ^0.8.0, @supabase/supabase-js ^2.98.0 |
| Plaćanja           | stripe ^20.4.1                                 |
| Web push           | web-push ^3.6.7                                |
| Deployment         | Vercel                                         |

### 2.2 Mobilna app za klijente (`coaching-app-mobile`)

| Kategorija         | Tehnologija / Verzija                          |
|-------------------|------------------------------------------------|
| Framework          | Expo ~54.0.33                                  |
| React Native       | 0.81.5                                         |
| React              | 19.1.0                                         |
| Routing            | expo-router ~6.0.23 (file-based)               |
| CSS                | NativeWind ^4.2.2 (Tailwind za React Native)   |
| Ikone              | @expo/vector-icons ^15.0.3, lucide-react-native ^0.577.0 |
| Animacije          | react-native-reanimated ~4.1.1                 |
| Geste              | react-native-gesture-handler ~2.28.0           |
| Slike              | expo-image ~3.0.11, expo-image-picker ~17.0.10 |
| Push notifikacije  | expo-notifications ~0.32.16                    |
| Sigurna pohrana    | expo-secure-store ~15.0.8                      |
| Supabase           | @supabase/supabase-js ^2.98.0                  |
| Auth pohrana       | ExpoSecureStoreAdapter (umjesto localStorage)  |
| Build              | EAS Build (Expo Application Services)          |

### 2.3 Marketing stranica (`coaching-app-web`)

| Kategorija         | Tehnologija / Verzija                          |
|-------------------|------------------------------------------------|
| Framework          | Next.js ^15.2.3 (App Router, Turbopack)        |
| React              | ^19.0.0                                        |
| Internacionalizacija | next-intl ^4.1.0 (hr, en)                   |
| Plaćanja (prikaz)  | stripe ^20.4.1                                 |
| Email (kontakt)    | resend ^6.9.4                                  |
| CSS                | Tailwind CSS ^4                                |

### 2.4 Admin panel (`coaching-app-admin`)

| Kategorija         | Tehnologija / Verzija                          |
|-------------------|------------------------------------------------|
| Framework          | Next.js 16.2.1 (App Router)                    |
| React              | 19.2.4                                         |
| Tablice            | @tanstack/react-table ^8.21.3                  |
| Forme              | react-hook-form ^7.72.0, zod ^4.3.6            |
| UI                 | @base-ui/react ^1.3.0, shadcn/ui               |
| Grafovi            | recharts ^3.8.0                                |
| Toasts             | sonner ^2.0.7                                  |
| Drawers            | vaul ^1.1.2                                    |
| Email              | resend ^6.9.4                                  |
| Datum              | date-fns ^4.1.0                                |
| Supabase           | @supabase/ssr ^0.9.0, @supabase/supabase-js ^2.100.0 |

### 2.5 Backend / API

- **Supabase** (hosted, projekt ID: `nvlrlubvxelrwdzggmno`)
  - PostgreSQL (v17) kao baza podataka
  - Supabase Auth (email/password, JWT)
  - Supabase Storage (za slike)
  - Edge Functions (Deno v2 runtime)
  - Realtime (za live chat)
- **Next.js API Routes** u `coaching-app` (server-side logika)
- **Vercel Cron** — `vercel.json` konfigurira dnevni cron u 7:00 UTC

### 2.6 Autentifikacija

- **Supabase Auth** za oba tipa korisnika
- **Treneri**: email/password prijava na web
- **Klijenti**: invite flow (generate invite link) → email s linkom → postavljanje lozinke → prijava u mobilnoj app
- **Session pohrana**:
  - Web: HTTP cookie (@supabase/ssr)
  - Mobitel: expo-secure-store (encrypted native storage)

### 2.7 Plaćanja (Stripe)

- Stripe API verzija: `2026-02-25.clover`
- Planovi: `starter`, `pro`, `scale`
- 14-dnevni besplatni trial za nove korisnike
- Stripe Checkout Sessions za uplatu
- Webhooks za sinkronizaciju statusa pretplate

### 2.8 Email (Resend)

- Provider: **Resend** (`api.resend.com`)
- Defaultni sender: `UnitLift <no-reply@unitlift.com>`
- Konfiguracija putem `RESEND_API_KEY` i `RESEND_FROM`

### 2.9 Push notifikacije

| Tip        | Za koga  | Implementacija                        |
|-----------|---------|---------------------------------------|
| Web push  | Treneri | VAPID (web-push npm paket), Service Worker `/sw.js` |
| Mob. push | Klijenti | Expo Push Notifications (FCM/APNs) |

### 2.10 Hosting & deployment

| Aplikacija           | Hosting  | Build                                    |
|---------------------|----------|------------------------------------------|
| `coaching-app`       | Vercel   | `next build` (auto-deploy na push)       |
| `coaching-app-web`   | Vercel   | `next build` (Turbopack)                 |
| `coaching-app-admin` | Vercel   | `next build`                             |
| `coaching-app-mobile`| EAS / App Store / Google Play | `eas build --platform all` |

---

## 3. Struktura projekta

### 3.1 `coaching-app` (web app za trenere)

```
coaching-app/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Roboto font, Providers, PWA meta)
│   ├── page.tsx                  # Root redirect (→ /dashboard ili /login)
│   ├── globals.css               # Globalni CSS (Tailwind imports)
│   ├── providers.tsx             # Klijentski provideri (Supabase, i18n, theme)
│   ├── login/page.tsx            # Stranica za prijavu trenera
│   ├── register/page.tsx         # Stranica za registraciju trenera
│   ├── reset-password/page.tsx   # Reset lozinke (treneri)
│   ├── client-auth/              # Stranica za postavljanje lozinke klijenata
│   │   ├── layout.tsx
│   │   └── page.tsx              # Obrađuje invite i recovery tokene iz URL hasha
│   ├── choose-plan/page.tsx      # Odabir Stripe plana
│   ├── dashboard/                # Glavni dashboard (zaštićen — samo za trenere)
│   │   ├── layout.tsx            # Dashboard layout (sidebar, navigation)
│   │   ├── page.tsx              # Overview stranica (statistika klijenata)
│   │   ├── mobile-dashboard.tsx  # Mobilna verzija dashboarda
│   │   ├── clients/              # Upravljanje klijentima
│   │   │   ├── page.tsx          # Lista klijenata
│   │   │   ├── [id]/page.tsx     # Detalji pojedinog klijenta
│   │   │   └── [id]/components/  # client-overview, client-packages, client-meal-plans,
│   │   │                         # client-training-overview, client-timeline, itd.
│   │   ├── training/             # Baza vježbi, planovi, predlošci
│   │   ├── nutrition/            # Namirnice, recepti, planovi prehrane
│   │   ├── checkins/             # Check-in statistika i konfiguracija
│   │   ├── chat/                 # Real-time chat s klijentima
│   │   ├── financije/            # Paketi, plaćanja, prihodi
│   │   ├── billing/page.tsx      # Upravljanje Stripe pretplatom
│   │   └── profile/page.tsx      # Profil trenera
│   ├── api/                      # Next.js API routes (server-only)
│   │   ├── register/             # Registracija trenera
│   │   ├── billing/              # Stripe billing operacije
│   │   ├── webhooks/stripe/      # Stripe webhook handler
│   │   ├── push/                 # Web push notifikacije
│   │   ├── cron/reminders/       # Dnevni cron za email podsjetnike
│   │   └── delete-account/       # Brisanje računa
│   ├── components/               # App-specifične komponente (ne UI primitivi)
│   ├── contexts/                 # React konteksti (chat, theme, settings)
│   └── hooks/
│       └── use-push-notifications.ts   # Hook za upravljanje web push pretplatom
├── components/
│   ├── ui/                       # shadcn/ui primitive komponente
│   └── locale-switcher.tsx       # Promjena jezika (hr/en)
├── lib/                          # Dijeljene utility funkcije
│   ├── supabase.ts               # Browser Supabase klijent
│   ├── supabase-server.ts        # Server Supabase klijent (SSR cookies)
│   ├── supabase-edge.ts          # Edge Function Supabase klijent
│   ├── resend-server.ts          # Resend email helper
│   ├── plans.ts                  # Stripe plan konstante (PLANS, CLIENT_LIMITS)
│   ├── utils.ts                  # Opće utility funkcije
│   ├── i18n/config.ts            # Lokalizacijska konfiguracija (hr, en)
│   ├── i18n/get-locale.ts        # Čitanje locale iz cookija
│   ├── email-checkin-reminder-html.ts  # HTML template za reminder email
│   ├── reminder-email-copy.ts    # Tekstualni sadržaj email podsjetnika
│   ├── reminder-calendar.ts      # Logika za računanje dana podsjetnika
│   ├── html-escape.ts            # HTML sanitizacija
│   ├── checkin-engagement.ts     # Logika za check-in engagement statistiku
│   ├── checkin-weight-parameter.ts     # Logika za težinski parametar check-ina
│   ├── client-auth-redirect.ts   # Redirect logika za client-auth stranicu
│   ├── client-tracking-week.ts   # Logika za tjedni tracking klijenata
│   ├── plans.ts                  # Plan konfiguracija
│   ├── training-metrics.ts       # Kalkulacija metrika treninga
│   ├── workout-log-sets.ts       # Logika za logiranje setova
│   └── workout-session-compare.ts # Usporedba workout sesija
├── messages/                     # i18n prijevodi
│   ├── hr.json                   # Hrvatski (default)
│   └── en.json                   # Engleski
├── supabase/                     # Supabase CLI konfiguracija
│   ├── config.toml               # Lokalni Supabase config
│   ├── migrations/               # SQL migracije (kronološki)
│   └── functions/                # Edge Functions (Deno)
│       ├── _shared/              # Dijeljeni kod za edge funkcije
│       ├── create-client/        # Kreiranje klijenta + slanje invite emaila
│       ├── send-client-password-reset/  # Reset lozinke za klijente
│       ├── send-push/            # Slanje web push obavijesti trenerima
│       └── delete-account/       # Soft-delete / hard-delete računa
├── public/                       # Statični resursi (ikone, manifest, service worker)
├── next.config.ts                # Next.js konfiguracija
├── vercel.json                   # Vercel cron konfiguracija
├── tsconfig.json                 # TypeScript konfiguracija
├── components.json               # shadcn/ui konfiguracija
└── package.json
```

### 3.2 `coaching-app-mobile` (Expo app za klijente)

```
coaching-app-mobile/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx               # Root layout (session, auth state, push init, deep links)
│   ├── index.tsx                 # Entry redirect (→ tabs ili login)
│   ├── onboarding.tsx            # Onboarding ekran pri prvoj prijavi
│   ├── settings.tsx              # Postavke klijenta
│   ├── timeline.tsx              # Timeline napretka
│   ├── package.tsx               # Pregled aktivnih paketa
│   ├── metrics.tsx               # Metrike napretka
│   ├── checkin-history.tsx       # Povijest check-inova
│   ├── compare-photos.tsx        # Usporedba fotografija napretka
│   ├── workout-history.tsx       # Povijest workout sesija
│   ├── nutrition-history.tsx     # Povijest prehrane
│   ├── (auth)/                   # Auth ekrani (bez tab navigacije)
│   │   ├── login.tsx             # Prijava
│   │   ├── forgot-password.tsx   # Zaboravljena lozinka
│   │   └── set-password.tsx      # Postavljanje lozinke (invite/reset)
│   └── (tabs)/                   # Tab navigacija (5 tabova)
│       ├── _layout.tsx           # Tab layout
│       ├── index.tsx             # Tab 0: Pregled (Home)
│       ├── 1-training.tsx        # Tab 1: Trening
│       ├── 2-nutrition.tsx       # Tab 2: Prehrana
│       ├── 4-chat.tsx            # Tab 4: Chat s trenerom
│       └── 5-checkin.tsx         # Tab 5: Tjedni check-in
├── lib/                          # Dijeljene biblioteke
│   ├── supabase.ts               # Supabase klijent (SecureStore adapter)
│   ├── notifications.ts          # Expo push token registracija
│   ├── ClientContext.tsx         # React context za podatke klijenta
│   ├── LanguageContext.tsx       # React context za jezik
│   ├── i18n.ts                   # Internacionalizacijska konfiguracija
│   └── UnitLiftLogo.tsx          # Logo komponenta
├── assets/                       # Slike, ikone, splash screen
├── app.json                      # Expo konfiguracija (bundle ID, EAS project ID)
├── eas.json                      # EAS Build profili i submit konfiguracija
├── tsconfig.json
└── package.json
```

### 3.3 `coaching-app-web` (Marketing stranica)

```
coaching-app-web/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── not-found.tsx             # 404 stranica
│   ├── robots.ts                 # robots.txt generator
│   ├── sitemap.ts                # sitemap.xml generator
│   ├── [locale]/                 # Lokalizirane stranice (hr/en)
│   │   ├── layout.tsx            # Locale layout (meta, OG tags)
│   │   ├── page.tsx              # Naslovna stranica
│   │   ├── cijene/               # Stranica s cijenama
│   │   ├── kako-radi/            # Kako funkcionira
│   │   ├── blog/                 # Blog + [slug]
│   │   ├── faq/                  # FAQ
│   │   ├── kontakt/              # Kontakt forma
│   │   ├── privatnost/           # Politika privatnosti
│   │   ├── uvjeti/               # Uvjeti korištenja
│   │   └── [seo-slugovi]/        # SEO landing pages (12 stranica)
│   └── api/
│       └── contact/route.ts      # Contact form API (Resend)
├── messages/                     # i18n prijevodi (hr.json, en.json)
├── i18n/                         # next-intl konfiguracija
├── middleware.ts                 # i18n middleware (locale detection)
├── scripts/
│   └── generate-icons.mjs        # Generiranje favicon ikona
├── public/                       # Statični resursi
├── next.config.ts
└── package.json
```

### 3.4 `coaching-app-admin` (Admin panel)

```
coaching-app-admin/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── (auth)/
│   │   └── login/page.tsx        # Admin prijava (email + MFA TOTP)
│   ├── (dashboard)/              # Admin dashboard (zaštićen)
│   │   ├── layout.tsx            # Dashboard layout
│   │   ├── page.tsx              # Overview: MRR, ARR, pipeline, treneri, bugovi
│   │   ├── treneri/page.tsx      # Lista svih trenera i pretplata
│   │   ├── financije/page.tsx    # Financijska analitika
│   │   ├── mailer/page.tsx       # Bulk email alat
│   │   ├── bugovi/page.tsx       # Bug tracker
│   │   ├── notes/page.tsx        # Interne bilješke
│   │   ├── sef/page.tsx          # Vault (tajni podaci)
│   │   ├── support/page.tsx      # Support ticketi
│   │   ├── expiring/page.tsx     # Pretplate koje istječu
│   │   └── postavke/page.tsx     # Admin postavke
│   └── api/
│       ├── auth/                 # Login, MFA setup/verify, signout
│       ├── mailer/               # Send email API, count API
│       └── vault/route.ts        # CRUD za vault zapise
├── components/                   # UI komponente
├── lib/                          # Supabase admin klijent, konfiguracija
├── supabase/                     # Supabase config
├── .env.local
└── package.json
```

### 3.5 Konvencije imenovanja

- **Fajlovi**: kebab-case (`client-overview.tsx`, `use-push-notifications.ts`)
- **Komponente**: PascalCase export (`ClientOverview`, `UsePushNotifications`)
- **Route fajlovi**: uvijek `page.tsx`, `layout.tsx`, `route.ts`
- **API routes**: `route.ts` s HTTP metodama (`GET`, `POST`, `DELETE`)
- **Hooks**: prefiks `use-` (`use-push-notifications.ts`)
- **Lib fajlovi**: opisni kebab-case (`supabase-server.ts`, `resend-server.ts`)
- **Edge Functions**: kebab-case direktorij s `index.ts`

---

## 4. Baza podataka

Supabase projekt: `nvlrlubvxelrwdzggmno`  
PostgreSQL v17  
URL: `https://nvlrlubvxelrwdzggmno.supabase.co`

> **Napomena**: Inicijalni schema (`20260302121637_remote_schema.sql`) je prazan — baza je postavljena direktno kroz Supabase Studio dashboard. Sve naknadne promjene su dokumentirane u migracijskim fajlovima.

### 4.1 Tablice

#### `profiles`
Osnovna tablica profila za **sve** korisnike (treneri + klijenti). Trigger u Supabase Auth automatski kreira red pri registraciji.

| Polje                 | Tip          | Opis                                          |
|----------------------|--------------|-----------------------------------------------|
| `id`                  | uuid PK      | Jednak `auth.users.id`                        |
| `full_name`           | text         | Ime i prezime                                 |
| `email`               | text         | Email adresa                                  |
| `phone`               | text         | Broj telefona                                 |
| `role`                | text         | `'trainer'` ili `'client'`                    |
| `instagram`           | text         | Instagram handle                              |
| `website`             | text         | Web stranica                                  |
| `tiktok`              | text         | TikTok handle (dodano migr. 20260312)         |
| `facebook`            | text         | Facebook profil (dodano migr. 20260312)       |
| `deletion_requested_at` | timestamptz | Timestamp zahtjeva za brisanjem              |
| `created_at`          | timestamptz  | Datum kreiranja                               |

#### `trainer_profiles`
Dodatne informacije specifične za trenere. 1:1 relacija s `profiles`.

| Polje                 | Tip          | Opis                                          |
|----------------------|--------------|-----------------------------------------------|
| `id`                  | uuid PK FK → `profiles.id` | Trener ID                  |
| `social_visibility`   | text[]       | Koji se socijalni linkovid prikazuju klijentima (default: `['phone','email','instagram','website']`) |
| `nutrition_fields`    | text[]       | Custom polja za unos prehrane (dodano migr. 20260313) |
| `exercise_fields`     | text[]       | Custom polja za vježbe (dodano migr. 20260313) |
| `workout_defaults`    | jsonb        | Default parametri za vježbe (dodano migr. 20260414) |

#### `clients`
Zapis klijenta — veza između trenera i korisnika.

| Polje              | Tip          | Opis                                          |
|-------------------|--------------|-----------------------------------------------|
| `id`               | uuid PK      | Klijent ID (nije isti kao `user_id`)          |
| `trainer_id`       | uuid FK → `profiles.id` | Trener koji upravlja klijentom    |
| `user_id`          | uuid FK → `profiles.id` | Klijentov Supabase auth ID         |
| `goal`             | text         | Cilj klijenta                                 |
| `date_of_birth`    | date         | Datum rođenja                                 |
| `weight`           | numeric      | Težina (kg)                                   |
| `height`           | numeric      | Visina (cm)                                   |
| `gender`           | text         | `'M'` ili `'F'` (dodano migr. 20260310)       |
| `notes`            | text         | Bilješke o klijentu (dodano migr. 20260310)   |
| `activity_level`   | text         | `sedentary`, `light`, `moderate`, `active`, `very_active` (dodano migr. 20260310) |
| `step_goal`        | integer      | Dnevni cilj koraka (dodano migr. 20260310)    |
| `active`           | boolean      | Je li klijent aktivan                         |
| `created_at`       | timestamptz  |                                               |

#### `subscriptions`
Stripe pretplate trenera.

| Polje                   | Tip         | Opis                                        |
|------------------------|-------------|---------------------------------------------|
| `id`                    | uuid PK     |                                             |
| `trainer_id`            | uuid FK → `profiles.id` | Trener                        |
| `stripe_customer_id`    | text        | Stripe Customer ID (`cus_...`)              |
| `stripe_subscription_id`| text        | Stripe Subscription ID (`sub_...`)          |
| `plan`                  | text        | `'starter'`, `'pro'`, `'scale'`             |
| `status`                | text        | `active`, `trialing`, `past_due`, `canceled` |
| `client_limit`          | integer     | Starter: 15, Pro: 50, Scale: 150            |
| `trial_start`           | timestamptz |                                             |
| `trial_end`             | timestamptz |                                             |
| `current_period_start`  | timestamptz |                                             |
| `current_period_end`    | timestamptz |                                             |
| `cancel_at_period_end`  | boolean     | Otkazivanje na kraju perioda                |
| `locked_at`             | timestamptz | Kad će biti zaključan (past_due + 3 dana grace) |
| `updated_at`            | timestamptz |                                             |
| `created_at`            | timestamptz |                                             |

#### `exercises`
Baza vježbi (vlasništvo trenera).

| Polje               | Tip     | Opis                                                 |
|--------------------|---------|------------------------------------------------------|
| `id`                | uuid PK |                                                      |
| `trainer_id`        | uuid FK |                                                      |
| `name`              | text    |                                                      |
| `description`       | text    |                                                      |
| `exercise_type`     | text    | `'strength'` ili `'endurance'` (dodano migr. 20260310) |
| `primary_muscles`   | text[]  | Primarne mišićne grupe (dodano migr. 20260311)       |
| `secondary_muscles` | text[]  | Sekundarne mišićne grupe (dodano migr. 20260311)     |
| `created_at`        | timestamptz |                                                  |

#### `workout_plans`
Predlošci ili klijentski planovi treninga.

| Polje          | Tip      | Opis                                                          |
|---------------|----------|---------------------------------------------------------------|
| `id`           | uuid PK  |                                                               |
| `trainer_id`   | uuid FK  |                                                               |
| `name`         | text     |                                                               |
| `is_template`  | boolean  | `true` = u biblioteci predložaka; `false` = dodijeljen klijentu (dodano migr. 20260310) |
| `created_at`   | timestamptz |                                                            |

#### `client_workout_plans`
Dodjela plana treninga klijentu.

| Polje        | Tip         | Opis                                              |
|-------------|-------------|---------------------------------------------------|
| `id`         | uuid PK     |                                                   |
| `client_id`  | uuid FK → `clients.id` |                                  |
| `plan_id`    | uuid FK → `workout_plans.id` |                            |
| `active`     | boolean     | Je li plan trenutno aktivan                       |
| `ended_at`   | timestamptz | Kada je plan deaktiviran (dodano migr. 20260417)  |
| `created_at` | timestamptz |                                                   |

#### `meal_plans`
Predlošci ili klijentski planovi prehrane.

| Polje            | Tip     | Opis                                       |
|-----------------|---------|---------------------------------------------|
| `id`             | uuid PK |                                             |
| `trainer_id`     | uuid FK |                                             |
| `name`           | text    |                                             |
| `is_template`    | boolean | (dodano migr. 20260310)                     |
| `extras_targets` | jsonb   | Ciljevi za extras (npr. voda, kafa) (dodano migr. 20260314) |
| `created_at`     | timestamptz |                                         |

#### `client_meal_plans`
Dodjela plana prehrane klijentu.

| Polje            | Tip         | Opis                                       |
|-----------------|-------------|---------------------------------------------|
| `id`             | uuid PK     |                                             |
| `client_id`      | uuid FK → `clients.id` |                            |
| `plan_id`        | uuid FK → `meal_plans.id` |                         |
| `custom_name`    | text        | Prilagođeno ime za kopiju plana (dodano migr. 20260414) |
| `extras_targets` | jsonb       | (dodano migr. 20260314)                     |
| `active`         | boolean     |                                             |
| `created_at`     | timestamptz |                                             |

#### `recipes`
Baza recepata.

| Polje          | Tip     | Opis                                       |
|---------------|---------|---------------------------------------------|
| `id`           | uuid PK |                                             |
| `trainer_id`   | uuid FK |                                             |
| `name`         | text    |                                             |
| `total_extras` | jsonb   | Ukupni extras makronutrijenata (dodano migr. 20260314) |
| `created_at`   | timestamptz |                                         |

#### `checkins`
Tjedni check-ini klijenata.

| Polje        | Tip         | Opis                                 |
|-------------|-------------|--------------------------------------|
| `id`         | uuid PK     |                                      |
| `client_id`  | uuid FK → `clients.id` |                     |
| `trainer_id` | uuid FK → `profiles.id` |                   |
| `week_start` | date        | ISO tjedan (ponedjeljak)             |
| `date`       | date        | Datum slanja check-ina               |
| `status`     | text        | Status check-ina                     |
| `created_at` | timestamptz |                                      |

#### `checkin_parameters`
Parametri za check-in forme (konfigurira trener).

| Polje              | Tip      | Opis                                                   |
|-------------------|----------|--------------------------------------------------------|
| `id`               | uuid PK  |                                                        |
| `trainer_id`       | uuid FK  |                                                        |
| `client_id`        | uuid FK  |                                                        |
| `name`             | text     | Naziv parametra                                        |
| `type`             | text     | Tip podatka (numerički, tekst, itd.)                   |
| `show_in_overview` | boolean  | Prikazuje li se u overview karuselu (dodano migr. 20260421/20260422; default: `false`) |
| `created_at`       | timestamptz |                                                     |

#### `checkin_config`
Konfiguracija tjednog check-ina po klijentu.

| Polje          | Tip    | Opis                      |
|---------------|--------|---------------------------|
| `id`           | uuid PK |                          |
| `client_id`    | uuid FK → `clients.id` |       |
| `checkin_day`  | integer | Dan u tjednu (0=ned, 1=pon, ..., 6=sub) |

#### `packages`
Definirani paketi usluga trenera.

| Polje        | Tip         | Opis             |
|-------------|-------------|------------------|
| `id`         | uuid PK     |                  |
| `trainer_id` | uuid FK     |                  |
| `name`       | text        | Naziv paketa     |
| `sessions`   | integer     | Broj sesija      |
| `price`      | numeric     | Cijena           |
| `created_at` | timestamptz |                  |

#### `client_packages`
Aktivni paketi po klijentu.

| Polje        | Tip         | Opis                         |
|-------------|-------------|------------------------------|
| `id`         | uuid PK     |                              |
| `client_id`  | uuid FK → `clients.id` |             |
| `trainer_id` | uuid FK     |                              |
| `package_id` | uuid FK → `packages.id` |           |
| `status`     | text        | `'active'`, `'expired'`, itd.|
| `start_date` | date        |                              |
| `end_date`   | date        | Koristi se za expiry podsjetnik |
| `sessions_used` | integer  |                              |
| `created_at` | timestamptz |                              |

#### `payments`
Plaćanja klijenata.

| Polje        | Tip         | Opis                               |
|-------------|-------------|-------------------------------------|
| `id`         | uuid PK     |                                     |
| `client_id`  | uuid FK → `clients.id` |                |
| `trainer_id` | uuid FK     |                                     |
| `amount`     | numeric     | Iznos u EUR                         |
| `status`     | text        | `'pending'`, `'paid'`, itd.         |
| `created_at` | timestamptz |                                     |

#### `messages`
Chat poruke između trenera i klijenta.

| Polje        | Tip         | Opis                                            |
|-------------|-------------|--------------------------------------------------|
| `id`         | uuid PK     |                                                  |
| `trainer_id` | uuid FK     |                                                  |
| `client_id`  | uuid FK     |                                                  |
| `sender_id`  | uuid FK → `profiles.id` | Tko je poslao poruku       |
| `content`    | text        | Sadržaj poruke                                   |
| `created_at` | timestamptz |                                                  |

#### `push_subscriptions`
Web push pretplate za **trenere** (browser notifications).

| Polje        | Tip    | Opis                                  |
|-------------|--------|---------------------------------------|
| `id`         | uuid PK |                                      |
| `trainer_id` | uuid FK |                                      |
| `endpoint`   | text   | Push endpoint URL                     |
| `p256dh`     | text   | ECDH public key                       |
| `auth`       | text   | Auth secret                           |
| Unique constraint | `(trainer_id, endpoint)` |                  |

#### `expo_push_tokens`
Expo push tokeni za **klijente** (mobilne notifikacije).

| Polje        | Tip         | Opis                          |
|-------------|-------------|-------------------------------|
| `id`         | uuid PK     |                               |
| `client_id`  | uuid FK → `clients.id` | Unique constraint    |
| `token`      | text        | Expo push token (`ExponentPushToken[...]`) |
| `platform`   | text        | `'ios'` ili `'android'`       |
| `updated_at` | timestamptz |                               |

#### `client_tracked_exercises`
Vježbe koje trener prati za analitiku po klijentu (max 10).

| Polje        | Tip      | Opis                                    |
|-------------|----------|-----------------------------------------|
| `id`         | uuid PK  |                                         |
| `client_id`  | uuid FK → `clients.id` ON DELETE CASCADE |
| `exercise_id`| uuid FK → `exercises.id` ON DELETE CASCADE |
| `sort_order` | smallint |                                         |
| Unique constraint | `(client_id, exercise_id)` |               |

#### `client_tracked_checkin_parameters`
Check-in parametri prikazani u overview karuselu po klijentu (max 3).

| Polje          | Tip      | Opis                                                   |
|---------------|----------|--------------------------------------------------------|
| `id`           | uuid PK  |                                                        |
| `client_id`    | uuid FK → `clients.id` ON DELETE CASCADE |              |
| `parameter_id` | uuid FK → `checkin_parameters.id` ON DELETE CASCADE |  |
| `sort_order`   | smallint |                                                        |
| Unique constraint | `(client_id, parameter_id)` |                       |

#### `reminder_sent`
Dedupliciranje email podsjetnika (sprječava duplikate u cron jobu).

| Polje        | Tip         | Opis                                 |
|-------------|-------------|--------------------------------------|
| `id`         | uuid PK     |                                      |
| `kind`       | text        | Vrsta: `checkin`, `package_expiry`, `payment_pending` |
| `dedupe_key` | text        | Unique key (npr. `checkin-{client_id}-{date}`) |
| `created_at` | timestamptz |                                      |

#### `bug_log`
Bug tracker (koristi se u admin panelu).

| Polje        | Tip         | Opis                                      |
|-------------|-------------|-------------------------------------------|
| `id`         | uuid PK     |                                           |
| `priority`   | text        | `'visok'`, `'srednji'`, `'nizak'`         |
| `status`     | text        | `'riješen'`, itd.                         |
| `created_at` | timestamptz |                                           |

### 4.2 Relacije (ključne)

```
auth.users (Supabase)
    └── profiles (1:1, trigger)
          ├── trainer_profiles (1:1)
          ├── clients (trainer_id → profiles.id)
          │     ├── client_workout_plans → workout_plans
          │     ├── client_meal_plans → meal_plans
          │     ├── client_packages → packages
          │     ├── payments
          │     ├── checkins
          │     ├── checkin_parameters
          │     ├── checkin_config
          │     ├── client_tracked_exercises → exercises
          │     ├── client_tracked_checkin_parameters → checkin_parameters
          │     └── expo_push_tokens
          ├── subscriptions (1:1)
          ├── push_subscriptions (1:N)
          ├── exercises
          ├── workout_plans
          ├── meal_plans
          ├── recipes
          └── packages
```

### 4.3 RLS (Row Level Security) politike

> Konkretne RLS politike su postavljene direktno kroz Supabase Dashboard i nisu prisutne u migracijskim fajlovima. Jedina tablica s eksplicitnim `ENABLE ROW LEVEL SECURITY` u migraciji je `reminder_sent` (bez dodanih politika — zaključana za direktni klijentski pristup).

**Opći princip** (na temelju arhitekture koda):
- **Treneri** mogu čitati/pisati samo svoje podatke (`trainer_id = auth.uid()`)
- **Klijenti** mogu čitati samo svoje podatke (`user_id = auth.uid()`)
- **Service Role Key** (korišten u edge funkcijama i API routama) zaobilazi RLS

### 4.4 Supabase Storage bucketi

Nisu eksplicitno definirani u migracijama. Koriste se za:
- Avatari trenera i klijenata
- Progress fotografije klijenata (compare-photos ekran)

---

## 5. API & integracije

### 5.1 Next.js API routes (`coaching-app/app/api/`)

#### Registracija (`/api/register/`)

| Route                              | Metoda | Opis                                                        |
|-----------------------------------|--------|-------------------------------------------------------------|
| `/api/register/start`             | POST   | Novi flow: kreira Supabase usera + Stripe checkout session (sa 14-day trialom) |
| `/api/register`                   | POST   | Legacy flow: verifikacija Stripe sessiona + kreiranje usera + subscription zapisa |
| `/api/register/validate-session`  | POST   | Validira Stripe checkout session ID                         |

#### Billing (`/api/billing/`)

| Route                          | Metoda | Opis                                                             |
|-------------------------------|--------|------------------------------------------------------------------|
| `/api/billing/checkout`        | POST   | Kreira Stripe Checkout Session za postojeće korisnike (upgrade/downgrade) |
| `/api/billing/cancel`          | POST   | Postavlja `cancel_at_period_end = true` (ne otkazuje odmah)     |
| `/api/billing/reactivate`      | POST   | Poništava `cancel_at_period_end` (reaktivira pretplatu)         |
| `/api/billing/change-plan`     | POST   | Mijenja plan s proratonskim obračunom; blokira downgrade ako previše klijenata |
| `/api/billing/sync`            | POST   | Sinkronizira status pretplate direktno sa Stripeom              |

#### Webhooks (`/api/webhooks/`)

| Route                          | Metoda | Stripe eventi koji se slušaju                                   |
|-------------------------------|--------|-----------------------------------------------------------------|
| `/api/webhooks/stripe`         | POST   | `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`, `customer.subscription.trial_will_end` |

#### Push notifikacije (`/api/push/`)

| Route                       | Metoda  | Opis                                                             |
|----------------------------|---------|------------------------------------------------------------------|
| `/api/push/subscribe`       | POST    | Sprema web push pretplatu u `push_subscriptions`                 |
| `/api/push/subscribe`       | DELETE  | Briše web push pretplatu                                         |
| `/api/push/send`            | POST    | Šalje web push trenerima (autentificirano Bearer tokenom)        |
| `/api/push/send-internal`   | POST    | Interni endpoint za edge funkcije; autentificiran `x-push-secret` headerom |
| `/api/push/notify-client`   | POST    | Ručni podsjetnik: šalje Resend email + Expo push klijentu      |

#### Ostalo

| Route                       | Metoda | Opis                                              |
|----------------------------|--------|---------------------------------------------------|
| `/api/cron/reminders`       | GET    | Dnevni cron: check-in emaili, expiry paketa, pending plaćanja |
| `/api/delete-account`       | POST   | Hard-delete usera (Stripe cancel + Supabase deleteUser)        |

### 5.2 Supabase Edge Functions

Lokacija: `coaching-app/supabase/functions/`  
Runtime: Deno v2

| Funkcija                      | JWT  | Opis                                                              |
|------------------------------|------|-------------------------------------------------------------------|
| `create-client`               | Da   | Kreira klijenta (Supabase invite + upsert profila + clients red + invite email via Resend). Provjerava subscription limit. |
| `send-client-password-reset`  | Da   | Generira recovery link za klijenta i šalje email via Resend. Samo za korisnike s `role = 'client'`. |
| `send-push`                   | Ne   | Triggered Supabase DB webhookom; šalje web push treneru putem `/api/push/send-internal` |
| `delete-account`              | Da   | Soft-delete (označi `deletion_requested_at`); trainer → označi sve klijente; klijent → notificira trenera push notifikacijom |

### 5.3 Stripe webhook eventi

| Event                              | Akcija                                              |
|-----------------------------------|-----------------------------------------------------|
| `checkout.session.completed`       | Kreira ili ažurira `subscriptions` red              |
| `invoice.payment_succeeded`        | Ažurira period + status (samo za `active`/`trialing`) |
| `invoice.payment_failed`           | Postavlja `status = past_due`, zakazuje lock za 3 dana |
| `customer.subscription.deleted`    | Postavlja `status = canceled`                       |
| `customer.subscription.updated`    | Sinkronizira plan, status, cancel_at_period_end     |
| `customer.subscription.trial_will_end` | Log (email notifikacija planirana, ali nije implementirana) |

### 5.4 Cron job (`/api/cron/reminders`)

Raspored: svaki dan u **07:00 UTC** (konfigurirano u `vercel.json`).

Šalje 3 tipa email podsjetnika putem Resenda:

| Tip                 | Primatelj | Uvjet                                                  | Dedup ključ                              |
|--------------------|-----------|--------------------------------------------------------|------------------------------------------|
| Check-in podsjetnik | Klijent   | Danas je klijentov `checkin_day` i check-in nije poslan | `checkin-{client_id}-{date}`            |
| Paket istječe       | Trener    | `client_packages.end_date` za 7/3/1/0 dana             | `pkg-{cp_id}-d{days}-{date}`            |
| Pending plaćanja    | Trener    | Postoje `payments` s `status='pending'` (tjedni digest) | `pay-pending-{trainer_id}-{weekKey}`    |

Autentifikacija crona: `Authorization: Bearer {CRON_SECRET}` (Vercel automatski šalje).

### 5.5 Email poruke (Resend)

| Email                        | Trigger                                | Template lokacija                              |
|-----------------------------|----------------------------------------|------------------------------------------------|
| Client invite                | `create-client` edge funkcija          | `supabase/functions/_shared/client-invite-email.ts` |
| Client password reset        | `send-client-password-reset` edge funk.| `supabase/functions/_shared/client-password-recovery-email.ts` |
| Check-in podsjetnik (auto)   | Dnevni cron                            | `lib/email-checkin-reminder-html.ts`           |
| Paket istječe (auto)         | Dnevni cron                            | Inline HTML u `api/cron/reminders/route.ts`    |
| Pending plaćanja (auto)      | Dnevni cron (tjedni)                   | Inline HTML u `api/cron/reminders/route.ts`    |
| Ručni podsjetnik klijentu    | Trener klikne "Podsjeti"               | `lib/email-checkin-reminder-html.ts`           |
| Kontakt forma                | Posjetitelj marketing stranice         | Inline u `coaching-app-web/app/api/contact/route.ts` |

---

## 6. Autentifikacija & korisnici

### 6.1 Tipovi korisnika

| Tip       | Role u `profiles` | Platforma            | Kako se registriraju     |
|----------|--------------------|----------------------|--------------------------|
| Trener    | `'trainer'`        | Web (app.unitlift.com) | Samoregistracija → Stripe |
| Klijent   | `'client'`         | Mobilna app          | Trener ih poziva         |

### 6.2 Registracija trenera (flow)

```
1. Trener posjećuje /register na app.unitlift.com
2. Unosi: ime, email, lozinka, plan (starter/pro/scale)
3. POST /api/register/start:
   a. Kreira Supabase auth usera (email_confirm: true)
   b. Čeka 700ms za DB trigger (kreira profiles red)
   c. Ažurira profiles (role: 'trainer')
   d. Upsert trainer_profiles
   e. Sign in (postavlja cookie)
   f. Kreira Stripe Customer
   g. Kreira Stripe Checkout Session (14-day trial)
   h. Vraća checkout_url
4. Redirect na Stripe Checkout
5. Trener unosi podatke kartice
6. Stripe → POST /api/webhooks/stripe (checkout.session.completed)
7. Webhook kreira subscriptions red u bazi
8. Stripe redirect na /dashboard?setup=pending
```

### 6.3 Invite flow za klijente

```
1. Trener otvara "Dodaj klijenta" dialog u dashboardu
2. Unosi: ime, email, cilj, dob, težina, visina, spol, bilješke
3. Frontend POST na Supabase Edge Function: create-client
4. Edge funkcija:
   a. Provjerava subscription client_limit
   b. generateLink({ type: 'invite', email, redirectTo: 'https://app.unitlift.com/client-auth' })
   c. Čeka 500ms (trigger kreira profiles)
   d. Ažurira profiles (full_name, role: 'client')
   e. Kreira clients red
   f. Šalje invite email via Resend (HTML s "Postavi lozinku" gumbom)
5. Klijent dobiva email, klikne link → /client-auth (web)
6. Web stranica client-auth obrađuje token iz URL hasha
7. Klijent postavlja lozinku
8. U mobilnoj app: login.tsx → prijava s emailom i lozinkom
9. _layout.tsx: auth.getSession() → register push token
```

> **Napomena**: Link iz invite emaila ide na `app.unitlift.com/client-auth`, ne direktno u mobilnu app. Ovo je namjerno — web stranica obrađuje token i dopušta postavljanje lozinke. Za mobilnu app postoji alternativni deep link flow (`unitlift://set-password`).

### 6.4 Mobilni deep link flow (alternativa za password reset/invite)

```
1. Resend email sadrži link na /client-auth (web) ILI deep link unitlift://set-password
2. Ako se klikne u mobilnom browseru → otvori app (URL scheme: unitlift://)
3. _layout.tsx handleDeepLink():
   a. Parsira access_token i refresh_token iz URL hasha
   b. supabase.auth.setSession({ access_token, refresh_token })
   c. router.replace('/(auth)/set-password')
4. Klijent postavlja lozinku u mobilnoj app
```

### 6.5 Reset lozinke za trenere

Standardni Supabase Auth recovery flow:
1. Trener posjeće `/reset-password`
2. Unosi email → Supabase šalje reset email (default Supabase template)
3. Link redirecta na `/reset-password` s tokenima u URL hashu

### 6.6 Reset lozinke za klijente

Poseban custom flow (jer klijenti ne smiju biti na Supabase default template):
1. Klijent unosi email u `(auth)/forgot-password.tsx` mobilne app
2. POST na Supabase Edge Function `send-client-password-reset`
3. Edge funkcija:
   a. `generateLink({ type: 'recovery', email, redirectTo: '/client-auth' })`
   b. Provjerava da je korisnik `role = 'client'` (sigurnost)
   c. Šalje custom Resend email (branded, hrvatski/engleski)
4. Klijent klikne link → `/client-auth` (web) ili deep link u mobitelu

### 6.7 Supabase Auth postavke

- `enable_signup = true`
- `enable_anonymous_sign_ins = false`
- `enable_confirmations = false` (email potvrda nije potrebna)
- `jwt_expiry = 3600` (1 sat)
- `enable_refresh_token_rotation = true`
- MFA: isključeno (nije konfigurirano za trainere)
- Lokalni dev: `site_url = http://127.0.0.1:3000`

---

## 7. Environment varijable

### 7.1 `coaching-app` (web app za trenere)

| Varijabla                        | Obavezna | Opis                                                        |
|---------------------------------|----------|-------------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | Da       | Supabase projekt URL (javna)                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Da       | Supabase anon/public JWT ključ (javna)                      |
| `SUPABASE_SERVICE_ROLE_KEY`      | Da       | Supabase service role JWT ključ — **nikad u klijent kodu!** |
| `NEXT_PUBLIC_CLIENT_AUTH_URL`    | Da       | URL za client invite redirect (default: `https://app.unitlift.com/client-auth`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`   | Da       | VAPID javni ključ za web push (javna)                       |
| `VAPID_PRIVATE_KEY`              | Da       | VAPID privatni ključ — server only                          |
| `VAPID_EMAIL`                    | Da       | `mailto:` adresa za VAPID (npr. `mailto:info@unitlift.com`) |
| `PUSH_SECRET`                    | Da       | Dijeljeni secret između web app i edge funkcija za `/api/push/send-internal` |
| `WEBHOOK_SECRET`                 | Da       | Secret za webhook autentifikaciju                           |
| `STRIPE_SECRET_KEY`              | Da       | Stripe tajni ključ (`sk_live_...` ili `sk_test_...`)        |
| `STRIPE_WEBHOOK_SECRET`          | Da       | Stripe webhook signing secret (`whsec_...`)                 |
| `STRIPE_PRICE_STARTER`           | Da       | Stripe Price ID za Starter plan (`price_...`)               |
| `STRIPE_PRICE_PRO`               | Da       | Stripe Price ID za Pro plan (`price_...`)                   |
| `STRIPE_PRICE_SCALE`             | Da       | Stripe Price ID za Scale plan (`price_...`)                 |
| `RESEND_API_KEY`                 | Da       | Resend API ključ (`re_...`)                                 |
| `RESEND_FROM`                    | Ne       | Sender adresa (default: `UnitLift <no-reply@unitlift.com>`) |
| `CRON_SECRET`                    | Vercel   | Secret koji Vercel Cron šalje u `Authorization: Bearer` headeru |
| `REMINDER_TIMEZONE`              | Ne       | Timezone za cron (default: `Europe/Zagreb`)                 |
| `NEXT_PUBLIC_SITE_URL`           | Ne       | Javni URL (default: `https://app.unitlift.com`)             |
| `APP_URL`                        | Ne       | Interni URL app-a (koriste edge funkcije)                   |

### 7.2 `coaching-app-mobile` (Expo)

| Varijabla                       | Obavezna | Opis                                 |
|--------------------------------|----------|--------------------------------------|
| `EXPO_PUBLIC_SUPABASE_URL`      | Da       | Supabase projekt URL                 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Da       | Supabase anon ključ                  |

### 7.3 `coaching-app-admin` (admin panel)

| Varijabla                       | Obavezna | Opis                                 |
|--------------------------------|----------|--------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | Da       | Supabase URL                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Da       | Supabase anon ključ                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Da       | Supabase service role ključ          |
| `RESEND_API_KEY`                | Da       | Resend API ključ                     |
| `RESEND_FROM_EMAIL`             | Da       | Sender email adresa                  |
| `ADMIN_EMAIL`                   | Da       | Email admin korisnika                |

### 7.4 `coaching-app-web` (marketing stranica)

| Varijabla                             | Obavezna | Opis                               |
|--------------------------------------|----------|------------------------------------|
| `RESEND_API_KEY`                      | Da       | Resend API ključ (kontakt forma)   |
| `STRIPE_SECRET_KEY`                   | Da       | Stripe tajni ključ (prikaz cijena) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  | Da       | Stripe javni ključ                 |
| `STRIPE_PRICE_STARTER`                | Da       | Price ID za Starter                |
| `STRIPE_PRICE_PRO`                    | Da       | Price ID za Pro                    |
| `STRIPE_PRICE_SCALE`                  | Da       | Price ID za Scale                  |
| `NEXT_PUBLIC_APP_URL`                 | Da       | URL web app-a (za CTA gumbove)     |

### 7.5 Supabase Edge Functions

Edge Functions koriste Supabase Vault (secrets) za konfiguraciju:

| Secret                          | Opis                                                   |
|--------------------------------|--------------------------------------------------------|
| `SUPABASE_URL`                  | Automatski inject iz Supabase                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Automatski inject iz Supabase                          |
| `RESEND_API_KEY`                | Resend API ključ                                       |
| `RESEND_FROM`                   | Sender email                                           |
| `CLIENT_INVITE_EMAIL_SUBJECT`   | Subject invite emaila (opcionalno)                     |
| `CLIENT_PASSWORD_RESET_EMAIL_SUBJECT` | Subject reset emaila (opcionalno)               |
| `CLIENT_AUTH_REDIRECT_URL`      | URL za redirect (default: `https://app.unitlift.com/client-auth`) |
| `APP_URL`                       | URL web app-a (za `send-push` i `delete-account`)      |
| `PUSH_SECRET`                   | Secret za `/api/push/send-internal`                    |
| `VAPID_PUBLIC_KEY`              | VAPID javni ključ (u send-push funkciji)               |
| `VAPID_PRIVATE_KEY`             | VAPID privatni ključ                                   |
| `VAPID_EMAIL`                   | VAPID mailto adresa                                    |

---

## 8. Deployment

### 8.1 Web app (`coaching-app`) — Vercel

1. Povezi GitHub repozitorij s Vercel projektom
2. Postavi sve env varijable iz Sekcije 7.1 u Vercel Dashboard → Settings → Environment Variables
3. Build komanda: `next build` (automatski)
4. Deploy branch: `main` (auto-deploy na push)
5. Vercel Cron: konfiguriran u `vercel.json` — `/api/cron/reminders` svaki dan u 07:00

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 7 * * *"
    }
  ]
}
```

6. Stripe webhook URL (u Stripe Dashboard → Webhooks):
   `https://app.unitlift.com/api/webhooks/stripe`

### 8.2 Marketing stranica (`coaching-app-web`) — Vercel

1. Povezi repozitorij s Vercel projektom
2. Postavi env varijable iz Sekcije 7.4
3. Build komanda: `next build`
4. Deploy branch: `main`

### 8.3 Admin panel (`coaching-app-admin`) — Vercel

1. Povezi repozitorij s Vercel projektom
2. Postavi env varijable iz Sekcije 7.3
3. Ograniči pristup (Vercel Access / password protect ili IP whitelist)
4. Build komanda: `next build`

### 8.4 Mobilna app (`coaching-app-mobile`) — EAS Build

#### EAS profili (`eas.json`)

| Profil        | Tip          | Distribucija  | Opis                               |
|--------------|--------------|---------------|------------------------------------|
| `development` | Dev client   | Internal      | Za testiranje s Expo Dev Client    |
| `preview`     | Internal APK | Internal      | Preview build (Android APK)        |
| `production`  | Production   | Store         | App Store + Google Play            |

#### Build komande

```bash
# Development build
eas build --profile development --platform all

# Preview build (interno testiranje)
eas build --profile preview --platform android

# Production build
eas build --profile production --platform all
```

#### Submit na App Store (iOS)

```bash
eas submit --platform ios --profile production
```

Konfiguracija (`eas.json`):
- Apple ID: `leon@unitlift.com`
- ASC App ID: `6761137784`
- Apple Team ID: `UYM7Z9A956`

#### Submit na Google Play (Android)

```bash
eas submit --platform android --profile production
```

Konfiguracija:
- Service Account Key: `./google-play-service-account.json`
- Track: `production`
- Package: `com.unitlift.app`

#### Konfiguracija app.json

| Ključ               | Vrijednost                                 |
|--------------------|---------------------------------------------|
| `expo.name`         | UnitLift                                   |
| `expo.slug`         | unitlift                                   |
| `expo.version`      | 1.0.1                                      |
| `expo.owner`        | leonlis                                    |
| `ios.bundleIdentifier` | com.unitlift.app                        |
| `android.package`   | com.unitlift.app                           |
| `extra.eas.projectId` | 76cf0e6f-752a-4e4a-9f34-3b0f479c19e2    |
| `scheme`            | unitlift (deep link URL scheme)            |

### 8.5 Supabase migracije

```bash
# Povezi lokalni projekt s remote
supabase link --project-ref nvlrlubvxelrwdzggmno

# Primijeni migracije na remote bazu
supabase db push

# Deploy edge funkcija
supabase functions deploy create-client
supabase functions deploy send-client-password-reset
supabase functions deploy send-push
supabase functions deploy delete-account
```

---

## 9. Lokalni razvoj

### 9.1 Preduvjeti

| Alat            | Verzija          | Napomena                           |
|----------------|------------------|-------------------------------------|
| Node.js         | ^20.x            | Provjeriti s `node -v`             |
| npm             | ^10.x            | Dolazi s Node.js                   |
| Supabase CLI    | >= latest        | `npm install -g supabase`          |
| Deno            | ^2.x             | Za lokalne edge funkcije           |
| Expo CLI / EAS  | >= 16.0.0        | `npm install -g eas-cli`           |
| Git             | bilo koja        |                                    |

### 9.2 Pokretanje web app (`coaching-app`) lokalno

```bash
# 1. Clone repozitorija
git clone <repo-url> coaching-app
cd coaching-app

# 2. Instaliraj ovisnosti
npm install

# 3. Kopiraj env varijable
cp .env.local.example .env.local
# (Ili zatraži .env.local od kolege/1Password)

# 4. Popuni .env.local s pravim vrijednostima
# Minimalno potrebno za lokalni dev:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*
# - NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
# - PUSH_SECRET
# - RESEND_API_KEY

# 5. Pokretanje dev servera
npm run dev
# → http://localhost:3000
```

### 9.3 Pokretanje mobilne app (`coaching-app-mobile`) lokalno

```bash
cd coaching-app-mobile

npm install

# .env već sadrži Supabase URL i anon key — ne treba mijenjati za dev

# Pokretanje Expo dev servera
npm start
# ili
npx expo start

# Za iOS simulator
npm run ios

# Za Android emulator
npm run android
```

> Za push notifikacije potreban je fizički uređaj i produkcijski EAS build.

### 9.4 Lokalni Supabase (opcjonalno)

```bash
# Unutar coaching-app direktorija
supabase start
# → Pokreće lokalni Postgres + Auth + Studio na http://localhost:54323

supabase db reset
# Primijeni sve migracije lokalno
```

### 9.5 Česte greške i rješenja

| Greška | Uzrok | Rješenje |
|-------|-------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` nije pronađen | .env.local nije kopiran | Provjeri `coaching-app/.env.local` |
| Stripe webhook ne radi lokalno | Stripe ne može dosegnuti localhost | Koristi Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| Push notifikacije ne rade u dev | VAPID keys nisu postavljene | Kopiraj VAPID_PRIVATE_KEY i NEXT_PUBLIC_VAPID_PUBLIC_KEY iz produkcijskog .env |
| Edge funkcija `create-client` vraća 500 | `RESEND_API_KEY` nije postavljen u Supabase Vault | Postavi secret u Supabase Dashboard → Edge Functions → Secrets |
| Mobilna app ne pamti session | Simulator umjesto fizičkog uređaja | expo-secure-store zahtijeva fizički uređaj, ili koristiti `Platform.OS === 'web'` fallback |
| `Next.js: module not found` | Stari node_modules | `rm -rf node_modules && npm install` |
| `supabase db push` failira | Migracija nije kompatibilna s remote shemom | Provjeri `supabase db diff` i ručno izvedi potrebne izmjene |
| Cron ne okida lokalno | `CRON_SECRET` nije postavljen | U dev možeš pozvati direktno: `GET http://localhost:3000/api/cron/reminders` |

---

## 10. Poznati problemi & TODO

### 10.1 Nedovršeno / poznati bugovi

1. ~~**`push_tokens` vs `expo_push_tokens` nekonzistentnost**~~  
   ✅ **ISPRAVLJENO** — `supabase/functions/delete-account/index.ts` ažuriran da koristi `expo_push_tokens` s filtrom `client_id` (umjesto `push_tokens` / `user_id`).

2. **Inicijalna schema migracija je prazna**  
   `20260302121637_remote_schema.sql` je prazan fajl — cijeli inicijalni schema je kreiran direktno kroz Supabase Studio. To znači da lokalni `supabase db reset` neće reproducirati punu shemu bez ručnog izvoza iz produkcije.

3. **RLS politike nisu u kodu**  
   Nema SQL fajlova koji definiraju RLS politike. Sve je konfigurirano u Supabase Dashboardu. Ako se baza resetira, sve RLS politike se gube.

4. ~~**`customer.subscription.trial_will_end` webhook ne šalje email**~~  
   ✅ **ISPRAVLJENO** — Handler u `app/api/webhooks/stripe/route.ts` sada traži trenerov profil po `stripe_customer_id` i šalje branded Resend email s brojem dana do kraja triala i linkom na `/dashboard/billing`.

5. **Admin panel MFA nije obavezan**  
   `/api/auth/setup-mfa` i `/api/auth/verify-mfa` postoje, ali nije jasno je li MFA obavezan za sve admin korisnike ili opcionalan.

6. ~~**`expo_push_tokens` tablica nije u migracijama**~~  
   ✅ **ISPRAVLJENO** — Kreirana migracija `20260424000001_expo_push_tokens.sql` s kompletnom definicijom tablice, RLS politikom i indeksom.

7. **Trial abuse zaštita nije savršena**  
   Provjera `hasHadTrialBefore` ovisi o Stripe customer-u pronađenom po emailu — korisnik može koristiti novi email za novi trial.

### 10.2 Što treba napraviti za produkcijsku stabilnost

1. **Dodati kompletni inicijalni schema SQL u migracije**  
   Izvesti trenutno stanje baze: `supabase db dump --schema public > supabase/migrations/00000000000000_initial_schema.sql`

2. **Dodati RLS politike u SQL migracije**  
   Izvesti sve politike iz produkcije i dodati u zasebnu migracijsku datoteku.

3. ~~**Kreirati `expo_push_tokens` migraciju**~~ ✅ **ISPRAVLJENO**

4. ~~**Unificirati `push_tokens` → `expo_push_tokens`**~~ ✅ **ISPRAVLJENO**

5. ~~**Implementirati trial will end email**~~ ✅ **ISPRAVLJENO**

6. **Dodati monitoring i error tracking**  
   Razmotriti Sentry za Next.js i mobilnu app.

7. ~~**Service Worker (`/sw.js`) nije u kodu**~~  
   ✅ **LAŽNI POZITIV** — `/public/sw.js` postoji i pravilno implementira `push`, `notificationclick` i `activate` handlere.

8. **Google Analytics**  
   Nije pronađena implementacija Google Analyticsa u kodu (nije u package.json, nema GA script u layout.tsx).

9. **Backup baze podataka**  
   Supabase nudi Point-in-Time Recovery — provjeriti je li aktivirano u produkcijskom projektu.

10. **Produkcijski Stripe ključevi**  
    Trenutne vrijednosti u `.env.local` su test ključevi (`sk_test_...`). Prije produkcijskog launcha zamijeniti s live ključevima i ažurirati webhook signing secret.

---

*Dokumentacija generirana analizom cijelog codebasea projekata `coaching-app`, `coaching-app-mobile`, `coaching-app-admin` i `coaching-app-web`.*
