/* Ask AI · a portfolio-wide assistant for Bruno Silva's projects (bsilva87921.github.io).
 *
 * One file, added to a page with:  <script src="…/assets/ask-ai/ask-ai.js" defer></script>
 * Optional attributes: data-project="key" (otherwise chosen from the URL), data-side="left", data-bottom="84" (a minimum
 * gap from the bottom edge; the button also lifts itself above a page's own fixed bottom bar), data-hide-on="in-game"
 * (hide the button while <body> has that class).
 *
 * Two engines, picked automatically:
 *  - Built-in (free, works offline): answers from a curated knowledge base for each project and from the page's own
 *    text, with a "Show me" link that scrolls to the part of the page it used.
 *  - Claude: when the site's AI proxy is configured (probable-atlas/ai-config.json, see probable-atlas/ai-proxy/README.md),
 *    the same chat streams answers from Claude, grounded in the same knowledge base and the page text. If Claude is
 *    unavailable for any reason, the built-in answer is used instead.
 * A page can expose live answers with window.ASK_AI_LIVE = { name: () => "text" }, referenced from the knowledge base.
 */
(function () {
  "use strict";
  if (window.__askAiLoaded) return;
  window.__askAiLoaded = true;

  var SCRIPT = document.currentScript;
  var attr = function (n) { return SCRIPT ? SCRIPT.getAttribute(n) : null; };
  var CONFIG_URL = "/probable-atlas/ai-config.json";
  var EMAIL = "bsilva87@live.com";

  /* ======================================================================================================
     Knowledge base. Facts are Bruno's own, confirmed figures; project facts come from each project's page.
     k = phrases that signal the question (every word of a phrase must appear), a = the answer (light markdown).
     ====================================================================================================== */
  var PROFILE = [
    { k: ["who", "bruno", "about", "built", "build", "made", "creator", "author", "background", "summary", "yourself"], a: "**Bruno Silva** built this. He is a Senior Business Analyst at Axiom Bank in the Orlando area, after 14 years at JPMorgan Chase (2012–2026): 5.5 years as an Operations Manager running a 50+ associate omnichannel contact center, and nearly 4 years as a Senior Business Analyst leading KPI governance for 30,000 employees. He holds an MBA in Finance and a Six Sigma Black Belt, and speaks English, Spanish and Portuguese." },
    { k: ["contact center", "call center", "operations manager", "ivr", "routing", "workforce", "wfm", "forecasting", "scheduling", "staffing", "supervisor", "multi site", "remote team"], a: "As an Operations Manager at JPMorgan Chase (2017–2022), Bruno led a **50+ associate omnichannel contact center** (voice, chat, email, SMS) across multiple sites and remote teams through supervisors and team leads. He configured IVR, call flows, skills and routing in NICE CXone and Cisco, led forecasting, staffing, scheduling and real-time management, owned a **$2M budget**, and delivered a **4.5/5 customer satisfaction rating** with **90% retention** versus an 80% company average." },
    { k: ["ai tool", "ai", "claude", "chatgpt", "copilot", "gemini", "power automate", "power apps", "generative", "llm", "prompt", "agent"], a: "Bruno is a hands-on AI power user: **Claude** (Projects, Skills, MCP connectors, memory, Claude Code, Claude in Chrome), **ChatGPT** (custom GPTs, Projects), **Microsoft 365 Copilot** and **Gemini**, plus **Power Automate, Power Apps, SharePoint and Teams**. He coaches coworkers on practical, responsible AI use, and built the apps on this site with Claude Code." },
    { k: ["result", "achievement", "impact", "accomplish", "saved", "savings", "20m", "biggest", "proud", "aht", "handle time"], a: "His best-known result: when average handle time (AHT) rose about 5 seconds at JPMorgan Chase, Bruno traced it to new-hire mix rather than systems (associates under 6 months were 20 seconds slower). Targeted coaching and a call-type dashboard cut AHT by **30 seconds** across card and retail, saving about **$20M**. He also automated reporting with Alteryx and its AI features, freeing **0.5 FTE**." },
    { k: ["current", "now", "axiom", "today", "present", "currently"], a: "Today Bruno is a **Senior Business Analyst at Axiom Bank**, leading business analysis for a new digital banking platform and its contact center: an end-to-end NICE CXone implementation with **AI agents and live agents**, plus the metrics framework (IVR performance, AHT and the rest of the service, quality and efficiency KPIs)." },
    { k: ["handshake", "ai trainer", "evaluat", "model training", "rubric"], a: "From November 2025 to June 2026 Bruno was an **AI Trainer Fellow at Handshake AI**, evaluating generative AI responses against quality rubrics with 95%+ accuracy. His structured feedback improved model performance 10% within three months, and validation standards he built raised labeling consistency 15%." },
    { k: ["education", "degree", "mba", "school", "university", "certification", "certificate", "six sigma", "black belt"], a: "Bruno holds an **MBA in Finance** (Cum Laude) and a **B.S. in Business Administration, Finance** (Magna Cum Laude), both from Southern New Hampshire University. Certifications: Six Sigma Black Belt, IBM Data Scientist/Engineering, Microsoft Power BI and Data Analytics Modeling." },
    { k: ["contact", "email", "phone", "reach", "hire", "hiring", "interview", "linkedin", "resume", "cv", "talk"], a: "You can reach Bruno at **" + EMAIL + "**, **(407) 209-4843**, or on LinkedIn at [linkedin.com/in/brunosilva1987](https://linkedin.com/in/brunosilva1987)." },
    { k: ["skill", "sql", "power bi", "excel", "tableau", "python", "alteryx", "nice", "cisco", "technical", "stack"], a: "Core skills: **SQL**, **Power BI** (certified), **Alteryx**, advanced **Excel**, Tableau and Python for analysis; **NICE CXone/InContact** and **Cisco** for contact centers; KPI design and governance, root-cause analysis, Agile and Six Sigma for process improvement." },
    { k: ["language", "spanish", "portuguese", "bilingual", "speak"], a: "Bruno is fluent in **English, Spanish and Portuguese**." },
    { k: ["project", "portfolio", "other project", "what else", "show me", "work sample"], a: "Bruno's portfolio includes the **AI Strategy Lab**, **Loan Rules Lab**, the **Home Care Operations Dashboard** and its case study, **Probable Atlas** (economics and finance), the **Live Sports Lab**, **Polymath Arcade**, the **Fundraising Analytics Dashboard**, the **Alteryx Workflow Lab** and a **Florida bank complaints** case study. See them all at [bsilva87921.github.io](https://bsilva87921.github.io/#work)." },
    { k: ["how built", "technology", "tech stack", "framework", "coded", "code", "github", "javascript"], a: "The site and its apps are hand-built with HTML, CSS and JavaScript (no frameworks), developed with Claude Code and hosted on GitHub Pages. The 3D scenes use three.js or hand-written WebGL. Source is on [GitHub](https://github.com/Bsilva87921/bsilva87921.github.io)." }
  ];

  var PROJECTS = {
    home: {
      name: "Bruno Silva's portfolio",
      greet: "Hi! I can answer questions about Bruno's experience, skills, AI work or any project on this site.",
      suggest: ["What is Bruno's contact center experience?", "Which AI tools does he use?", "What is his biggest result?", "Which project should I look at first?"],
      context: "The homepage of Bruno Silva's portfolio: hero, results, About, AI Proficiency, Experience, Selected Work, Case Studies, Skills, Education and Contact.",
      facts: [
        { k: ["which project", "first", "start", "recommend", "best project", "look at"], a: "It depends on the role:\n- **AI strategy or transformation:** the [AI Strategy Lab](ai-strategy-lab/)\n- **Business analysis:** the [Loan Rules Lab](loan-rules-lab/) and the [bank complaints case study](case-studies/bank-complaints/)\n- **Operations or contact center leadership:** the [Home Care Operations Dashboard](elite-home-health/) and its case study\n- **Data and BI:** the [Fundraising Analytics Dashboard](fundraising-dashboard/) and [Probable Atlas](probable-atlas/)" },
        { k: ["open to", "looking for", "available", "role", "job", "position", "opportunit"], a: "Bruno is open to AI strategy, contact center leadership, senior business analyst and performance analytics roles. The best way to start a conversation is email: **" + EMAIL + "**." },
        { k: ["lens", "view my profile", "full career", "switch"], a: "The **View my profile as** buttons in the hero tailor the headline and intro: Full career, AI strategy, Contact center or Business analyst. You can share a tailored link, for example [bsilva87921.github.io/?lens=ai](https://bsilva87921.github.io/?lens=ai)." }
      ]
    },
    "ai-strategy-lab": {
      name: "AI Strategy Lab",
      greet: "Hi! Ask me how this AI program model works: the scoring, the roadmap, the ROI math, adoption or governance.",
      suggest: ["Which use cases should we pilot first?", "How is each use case scored?", "How does the ROI calculator work?", "What are the data guardrails?"],
      context: "An interactive model of an enterprise AI program for Northwind Concrete, a FICTIONAL concrete-products manufacturer (12 plants, 1,800 employees, 600 AI licenses). All figures are illustrative. Sections: Overview, Opportunity pipeline (18 use cases), Roadmap (first 90 days plus Now/Next/Later lanes), Business case calculator, Adoption dashboard, Governance, Playbooks.",
      facts: [
        { k: ["what is", "what does", "about this", "purpose", "overview", "lab"], a: "The **AI Strategy Lab** shows how Bruno would run an enterprise AI program at **Northwind Concrete**, a fictional concrete-products manufacturer (12 plants, 1,800 employees). It scores 18 AI use cases, builds a roadmap, models ROI, tracks adoption and sets governance. Every number is calculated live from the page's data, and all figures are illustrative." },
        { k: ["pilot", "first", "top", "priorit", "best", "rank", "highest"], live: "top", a: "The pipeline ranks use cases by score; anything scoring 70+ is marked **Pilot now**. Change the weights in the Opportunity pipeline section and the ranking updates." },
        { k: ["score", "scoring", "weight", "how rated", "formula", "rate", "criteria"], a: "Each use case is rated 1–5 on **value**, **feasibility**, **risk** and **effort**. The score is a weighted average of value, feasibility, low risk and low effort, scaled to 0–100. Default weights: value 40%, feasibility 25%, low risk 15%, low effort 20%. **70+** = Pilot now, **60–69** = Plan next, **under 60** = Explore later." },
        { k: ["roi", "business case", "calculator", "payback", "value", "cost", "worth"], live: "case", a: "The calculator: **hours** = people × times per week × minutes saved ÷ 60 × 48 weeks × adoption; **value** = hours × loaded cost + errors avoided × 12; **3-year ROI** = (3 × value − 3 × licenses − build) ÷ (3 × licenses + build). Time saved is capacity, not cash, until it is redeployed or avoids a hire." },
        { k: ["adoption", "active", "trained", "champion", "license", "users", "rollout"], a: "In the illustrative 12-month rollout: **600** licenses, **580** trained (97%), **408** active monthly (68%), **156** weekly power users (26%) and **24 AI Champions** in 9 departments. Production and Fleet lag because many people work away from a desk, so the next wave targets them with mobile, voice-first tools." },
        { k: ["governance", "guardrail", "data rule", "security", "responsible", "policy", "classification", "restricted", "confidential"], a: "Four data classes: **Public** (any approved AI tool), **Internal** (company-licensed tools with work accounts), **Confidential** such as pricing, bids, contracts and HR records (approved tools with data protection, a named owner and human review) and **Restricted** such as SSNs, bank details and credentials (never in AI tools). Every new use case answers seven questions: owner and outcome, baseline, data, security review, integration, human in the loop and change plan." },
        { k: ["90 days", "first 90", "onboarding", "listen", "plan", "roadmap", "timeline"], a: "First 90 days: **Listen** (days 1–30: meet every leader, visit plants and dispatch, inventory tools already owned, collect baselines), **Prioritize** (days 31–60: publish the scored pipeline, agree on guardrails with Cybersecurity, launch AI literacy, pick three pilots) and **Prove** (days 61–90: run pilots, recruit AI Champions, ship the executive dashboard, set next quarter's roadmap). The lanes below place each use case in Now, Next or Later by live score." },
        { k: ["playbook", "prompt", "example prompt", "training"], a: "The Playbooks section has ready-to-use prompts for a dispatcher, a plant manager, a sales rep, an AP specialist, a safety coordinator and any leader, each naming the tool (Microsoft 365 Copilot, Claude Projects, Power Apps), the format and the check. Use **Copy prompt** on any card." },
        { k: ["tool", "copilot", "power automate", "claude", "chatgpt", "technology", "platform"], a: "The use cases favor tools a company like this already owns: **Microsoft 365 Copilot**, **Copilot Studio** agents, **Power Automate**, **Power Apps**, **Power BI** and **SharePoint**, plus enterprise **Claude** and **ChatGPT** for drafting work, with IT's Data & Integration team for heavier builds such as forecasting." },
        { k: ["fictional", "real", "northwind", "county", "actual data", "illustrative"], a: "Northwind Concrete is **fictional** (a nod to Microsoft's classic sample company), and all figures are illustrative. The lab demonstrates Bruno's method, not any real company's results." }
      ]
    },
    "loan-rules-lab": {
      name: "Loan Rules Lab",
      greet: "Hi! Ask me how to use the Loan Rules Lab, what the risk model does, or what the data is.",
      suggest: ["How do I use this lab?", "How does the risk model work?", "What data is this?", "What do the four headline numbers mean?"],
      context: "An interactive business analysis tool: set lending rules on 9,578 real LendingClub loans (2007–2010) and see the impact, a predictive risk model, insights, recommendations, business rules, test cases and a defect log.",
      facts: [
        { k: ["what is", "what does", "about this", "purpose", "overview"], a: "The **Loan Rules Lab** lets you set lending rules and test them against **9,578 real LendingClub loans** (2007–2010). It shows approvals, bad loans stopped and good loans declined, compares your rules with a predictive risk model, and produces the business rules, test cases and defect log a project team needs." },
        { k: ["how use", "how do i", "start", "guide", "quick start", "step"], a: "Quick start:\n1. **Pick a starting point:** Conservative, Balanced, Growth, Match policy or Risk model.\n2. **Adjust the rules:** minimum FICO, manual review band, debt-to-income, inquiries, delinquencies, utilization, public records and a predicted-risk limit.\n3. **Read the four headline numbers** and the charts.\n4. **Copy the deliverables:** business rules, test cases and the defect log. The **How to use** tab has a 2-minute guide." },
        { k: ["model", "predict", "regression", "machine learning", "risk model", "accuracy", "cross validation"], a: "The risk model is a **logistic regression** (scikit-learn) that estimates each applicant's chance of not paying the loan in full from FICO score, debt-to-income, inquiries, public records, utilization, income and loan purpose. Every loan is scored by a model that never saw it (**5-fold cross-validation**), so results are out-of-sample. Interest rate and installment are left out because a lender sets them after the decision; delinquencies were tested and dropped." },
        { k: ["data", "source", "dataset", "lendingclub", "kaggle", "where from"], a: "LendingClub loans issued **2007–2010**, published on Kaggle as \"Loan Data\": **9,578 loans, 14 fields**, identified only by row number (no names or contact details). Bruno checked it in Python first: no missing values or duplicate rows, and value ranges reviewed for each field." },
        { k: ["headline", "four number", "approved", "match", "bad loans", "good loans", "metric"], a: "The four headline numbers: **Approved** (share of applications approved), **Match with current policy** (decisions that agree with LendingClub's policy flag), **Bad loans stopped** (share of not-fully-paid loans declined) and **Good loans declined** (share of fully paid loans turned away). Good rules stop more bad loans while declining few good ones." },
        { k: ["analyst", "staff", "manual review", "workload", "hours", "forecast"], a: "The operational readiness section estimates analyst workload from the manual review band: applications per month × the share sent to review × minutes per review, compared with the analyst hours you have." },
        { k: ["test case", "business rule", "defect", "deliverable", "uat", "copy"], a: "The lab generates the documents a project team needs: **business rules** written from your settings, **test cases** for UAT, and a **defect log** comparing your rules with the current policy. Copy them from the deliverables sections." }
      ]
    },
    "home-care": {
      name: "Home Care Operations Dashboard",
      greet: "Hi! Ask me about this home care operations dashboard: the KPIs, the filters, the data or the case study.",
      suggest: ["What does this dashboard track?", "Is this real data?", "How do the filters work?", "What did the case study find?"],
      context: "A one-page operations dashboard for a home care agency, built by Bruno as a work sample for Elite Home Healthcare's Strategic Operations Analyst role. Illustrative sample data, not Elite's results.",
      facts: [
        { k: ["what is", "what does", "track", "kpi", "overview", "about this"], a: "This dashboard is one view of the numbers a home care operation runs on: **16 KPIs with targets** across staffing the authorized hours, the workforce, the revenue cycle, growth and quality, plus an **office scorecard**, a **what-if calculator** and a **KPI dictionary**. Bruno built it as a work sample for Elite Home Healthcare's Strategic Operations Analyst role." },
        { k: ["real", "data", "illustrative", "sample", "source", "elite"], a: "The data is an **illustrative sample** Bruno generated to behave like an Indiana home care agency: 24 months, 4 offices (Bedford, Greenfield, Kokomo and rural statewide), 5 payers (PathWays for Aging, Health & Wellness waiver, Medicare, private pay and VA Community Care), 3 service lines and 3 shift types. It is **not** Elite's data. Medicare quality targets use CMS Care Compare averages." },
        { k: ["filter", "how use", "office", "payer", "shift", "period"], a: "Use the five filters (**period, office, payer, service and shift**) and everything on the page recalculates. The tabs cover Overview, Staffing & hours, Workforce, Revenue cycle, Growth & quality, the Office scorecard, What-if and the KPI dictionary." },
        { k: ["case study", "finding", "found", "recommend", "hours gap"], a: "The companion case study, **Closing the Hours Gap**, asks why authorized care hours go unstaffed, what it costs and what would close the gap, with three costed recommendations. [Read the case study](case-study.html)." },
        { k: ["sql", "built", "technology", "method", "github"], a: "Built on a SQLite data model with SQL queries (sizing the gap, locating it by office and shift, linking it to early caregiver turnover, a difference-in-differences test of a mentor pilot, lost referrals, revenue cycle and the office scorecard), and vanilla JavaScript for the page. The SQL, data and source are on [GitHub](https://github.com/Bsilva87921/bsilva87921.github.io/tree/main/elite-home-health)." }
      ]
    },
    "home-care-case": {
      name: "Closing the Hours Gap (case study)",
      greet: "Hi! Ask me about this case study: the question, the method, the findings or the assumptions.",
      suggest: ["What question does this answer?", "How was the analysis done?", "What are the recommendations?", "What assumptions were used?"],
      context: "Business case study by Bruno Silva: why authorized home care hours go unstaffed, what it costs and three changes that would close most of the gap. Illustrative sample data mirroring an Indiana home care agency, not Elite Home Healthcare's data.",
      facts: [
        { k: ["question", "what is", "about this", "purpose", "overview"], a: "The business question: **how many authorized care hours are we failing to deliver, where, why, and what would it take to deliver them?** The case study sizes the gap, finds where it concentrates, explains the causes and costs three changes that would close most of it." },
        { k: ["method", "how", "analysis", "sql", "difference", "approach"], a: "The method, all in SQL on a SQLite model: size the unfilled-hours gap, locate it by office and shift, relate it to **early caregiver turnover**, test the Greenfield **mentor pilot** with a **difference-in-differences** comparison, cost the lost referrals, review the revenue cycle and build an office scorecard. Every number on the page is computed live from the same data as the dashboard." },
        { k: ["assumption", "replacement cost", "stipend", "coordinator", "length of stay"], a: "Stated assumptions, meant to be replaced with real figures: unfilled hours valued at the average billed rate for the same payer and service; caregiver replacement cost **$2,500**; mentor stipend **$250**; program coordinator **$55,000**; client length of stay **4–8 months**." },
        { k: ["real", "data", "illustrative", "elite"], a: "The data is an **illustrative sample** generated to mirror an Indiana home care agency; it is not Elite Home Healthcare's data. The method, SQL and dashboard are built to run on real scheduling, EVV, payroll, intake and billing exports." },
        { k: ["more time", "next step", "improve", "future"], a: "With more time or real data: caregiver-level survival analysis of early exits, drive-time matching between caregivers and clients, and a weekly open-shift forecast by office." }
      ]
    },
    fundraising: {
      name: "Fundraising Analytics Dashboard",
      greet: "Hi! Ask me about this fundraising dashboard: what the data shows, how to filter it, or how it was built.",
      suggest: ["What are the key findings?", "How big is the dataset?", "How do I filter the dashboard?", "Was this built in Power BI?"],
      context: "Fundraising analytics dashboard built by Bruno in Power BI, with a web version on the same data: 1,048,575 gifts from 69,361 donors across 27 designations, 1990 to October 2025.",
      facts: [
        { k: ["finding", "insight", "show", "learn", "takeaway", "key"], a: "Headline findings:\n- **Giving more than doubled since 2020** (+113%): from $158.2M in 2020 to $337.5M in 2024.\n- **Major donors carry the program:** the top 1% of donors (694 people) gave 53% of all dollars, while the median gift is $91.\n- **Alumni Association leads** at $330.4M (4.6% of revenue); all 27 designations fall between 2.9% and 4.6%.\n- **Credit card ($1.53B) and stock ($1.51B) gifts lead**, ahead of cash ($1.36B)." },
        { k: ["dataset", "how big", "how many", "records", "size", "data source", "where data", "data come"], a: "**1,048,575 gift records** from **69,361 donors** across **27 designations**, from 1990 to October 22, 2025 (2025 is year to date). Donors are identified by donor ID only, with no names or contact details." },
        { k: ["filter", "how use", "click", "clear"], a: "Click any bar, or a year on the trend line, to filter the whole page; click the same bar again to clear it, or use **Clear filters**. You can also filter by year, designation and gift type at the top." },
        { k: ["power bi", "pbix", "built", "how made", "tool"], a: "Bruno built it in **Power BI**; this web version is generated from the same data model so it opens anywhere without a login. You can download the **.pbix** and read the full analysis on GitHub." }
      ]
    },
    alteryx: {
      name: "Alteryx Workflow Lab",
      greet: "Hi! Ask me how this Alteryx training lab works or what each lesson covers.",
      suggest: ["How does this lab work?", "What will I build?", "What data does it use?", "Has Bruno used Alteryx at work?"],
      context: "An interactive Alteryx training lab: build four real workflows (data cleansing, joins, KPIs and a report) on 1,048,575 fundraising gift records; 4 lessons, 24 steps. An independent tutorial; Alteryx and Alteryx Designer are trademarks of Alteryx, Inc.",
      facts: [
        { k: ["how work", "how use", "start", "step", "lesson"], a: "Each lesson adds tools one at a time: **add the tool** (click it in the palette or drag it onto the canvas), **configure it**, then **Run** and inspect the record counts and data at every step. Use **Hint**, **Show me this step** or **Jump to finished workflow** if you get stuck. There are **4 lessons and 24 steps**." },
        { k: ["build", "what will", "workflow", "cover", "learn"], a: "You build four real workflows: **data cleansing**, **joins**, **KPIs** and a **report**, including real problems hiding in the file." },
        { k: ["data", "records", "dataset", "source"], a: "Every number comes from the same **1,048,575-record fundraising file** behind Bruno's [Fundraising Analytics Dashboard](../fundraising-dashboard/)." },
        { k: ["work", "chase", "experience", "used", "real job"], a: "Yes. At JPMorgan Chase, Bruno used Alteryx, including its AI features, to automate data extraction and scheduled Power BI refreshes, freeing **0.5 FTE** of manual reporting work." }
      ]
    },
    "bank-complaints": {
      name: "Florida bank complaints case study",
      greet: "Hi! Ask me about this case study: the question, the data, the method or what to fix first.",
      suggest: ["What should a bank fix first?", "What data is this?", "How was it analyzed?", "Why is there a spike in January 2025?"],
      context: "Business analysis case study by Bruno Silva: 23,904 CFPB complaints about checking and savings accounts filed by Floridians, January 2023 through September 2026, analyzed in SQL to decide which customer problems a growing community bank should fix first.",
      facts: [
        { k: ["fix first", "answer", "finding", "main", "result", "priorit", "what should"], a: "The answer: **deposit and withdrawal problems, debit card problems and unauthorized transactions** make up **43%** of complaints, and each is up **70–93%** in complaints per month. The fix-first list ranks issues by complaints that ended in relief, meaning the company acknowledged and fixed something." },
        { k: ["data", "source", "cfpb", "how many", "dataset"], a: "The **CFPB Consumer Complaint Database**: **23,904** complaints about checking and savings accounts filed by Floridians from **January 2023 through September 2026**." },
        { k: ["method", "how", "sql", "analy", "approach"], a: "Bruno loaded the CFPB export into **SQLite**, profiled it, and ranked issues by **volume, growth and how often the bank had to provide relief**. The page runs on the same results and shows the SQL behind it." },
        { k: ["spike", "january 2025", "jump", "quarter"], a: "One quarter stands out: the **January 2025** jump is a **one-off spike**, not a trend, so the growth figures compare complaints per month since January 2025 with 2023–24 rather than reading too much into a single quarter." },
        { k: ["central florida", "orlando", "region", "filter", "zip"], a: "Use the **Region** filter for All Florida or **Central Florida** (Orlando-area ZIP codes beginning 327, 328 and 347), and the **Years** filter. Everything on the page updates." },
        { k: ["business analyst", "axiom", "next", "would you", "use this"], a: "The page closes with how Bruno would use this as a business analyst: **map and measure** the top issues, **define and test** fixes, then **track and improve** with the same metrics." }
      ]
    },
    polymath: {
      name: "Polymath Arcade",
      greet: "Hi! Ask me about Polymath Arcade: the games, how progress works, or how to install it.",
      suggest: ["What is Polymath Arcade?", "How do I install it?", "How does progress work?", "What is the Daily Challenge?"],
      context: "Polymath Arcade, a Probable app by Bruno Silva: 21 adaptive 3D brain games across 10 subjects. Installable (PWA) and works offline.",
      facts: [
        { k: ["what is", "about this", "overview", "games", "subject"], a: "**Polymath Arcade** has **21 adaptive 3D brain games** across **10 subjects**: brain training, math, physics, the real world, coding, science, finance, economics, business and English. Every round adapts to you and explains what you missed." },
        { k: ["install", "app", "phone", "home screen", "offline"], a: "Install it as an app: on **Android (Chrome)** tap **Install** in the top bar; on **iPhone or iPad (Safari)** tap **Install** for the steps, or **Share → Add to Home Screen**; on **desktop (Chrome or Edge)** click **Install** or the install icon in the address bar. It works offline once installed." },
        { k: ["progress", "xp", "rank", "badge", "streak", "level"], a: "Progress: **XP**, **10 ranks**, adaptive levels for each game, a daily goal, streaks, **18 badges** and a skill radar on your Profile." },
        { k: ["daily", "challenge"], a: "The **Daily Challenge** is one question from every subject, the same set for everyone each day, worth **double XP**." },
        { k: ["built", "3d", "webgl", "technology", "how made"], a: "Each game has its own animated CSS 3D emblem, and a hand-written WebGL renderer draws the living background of glass crystals. The app has a guided tour (open it any time with the **Tour** button)." }
      ]
    }
  };

  var ROUTES = [
    [/\/ai-strategy-lab\//, "ai-strategy-lab"],
    [/\/loan-rules-lab\//, "loan-rules-lab"],
    [/\/elite-home-health\/case-study/, "home-care-case"],
    [/\/elite-home-health\//, "home-care"],
    [/\/fundraising-dashboard\//, "fundraising"],
    [/\/alteryx\//, "alteryx"],
    [/\/case-studies\/bank-complaints\//, "bank-complaints"],
    [/\/polymath-arcade\//, "polymath"]
  ];
  var KEY = attr("data-project");
  if (!KEY || !PROJECTS[KEY]) {
    KEY = "home";
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i][0].test(location.pathname)) { KEY = ROUTES[i][1]; break; }
  }
  var P = PROJECTS[KEY];

  /* ======================================================================================================
     Text helpers: tokens, light stemming, synonyms
     ====================================================================================================== */
  var STOP = {};
  ("a an the and or of to in on for with is are was were be been being do does did i me my you your we our it its this that these those " +
   "there here what which whom how why when where can could would should will shall may might must about into from by at as if then than so " +
   "please tell show explain give any some much many more most very just also get got have has had there's what's it's i'm let us he him his she her they them their page site").split(" ").forEach(function (w) { STOP[w] = 1; });
  var SYN = { artificial: "ai", genai: "ai", generative: "ai", llm: "ai", copilot: "copilot", tools: "tool", platforms: "platform", software: "tool",
    background: "experience", career: "experience", worked: "experience",
    email: "contact", phone: "contact", reach: "contact", hiring: "hire",
    dataset: "data", datasets: "data", sources: "source", predict: "model", prediction: "model", predictive: "model", ml: "model",
    rois: "roi", payback: "roi", priorities: "priorit", prioritize: "priorit", priority: "priorit", prioritized: "priorit" };
  function stem(w) {
    if (SYN[w]) return SYN[w];
    if (w.length > 5 && /ies$/.test(w)) w = w.slice(0, -3) + "y";
    else if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
    else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    return SYN[w] || w;
  }
  function tokens(s, keepStop) {
    return String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9$%.\s-]/g, " ").replace(/[.\-]/g, " ")
      .split(/\s+/).filter(function (w) { return w && (keepStop || !STOP[w]); }).map(stem);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(s) {
    var lines = esc(s).split(/\n/), out = [], list = null;
    var inline = function (t) {
      return t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\.\.?\/|\/|#|[a-z0-9-]+[\/.])[^)\s]*)\)/gi, function (m, t2, u) { var ext = /^https?:/.test(u); return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t2 + "</a>"; });
    };
    lines.forEach(function (l) {
      var m = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(l);
      if (m) {
        var tag = m[1] ? "ol" : "ul";
        if (!list || list.tag !== tag) { if (list) out.push("</" + list.tag + ">"); list = { tag: tag }; out.push("<" + tag + ">"); }
        out.push("<li>" + inline(m[2]) + "</li>");
      } else {
        if (list) { out.push("</" + list.tag + ">"); list = null; }
        if (l.trim()) out.push("<p>" + inline(l) + "</p>");
      }
    });
    if (list) out.push("</" + list.tag + ">");
    return out.join("");
  }

  /* ======================================================================================================
     Built-in engine: knowledge-base facts first, then the page's own text
     ====================================================================================================== */
  function hasTok(q, qa, w) {
    if (q.has(w)) return true;
    if (w.length >= 5) for (var i = 0; i < qa.length; i++) if (qa[i].indexOf(w) === 0) return true;
    return false;
  }
  var GENERIC = { bruno: 1, silva: 1, experience: 1, project: 1, data: 1, work: 1, use: 1, page: 1 };
  function factScore(f, q) {
    var s = 0, qa = Array.from(q), seen = {};
    f.k.forEach(function (ph) {
      var t = tokens(ph), key = t.join(" ");
      if (!t.length || seen[key]) return;            // synonyms collapse to one token: count it once
      seen[key] = 1;
      if (t.every(function (w) { return hasTok(q, qa, w); }))
        t.forEach(function (w) { s += GENERIC[w] ? 0.5 : 1.01; });   // specific words outrank generic ones
    });
    return s;
  }
  function liveText(f) {
    try { var L = window.ASK_AI_LIVE; if (f.live && L && typeof L[f.live] === "function") return L[f.live](); } catch (e) {}
    return "";
  }
  function factAnswer(f) { var live = liveText(f); return live ? live + "\n\n" + f.a : f.a; }

  var BLOCK_SEL = "h1,h2,h3,h4,p,li,dt,dd,blockquote,figcaption,td,th,summary,label,.note,.kpi,.l";
  function pageChunks() {
    var root = document.querySelector("main") || document.body, out = [], heading = "";
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    var n = 0, el;
    while ((el = walker.nextNode()) && n < 4000) {
      if (el.closest(".askai, script, style, noscript, template, svg, nav")) continue;
      if (/^H[1-4]$/.test(el.tagName)) heading = (el.textContent || "").trim().slice(0, 120);
      if (!el.matches(BLOCK_SEL)) continue;
      if (el.querySelector(BLOCK_SEL)) continue;        // only innermost text blocks
      var t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length < 18 || t.length > 1600) continue;
      n++;
      out.push({ el: el, heading: heading, text: t, toks: tokens(t), htoks: tokens(heading), i: out.length, isHead: /^H[1-4]$/.test(el.tagName) });
    }
    return out;
  }
  function searchPage(q) {
    var chunks = pageChunks(); if (!chunks.length) return [];
    LAST_CHUNKS = chunks;
    var N = chunks.length, df = {}, avg = 0;
    chunks.forEach(function (c) { var seen = {}; c.toks.concat(c.htoks).forEach(function (w) { if (!seen[w]) { seen[w] = 1; df[w] = (df[w] || 0) + 1; } }); avg += c.toks.length; });
    avg = avg / N || 1;
    var qs = Array.from(q);
    return chunks.map(function (c) {
      var tf = {}, s = 0, matched = 0;
      c.toks.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
      c.htoks.forEach(function (w) { tf[w] = (tf[w] || 0) + 2; });
      qs.forEach(function (w) {
        if (!tf[w]) return;
        matched++;
        var idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
        s += idf * (tf[w] * 2.2) / (tf[w] + 1.2 * (0.25 + 0.75 * c.toks.length / avg));
      });
      return { c: c, s: s, m: matched };
    }).filter(function (r) { return r.m >= Math.min(2, qs.length) && r.s > 1.2; })
      .sort(function (a, b) { return b.s - a.s; });
  }
  var LAST_CHUNKS = [];
  // a heading on its own says little: use the first text block under it
  function bodyFor(c) {
    if (!c.isHead) return c.text;
    for (var j = c.i + 1; j < Math.min(LAST_CHUNKS.length, c.i + 8); j++) {
      var n = LAST_CHUNKS[j];
      if (n.isHead) break;
      if (n.text.length > 60) return n.text;
    }
    return c.text;
  }
  function snippet(t, max) {
    if (t.length <= max) return t;
    var cut = t.slice(0, max); var i = cut.lastIndexOf(" ");
    return cut.slice(0, i > max * 0.6 ? i : max) + "…";
  }
  function builtIn(question) {
    var q = new Set(tokens(question));
    if (!q.size) return { text: factAnswer(KEY === "home" ? PROFILE[0] : P.facts[0]) };
    var best = null, bestS = 0;
    P.facts.forEach(function (f) { var s = factScore(f, q) + 0.5; if (s > 0.5 && s > bestS) { best = f; bestS = s; } });
    PROFILE.forEach(function (f) { var s = factScore(f, q); if (s > bestS) { best = f; bestS = s; } });
    var hits = searchPage(q);
    if (best && (bestS >= 1.5 || !hits.length || (bestS >= 1 && hits[0].m < 2))) return { text: factAnswer(best) };
    if (hits.length) {
      var parts = [], els = [], used = {};
      hits.slice(0, 3).forEach(function (h, i) {
        if (i > 0 && h.s < hits[0].s * 0.7) return;
        var key = h.c.heading + "|" + h.c.text.slice(0, 40); if (used[key] || parts.length >= 2) return; used[key] = 1;
        var label = h.c.isHead ? h.c.text : h.c.heading, body = bodyFor(h.c);
        parts.push((label && label !== body ? "**" + snippet(label, 90) + ":** " : "") + snippet(body, 330));
        els.push(h.c.el);
      });
      return { text: "Here is what this page says:\n\n" + parts.join("\n\n"), els: els };
    }
    return { text: "I couldn't find that on this page. Try one of the suggestions below, or email Bruno at **" + EMAIL + "**.", sugg: true };
  }

  /* ======================================================================================================
     Claude engine (only when the site's AI proxy is configured and healthy)
     ====================================================================================================== */
  var EP = { url: "", up: false, checked: false, model: "" };
  function timeout(ms) { try { return AbortSignal.timeout(ms); } catch (e) { return undefined; } }
  function initClaude() {
    if (EP.checked) return Promise.resolve(EP.up);
    EP.checked = true;
    var fromPage = window.ATLAS_AI && window.ATLAS_AI.endpoint;
    var get = fromPage ? Promise.resolve(fromPage) : fetch(CONFIG_URL, { cache: "no-cache", signal: timeout(5000) })
      .then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { return (j && j.endpoint) || ""; }).catch(function () { return ""; });
    return get.then(function (url) {
      if (!/^https:\/\//.test(url || "")) return false;
      EP.url = url;
      return fetch(url.replace(/\/+$/, "") + "/health", { cache: "no-store", signal: timeout(6000) })
        .then(function (r) { return r.ok ? r.json() : { ok: false }; })
        .then(function (j) { EP.up = !!(j && j.ok); EP.model = (j && j.model) || ""; paintEngine(); return EP.up; })
        .catch(function () { return false; });
    });
  }
  function pageText(max) {
    var root = document.querySelector("main") || document.body;
    var clone = root.cloneNode(true);
    clone.querySelectorAll(".askai, script, style, noscript, template, svg").forEach(function (x) { x.remove(); });
    return (clone.innerText || clone.textContent || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
  }
  function systemPrompt() {
    var live = P.facts.map(liveText).filter(Boolean);
    return [
      "You are Ask AI, a concise assistant on Bruno Silva's portfolio website. The visitor is on: " + P.name + " (" + location.href.split("#")[0] + ").",
      "Answer questions about this page and project, and about Bruno's experience when asked. Use only the facts in BRUNO, PROJECT and PAGE below. Never invent numbers, names or results. If something is not covered, say so briefly and suggest emailing Bruno at " + EMAIL + ".",
      "Say so when data is illustrative or a company is fictional. Keep answers under 120 words unless the visitor asks for detail. Use plain language, short paragraphs or a short list, and **bold** only for key numbers.",
      "BRUNO:\n" + PROFILE.map(function (f) { return "- " + f.a; }).join("\n"),
      "PROJECT: " + P.name + "\n" + (P.context || "") + "\n" + P.facts.map(function (f) { return "- " + f.a; }).join("\n") + (live.length ? "\nLive readings now:\n- " + live.join("\n- ") : ""),
      "PAGE (current visible text, may be truncated):\n" + pageText(14000)
    ].join("\n\n");
  }
  function askClaude(history, onText) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 45000);
    var msgs = history.slice(-10); while (msgs.length && msgs[0].role !== "user") msgs.shift();
    var body = { system: systemPrompt(), messages: msgs, stream: true };
    return fetch(EP.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) {
        if (!r.ok || !r.body) throw new Error("HTTP " + r.status);
        var rd = r.body.getReader(), dec = new TextDecoder(), buf = "", text = "", err = null;
        function pump() {
          return rd.read().then(function (x) {
            if (x.value) buf += dec.decode(x.value, { stream: true });
            var m;
            while ((m = /\r?\n\r?\n/.exec(buf))) {
              var raw = buf.slice(0, m.index); buf = buf.slice(m.index + m[0].length);
              raw.split(/\r?\n/).forEach(function (line) {
                if (line.indexOf("data:") !== 0) return;
                var d = line.slice(5).trim(); if (!d || d === "[DONE]") return;
                try {
                  var ev = JSON.parse(d);
                  if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text || ""; onText(text); }
                  else if (ev.type === "error") err = ev.error || { message: "stopped" };
                } catch (e) { /* partial line */ }
              });
            }
            if (x.done) { if (err && !text) throw new Error(err.message || "stream error"); return text; }
            return pump();
          });
        }
        return pump();
      })
      .finally(function () { clearTimeout(t); });
  }

  /* ======================================================================================================
     UI
     ====================================================================================================== */
  var CSS = [
    ".askai{--a-bg:#ffffff;--a-bg2:#f4f3ef;--a-text:#121826;--a-text2:#454c59;--a-text3:#757b86;--a-border:rgba(16,24,40,.12);--a-accent:#1f3354;--a-on:#ffffff;--a-soft:rgba(31,51,84,.08);--a-shadow:0 28px 70px -24px rgba(16,24,40,.5),0 2px 6px rgba(16,24,40,.08);",
    "font:14.5px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:var(--a-text);-webkit-font-smoothing:antialiased}",
    ".askai[data-dark='1']{--a-bg:#131b29;--a-bg2:#0f1622;--a-text:#eef1f5;--a-text2:#b9c1cf;--a-text3:#8a93a2;--a-border:rgba(200,212,230,.16);--a-accent:#d3dceb;--a-on:#0a0f18;--a-soft:rgba(211,220,235,.09);--a-shadow:0 28px 70px -24px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.4)}",
    ".askai *,.askai *::before,.askai *::after{box-sizing:border-box}",
    ".askai-fab{position:fixed;z-index:39;bottom:var(--a-bottom,20px);right:20px;display:inline-flex;align-items:center;gap:8px;padding:11px 16px 11px 13px;border:0;border-radius:999px;background:var(--a-accent);color:var(--a-on);font:inherit;font-weight:700;font-size:14px;letter-spacing:-.01em;cursor:pointer;box-shadow:var(--a-shadow);transition:transform .2s ease,box-shadow .2s ease,bottom .25s ease,opacity .2s ease}",
    ".askai[data-side='left'] .askai-fab{right:auto;left:20px}",
    ".askai-fab:hover{transform:translateY(-2px)}",
    ".askai-fab svg{width:18px;height:18px;flex:none}",
    ".askai-fab[aria-expanded='true']{transform:scale(.92);opacity:.0;pointer-events:none}",
    ".askai-panel{position:fixed;z-index:2147482991;right:20px;bottom:var(--a-bottom,20px);width:min(410px,calc(100vw - 32px));height:min(620px,calc(100vh - var(--a-bottom,20px) - 20px));display:flex;flex-direction:column;background:var(--a-bg);border:1px solid var(--a-border);border-radius:20px;box-shadow:var(--a-shadow);overflow:hidden;transform-origin:bottom right;animation:askaiIn .22s cubic-bezier(.2,.8,.2,1)}",
    ".askai[data-side='left'] .askai-panel{right:auto;left:20px;transform-origin:bottom left}",
    ".askai-panel[hidden]{display:none}",
    "@keyframes askaiIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}",
    ".askai-head{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 16px;border-bottom:1px solid var(--a-border)}",
    ".askai-mark{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--a-accent);color:var(--a-on);flex:none}",
    ".askai-mark svg{width:17px;height:17px}",
    ".askai-title{flex:1;min-width:0}",
    ".askai-title b{display:block;font-size:15px;letter-spacing:-.01em}",
    ".askai-title span{display:block;font-size:12px;color:var(--a-text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".askai-badge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;border:1px solid var(--a-border);color:var(--a-text2);background:var(--a-bg2);white-space:nowrap}",
    ".askai-x{border:0;background:transparent;color:var(--a-text2);width:32px;height:32px;border-radius:9px;cursor:pointer;display:grid;place-items:center}",
    ".askai-x:hover{background:var(--a-soft)}",
    ".askai-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--a-bg2)}",
    ".askai-m{max-width:88%;padding:10px 13px;border-radius:14px;word-wrap:break-word}",
    ".askai-m.bot{align-self:flex-start;background:var(--a-bg);border:1px solid var(--a-border);border-bottom-left-radius:5px}",
    ".askai-m.user{align-self:flex-end;background:var(--a-accent);color:var(--a-on);border-bottom-right-radius:5px}",
    ".askai-m p{margin:0 0 8px}.askai-m p:last-child{margin-bottom:0}",
    ".askai-m ul,.askai-m ol{margin:4px 0 8px;padding-left:20px}.askai-m li{margin:2px 0}",
    ".askai-m a{color:inherit;text-decoration:underline;text-underline-offset:2px}",
    ".askai-m code{font:12.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--a-soft);padding:1px 5px;border-radius:5px}",
    ".askai-note{font-size:11.5px;color:var(--a-text3);margin-top:6px}",
    ".askai-show{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}",
    ".askai-show button,.askai-sugg button{border:1px solid var(--a-border);background:var(--a-bg);color:var(--a-text);font:inherit;font-size:12.5px;font-weight:600;padding:6px 10px;border-radius:999px;cursor:pointer;text-align:left}",
    ".askai-show button:hover,.askai-sugg button:hover{border-color:var(--a-accent)}",
    ".askai-sugg{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:100%}",
    ".askai-typing{display:inline-flex;gap:4px;padding:4px 2px}.askai-typing i{width:6px;height:6px;border-radius:50%;background:var(--a-text3);animation:askaiDot 1s infinite}.askai-typing i:nth-child(2){animation-delay:.15s}.askai-typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes askaiDot{0%,80%,100%{opacity:.25}40%{opacity:1}}",
    ".askai-form{display:flex;gap:8px;align-items:flex-end;padding:12px;border-top:1px solid var(--a-border);background:var(--a-bg)}",
    ".askai-form textarea{flex:1;resize:none;min-height:42px;max-height:120px;padding:10px 12px;border-radius:12px;border:1px solid var(--a-border);background:var(--a-bg2);color:var(--a-text);font:inherit;outline:none}",
    ".askai-form textarea:focus{border-color:var(--a-accent)}",
    ".askai-send{flex:none;width:42px;height:42px;border:0;border-radius:12px;background:var(--a-accent);color:var(--a-on);display:grid;place-items:center;cursor:pointer}",
    ".askai-send:disabled{opacity:.45;cursor:default}",
    ".askai-send svg{width:18px;height:18px}",
    ".askai-foot{padding:0 14px 10px;font-size:11px;color:var(--a-text3);background:var(--a-bg)}",
    ".askai-flash{outline:3px solid #c58f9a!important;outline-offset:4px;border-radius:6px;transition:outline-color .6s}",
    "@media (max-width:560px){.askai-panel{left:0!important;right:0!important;bottom:0;width:100%;height:86vh;height:86dvh;border-radius:20px 20px 0 0;border-bottom:0}.askai-fab{right:14px;bottom:var(--a-bottom,14px)}.askai[data-side='left'] .askai-fab{left:14px}}",
    "@media (prefers-reduced-motion:reduce){.askai-panel{animation:none}.askai-fab{transition:none}}",
    "@media print{.askai{display:none!important}}"
  ].join("\n");

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6-4.6-1.9 4.6-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>';
  var root, fab, panel, log, input, sendBtn, badge, history = [], busy = false, opened = false;

  function isDark() {
    var h = document.documentElement, b = document.body;
    var t = (h.getAttribute("data-theme") || (b && b.getAttribute("data-theme")) || "").toLowerCase();
    if (t === "dark") return true;
    if (t === "light") return false;
    if (h.classList.contains("dark") || (b && b.classList.contains("dark"))) return true;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function paintTheme() { if (root) root.setAttribute("data-dark", isDark() ? "1" : "0"); }
  function paintEngine() { if (badge) { badge.textContent = EP.up ? "Claude" : "Built-in"; badge.title = EP.up ? "Answers from Claude, grounded in this page" : "Answers from this page and Bruno's portfolio"; } }

  function addMsg(role, html, extra) {
    var m = document.createElement("div");
    m.className = "askai-m " + role;
    m.innerHTML = html;
    if (extra) m.appendChild(extra);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }
  function suggestions(list) {
    var box = document.createElement("div");
    box.className = "askai-sugg";
    list.forEach(function (q) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = q;
      b.addEventListener("click", function () { ask(q); });
      box.appendChild(b);
    });
    log.appendChild(box);
    log.scrollTop = log.scrollHeight;
  }
  function showButtons(els) {
    var vis = (els || []).filter(function (e) { return e && e.getClientRects().length; });
    if (!vis.length) return null;
    var box = document.createElement("div"); box.className = "askai-show";
    vis.forEach(function (e, i) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = vis.length > 1 ? "Show me (" + (i + 1) + ")" : "Show me on the page";
      b.addEventListener("click", function () {
        if (window.matchMedia("(max-width:560px)").matches) close();
        e.scrollIntoView({ behavior: "smooth", block: "center" });
        e.classList.add("askai-flash"); setTimeout(function () { e.classList.remove("askai-flash"); }, 2200);
      });
      box.appendChild(b);
    });
    return box;
  }

  function ask(q) {
    q = String(q || "").trim(); if (!q || busy) return;
    busy = true; sendBtn.disabled = true;
    log.querySelectorAll(".askai-sugg").forEach(function (s) { s.remove(); });
    addMsg("user", esc(q));
    history.push({ role: "user", content: q });
    input.value = ""; autosize();
    var bot = addMsg("bot", '<span class="askai-typing"><i></i><i></i><i></i></span>');
    var finish = function (text, extra, note) {
      bot.innerHTML = md(text) + (note ? '<div class="askai-note">' + esc(note) + "</div>" : "");
      if (extra) bot.appendChild(extra);
      history.push({ role: "assistant", content: text });
      busy = false; sendBtn.disabled = false; log.scrollTop = log.scrollHeight; input.focus();
    };
    var local = function (note) {
      var r = builtIn(q);
      setTimeout(function () { finish(r.text, showButtons(r.els), note); if (r.sugg) suggestions(P.suggest); }, 260);
    };
    initClaude().then(function (up) {
      if (!up) return local();
      return askClaude(history, function (t) { bot.innerHTML = md(t); log.scrollTop = log.scrollHeight; })
        .then(function (t) { if (!t) throw new Error("empty"); finish(t); })
        .catch(function () { local("Claude is unavailable right now, so this answer comes from the page."); });
    });
  }

  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; }
  function open() {
    panel.hidden = false; fab.setAttribute("aria-expanded", "true");
    if (!opened) {
      opened = true;
      addMsg("bot", md(P.greet));
      suggestions(P.suggest);
      initClaude();
    }
    setTimeout(function () { input.focus(); }, 60);
  }
  function close() { panel.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.focus(); schedulePlace(); }

  /* Keep the button clear of a page's own fixed bottom bar (a tab bar, a sticky totals bar). It samples what sits
     where the button would go and lifts it above any short fixed or bottom-sticky element found there. */
  var manualBottom = 0, lastBottom = -1, placeQueued = false, lastPlace = 0;
  function barRect(el, vh) {
    var cs = getComputedStyle(el);
    if (cs.position !== "fixed" && !(cs.position === "sticky" && cs.bottom !== "auto")) return null;
    if (cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return null;
    var r = el.getBoundingClientRect();
    if (r.height < 8 || r.height > vh * 0.4 || r.bottom < vh - 140) return null; // dialogs, scrims and backdrops are not bars
    return r;
  }
  function place() {
    placeQueued = false; lastPlace = Date.now();
    if (!root || !panel.hidden || !document.elementsFromPoint) return;
    var vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var edge = window.matchMedia("(max-width:560px)").matches ? 14 : 20;
    var w = fab.offsetWidth || 100, h = fab.offsetHeight || 44;
    var x0 = root.getAttribute("data-side") === "left" ? edge : vw - edge - w, x1 = x0 + w;
    var bottom = Math.max(edge, manualBottom);
    for (var i = 0; i < 3; i++) {
      var y1 = vh - bottom, y0 = y1 - h, top = Infinity;
      var pts = [[x0 + 4, y0 + 4], [x1 - 4, y0 + 4], [x0 + 4, y1 - 4], [x1 - 4, y1 - 4], [(x0 + x1) / 2, (y0 + y1) / 2]];
      for (var j = 0; j < pts.length; j++) {
        var els = document.elementsFromPoint(pts[j][0], pts[j][1]) || [];
        for (var k = 0; k < els.length; k++) {
          var el = els[k];
          if (el === document.body || el === document.documentElement) break;
          if (root.contains(el)) continue;
          var r = barRect(el, vh);
          if (r) { if (r.top < top) top = r.top; break; }
        }
      }
      if (top === Infinity) break;
      bottom = Math.ceil(vh - top + 10);
    }
    if (bottom !== lastBottom) { lastBottom = bottom; root.style.setProperty("--a-bottom", bottom + "px"); }
  }
  function schedulePlace() {
    if (placeQueued || !root) return;
    placeQueued = true;
    setTimeout(function () { requestAnimationFrame(place); }, Math.max(0, 160 - (Date.now() - lastPlace)));
  }

  function build() {
    var style = document.createElement("style"); style.id = "askai-css"; style.textContent = CSS; document.head.appendChild(style);
    root = document.createElement("div");
    root.className = "askai";
    root.setAttribute("data-side", attr("data-side") === "left" ? "left" : "right");
    manualBottom = Math.max(0, parseInt(attr("data-bottom"), 10) || 0);
    var hideOn = (attr("data-hide-on") || "").split(/[\s,]+/).filter(function (c) { return /^[\w-]+$/.test(c); });
    if (hideOn.length) style.textContent += "\n" + hideOn.map(function (c) { return "body." + c + " .askai-fab"; }).join(",") + "{display:none!important}";
    root.innerHTML =
      '<button class="askai-fab" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="askai-panel">' + ICON + "<span>Ask AI</span></button>" +
      '<section class="askai-panel" id="askai-panel" role="dialog" aria-label="Ask AI about ' + esc(P.name) + '" hidden>' +
        '<div class="askai-head"><div class="askai-mark">' + ICON + '</div><div class="askai-title"><b>Ask AI</b><span>' + esc(P.name) + '</span></div><span class="askai-badge">Built-in</span>' +
        '<button class="askai-x" type="button" aria-label="Close Ask AI"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<div class="askai-log" aria-live="polite"></div>' +
        '<form class="askai-form"><label class="askai-sr" for="askai-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Your question</label><textarea id="askai-input" rows="1" placeholder="Ask a question…" maxlength="600"></textarea>' +
        '<button class="askai-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>' +
        '<div class="askai-foot">Answers come from this page and Bruno’s portfolio. Check important details on the page.</div>' +
      "</section>";
    document.body.appendChild(root);
    fab = root.querySelector(".askai-fab"); panel = root.querySelector(".askai-panel"); log = root.querySelector(".askai-log");
    input = root.querySelector("textarea"); sendBtn = root.querySelector(".askai-send"); badge = root.querySelector(".askai-badge");
    fab.addEventListener("click", open);
    root.querySelector(".askai-x").addEventListener("click", close);
    root.querySelector(".askai-form").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener("input", autosize);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    paintTheme();
    function onPageChange() { paintTheme(); schedulePlace(); }
    try {
      new MutationObserver(onPageChange).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
      new MutationObserver(onPageChange).observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintTheme);
    } catch (e) {}
    place();
    window.addEventListener("resize", schedulePlace, { passive: true });
    window.addEventListener("scroll", schedulePlace, { passive: true });
    window.addEventListener("load", schedulePlace);
    [400, 1500, 4000].forEach(function (ms) { setTimeout(schedulePlace, ms); });
    setInterval(function () { if (!document.hidden) schedulePlace(); }, 2000);
    // open straight into a question with #ask or ?ask=
    try {
      var qp = new URLSearchParams(location.search).get("ask");
      if (location.hash === "#ask" || qp) { open(); if (qp) ask(qp); }
    } catch (e) {}
  }

  window.AskAI = { open: function () { open(); }, ask: function (q) { open(); ask(q); }, project: KEY };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
