// Probable · "Ask AI" proxy (Cloudflare Worker), shared by Probable Atlas (Economics, Finance, the app home) and the
// Sports Lab, on the web and in both apps. Visitors chat with Claude without a key of their own: the Anthropic API key
// stays here as a Worker secret. Deployed by .github/workflows/ai-proxy.yml (see README.md next to this file).
//
//   GET  /health  -> { ok, model }        lets the pages check, in the background, that Claude is available
//   POST /        -> Anthropic Messages   the page sends { system, messages, tools, stream }; the model, the answer
//                                         length and the limits are fixed here, never by the browser
//
// Settings (Worker variables): MODEL, MAX_TOKENS, EFFORT (only for models with adaptive thinking), ALLOWED_ORIGINS.
// Secret: ANTHROPIC_API_KEY. Optional binding: LIMITER (Cloudflare rate limiting, set in wrangler.toml).
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';   // fast and inexpensive; set MODEL for another model
const DEFAULT_MAX = 2000;
const ORIGINS = 'https://bsilva87921.github.io,capacitor://localhost,https://localhost';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    const url = new URL(req.url);
    const model = env.MODEL || DEFAULT_MODEL;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET' && url.pathname.replace(/\/+$/, '') === '/health') {
      return json({ ok: !!env.ANTHROPIC_API_KEY, model, stream: true }, 200, { ...cors, 'Cache-Control': 'no-store' });
    }
    if (req.method !== 'POST' || !ok) return json({ type: 'error', error: { type: 'forbidden', message: 'Forbidden' } }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ type: 'error', error: { type: 'not_configured', message: 'The Claude key is not set up yet.' } }, 503, cors);

    // per-visitor rate limit (Cloudflare rate-limiting binding LIMITER); the Worker still runs without it
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: req.headers.get('CF-Connecting-IP') || 'anon' });
      if (!success) return json({ type: 'error', error: { type: 'rate_limited', message: 'Too many questions in a short time. Try again in a minute.' } }, 429, cors);
    }

    let body;
    try { body = await req.json(); } catch (e) { return json({ type: 'error', error: { type: 'invalid_request', message: 'Bad JSON' } }, 400, cors); }
    if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 40) return json({ type: 'error', error: { type: 'invalid_request', message: 'Bad request' } }, 400, cors);
    if (JSON.stringify(body).length > 250000) return json({ type: 'error', error: { type: 'invalid_request', message: 'Request too large' } }, 413, cors);
    const msgs = body.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && (typeof m.content === 'string' || Array.isArray(m.content)));
    if (msgs.length !== body.messages.length || msgs[msgs.length - 1].role !== 'user') return json({ type: 'error', error: { type: 'invalid_request', message: 'Bad messages' } }, 400, cors);

    // only the fields the page needs. The system prompt and the tool list repeat on every question, so both are
    // marked for prompt caching: later calls read them from the cache at a fraction of the price.
    const payload = { model, max_tokens: Math.min(+env.MAX_TOKENS || DEFAULT_MAX, 8000), messages: msgs };
    const sys = String(body.system || '').slice(0, 40000);
    if (sys) payload.system = [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }];
    if (Array.isArray(body.tools) && body.tools.length && body.tools.length <= 24) {
      payload.tools = body.tools.map(t => ({ name: String(t.name || '').slice(0, 64), description: String(t.description || '').slice(0, 2000), input_schema: t.input_schema || { type: 'object', properties: {} } }));
      payload.tools[payload.tools.length - 1].cache_control = { type: 'ephemeral' };
    }
    if (body.stream === true) payload.stream = true;
    if (env.EFFORT) payload.output_config = { effort: env.EFFORT };

    const call = p => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(p)
    });
    let r = await call(payload);
    // a setting this model does not accept: try once without it
    if (r.status === 400 && payload.output_config) {
      const t = await r.clone().text();
      if (/output_config|effort/i.test(t)) { delete payload.output_config; r = await call(payload); }
    }
    const type = r.headers.get('content-type') || 'application/json';
    return new Response(r.body, { status: r.status, headers: { ...cors, 'content-type': type, 'Cache-Control': 'no-store' } });
  }
};
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: { ...headers, 'content-type': 'application/json' } });
