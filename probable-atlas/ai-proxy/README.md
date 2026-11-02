# Ask Atlas proxy (optional)

The Probable Atlas pages answer questions with a **built-in analyst** that runs in the browser for free. To let every visitor
of the public site chat with **Claude** instead (using the same data and models as tools), deploy this small Cloudflare
Worker. It holds your Anthropic API key server side, fixes the model and answer length, and only accepts requests from
your site.

## Steps (about 15 minutes)

1. **Anthropic key.** In the [Anthropic Console](https://console.anthropic.com/), create an API key and set a monthly
   spend limit (Settings → Limits). Each question costs a fraction of a cent to a few cents depending on the model.
2. **Cloudflare.** Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/), then
   *Workers & Pages → Create → Create Worker*. Name it `atlas-ai`, deploy, then *Edit code*, paste `worker.js`, and deploy.
3. **Secret.** In the Worker's *Settings → Variables and secrets*, add a secret `ANTHROPIC_API_KEY` with your key.
   Optional variables: `MODEL` (default `claude-haiku-4-5-20251001`; `claude-sonnet-5` gives deeper answers at higher cost)
   and `ALLOWED_ORIGINS` (default `https://bsilva87921.github.io`).
4. **Rate limit (recommended).** Add a rate-limiting binding named `LIMITER` (for example 20 requests per 60 seconds per
   visitor) following Cloudflare's "Rate Limiting" Workers documentation. The Worker runs without it.
5. **Connect the site.** Edit `probable-atlas/ai-config.js` in this repository:
   ```js
   window.ATLAS_AI = { endpoint: 'https://atlas-ai.<your-subdomain>.workers.dev' };
   ```
   Commit; GitHub Pages redeploys. The chat header will read "Claude · site service". Visitors can still switch to the
   free built-in analyst in the chat settings.

To turn it off, set `endpoint: ''` again.

## What the page sends

The system instructions (with a short summary of today's readings), the conversation so far, and the tool definitions.
Tool calls (market data, model outputs, portfolio math) run in the visitor's browser; only their small JSON results are
sent back to Claude. No personal data is collected.
