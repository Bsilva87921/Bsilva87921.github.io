# Home Care Operations Dashboard + Case Study

A work sample by **Bruno Silva** for Elite Home Healthcare's Strategic Operations Analyst role.

- **Dashboard:** https://bsilva87921.github.io/elite-home-health/ : one page, five filters (period, office, payer, service, shift), 16 KPIs with targets, staffing gap, workforce, revenue cycle, growth and quality, an office scorecard, a what-if calculator and a KPI dictionary.
- **Case study:** https://bsilva87921.github.io/elite-home-health/case-study.html : *Closing the Hours Gap*: why authorized care hours go unstaffed, what it costs, and three recommendations with costed impact ranges.

> **About the data:** Elite's internal data is not public. `data/elite.db` is an illustrative sample I generated (`source/tools/gen_data.py`) to behave like an Indiana home care agency of Elite's size: 24 months, 4 offices (Bedford, Greenfield, Kokomo, rural statewide), 5 payers (PathWays for Aging, Health & Wellness waiver, Medicare, private pay, VA Community Care), 3 service lines and 3 shift types. Medicare quality targets use CMS Care Compare averages.

## The business question
How many authorized hours are we failing to deliver, where, why, and what would it take to deliver them?

## Steps
1. **Data model** (SQLite): `dim_office`, `dim_payer`, `dim_service`, `dim_shift`, and monthly facts for service hours and billing, workforce, referrals, quality and A/R.
2. **SQL** (`sql/01`–`07`): size the gap, locate it by office and shift, relate it to early caregiver turnover, test the Greenfield mentor pilot with a difference-in-differences comparison, cost the lost referrals, review the revenue cycle, and build the office scorecard. Run them all with `python3 source/tools/run_sql.py`.
3. **Dashboard and case study:** `python3 source/build.py` builds both pages from `source/src` (vanilla JavaScript, no frameworks; the case study computes every number live from the same data).

## Assumptions
Unfilled hours are valued at the average billed rate for the same payer and service. Replacement cost per caregiver ($2,500), mentor stipend ($250), program coordinator ($55,000) and client length of stay (4–8 months) are stated assumptions to replace with real figures.

## With more time / real data
Caregiver-level survival analysis of early exits, drive-time matching between caregiver and client addresses, and a weekly open-shift forecast by office.
