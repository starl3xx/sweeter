const N = globalThis.Sweeter.normalize;
const F = require('./fixtures');

test('sources map operations to columns', () => {
  eq(N.sourceFor('HomeLatestTimeline', {}).key, 'home');
  eq(N.sourceFor('ListLatestTweetsTimeline', { listId: '42' }).key, 'list:42');
  eq(N.sourceFor('NotificationsTimeline', { timeline_type: 'All' }).key, 'notifications:all');
  eq(N.sourceFor('NotificationsTimeline', { timeline_type: 'Mentions' }).key, 'mentions');
  eq(N.sourceFor('ViewerBadgeCounts', {}), null);
});

test('a post keeps author, text, counts, client and time', () => {
  const p = N.post(F.tweet({ text: 'Shipped it.', source: 'X for iPhone' }), 0);
  eq(p.author.handle, 'nadiabuilds');
  eq(p.author.name, 'Nadia Okafor');
  eq(p.html, 'Shipped it.');
  eq(p.source, 'X for iPhone');
  eq(p.counts.like, 3);
  eq(p.counts.views, 1234);
  ok(p.url.endsWith('/nadiabuilds/status/' + p.id));
  ok(Math.abs(p.createdMs - Date.parse('2026-09-28T12:00:00Z')) < 86400e3);
});

test('users without legacy still resolve (2025+ shape)', () => {
  const u = N.user(F.user('ivycodes', 'Ivy Chen'));
  eq([u.handle, u.name], ['ivycodes', 'Ivy Chen']);
  ok(!('legacy' in F.user('x')));
});

test('checkmarks: gold for Business, gray for Government, blue for Premium', () => {
  eq(N.user(F.user('a', 'A', { verification: { verified: false, verified_type: 'Business' }, is_blue_verified: false })).badge, 'gold');
  eq(N.user(F.user('b', 'B', { verification: { verified: false, verified_type: 'Government' } })).badge, 'gray');
  eq(N.user(F.user('c', 'C', { is_blue_verified: true })).badge, 'blue');
  eq(N.user(F.user('d', 'D')).badge, null);
});

test('organization affiliation keeps its name and badge', () => {
  const u = N.user(F.user('e', 'E', { affiliates_highlighted_label: { label: { badge: { url: 'https://pbs.twimg.com/b.png' }, description: 'Acme', url: { url: 'https://x.com/acme', urlType: 'DeepLink' }, userLabelType: 'BusinessLabel' } } }));
  eq(u.affiliate, { name: 'Acme', badge: 'https://pbs.twimg.com/b.png', url: 'https://x.com/acme' });
});

test('TweetWithVisibilityResults unwraps', () => {
  eq(N.post(F.tweet({ text: 'limited', visibility: true }), 0).html, 'limited');
});

test('a repost shows the original with “Reposted by”', () => {
  const orig = F.tweet({ text: 'original', user: F.user('baseblocks', 'Base Blocks') });
  const rt = F.tweet({ text: 'RT @baseblocks: original', user: F.user('priya', 'Priya Raman'), retweetOf: orig });
  const p = N.post(rt, 0);
  eq(p.author.handle, 'baseblocks');
  eq(p.html, 'original');
  eq(p.repostedBy.name, 'Priya Raman');
  eq(p.repostId, rt.rest_id);
});

test('quotes nest one level and hide their permalink', () => {
  const inner = F.tweet({ text: 'three columns', user: F.user('halfpixel', 'Theo Marsh') });
  const outer = F.tweet({
    text: 'this https://t.co/quote123',
    quote: inner,
    entities: { urls: [{ url: 'https://t.co/quote123', expanded_url: 'https://x.com/q/status/1', display_url: 'x.com/q', indices: [5, 26] }] },
  });
  const p = N.post(outer, 0);
  eq(p.html, 'this');
  eq(p.quote.author.handle, 'halfpixel');
  eq(p.quote.quote, null);
});

test('long posts use note_tweet text', () => {
  const p = N.post(F.tweet({ text: 'short…', note: { text: 'the whole long post' } }), 0);
  eq(p.html, 'the whole long post');
  eq(p.plain, 'the whole long post');
});

