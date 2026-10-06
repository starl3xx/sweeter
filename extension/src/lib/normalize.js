// Converts X’s GraphQL timeline responses into Sweeter’s own small models.
//
// Every path below was read off live X Pro responses captured 2026-09-28.
// Users no longer carry `legacy`:
// name and screen_name live in `core`, the avatar in `avatar.image_url`.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});
  const { escapeHtml, snowflakeMs } = Sweeter.util;
  const { richText, plainText } = Sweeter.text;

  // ---------- sources (one per X Pro column) ----------

  function sourceFor(op, vars) {
    const v = vars || {};
    switch (op) {
      case 'HomeLatestTimeline':
        return { key: 'home', kind: 'home', title: 'Home' };
      case 'HomeTimeline':
        return { key: 'home-foryou', kind: 'home', title: 'For You' };
      case 'NotificationsTimeline': {
        const t = String(v.timeline_type || 'All');
        return t === 'Mentions'
          ? { key: 'mentions', kind: 'notifications', title: 'Mentions' }
          : { key: 'notifications:' + t.toLowerCase(), kind: 'notifications', title: t === 'All' ? 'Notifications' : t };
      }
      case 'ListLatestTweetsTimeline':
        return v.listId ? { key: 'list:' + v.listId, kind: 'list', title: 'List', listId: String(v.listId) } : null;
      case 'SearchTimeline':
        return v.rawQuery ? { key: 'search:' + v.rawQuery + ':' + (v.product || 'Top'), kind: 'search', title: v.rawQuery } : null;
      case 'UserTweets':
      case 'UserTweetsAndReplies':
      case 'UserMedia':
        return v.userId ? { key: op + ':' + v.userId, kind: 'user', title: 'Profile' } : null;
      case 'UserOriginalsTimeline':
        // A profile column (verified 2026-09-30: X Pro’s profile column).
        return v.userId ? { key: 'user:' + v.userId, kind: 'user', title: 'Profile' } : null;
      case 'Likes':
        return v.userId ? { key: 'likes:' + v.userId, kind: 'likes', title: 'Likes' } : null;
      case 'Bookmarks':
        return { key: 'bookmarks', kind: 'bookmarks', title: 'Bookmarks' };
      default:
        return null;
    }
  }

  // ---------- users ----------

  function user(u) {
    if (!u || u.__typename !== 'User') return null;
    const core = u.core || {};
    const legacy = u.legacy || {}; // older shape, kept as a fallback
    const handle = core.screen_name || legacy.screen_name;
    if (!handle) return null;
    // Checkmarks as X draws them (verified on live data: verification.verified
    // is never set; the type decides gold or gray, otherwise blue for X Premium).
    const vt = u.verification && u.verification.verified_type;
    const label = u.affiliates_highlighted_label && u.affiliates_highlighted_label.label;
    return {
      id: u.rest_id || u.id,
      name: core.name || legacy.name || handle,
      handle,
      avatar: (u.avatar && u.avatar.image_url) || legacy.profile_image_url_https || '',
      verified: !!u.is_blue_verified,
      verifiedType: vt || null,
      badge: vt === 'Business' ? 'gold' : vt === 'Government' ? 'gray' : u.is_blue_verified ? 'blue' : null,
      affiliate: label && label.badge && label.badge.url ? { name: label.description || '', badge: label.badge.url, url: (label.url && label.url.url) || '' } : null,
      protected: !!(u.privacy && u.privacy.protected),
      // How the signed-in account relates to this one (for the Mutuals filter).
      following: !!((u.relationship_perspectives && u.relationship_perspectives.following) || legacy.following),
      followedBy: !!((u.relationship_perspectives && u.relationship_perspectives.followed_by) || legacy.followed_by),
    };
  }

  function userFromResults(r) {
    return r && r.result ? user(r.result) : null;
  }

  // ---------- posts ----------

  function unwrap(r) {
    if (!r) return null;
    if (r.__typename === 'TweetWithVisibilityResults') return r.tweet || null;
    return r;
  }

  function sourceName(html) {
    const m = /<a[^>]*>([^<]*)<\/a>/.exec(html || '');
    return m ? m[1] : html || '';
  }

  function media(legacy) {
    const list = (legacy.extended_entities && legacy.extended_entities.media) || (legacy.entities && legacy.entities.media) || [];
    return list.map((m) => {
      const out = {
        type: m.type === 'animated_gif' ? 'gif' : m.type,
        url: m.media_url_https,
        w: m.original_info && m.original_info.width,
        h: m.original_info && m.original_info.height,
        alt: m.ext_alt_text || '',
        link: m.expanded_url || '',
      };
      if (m.video_info) {
        const mp4 = (m.video_info.variants || []).filter((v) => v.content_type === 'video/mp4').sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        out.videoUrl = mp4.length ? mp4[0].url : null;
        out.durationMs = m.video_info.duration_millis || null;
      }
      return out;
    });
  }

  function bindingMap(card) {
    const map = {};
    for (const b of (card && card.legacy && card.legacy.binding_values) || []) map[b.key] = b.value;
    return map;
  }

  function card(r, urls) {
    if (!r.card || !r.card.legacy) return null;
    const name = r.card.legacy.name || '';
    const b = bindingMap(r.card);
    const str = (k) => (b[k] && b[k].string_value) || '';
    const img = (k) => (b[k] && b[k].image_value && b[k].image_value.url) || '';
    if (/^poll\d/.test(name)) {
      const choices = [];
      for (let i = 1; i <= 4; i++) {
        if (!b['choice' + i + '_label']) break;
        choices.push({ label: str('choice' + i + '_label'), count: Number(str('choice' + i + '_count') || 0) });
      }
      return { kind: 'poll', choices, ends: str('end_datetime_utc'), final: str('counts_are_final') === 'true' };
    }
    const title = str('title');
    if (!title) return null;
    const tco = str('card_url') || r.card.legacy.url || '';
    const match = (urls || []).find((u) => u.url === tco);
    return {
      kind: name === 'summary_large_image' ? 'large' : 'summary',
      title,
      description: str('description'),
      domain: str('vanity_url') || str('domain'),
      url: (match && match.expanded_url) || tco,
      image: img('photo_image_full_size_small') || img('summary_photo_image_small') || img('thumbnail_image') || img('thumbnail_image_small') || '',
    };
  }

  function article(r) {
    const a = r.article && r.article.article_results && r.article.article_results.result;
    if (!a || !a.title) return null;
    const cover = a.cover_media && a.cover_media.media_info;
    const out = {
      id: a.rest_id || a.id,
      title: a.title,
      preview: a.preview_text || '',
      image: cover ? cover.original_img_url : '',
      w: cover ? cover.original_img_width : null,
      h: cover ? cover.original_img_height : null,
      url: 'https://x.com/i/article/' + (a.rest_id || a.id),
    };
    const body = articleBody(a);
    if (body) out.body = body;
    return out;
  }

  function noteMedia(text, media) {
    const out = [];
    const t = String(text || '');
    for (const m of media || []) {
      const i = m && m.url ? t.indexOf(m.url) : -1;
      if (i < 0) continue;
      const s = Array.from(t.slice(0, i)).length;
      out.push(Object.assign({}, m, { indices: [s, s + Array.from(m.url).length] }));
    }
    return out;
  }

  // Real bold and italic in a long post (note_tweet richtext, written with
  // X's composer formatting). Its tags count UTF-16 units, unlike the
  // entities beside them, which count code points: X's composer measures
  // them with string lengths, and only that reading starts each range on a
  // word in live posts with an emoji before them (verified 2026-10-06).
  // Returned as code point ranges for richText.
  function richtextStyles(text, richtext) {
    const tags = (richtext && richtext.richtext_tags) || [];
    if (!tags.length) return [];
    // UTF-16 offset -> code point index.
    const at = [];
    let cp = 0;
    for (const ch of String(text)) {
      for (let k = 0; k < ch.length; k++) at.push(cp);
      cp++;
    }
    at.push(cp);
    const idx = (u) => at[Math.max(0, Math.min(at.length - 1, u | 0))];
    const out = [];
    for (const t of tags) {
      const types = (t.richtext_types || []).map((x) => String(x).toLowerCase());
      const bold = types.includes('bold');
      const italic = types.includes('italic');
      if (!bold && !italic) continue;
      const s = idx(t.from_index);
      const e = idx(t.to_index);
      if (e > s) out.push({ s, e, bold, italic });
    }
    return out;
  }

  // ---------- article bodies ----------
  // Only a conversation carries an article's text: X Pro's TweetDetail asks
  // for content_state (withArticleRichContentState); timelines carry the
  // title, preview and cover alone (verified 2026-10-05). content_state is
  // Draft.js raw content as X stores it: entityMap is a list of {key, value},
  // a range names an entry by that key (not its place in the list), and
  // offsets and lengths count code points. X's own reader (verified in its
  // bundle) knows these block types and atomic entities; anything else is
  // read as a paragraph, or left out.
  const ART_BLOCKS = { unstyled: 'p', 'header-one': 'h1', 'header-two': 'h2', 'unordered-list-item': 'ul', 'ordered-list-item': 'ol', blockquote: 'quote' };

  function articleMedia(info) {
    if (!info) return null;
    const alt = info.alt_text || '';
    if (info.__typename === 'ApiImage') return { type: 'photo', url: info.original_img_url || '', w: info.original_img_width || null, h: info.original_img_height || null, alt };
    if (info.__typename === 'ApiVideo' || info.__typename === 'ApiGif') {
      const p = info.preview_image || {};
      const mp4 = (info.variants || []).filter((v) => v && v.content_type === 'video/mp4').sort((x, y) => (y.bit_rate || 0) - (x.bit_rate || 0));
      const url = mp4.length ? mp4[0].url : null;
      if (!url) return null;
      return { type: info.__typename === 'ApiGif' ? 'gif' : 'video', url: p.original_img_url || '', w: p.original_img_width || null, h: p.original_img_height || null, alt: alt || p.alt_text || '', videoUrl: url };
    }
    return null;
  }

  // One block's text as HTML: bold, italic, strikethrough and links.
  function articleInline(b, ents) {
    const cps = Array.from(b.text || '');
    const n = cps.length;
    const style = new Uint8Array(n);
    const link = new Array(n).fill(null);
    const BITS = { bold: 1, italic: 2, strikethrough: 4 };
    for (const r of b.inlineStyleRanges || []) {
      const bit = BITS[String(r.style || '').toLowerCase()];
      if (bit) for (let i = Math.max(0, r.offset); i < Math.min(n, r.offset + r.length); i++) style[i] |= bit;
    }
    for (const r of b.entityRanges || []) {
      const e = ents.get(String(r.key));
      const url = e && e.type === 'LINK' && e.data && /^https?:\/\//i.test(e.data.url || '') ? e.data.url : null;
      if (url) for (let i = Math.max(0, r.offset); i < Math.min(n, r.offset + r.length); i++) link[i] = url;
    }
    const text = (s) => escapeHtml(s).replace(/\n/g, '<br>');
    const styled = (s, m) => (m & 4 ? '<s>' : '') + (m & 2 ? '<em>' : '') + (m & 1 ? '<strong>' : '') + text(s) + (m & 1 ? '</strong>' : '') + (m & 2 ? '</em>' : '') + (m & 4 ? '</s>' : '');
    let html = '';
    let i = 0;
    while (i < n) {
      const url = link[i];
      let j = i;
      while (j < n && link[j] === url) j++;
      let inner = '';
      let k = i;
      while (k < j) {
        let m = k;
        while (m < j && style[m] === style[k]) m++;
        inner += styled(cps.slice(k, m).join(''), style[k]);
        k = m;
      }
      html += url ? '<a class="u" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" title="' + escapeHtml(url) + '">' + inner + '</a>' : inner;
      i = j;
    }
    return html;
  }

  function articleBody(a) {
    let cs = a.content_state;
    if (typeof cs === 'string') {
      try {
        cs = JSON.parse(cs);
      } catch (e) {
        return null;
      }
    }
    if (!cs || !Array.isArray(cs.blocks)) return null;
    const ents = new Map();
    const list = Array.isArray(cs.entityMap) ? cs.entityMap : Object.keys(cs.entityMap || {}).map((key) => ({ key, value: cs.entityMap[key] }));
    for (const e of list) if (e && e.value) ents.set(String(e.key), e.value);
    const media = new Map();
    for (const m of a.media_entities || []) if (m && m.media_id) media.set(String(m.media_id), m.media_info);
    const out = [];
    for (const b of cs.blocks) {
      if (!b) continue;
      if (b.type === 'atomic') {
        const r = (b.entityRanges || [])[0];
        const e = r ? ents.get(String(r.key)) : null;
        const d = (e && e.data) || {};
        switch (e && e.type) {
          case 'MEDIA': {
            const items = (d.mediaItems || []).map((i) => articleMedia(media.get(String(i.mediaId)))).filter(Boolean);
            if (items.length) out.push({ t: 'media', items, caption: d.caption || '' });
            break;
          }
          case 'TWEET':
            if (/^\d+$/.test(String(d.tweetId || ''))) out.push({ t: 'post', id: String(d.tweetId) });
            break;
          case 'LINK':
            if (/^https?:\/\//i.test(d.url || '')) out.push({ t: 'link', url: d.url });
            break;
          case 'DIVIDER':
            out.push({ t: 'hr' });
            break;
          case 'MARKDOWN':
            if (d.markdown) out.push({ t: 'code', text: String(d.markdown).replace(/^```[^\n]*\n([\s\S]*?)\n?```\s*$/, '$1') });
            break;
          case 'LATEX':
            if (/\S/.test(b.text || '')) out.push({ t: 'code', text: b.text });
            break;
          default:
            break;
        }
        continue;
      }
      const html = articleInline(b, ents);
      // An empty paragraph is spacing in X's editor, not content.
      if (!html && (b.type || 'unstyled') === 'unstyled') continue;
      out.push({ t: ART_BLOCKS[b.type] || 'p', html });
    }
    return out.length ? out : null;
  }

  // depth 0 = a timeline post; depth 1 = its quote (quotes of quotes are not expanded).
  // The token cards X attaches to a ticker (verified 2026-10-02): the text
  // holds "ethereum:0x3206…" with a smart tag giving its name and ticker;
  // cashtag_attachments lists the same ids. Native coins ("ripple:native")
  // and stocks ("$CRCL") have no contract, so no card. Price comes later.
  function tickers(r, entities) {
    const ID = /^([a-z0-9_-]+):(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
    const out = [];
    const add = (id, info) => {
      const m = ID.exec(String(id || ''));
      if (m && !out.some((t) => t.address === m[2])) out.push({ chain: m[1], address: m[2], symbol: String(info.ticker || ''), name: String(info.name || '') });
    };
    for (const st of entities.smarttags || []) add(st.text, (st.tag && st.tag.info && st.tag.info.info) || {});
    for (const a of r.cashtag_attachments || []) add(a && a.rest_id, {});
    return out.slice(0, 4);
  }

  function post(result, depth) {
    const r = unwrap(result);
    if (!r) return null;
    if (r.__typename !== 'Tweet') {
      return r.__typename ? { unavailable: true, id: r.rest_id || null, reason: r.__typename } : null;
    }
    const legacy = r.legacy || {};
    const author = userFromResults(r.core && r.core.user_results);
    if (!author) return null;

    // A repost: show the original, remember who reposted it.
    if (legacy.retweeted_status_result && !depth) {
      const inner = post(legacy.retweeted_status_result.result, 0);
      if (inner && !inner.unavailable) {
        inner.repostedBy = { id: author.id, name: author.name, handle: author.handle };
        inner.repostId = r.rest_id;
        return inner;
      }
    }

    const note = r.note_tweet && r.note_tweet.note_tweet_results && r.note_tweet.note_tweet_results.result;
    const text = note ? note.text : legacy.full_text || '';
    const styles = note ? richtextStyles(text, note.richtext) : [];
    // A long post's media come from the short legacy text, and so do their
    // indices: they point into legacy.full_text, not the note's text, which
    // (in every capture, 29 posts) doesn't hold the media link at all.
    // Applied to the note they cut 23 letters from its middle. Only a media
    // link the note really contains is hidden, found by its own address.
    const entities = note ? Object.assign({}, note.entity_set, { media: noteMedia(note.text, (legacy.entities || {}).media) }) : legacy.entities || {};
    const range = note ? null : legacy.display_text_range;
    const hideUrls = [];
    if (legacy.quoted_status_permalink && legacy.quoted_status_permalink.url) hideUrls.push(legacy.quoted_status_permalink.url);
    // An X Article arrives as a bare x.com/i/article link in the text plus
    // its title, preview and cover in `article` (verified on live data).
    const art = article(r);
    if (art) for (const u of entities.urls || []) if (/\/i\/article\//.test(u.expanded_url || '')) hideUrls.push(u.url);

    const quoted = !depth && r.quoted_status_result ? post(r.quoted_status_result.result, 1) : null;
    const id = r.rest_id || legacy.id_str;
    const createdMs = snowflakeMs(id);

    return {
      id,
      url: 'https://x.com/' + author.handle + '/status/' + id,
      author,
      createdMs: isFinite(createdMs) ? createdMs : Date.parse(legacy.created_at),
      html: richText(text, entities, range, { hideUrls, styles }),
      plain: plainText(text, range, entities),
      lang: legacy.lang || '',
      source: sourceName(r.source),
      replyTo: legacy.in_reply_to_screen_name || null,
      replyToId: legacy.in_reply_to_status_id_str || null,
      conversationId: legacy.conversation_id_str || id,
      hashtags: (entities.hashtags || []).map((h) => String(h.text).toLowerCase()),
      // Web links in the text (the quote permalink and article link are not).
      links: (entities.urls || []).filter((u) => !hideUrls.includes(u.url)).map((u) => u.expanded_url || u.url),
      mentions: (entities.user_mentions || []).map((m) => String(m.screen_name).toLowerCase()),
      counts: {
        reply: legacy.reply_count || 0,
        repost: legacy.retweet_count || 0,
        like: legacy.favorite_count || 0,
        quote: legacy.quote_count || 0,
        bookmark: legacy.bookmark_count || 0,
        views: r.views && r.views.count ? Number(r.views.count) : null,
      },
      state: { liked: !!legacy.favorited, reposted: !!legacy.retweeted, bookmarked: !!legacy.bookmarked },
      sensitive: !!legacy.possibly_sensitive,
      media: media(legacy),
      card: card(r, (legacy.entities || {}).urls),
      tickers: tickers(r, entities),
      article: art,
      quote: quoted,
      repostedBy: null,
      repostId: null,
    };
  }

  // ---------- notifications ----------

  const ICONS = {
    heart_icon: 'like',
    retweet_icon: 'repost',
    person_icon: 'follow',
    bell_icon: 'bell',
    news_icon: 'news',
    list_icon: 'list',
    reply_icon: 'reply',
    milestone_icon: 'milestone',
  };

  function notification(ic) {
    const msg = ic.rich_message || { text: '' };
    // rich_message ranges are code points (verified); names become bold.
    const cps = Array.from(msg.text || '');
    const ranges = (msg.entities || []).filter((e) => e.ref && e.ref.type === 'TimelineRichTextUser').sort((a, b) => a.fromIndex - b.fromIndex);
    let html = '';
    const parts = [];
    let pos = 0;
    for (const r of ranges) {
      if (r.fromIndex < pos) continue;
      const before = cps.slice(pos, r.fromIndex).join('');
      const name = cps.slice(r.fromIndex, r.toIndex).join('');
      html += escapeHtml(before) + '<b>' + escapeHtml(name) + '</b>';
      if (before) parts.push({ text: before });
      parts.push({ text: name, user: userFromResults(r.ref.user_results) });
      pos = r.toIndex;
    }
    const rest = cps.slice(pos).join('');
    html += escapeHtml(rest);
    if (rest) parts.push({ text: rest });

    const tpl = ic.template || {};
    const users = (tpl.from_users || []).map((u) => userFromResults(u.user_results)).filter(Boolean);
    const targetObj = (tpl.target_objects || []).find((t) => t.tweet_results);
    return {
      id: ic.id,
      icon: ICONS[ic.notification_icon] || 'other',
      html,
      parts,
      plain: msg.text || '',
      users,
      target: targetObj ? post(targetObj.tweet_results.result, 1) : null,
      // Despite its name, timestamp_ms is an ISO date string (verified on live data).
      timeMs: /^\d+$/.test(String(ic.timestamp_ms)) ? Number(ic.timestamp_ms) : Date.parse(ic.timestamp_ms),
      url: (ic.notification_url && ic.notification_url.url) || '',
    };
  }

  // ---------- timelines ----------

  function findInstructions(body) {
    let found = null;
    (function walk(o, d) {
      if (found || !o || typeof o !== 'object' || d > 9) return;
      if (Array.isArray(o.instructions)) {
        found = o.instructions;
        return;
      }
      for (const k in o) walk(o[k], d + 1);
    })(body, 0);
    return found;
  }

  function block(entry) {
    const c = entry.content || {};
    const base = { key: entry.entryId, sortIndex: String(entry.sortIndex || '0') };
    if (c.entryType === 'TimelineTimelineCursor' || c.cursorType) {
      return Object.assign(base, { kind: 'cursor', cursorType: c.cursorType, value: c.value });
    }
    if (c.entryType === 'TimelineTimelineItem' && c.itemContent) {
      const ic = c.itemContent;
      if (ic.promotedMetadata) return null;
      if (ic.itemType === 'TimelineTweet') {
        const p = post(ic.tweet_results && ic.tweet_results.result, 0);
        if (!p) return null;
        const ctx = ic.socialContext && ic.socialContext.text ? ic.socialContext.text : null;
        return Object.assign(base, { kind: 'post', post: p, context: ctx });
      }
      if (ic.itemType === 'TimelineNotification') {
        return Object.assign(base, { kind: 'notification', n: notification(ic) });
      }
      return null;
    }
    if (c.entryType === 'TimelineTimelineModule' && c.displayType === 'VerticalConversation') {
      const posts = (c.items || [])
        .map((i) => i.item && i.item.itemContent)
        .filter((ic) => ic && ic.itemType === 'TimelineTweet' && !ic.promotedMetadata)
        .map((ic) => post(ic.tweet_results && ic.tweet_results.result, 0))
        .filter((p) => p && !p.unavailable);
      if (!posts.length) return null;
      return Object.assign(base, { kind: 'thread', posts });
    }
    return null;
  }

  // Returns the normalized instruction list for one response.
  function timeline(body) {
    const raw = findInstructions(body) || [];
    const out = [];
    for (const ins of raw) {
      switch (ins.type) {
        case 'TimelineClearCache':
          out.push({ type: 'clear' });
          break;
        case 'TimelineAddEntries':
        case 'TimelineAddToModule': {
          const blocks = [];
          const cursors = {};
          for (const e of ins.entries || ins.moduleItems || []) {
            const b = block(e);
            if (!b) continue;
            if (b.kind === 'cursor') cursors[String(b.cursorType).toLowerCase()] = b.value;
            else blocks.push(b);
          }
          out.push({ type: 'add', blocks, cursors });
          break;
        }
        case 'TimelineReplaceEntry': {
          const b = ins.entry ? block(ins.entry) : null;
          if (b && b.kind === 'cursor') out.push({ type: 'cursor', cursorType: String(b.cursorType).toLowerCase(), value: b.value });
          break;
        }
        case 'TimelinePinEntry': {
          const b = ins.entry ? block(ins.entry) : null;
          if (b && b.kind !== 'cursor') out.push({ type: 'pin', block: b });
          break;
        }
        case 'TimelineMarkEntriesUnreadGreaterThanSortIndex':
          out.push({ type: 'unreadAbove', sortIndex: String(ins.sort_index) });
          break;
        case 'TimelineClearEntriesUnreadState':
          out.push({ type: 'clearUnread' });
          break;
        default:
          break;
      }
    }
    return out;
  }

  function listInfo(body) {
    const l = body && body.data && body.data.list;
    return l && l.name ? { id: String(l.id_str || ''), name: l.name } : null;
  }

  // ---------- profiles ----------

  // UserByScreenName (verified 2026-09-28): no `legacy` block; each part
  // has its own object (profile_bio, relationship_counts, banner, website).
  function profile(body) {
    const r = body && body.data && body.data.user && body.data.user.result;
    const u = user(r);
    if (!u) return null;
    const bio = r.profile_bio || {};
    const counts = r.relationship_counts || {};
    const rel = r.relationship_perspectives || {};
    let banner = (r.banner && r.banner.image_url) || '';
    if (banner && !/\/\d+x\d+$/.test(banner)) banner += '/1500x500';
    const created = Date.parse((r.core && r.core.created_at) || '');
    // The website arrives as a t.co link; its entity (when X sends one)
    // holds the real address.
    const site = (r.website && r.website.url) || '';
    const ents = [].concat(((bio.entities || {}).url || {}).urls || [], ((bio.entities || {}).description || {}).urls || []);
    const siteEnt = site ? ents.find((x) => x.url === site) : null;
    return Object.assign(u, {
      bio: bio.description ? richText(bio.description, { urls: ((bio.entities || {}).description || {}).urls || [] }, null, {}) : '',
      bioPlain: bio.description || '',
      banner,
      location: (r.location && r.location.location) || '',
      website: siteEnt ? siteEnt.expanded_url || site : site,
      websiteLabel: siteEnt ? siteEnt.display_url || siteEnt.expanded_url : /^https?:\/\/t\.co\//.test(site) ? 'Website' : site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
      joinedMs: isFinite(created) ? created : null,
      followers: counts.followers == null ? null : Number(counts.followers),
      followingCount: counts.following == null ? null : Number(counts.following),
      posts: r.tweet_counts && r.tweet_counts.tweets != null ? Number(r.tweet_counts.tweets) : null,
      blocking: !!rel.blocking,
      blockedBy: !!rel.blocked_by,
      muting: !!rel.muting,
      requested: !!r.follow_request_sent,
      notifications: !!(r.notifications_settings && r.notifications_settings.notifications_enabled),
    });
  }

  Sweeter.normalize = { sourceFor, user, post, notification, timeline, listInfo, profile };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.normalize;
})(typeof globalThis !== 'undefined' ? globalThis : this);
