// Tweetbot-style mute filters: users, keywords, regular expressions,
// hashtags and clients, each with an optional expiry (1 day, 1 week,
// 1 month or forever). Like Tweetbot’s default, they apply to timelines
// and lists, not to notifications, unless the caller asks (compileNote).
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  const DURATIONS = { day: 864e5, week: 7 * 864e5, month: 30 * 864e5, forever: null };

  // Turns one typed token into a rule, or null when it cannot be one.
  //   airdrop        keyword
  //   /^gm\b/i       regular expression
  //   @someone       user
  //   #tag           hashtag
  //   via:Client     client (the post’s source app)
  function parse(token, duration, now) {
    const t = String(token || '').trim();
    if (!t) return null;
    const ms = DURATIONS[duration || 'forever'];
    const expires = ms ? (now || Date.now()) + ms : null;
    const base = { id: Math.random().toString(36).slice(2, 10), expires, created: now || Date.now() };
    const re = /^\/(.+)\/([imsu]*)$/.exec(t);
    if (re) {
      try {
        new RegExp(re[1], re[2]);
      } catch {
        return null;
      }
      return Object.assign(base, { kind: 'regex', value: re[1], flags: re[2] });
    }
    if (/^via:/i.test(t)) return t.slice(4).trim() ? Object.assign(base, { kind: 'client', value: t.slice(4).trim() }) : null;
    if (t[0] === '@') return t.length > 1 ? Object.assign(base, { kind: 'user', value: t.slice(1).toLowerCase() }) : null;
    if (t[0] === '#') return t.length > 1 ? Object.assign(base, { kind: 'hashtag', value: t.slice(1).toLowerCase() }) : null;
    return Object.assign(base, { kind: 'keyword', value: t });
  }

  function label(rule) {
    switch (rule.kind) {
      case 'regex':
        return '/' + rule.value + '/' + (rule.flags || '');
      case 'client':
        return 'via:' + rule.value;
      case 'user':
        return '@' + rule.value;
      case 'hashtag':
        return '#' + rule.value;
      default:
        return rule.value;
    }
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // A keyword made of word characters matches whole words only, so “art”
  // does not mute “start”. Anything else matches as a substring.
  function keywordTest(value) {
    const v = String(value);
    if (/^[\p{L}\p{N}_](.*[\p{L}\p{N}_])?$/u.test(v)) {
      const re = new RegExp('(^|[^\\p{L}\\p{N}_])' + escapeRe(v) + '(?=$|[^\\p{L}\\p{N}_])', 'iu');
      return (s) => re.test(s);
    }
    const low = v.toLowerCase();
    return (s) => s.toLowerCase().includes(low);
  }

  // Returns a function post -> matching rule (or null).
  function compile(rules, now) {
    const t = now || Date.now();
    const live = (rules || []).filter((r) => !r.expires || r.expires > t);
    const tests = live.map((r) => {
      switch (r.kind) {
        case 'regex': {
          let re;
          try {
            re = new RegExp(r.value, r.flags || '');
          } catch {
            return null;
          }
          return (p) => re.test(p.plain);
        }
        case 'client': {
          const c = r.value.toLowerCase();
          return (p) => String(p.source || '').toLowerCase() === c;
        }
        case 'user':
          return (p) => p.author.handle.toLowerCase() === r.value || (p.repostedBy && p.repostedBy.handle.toLowerCase() === r.value);
        case 'hashtag':
          return (p) => (p.hashtags || []).includes(r.value);
        default: {
          const kw = keywordTest(r.value);
          return (p) => kw(p.plain);
        }
      }
    });
    return function match(p) {
      if (!p || p.unavailable) return null;
      for (let i = 0; i < tests.length; i++) if (tests[i] && tests[i](p)) return live[i];
      return null;
    };
  }

  // Returns a function notification -> true when the mutes hide it: its
  // post is muted, or (for @user rules) anyone who acted on it is muted.
  // A like by a muted user and an unmuted one hides both, as one row.
  function compileNote(rules, now) {
    const t = now || Date.now();
    const match = compile(rules, t);
    const users = new Set((rules || []).filter((r) => r.kind === 'user' && (!r.expires || r.expires > t)).map((r) => r.value));
    return function hidden(n) {
      if (!n) return false;
      if (n.target && match(n.target)) return true;
      return (n.users || []).some((u) => u && users.has(String(u.handle).toLowerCase()));
    };
  }

  Sweeter.mutes = { parse, compile, compileNote, label, DURATIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.mutes;
})(typeof globalThis !== 'undefined' ? globalThis : this);
