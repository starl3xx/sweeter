// Turns a post’s text plus its entities into safe HTML.
//
// Verified against live X Pro data (2026-09-28): entity indices and
// display_text_range count Unicode code points, not UTF-16 units, and they
// count the text as delivered, with &amp; &lt; &gt; still escaped.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});
  const { escapeHtml, unescapeEntities, safeUrl } = Sweeter.util;

  function plain(s) {
    return escapeHtml(unescapeEntities(s)).replace(/\n/g, '<br>');
  }

  // Crypto contract addresses in plain text (never inside a link): EVM
  // (0x and 40 hex digits; a 64-digit transaction hash does not match) and
  // Solana (base58, 32 to 44 characters, with a digit and both cases, so
  // long words don’t match). Shown shortened and linked to DexScreener;
  // Sweeter’s click opens a card with the token’s numbers.
  const CA = /(?<![0-9A-Za-z])(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?![0-9A-Za-z])/g;
  function isAddress(a) {
    return a.startsWith('0x') || (/[0-9]/.test(a) && /[a-z]/.test(a) && /[A-Z]/.test(a));
  }
  function addressLink(a) {
    return '<a class="ca" href="https://dexscreener.com/search?q=' + encodeURIComponent(a) + '" target="_blank" rel="noopener noreferrer" data-ca="' + escapeHtml(a) + '" title="' + escapeHtml(a) + '">' + escapeHtml(a.slice(0, 6) + '…' + a.slice(-4)) + '</a>';
  }
  function plainLinked(s) {
    let out = '';
    let last = 0;
    CA.lastIndex = 0;
    for (let m; (m = CA.exec(s)); ) {
      if (!isAddress(m[0])) continue;
      out += plain(s.slice(last, m.index)) + addressLink(m[0]);
      last = m.index + m[0].length;
    }
    return out + plain(s.slice(last));
  }

  // opts.hideUrls: t.co URLs to drop (the quoted post’s permalink, media links).
  function richText(text, entities, range, opts) {
    const cps = Array.from(String(text || ''));
    const start = range ? range[0] : 0;
    const end = range ? Math.min(range[1], cps.length) : cps.length;
    const hide = new Set((opts && opts.hideUrls) || []);
    const spans = [];
    const e = entities || {};
    // Real bold and italic (a long post's richtext), as code point ranges
    // {s, e, bold, italic}: a mask per code point (1 bold, 2 italic).
    const mask = new Uint8Array(cps.length);
    for (const r of (opts && opts.styles) || []) {
      const bit = (r.bold ? 1 : 0) | (r.italic ? 2 : 0);
      for (let i = Math.max(0, r.s); i < Math.min(cps.length, r.e); i++) mask[i] |= bit;
    }
    const wrap = (html, m) => (m & 2 ? '<em>' : '') + (m & 1 ? '<strong>' : '') + html + (m & 1 ? '</strong>' : '') + (m & 2 ? '</em>' : '');
    // Plain text from a to b, in runs of one style each.
    const plain = (a, b) => {
      let html = '';
      let i = a;
      while (i < b) {
        let j = i + 1;
        while (j < b && mask[j] === mask[i]) j++;
        html += wrap(plainLinked(cps.slice(i, j).join('')), mask[i]);
        i = j;
      }
      return html;
    };

    for (const u of e.urls || []) {
      if (!u.indices) continue;
      if (hide.has(u.url)) {
        spans.push({ s: u.indices[0], e: u.indices[1], html: '' });
        continue;
      }
      const href = safeUrl(u.expanded_url || u.url);
      // Three ways to show a link; the “Links” preference picks one with CSS.
      const full = href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
      const domain = full.split(/[/?#]/)[0].replace(/^www\./i, '');
      spans.push({
        s: u.indices[0],
        e: u.indices[1],
        html:
          '<a class="u" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer" title="' + escapeHtml(href) + '">' +
          '<span class="ls">' + escapeHtml(u.display_url || href) + '</span><span class="ld">' + escapeHtml(domain) + '</span><span class="lf">' + escapeHtml(full) + '</span></a>',
      });
    }
    for (const m of e.media || []) {
      if (m.indices) spans.push({ s: m.indices[0], e: m.indices[1], html: '' });
    }
    for (const m of e.user_mentions || []) {
      if (!m.indices) continue;
      const shown = cps.slice(m.indices[0], m.indices[1]).join('') || '@' + m.screen_name;
      spans.push({
        s: m.indices[0],
        e: m.indices[1],
        html: '<a class="m" href="https://x.com/' + encodeURIComponent(m.screen_name) + '" target="_blank" rel="noopener noreferrer" data-user="' + escapeHtml(m.screen_name) + '">' + escapeHtml(unescapeEntities(shown)) + '</a>',
      });
    }
    for (const h of e.hashtags || []) {
      if (!h.indices) continue;
      spans.push({
        s: h.indices[0],
        e: h.indices[1],
        html: '<a class="h" href="https://x.com/hashtag/' + encodeURIComponent(h.text) + '" target="_blank" rel="noopener noreferrer">#' + escapeHtml(h.text) + '</a>',
      });
    }
    for (const c of e.symbols || []) {
      if (!c.indices) continue;
      spans.push({
        s: c.indices[0],
        e: c.indices[1],
        html: '<a class="h" href="https://x.com/search?q=%24' + encodeURIComponent(c.text) + '" target="_blank" rel="noopener noreferrer">$' + escapeHtml(c.text) + '</a>',
      });
    }

    // Smart tags (verified 2026-10-02): X writes a ticker as "chain:address"
    // (or "ripple:native") in the text, with its name and ticker beside it;
    // x.com shows it as $TICKER. So does Sweeter: a token with an address
    // gets the contract card on click, a native coin a cashtag search.
    for (const st of e.smarttags || []) {
      if (!st.indices) continue;
      const info = (st.tag && st.tag.info && st.tag.info.info) || {};
      const ticker = String(info.ticker || '');
      const m = /^([a-z0-9_-]+):(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(String(st.text || ''));
      if (!ticker && !m) continue;
      const label = ticker ? '$' + ticker : String(st.text);
      spans.push({
        s: st.indices[0],
        e: st.indices[1],
        html: m
          ? '<a class="ca tkl" href="https://dexscreener.com/search?q=' + encodeURIComponent(m[2]) + '" target="_blank" rel="noopener noreferrer" data-ca="' + escapeHtml(m[2]) + '" data-chain="' + escapeHtml(m[1]) + '" title="' + escapeHtml((info.name ? info.name + ', ' : '') + m[1] + ' ' + m[2]) + '">' + escapeHtml(label) + '</a>'
          : '<a class="h" href="https://x.com/search?q=%24' + encodeURIComponent(ticker) + '" target="_blank" rel="noopener noreferrer" title="' + escapeHtml(info.name || '') + '">' + escapeHtml(label) + '</a>',
      });
    }

    spans.sort((a, b) => a.s - b.s || b.e - a.e);
    let out = '';
    let pos = start;
    for (const sp of spans) {
      if (sp.s < pos || sp.s >= end) continue; // overlapping or outside the visible range
      out += plain(pos, sp.s);
      out += sp.html ? wrap(sp.html, mask[sp.s]) : '';
      pos = Math.min(sp.e, end);
    }
    if (pos < end) out += plain(pos, end);
    return out.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '');
  }

  // Plain text for mute matching and previews. A smart tag reads as its
  // $TICKER, as on x.com.
  function plainText(text, range, entities) {
    let cps = Array.from(String(text || ''));
    let s = range ? range[0] : 0;
    let e = range ? range[1] : cps.length;
    const tags = ((entities && entities.smarttags) || []).filter((t) => t.indices && t.tag && t.tag.info && t.tag.info.info && t.tag.info.info.ticker).sort((a, b) => b.indices[0] - a.indices[0]);
    for (const t of tags) {
      const [a, b] = t.indices;
      if (a < s || b > e) continue;
      const rep = Array.from('$' + t.tag.info.info.ticker);
      cps = cps.slice(0, a).concat(rep, cps.slice(b));
      e += rep.length - (b - a);
    }
    return unescapeEntities(cps.slice(s, e).join(''));
  }

  // Links typed in the compose window: the http(s) addresses X counts as 23
  // characters, less the punctuation that ends a sentence (a closing
  // bracket stays when the link opened one). Offsets count UTF-16 units,
  // as a textarea does.
  //
  // X also links a bare domain (starl3xx.fun/sweeter), as twitter-text does:
  // a common generic domain on its own, a two-letter country domain only
  // with a path (so file.md and e.g. stay text). Those come back with
  // https:// in front, for the preview card.
  const GTLDS = new Set('com net org edu gov mil int info biz name pro app dev xyz fun io ai co me gg so sh tv fm ly to cc ws site online store shop tech blog news art page link live life world today space website club cloud social finance money network systems digital media studio design agency email games one top vip lol wtf gay bio eco inc llc ltd'.split(' '));
  function trimEnd(url) {
    for (;;) {
      const last = url.slice(-1);
      if (/[.,;:!?'"”’»]/.test(last)) url = url.slice(0, -1);
      else if (last === ')' && url.split('(').length < url.split(')').length) url = url.slice(0, -1);
      else return url;
    }
  }
  function draftLinks(text) {
    const out = [];
    const s = String(text || '');
    const re = /https?:\/\/\S+/g;
    let m;
    while ((m = re.exec(s))) {
      const url = trimEnd(m[0]);
      if (/^https?:\/\/[^\s/?#]+\.[^\s/?#.]/.test(url)) out.push({ start: m.index, end: m.index + url.length, url });
    }
    const bare = /(^|[\s(“"'])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,24})(\/\S*)?)/gi;
    while ((m = bare.exec(s))) {
      const start = m.index + m[1].length;
      if (out.some((l) => start < l.end && start + m[2].length > l.start)) continue;
      const shown = trimEnd(m[2]);
      const tld = m[3].toLowerCase();
      const path = shown.includes('/');
      if (!(GTLDS.has(tld) || (tld.length === 2 && path))) continue;
      out.push({ start, end: start + shown.length, url: 'https://' + shown });
    }
    return out.sort((x, y) => x.start - y.start);
  }

  // ---------- style ranges: real bold and italic in the compose window ----------
  // Sorted, separate [start, end) pairs counted in UTF-16 units of the text,
  // as X counts its richtext tags and as a textarea counts its selection.
  function normRanges(list) {
    const out = [];
    for (const x of (list || []).filter((r) => r && r[1] > r[0]).map((r) => [r[0], r[1]]).sort((a, b) => a[0] - b[0])) {
      const last = out[out.length - 1];
      if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
      else out.push(x);
    }
    return out;
  }

  // Whether [a, b) lies wholly inside the ranges.
  function rangesCover(list, a, b) {
    let at = a;
    for (const [s, e] of normRanges(list)) {
      if (s > at) break;
      if (e > at) at = e;
      if (at >= b) return true;
    }
    return at >= b;
  }

  // A style on [a, b): off where it is wholly on, else on.
  function toggleRange(list, a, b) {
    if (b <= a) return normRanges(list);
    if (!rangesCover(list, a, b)) return normRanges((list || []).concat([[a, b]]));
    const out = [];
    for (const [s, e] of normRanges(list)) {
      if (e <= a || s >= b) out.push([s, e]);
      else {
        if (s < a) out.push([s, a]);
        if (e > b) out.push([b, e]);
      }
    }
    return out;
  }

  // The one edit that turns `before` into `after`: where, and how many
  // units went and came.
  function textEdit(before, after) {
    const max = Math.min(before.length, after.length);
    let p = 0;
    while (p < max && before.charCodeAt(p) === after.charCodeAt(p)) p++;
    let q = 0;
    while (q < max - p && before.charCodeAt(before.length - 1 - q) === after.charCodeAt(after.length - 1 - q)) q++;
    return { at: p, removed: before.length - p - q, inserted: after.length - p - q };
  }

  // The ranges after an edit. Text after it moves; removed text leaves its
  // range; text typed inside a range, at its end, or over text that began
  // in it joins it; text typed just before a range does not.
  function shiftRanges(list, ed) {
    const { at, removed, inserted } = ed;
    const end = at + removed;
    const out = [];
    for (const [s0, e0] of normRanges(list)) {
      let s = s0 <= at ? s0 : s0 >= end ? s0 - removed : at;
      let e = e0 <= at ? e0 : e0 >= end ? e0 - removed : at;
      const grows = (s0 < at && e0 >= at) || (removed > 0 && s0 <= at && e0 > at);
      if (s > at || (s === at && !grows)) s += inserted;
      if (e > at || (e === at && grows)) e += inserted;
      out.push([s, e]);
    }
    return normRanges(out);
  }

  Sweeter.text = { richText, plainText, draftLinks, normRanges, rangesCover, toggleRange, textEdit, shiftRanges };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.text;
})(typeof globalThis !== 'undefined' ? globalThis : this);
