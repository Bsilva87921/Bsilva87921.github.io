-- 04 Did the Greenfield 90-day mentor pilot (from April 2026) work? Difference-in-differences:
-- change in Greenfield (pilot) minus change in the other offices, six months before vs six months after.
WITH office_month AS (
  SELECT w.month, w.office,
         CASE WHEN w.office = 'GRN' THEN 'Pilot (Greenfield)' ELSE 'Comparison offices' END AS grp,
         CASE WHEN w.month >= '2026-04' THEN 'after' ELSE 'before' END                    AS period,
         1200.0 * w.terms_90d / w.headcount                                                AS early_turnover,
         (SELECT SUM(delivered_hours) * 100.0 / SUM(authorized_hours)
            FROM fact_service_month s WHERE s.month = w.month AND s.office = w.office)     AS fill_rate
  FROM fact_workforce_month w
  WHERE w.month BETWEEN '2025-10' AND '2026-09'
)
SELECT grp, period,
       ROUND(AVG(early_turnover), 1) AS early_turnover_annual_pct,
       ROUND(AVG(fill_rate), 2)      AS fill_rate_pct
FROM office_month
GROUP BY grp, period
ORDER BY grp DESC, period DESC;
