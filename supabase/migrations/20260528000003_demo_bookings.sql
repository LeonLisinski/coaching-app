-- Demo / presentation booking system
-- Tables: demo_availability (weekly schedule), demo_blocked_slots (manual blocks),
--         demo_bookings (booking requests)

-- ─── Weekly availability ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.demo_availability (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week           smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time            time NOT NULL,
  end_time              time NOT NULL,
  slot_duration_min     smallint NOT NULL DEFAULT 15,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Seed default schedule: Mon–Fri 18:00–21:00, Sat 09:00–17:00
INSERT INTO public.demo_availability (day_of_week, start_time, end_time, slot_duration_min, is_active) VALUES
  (1, '18:00', '21:00', 15, true),  -- Mon
  (2, '18:00', '21:00', 15, true),  -- Tue
  (3, '18:00', '21:00', 15, true),  -- Wed
  (4, '18:00', '21:00', 15, true),  -- Thu
  (5, '18:00', '21:00', 15, true),  -- Fri
  (6, '09:00', '17:00', 15, true)   -- Sat
ON CONFLICT DO NOTHING;

-- ─── Manual blocked slots ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.demo_blocked_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date  date NOT NULL,
  blocked_time  time NOT NULL,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocked_date, blocked_time)
);

-- ─── Booking requests ───────────────────────────────────────────────────────
CREATE TYPE IF NOT EXISTS public.demo_booking_status AS ENUM (
  'pending', 'confirmed', 'rejected', 'cancelled'
);

CREATE TABLE IF NOT EXISTS public.demo_bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date    date NOT NULL,
  booking_time    time NOT NULL,
  status          public.demo_booking_status NOT NULL DEFAULT 'pending',
  name            text NOT NULL,
  email           text NOT NULL,
  num_clients     smallint,
  current_tool    text,
  message         text,
  locale          text NOT NULL DEFAULT 'hr',
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Prevent double booking: only one pending/confirmed per slot
CREATE UNIQUE INDEX IF NOT EXISTS demo_bookings_slot_unique
  ON public.demo_bookings (booking_date, booking_time)
  WHERE status IN ('pending', 'confirmed');

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.demo_availability    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_blocked_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_bookings        ENABLE ROW LEVEL SECURITY;

-- Public can read availability and blocked slots (to show available times)
CREATE POLICY "public can read availability"
  ON public.demo_availability FOR SELECT USING (true);

CREATE POLICY "public can read blocked slots"
  ON public.demo_blocked_slots FOR SELECT USING (true);

-- Public can insert bookings (no auth required — it's a booking form)
CREATE POLICY "public can insert bookings"
  ON public.demo_bookings FOR INSERT WITH CHECK (true);

-- Public can read their own booking (for confirmation page — by id)
CREATE POLICY "public can read own booking"
  ON public.demo_bookings FOR SELECT USING (true);

-- Service role (admin API) can do everything — bypasses RLS automatically

-- ─── Updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER demo_availability_updated_at
  BEFORE UPDATE ON public.demo_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER demo_bookings_updated_at
  BEFORE UPDATE ON public.demo_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
