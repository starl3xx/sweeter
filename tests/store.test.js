const F = require('./fixtures');
const createStore = globalThis.Sweeter.createStore;

function homeMsg(entries, cursors) {
  return { op: 'HomeLatestTimeline', vars: {}, body: F.home(entries.concat(cursors || [])) };
}

test('first load starts all-read; later posts count as unread', () => {
  const s = createStore();
  s.ingest(homeMsg([F.tweetEntry(F.tweet({ text: 'a' }), '100'), F.tweetEntry(F.tweet({ text: 'b' }), '90')]));
  const col = s.get('home');
  eq(col.readSort, '100');
  eq(col.sorted.filter((b) => s.isUnread(col, b)).length, 0);
  s.ingest(homeMsg([F.tweetEntry(F.tweet({ text: 'c' }), '110'), F.tweetEntry(F.tweet({ text: 'd' }), '120')]));
  eq(col.sorted.map((b) => b.sortIndex), ['120', '110', '100', '90']);
  eq(col.sorted.filter((b) => s.isUnread(col, b)).length, 2);
});

test('markRead only moves forward and saves the time of the post it reached', () => {
  const seen = [];
  const s = createStore({ onRead: (k, v) => seen.push([k, v]) });
  const a = F.tweet({ at: 10 });
  const b = F.tweet({ at: 20 });
  const c = F.tweet({ at: 30 });
  s.ingest(homeMsg([F.tweetEntry(a, '100')]));
  s.ingest(homeMsg([F.tweetEntry(b, '200'), F.tweetEntry(c, '300')]));
  ok(s.markRead('home', '200'));
  ok(!s.markRead('home', '150'));
  ok(s.markAllRead('home'));
  const ms = (t) => globalThis.Sweeter.util.snowflakeMs(t.rest_id);
  eq(seen, [['home', ms(b)], ['home', ms(c)]]);
});

test('a saved position survives a restart, though X numbers the entries afresh', () => {
  const old = F.tweet({ at: 10 });
  const read = F.tweet({ at: 20 });
  const fresh = F.tweet({ at: 30 });
  const t = globalThis.Sweeter.util.snowflakeMs(read.rest_id);
  // After a reload the same posts come back with new, larger sortIndexes.
  const s = createStore({ readPositions: { home: t } });
  s.ingest(homeMsg([F.tweetEntry(fresh, '9000'), F.tweetEntry(read, '8000'), F.tweetEntry(old, '7000')]));
  const col = s.get('home');
  eq(col.readSort, '8000');
  eq(col.sorted.filter((b) => s.isUnread(col, b)).length, 1);
});

test('a pre-0.15 saved sortIndex reads as the time it was made', () => {
  const read = F.tweet({ at: 20 });
  const fresh = F.tweet({ at: 3600 });
  // A timeline sortIndex is a Snowflake made at fetch time, just after `read`.
  const legacy = String(BigInt(read.rest_id) + (5000n << 22n));
  const s = createStore({ readPositions: { home: legacy } });
  s.ingest(homeMsg([F.tweetEntry(fresh, '9000'), F.tweetEntry(read, '8000')]));
  eq(s.get('home').readSort, '8000');
});

test('when every loaded post is newer than the saved position, all are unread', () => {
  const s = createStore({ readPositions: { home: 1 } });
  s.ingest(homeMsg([F.tweetEntry(F.tweet({ at: 10 }), '200'), F.tweetEntry(F.tweet({ at: 5 }), '100')]));
  const col = s.get('home');
  eq(col.sorted.filter((b) => s.isUnread(col, b)).length, 2);
});

test('duplicate entries replace, not repeat', () => {
  const s = createStore();
  const t = F.tweet({ text: 'same' });
  s.ingest(homeMsg([F.tweetEntry(t, '100')]));
  s.ingest(homeMsg([F.tweetEntry(t, '100')]));
  eq(s.get('home').sorted.length, 1);
});

