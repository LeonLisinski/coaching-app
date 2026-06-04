-- =============================================================================
-- Performance refactor: document all app-level query optimizations
--
-- DB change: get_dashboard_finance_stats RPC (already applied in 20260605000008)
-- This migration ensures the migration history is complete.
-- =============================================================================

-- Verify the RPC exists and is accessible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_dashboard_finance_stats'
  ) THEN
    RAISE EXCEPTION 'get_dashboard_finance_stats RPC not found — run 20260605000008 first';
  END IF;
END;
$$;

-- Add index on payments.paid_at to speed up the monthly aggregation in the RPC
-- (paid_at is queried with range conditions for each month)
CREATE INDEX IF NOT EXISTS idx_payments_trainer_paid_at
  ON public.payments (trainer_id, paid_at)
  WHERE paid_at IS NOT NULL;

-- Add index on client_packages.start_date for the RPC's date range queries
CREATE INDEX IF NOT EXISTS idx_client_packages_trainer_start_date
  ON public.client_packages (trainer_id, start_date)
  WHERE status = 'active';
