// Sweeter's background script (Safari): fetches what X's page policy
// (connect-src, img-src) does not allow from the page. Tokens' pairs from
// DexScreener's public API, for a contract address the reader clicked or
// ticker cards on screen (up to 30 addresses, comma-separated); token logos
// from DexScreener, or GeckoTerminal and CoinGecko when DexScreener has
// none; the latest Sweeter release on GitHub. Only valid input, only those
// hosts, no credentials.
(function () {
  'use strict';
  const api = globalThis.browser || globalThis.chrome;
  const ADDRESSES = /^(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?:,(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})){0,29}$/;
  // An image as a data: URL (X's page allows no other image host): images
  // only, 200 KB at most.
  function imageData(url) {
    return fetch(url, { credentials: 'omit' })
      .then((r) => (r.ok && /^image\//.test(r.headers.get('content-type') || '') ? r.arrayBuffer().then((b) => ({ b, type: r.headers.get('content-type').split(';')[0] })) : Promise.reject(new Error('HTTP ' + r.status))))
      .then(({ b, type }) => {
        if (b.byteLength > 200000) throw new Error('too big');
        let s = '';
        const bytes = new Uint8Array(b);
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return 'data:' + type + ';base64,' + btoa(s);
      });
  }
  // A token logo from DexScreener's image server. Only https on
  // dexscreener.com.
  function logo(url, sendResponse) {
    let u;
    try {
      u = new URL(String(url || ''));
    } catch (e) {
      return false;
    }
    if (u.protocol !== 'https:' || !/^(cdn|dd)\.dexscreener\.com$/.test(u.hostname)) return false;
    imageData(u.toString()).then((body) => sendResponse({ ok: true, body }), () => sendResponse({ ok: false }));
    return true;
  }
  // A token logo when DexScreener has none: GeckoTerminal's public API for
  // that network and address, then CoinGecko's small image. Only those
  // hosts, only valid networks and addresses.
  const GECKO_NETS = new Set(['eth', 'base', 'solana', 'arbitrum', 'optimism', 'polygon_pos', 'bsc', 'avax', 'blast', 'linea', 'zksync', 'hyperevm', 'unichain', 'abstract', 'sonic', 'robinhood', 'ink', 'berachain', 'mantle', 'scroll', 'tron', 'pulsechain', 'world-chain', 'apechain', 'monad', 'megaeth', 'plasma']);
  const ONE = /^(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
  function geckoLogo(network, address, sendResponse) {
    if (!GECKO_NETS.has(network) || !ONE.test(String(address || ''))) return false;
    fetch('https://api.geckoterminal.com/api/v2/networks/' + network + '/tokens/' + address, { credentials: 'omit', headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((j) => {
        const u = new URL(String((j && j.data && j.data.attributes && j.data.attributes.image_url) || ''));
        if (u.protocol !== 'https:' || !/^(coin-images|assets)\.coingecko\.com$/.test(u.hostname)) throw new Error('no image');
        u.pathname = u.pathname.replace('/large/', '/small/');
        return imageData(u.toString());
      })
      .then((body) => sendResponse({ ok: true, body }), () => sendResponse({ ok: false }));
    return true;
  }
  // The latest Sweeter release on GitHub, for Check for Updates: its tag,
  // the start of its notes, its page and its zip. Nothing is downloaded.
  function latestRelease(sendResponse) {
    fetch('https://api.github.com/repos/starl3xx/sweeter/releases/latest', { credentials: 'omit', headers: { accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((j) => {
        const zip = (j.assets || []).find((a) => /\.zip$/i.test(a.name || ''));
        sendResponse({ ok: true, body: { tag: String(j.tag_name || ''), notes: String(j.body || '').slice(0, 2000), page: String(j.html_url || ''), zip: zip ? String(zip.browser_download_url || '') : '' } });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'latestRelease') return latestRelease(sendResponse);
    if (msg && msg.type === 'dexLogo') return logo(msg.url, sendResponse);
    if (msg && msg.type === 'geckoLogo') return geckoLogo(String(msg.network || ''), String(msg.address || ''), sendResponse);
    if (!msg || msg.type !== 'dex' || !ADDRESSES.test(String(msg.address || ''))) return false;
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + msg.address, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((body) => sendResponse({ ok: true, body }), () => sendResponse({ ok: false }));
    return true;
  });
})();
