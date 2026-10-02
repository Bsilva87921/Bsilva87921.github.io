-- 03 Does early caregiver turnover explain the gap? Office-months: 90-day turnover (annualized) next to fill rate.
-- The case study fits a regression on this result set.
WITH fill AS (
  SELECT month, office,
         SUM(delivered_hours) * 1.0 / SUM(authorized_hours) AS fill_rate
  FROM fact_service_month GROUP BY month, office
)
SELECT w.month, w.office,
       ROUND(1200.0 * w.terms     / w.headcount, 1) AS turnover_annual_pct,
       ROUND(1200.0 * w.terms_90d / w.headcount, 1) AS early_turnover_annual_pct,
       ROUND(100.0 * f.fill_rate, 2)                AS fill_rate_pct,
       w.mentor_program
FROM fact_workforce_month w
JOIN fill f USING (month, office)
ORDER BY w.month, w.office;
