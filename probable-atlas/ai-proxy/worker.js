// Probable Atlas · "Ask Atlas" proxy (Cloudflare Worker).
// Lets visitors of the public site chat with Claude without their own API key. The Anthropic key stays here, server side.
// Deploy steps are in README.md next to this file. Set ANTHROPIC_API_KEY as a secret; optionally MODEL and ALLOWED_ORIGINS.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';   // fast and inexpensive; set MODEL to e.g. claude-sonnet-5 for deeper answers
const MAX_TOKENS = 1400;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://bsilva87921.github.io').split(',').map(s => s.trim());
    const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST' || !allowed.includes(origin)) return new Response('Forbidden', { status: 403, headers: cors });

    // Optional per-visitor rate limit (Cloudflare rate-limiting binding named LIMITER; see README). Works without it.
    if (env.LIMITER) {
      const ip = req.headers.get('CF-Connecting-IP') || 'anon';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ type: 'error', error: { type: 'rate_limited', message: 'Too many questions in a short time. Try again in a minute.' } }, 429, cors);
    }

    let body;
    try { body = await req.json(); } catch (e) { return json({ type: 'error', error: { message: 'Bad JSON' } }, 400, cors); }
    if (!Array.isArray(body.messages) || body.messages.length > 40) return json({ type: 'error', error: { message: 'Bad request' } }, 400, cors);
    const size = JSON.stringify(body).length;
    if (size > 200000) return json({ type: 'error', error: { message: 'Request too large' } }, 413, cors);

    // Only forward the fields the page needs; the model and token cap are fixed here, not by the browser.
    const payload = { model: env.MODEL || DEFAULT_MODEL, max_tokens: MAX_TOKENS, system: String(body.system || '').slice(0, 30000), messages: body.messages };
    if (Array.isArray(body.tools) && body.tools.length <= 20) payload.tools = body.tools;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload)
    });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  }
};
const json = (o, status, cors) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json' } });
