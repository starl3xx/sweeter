// The license server end to end, without Stripe or Cloudflare: a test key,
// an in-memory KV, and a stand-in for Stripe's API. node license/test.mjs
//
// With an argument, it also writes a key and its public key there, for the
// app's verifier to check (license/README.md).
import crypto from 'node:crypto';
import fs from 'node:fs';
import worker, { stripeSigned } from './worker.js';

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + '\n    ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e));
  }
}
const ok = (v, msg) => {
  if (!v) throw new Error(msg || 'expected truthy');
};
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
};

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const rawPublic = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
const store = new Map();
const env = {
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_PRICE_ID: 'price_test',
  SITE: 'https://starl3xx.fun/sweeter',
  LICENSE_SIGNING_KEY: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  LICENSES: {
    get: async (k) => (store.has(k) ? store.get(k).v : null),
    put: async (k, v, o) => void store.set(k, { v, o }),
  },
};
const sent = [];
globalThis.fetch = async (u, init) => {
  sent.push({ u: String(u), init });
  return new Response(JSON.stringify({ id: 'cs_test_abc12345', url: 'https://checkout.stripe.com/c/pay/cs_test_abc12345' }), { status: 200 });
};

const BASE = 'https://starl3xx.fun/sweeter/license';
const call = (path, init) => worker.fetch(new Request(BASE + path, init), env);
const nonce = crypto.randomBytes(32).toString('hex');
const claim = crypto.createHash('sha256').update(nonce).digest('hex');
const signedEvent = (event, secret = env.STRIPE_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) => {
  const raw = JSON.stringify(event);
  const mac = crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
  return { method: 'POST', body: raw, headers: { 'Stripe-Signature': 't=' + t + ',v1=' + mac } };
};
const paid = (over) => ({
  type: 'checkout.session.completed',
  data: { object: Object.assign({ id: 'cs_test_abc12345', client_reference_id: claim, payment_status: 'paid', metadata: { product: 'sweeter' } }, over) },
});
const parse = (key) => {
  const [p, s] = key.slice('SWEETER-'.length).split('.');
  const b = (x) => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return { payload: b(p), sig: b(s) };
};

await test('checkout makes a Stripe session for the claim', async () => {
  const r = await call('/checkout', { method: 'POST', body: JSON.stringify({ claim }), headers: { 'Content-Type': 'application/json' } });
  eq(r.status, 200);
  const o = await r.json();
  ok(o.url.startsWith('https://checkout.stripe.com/'));
  const form = new URLSearchParams(sent[0].init.body);
  eq(form.get('client_reference_id'), claim);
  eq(form.get('mode'), 'payment');
  eq(form.get('line_items[0][price]'), 'price_test');
  eq(form.get('metadata[product]'), 'sweeter');
  ok(form.get('success_url').startsWith(BASE + '/thanks?session_id='));
});

await test('checkout refuses anything but a 64-hex claim', async () => {
  for (const c of ['', 'abc', claim.toUpperCase(), claim + '0', null]) {
    const r = await call('/checkout', { method: 'POST', body: JSON.stringify({ claim: c }) });
    eq(r.status, 400, String(c));
  }
});

await test('nothing to claim before the payment', async () => {
  eq((await call('/claim?nonce=' + nonce)).status, 404);
});

await test('a webhook with a wrong or old signature is refused', async () => {
  eq((await call('/webhook', signedEvent(paid(), 'whsec_other'))).status, 400);
  eq((await call('/webhook', signedEvent(paid(), undefined, Math.floor(Date.now() / 1000) - 600))).status, 400);
  eq((await call('/webhook', { method: 'POST', body: JSON.stringify(paid()) })).status, 400);
  eq((await call('/claim?nonce=' + nonce)).status, 404);
});

await test('an unpaid or foreign checkout signs nothing', async () => {
  eq((await call('/webhook', signedEvent(paid({ id: 'cs_test_unpaid0001', payment_status: 'unpaid' })))).status, 200);
  eq((await call('/webhook', signedEvent(paid({ id: 'cs_test_other00001', metadata: { product: 'griddle' } })))).status, 200);
  ok(!store.has('session:cs_test_unpaid0001') && !store.has('session:cs_test_other00001'));
});

let key = '';
await test('a paid checkout: the Mac with the nonce claims a valid key', async () => {
  eq((await call('/webhook', signedEvent(paid()))).status, 200);
  const r = await call('/claim?nonce=' + nonce);
  eq(r.status, 200);
  key = (await r.json()).key;
  ok(/^SWEETER-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key), key);
  const { payload, sig } = parse(key);
  ok(crypto.verify(null, payload, publicKey, sig), 'signature');
  const o = JSON.parse(payload);
  eq([o.v, o.p, o.e], [1, 'sweeter', 1]);
  ok(/^[0-9a-f-]{36}$/.test(o.id) && Math.abs(o.t - Date.now() / 1000) < 60);
  eq(Object.keys(o).sort(), ['e', 'id', 'p', 't', 'v'], 'nothing personal in the key');
  eq(store.get('claim:' + claim).o, { expirationTtl: 604800 });
});

await test('a repeated webhook keeps the same key', async () => {
  await call('/webhook', signedEvent(paid()));
  eq((await (await call('/claim?nonce=' + nonce)).json()).key, key);
});

await test('another nonce claims nothing', async () => {
  eq((await call('/claim?nonce=' + crypto.randomBytes(32).toString('hex'))).status, 404);
  eq((await call('/claim?nonce=' + claim)).status, 404, 'the claim itself is not the nonce');
  eq((await call('/claim?nonce=xyz')).status, 400);
});

await test('the thanks page shows the key; an unknown session waits', async () => {
  const r = await call('/thanks?session_id=cs_test_abc12345');
  ok((await r.text()).includes(key));
  const w = await (await call('/thanks?session_id=cs_test_zzzzzzzzzz')).text();
  ok(w.includes('refresh') && !w.includes('SWEETER-'));
  eq((await call('/thanks?session_id=<script>')).status, 404);
});

await test('a tampered key fails the signature', async () => {
  const { payload, sig } = parse(key);
  const o = JSON.parse(payload);
  o.e = 9;
  ok(!crypto.verify(null, Buffer.from(JSON.stringify(o)), publicKey, sig));
});

await test('stripeSigned takes any of several v1 signatures', async () => {
  const t = Math.floor(Date.now() / 1000);
  const mac = crypto.createHmac('sha256', 's').update(t + '.x').digest('hex');
  ok(await stripeSigned('x', 't=' + t + ',v1=' + 'a'.repeat(64) + ',v1=' + mac, 's'));
  ok(!(await stripeSigned('x', 't=' + t + ',v1=' + 'a'.repeat(64), 's')));
});

if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], JSON.stringify({ key, publicKey: rawPublic }));
}
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
