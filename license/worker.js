// Sweeter's license server: a Cloudflare Worker. Not deployed yet; Sweeter
// is free while Licensing.enforced is false in the app.
//
// It sells Sweeter through Stripe Checkout and hands the buyer's Mac a
// signed license key. No accounts, and nothing personal kept here: Stripe
// holds the buyer's email for the receipt; this keeps a random license key
// per paid checkout.
//
// The Mac makes a secret (the nonce) and sends only its SHA-256 (the
// claim), which rides through Checkout as client_reference_id. When Stripe
// reports the payment, the key is filed under the claim, and only the Mac
// holding the nonce can fetch it.
//
// Routes, under BASE:
//   POST /checkout   {claim}       -> {url}  a Checkout Session for that Mac
//   POST /webhook    (from Stripe) -> signs a key once a checkout is paid
//   GET  /claim?nonce=…            -> {key}  for the Mac that holds the nonce
//   GET  /thanks?session_id=…      -> the page Checkout returns to, with the key
//
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID,
// LICENSE_SIGNING_KEY (Ed25519 private key, PKCS#8 DER, base64),
// LICENSES (a KV namespace), SITE (where Checkout's Cancel goes).
//
// A key: "SWEETER-" + base64url(payload) + "." + base64url(signature), the
// Ed25519 signature over the payload's bytes, and the payload
// {"v":1,"id":"<uuid>","p":"sweeter","e":<edition>,"t":<unix seconds>}.
// The app verifies it offline (Licensing.verify).

const BASE = '/sweeter/license';
const EDITION = 1;
const HEX64 = /^[0-9a-f]{64}$/;
const SESSION = /^cs_(test|live)_[A-Za-z0-9]{8,200}$/;
const CLAIM_TTL = 7 * 86400;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(BASE + '/')) return text('Not found', 404);
    const route = url.pathname.slice(BASE.length);
    try {
      if (route === '/checkout' && request.method === 'POST') return await checkout(request, env, url);
      if (route === '/webhook' && request.method === 'POST') return await webhook(request, env);
      if (route === '/claim' && request.method === 'GET') return await claim(url, env);
      if (route === '/thanks' && request.method === 'GET') return await thanks(url, env);
    } catch (e) {
      return json({ error: 'server' }, 500);
    }
    return text('Not found', 404);
  },
};

// A Checkout Session for the Mac that sent this claim.
async function checkout(request, env, url) {
  let body = null;
  try {
    body = await request.json();
  } catch (e) {}
  const c = body && typeof body.claim === 'string' ? body.claim : '';
  if (!HEX64.test(c)) return json({ error: 'claim' }, 400);
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    client_reference_id: c,
    success_url: url.origin + BASE + '/thanks?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: env.SITE,
    'metadata[product]': 'sweeter',
    'metadata[edition]': String(EDITION),
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const s = await r.json();
  if (!r.ok || !s.url) return json({ error: 'stripe' }, 502);
  return json({ url: s.url });
}

// Stripe's word that a checkout is paid: sign its key (once).
async function webhook(request, env) {
  const raw = await request.text();
  if (!(await stripeSigned(raw, request.headers.get('Stripe-Signature') || '', env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'signature' }, 400);
  }
  const event = JSON.parse(raw);
  const s = event.data && event.data.object;
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  if (paid && s && s.payment_status === 'paid' && s.metadata && s.metadata.product === 'sweeter') await issue(s, env);
  return json({ received: true });
}

async function issue(session, env) {
  let key = await env.LICENSES.get('session:' + session.id);
  if (!key) {
    key = await signLicense({ v: 1, id: crypto.randomUUID(), p: 'sweeter', e: EDITION, t: Math.floor(Date.now() / 1000) }, env.LICENSE_SIGNING_KEY);
    await env.LICENSES.put('session:' + session.id, key);
  }
  if (HEX64.test(session.client_reference_id || '')) {
    await env.LICENSES.put('claim:' + session.client_reference_id, key, { expirationTtl: CLAIM_TTL });
  }
  return key;
}

// The key, for the Mac holding the nonce whose hash was the claim.
async function claim(url, env) {
  const nonce = url.searchParams.get('nonce') || '';
  if (!HEX64.test(nonce)) return json({ error: 'nonce' }, 400);
  const key = await env.LICENSES.get('claim:' + (await sha256hex(nonce)));
  return key ? json({ key }) : json({ pending: true }, 404);
}

// Where Checkout returns: the key, for the buyer to keep. The session id
// is Stripe's own and unguessable; the page waits for the webhook if it
// hasn't arrived yet.
async function thanks(url, env) {
  const sid = url.searchParams.get('session_id') || '';
  if (!SESSION.test(sid)) return text('Not found', 404);
  const key = await env.LICENSES.get('session:' + sid);
  const body = key
    ? '<h1>Thank you!</h1><p>Sweeter unlocks on its own in a moment on the Mac you bought it from.</p>' +
      '<p>Your license key. Keep it to unlock Sweeter on your other Macs (Sweeter ▸ Enter License Key…):</p>' +
      '<p><code>' + escapeHtml(key) + '</code></p>'
    : '<h1>Thank you!</h1><p>Finishing up. This page refreshes in a moment.</p>';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    (key ? '' : '<meta http-equiv="refresh" content="3">') +
    '<title>Sweeter</title><style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#1d1d1f}' +
    'code{display:block;word-break:break-all;background:#f2f2f4;padding:12px;border-radius:8px;font-size:13px;user-select:all}</style></head><body>' +
    body + '</body></html>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// ---------- signing and checking ----------

export async function signLicense(payload, pkcs8Base64) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('pkcs8', fromBase64(pkcs8Base64), { name: 'Ed25519' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, bytes));
  return 'SWEETER-' + base64url(bytes) + '.' + base64url(sig);
}

// Stripe-Signature: "t=<unix>,v1=<hex hmac>[,v1=…]", the HMAC-SHA256 of
// "<t>.<body>" with the endpoint's secret, within five minutes.
export async function stripeSigned(raw, header, secret, now = Date.now()) {
  const parts = header.split(',').map((p) => p.split('='));
  const t = (parts.find(([k]) => k === 't') || [])[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || !secret || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + raw))));
  return sigs.some((s) => same(s, mac));
}

// ---------- helpers ----------

function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sha256hex(s) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
}

function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64(s) {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function text(s, status = 200) {
  return new Response(s, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
