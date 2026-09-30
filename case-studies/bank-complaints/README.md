# Where Florida bank customers struggle, and what I'd fix first

**Question:** Where are bank customers' complaints and fraud issues concentrated, and what should a growing community bank fix first?

**Data:** CFPB Consumer Complaint Database export (Sep 30, 2026), filtered to Product = Checking or savings account and State = FL: 23,904 complaints from Jan 30, 2023 to Sep 29, 2026. The raw CSV is not stored here; download it from consumerfinance.gov with the same filters.

**Method**
1. `etl.py` loads the CSV into SQLite (`complaints` table) and runs every query in `analysis.sql`.
2. `analysis.sql` holds the analysis: data checks, yearly trend, the January 2025 spike, the fix-first ranking, fraud by year and Central Florida.
3. The same script writes a compact summary that powers the interactive page (`index.html`).

**Key findings**
- Complaints per month doubled, from 372 in 2023 to 744 in 2026.
- Deposits and withdrawals, debit or ATM card problems and unauthorized transactions make up 43% of complaints; each rose 70–93% in complaints per month since 2023–24.
- About 1 in 5 complaints (18.8%) ended with the company providing relief.
- January 2025's spike was one institution and one issue: 751 Navy Federal overdraft complaints.

**Limits:** complaint counts are not rates (larger banks have more customers); relief is a proxy for a confirmed problem; the export has no written narratives.

By Bruno Silva · https://bsilva87921.github.io
