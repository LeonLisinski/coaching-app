-- =============================================================
-- Fix get_dashboard_finance_stats: chart CTE used nested
-- aggregate functions (SUM inside json_build_object inside json_agg
-- without GROUP BY) → PostgreSQL raises "aggregate function calls
-- cannot be nested", causing HTTP 400 for trainers with packages.
--
-- Fix: pre-aggregate per month in a subquery with GROUP BY, then
-- json_agg the already-aggregated rows (no nesting).
-- =============================================================

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
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL AND paid_at >= v_month_start AND paid_at <= v_month_end THEN COALESCE(paid_amount, price) END), 0)::numeric AS collected_month,
        COALESCE(SUM(CASE WHEN start_date >= v_month_start AND start_date <= v_month_end AND status = 'active' AND paid_amount IS NULL THEN price END), 0)::numeric AS expected_month,
        COALESCE(SUM(CASE WHEN start_date >= v_month_start AND start_date <= v_month_end AND paid_amount IS NOT NULL THEN COALESCE(paid_amount, price) END), 0)::numeric AS paid_by_start,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL AND paid_at >= v_year_start THEN COALESCE(paid_amount, price) END), 0)::numeric AS ytd_revenue,
        COUNT(CASE WHEN status = 'active' AND end_date < v_now AND paid_amount IS NULL THEN 1 END)::int AS late_payments_count
      FROM pkg
    ),
    -- Pre-aggregate per month first, then json_agg the results.
    -- Previous version nested SUM() inside json_build_object() inside json_agg()
    -- without GROUP BY → "aggregate function calls cannot be nested" (PG error → HTTP 400).
    monthly AS (
      SELECT
        m.month_start,
        to_char(m.month_start, 'Mon YY') AS month_label,
        COALESCE(SUM(CASE
          WHEN p.paid_at IS NOT NULL
           AND p.paid_at >= m.month_start
           AND p.paid_at <= m.month_end
          THEN COALESCE(p.paid_amount, p.price) END), 0) AS naplaceno,
        COALESCE(SUM(CASE
          WHEN p.start_date >= m.month_start
           AND p.start_date <= m.month_end
           AND p.status = 'active'
           AND p.paid_amount IS NULL
          THEN p.price END), 0) AS fakturirano
      FROM (
        SELECT
          gs::date AS month_start,
          (gs + interval '1 month' - interval '1 day')::date AS month_end
        FROM generate_series(v_6mo_start, v_month_start, interval '1 month') gs
      ) m
      LEFT JOIN pkg p ON TRUE
      GROUP BY m.month_start, m.month_end
    ),
    chart AS (
      SELECT json_agg(
        json_build_object(
          'month',       month_label,
          'naplaceno',   naplaceno,
          'fakturirano', fakturirano
        )
        ORDER BY month_start
      ) AS data
      FROM monthly
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

GRANT EXECUTE ON FUNCTION public.get_dashboard_finance_stats(uuid) TO authenticated;
