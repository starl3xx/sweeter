// HTML builders for posts, threads and notifications. Every string from X
// passes through escapeHtml (or richText, which escapes), and every URL
// through safeUrl.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});
  const { escapeHtml: h, safeUrl, relativeTime, absoluteTime, compactCount } = Sweeter.util;
  const icon = Sweeter.icon;

  // X serves avatars at 48 (_normal), 73 (_bigger), 200 and 400 px. A 46 pt
  // avatar on a Retina screen needs about 92 px, so use 200; tiny ones use 73.
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

  function mediaUrl(url, size) {
    const u = safeUrl(url);
    if (u === '#') return u;
    return u + (u.includes('?') ? '&' : '?') + 'name=' + size;
  }

  function timeLabel(ms, ctx) {
    return ctx.settings.dateFormat === 'absolute' ? absoluteTime(ms, ctx.now) : relativeTime(ms, ctx.now);
  }

  function time(ms, url, ctx) {
    return '<a class="tm" href="' + h(safeUrl(url)) + '" target="_blank" rel="noopener noreferrer" data-ts="' + (isFinite(ms) ? ms : '') + '" title="' + h(isFinite(ms) ? new Date(ms).toLocaleString() : '') + '">' + h(timeLabel(ms, ctx)) + '</a>';
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

  function card(c, ctx) {
    if (!c) return '';
    if (c.kind === 'poll') {
      const total = c.choices.reduce((a, x) => a + x.count, 0) || 1;
      return '<div class="poll">' + c.choices.map((x) => {
        const pct = Math.round((x.count / total) * 100);
        return '<div class="ch1"><div class="bar" style="width:' + pct + '%"></div><span>' + h(x.label) + '</span><span>' + pct + '%</span></div>';
      }).join('') + '<div class="pmeta">' + compactCount(total) + ' votes' + (c.final ? ' · Final results' : '') + '</div></div>';
    }
    const style = ctx.settings.cards;
    if (style === 'none') return '';
    const compact = style === 'compact' || c.kind === 'summary';
    return '<a class="card' + (compact ? ' summary' : style === 'medium' ? ' medium' : '') + '" href="' + h(safeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer">' +
      (c.image ? '<img src="' + h(safeUrl(c.image)) + '" alt="" loading="lazy" decoding="async">' : '') +
      '<div class="cb"><div class="cdom">' + h(c.domain) + '</div><div class="ctt" title="' + h(c.title) + '">' + h(c.title) + '</div></div></a>';
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

  function quote(q, ctx) {
    if (!q) return '';
    if (q.unavailable) return '<div class="quote gone">This post is unavailable.</div>';
    return '<div class="quote" data-url="' + h(safeUrl(q.url)) + '"><div class="meta"><img class="qav" src="' + h(avatar(q.author.avatar, true)) + '" alt="" loading="lazy" decoding="async">' +
      '<span class="nm">' + h(q.author.name) + '</span>' + badges(q.author, ctx) + '<span class="hd">@' + h(q.author.handle) + '</span><span class="tm">' + h(timeLabel(q.createdMs, ctx)) + '</span></div>' +
      (ctx.settings.quoteMedia && q.media.length && ctx.settings.media !== 'none'
        ? '<img class="qm" src="' + h(mediaUrl(q.media[0].url, 'small')) + '" alt="' + h(q.media[0].alt) + '" loading="lazy" decoding="async">'
        : '') +
      '<div class="tx">' + (q.html || (q.media.length ? '<span class="gone">Media</span>' : '')) + '</div></div>';
  }

  // What sits between the name line and the buttons. With small thumbnails
  // the text and the thumbnail share one row, side by side.
  function body(p, ctx, bare, reply, context) {
    const rest = articleCard(p.article, ctx) + (p.article ? '' : card(p.card, ctx)) + quote(p.quote, ctx) + context;
    const pics = media(p.media, p.sensitive, ctx, p.author.handle, bare);
    if (ctx.settings.media === 'small' && pics && !bare) return '<div class="sm"><div class="smt">' + reply + text(p, ctx) + rest + '</div>' + pics + '</div>';
    return reply + text(p, ctx) + pics + rest;
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
      '<a class="avl" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer" aria-label="' + h(p.author.name) + ' on X"><img class="av" src="' + h(avatar(p.author.avatar)) + '" alt="" loading="lazy" decoding="async"></a>' +
      '<div class="main">' +
      '<div class="meta"><a class="nm" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer" title="' + h(p.author.name) + '">' + h(p.author.name) + '</a>' + badges(p.author, ctx) + (p.author.protected ? icon('lock', 'lock') : '') +
      '<a class="hd" href="' + profile(p.author.handle) + '" target="_blank" rel="noopener noreferrer" title="@' + h(p.author.handle) + '">@' + h(p.author.handle) + '</a>' + time(p.createdMs, p.url, ctx) + '</div>' +
      body(p, ctx, bare, reply, context) +
      (ctx.focal ? focalMeta(p) : '') +
      '<div class="acts">' +
      '<button type="button" data-act="reply" title="Reply (r)" aria-label="Reply" tabindex="-1">' + icon('reply') + count(p.counts.reply, ctx) + '</button>' +
      '<button type="button" data-act="repost" class="' + (p.state.reposted ? 'on-rt' : '') + '" title="' + (p.state.reposted ? 'Undo repost or quote (t)' : 'Repost or quote (t)') + '" aria-label="' + (p.state.reposted ? 'Reposted. Undo repost or quote' : 'Repost or quote') + '" aria-pressed="' + !!p.state.reposted + '" tabindex="-1">' + icon(p.state.reposted ? 'repostOn' : 'repost') + count(p.counts.repost, ctx) + '</button>' +
      '<button type="button" data-act="like" class="' + (p.state.liked ? 'on-like' : '') + '" title="' + (p.state.liked ? 'Unlike (l)' : 'Like (l)') + '" aria-label="Like" aria-pressed="' + !!p.state.liked + '" tabindex="-1">' + icon(p.state.liked ? 'likeOn' : 'like') + count(p.counts.like, ctx) + '</button>' +
      '<button type="button" data-act="bookmark" class="' + (p.state.bookmarked ? 'on-bm' : '') + '" title="' + (p.state.bookmarked ? 'Remove bookmark (b)' : 'Bookmark (b)') + '" aria-label="Bookmark" aria-pressed="' + !!p.state.bookmarked + '" tabindex="-1">' + icon(p.state.bookmarked ? 'bookmarkOn' : 'bookmark') + '</button>' +
      '<button type="button" data-act="copy" title="Copy link to post" aria-label="Copy link to post" tabindex="-1">' + icon('link') + '</button>' +
      '<button type="button" data-act="open" title="Open on x.com" aria-label="Open on x.com" tabindex="-1">' + icon('open') + '</button>' +
      '</div></div></article>';
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
      ? '<div class="minis">' + n.users.slice(0, 8).map((u) => '<a href="' + profile(u.handle) + '" target="_blank" rel="noopener noreferrer" title="' + h(u.name) + '" aria-label="' + h(u.name) + ' on X"><img src="' + h(avatar(u.avatar, true)) + '" alt="" loading="lazy" decoding="async"></a>').join('') + '</div>'
      : '';
    const target = n.target && !n.target.unavailable ? '<div class="snip" data-url="' + h(safeUrl(n.target.url)) + '">' + h(n.target.plain) + '</div>' : '';
    return '<article class="cell act" data-note="' + h(n.id) + '" data-url="' + h(safeUrl(n.target && n.target.url ? n.target.url : n.url)) + '">' +
      '<div class="act-ic ' + h(n.icon) + '">' + icon(NOTE_ICON[n.icon] || 'activity') + '</div>' +
      '<div class="main">' + minis + '<div class="meta"><span class="atx">' + noteText(n, ctx) + '</span>' + time(n.timeMs, n.target ? n.target.url : n.url, ctx) + '</div>' + target + '</div></article>';
  }

  // One timeline block. `visible` is the list of posts that survived the
  // mute filters (threads can lose some of theirs).
  function block(b, ctx, visible) {
    if (b.kind === 'notification') return notification(b.n, ctx);
    if (b.kind === 'thread') {
      const c = Object.assign({}, ctx, { inThread: true });
      return '<div class="thread">' + visible.map((p) => post(p, c)).join('') + '</div>';
    }
    return post(b.post, Object.assign({}, ctx, { context: b.context }));
  }

  Sweeter.render = { block, post, notification, timeLabel, avatar, badges };
})(typeof globalThis !== 'undefined' ? globalThis : this);
