// Sweeter's background script (Safari). One job: fetch tokens' pairs from
// DexScreener's public API, for a contract address the reader clicked or
// ticker cards on screen (up to 30 addresses, comma-separated). X's page
// policy (connect-src) does not allow that host, so the content script asks
// here. Only valid addresses, only DexScreener, no credentials.
(function () {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const ADDRESSES = /^(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?:,(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})){0,29}$/;
  // A token logo from DexScreener's image server, as a data: URL (X's page
  // allows no other image host). Only https on dexscreener.com, images only,
  // small.
  function logo(url, sendResponse) {
    let u;
    try {
      u = new URL(String(url || ''));
    } catch (e) {
      return false;
    }
    if (u.protocol !== 'https:' || !/(^|\.)dexscreener\.com$/.test(u.hostname)) return false;
    fetch(u.toString(), { credentials: 'omit' })
      .then((r) => (r.ok && /^image\//.test(r.headers.get('content-type') || '') ? r.arrayBuffer().then((b) => ({ b, type: r.headers.get('content-type').split(';')[0] })) : Promise.reject(new Error('HTTP ' + r.status))))
      .then(({ b, type }) => {
        if (b.byteLength > 200000) throw new Error('too big');
        let s = '';
        const bytes = new Uint8Array(b);
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        sendResponse({ ok: true, body: 'data:' + type + ';base64,' + btoa(s) });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'dexLogo') return logo(msg.url, sendResponse);
    if (!msg || msg.type !== 'dex' || !ADDRESSES.test(String(msg.address || ''))) return false;
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + msg.address, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((body) => sendResponse({ ok: true, body }), () => sendResponse({ ok: false }));
    return true;
  });
})();