test('list titles come from ListByRestId, in either order', () => {
  const s = createStore();
  s.ingest({ op: 'ListLatestTweetsTimeline', vars: { listId: '7' }, body: F.list([F.tweetEntry(F.tweet(), '5')]) });
  eq(s.get('list:7').title, 'List');
  s.ingest({ op: 'ListByRestId', vars: { listId: '7' }, body: { data: { list: { id_str: '7', name: 'Mac Devs' } } } });
  eq(s.get('list:7').title, 'Mac Devs');
  s.ingest({ op: 'ListByRestId', vars: { listId: '8' }, body: { data: { list: { id_str: '8', name: 'Builders' } } } });
  s.ingest({ op: 'ListLatestTweetsTimeline', vars: { listId: '8' }, body: F.list([F.tweetEntry(F.tweet(), '5')]) });
  eq(s.get('list:8').title, 'Builders');
});

test('notifications start at X’s own unread marker', () => {
  const s = createStore();
  const u = F.user('halfpixel', 'Theo');
  s.ingest({
    op: 'NotificationsTimeline',
    vars: { timeline_type: 'All' },
    body: F.notifications(
      [F.notificationEntry('person_icon', 'Theo followed you', [u], '1790000000300'), F.notificationEntry('heart_icon', 'Theo liked your post', [u], '1790000000200')],
      '1790000000250',
    ),
  });
  const col = s.get('notifications:all');
  eq(col.sorted.filter((b) => s.isUnread(col, b)).length, 1);
});

test('a clear instruction empties the column first', () => {
  const s = createStore();
  const u = F.user('a', 'A');
  const msg = (si) => ({ op: 'NotificationsTimeline', vars: { timeline_type: 'All' }, body: F.notifications([F.notificationEntry('person_icon', 'A followed you', [u], si)], si) });
  s.ingest(msg('10'));
  s.ingest(msg('20'));
  eq(s.get('notifications:all').sorted.map((b) => b.sortIndex), ['20']);
});

test('cursors: bottom follows the latest page; top keeps the first', () => {
  const s = createStore();
  s.ingest(homeMsg([F.tweetEntry(F.tweet(), '100')], [F.cursor('Top', 'T1', '101'), F.cursor('Bottom', 'B1', '99')]));
  s.ingest(homeMsg([F.tweetEntry(F.tweet(), '50')], [F.cursor('Top', 'T2', '51'), F.cursor('Bottom', 'B2', '49')]));
  eq(s.get('home').cursors, { top: 'T1', bottom: 'B2' });
});

test('unknown operations are ignored', () => {
  const s = createStore();
  eq(s.ingest({ op: 'ViewerBadgeCounts', vars: {}, body: {} }), null);
  eq(s.all().length, 0);
});

test('a conversation keeps X’s order and grows with more replies', () => {
  const s = createStore();
  const focal = F.tweet({ text: 'focal' });
  const r1 = F.tweet({ text: 'reply one' });
  const r2 = F.tweet({ text: 'reply two' });
  const body = (entries) => ({ data: { threaded_conversation_with_injections_v2: { instructions: [{ type: 'TimelineAddEntries', entries }] } } });
  const seen = [];
  s.subscribe((k) => seen.push(k));
  s.ingest({ op: 'TweetDetail', vars: { focalTweetId: focal.rest_id }, body: body([F.tweetEntry(focal, '9'), F.conversation([r1], '1')]) });
  s.ingest({ op: 'TweetDetail', vars: { focalTweetId: focal.rest_id, cursor: 'c' }, body: body([F.conversation([r2], '5'), F.conversation([r1], '1')]) });
  const d = s.detail(focal.rest_id);
  eq(d.blocks.map((b) => (b.kind === 'post' ? b.post.html : b.posts.map((p) => p.html).join('+'))), ['focal', 'reply one', 'reply two']);
  eq(seen, ['detail:' + focal.rest_id, 'detail:' + focal.rest_id]);
  eq(s.all().length, 0);
});

