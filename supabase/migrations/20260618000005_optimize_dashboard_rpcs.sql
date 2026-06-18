-- =============================================================
-- Optimize dashboard RPCs:
--   1. get_dashboard_finance_stats → SECURITY DEFINER + replace
--      2 correlated subqueries per package with single LEFT JOIN
--   2. get_trainer_last_checkins   → SECURITY DEFINER
--   3. get_client_checkin_counts   → remove unnecessary JOIN
-- All three had RLS evaluated for every row, causing 5s+ loads.
-- =============================================================

-- 1. Fix get_dashboard_finance_stats
--    Before: 2 correlated subqueries × N packages + RLS per row
--    After:  single LEFT JOIN, SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION public.get_dashboard_finance_stats(p_trainer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         date := current_date;
  v_month_start date := date_trunc('month', v_now)::date;
  v_month_end   date := (date_trunc('month', v_now + interval '1 month') - interval '1 day')::date;
  v_year_start  date := date_trunc('year', v_now)::date;
  v_6mo_start   date := (date_trunc('month', v_now) - interval '5 months')::date;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_trainer_id THEN
    RETURN NULL;
  END IF;

  RETURN (
    WITH pkg AS (
      SELECT
        cp.id,
        cp.client_id,
        cp.start_date::date  AS start_date,
        cp.end_date::date    AS end_date,
        cp.price,
        cp.status,
        pk.name              AS package_name,
        p_paid.amount        AS paid_amount,
        p_paid.paid_at       AS paid_at
      FROM public.client_packages cp
      LEFT JOIN public.packages pk
        ON pk.id = cp.package_id
      LEFT JOIN public.payments p_paid
        ON p_paid.client_package_id = cp.id
       AND p_paid.status = 'paid'
      WHERE cp.trainer_id = p_trainer_id
        AND (
          cp.status = 'active'
          OR cp.start_date >= v_6mo_start
        )
    ),
    stats AS (
      SELECT
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL AND paid_at::date >= v_month_start AND paid_at::date <= v_month_end THEN COALESCE(paid_amount, price) END), 0)::numeric AS collected_month,
        COALESCE(SUM(CASE WHEN start_date >= v_month_start AND start_date <= v_month_end AND status = 'active' AND paid_amount IS NULL THEN price END), 0)::numeric AS expected_month,
        COALESCE(SUM(CASE WHEN start_date >= v_month_start AND start_date <= v_month_end AND paid_amount IS NOT NULL THEN COALESCE(paid_amount, price) END), 0)::numeric AS paid_by_start,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL AND paid_at::date >= v_year_start THEN COALESCE(paid_amount, price) END), 0)::numeric AS ytd_revenue,
        COUNT(CASE WHEN status = 'active' AND end_date < v_now AND paid_amount IS NULL THEN 1 END)::int AS late_payments_count
      FROM pkg
    ),
    chart AS (
      SELECT
        json_agg(
          json_build_object(
            'month',       to_char(m.month_start, 'Mon YY'),
            'naplaceno',   COALESCE(SUM(CASE WHEN p.paid_at::date >= m.month_start AND p.paid_at::date <= m.month_end THEN COALESCE(p.paid_amount, p.price) END), 0),
            'fakturirano', COALESCE(SUM(CASE WHEN p.start_date >= m.month_start AND p.start_date <= m.month_end AND p.status = 'active' AND p.paid_amount IS NULL THEN p.price END), 0)
          )
          ORDER BY m.month_start
        ) AS data
      FROM (
        SELECT
          gs::date AS month_start,
          (gs + interval '1 month' - interval '1 day')::date AS month_end
        FROM generate_series(v_6mo_start, v_month_start, interval '1 month') gs
      ) m
      CROSS JOIN pkg p
    ),
    expiring AS (
      SELECT json_agg(
        json_build_object(
          'id',        p.id,
          'client_id', p.client_id,
          'pkg_name',  COALESCE(p.package_name, '—'),
          'end_date',  p.end_date,
          'days_left', (p.end_date - v_now)
        )
        ORDER BY p.end_date
      ) AS data
      FROM pkg p
      WHERE p.status = 'active'
        AND p.end_date >= v_now
        AND p.end_date <= v_now + 7
    )
    SELECT json_build_object(
      'stats',             row_to_json(s),
      'monthly_chart',     COALESCE(c.data, '[]'::json),
      'expiring_packages', COALESCE(e.data, '[]'::json)
    )
    FROM stats s, chart c, expiring e
  );
END;
$$;

-- 2. Fix get_trainer_last_checkins → SECURITY DEFINER
--    Before: SECURITY INVOKER — RLS re-evaluated for every checkin row
--    After:  SECURITY DEFINER + explicit auth guard
CREATE OR REPLACE FUNCTION public.get_trainer_last_checkins(p_trainer_id uuid)
RETURNS TABLE(client_id uuid, last_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_trainer_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (c.client_id)
    c.client_id,
    c.date AS last_date
  FROM checkins c
  WHERE c.trainer_id = p_trainer_id
  ORDER BY c.client_id, c.date DESC;
END;
$$;

-- 3. Fix get_client_checkin_counts — remove unnecessary JOIN to clients
--    Before: INNER JOIN clients cl ON cl.id = ch.client_id WHERE cl.trainer_id = ...
--    After:  direct WHERE trainer_id = trainer_user_id (checkins already has trainer_id)
CREATE OR REPLACE FUNCTION public.get_client_checkin_counts(trainer_user_id uuid)
RETURNS TABLE(client_id uuid, checkin_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM trainer_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ch.client_id, COUNT(*)::bigint AS checkin_count
  FROM checkins ch
  WHERE ch.trainer_id = trainer_user_id
  GROUP BY ch.client_id;
END;
$$;

-- Grant execute to authenticated users (same as before)
GRANT EXECUTE ON FUNCTION public.get_dashboard_finance_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_last_checkins(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_checkin_counts(uuid)   TO authenticated;

-- Missing index: payments by client_package_id + status (used in LEFT JOIN above)
CREATE INDEX IF NOT EXISTS idx_payments_pkg_status
  ON public.payments (client_package_id, status);
