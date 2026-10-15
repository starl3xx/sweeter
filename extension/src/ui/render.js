// HTML builders for posts, threads and notifications. Every string from X
// passes through escapeHtml (or richText, which escapes), and every URL
// through safeUrl.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});
  const { escapeHtml: h, safeUrl, relativeTime, absoluteTime, compactCount } = Sweeter.util;
  const icon = Sweeter.icon;

  // X serves avatars at 48 (_normal), 73 (_bigger), 200 and 400 px. A post's
  // avatar is --av (text size × 2.475, or × 2 compact): at the default 14 px
  // that is ~35 pt, 69 px on Retina, so 73 is enough; larger text uses 200.
  // (200 px decodes to ~7.5× the pixels, for every post.)
  function avatarSmall(settings) {
    const fs = Number(settings && settings.fontSize) || 14;
    const dpr = Math.max(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 2);
    return fs * (settings && settings.density === 'compact' ? 2 : 2.475) * dpr <= 73;
  }
  function profile(handle) {
    return 'https://x.com/' + encodeURIComponent(handle);
  }

  function avatar(url, small) {
    return safeUrl(String(url || '').replace('_normal.', small ? '_bigger.' : '_200x200.'));
  }

  // Checkmark and organization badge after a name, as X shows them.
  function badges(u, ctx) {
    if (!u || !ctx.settings.badges) return '';
    let out = '';
    if (u.badge) out += '<span class="vb ' + u.badge + '" title="' + (u.badge === 'gold' ? 'Verified organization' : u.badge === 'gray' ? 'Government account' : 'Verified') + '">' + icon('seal') + '</span>';
    if (u.affiliate) out += '<img class="aff" src="' + h(avatar(u.affiliate.badge, true)) + '" alt="" title="' + h(u.affiliate.name) + '" loading="lazy" decoding="async">';
    return out;
  }

  // An avatar's class: organizations choose a square one (X draws it as a
  // rounded square, even where everyone else is round).
  function avClass(base, u) {
    return base + (u && u.square ? ' sq' : '');
  }

  // Who can reply, in X Pro's words (its bundle, module 282983).
  const REPLY_WHO = {
    followers: (o) => 'Accounts following or mentioned by @' + o + ' can reply',
    community: (o) => 'Accounts @' + o + ' follows or mentioned can reply',
    invited: (o) => 'Accounts @' + o + ' mentioned can reply',
    subscribers: (o) => 'Accounts subscribed to or mentioned by @' + o + ' can reply',
    verified: (o) => 'Verified accounts or accounts mentioned by @' + o + ' can reply',
    network: (o) => 'Accounts @' + o + ' follows, who they follow, or mentioned can reply',
  };

  function replyLimitText(l) {
    if (!l) return '';
    const f = l.owner && REPLY_WHO[l.policy];
    return f ? f(l.owner) : 'Only some accounts can reply.';
  }

  // Under an opened post: who can reply, as X Pro shows it there.
  function replyLimitLine(p) {
    const l = p.replyLimit;
    if (!l) return '';
    return '<div class="rlim' + (l.canReply ? '' : ' no') + '">' + icon('mention') + '<span><b>' + (l.canReply ? 'You can reply' : 'Who can reply?') + '</b> ' + h(replyLimitText(l)) + '</span></div>';
  }

  // A community note under the post, as X shows it: the heading, the note,
  // and the heading opens the note's page on x.com.
  function noteBox(n) {
    if (!n) return '';
    const head = '<span class="bw-h">' + icon('people') + '<b>' + h(n.title) + '</b></span>';
    return '<div class="bw' + (n.tentative ? ' tentative' : '') + '">' +
      (n.url ? '<a class="bw-top" href="' + h(safeUrl(n.url)) + '" target="_blank" rel="noopener noreferrer" title="Open this note on x.com">' + head + '</a>' : '<div class="bw-top">' + head + '</div>') +
      (n.html ? '<div class="bw-tx">' + n.html + '</div>' : '') + '</div>';
  }

  // An edited post: a pencil after the time; an old version also says a
  // newer one exists, linked as X does.
  function editMark(p) {
    const e = p.edit;
    if (!e) return '';
    const first = e.firstMs ? ' · first posted ' + Sweeter.util.fullTime(e.firstMs) : '';
    return '<span class="edt" title="' + h((e.stale ? 'An earlier version of this post' : 'Edited') + first) + '">' + icon('pencil') + '</span>';
  }

  function staleNote(p) {
    const e = p.edit;
    if (!e || !e.stale) return '';
    return '<a class="stale" href="https://x.com/i/status/' + h(e.latest) + '" target="_blank" rel="noopener noreferrer">There’s a new version of this post. <b>See the latest post</b></a>';
  }

  function mediaUrl(url, size) {
    const u = safeUrl(url);
    if (u === '#') return u;
    return u + (u.includes('?') ? '&' : '?') + 'name=' + size;
  }

  function timeLabel(ms, ctx) {
    return ctx.settings.dateFormat === 'absolute' ? absoluteTime(ms, ctx.now) : relativeTime(ms, ctx.now);
  }

  function time(ms, url, ctx) {
    return '<a class="tm" href="' + h(safeUrl(url)) + '" target="_blank" rel="noopener noreferrer" data-ts="' + (isFinite(ms) ? ms : '') + '" title="' + h(Sweeter.util.fullTime(ms)) + '">' + h(timeLabel(ms, ctx)) + '</a>';
  }

  function duration(ms) {
    if (!ms) return '';
    const s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // Images: “full” keeps each image’s own shape (nothing cropped),
  // “cropped” is the classic grid, “small” is Tweetbot’s small square.
  // `wide`: a post with no text in “small” mode. A thumbnail beside an
  // empty text line says nothing, so the media shows at two-thirds width.
  function media(list, sensitive, ctx, handle, wide) {
    if (!list || !list.length) return '';
    const mode = ctx.settings.media;
    if (mode === 'none') return '';
    const items = list.slice(0, 4);
    const first = items[0];
    const obscure = sensitive && ctx.settings.obscureSensitive ? ' sensitive' : '';
    let cls;
    let box = '';
    if (mode === 'full') cls = 'media full' + (items.length === 1 ? ' one' : '');
    else if (wide) {
      cls = 'media wide n' + items.length;
      if (items.length === 1 && first.w && first.h) box = ' style="--r:' + (first.w / first.h).toFixed(4) + '"';
    } else {
      const tall = items.length === 1 && first.w && first.h && first.h / first.w > 1.05;
      cls = 'media n' + items.length + (tall ? ' tall' : '');
    }
    let out = '<div class="' + cls + obscure + '"' + box + '>';
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const ratio = m.w && m.h ? m.w / m.h : 16 / 9;
      const shape = mode === 'full' ? ' style="--r:' + ratio.toFixed(4) + '"' : '';
      if (m.type === 'photo') {
        out += '<div class="m"' + shape + ' data-i="' + i + '" data-photo="' + h(mediaUrl(m.url, 'orig')) + '"><img src="' + h(mediaUrl(m.url, mode === 'full' && items.length === 1 ? 'medium' : 'small')) + '" alt="' + h(m.alt || 'Image from @' + handle) + '" loading="lazy" decoding="async"></div>';
        continue;
      }
      const gif = m.type === 'gif';
      const auto = gif ? ctx.settings.autoplayGifs : ctx.settings.autoplayVideo;
      const video = safeUrl(m.videoUrl || '');
      if (auto && video !== '#' && !obscure) {
        out += '<div class="m"' + shape + ' data-i="' + i + '" data-auto="' + (gif ? 'gif' : 'video') + '" data-video="' + h(video) + '" data-gif="' + (gif ? '1' : '') + '">' +
          '<video muted playsinline loop preload="none" poster="' + h(mediaUrl(m.url, 'small')) + '" src="' + h(video) + '"></video>' +
          (gif ? '<span class="gif">GIF</span>' : '<span class="dur">' + duration(m.durationMs) + '</span>') + '</div>';
        continue;
      }
      out += '<div class="m"' + shape + ' data-i="' + i + '" data-video="' + h(video) + '" data-gif="' + (gif ? '1' : '') + '"><img src="' + h(mediaUrl(m.url, 'small')) + '" alt="' + h(m.alt || (gif ? 'GIF' : 'Video') + ' from @' + handle) + '" loading="lazy" decoding="async">' +
        '<div class="play"><i>' + icon('play') + '</i></div>' + (gif ? '<span class="gif">GIF</span>' : m.durationMs ? '<span class="dur">' + duration(m.durationMs) + '</span>' : '') + '</div>';
    }
    // Small thumbnails show one image: say how many there are.
    if (items.length > 1) out += '<span class="mcount" title="' + items.length + ' items">' + icon('photo') + items.length + '</span>';
    return out + '</div>';
  }

  // What X Pro has said about a Space (app.js gives the store's).
  let spaceOf = () => null;
  function useSpaces(fn) {
    spaceOf = fn;
  }
  // A Space: live with its listeners, set for later, or ended, its title
  // and host, once X Pro has asked AudioSpaceById; until then, a Space.
  function spaceCard(c, ctx) {
    const sp = spaceOf(c.id);
    const live = !!sp && sp.state === 'Running';
    const ended = !!sp && /^(Ended|Canceled|TimedOut)$/.test(sp.state);
    const T = Sweeter.text;
    const when = sp && !live && !ended && sp.start ? T.whenLabel(T.whenOf(new Date(sp.start)), ctx.now) : '';
    const label = 'Space' + (live ? ' · Live' + (sp.listeners ? ' · ' + compactCount(sp.listeners) + ' listening' : '') : ended ? ' · Ended' + (sp.replay ? ' · Replay' : '') : when ? ' · ' + when : '');
    const host = sp && sp.host ? '<div class="cpv">Hosted by ' + h(sp.host.name || '@' + sp.host.handle) + '</div>' : '';
    const title = (sp && sp.title) || 'A Space on X';
    return '<a class="card summary space' + (live ? ' live' : '') + '" href="' + h(safeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="spi">' + icon('mic') + '</span>' +
      '<div class="cb"><div class="cdom">' + h(label) + '</div><div class="ctt" title="' + h(title) + '">' + h(title) + '</div>' + host + '</div></a>';
  }

  // A poll's time left, as X Pro says it: “2 days left”, “5 minutes left”.
  function pollLeft(ends, now) {
    const ms = Date.parse(ends) - now;
    if (!isFinite(ms) || ms <= 0) return '';
    const n = (u) => Math.floor(ms / u);
    const [v, unit] = ms >= 864e5 ? [n(864e5), 'day'] : ms >= 36e5 ? [n(36e5), 'hour'] : [Math.max(1, n(6e4)), 'minute'];
    return v + ' ' + unit + (v === 1 ? '' : 's') + ' left';
  }

  // A poll: its choices to vote on, as X Pro offers them (until the reader
  // votes or it ends, and never on their own post), or its results, with
  // the reader's vote marked. `p`: the post it is on.
  function poll(c, ctx, p) {
    const counted = c.choices.reduce((a, x) => a + x.count, 0);
    const total = counted || 1;
    const left = c.final ? '' : pollLeft(c.ends, ctx.now);
    const own = !!(p && ctx.viewer && ctx.viewer.handle && p.author.handle.toLowerCase() === ctx.viewer.handle.toLowerCase());
    const meta = '<div class="pmeta">' + compactCount(counted) + (counted === 1 ? ' vote' : ' votes') + (c.final || !left ? ' · Final results' : ' · ' + left) + '</div>';
    if (!c.final && !c.selected && left && !own && p) {
      return '<div class="poll vote" role="radiogroup" aria-label="Poll choices">' + c.choices.map((x, i) => '<button type="button" class="pch" role="radio" aria-checked="false" data-act="vote" data-i="' + (i + 1) + '">' + h(x.label) + '</button>').join('') + meta + '</div>';
    }
    const top = Math.max(...c.choices.map((x) => x.count));
    return '<div class="poll">' + c.choices.map((x, i) => {
      const pct = Math.round((x.count / total) * 100);
      const mine = c.selected === i + 1;
      return '<div class="ch1' + (c.final && x.count === top && counted ? ' win' : '') + '"><div class="bar" style="width:' + pct + '%"></div><span>' + h(x.label) + (mine ? ' ' + icon('check', 'pmine') : '') + '</span><span>' + pct + '%</span></div>';
    }).join('') + meta + '</div>';
  }

  function card(c, ctx, p) {
    if (!c) return '';
    if (c.kind === 'poll') return poll(c, ctx, p);
    const style = ctx.settings.cards;
    if (style === 'none') return '';
    if (c.kind === 'space') return spaceCard(c, ctx);
    const compact = style === 'compact' || c.kind === 'summary';
    // A video page or a live video: a play mark on its still, and LIVE.
    const still = c.image ? '<img src="' + h(safeUrl(c.image)) + '" alt="" loading="lazy" decoding="async">' : '';
    const pic = still && c.play ? '<span class="cim">' + still + '<i class="cpl">' + icon('play') + '</i></span>' : still;
    // A live video names its stream's key: a click plays it in Sweeter.
    const live = c.live && c.mediaKey ? ' data-bkey="' + h(c.mediaKey) + '"' : '';
    return '<a class="card' + (compact ? ' summary' : style === 'medium' ? ' medium' : '') + '" href="' + h(safeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer"' + live + '>' +
      pic +
      '<div class="cb"><div class="cdom">' + (c.live ? '<b class="clive">LIVE</b>' : '') + h(c.domain) + '</div><div class="ctt" title="' + h(c.title) + '">' + h(c.title) + '</div></div></a>';
  }

  // X Article: cover, “Article” label, title and a short preview, like X.
  function articleCard(a, ctx) {
    if (!a) return '';
    const compact = ctx.settings.cards === 'compact' || ctx.settings.cards === 'none';
    return '<a class="card article' + (compact ? ' summary' : ctx.settings.cards === 'medium' ? ' medium' : '') + '" href="' + h(safeUrl(a.url)) + '" target="_blank" rel="noopener noreferrer">' +
      (a.image && ctx.settings.cards !== 'none' ? '<img src="' + h(mediaUrl(a.image, compact ? 'small' : 'medium')) + '" alt="" loading="lazy" decoding="async">' : '') +
      '<div class="cb"><div class="cdom">' + icon('news') + 'Article</div><div class="ctt">' + h(a.title) + '</div>' +
      (a.preview ? '<div class="cpv">' + h(a.preview) + '</div>' : '') + '</div></a>';
  }

  // ---------- the article reader ----------
  // The page app.js shows in its reader sheet: cover, title, byline, then
  // the body X Pro loaded with the post's conversation (normalize.js
  // articleBody). `o.state` is 'loading' or 'failed' until the body is
  // there; `o.find(id)` looks up a post Sweeter has, for embedded posts.
  // Each photo and video carries data-rd-m, its place in the article's
  // media list (the lightbox's order).
  function readingMinutes(body) {
    let words = 0;
    for (const b of body || []) if (b.html) words += b.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 230));
  }

  function readerMedia(m, k, ctx) {
    const ratio = m.w && m.h ? ' style="--r:' + (m.w / m.h).toFixed(4) + '"' : '';
    const alt = h(m.alt || '');
    if (m.type === 'photo') return '<div class="rd-m"' + ratio + '><img src="' + h(mediaUrl(m.url, 'large')) + '" alt="' + alt + '" data-rd-m="' + k + '" loading="lazy" decoding="async"></div>';
    const video = safeUrl(m.videoUrl || '');
    if (video === '#') return '';
    const poster = m.url ? ' poster="' + h(mediaUrl(m.url, 'large')) + '"' : '';
    if (m.type === 'gif' && ctx.settings.autoplayGifs) return '<div class="rd-m"' + ratio + '><video src="' + h(video) + '"' + poster + ' autoplay loop muted playsinline aria-label="' + (alt || 'GIF') + '"></video><span class="gif">GIF</span></div>';
    return '<div class="rd-m"' + ratio + '><video src="' + h(video) + '"' + poster + ' controls playsinline preload="none"' + (m.type === 'gif' ? ' loop muted' : '') + ' aria-label="' + (alt || (m.type === 'gif' ? 'GIF' : 'Video')) + '"></video></div>';
  }

  function articlePage(p, ctx, o) {
    const a = p.article;
    const opts = o || {};
    const body = a.body || null;
    const head =
      (a.image && ctx.settings.cards !== 'none' ? '<div class="rd-cover"' + (a.w && a.h ? ' style="--r:' + (a.w / a.h).toFixed(4) + '"' : '') + '><img src="' + h(mediaUrl(a.image, 'large')) + '" alt="" decoding="async"></div>' : '') +
      '<h1 class="rd-title">' + h(a.title) + '</h1>' +
      '<div class="rd-by"><a class="avl" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer" aria-label="' + h(p.author.name) + ' on X"><img class="' + avClass('av', p.author) + '" src="' + h(avatar(p.author.avatar, false)) + '" alt="" decoding="async"></a>' +
      '<div><div class="rd-who"><a class="nm" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer">' + h(p.author.name) + '</a>' + badges(p.author, ctx) + '<a class="hd" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer">@' + h(p.author.handle) + '</a></div>' +
      '<div class="rd-meta">' + time(p.createdMs, p.url, ctx) + (body ? '<span>' + readingMinutes(body) + ' min read</span>' : '') + '</div></div></div>';
    if (!body) {
      const note = opts.state === 'failed'
        ? '<p class="rd-note">X Pro didn’t load this article’s text. <a href="' + h(safeUrl(p.url)) + '" target="_blank" rel="noopener noreferrer">Open it on x.com</a></p>'
        : '<p class="rd-note rd-wait">Loading the article…</p>';
      return head + '<div class="rd-body">' + (a.preview ? '<p>' + h(a.preview) + '</p>' : '') + note + '</div>';
    }
    const parts = [];
    let list = null;
    let k = 0;
    for (const b of body) {
      if (list && b.t !== list) {
        parts.push('</' + list + '>');
        list = null;
      }
      switch (b.t) {
        case 'ul':
        case 'ol':
          if (!list) {
            parts.push('<' + b.t + '>');
            list = b.t;
          }
          parts.push('<li>' + b.html + '</li>');
          break;
        // The title is the page's h1: the article's headings sit below it.
        case 'h1':
          parts.push('<h2>' + b.html + '</h2>');
          break;
        case 'h2':
          parts.push('<h3>' + b.html + '</h3>');
          break;
        case 'quote':
          parts.push('<blockquote>' + b.html + '</blockquote>');
          break;
        case 'media':
          parts.push('<figure class="rd-fig' + (b.items.length > 1 ? ' multi' : '') + '">' + b.items.map((m) => readerMedia(m, k++, ctx)).join('') + (b.caption ? '<figcaption>' + h(b.caption) + '</figcaption>' : '') + '</figure>');
          break;
        case 'post': {
          const q = opts.find ? opts.find(b.id) : null;
          parts.push(q && !q.unavailable
            ? '<div class="rd-post">' + quote(q, ctx) + '</div>'
            : '<a class="rd-link" href="https://x.com/i/status/' + h(b.id) + '" target="_blank" rel="noopener noreferrer">' + icon('quote') + '<span>A post</span><em>Open on x.com</em></a>');
          break;
        }
        case 'link': {
          const u = safeUrl(b.url);
          parts.push('<a class="rd-link" href="' + h(u) + '" target="_blank" rel="noopener noreferrer" title="' + h(u) + '">' + icon('link') + '<span>' + h(u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')) + '</span></a>');
          break;
        }
        case 'hr':
          parts.push('<hr>');
          break;
        case 'code':
          parts.push('<pre><code>' + h(b.text) + '</code></pre>');
          break;
        default:
          parts.push('<p>' + b.html + '</p>');
      }
    }
    if (list) parts.push('</' + list + '>');
    return head + '<div class="rd-body">' + parts.join('') + '</div>';
  }

  // Every photo and video of an article, in page order (the lightbox's list).
  function articleMediaList(a) {
    const out = [];
    for (const b of (a && a.body) || []) if (b.t === 'media') out.push(...b.items);
    return out;
  }

  // A quoted post. One that is only an X Article has no text of its own
  // (its one link is the article's, which the text hides), so the article's
  // label, title, and preview stand in, with its cover as the thumbnail.
  function quote(q, ctx) {
    if (!q) return '';
    if (q.unavailable) return '<div class="quote gone">This post is unavailable.</div>';
    const a = q.article;
    const thumb = q.media.length ? { url: q.media[0].url, alt: q.media[0].alt } : a && a.image ? { url: a.image, alt: '' } : null;
    const tx = q.html || (q.media.length ? '<span class="gone">Media</span>' : '');
    return '<div class="quote" data-url="' + h(safeUrl(q.url)) + '"><div class="meta"><img class="' + avClass('qav', q.author) + '" src="' + h(avatar(q.author.avatar, true)) + '" alt="" loading="lazy" decoding="async">' +
      '<span class="nm">' + h(q.author.name) + '</span>' + badges(q.author, ctx) + '<span class="hd">@' + h(q.author.handle) + '</span><span class="tm">' + h(timeLabel(q.createdMs, ctx)) + '</span></div>' +
      (ctx.settings.quoteMedia && thumb && ctx.settings.media !== 'none'
        ? '<img class="qm" src="' + h(mediaUrl(thumb.url, 'small')) + '" alt="' + h(thumb.alt) + '" loading="lazy" decoding="async">'
        : '') +
      (tx || !a ? '<div class="tx">' + tx + '</div>' : '') +
      (a
        ? '<div class="qart"><div class="qal">' + icon('news') + 'Article</div><div class="qat">' + h(a.title) + '</div>' +
          (a.preview ? '<div class="qap">' + h(a.preview) + '</div>' : '') + '</div>'
        : '') +
      '</div>';
  }

  // Token cards for a post's cashtags: the symbol now, the name, price and
  // 24-hour change once DexScreener answers (app.js fills them in).
  function tickerCards(list) {
    if (!list || !list.length) return '';
    return '<div class="tkcs">' + list.map((t) => '<button type="button" class="tkc" data-ca="' + h(t.address) + '" data-chain="' + h(t.chain) + '" title="' + h(t.chain + ' ' + t.address) + '"><i class="tkc-l">' + h((t.symbol || '?').slice(0, 1).toUpperCase()) + '</i><b class="tkc-s">' + h(t.symbol ? '$' + t.symbol : t.address.slice(0, 6) + '…' + t.address.slice(-4)) + '</b><span class="tkc-n">' + h(t.name || '') + '</span><span class="tkc-p"></span><span class="tkc-c"></span></button>').join('') + '</div>';
  }

  // What sits between the name line and the buttons. With small thumbnails
  // the text and the thumbnail share one row, side by side.
  function body(p, ctx, bare, reply, context) {
    const rest = articleCard(p.article, ctx) + (p.article ? '' : card(p.card, ctx, p)) + quote(p.quote, ctx) + noteBox(p.note) + staleNote(p) + context;
    const pics = media(p.media, p.sensitive, ctx, p.author.handle, bare);
    const tk = tickerCards(p.tickers);
    if (ctx.settings.media === 'small' && pics && !bare) return '<div class="sm"><div class="smt">' + reply + text(p, ctx) + tk + rest + '</div>' + pics + '</div>';
    return reply + text(p, ctx) + tk + pics + rest;
  }

  // Posts longer than 280 characters fold to a few lines, with “Show more”.
  function text(p, ctx) {
    if (!p.html) return '';
    const long = !ctx.focal && ctx.settings.longPosts !== 'expanded' && Array.from(p.plain).length > 280;
    if (!long) return '<div class="tx" lang="' + h(p.lang) + '">' + p.html + '</div>';
    const open = ctx.expanded && ctx.expanded.has(p.id);
    return '<div class="tx long' + (open ? ' open' : '') + '" lang="' + h(p.lang) + '">' + p.html + '</div>' +
      '<button class="more" type="button" data-act="more-text">' + (open ? 'Show less' : 'Show more') + '</button>';
  }

  function count(n, ctx) {
    return ctx.settings.counts && n ? '<span class="cnt">' + compactCount(n) + '</span>' : '';
  }

  // A post's action bar. In the default hover mode it is hidden until the
  // pointer or the selection reaches the post, so it is built then (app.js
  // fillActs): it was nearly half of every post's elements. Its items run in
  // X's order, and Settings ▸ General ▸ Action bar hides any of them (the
  // bar* settings; the keys work either way). Views are X's count of times
  // the post was seen: shown with the other counts, never as a button.
  function acts(p, ctx) {
    const s = ctx.settings;
    const on = (k) => s[k] !== false;
    const views = p.counts.views;
    // X refuses a reply here: the button stays (counts still show), dimmed,
    // and says who can reply. app.js openCompose shows the same words.
    const noReply = p.replyLimit && !p.replyLimit.canReply;
    const replyTitle = noReply ? 'Who can reply? ' + replyLimitText(p.replyLimit) : 'Reply (r)';
    return (
      '<div class="acts">' +
      (on('barReply') ? '<button type="button" data-act="reply"' + (noReply ? ' class="off" aria-disabled="true"' : '') + ' title="' + h(replyTitle) + '" aria-label="Reply" tabindex="-1">' + icon('reply') + count(p.counts.reply, ctx) + '</button>' : '') +
      (on('barRepost') ? '<button type="button" data-act="repost" class="' + (p.state.reposted ? 'on-rt' : '') + '" title="' + (p.state.reposted ? 'Undo repost or quote (t)' : 'Repost or quote (t)') + '" aria-label="' + (p.state.reposted ? 'Reposted. Undo repost or quote' : 'Repost or quote') + '" aria-pressed="' + !!p.state.reposted + '" tabindex="-1">' + icon(p.state.reposted ? 'repostOn' : 'repost') + count(p.counts.repost, ctx) + '</button>' : '') +
      (on('barLike') ? '<button type="button" data-act="like" class="' + (p.state.liked ? 'on-like' : '') + '" title="' + (p.state.liked ? 'Unlike (l)' : 'Like (l)') + '" aria-label="Like" aria-pressed="' + !!p.state.liked + '" tabindex="-1">' + icon(p.state.liked ? 'likeOn' : 'like') + count(p.counts.like, ctx) + '</button>' : '') +
      (on('barViews') && s.counts && views ? '<span class="vw" title="' + h(views.toLocaleString('en-US')) + (views === 1 ? ' view' : ' views') + '">' + icon('chartbar') + count(views, ctx) + '</span>' : '') +
      (on('barBookmark') ? '<button type="button" data-act="bookmark" class="' + (p.state.bookmarked ? 'on-bm' : '') + '" title="' + (p.state.bookmarked ? 'Remove bookmark (b)' : 'Bookmark (b)') + '" aria-label="Bookmark" aria-pressed="' + !!p.state.bookmarked + '" tabindex="-1">' + icon(p.state.bookmarked ? 'bookmarkOn' : 'bookmark') + '</button>' : '') +
      // X Pro's More and Share menus, read when pressed (app.js showPostXMenu).
      (on('barMore') ? '<button type="button" data-act="xmenu" title="More: X Pro’s menu for this post" aria-label="More" aria-haspopup="menu" tabindex="-1">' + icon('more') + '</button>' : '') +
      (on('barCopy') ? '<button type="button" data-act="copy" title="Copy link to post" aria-label="Copy link to post" tabindex="-1">' + icon('link') + '</button>' : '') +
      (on('barOpen') ? '<button type="button" data-act="open" title="Open on x.com" aria-label="Open on x.com" tabindex="-1">' + icon('open') + '</button>' : '') +
      '</div>'
    );
  }

  function post(p, ctx, extraClass) {
    if (!p || p.unavailable) return '<article class="cell gone-cell"><div></div><div class="main gone">This post is unavailable.</div></article>';
    const viewer = ctx.viewer && ctx.viewer.handle ? ctx.viewer.handle.toLowerCase() : null;
    const mention = viewer && (p.mentions.includes(viewer) || (p.replyTo && p.replyTo.toLowerCase() === viewer)) && p.author.handle.toLowerCase() !== viewer;
    const bare = p.media.length > 0 && !/\S/.test(p.plain || '') && ctx.settings.media === 'small';
    const cls = 'cell' + (mention ? ' mention' : '') + (p.media.length ? ' has-media' : '') + (bare ? ' bare' : '') + (ctx.focal ? ' focal' : '') + (extraClass ? ' ' + extraClass : '');
    const reply = p.replyTo && p.replyTo.toLowerCase() !== p.author.handle.toLowerCase() && !ctx.inThread ? '<div class="rpl">Replying to @' + h(p.replyTo) + '</div>' : '';
    // Who reposted it: above the post as X Pro shows it (“Name reposted”),
    // or below it as Tweetbot did (“Reposted by Name”).
    const above = ctx.settings.repostLabel !== 'below';
    let context = '';
    let top = '';
    if (p.repostedBy) {
      if (above) top = '<div class="rtop"><span class="ri">' + icon('repost') + '</span><a href="' + profile(p.repostedBy.handle) + '" target="_blank" rel="noopener noreferrer" title="' + h(p.repostedBy.name) + ' reposted">' + h(p.repostedBy.name) + ' reposted</a></div>';
      else context = '<div class="ctx">' + icon('repost') + 'Reposted by ' + h(p.repostedBy.name) + '</div>';
    } else if (ctx.context) {
      if (above) top = '<div class="rtop"><span class="ri"></span><span>' + h(ctx.context) + '</span></div>';
      else context = '<div class="ctx">' + h(ctx.context) + '</div>';
    }
    return '<article class="' + cls + '" data-id="' + h(p.id) + '" data-url="' + h(safeUrl(p.url)) + '">' +
      top +
      '<a class="avl" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer" aria-label="' + h(p.author.name) + ' on X"><img class="' + avClass('av', p.author) + '" src="' + h(avatar(p.author.avatar, avatarSmall(ctx.settings))) + '" alt="" loading="lazy" decoding="async"></a>' +
      '<div class="main">' +
      '<div class="meta"><a class="nm" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer" title="' + h(p.author.name) + '">' + h(p.author.name) + '</a>' + badges(p.author, ctx) + (p.author.protected ? icon('lock', 'lock') : '') +
      '<a class="hd" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer" title="@' + h(p.author.handle) + '">@' + h(p.author.handle) + '</a>' + time(p.createdMs, p.url, ctx) + editMark(p) + '</div>' +
      body(p, ctx, bare, reply, context) +
      (ctx.focal ? focalMeta(p) + replyLimitLine(p) : '') +
      (ctx.focal || ctx.settings.actions === 'always' ? acts(p, ctx) : '<div class="acts" data-lazy></div>') +
      '</div></article>';
  }

  // “Name ✓ [org] followed you”: bold names, each with its badges.
  function noteText(n, ctx) {
    if (!n.parts || !n.parts.length) return n.html;
    return n.parts.map((x) => (x.user ? '<a class="who" href="' + profile(x.user.handle) + '" target="_blank" rel="noopener noreferrer"><b>' + h(x.text) + '</b></a>' + badges(x.user, ctx) : h(x.text))).join('');
  }

  // The opened post, Tweetbot’s details view: full date, client and counts.
  function focalMeta(p) {
    const when = isFinite(p.createdMs) ? new Date(p.createdMs).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const c = p.counts;
    const stat = (n, one, many) => (n ? '<span><b>' + compactCount(n) + '</b> ' + (n === 1 ? one : many) + '</span>' : '');
    const counts = stat(c.repost, 'Repost', 'Reposts') + stat(c.quote, 'Quote', 'Quotes') + stat(c.like, 'Like', 'Likes') + stat(c.bookmark, 'Bookmark', 'Bookmarks') + stat(c.views, 'View', 'Views');
    return '<div class="fmeta">' + h(when) + (p.source ? ' · via ' + h(p.source) : '') + '</div>' + (counts ? '<div class="fcounts">' + counts + '</div>' : '');
  }

  const NOTE_ICON = { like: 'likeOn', repost: 'repost', follow: 'follow', list: 'list', bell: 'bell', news: 'news', reply: 'reply', milestone: 'activity', other: 'activity' };

  function notification(n, ctx) {
    const minis = n.users.length
      ? '<div class="minis">' + n.users.slice(0, 8).map((u) => '<a href="' + profile(u.handle) + '" target="_blank" rel="noopener noreferrer" title="' + h(u.name) + '" aria-label="' + h(u.name) + ' on X"><img' + (u.square ? ' class="sq"' : '') + ' src="' + h(avatar(u.avatar, true)) + '" alt="" loading="lazy" decoding="async"></a>').join('') + '</div>'
      : '';
    const target = n.target && !n.target.unavailable ? '<div class="snip" data-url="' + h(safeUrl(n.target.url)) + '">' + h(n.target.plain) + '</div>' : '';
    return '<article class="cell act" data-note="' + h(n.id) + '" data-url="' + h(safeUrl(n.target && n.target.url ? n.target.url : n.url)) + '">' +
      '<div class="act-ic ' + h(n.icon) + '">' + icon(NOTE_ICON[n.icon] || 'activity') + '</div>' +
      '<div class="main">' + minis + '<div class="meta"><span class="atx">' + noteText(n, ctx) + '</span>' + time(n.timeMs, n.target ? n.target.url : n.url, ctx) + '</div>' + target + '</div></article>';
  }

  // A person (People search, Followers, Following): avatar, name, bio, and
  // how they relate to you. A click opens their profile sheet (app.js).
  function person(u, ctx) {
    const rel = [u.followedBy ? 'Follows you' : '', u.following ? 'You follow them' : ''].filter(Boolean).join(' · ');
    const stat = ctx.settings.counts && u.followers != null ? '<b>' + compactCount(u.followers) + '</b> ' + (u.followers === 1 ? 'follower' : 'followers') : '';
    return '<article class="cell person" data-person="' + h(u.handle) + '">' +
      '<a class="avl" href="' + profile(u.handle) + '" target="_blank" rel="noopener noreferrer" aria-label="' + h(u.name) + ' on X"><img class="' + avClass('av', u) + '" src="' + h(avatar(u.avatar, avatarSmall(ctx.settings))) + '" alt="" loading="lazy" decoding="async"></a>' +
      '<div class="main"><div class="meta"><a class="nm" href="' + profile(u.handle) + '" target="_blank" rel="noopener noreferrer" title="' + h(u.name) + '">' + h(u.name) + '</a>' + badges(u, ctx) + (u.protected ? icon('lock', 'lock') : '') +
      '<a class="hd" href="' + profile(u.handle) + '" target="_blank" rel="noopener noreferrer" title="@' + h(u.handle) + '">@' + h(u.handle) + '</a></div>' +
      (u.bio ? '<div class="tx">' + u.bio + '</div>' : '') +
      (stat || rel ? '<div class="pst">' + stat + (stat && rel ? ' · ' : '') + h(rel) + '</div>' : '') +
      '</div></article>';
  }

  // Text with bold and italic as UTF-16 ranges (what X's composer keeps
  // for a draft or a scheduled post): escaped, in runs of one style each,
  // never splitting a surrogate pair, with its line breaks.
  function styledText(text, styles) {
    const s = String(text || '');
    const mask = new Uint8Array(s.length);
    const mark = (list, bit) => {
      for (const [a, b] of list || []) for (let i = Math.max(0, a); i < Math.min(s.length, b); i++) mask[i] |= bit;
    };
    mark(styles && styles.bold, 1);
    mark(styles && styles.italic, 2);
    const low = (i) => i < s.length && (s.charCodeAt(i) & 0xfc00) === 0xdc00;
    let out = '';
    for (let i = 0; i < s.length; ) {
      let j = i + 1;
      while (j < s.length && (mask[j] === mask[i] || low(j))) j++;
      const m = mask[i];
      out += (m & 2 ? '<em>' : '') + (m & 1 ? '<strong>' : '') + h(s.slice(i, j)).replace(/\n/g, '<br>') + (m & 1 ? '</strong>' : '') + (m & 2 ? '</em>' : '');
      i = j;
    }
    return out;
  }

  // A scheduled post (X Pro's Scheduled column): when it sends, or that X
  // couldn't, what it says, and Edit and Delete. Its photos show; a video
  // or GIF is named, since X keeps only a still for it.
  function scheduled(d, ctx) {
    const T = Sweeter.text;
    const when = d.when ? T.whenLabel(T.whenOf(new Date(d.when)), ctx.now) : '';
    const head = d.failed ? 'X couldn’t send this' + (when ? ' on ' + when : '') : !when ? 'Scheduled' : d.when <= ctx.now ? 'Due ' + when : 'Sends ' + when;
    const photos = d.media.filter((m) => m.type === 'photo' && m.url);
    const others = d.media.filter((m) => m.type !== 'photo');
    const info = [];
    if (d.quote) info.push('Quotes a post');
    if (others.length) info.push(others[0].type === 'gif' ? 'A GIF' : others.length === 1 ? 'A video' : others.length + ' videos');
    if (d.more.length) info.push('Thread of ' + (1 + d.more.length));
    const reply = d.reply ? '<div class="rpl">Replying to ' + (d.replyTo ? '@' + h(d.replyTo) : 'a post') + '</div>' : '';
    return '<article class="cell act sched' + (d.failed ? ' failed' : '') + '" data-sched="' + h(d.id) + '">' +
      '<div class="act-ic sched">' + icon('schedule') + '</div>' +
      '<div class="main"><div class="meta"><span class="sched-when">' + h(head) + '</span></div>' +
      reply +
      (d.text ? '<div class="tx">' + styledText(d.text, d.styles) + '</div>' : '') +
      (photos.length ? media(photos, false, ctx, (ctx.viewer && ctx.viewer.handle) || 'you', !d.text) : '') +
      (info.length ? '<div class="pst">' + h(info.join(' · ')) + '</div>' : '') +
      '<div class="sacts"><button class="more" type="button" data-cmd="sched-open" data-id="' + h(d.id) + '">Edit in X Pro</button>' +
      '<button class="more del" type="button" data-cmd="sched-del" data-id="' + h(d.id) + '">Delete…</button></div>' +
      '</div></article>';
  }

  // One timeline block. `visible` is the list of posts that survived the
  // mute filters (threads can lose some of theirs).
  function block(b, ctx, visible) {
    if (b.kind === 'notification') return notification(b.n, ctx);
    if (b.kind === 'person') return person(b.person, ctx);
    if (b.kind === 'thread') {
      const c = Object.assign({}, ctx, { inThread: true });
      return '<div class="thread">' + visible.map((p) => post(p, c)).join('') + '</div>';
    }
    return post(b.post, Object.assign({}, ctx, { context: b.context }));
  }

  Sweeter.render = { useSpaces, block, post, notification, scheduled, styledText, timeLabel, avatar, badges, avatarSmall, acts, articlePage, articleMediaList, replyLimitText };
})(typeof globalThis !== 'undefined' ? globalThis : this);
