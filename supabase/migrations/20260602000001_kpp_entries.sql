-- ── KPP (Knjiga primitaka i prihoda) ─────────────────────────────────────────
-- Croatian income/revenue register required for freelancers and small businesses.
-- Admin-only table: no client or trainer can read or write rows.

CREATE TABLE IF NOT EXISTS kpp_entries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sequential number per calendar year, format "YY-NNN-01" e.g. "26-001-01"
  rbr             text        NOT NULL,

  -- Human-readable invoice/receipt number, format "UL-YY-NNN" e.g. "UL-26-001"
  broj_racuna     text        NOT NULL,

  -- Buyer details
  kupac           text        NOT NULL,
  oib_kupca       text,                    -- null for private persons
  buyer_type      text        NOT NULL DEFAULT 'private'
                              CHECK (buyer_type IN ('private', 'business')),

  -- Entry details
  opis            text        NOT NULL,
  nacin_placanja  text        NOT NULL DEFAULT 'kartica'
                              CHECK (nacin_placanja IN ('kartica', 'gotovina', 'transakcijski', 'ostalo')),
  iznos           numeric(10,2) NOT NULL,  -- EUR
  datum           date        NOT NULL DEFAULT CURRENT_DATE,
  kategorija      text        NOT NULL DEFAULT 'ostalo'
                              CHECK (kategorija IN ('app', 'ostalo')),

  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Optional link to Stripe payment intent / invoice (for auto-created entries)
  stripe_payment_id text      UNIQUE,

  CONSTRAINT kpp_oib_business CHECK (
    buyer_type = 'private' OR (buyer_type = 'business' AND oib_kupca IS NOT NULL)
  )
);

-- Only super-admin service role may touch this table (no public policies)
ALTER TABLE kpp_entries ENABLE ROW LEVEL SECURITY;

-- Deny all access via public PostgREST by default (service role bypasses RLS)
-- No explicit policies = deny all

-- Index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_kpp_entries_datum         ON kpp_entries (datum DESC);
CREATE INDEX IF NOT EXISTS idx_kpp_entries_kategorija    ON kpp_entries (kategorija);
CREATE INDEX IF NOT EXISTS idx_kpp_entries_stripe        ON kpp_entries (stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;

-- ── Helper: next sequential number for the given year ─────────────────────────
-- Returns e.g. 42 if there are already 41 rows for year 2026.
CREATE OR REPLACE FUNCTION next_kpp_seq(p_year int DEFAULT EXTRACT(YEAR FROM now())::int)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    MAX(
      (regexp_match(rbr, E'^\\d{2}-(\\d+)-'))[1]::int
    ), 0
  ) + 1
  FROM kpp_entries
  WHERE rbr LIKE (LPAD((p_year % 100)::text, 2, '0') || '-%')
$$;
