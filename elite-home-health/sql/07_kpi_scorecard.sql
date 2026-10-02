-- 07 Office KPI scorecard, last 3 months (the dashboard's scorecard table, written in SQL).
WITH s AS (
  SELECT office, SUM(authorized_hours) auth, SUM(delivered_hours) deliv, SUM(billed) billed,
         SUM(labor_cost) labor, SUM(visits) visits, SUM(missed_visits) missed, SUM(late_visits) late, SUM(evv_verified) evv
  FROM fact_service_month WHERE month >= '2026-07' GROUP BY office
), w AS (
  SELECT office, SUM(terms) terms, SUM(terms_90d) t90, SUM(headcount) head FROM fact_workforce_month WHERE month >= '2026-07' GROUP BY office
), q AS (
  SELECT office, SUM(survey_top_box) top, SUM(survey_responses) resp FROM fact_quality_month WHERE month >= '2026-07' GROUP BY office
)
SELECT o.name AS office,
       ROUND(100.0 * deliv / auth, 1)                 AS fill_rate_pct,
       ROUND(100.0 * missed / (visits + missed), 1)   AS missed_visit_pct,
       ROUND(100.0 * evv / visits, 1)                 AS evv_compliance_pct,
       ROUND(1200.0 * terms / head, 0)                 AS turnover_annual_pct,
       ROUND(100.0 * t90 / terms, 0)                  AS share_leaving_in_90d_pct,
       ROUND((billed - labor) / deliv, 2)             AS gross_margin_per_hour,
       ROUND(100.0 * top / resp, 1)                   AS client_satisfaction_pct
FROM s JOIN w USING (office) JOIN q USING (office) JOIN dim_office o USING (office)
ORDER BY fill_rate_pct DESC;
