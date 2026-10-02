-- 01 How big is the hours gap? Authorized vs delivered hours and the revenue left on the table, by year.
-- Unfilled hours are valued at the average billed rate per delivered hour for the same payer and service.
WITH rates AS (
  SELECT payer, service, SUM(billed) * 1.0 / SUM(delivered_hours) AS rate_per_hour
  FROM fact_service_month GROUP BY payer, service
)
SELECT substr(f.month, 1, 4)                                              AS year,
       ROUND(SUM(f.authorized_hours))                                     AS authorized_hours,
       ROUND(SUM(f.delivered_hours))                                      AS delivered_hours,
       ROUND(100.0 * SUM(f.delivered_hours) / SUM(f.authorized_hours), 1) AS fill_rate_pct,
       ROUND(SUM(f.authorized_hours - f.delivered_hours))                 AS unfilled_hours,
       ROUND(SUM((f.authorized_hours - f.delivered_hours) * r.rate_per_hour)) AS unbilled_revenue
FROM fact_service_month f
JOIN rates r USING (payer, service)
GROUP BY year
ORDER BY year;
