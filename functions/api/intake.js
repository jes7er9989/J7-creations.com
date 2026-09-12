// POST /api/intake — the public site's only write into the CRM database.
//
// This runs on j7creations.com, not on crm.j7creations.com. The CRM subdomain
// sits behind Cloudflare Access with a blanket deny, which is exactly why this
// endpoint exists here instead of there: a visitor filling in the contact form
// has no login and never will. It is therefore the one unauthenticated write
// in the system, and it is written to be boring on purpose.
//
// What it does NOT do, deliberately:
//
//   * It never reads the client table. Matching an enquiry to an existing
//     customer happens inside the CRM, behind Access. If this endpoint did the
//     matching it would become an oracle: submit an address, watch the
//     response, learn whether that person is a customer. Write-only has no
//     such failure mode.
//
//   * It never affects the email path. The form still posts to Formspree
//     first, and this is fired afterwards, fire-and-forget. If D1 is down, if
//     this file has a bug, if the binding is missing — the enquiry still
//     reaches Thomas's inbox, because it already did before this ran.
//
//   * It returns nothing about the database. {ok:true} or an error, never a
//     row, never an id that means anything, never a count.

import { notifyDevices } from './_push.js';

const CHANNELS = new Set(['contact_form', 'chatbot', 'calculator']);

// Body cap. A contact form submission is a couple of KB; a full chat
// transcript is the only thing that gets large. 128KB is generous for the
// latter and still far too small to be useful to anyone filling the table.
const MAX_BODY = 128 * 1024;

// Per-field caps, applied by truncation rather than rejection: a customer who
// pasted their whole email thread into the message box should still get
// through, with a note saying it was trimmed.
const LIMITS = {
  name: 200, email: 320, phone: 60, location: 200, service: 80,
  message: 20_000, source_page: 300, dedupe: 120,
};

const DEFAULT_THROTTLE = 12;

function clip(value, max) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function clipped(value, max) {
  return typeof value === 'string' && value.trim().length > max;
}

// Crockford base32 ULID, same 26-character shape the CRM uses everywhere.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulid(now = Date.now()) {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) { time = B32[t % 32] + time; t = Math.floor(t / 32); }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let rand = '';
  for (let i = 0; i < 16; i++) rand += B32[bytes[i] % 32];
  return time + rand;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Anything that is not a POST of JSON is not a form submission.
//
// Everything below the dispatch is wrapped, because an exception escaping a
// Pages Function comes back to the browser as a bare Cloudflare 502 rather
// than as this file's JSON. The beacon ignores the response either way, so the
// visitor never sees it, but a 502 tells nobody anything and the log is the
// only place a failure would ever surface. Same pattern as api/chat.js.
export const onRequest = async ctx => {
  if (ctx.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  }
  if (ctx.request.method !== 'POST') {
    return json({ ok: false, error: 'POST only' }, 405);
  }
  try {
    return await handle(ctx);
  } catch (err) {
    console.error('J7 intake: unhandled', err && err.stack ? err.stack : String(err));
    return json({ ok: false, error: 'Could not record' }, 500);
  }
};