test('media: photos keep size and alt text; videos pick the best mp4', () => {
  const p = N.post(
    F.tweet({
      media: [
        { type: 'photo', media_url_https: 'https://pbs.twimg.com/media/a.jpg', original_info: { width: 1200, height: 800 }, ext_alt_text: 'a lake' },
        {
          type: 'video',
          media_url_https: 'https://pbs.twimg.com/v.jpg',
          original_info: { width: 720, height: 720 },
          video_info: {
            duration_millis: 9000,
            variants: [
              { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/v.m3u8' },
              { content_type: 'video/mp4', bitrate: 432000, url: 'https://video.twimg.com/low.mp4' },
              { content_type: 'video/mp4', bitrate: 1280000, url: 'https://video.twimg.com/high.mp4' },
            ],
          },
        },
      ],
    }),
    0,
  );
  eq(p.media[0], { type: 'photo', url: 'https://pbs.twimg.com/media/a.jpg', w: 1200, h: 800, alt: 'a lake', link: '' });
  eq(p.media[1].videoUrl, 'https://video.twimg.com/high.mp4');
  eq(p.media[1].durationMs, 9000);
});

test('link cards read binding values', () => {
  const p = N.post(
    F.tweet({
      text: 'read https://t.co/card',
      entities: { urls: [{ url: 'https://t.co/card', expanded_url: 'https://example.com/a', display_url: 'example.com/a', indices: [5, 22] }] },
      card: {
        name: 'summary_large_image',
        url: 'https://t.co/card',
        values: [
          { key: 'title', value: { type: 'STRING', string_value: 'A title' } },
          { key: 'domain', value: { type: 'STRING', string_value: 'example.com' } },
          { key: 'card_url', value: { type: 'STRING', string_value: 'https://t.co/card' } },
          { key: 'photo_image_full_size_small', value: { type: 'IMAGE', image_value: { url: 'https://pbs.twimg.com/card.jpg', width: 386, height: 202 } } },
        ],
      },
    }),
    0,
  );
  eq(p.card, { kind: 'large', title: 'A title', description: '', domain: 'example.com', url: 'https://example.com/a', image: 'https://pbs.twimg.com/card.jpg' });
});

test('home timeline: posts, threads and cursors', () => {
  const a = F.tweet({ text: 'one', at: 10 });
  const b = F.tweet({ text: 'two', at: 20 });
  const c = F.tweet({ text: 'three', at: 30 });
  const body = F.home([F.cursor('Top', 'TOP', '9'), F.tweetEntry(a, '300'), F.conversation([b, c], '200'), F.cursor('Bottom', 'BOTTOM', '1')]);
  const ins = N.timeline(body);
  eq(ins.length, 1);
  eq(ins[0].cursors, { top: 'TOP', bottom: 'BOTTOM' });
  eq(ins[0].blocks.map((x) => x.kind), ['post', 'thread']);
  eq(ins[0].blocks[1].posts.map((p) => p.html), ['two', 'three']);
});

test('notifications: bold names by code point, users, target, unread marker', () => {
  const theo = F.user('halfpixel', '🦋 Theo');
  const mara = F.user('maralind', 'Mara');
  const target = F.tweet({ text: 'my post' });
  const body = F.notifications([F.notificationEntry('heart_icon', '🦋 Theo and Mara liked your post', [theo, mara], '1790610459401', target)], '1790610459400');
  const ins = N.timeline(body);
  eq(ins.map((i) => i.type), ['clear', 'add', 'clearUnread', 'unreadAbove']);
  const n = ins[1].blocks[0].n;
  eq(n.icon, 'like');
  eq(n.html, '<b>🦋 Theo</b> and <b>Mara</b> liked your post');
  eq(n.parts.map((x) => (x.user ? '[' + x.user.handle + ']' : x.text)), ['[halfpixel]', ' and ', '[maralind]', ' liked your post']);
  eq(n.users.map((u) => u.handle), ['halfpixel', 'maralind']);
  eq(n.target.html, 'my post');
  eq(ins[3].sortIndex, '1790610459400');
  eq(n.timeMs, 1790610459401);
});

test('promoted entries are dropped', () => {
  const e = F.tweetEntry(F.tweet({ text: 'ad' }), '5');
  e.content.itemContent.promotedMetadata = { advertiser_results: {} };
  eq(N.timeline(F.home([e]))[0].blocks.length, 0);
});

test('tombstones become unavailable posts', () => {
  eq(N.post({ __typename: 'TweetTombstone' }, 1), { unavailable: true, id: null, reason: 'TweetTombstone' });
});

test('X Articles become a card and their bare link leaves the text', () => {
  const t = F.tweet({
    text: 'A new kind of workforce https://t.co/art',
    entities: { urls: [{ url: 'https://t.co/art', expanded_url: 'https://x.com/i/article/2104', display_url: 'x.com/i/article/2104…', indices: [24, 40] }] },
  });
  t.article = { article_results: { result: { rest_id: '2104', title: 'The Agentic Workforce', preview_text: 'Why teams of agents…', cover_media: { media_info: { original_img_url: 'https://pbs.twimg.com/media/cover.jpg', original_img_width: 1200, original_img_height: 480 } } } } };
  const p = N.post(t, 0);
  eq(p.html, 'A new kind of workforce');
  eq(p.article, { id: '2104', title: 'The Agentic Workforce', preview: 'Why teams of agents…', image: 'https://pbs.twimg.com/media/cover.jpg', w: 1200, h: 480, url: 'https://x.com/i/article/2104' });
});
