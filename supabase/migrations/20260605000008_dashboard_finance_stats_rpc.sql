-- =============================================================================
-- get_dashboard_finance_stats(p_trainer_id)
--
-- Replaces the client dashboard home-page query:
--   client_packages.limit(2000) with payments(id,status,amount,paid_at)
-- which was fetching every package + payment record into JavaScript for
-- client-side aggregation.
--
-- Returns all stats the home page needs in a single DB round trip:
--   stats            — monthly stat cards + late/expiring counts
--   monthly_chart    — last 6 months bar chart data
--   expiring_packages — packages expiring within 7 days (with pkg name)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_finance_stats(p_trainer_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_now         date := current_date;
  v_month_start date := date_trunc('month', v_now)::date;
  v_month_end   date := (date_trunc('month', v_now + interval '1 month') - interval '1 day')::date;
  v_year_start  date := date_trunc('year', v_now)::date;
  v_6mo_start   date := (date_trunc('month', v_now) - interval '5 months')::date;
BEGIN
  RETURN (
    WITH pkg AS (
      -- Only fetch packages relevant to the dashboard:
      -- active packages OR packages that started in the last 6 months (for chart history)
      SELECT
        cp.id,
        cp.client_id,
        cp.start_date::date          AS start_date,
        cp.end_date::date            AS end_date,
        cp.price,
        cp.status,
        pk.name                      AS package_name,
        -- Only one paid payment per package (UNIQUE constraint on client_package_id in most setups)
        (SELECT p2.amount  FROM public.payments p2 WHERE p2.client_package_id = cp.id AND p2.status = 'paid' LIMIT 1) AS paid_amount,
        (SELECT p2.paid_at FROM public.payments p2 WHERE p2.client_package_id = cp.id AND p2.status = 'paid' LIMIT 1) AS paid_at
      FROM public.client_packages cp
      LEFT JOIN public.packages pk ON pk.id = cp.package_id
      WHERE cp.trainer_id = p_trainer_id
        AND (
          cp.status = 'active'
          OR cp.start_date >= v_6mo_start
        )
    ),
    stats AS (
      SELECT
        -- Collected this month: payments whose paid_at falls in current month
        COALESCE(SUM(CASE
          WHEN paid_at IS NOT NULL
           AND paid_at::date >= v_month_start
           AND paid_at::date <= v_month_end
          THEN COALESCE(paid_amount, price) END), 0)::numeric AS collected_month,

        -- Expected this month: packages starting this month, active, not yet paid
        COALESCE(SUM(CASE
          WHEN start_date >= v_month_start AND start_date <= v_month_end
           AND status = 'active' AND paid_amount IS NULL
          THEN price END), 0)::numeric AS expected_month,

        -- Paid-by-start: packages starting this month that ARE paid
        COALESCE(SUM(CASE
          WHEN start_date >= v_month_start AND start_date <= v_month_end
           AND paid_amount IS NOT NULL
          THEN COALESCE(paid_amount, price) END), 0)::numeric AS paid_by_start,

        -- YTD revenue: all paid payments this year
        COALESCE(SUM(CASE
          WHEN paid_at IS NOT NULL AND paid_at::date >= v_year_start
          THEN COALESCE(paid_amount, price) END), 0)::numeric AS ytd_revenue,

        -- Late: active packages past end_date without payment
        COUNT(CASE WHEN status = 'active' AND end_date < v_now AND paid_amount IS NULL THEN 1 END)::int AS late_payments_count
      FROM pkg
    ),
    chart AS (
      -- Last 6 months bar chart: naplaceno (collected) + ocekivano (expected, unpaid active)
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

-- Only callable by the authenticated user (invoker security — RLS applies)
GRANT EXECUTE ON FUNCTION public.get_dashboard_finance_stats(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_finance_stats(uuid) FROM PUBLIC;
