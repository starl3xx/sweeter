const F = require('./fixtures');
const N = globalThis.Sweeter.normalize;
const X = globalThis.Sweeter.filters;

const post = (opts) => N.post(F.tweet(opts), 0);
const photo = { type: 'photo', media_url_https: 'https://pbs.twimg.com/media/a.jpg', original_info: { width: 10, height: 10 } };

test('quick filters: media, links, reposts, replies', () => {
  const plain = post({ text: 'just words' });
  const pic = post({ text: 'look', media: [photo] });
  const link = post({ text: 'read https://t.co/a', entities: { urls: [{ url: 'https://t.co/a', expanded_url: 'https://macstories.net/x', display_url: 'macstories.net/x', indices: [5, 19] }] } });
  const repost = N.post(F.tweet({ user: F.user('rt', 'RT'), retweetOf: F.tweet({ text: 'original' }) }), 0);
  const reply = post({ text: 'yes' });
  reply.replyTo = 'someoneelse';
  const selfReply = post({ text: 'and another thing' });
  selfReply.replyTo = selfReply.author.handle;

  const media = X.build(['q:media']);
  eq([plain, pic].map(media), [false, true]);
  eq([plain, link].map(X.build(['q:links'])), [false, true]);
  eq([plain, repost].map(X.build(['q:noReposts'])), [true, false]);
  // A thread’s continuations are replies too: only the first post stays.
  eq([plain, reply, selfReply].map(X.build(['q:noReplies'])), [true, false, false]);
  // Media in a quoted post counts: the reader sees it.
  const quotesPic = post({ text: 'this', quote: F.tweet({ text: 'pic', media: [photo] }) });
  eq(media(quotesPic), true);
  // Two filters at once: both must pass.
  eq([pic, repost].map(X.build(['q:media', 'q:noReposts'])), [true, false]);
  eq(X.build([]), null);
  eq(X.build(['q:gone']), null);
});

test('mutuals use both follow directions from X’s data', () => {
  const mutual = N.post(F.tweet({ user: F.user('m', 'M', { relationship_perspectives: { following: true, followed_by: true } }) }), 0);
  const oneWay = N.post(F.tweet({ user: F.user('o', 'O', { relationship_perspectives: { following: true, followed_by: false } }) }), 0);
  eq(mutual.author.followedBy, true);
  eq([mutual, oneWay].map(X.build(['q:mutuals'])), [true, false]);
});

test('custom filter: words with OR, exclusions, match any or all', () => {
  const a = post({ text: 'New post on macstories today' });
  const b = post({ text: 'sixcolors has a take', media: [photo] });
  const c = post({ text: 'macstories video on tiktok' });
  const start = post({ text: 'a fresh start' });
  const blogs = { id: 'f:1', name: 'Blogs', include: 'macstories OR sixcolors', exclude: 'tiktok' };
  const t = X.build(['f:1'], [blogs]);
  eq([a, b, c].map(t), [true, true, false]);
  // Whole words: “art” does not match “start”.
  eq(X.compile({ include: 'art' })(start), false);
  const any = X.compile({ match: 'any', rules: [{ k: 'media' }, { k: 'hashtags' }] });
  const all = X.compile({ match: 'all', rules: [{ k: 'media' }, { k: 'hashtags' }] });
  eq([any(a), any(b), all(b)], [false, true, false]);
  const noMedia = X.compile({ rules: [{ k: 'media', not: true }] });
  eq([noMedia(a), noMedia(b)], [true, false]);
});

test('mentions count only the text the reader sees', () => {
  const hidden = post({ text: '@alice thanks!', range: [7, 14] });
  const shown = post({ text: 'thanks @alice' });
  const email = post({ text: 'mail me at a@b.com' });
  const t = X.compile({ rules: [{ k: 'mentions' }] });
  eq([hidden, shown, email].map(t), [false, true, false]);
});

test('find matches every word, in text, author and links', () => {
  const p = post({ text: 'Ivory has timeline filters', user: F.user('tapbots', 'Tapbots') });
  eq(X.find('ivory FILTERS')(p), true);
  eq(X.find('ivory missing')(p), false);
  eq(X.find('@tapbots')(p), true);
  eq(X.find('filt')(p), true); // partial words match while typing
  eq(X.find('   '), null);
});

test('quick filter order keeps ⌥1 to ⌥5; new ones follow', () => {
  eq(X.QUICK.map((f) => f.id), ['q:media', 'q:links', 'q:noReposts', 'q:noReplies', 'q:mutuals', 'q:video', 'q:noQuotes', 'q:unread']);
  // Every row the custom filter editor offers has a test behind it.
  ok(X.CRITERIA.every(([k]) => typeof X.TESTS[k] === 'function'));
  for (const k of ['video', 'quotes', 'verified']) ok(X.CRITERIA.some((c) => c[0] === k), k + ' is in CRITERIA');
});

test('quotes: any quoted post, a deleted one included', () => {
  const plain = post({ text: 'just words' });
  const quoting = post({ text: 'this', quote: F.tweet({ text: 'original' }) });
  const gone = post({ text: 'this', quote: { __typename: 'TweetTombstone' } });
  eq(gone.quote.unavailable, true);
  eq([plain, quoting, gone].map(X.compile({ rules: [{ k: 'quotes' }] })), [false, true, true]);
  eq([plain, quoting, gone].map(X.build(['q:noQuotes'])), [true, false, false]);
});