async function handle({ request, env, waitUntil }) {
  // The binding being absent is a deployment mistake, not a visitor's problem.
  // Say so in the log and answer 503 so the beacon does not keep trying, but
  // never let it surface on the page: the Formspree submit already succeeded.
  if (!env.DB) {
    console.error('J7 intake: no DB binding on this deployment');
    return json({ ok: false, error: 'Not configured' }, 503);
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return json({ ok: false, error: 'Too large' }, 413);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: 'Too large' }, 413);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'Body must be JSON' }, 400);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'Body must be a JSON object' }, 400);
  }

  const channel = CHANNELS.has(body.channel) ? body.channel : 'contact_form';

  // A submission with nothing in it is a bot or a bug, and either way it is
  // not worth a row in the inbox.
  const fields = {};
  for (const key of ['name', 'email', 'phone', 'location', 'service', 'message']) {
    fields[key] = clip(body[key], LIMITS[key]);
  }
  if (!fields.message && !fields.email && !fields.phone) {
    return json({ ok: false, error: 'Nothing to record' }, 400);
  }

  const trimmedFields = Object.keys(LIMITS).filter(k => clipped(body[k], LIMITS[k]));

  // A hashed address, salted, so a flood can be throttled without the
  // database holding anything that identifies a visitor. If the salt is not
  // configured the enquiry is still accepted — losing a customer's message is
  // a much worse outcome than an unthrottled write — and the row records that
  // the throttle was not available so the inbox can say so.
  const ip = request.headers.get('cf-connecting-ip');
  const salt = env.INTAKE_SALT;
  const ipHash = (ip && salt) ? (await sha256Hex(salt + '|' + ip)).slice(0, 32) : null;

  let throttleNote = null;
  if (ipHash) {
    try {
      const perHour = await throttleLimit(env);
      if (perHour > 0) {
        const since = new Date(Date.now() - 3600_000).toISOString();
        const seen = await env.DB.prepare(
          'select count(*) as c from enquiry where client_ip_hash = ? and received_at >= ?'
        ).bind(ipHash, since).first();
        if (seen && seen.c >= perHour) {
          return json({ ok: false, error: 'Too many' }, 429);
        }
      }
    } catch (err) {
      // Fail open, and record that it happened. If the count cannot be read
      // the choice is between dropping a customer's message and accepting one
      // unthrottled write, and that is not a close call.
      console.error('J7 intake: throttle check failed', err.message);
      throttleNote = 'unavailable: throttle count failed';
    }
  }

  // raw is the record of what was actually submitted and is never edited
  // afterwards, so everything the page knew goes in it, shaped but not
  // interpreted. The CRM's own summary lives in other columns.
  const raw = {
    channel,
    ...fields,
    intake: sane(body.intake, 60, 400),
    estimate: sane(body.estimate, 40, 2_000),
    transcript: transcript(body.transcript),
    // The files themselves stay on the Formspree path; these two are how the
    // inbox knows to say "3 files, in the email" instead of silently implying
    // the enquiry arrived with nothing attached.
    attachment_count: Math.min(Math.max(Number(body.attachment_count) || 0, 0), 99),
    attachment_names: Array.isArray(body.attachment_names)
      ? body.attachment_names.filter(n => typeof n === 'string').slice(0, 20).map(n => n.slice(0, 200))
      : null,
    // The assistant now asks for these and app.js fills the form's own fields
    // with them, so they arrive whether the customer typed them or tapped a
    // button. Numbers as numbers: "about two grand" is nothing to sort by.
    budget: budget(body.budget),
    // The band is what they picked on the form; the figure is what they said in
    // chat. They can disagree, and both are worth keeping: "$2,000" and
    // "1000-plus" tell you different things about how sure they are.
    budget_band: clip(body.budget_band, 40),
    timeline: TIMELINES.has(body.timeline) ? body.timeline : null,
    source_page: clip(body.source_page, LIMITS.source_page),
    user_agent: clip(request.headers.get('user-agent'), 400),
    country: request.cf?.country ?? null,
    received_via: 'beacon',
  };
  if (trimmedFields.length) raw.trimmed_fields = trimmedFields;
  if (ip && !salt) raw.throttle = 'unavailable: INTAKE_SALT not set';
  else if (throttleNote) raw.throttle = throttleNote;

  const id = ulid();
  const dedupe = clip(body.dedupe, LIMITS.dedupe);

  try {
    await env.DB.prepare(
      `insert into enquiry (id, channel, raw, client_ip_hash, dedupe_key, source_page)
       values (?, ?, ?, ?, ?, ?)`
    ).bind(id, channel, JSON.stringify(raw), ipHash, dedupe, raw.source_page).run();
  } catch (err) {
    // The unique partial index on dedupe_key is doing its job: the beacon
    // fired twice for one submission, which a flaky connection makes routine.
    // Two rows in the inbox read as two customers, so this is a success.
    if (/unique/i.test(err.message || '')) {
      return json({ ok: true, duplicate: true });
    }
    console.error('J7 intake: insert failed', err.message);
    return json({ ok: false, error: 'Could not record' }, 500);
  }

  // Buzz Thomas's phone, without waiting for it and without letting a failed
  // notification affect the answer. waitUntil keeps the worker alive past the
  // response so the visitor is never held up.
  //
  // The push carries NOTHING about them — not a name, not a word of the
  // message. It is a bare wake-up saying an enquiry arrived; everything else is
  // behind the Access login in the CRM. That is what lets the VAPID key live on
  // this public project at all: someone who steals it can buzz a phone and
  // nothing more. It is also why this page's privacy notice has nothing to
  // disclose about a notification service.
  const ping = notifyDevices(env, env.DB).catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(ping); else await ping;

  return json({ ok: true });
}

async function throttleLimit(env) {
  try {
    const row = await env.DB.prepare("select value from app_config where key = 'retention'").first();
    const cfg = row ? JSON.parse(row.value) : null;
    const n = cfg && Number(cfg.throttle_per_hour);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_THROTTLE;
  } catch {
    return DEFAULT_THROTTLE;
  }
}

// A flat object of short strings. Anything else — nested objects, arrays,
// functions smuggled through JSON — is dropped rather than stored, because
// `raw` has a json_valid CHECK on it and a surprise shape would fail the
// insert and lose the enquiry.
function sane(value, maxKeys, maxLen) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(value)) {
    if (n >= maxKeys) break;
    if (typeof k !== 'string' || k.length > 80) continue;
    if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; n++; continue; }
    if (Array.isArray(v)) {
      const flat = v.filter(x => typeof x === 'string').slice(0, 40).map(x => x.slice(0, maxLen));
      if (flat.length) { out[k] = flat; n++; }
      continue;
    }
    const s = clip(v, maxLen);
    if (s) { out[k] = s; n++; }
  }
  return n ? out : null;
}

// [{role, text}] and nothing else.
//
// js/chat.js stores the model's reply verbatim and strips its fenced blocks
// only when rendering, so a stored assistant turn still contains any raw
// ```j7-estimate or ```j7-choices block. The figures and the options arrive as
// structure elsewhere in this payload, so that JSON is duplication which would
// land in the inbox as unreadable noise. The beacon strips it too; this is the
// copy that matters, because this endpoint takes a transcript from anything
// that can POST.
const FENCED = /```j7-(?:estimate|choices)[\s\S]*?```/g;

function transcript(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const turn of value.slice(0, 200)) {
    if (!turn || typeof turn !== 'object') continue;
    const role = turn.role === 'assistant' ? 'assistant' : 'visitor';
    const cleaned = typeof turn.text === 'string'
      ? turn.text.replace(FENCED, '').trim()
      : turn.text;
    const t = clip(cleaned, 4_000);
    if (t) out.push({ role, text: t });
  }
  return out.length ? out : null;
}

const TIMELINES = new Set(['not-sure', 'flexible', 'soon', 'rush', 'urgent']);

// Dollars, as a number, or null. The widget strips "$" and commas before
// sending, but this endpoint is public and takes what it is given.
function budget(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n), 10_000_000);
}
