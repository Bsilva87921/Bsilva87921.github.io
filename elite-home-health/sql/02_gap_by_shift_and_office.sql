-- 02 Where is the gap? Fill rate by office and shift for the last 12 months (heat-map ready).
SELECT o.name                                                              AS office,
       s.name                                                              AS shift,
       ROUND(SUM(f.authorized_hours))                                      AS authorized_hours,
       ROUND(100.0 * SUM(f.delivered_hours) / SUM(f.authorized_hours), 1)  AS fill_rate_pct,
       ROUND(SUM(f.authorized_hours - f.delivered_hours))                  AS unfilled_hours,
       ROUND(100.0 * SUM(f.authorized_hours - f.delivered_hours)
             / (SELECT SUM(authorized_hours - delivered_hours) FROM fact_service_month WHERE month >= '2025-10'), 1) AS share_of_gap_pct
FROM fact_service_month f
JOIN dim_office o USING (office)
JOIN dim_shift  s USING (shift)
WHERE f.month >= '2025-10'
GROUP BY o.name, s.name
ORDER BY unfilled_hours DESC;