test('video: a video or GIF on the post or its quoted post', () => {
  const plain = post({ text: 'just words' });
  const pic = post({ text: 'pic', media: [F.media('photo')] });
  const vid = post({ text: 'vid', media: [F.media('video')] });
  const gif = post({ text: 'gif', media: [F.media('animated_gif')] });
  const mixed = post({ text: 'both', media: [F.media('photo'), F.media('video')] });
  const quotesVid = post({ text: 'see', quote: F.tweet({ text: 'clip', media: [F.media('video')] }) });
  const quotesPic = post({ text: 'see', quote: F.tweet({ text: 'pic', media: [F.media('photo')] }) });
  eq(gif.media[0].type, 'gif');
  const t = X.build(['q:video']);
  eq([plain, pic, vid, gif, mixed, quotesVid, quotesPic].map(t), [false, false, true, true, true, true, false]);
  // Video is media too, so “Media only” keeps it.
  eq([vid, quotesVid].map(X.build(['q:media'])), [true, true]);
  eq([pic, vid].map(X.compile({ rules: [{ k: 'video', not: true }] })), [true, false]);
});

test('verified: any checkmark, blue, gold or gray', () => {
  const blue = post({ user: F.user('blue', 'Blue', { is_blue_verified: true }) });
  const gold = post({ user: F.user('gold', 'Gold', { verification: { verified_type: 'Business' } }) });
  const gray = post({ user: F.user('gray', 'Gray', { verification: { verified_type: 'Government' } }) });
  const none = post({ user: F.user('none', 'None') });
  eq([blue.author.badge, gold.author.badge, gray.author.badge, none.author.badge], ['blue', 'gold', 'gray', null]);
  eq(gold.author.verified, false);
  eq([blue, gold, gray, none].map(X.compile({ rules: [{ k: 'verified' }] })), [true, true, true, false]);
  eq([blue, none].map(X.compile({ rules: [{ k: 'verified', not: true }] })), [false, true]);
});

test('unread only asks the column through ctx', () => {
  const a = post({ text: 'new one' });
  const b = post({ text: 'old one', media: [F.media('photo')] });
  const c = post({ text: 'new pic', media: [F.media('photo')] });
  const fresh = new Set([a.id, c.id]);
  const ctx = { unread: (p) => fresh.has(p.id) };
  eq([a, b, c].map(X.build(['q:unread'], [], ctx)), [true, false, true]);
  // Combined with another filter: both must pass.
  eq([a, b, c].map(X.build(['q:unread', 'q:media'], null, ctx)), [false, false, true]);
  // A custom filter gets the same ctx, and “not” works.
  const custom = [{ id: 'f:read', name: 'Read', rules: [{ k: 'unread', not: true }] }];
  eq([a, b, c].map(X.build(['f:read'], custom, ctx)), [false, true, false]);
  eq([a, b].map(X.compile({ rules: [{ k: 'unread' }] }, ctx)), [true, false]);
  // No ctx: nothing is known to be unread, and other filters behave as before.
  eq([a, b, c].map(X.build(['q:unread'])), [false, false, false]);
  eq([a, b, c].map(X.build(['q:unread'], [], {})), [false, false, false]);
  eq([a, b, c].map(X.build(['q:media'], [])), [false, true, true]);
});

// Notification column blocks, built the way the store gets them from X.
function noteBlocks() {
  const u = F.user('theo', 'Theo');
  const body = F.notifications(
    [
      F.notificationEntry('reply_icon', 'Theo replied', [u], '1790000000900', F.tweet({ text: 'a reply' })),
      F.notificationEntry('heart_icon', 'Theo liked your post', [u], '1790000000800', F.tweet({ text: 'mine' })),
      F.notificationEntry('retweet_icon', 'Theo reposted your post', [u], '1790000000700', F.tweet({ text: 'mine' })),
      F.notificationEntry('person_icon', 'Theo followed you', [u], '1790000000600'),
      F.notificationEntry('bell_icon', 'New post from Theo', [u], '1790000000500'),
      F.notificationEntry('sparkle_icon', 'Something new', [u], '1790000000400'),
      F.tweetEntry(F.tweet({ text: '@you hi', user: u }), '1790000000300'),
      F.conversation([F.tweet({ text: 'one' }), F.tweet({ text: 'two' })], '1790000000200'),
    ],
    '1790000000000',
  );
  const blocks = N.timeline(body).find((i) => i.type === 'add').blocks;
  eq(blocks.map((b) => (b.kind === 'notification' ? b.n.icon : b.kind)), ['reply', 'like', 'repost', 'follow', 'bell', 'other', 'post', 'thread']);
  return blocks;
}

test('notification type filters pick by kind', () => {
  const blocks = noteBlocks();
  eq(X.NOTE_QUICK.map((f) => f.id), ['n:mentions', 'n:likes', 'n:reposts', 'n:follows', 'n:other']);
  const run = (ids) => blocks.map(X.buildNote(ids));
  eq(run(['n:mentions']), [true, false, false, false, false, false, true, true]);
  eq(run(['n:likes']), [false, true, false, false, false, false, false, false]);
  eq(run(['n:reposts']), [false, false, true, false, false, false, false, false]);
  eq(run(['n:follows']), [false, false, false, true, false, false, false, false]);
  // Everything else: notifications only, never posts or threads.
  eq(run(['n:other']), [false, false, false, false, true, true, false, false]);
});

test('notification type filters: any selected type shows', () => {
  const blocks = noteBlocks();
  eq(blocks.map(X.buildNote(['n:likes', 'n:follows'])), [false, true, false, true, false, false, false, false]);
  eq(blocks.map(X.buildNote(X.NOTE_QUICK.map((f) => f.id))).every(Boolean), true);
  // Unknown ids are ignored; nothing known on means no filter at all.
  eq(blocks.map(X.buildNote(['n:likes', 'q:media'])), [false, true, false, false, false, false, false, false]);
  eq(X.buildNote([]), null);
  eq(X.buildNote(undefined), null);
  eq(X.buildNote(['n:gone', 'q:media']), null);
  eq(X.buildNote(['n:likes'])(null), false);
});
