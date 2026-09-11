// POST /api/chat — the site assistant.
//
// The site is static and has no build step, so this is the only server-side
// code in the project. It exists for one reason: an Anthropic API key cannot
// live in browser JavaScript. Cloudflare Pages Functions runs this at the
// edge alongside the static assets, on the plan the project already has.
//
// The system prompt is NOT written here. It is generated from js/pricing.js
// and the FAQ by scripts/build-chat-prompt.js, so the assistant cannot quote
// a price the site does not charge. Rebuild it after any pricing change.

import { SYSTEM_PROMPT } from './_prompt.js';

// One line to change if Haiku disappoints. Cost per six-exchange conversation
// with the prompt cached: Haiku 4.5 about $0.009, Opus 5 about $0.044.
const MODEL = 'claude-haiku-4-5-20251001';

// Short on purpose. Scope is enforced by the prompt, and a prompt is guidance
// rather than a fence — but a model that cannot write at length cannot write
// the tech-support tutorial it is told not to write.
const MAX_TOKENS = 500;

// Cost control, all of it deliberate:
//   - a conversation is capped, so one visitor cannot run up an unbounded bill
//   - a message is capped, so nobody pastes a novel into the context
//   - requests per IP per hour are capped in KV
// A spend cap in the Anthropic console sits behind all three. Set it.
const MAX_TURNS = 24;              // 12 exchanges, twice the costed six
const MAX_CHARS = 2000;           // per message
const RATE_LIMIT = 30;            // requests per IP per window
const RATE_WINDOW = 3600;         // seconds

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
    }
});

export async function onRequestPost(context) {
    const { request, env } = context;

    // Same-origin only. The key is ours to spend, not the internet's.
    const origin = request.headers.get('Origin');
    if (origin && new URL(origin).host !== new URL(request.url).host) {
        return json({ error: 'Not allowed.' }, 403);
    }

    if (!env.ANTHROPIC_API_KEY) {
        return json({ error: 'The assistant is not configured yet.' }, 503);
    }

    // Rate limiting is mandatory, so a missing binding fails loudly rather
    // than quietly shipping an uncapped endpoint. If you are seeing this,
    // bind a KV namespace named CHAT_RATE_LIMIT in the Pages project.
    if (!env.CHAT_RATE_LIMIT) {
        return json({ error: 'The assistant is not configured yet.' }, 503);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `rl:${ip}:${Math.floor(Date.now() / 1000 / RATE_WINDOW)}`;
    const used = parseInt(await env.CHAT_RATE_LIMIT.get(key), 10) || 0;
    if (used >= RATE_LIMIT) {
        return json({
            error: 'That is a lot of questions for one hour. Use the contact ' +
                   'form and Thomas will answer you himself.'
        }, 429);
    }
    // Written before the call, not after, so a burst of parallel requests
    // cannot each read the same low count and all get through.
    await env.CHAT_RATE_LIMIT.put(key, String(used + 1), {
        expirationTtl: RATE_WINDOW * 2
    });

    let body;
    try {
        body = await request.json();
    } catch (e) {
        return json({ error: 'Bad request.' }, 400);
    }

    const messages = Array.isArray(body && body.messages) ? body.messages : null;
    if (!messages || !messages.length) {
        return json({ error: 'Bad request.' }, 400);
    }
    if (messages.length > MAX_TURNS) {
        return json({
            error: 'This conversation has gone on a while. Send it to Thomas ' +
                   'through the contact form and he will pick it up.'
        }, 400);
    }

    // Accept only what the API takes: two roles, string content, no system
    // message from the client — that is how a prompt gets overwritten.
    const clean = [];
    for (const m of messages) {
        if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
            return json({ error: 'Bad request.' }, 400);
        }
        if (typeof m.content !== 'string' || !m.content.trim()) {
            return json({ error: 'Bad request.' }, 400);
        }
        clean.push({ role: m.role, content: m.content.slice(0, MAX_CHARS) });
    }
    if (clean[clean.length - 1].role !== 'user') {
        return json({ error: 'Bad request.' }, 400);
    }

    let upstream;
    try {
        upstream = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                // Cached: the prompt is ~3k tokens and identical every time,
                // which is most of what a short conversation would otherwise
                // cost. This is the difference between $9 and $30 per 1,000.
                system: [{
                    type: 'text',
                    text: SYSTEM_PROMPT,
                    cache_control: { type: 'ephemeral' }
                }],
                messages: clean
            })
        });
    } catch (e) {
        return json({ error: 'Could not reach the assistant just now.' }, 502);
    }

    if (!upstream.ok) {
        // Never pass the upstream body through — it can carry request detail,
        // and a rate-limit or billing message is not the visitor's problem.
        console.error('anthropic ' + upstream.status + ': ' + await upstream.text());
        return json({
            error: 'The assistant is having trouble. The contact form still works.'
        }, 502);
    }

    const data = await upstream.json();
    const reply = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();

    if (!reply) {
        return json({ error: 'No answer came back. Try asking differently.' }, 502);
    }

    return json({ reply, stop_reason: data.stop_reason });
}

// Anything that is not a POST. Pages would otherwise return the static 404
// page as HTML to a fetch expecting JSON.
export async function onRequest(context) {
    if (context.request.method === 'POST') return onRequestPost(context);
    return json({ error: 'POST only.' }, 405);
}
