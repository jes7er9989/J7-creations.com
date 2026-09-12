// Web Push, without a payload.
//
// A COPY. The original lives in the CRM repo at functions/api/_push.js. These
// are two separate Cloudflare Pages projects with separate deploys, so there is
// no shared module to import — the same reason intake.js restates shaping logic
// the CRM also has. If you change one, change the other: they sign with the
// same key pair and write to the same push_subscription table.
//
// Thomas's call, 12 Sep 2026: Discord is out of his workflow entirely, and the
// CRM is an installed app on his phone, so the notification should come from
// the app rather than from a third-party chat service.
//
// The important design decision here is that the push carries NOTHING. Not the
// name, not the message, not the service. Just "an enquiry arrived, open the
// CRM". Three things follow from that, and they are the whole reason for it:
//
//   1. No customer data is transmitted to anyone. Apple's and Google's push
//      services relay a bare wake-up, so there is nothing for them to hold and
//      nothing for the privacy page to disclose about them.
//   2. The VAPID private key has to live on the PUBLIC site project, because
//      the instant ping has to happen when the enquiry lands and the CRM is not
//      running then. A leaked key that can only buzz a phone is a nuisance; one
//      that could ship customer records would not be.
//   3. There is no payload to encrypt, so RFC 8291 (aes128gcm, HKDF, the whole
//      apparatus) is simply not needed. What is left is a signed JWT, which
//      Web Crypto does natively.
//
// If detail is ever wanted in the notification itself, that is when the
// encryption layer gets written — and when the privacy page gains a paragraph.
// Not before.

const TTL = 3600;              // an hour. A stale "you have an enquiry" helps nobody.
const JWT_LIFETIME = 12 * 3600;

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = str => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (str.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

const enc = new TextEncoder();

/**
 * Sign a VAPID JWT for one push service origin.
 *
 * The audience is the ORIGIN of the endpoint, not the endpoint itself — a JWT
 * scoped to the full URL is rejected, and the error from the push service says
 * only "401", which is a bad afternoon.
 */
async function vapidToken(endpoint, privateJwk, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + JWT_LIFETIME,
    sub: subject,
  })));
  const signingInput = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  // Web Crypto returns the raw r||s pair, which is exactly what JWS ES256
  // wants — no DER unwrapping, unlike most server-side crypto libraries.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)
  );

  return `${signingInput}.${b64url(signature)}`;
}

/** Parse the JSON private key out of a binding, or return null with a reason. */
export function vapidConfig(env) {
  if (!env.VAPID_PRIVATE_KEY) return { error: 'VAPID_PRIVATE_KEY is not bound' };
  if (!env.VAPID_PUBLIC_KEY) return { error: 'VAPID_PUBLIC_KEY is not bound' };
  let jwk;
  try {
    jwk = JSON.parse(env.VAPID_PRIVATE_KEY);
  } catch {
    return { error: 'VAPID_PRIVATE_KEY is not the JSON key that scripts/vapid-keys.mjs printed' };
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) {
    return { error: 'VAPID_PRIVATE_KEY is not a P-256 private key' };
  }
  return {
    jwk,
    publicKey: env.VAPID_PUBLIC_KEY,
    subject: env.VAPID_SUBJECT || 'mailto:t.i@j7creations.com',
  };
}

/**
 * Send one wake-up to one subscription.
 *
 * Returns { ok, status, gone } — `gone` means the push service says this
 * subscription is dead (404/410), which is the signal to stop sending to it.
 * Browsers rotate endpoints, phones get wiped, apps get uninstalled; a store of
 * subscriptions that never prunes itself becomes a store of 404s.
 */
export async function sendPush(config, subscription) {
  let jwt;
  try {
    jwt = await vapidToken(subscription.endpoint, config.jwk, config.subject);
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: `could not sign: ${err.message}` };
  }

  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        // No payload, so no Content-Encoding and no body. Some services are
        // strict about Content-Length on an empty POST, hence the explicit 0.
        'authorization': `vapid t=${jwt}, k=${config.publicKey}`,
        'ttl': String(TTL),
        'content-length': '0',
        'urgency': 'high',
      },
      signal: AbortSignal.timeout(10_000),
    });

    return {
      ok: res.ok,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
      error: res.ok ? undefined : (await res.text().catch(() => '')).slice(0, 200) || `HTTP ${res.status}`,
    };
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: err.message };
  }
}

/**
 * Wake every device Thomas has installed the app on, and prune the dead ones.
 *
 * Never throws. A notification that fails to send must not fail the enquiry
 * that triggered it — the row is already written, the email already sent, and
 * the inbox will show it the next time he looks. Losing the ping costs him
 * minutes; losing the enquiry costs him a job.
 */
export async function notifyDevices(env, db) {
  const config = vapidConfig(env);
  if (config.error) return { sent: 0, reason: config.error };

  const { results } = await db.prepare(
    `select id, endpoint, failures from push_subscription
      where deleted_at is null order by created_at`
  ).all();

  if (!results.length) return { sent: 0, reason: 'no devices are subscribed' };

  let sent = 0;
  const retire = [];
  const succeeded = [];
  const failed = [];

  for (const sub of results) {
    const result = await sendPush(config, sub);
    if (result.ok) { sent++; succeeded.push(sub.id); continue; }
    if (result.gone) { retire.push(sub.id); continue; }
    failed.push({ id: sub.id, error: result.error });
  }

  const writes = [];
  const at = new Date().toISOString();

  if (succeeded.length) {
    writes.push(db.prepare(
      `update push_subscription set last_ok_at = ?1, failures = 0, last_error = null
        where id in (${succeeded.map(() => '?').join(',')})`
    ).bind(at, ...succeeded));
  }
  if (retire.length) {
    // Soft-deleted, not removed: "this phone stopped accepting pushes on the
    // 14th" is worth being able to read when notifications mysteriously stop.
    writes.push(db.prepare(
      `update push_subscription set deleted_at = ?1, last_error = 'push service says gone'
        where id in (${retire.map(() => '?').join(',')})`
    ).bind(at, ...retire));
  }
  for (const f of failed) {
    writes.push(db.prepare(
      `update push_subscription set failures = failures + 1, last_error = ?1 where id = ?2`
    ).bind(String(f.error).slice(0, 300), f.id));
  }
  if (writes.length) await db.batch(writes);

  return { sent, retired: retire.length, failed: failed.length, devices: results.length };
}

export { b64url, b64urlDecode };
