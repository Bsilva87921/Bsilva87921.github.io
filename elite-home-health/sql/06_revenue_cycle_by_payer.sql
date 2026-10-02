-- 06 Revenue cycle by payer: billed, denial rate and days in AR, first vs latest quarter.
WITH q AS (
  SELECT payer,
         CASE WHEN month BETWEEN '2024-10' AND '2024-12' THEN 'Q4 2024'
              WHEN month BETWEEN '2026-07' AND '2026-09' THEN 'Q3 2026' END AS quarter,
         SUM(billed) AS billed, SUM(denied) AS denied
  FROM fact_service_month
  WHERE month BETWEEN '2024-10' AND '2024-12' OR month BETWEEN '2026-07' AND '2026-09'
  GROUP BY payer, quarter
), a AS (
  SELECT payer,
         CASE WHEN month BETWEEN '2024-10' AND '2024-12' THEN 'Q4 2024'
              WHEN month BETWEEN '2026-07' AND '2026-09' THEN 'Q3 2026' END AS quarter,
         AVG(ar_days) AS ar_days
  FROM fact_ar_month
  WHERE month BETWEEN '2024-10' AND '2024-12' OR month BETWEEN '2026-07' AND '2026-09'
  GROUP BY payer, quarter
)
SELECT p.name AS payer, q.quarter,
       ROUND(q.billed)                           AS billed,
       ROUND(100.0 * q.denied / q.billed, 1)     AS denial_rate_pct,
       ROUND(a.ar_days, 1)                       AS ar_days
FROM q JOIN a USING (payer, quarter) JOIN dim_payer p USING (payer)
ORDER BY p.name, q.quarter DESC;