test('a conversation column draws the conversation X Pro fetched for it', () => {
  const s = createStore();
  const focal = F.tweet({ text: 'focal' });
  const r1 = F.tweet({ text: 'reply one' });
  const body = (entries) => ({ data: { threaded_conversation_with_injections_v2: { instructions: [{ type: 'TimelineAddEntries', entries }] } } });
  s.ingest({ op: 'TweetDetail', vars: { focalTweetId: focal.rest_id }, body: body([F.tweetEntry(focal, '9'), F.conversation([r1], '1')]) });
  eq(s.get('conv:' + focal.rest_id), undefined); // no column, no source
  s.declare({ key: 'conv:' + focal.rest_id, kind: 'conversation', title: 'Conversation' });
  eq(s.get('conv:' + focal.rest_id).sorted.length, 2);
});

test('a block’s time is its post’s (or repost’s) Snowflake, or a notification’s sortIndex', () => {
  const s = createStore();
  const p = F.tweet({ at: 42 });
  s.ingest(homeMsg([F.tweetEntry(p, '5')]));
  const b = s.get('home').sorted[0];
  eq(s.timeOf('home', b), globalThis.Sweeter.util.snowflakeMs(p.rest_id));
});

test('a post answer from the recorder (CreateTweet) passes through the store harmlessly', () => {
  const s = globalThis.Sweeter.createStore();
  s.ingest({ op: 'CreateTweet', vars: {}, body: { status: 200, id: '2104599248595714999', error: null } });
  s.ingest({ op: 'CreateNoteTweet', vars: {}, body: { status: 403, id: null, error: { code: 226, message: 'automated' } } });
  ok(true);
});

test('a quiet poll (cursors only) updates the clock but emits nothing; new posts emit', () => {
  const F = require('./fixtures');
  const s = globalThis.Sweeter.createStore();
  const seen = [];
  s.subscribe((k) => seen.push(k));
  s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: F.home([F.tweetEntry(F.tweet({ text: 'one' }), '5')]) });
  eq(seen.length, 1, 'first load emits');
  const key = seen[0];
  const before = s.get(key).updated;
  s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: F.home([F.cursor('Top', 'c1', '9')]) });
  eq(seen.length, 1, 'a poll with nothing new does not emit');
  ok(s.get(key).updated >= before, 'the stale clock still moves');
  s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: F.home([F.tweetEntry(F.tweet({ text: 'two' }), '6')]) });
  eq(seen.length, 2, 'a new post emits');
});

test('a refused refresh is remembered for the stale clock and changes nothing else', () => {
  const F = require('./fixtures');
  const s = globalThis.Sweeter.createStore();
  const seen = [];
  s.subscribe((k) => seen.push(k));
  s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: F.home([F.tweetEntry(F.tweet({ text: 'one' }), '5')]) });
  const key = seen[0];
  const good = s.get(key).updated;
  s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: { __status: 429 } });
  eq(s.get(key).lastError.status, 429);
  eq(s.get(key).updated, good, 'the last good refresh time stays');
  eq(s.get(key).sorted.length, 1, 'posts stay');
  eq(seen.length, 1, 'no redraw');
  s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: F.home([F.cursor('Top', 'c2', '9')]) });
  eq(s.get(key).lastError, null, 'a good refresh clears it');
});

test('a refused column write never reaches the deck model', () => {
  const s = globalThis.Sweeter.createStore();
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: { data: { viewer_v2: { accountsync_client_config: { active_deck_id: '900' }, decks: [{ rest_id: '900', config: { title: 'Main' }, deck_columns_v2: [{ rest_id: '1', pathname: '/home' }] }] } } } });
  s.ingest({ op: 'UpdateColumn', vars: { columnId: '1', pathname: '/notifications' }, body: { __status: 403 } });
  eq(s.decks.column('1').pathname, '/home');
});
