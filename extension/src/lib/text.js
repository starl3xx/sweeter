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

  // A post's text as its author wrote it, for an edit: in its display
  // range, each link as its full address (X shortens it again), and the
  // links X shows another way (a quoted post, an article) left out, as X
  // Pro's own Edit does (module 714377). Its bold and italic come along
  // (styles: normalize's { s, e, bold, italic } in code points), as
  // ranges in UTF-16 units of the new text, as the compose window keeps
  // them. Indices count code points.
  function editableText(text, range, entities, hide, styles) {
    const cps = Array.from(String(text || ''));
    const s = range ? Math.max(0, range[0]) : 0;
    const e = range ? Math.min(range[1], cps.length) : cps.length;
    const urls = ((entities && entities.urls) || []).filter((u) => u && Array.isArray(u.indices) && u.indices[0] >= s && u.indices[1] <= e && u.indices[1] > u.indices[0]).sort((a, b) => a.indices[0] - b.indices[0]);
    // The text in pieces: plain runs and links, each with what it becomes.
    const pieces = [];
    let at = s;
    for (const u of urls) {
      const [a, b] = u.indices;
      if (a < at) continue;
      if (a > at) pieces.push({ a: at, b: a, out: unescapeEntities(cps.slice(at, a).join('')) });
      pieces.push({ a, b, link: true, out: (hide || []).includes(u.url) ? '' : String(u.expanded_url || u.url || '') });
      at = b;
    }
    if (e > at) pieces.push({ a: at, b: e, out: unescapeEntities(cps.slice(at, e).join('')) });
    const full = pieces.map((x) => x.out).join('');
    // Where code point cp of the post lands in the new text; a style edge
    // inside a link goes to the link's start (from) or end (to).
    const off = (cp, end) => {
      let n = 0;
      for (const x of pieces) {
        if (cp >= x.b) {
          n += x.out.length;
          continue;
        }
        if (cp <= x.a) return n;
        return n + (x.link ? (end ? x.out.length : 0) : unescapeEntities(cps.slice(x.a, cp).join('')).length);
      }
      return n;
    };
    const lead = full.length - full.trimStart().length;
    const out = full.trim();
    const fit = (v) => Math.max(0, Math.min(out.length, v - lead));
    const bold = [];
    const italic = [];
    for (const st of styles || []) {
      const a = fit(off(Math.max(st.s, s), false));
      const b = fit(off(Math.min(st.e, e), true));
      if (b <= a) continue;
      if (st.bold) bold.push([a, b]);
      if (st.italic) italic.push([a, b]);
    }
    return { text: out, bold: normRanges(bold), italic: normRanges(italic) };
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

  // ---------- polls in the compose window ----------
  // X Pro's poll rules (module 89438): 2 to 4 choices of up to 25
  // characters; a length of 0-7 days, 0-23 hours and 0-59 minutes, where 7
  // days allows no hours or minutes and a length under an hour is at least
  // 5 minutes. pollLength puts a length inside those rules and says what
  // each part may be now.
  const POLL_CHOICE_MAX = 25;
  function pollLength(p) {
    const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || 0));
    const days = int(p && p.days, 0, 7);
    const hours = days === 7 ? 0 : int(p && p.hours, 0, 23);
    const minLow = days === 0 && hours === 0 ? 5 : 0;
    const minutes = days === 7 ? 0 : int(p && p.minutes, minLow, 59);
    return { days, hours, minutes, hoursMax: days === 7 ? 0 : 23, minutesMin: minLow, minutesMax: days === 7 ? 0 : 59 };
  }
  // The choices X Pro gets: the filled ones, in order.
  const pollChoices = (p) => ((p && p.choices) || []).map((c) => String(c || '').trim()).filter(Boolean);
  // Why X Pro would refuse this poll, in words, or null. X Pro posts a poll
  // only with text (its question) and no media (module 89438's validity
  // check), and not in a quote.
  function pollProblem(text, p, o) {
    if (!p) return null;
    if (o && o.quote) return 'A quote post can’t have a poll.';
    if (o && o.media) return 'A post can have a poll or media, not both.';
    if (!String(text || '').trim()) return 'Ask your question in the text first.';
    const c = pollChoices(p);
    if (c.length < 2) return 'A poll needs at least two choices.';
    if (c.some((x) => x.length > POLL_CHOICE_MAX)) return 'A poll choice can be up to ' + POLL_CHOICE_MAX + ' characters.';
    return null;
  }

  // ---------- a scheduled post ----------
  // X Pro's schedule (module 331158): a date and a time to the minute, in
  // this Mac's time zone, after now and at most 18 months ahead (module
  // 283530). A time is { y, mo, d, h, mi }, with months 1 to 12.
  function whenDate(w) {
    if (!w) return null;
    const n = [w.y, w.mo, w.d, w.h, w.mi].map(Number);
    if (!n.every(Number.isInteger)) return null;
    const t = new Date(n[0], n[1] - 1, n[2], n[3], n[4]);
    // A day that rolled over (February 30) or an hour a clock change
    // skipped is not the time asked for.
    return t.getFullYear() === n[0] && t.getMonth() === n[1] - 1 && t.getDate() === n[2] && t.getHours() === n[3] && t.getMinutes() === n[4] ? t : null;
  }
  const whenOf = (t) => ({ y: t.getFullYear(), mo: t.getMonth() + 1, d: t.getDate(), h: t.getHours(), mi: t.getMinutes() });
  // Sending goes through X Pro's composer first, which takes a moment.
  const SCHEDULE_LEAD_MIN = 2;
  // Why X Pro would refuse to schedule this, in words, or null. X Pro
  // schedules no poll, and only a post everyone can reply to (module 89438,
  // _isSchedulingDisabled); a scheduled reply goes without bold or italic
  // (module 309505 sends its richtext only for a post that isn't a reply).
  function scheduleProblem(w, now, o) {
    const t = whenDate(w);
    if (!t) return 'Pick a date and time for the post.';
    const at = new Date(now).getTime();
    if (t.getTime() <= at) return 'You can’t schedule a post to send in the past.';
    if (t.getTime() < at + SCHEDULE_LEAD_MIN * 60000) return 'Pick a time at least ' + SCHEDULE_LEAD_MIN + ' minutes from now.';
    const max = new Date(at);
    max.setMonth(max.getMonth() + 18);
    if (t > max) return 'You can’t schedule a post more than 18 months in the future.';
    if (o && o.poll) return 'X Pro can’t schedule a post with a poll.';
    if (o && o.reply && o.reply !== 'Everyone') return 'X Pro schedules a post only when everyone can reply.';
    if (o && o.styledReply) return 'X Pro schedules a reply without bold or italic. Remove them, or reply now.';
    // X Pro schedules a long post only when it isn't a reply (module 89438).
    if (o && o.longReply) return 'X Pro can’t schedule a reply longer than 280 characters.';
    return null;
  }
  // “Tue, Oct 14 at 9:00 AM”, with the year when it isn't this one.
  function whenLabel(w, now) {
    const t = whenDate(w);
    if (!t) return '';
    const day = t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: t.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
    return day + ' at ' + t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // ---------- the search form ----------
  // X's search operators as a form, as X Pro's search filters (module
  // 309009) and x.com's advanced search offer them: fields make a query,
  // and a query fills the fields, keeping what no field holds (rest) as it
  // was typed. Lists of words or accounts are space- or comma-separated.
  // Three-way choices: '' (any), 'only', or 'none'.
  const SEARCH_FIELDS = { all: '', exact: '', any: '', none: '', tags: '', from: '', to: '', mention: '', site: '', replies: '', reposts: '', quotes: '', links: '', media: '', verified: false, follows: false, minReplies: '', minLikes: '', minReposts: '', since: '', until: '', lang: '', rest: '' };
  const SEARCH_TRI = { replies: 'replies', reposts: 'nativeretweets', quotes: 'quote', links: 'links' };
  const SEARCH_MEDIA = ['media', 'images', 'videos'];
  const SEARCH_MIN = { minReplies: 'min_replies', minLikes: 'min_faves', minReposts: 'min_retweets' };
  const SEARCH_LISTS = { from: ['from:', 'account'], to: ['to:', 'account'], mention: ['@', 'account'], tags: ['#', 'tag'] };
  // Words, "phrases", and (groups), each with an optional leading minus.
  function searchTokens(q) {
    const out = [];
    const s = String(q || '');
    let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) {
        i++;
        continue;
      }
      let j = i;
      if (s[j] === '-') j++;
      if (s[j] === '"') {
        const end = s.indexOf('"', j + 1);
        j = end < 0 ? s.length : end + 1;
      } else if (s[j] === '(') {
        let depth = 0;
        for (; j < s.length; j++) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')' && --depth === 0) {
            j++;
            break;
          }
        }
      } else while (j < s.length && !/\s/.test(s[j])) j++;
      out.push(s.slice(i, j));
      i = j;
    }
    return out;
  }
  const searchItems = (v, strip) =>
    String(v || '')
      .split(/[\s,]+/)
      .map((x) => (strip ? x.replace(strip, '') : x))
      .filter(Boolean);
  function searchParse(q) {
    const f = Object.assign({}, SEARCH_FIELDS);
    const add = (k, v) => (f[k] = f[k] ? f[k] + ' ' + v : v);
    const rest = [];
    const tokens = searchTokens(q);
    // A bare OR joins the words beside it: those stay as typed.
    const loose = tokens.includes('OR');
    for (const t of tokens) {
      const low = t.toLowerCase();
      let m;
      if (/^"[^"]+"$/.test(t) && !f.exact) f.exact = t.slice(1, -1);
      else if (/^\(.*\)$/.test(t)) {
        const items = t.slice(1, -1).trim().split(/\s+OR\s+/);
        const kind = (re) => items.length > 1 && items.every((x) => re.test(x));
        if (kind(/^from:\w{1,15}$/i)) items.forEach((x) => add('from', x.slice(5)));
        else if (kind(/^to:\w{1,15}$/i)) items.forEach((x) => add('to', x.slice(3)));
        else if (kind(/^@\w{1,15}$/)) items.forEach((x) => add('mention', x.slice(1)));
        else if (kind(/^#\w+$/)) items.forEach((x) => add('tags', x.slice(1)));
        else if (kind(/^[^\s"():\-#@][^\s"():]*$/) && !f.any) f.any = items.join(' ');
        else rest.push(t);
      } else if ((m = /^from:(\w{1,15})$/i.exec(t))) add('from', m[1]);
      else if ((m = /^to:(\w{1,15})$/i.exec(t))) add('to', m[1]);
      else if ((m = /^@(\w{1,15})$/.exec(t))) add('mention', m[1]);
      else if ((m = /^#(\w+)$/.exec(t))) add('tags', m[1]);
      else if ((m = /^url:(\S+)$/i.exec(t)) && !f.site) f.site = m[1];
      else if ((m = /^(-?)filter:(\w+)$/i.exec(low)) && Object.values(SEARCH_TRI).includes(m[2])) {
        const k = Object.keys(SEARCH_TRI).find((x) => SEARCH_TRI[x] === m[2]);
        if (f[k]) rest.push(t);
        else f[k] = m[1] ? 'none' : 'only';
      } else if ((m = /^filter:(\w+)$/.exec(low)) && SEARCH_MEDIA.includes(m[1]) && !f.media) f.media = m[1];
      else if (low === 'filter:blue_verified') f.verified = true;
      else if (low === 'filter:follows') f.follows = true;
      else if ((m = /^(min_replies|min_faves|min_retweets):(\d+)$/.exec(low))) f[Object.keys(SEARCH_MIN).find((k) => SEARCH_MIN[k] === m[1])] = m[2];
      else if ((m = /^(since|until):(\d{4}-\d{2}-\d{2})$/.exec(low))) f[m[1]] = m[2];
      else if ((m = /^lang:([a-z]{2,3}(-[a-z]+)?)$/.exec(low)) && !f.lang) f.lang = m[1];
      else if (!loose && /^-[^\s"():\-][^\s"():]*$/.test(t)) add('none', t.slice(1));
      else if (!loose && /^[^\s"():\-#@][^\s"():]*$/.test(t)) add('all', t);
      else rest.push(t);
    }
    f.rest = rest.join(' ');
    return f;
  }
  function searchBuild(f) {
    const out = [];
    const group = (list) => (list.length > 1 ? '(' + list.join(' OR ') + ')' : list[0]);
    out.push(...searchItems(f.all));
    if (f.rest) out.push(String(f.rest).trim());
    const exact = String(f.exact || '').replace(/"/g, '').trim();
    if (exact) out.push('"' + exact + '"');
    const any = searchItems(f.any).filter((x) => x !== 'OR');
    if (any.length) out.push(group(any));
    for (const w of searchItems(f.none, /^-+/)) out.push('-' + w);
    for (const k of ['tags', 'from', 'to', 'mention']) {
      const [pre] = SEARCH_LISTS[k];
      const list = searchItems(f[k], k === 'tags' ? /^#+/ : /^@+/).map((x) => pre + x);
      if (list.length) out.push(group(list));
    }
    if (String(f.site || '').trim()) out.push('url:' + String(f.site).trim().replace(/^https?:\/\//, '').replace(/\/$/, ''));
    for (const k of Object.keys(SEARCH_TRI)) if (f[k] === 'only' || f[k] === 'none') out.push((f[k] === 'none' ? '-' : '') + 'filter:' + SEARCH_TRI[k]);
    if (SEARCH_MEDIA.includes(f.media)) out.push('filter:' + f.media);
    if (f.verified) out.push('filter:blue_verified');
    if (f.follows) out.push('filter:follows');
    for (const k of Object.keys(SEARCH_MIN)) if (/^\d+$/.test(String(f[k] || '').trim()) && +f[k] > 0) out.push(SEARCH_MIN[k] + ':' + +f[k]);
    for (const k of ['since', 'until']) if (/^\d{4}-\d{2}-\d{2}$/.test(f[k] || '')) out.push(k + ':' + f[k]);
    if (/^[a-z]{2,3}(-[a-z]+)?$/i.test(f.lang || '')) out.push('lang:' + f.lang.toLowerCase());
    return out.filter(Boolean).join(' ');
  }

  Sweeter.text = { richText, plainText, editableText, draftLinks, normRanges, rangesCover, toggleRange, textEdit, shiftRanges, pollLength, pollChoices, pollProblem, POLL_CHOICE_MAX, whenDate, whenOf, whenLabel, scheduleProblem, searchParse, searchBuild, SEARCH_FIELDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.text;
})(typeof globalThis !== 'undefined' ? globalThis : this);
