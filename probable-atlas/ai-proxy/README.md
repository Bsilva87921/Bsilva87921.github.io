# Ask AI: Claude in the background

Every Probable page (Atlas Economics and Finance, the Atlas home screen's links, the Sports Lab, on the web and in the two
apps) has an **Ask AI** chat. Once this proxy is on, **Claude answers every visitor by default**, with the page's live
data and models as tools, and the answer streams in as it is written. If Claude is ever unavailable (no key yet, a busy
moment, the visitor's question limit, offline), the free **built-in analyst** answers instead, quietly, with a short
note. Nothing is asked of the visitor.

The Anthropic API key never reaches a browser or an app. It lives in a small Cloudflare Worker (`worker.js`), which also
fixes the model and the answer length, caches the long instructions and tool list between questions (prompt caching
makes repeat questions much cheaper), only answers the site and the two apps, and limits each visitor to about one
question every five seconds.

## Turn it on (one time, about 10 minutes)

1. **Anthropic key.** In the [Anthropic Console](https://console.anthropic.com/), create an API key, add credit and set
   a monthly spend limit (Settings → Limits), for example $10.
2. **Cloudflare.** Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/) and open
   *Workers & Pages* once (this gives the account its workers.dev address). Then create an API token with the
   **Edit Cloudflare Workers** template (My Profile → API Tokens), and copy your **Account ID** (on the Workers &
   Pages overview).
3. **GitHub secrets.** In this repository, Settings → Secrets and variables → Actions → *New repository secret*, add:
   - `ANTHROPIC_API_KEY`: the Anthropic key
   - `CLOUDFLARE_API_TOKEN`: the Cloudflare token
   - `CLOUDFLARE_ACCOUNT_ID`: the account ID
4. **Run it.** Actions → **Ask AI proxy** → *Run workflow*.

The workflow deploys the Worker, stores the key in it, checks that Claude answers, writes the Worker's address into
`probable-atlas/ai-config.js` and `ai-config.json`, and redeploys the sites. The two apps read `ai-config.json` from the
website when they open, so they switch to Claude without an app update. The chat header then reads **Claude**.

## Cost

The default model is **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`), fast and inexpensive. A typical question,
including a look-up or two in the page's data, costs about one to three cents, and less once the instructions are
cached. To use another model, add a repository *variable* (not a secret) named `AI_MODEL`, for example
`claude-haiku-5-5` (cheaper still) or `claude-sonnet-5-5` (deeper answers, higher cost), and run the workflow again.
The spend limit in the Anthropic Console is the hard ceiling.

## Turning it off

Delete the `ANTHROPIC_API_KEY` secret and the Worker (Cloudflare dashboard), or set `endpoint: ''` in
`probable-atlas/ai-config.js` and `ai-config.json`. The pages go back to the built-in analyst.

## What the page sends

The system instructions (with a short summary of the page's current readings), the conversation so far, and the tool
definitions. Tool calls (live scores, market data, model outputs, simulations) run in the visitor's browser; only their
small JSON results are sent back to Claude. No personal data is collected, and the Worker keeps no logs of its own.

## Files

- `worker.js`: the Worker. `GET /health` reports whether Claude is on; `POST /` forwards a conversation to the
  Anthropic Messages API, streamed.
- `wrangler.toml`: its name, default model and the per-visitor rate limit.
- `../../.github/workflows/ai-proxy.yml`: the deploy workflow. It does nothing until the three secrets exist.
