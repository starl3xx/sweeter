// Ivory-style timeline filters and Find. Both work on the posts a column
// has already loaded (Sweeter never asks X for more), and both only choose
// what to show: mutes still apply first.
//
// A column can have several filters on at once; a post must pass all of
// them. Quick filters are built in. A custom filter has words to include
// and exclude, plus rules matched All or Any, as in Ivory.
//
// Notification columns have their own type filters (NOTE_QUICK): those
// choose whole notifications by kind, and any one selected type shows.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  // Any post that answers another one, a thread’s own continuations
  // included, so “No replies” leaves only posts that start something.
  function isReply(p) {
    return !!p.replyTo;
  }

  // The media the reader sees: the post’s own, then the quoted post’s.
  function seenMedia(p) {
    const q = p.quote && !p.quote.unavailable && p.quote.media ? p.quote.media : [];
    return (p.media || []).concat(q);
  }

  function hasMedia(p) {
    return seenMedia(p).length > 0;
  }

  // A GIF plays like a video, so it counts as one.
  function hasVideo(p) {
    return seenMedia(p).some((m) => m.type === 'video' || m.type === 'gif');
  }

  // What a rule can test on one post. ctx carries what the post alone
  // cannot say (today only ctx.unread(p), from the column).
  const TESTS = {
    media: hasMedia,
    video: hasVideo,
    links: (p) => (p.links && p.links.length > 0) || !!(p.card && p.card.kind !== 'poll'),
    // Mentions in the text the reader sees, not X’s hidden reply prefix.
    mentions: (p) => /(^|[^\w@])@\w{1,15}/.test(p.plain || ''),
    hashtags: (p) => p.hashtags.length > 0,
    // A quote of a deleted post is still a quote.
    quotes: (p) => !!p.quote,
    reposts: (p) => !!p.repostedBy,
    replies: isReply,
    // Any checkmark: blue, gold or gray.
    verified: (p) => !!(p.author.verified || p.author.badge),
    following: (p) => !!p.author.following,
    followers: (p) => !!p.author.followedBy,
    // Without a ctx nothing is known to be unread, so nothing passes.
    unread: (p, ctx) => !!(ctx && ctx.unread && ctx.unread(p)),
  };

  const CRITERIA = [
    ['media', 'Media'],
    ['video', 'Video'],
    ['links', 'Links'],
    ['mentions', 'Mentions'],
    ['hashtags', 'Hashtags'],
    ['quotes', 'Quotes'],
    ['reposts', 'Reposts'],
    ['replies', 'Replies'],
    ['verified', 'Verified accounts'],
    ['following', 'People you follow'],
    ['followers', 'People who follow you'],
  ];

  // New quick filters go at the end, so ⌥1 to ⌥5 keep their meaning.
  const QUICK = [
    { id: 'q:media', name: 'Media only', short: 'Media', rules: [{ k: 'media' }] },
    { id: 'q:links', name: 'Links only', short: 'Links', rules: [{ k: 'links' }] },
    { id: 'q:noReposts', name: 'No reposts', short: 'No reposts', rules: [{ k: 'reposts', not: true }] },
    { id: 'q:noReplies', name: 'No replies', short: 'No replies', rules: [{ k: 'replies', not: true }] },
    { id: 'q:mutuals', name: 'Mutuals', short: 'Mutuals', match: 'all', rules: [{ k: 'following' }, { k: 'followers' }] },
    { id: 'q:video', name: 'Video only', short: 'Video', rules: [{ k: 'video' }] },
    { id: 'q:noQuotes', name: 'No quotes', short: 'No quotes', rules: [{ k: 'quotes', not: true }] },
    { id: 'q:unread', name: 'Unread only', short: 'Unread', rules: [{ k: 'unread' }] },
  ];

  // Notification types. A block is { kind: 'notification', n }, or a post
  // or thread (X sends mentions and replies as plain posts).
  const noteIcon = (b) => (b.kind === 'notification' && b.n ? b.n.icon : null);
  const KNOWN_ICONS = ['reply', 'like', 'repost', 'follow'];
  const NOTE_QUICK = [
    { id: 'n:mentions', name: 'Mentions and replies', short: 'Mentions', match: (b) => b.kind === 'post' || b.kind === 'thread' || noteIcon(b) === 'reply' },
    { id: 'n:likes', name: 'Likes', short: 'Likes', match: (b) => noteIcon(b) === 'like' },
    { id: 'n:reposts', name: 'Reposts', short: 'Reposts', match: (b) => noteIcon(b) === 'repost' },
    { id: 'n:follows', name: 'Follows', short: 'Follows', match: (b) => noteIcon(b) === 'follow' },
    { id: 'n:other', name: 'Everything else', short: 'Other', match: (b) => b.kind === 'notification' && !KNOWN_ICONS.includes(noteIcon(b)) },
  ];

  // Everything a word can match: the text, the author, link addresses (so a
  // domain works as a word), the link card and the quoted post.
  function haystack(p) {
    const parts = [p.plain || '', p.author.name, '@' + p.author.handle];
    if (p.links) parts.push(p.links.join(' '));
    if (p.card && p.card.kind !== 'poll') parts.push(p.card.url || '', p.card.domain || '', p.card.title || '');
    if (p.article) parts.push(p.article.title || '');
    if (p.quote && !p.quote.unavailable) parts.push(p.quote.plain || '', '@' + p.quote.author.handle);
    return parts.join(' \n ').toLowerCase();
  }

  // A term made of word characters matches whole words (“art” does not
  // match “start”), like the mute filters; anything else is a substring.
  function term(w) {
    const t = w.toLowerCase();
    if (/^\w+$/.test(t)) {
      const re = new RegExp('(^|[^\\w])' + t + '(?![\\w])');
      return (hay) => re.test(hay);
    }
    return (hay) => hay.includes(t);
  }

  // “a, b OR c” is three alternatives.
  function words(s) {
    return String(s || '')
      .split(/,|\s+OR\s+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // ctx is optional; see TESTS.
  function compile(f, ctx) {
    if (!f) return null;
    const inc = words(f.include).map(term);
    const exc = words(f.exclude).map(term);
    const rules = (f.rules || []).filter((r) => TESTS[r.k]);
    const any = f.match === 'any';
    return (p) => {
      if (inc.length || exc.length) {
        const hay = haystack(p);
        if (inc.length && !inc.some((t) => t(hay))) return false;
        if (exc.some((t) => t(hay))) return false;
      }
      if (!rules.length) return true;
      const pass = (r) => TESTS[r.k](p, ctx) !== !!r.not;
      return any ? rules.some(pass) : rules.every(pass);
    };
  }

  // Every filter a column can offer, in menu order (⌥1 is the first).
  function all(custom) {
    return QUICK.concat((custom || []).filter((f) => f && f.id));
  }

  // One test for the filters that are on, or null when none are.
  function build(ids, custom, ctx) {
    if (!ids || !ids.length) return null;
    const list = all(custom).filter((f) => ids.includes(f.id));
    if (!list.length) return null;
    const tests = list.map((f) => compile(f, ctx));
    return (p) => tests.every((t) => t(p));
  }

  // One test for a notification column’s type filters, or null when none
  // are on. Unlike post filters, a block shows when it is ANY selected type.
  function buildNote(ids) {
    if (!ids || !ids.length) return null;
    const list = NOTE_QUICK.filter((f) => ids.includes(f.id));
    if (!list.length) return null;
    return (b) => !!b && list.some((f) => f.match(b));
  }

  // Find: every word must appear somewhere in the post (a substring, so a
  // partial word finds as you type).
  function terms(query) {
    return String(query || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  function find(query) {
    const ts = terms(query);
    if (!ts.length) return null;
    return (p) => {
      const hay = haystack(p);
      return ts.every((t) => hay.includes(t));
    };
  }

  function findNote(query) {
    const ts = terms(query);
    if (!ts.length) return null;
    return (n) => {
      const hay = ((n.plain || '') + ' \n ' + (n.target && !n.target.unavailable ? n.target.plain || '' : '') + ' \n ' + (n.users || []).map((u) => u.name + ' @' + u.handle).join(' ')).toLowerCase();
      return ts.every((t) => hay.includes(t));
    };
  }

  function label(f) {
    return f.short || f.name || 'Filter';
  }

  Sweeter.filters = { TESTS, CRITERIA, QUICK, NOTE_QUICK, compile, build, buildNote, all, find, findNote, terms, label, isReply };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.filters;
})(typeof globalThis !== 'undefined' ? globalThis : this);
