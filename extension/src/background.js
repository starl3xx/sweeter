// Sweeter's background script (Safari). One job: fetch tokens' pairs from
// DexScreener's public API, for a contract address the reader clicked or
// ticker cards on screen (up to 30 addresses, comma-separated). X's page
// policy (connect-src) does not allow that host, so the content script asks
// here. Only valid addresses, only DexScreener, no credentials.
(function () {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const ADDRESSES = /^(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?:,(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})){0,29}$/;
  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'dex' || !ADDRESSES.test(String(msg.address || ''))) return false;
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + msg.address, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((body) => sendResponse({ ok: true, body }), () => sendResponse({ ok: false }));
    return true;
  });
})();
