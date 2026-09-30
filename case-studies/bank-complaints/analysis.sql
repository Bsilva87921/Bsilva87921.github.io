-- Florida checking & savings complaints, CFPB Consumer Complaint Database (Jan 2023 - Sep 2026)
-- Table `complaints` is loaded from the CFPB CSV export by etl.py (SQLite).

-- name: data_checks
-- Row count, duplicate IDs, missing sub-issues, date range.
SELECT COUNT(*)                               AS complaints,
       COUNT(*) - COUNT(DISTINCT complaint_id) AS duplicate_ids,
       SUM(sub_issue IS NULL)                 AS missing_sub_issue,
       MIN(date_received)                     AS first_date,
       MAX(date_received)                     AS last_date
FROM complaints;

-- name: yearly_trend
-- Volume and complaints per month by year. Months come from the actual date span,
-- because 2023 starts January 30 and 2026 ends September 29.
SELECT substr(date_received, 1, 4)                                         AS year,
       COUNT(*)                                                            AS complaints,
       ROUND((julianday(MAX(date_received)) - julianday(MIN(date_received)) + 1) / 30.44, 1) AS months,
       ROUND(COUNT(*) / ((julianday(MAX(date_received)) - julianday(MIN(date_received)) + 1) / 30.44), 0) AS per_month
FROM complaints
GROUP BY year
ORDER BY year;

-- name: spike_jan_2025
-- Which company and issue drove the January 2025 spike?
SELECT company, sub_issue, COUNT(*) AS complaints
FROM complaints
WHERE substr(date_received, 1, 7) = '2025-01'
GROUP BY company, sub_issue
ORDER BY complaints DESC
LIMIT 5;

-- name: fix_first
-- Rank sub-issues by complaints that ended in relief (the company fixed something),
-- with growth in complaints per month: 2023-24 versus January 2025 onward.
WITH spans AS (
  SELECT (julianday('2025-01-01') - julianday(MIN(date_received))) / 30.44     AS early_months,
         (julianday(MAX(date_received)) - julianday('2025-01-01') + 1) / 30.44 AS recent_months
  FROM complaints
),
base AS (
  SELECT sub_issue,
         COUNT(*)                                              AS complaints,
         SUM(response IN ('Closed with monetary relief',
                          'Closed with non-monetary relief'))  AS with_relief,
         SUM(date_received <  '2025-01-01')                    AS early,
         SUM(date_received >= '2025-01-01')                    AS recent
  FROM complaints
  WHERE sub_issue IS NOT NULL
  GROUP BY sub_issue
)
SELECT sub_issue,
       complaints,
       with_relief,
       ROUND(100.0 * with_relief / complaints, 1)              AS relief_rate_pct,
       ROUND(100.0 * ((recent / recent_months) / (early / early_months) - 1), 0) AS growth_per_month_pct
FROM base, spans
WHERE complaints >= 150
ORDER BY with_relief DESC
LIMIT 10;

-- name: fraud_by_year
-- Unauthorized transactions and accounts opened without consent or through fraud.
SELECT substr(date_received, 1, 4) AS year,
       SUM(sub_issue IN ('Transaction was not authorized',
                         'Account opened without my consent or knowledge',
                         'Account opened as a result of fraud')) AS fraud_complaints,
       ROUND(100.0 * SUM(sub_issue IN ('Transaction was not authorized',
                         'Account opened without my consent or knowledge',
                         'Account opened as a result of fraud')) / COUNT(*), 1) AS fraud_share_pct
FROM complaints
GROUP BY year
ORDER BY year;

-- name: older_americans
-- Are older customers more exposed to fraud complaints?
SELECT CASE WHEN tags LIKE '%Older American%' THEN 'Older American' ELSE 'All other' END AS customer,
       COUNT(*) AS complaints,
       ROUND(100.0 * SUM(sub_issue IN ('Transaction was not authorized',
                         'Account opened without my consent or knowledge',
                         'Account opened as a result of fraud')) / COUNT(*), 1) AS fraud_share_pct
FROM complaints
GROUP BY customer;

-- name: central_florida
-- Orlando-area ZIP codes (327, 328, 347): volume and top issues.
SELECT sub_issue, COUNT(*) AS complaints
FROM complaints
WHERE substr(zip, 1, 3) IN ('327', '328', '347')
GROUP BY sub_issue
ORDER BY complaints DESC
LIMIT 5;
