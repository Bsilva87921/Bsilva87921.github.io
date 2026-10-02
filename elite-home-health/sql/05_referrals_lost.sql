-- 05 What does the gap cost in growth? Referrals lost because no caregiver was available, last 12 months.
SELECT o.name                                                          AS office,
       SUM(r.referrals)                                                AS referrals,
       ROUND(100.0 * SUM(r.admissions) / SUM(r.referrals), 1)          AS admit_rate_pct,
       SUM(r.lost_no_caregiver)                                        AS lost_no_caregiver,
       ROUND(100.0 * SUM(r.lost_no_caregiver) / SUM(r.referrals), 1)   AS lost_no_caregiver_pct,
       ROUND(SUM(r.days_to_start_sum) / SUM(r.admissions), 1)          AS avg_days_to_start
FROM fact_referrals_month r
JOIN dim_office o USING (office)
WHERE r.month >= '2025-10'
GROUP BY o.name
ORDER BY lost_no_caregiver_pct DESC;
