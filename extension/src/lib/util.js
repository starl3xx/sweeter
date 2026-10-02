// Small shared helpers. Loaded first; every other file hangs off globalThis.Sweeter.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => HTML_ESC[c]);
  }

  // X delivers post text with &amp; &lt; &gt; already escaped, and entity
  // indices count those escaped characters (verified against live data).
  function unescapeEntities(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  // sortIndex values are decimal strings too long for Number. Compare them
  // as numbers without BigInt so the helper also works in any engine.
  function compareSort(a, b) {
    a = String(a || '0');
    b = String(b || '0');
    if (a.length !== b.length) return a.length - b.length;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  const TWITTER_EPOCH = 1288834974657n;
  // A post ID is a Snowflake: the top bits are milliseconds since 2010-11-04.
  function snowflakeMs(id) {
    try {
      return Number((BigInt(id) >> 22n) + TWITTER_EPOCH);
    } catch {
      return NaN;
    }
  }

  // Tweetbot’s formats: Now, 45s, 12m, 3h, 2d.
  function relativeTime(ms, now) {
    if (!isFinite(ms)) return '';
    const s = Math.max(0, Math.floor(((now || Date.now()) - ms) / 1000));
    if (s < 5) return 'Now';
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h';
    return Math.floor(h / 24) + 'd';
  }

  // Formatters are made once: building them per label cost more than the
  // labels (thousands every 30 s in absolute mode).
  const fmt = {};
  const formatter = (k, o) => fmt[k] || (fmt[k] = new Intl.DateTimeFormat([], o));
  function absoluteTime(ms, now) {
    if (!isFinite(ms)) return '';
    const d = new Date(ms);
    const n = new Date(now || Date.now());
    const time = formatter('t', { hour: 'numeric', minute: '2-digit' }).format(d);
    if (d.toDateString() === n.toDateString()) return time;
    const sameYear = d.getFullYear() === n.getFullYear();
    return formatter(sameYear ? 'd' : 'dy', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' }).format(d) + ', ' + time;
  }
  // A post's full date and time (a timestamp's tooltip).
  function fullTime(ms) {
    return isFinite(ms) ? formatter('full', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(new Date(ms)) : '';
  }

  function compactCount(n) {
    if (n == null || !isFinite(n)) return '';
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
    return (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M';
  }

  // Only http(s) links leave Sweeter; anything else becomes inert.
  function safeUrl(u) {
    return /^https?:\/\//i.test(String(u || '')) ? String(u) : '#';
  }

  Sweeter.util = { escapeHtml, unescapeEntities, compareSort, snowflakeMs, relativeTime, absoluteTime, compactCount, safeUrl, fullTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.util;
})(typeof globalThis !== 'undefined' ? globalThis : this);
