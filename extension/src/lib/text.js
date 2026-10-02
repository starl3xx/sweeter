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

  // opts.hideUrls: t.co URLs to drop (the quoted post’s permalink, media links).
  function richText(text, entities, range, opts) {
    const cps = Array.from(String(text || ''));
    const start = range ? range[0] : 0;
    const end = range ? Math.min(range[1], cps.length) : cps.length;
    const hide = new Set((opts && opts.hideUrls) || []);
    const spans = [];
    const e = entities || {};

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

    spans.sort((a, b) => a.s - b.s || b.e - a.e);
    let out = '';
    let pos = start;
    for (const sp of spans) {
      if (sp.s < pos || sp.s >= end) continue; // overlapping or outside the visible range
      out += plain(cps.slice(pos, sp.s).join(''));
      out += sp.html;
      pos = Math.min(sp.e, end);
    }
    if (pos < end) out += plain(cps.slice(pos, end).join(''));
    return out.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '');
  }

  // Plain text for mute matching and previews.
  function plainText(text, range) {
    const cps = Array.from(String(text || ''));
    const s = range ? range[0] : 0;
    const e = range ? range[1] : cps.length;
    return unescapeEntities(cps.slice(s, e).join(''));
  }

  Sweeter.text = { richText, plainText };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.text;
})(typeof globalThis !== 'undefined' ? globalThis : this);
