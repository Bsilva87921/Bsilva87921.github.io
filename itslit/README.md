# ItsLit Reading Club · launch guide

**Live:** <https://bsilva87921.github.io/itslit/> · **Privacy and house rules:** <https://bsilva87921.github.io/itslit/privacy.html>

The website and the app are the same page: on a phone it runs as an app with tabs at the bottom, and it installs to the home screen. It deploys with the rest of this repository on every push to `main`.

## What works today, with no setup

- The Library with the 3D bookcase, 20 classics broken down in plain English with sealed spoilers, the Matchmaker, the Gazette (three sample letters), My shelf (kept in the browser), read-aloud, the Daylight and Candlelight themes, and offline reading.
- Install as an app: iPhone (Safari → Share → *Add to Home Screen*), Android (Chrome → *Install app*), computers (the install icon in the address bar).
- Until steps 1 and 2 are done, the site says plainly that Shelley, posting in the Salon and member accounts open soon.

## 1. Switch on Shelley, the AI librarian (about 10 minutes)

1. **Claude Console** (<https://console.anthropic.com>): add credit, create an API key, and set a **monthly spend limit** (for example $20) so costs can never surprise you.
2. **Cloudflare** (free, <https://dash.cloudflare.com>): open *Workers & Pages* once to choose your `workers.dev` subdomain. Then *My Profile → API Tokens → Create Token →* template **Edit Cloudflare Workers**, and copy the token. Copy your **Account ID** from the Workers & Pages overview.
3. **GitHub**, this repository: *Settings → Secrets and variables → Actions → New repository secret*, three times: `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. The same three secrets also switch on Ask AI across Probable (run the *Ask AI proxy* workflow).
4. *Actions → **ItsLit API (Shelley)** → Run workflow*. About two minutes later Shelley answers on the site. Until accounts are on, each visitor gets 20 free questions a day.

## 2. Switch on reader accounts, the Salon and the Writing desk (about 15 minutes)

1. <https://console.firebase.google.com> → **Add project** (for example `itslit`). Google Analytics is optional.
2. *Build → Authentication → Get started → Sign-in method*: enable **Google** (pick a support email) and **Email/Password**. Then *Settings → Authorized domains → Add domain*: `bsilva87921.github.io`.
3. *Build → Firestore Database → Create database*: choose a location (for example `nam5 (United States)`) and **production mode**. Open the **Rules** tab, paste [`server/firestore.rules`](server/firestore.rules) with the editor's sign-in email in `editorEmails()`, and press **Publish**.
4. *Project settings (gear) → Your apps → Web `</>`*: register the app (no Firebase Hosting needed) and copy the `firebaseConfig` values into [`config.js`](config.js) under `firebase`. In the same file, put the editor's email in `editors` and your contact address in `contactEmail`, then commit.
5. The site updates within a couple of minutes. The Shelley workflow runs again by itself (config.js changed), and from then on Shelley asks readers to sign in, with 5 free questions a day (`dailyLimit`).
6. The editor signs in with that email. The account panel says *You are an editor of the Gazette* and opens the Writing desk (`#desk`): publish letters, hide the sample letters, see sign-ups and waitlists, and remove reported posts.

Readers can join with Google or with an email and password. Email accounts confirm their address before they can post or ask Shelley. Anyone can delete their account and posts from the account panel.

## 3. The Gazette newsletter

- Sign-up forms save emails in Firebase. On the Writing desk, **Copy all emails** and import them into your email service. beehiiv's free plan works well: *Subscribers → Add subscribers → Import*.
- To send a letter, publish it on the desk, press **Copy as email**, paste it into beehiiv and send.
- Optional, straight to beehiiv: if your beehiiv plan includes API access, add the secrets `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID`, set `newsletter: 'beehiiv'` in config.js, and run the Shelley workflow.

## 4. Payments

1. In Stripe, create **Payment Links** for Patron monthly ($5.99), Patron yearly ($49), Founding Patron ($39 for the first year) and, later, Family.
2. Paste the links into `stripe` in config.js. The membership buttons become checkout buttons.

The paid perks (unlimited Shelley, chapter guides, members-only Salons) aren't switched on yet. Until they are, either wait to add the links, or sell only the Founding Patron, described clearly as a pre-order: *your Patron year starts when membership launches*. The Worker already skips the daily limit for accounts marked `patron`. The next build step is a small Stripe webhook that sets that mark after payment.

## 5. Your own domain

- **Name ideas:** itslitclub.com, readitslit.com, itslit.club, itslitreads.com. Check availability at your registrar. Before spending on branding, check the name against PBS's *It's Lit!* (see the business plan).
- **Where to buy:** Cloudflare Registrar (sold at cost), Porkbun or Namecheap. A .com is about $10–15 a year.
- **Give ItsLit its own repository first.** This repository is your portfolio site: a custom domain here would move the whole portfolio. Create an empty public repository named `itslit`, then ask Claude to move the site there and connect the domain.
- **Connecting the domain:**
  1. In the new repository, go to *Settings → Pages → Custom domain* and enter `www.yourdomain.com`.
  2. Add these DNS records with your registrar:
     - `CNAME` record: `www` → `bsilva87921.github.io`
     - Four `A` records for the bare domain: `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
  3. Turn on **Enforce HTTPS**.
  4. Add the domain to Firebase *Authorized domains*.
  5. Set `customDomain` in config.js, which lets Shelley answer there.

## 6. The app stores

- *Actions → **ItsLit app builds*** makes a test **Android APK** and an **Xcode project** (download them from the run's *Artifacts*). It runs by itself when the site changes.
- The store listing text, the required accounts and the review notes are in [`apps/itslit/STORE.md`](../apps/itslit/STORE.md):
  - **Google Play:** $25 once. New personal accounts need 12 testers for 14 days before publishing.
  - **Apple:** $99 a year and a Mac.
  - **Before the App Store:** add a way to block a reader.

## Editing

- **Letters:** use the Writing desk; no code needed.
- **Books, synopses, sample letters and merchandise:** [`source/data.js`](source/data.js).
- **The look:** [`source/style.css`](source/style.css).
- **Pages and behaviour:** [`source/app.js`](source/app.js).
- After editing any of these source files, run `python3 itslit/source/build.py` and commit, or ask Claude to do it.

## What it costs to run

| What | Cost |
|---|---|
| Hosting (GitHub Pages) | Free |
| Firebase, Spark plan | Free: 50,000 reads and 20,000 writes a day |
| Cloudflare Workers | Free: 100,000 requests a day |
| Shelley (Anthropic, Haiku model) | Pay as you go, typically well under a cent an answer; capped by your monthly limit |
| Domain | About $10–15 a year |
| Google Play | $25 once |
| Apple Developer Program | $99 a year |

## Files

| File | What it is |
|---|---|
| `index.html` | the built page (edit `source/` and run the build, not this file) |
| `config.js` | your settings: Firebase, editors, daily limit, newsletter, Stripe, domain, contact |
| `api-config.js` | Shelley's address, written by the workflow |
| `backend.js` | connects accounts, the database, Shelley, read-aloud and installing |
| `sw.js`, `manifest.webmanifest`, `icons/` | the installable app |
| `privacy.html` | privacy notice and Salon house rules |
| `server/` | Shelley's Cloudflare Worker (`worker.js`, `wrangler.toml`) and the Firestore rules |
| `source/` | the app's source and `build.py` |
| `lib/` | Three.js r128 and Firebase 13.4.0, served from the site |
| `screenshots/`, `og.png` | store screenshots, the install sheet and link previews |

The privacy notice is written in plain language as a starting point. Have it reviewed, especially because the club welcomes teenagers.
