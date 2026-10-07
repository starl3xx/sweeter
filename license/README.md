# Sweeter’s license server

The plumbing for a paid Sweeter ($12, once, for v1). **Sweeter is free today:** the app’s switch, `Licensing.enforced` in `safari/Sweeter/Sweeter/Licensing.swift`, is `false`, so the app never reads or writes a license, starts no trial, and never calls this server. Nothing here is deployed.

## How it works

- **A 7-day trial.** It starts at the first launch of a paid build on a Mac (for that user). The start date lives in the Keychain, so it outlasts reinstalling the app or deleting its settings. The clock also keeps the latest time it has seen, so setting the date back gains no days.
- **After the trial, X Pro only.** The app checks at launch. Without a license, it doesn’t even install Sweeter’s scripts: X Pro shows as it is, below the window’s buttons, with **Unlock Sweeter…** and **Enter Key…** in the title bar. Nothing in the page can turn Sweeter’s view back on.
- **Buying, inside the app.** **Unlock Sweeter…** opens Stripe Checkout in a window of its own (no cookies kept). When Stripe reports the payment, the app fetches its key, keeps it in the Keychain, and Sweeter’s view comes back at once.
- **No accounts.** The Mac makes a secret (the *nonce*) and sends only its SHA-256 (the *claim*), which rides through Checkout as `client_reference_id`. The server files the key under the claim, and only the Mac holding the nonce can fetch it. If Sweeter quits during a checkout, it asks again at the next launch.
- **Keys are checked offline.** A key is signed with Ed25519, and the app checks it with the public key it carries. A key never leaves the Mac after the purchase. It names no person: a random id, the edition, and the day it was made.
- **Nothing personal kept here.** Stripe keeps the buyer’s email for the receipt. This server keeps one key per paid checkout session, and for 7 days, the key under its claim.

### The key

`SWEETER-` + base64url(payload) + `.` + base64url(Ed25519 signature over the payload’s bytes), the payload being

```json
{"v":1,"id":"<uuid>","p":"sweeter","e":1,"t":1791406511}
```

`e` is the edition: a v1 key unlocks every 1.x (and the 0.x builds before them).

### Routes (under `/sweeter/license`)

| Route | Does |
|---|---|
| `POST /checkout` `{claim}` | Makes a Checkout Session for that claim, returns `{url}` |
| `POST /webhook` | Stripe’s `checkout.session.completed` (or `async_payment_succeeded`), paid: signs the key, once per session |
| `GET /claim?nonce=…` | `{key}` for the Mac holding the nonce, or 404 while it waits |
| `GET /thanks?session_id=…` | The page Checkout returns to, with the key to keep |

### Environment

| Name | What |
|---|---|
| `STRIPE_SECRET_KEY` | The Stripe secret key (restricted: Checkout Sessions, write) |
| `STRIPE_WEBHOOK_SECRET` | The webhook endpoint’s signing secret |
| `STRIPE_PRICE_ID` | The $12 price |
| `LICENSE_SIGNING_KEY` | The Ed25519 private key, PKCS#8 DER, base64. Kept by the maintainer, never in this repository; the app carries the public half (`Licensing.publicKey`) |
| `LICENSES` | A KV namespace |
| `SITE` | Where Checkout’s Cancel goes (the Sweeter page) |

## Test

```sh
node license/test.mjs
```

The whole flow without Stripe or Cloudflare: a test key, an in-memory KV, and a stand-in for Stripe’s API. With a file path as its argument, it also writes a key and its public key there; the app’s verifier checks it like this:

```sh
node license/test.mjs /tmp/vector.json
cat > /tmp/main.swift <<'EOF'
import Foundation
let v = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))) as! [String: String]
print(Licensing.verify(v["key"]!, publicKey: v["publicKey"]!) != nil ? "valid" : "rejected")
EOF
swiftc -o /tmp/check safari/Sweeter/Sweeter/Licensing.swift /tmp/main.swift && /tmp/check /tmp/vector.json
```

## Before turning it on

Countermeasures, honestly: with the source public, nobody can be stopped from building their own copy without the check. What the plumbing does is make the official build need a key that can’t be forged, keep the check out of anything the page can change, and make getting around it a breach of the license.

1. **The license.** Move v1 to a license that forbids removing or getting around the license check (the Elastic License 2.0’s “license key” clause is the model). Earlier versions stay under PolyForm Noncommercial. Get it reviewed.
2. **Developer ID signing and notarization.** A release build unlocks only when it is signed by Sweeter’s team (`Licensing.officialBuild`), so a fork or a patched copy gets neither the trial nor a key. That needs Developer ID signing; today’s releases are signed ad hoc. Stable signing also keeps macOS from asking for Keychain access after each update.
3. **Web Inspector.** Release builds turn it off once the switch is on (`Licensing.inspectable`), so nobody can paste Sweeter’s scripts into a locked window.
4. **The Safari extension.** It needs the same gate: the extension asks its native handler (`SafariWebExtensionHandler`) whether Sweeter may show, and the handler reads the license from a Keychain access group the app and the extension share. Not built yet.
5. **Stripe.** Make the product and its $12 price, a restricted key, and a webhook endpoint for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
6. **Deploy this Worker** with the environment above, at `starl3xx.fun/sweeter/license` (`Licensing.server`).
7. **Lost keys.** A way to get a key again (for example, by the email used at checkout, sent by email). Not built yet.
8. **The words.** PRIVACY.md (Stripe and this server, what each keeps), TERMS.md (the purchase, refunds), the README, the website, and a trial count in Sweeter’s own view.
9. **Turn it on:** `Licensing.enforced = true`, in a release that does 1–8.
