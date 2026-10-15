// Scheduled posts: FetchScheduledTweets as X Pro's Scheduled column asks
// for it (its API module 957178: viewer.scheduled_tweet_list, each a
// draft's shape plus scheduling_info; the text and names here are made
// up), and the edits and deletes X Pro sends from it.
const N = globalThis.Sweeter.normalize;
const createStore = globalThis.Sweeter.createStore;

const SOON = Date.UTC(2026, 9, 16, 1, 5);
const LATER = Date.UTC(2026, 9, 20, 16, 0);
function item(id, req, info, extra) {
  return Object.assign(
    { rest_id: id, scheduling_info: info, tweet_create_request: Object.assign({ type: 'PostTweetRequest', status: '', media_ids: [], thread_tweets: [] }, req) },
    extra || {},
  );
}
function fetchMsg(list) {
  return { op: 'FetchScheduledTweets', vars: { ascending: true }, body: { data: { viewer: { scheduled_tweet_list: list } } } };
}
const soon = item('1978000000000000001', { status: 'Out Thursday', richtext_options: { richtext_tags: [{ from_index: 0, to_index: 3, richtext_types: ['Bold'] }] } }, { execute_at: SOON, state: 'Scheduled' });
const later = item(
  '1978000000000000002',
  { status: 'Photos from the trip', media_ids: ['77'], thread_tweets: [{ status: 'More soon' }] },
  { execute_at: LATER, state: 'Failed' },
  { media_entities: [{ media_key: '3_77', alt_text: 'A lake', media_info: { __typename: 'ApiImage', original_img_url: 'https://pbs.twimg.com/media/lake.jpg' } }] },
);

test('scheduled: the list as X keeps it, with when each sends and which failed', () => {
  const list = N.scheduled(fetchMsg([soon, later]).body);
  eq(
    list.map((d) => [d.id, d.text, d.when, d.failed, d.more]),
    [
      ['1978000000000000001', 'Out Thursday', SOON, false, []],
      ['1978000000000000002', 'Photos from the trip', LATER, true, ['More soon']],
    ],
  );
  eq(list[0].styles, { bold: [[0, 3]], italic: [] });
  eq(list[1].media, [{ type: 'photo', url: 'https://pbs.twimg.com/media/lake.jpg', alt: 'A lake' }]);
});

test('scheduled: not a scheduled list, a time in seconds, or no time', () => {
  eq(N.scheduled({ data: { viewer: { draft_list: {} } } }), null);
  eq(N.scheduled(fetchMsg([]).body), []);
  const odd = N.scheduled(fetchMsg([item('5', {}, { execute_at: SOON / 1000 }), item('6', {}, null), { rest_id: '7', tweet_create_request: { type: 'Other' } }]).body);
  eq(odd.map((d) => [d.id, d.when]), [['5', SOON], ['6', null]]);
});

test('scheduled: the store keeps the list, then the reader’s edits and deletes', () => {
  const s = createStore();
  let heard = 0;
  s.subscribe((k) => k === 'xscheduled' && heard++);
  eq(s.xScheduled(), null);
  // Nothing to change before X Pro has listed them.
  s.ingest({ op: 'DeleteScheduledTweet', vars: { scheduled_tweet_id: '1978000000000000001' }, body: { data: { scheduledtweet_delete: 'Done' } } });
  eq(s.xScheduled(), null);
  s.ingest(fetchMsg([soon, later]));
  eq(s.xScheduled().length, 2);
  // An edit to a later time (X's writes take seconds) moves it down the list.
  s.ingest({
    op: 'EditScheduledTweet',
    vars: { scheduled_tweet_id: '1978000000000000001', execute_at: (LATER + 3600000) / 1000, post_tweet_request: { status: 'Out Friday', media_ids: [] } },
    body: { data: { scheduledtweet_put: 'Done' } },
  });
  eq(s.xScheduled().map((d) => [d.id, d.text, d.when]), [['1978000000000000002', 'Photos from the trip', LATER], ['1978000000000000001', 'Out Friday', LATER + 3600000]]);
  // A refused change, and one X answers with errors, change nothing.
  s.ingest({ op: 'DeleteScheduledTweet', vars: { scheduled_tweet_id: '1978000000000000002' }, body: { __status: 403 } });
  s.ingest({ op: 'DeleteScheduledTweet', vars: { scheduled_tweet_id: '1978000000000000002' }, body: { errors: [{ message: 'No' }], data: null } });
  eq(s.xScheduled().length, 2);
  s.ingest({ op: 'DeleteScheduledTweet', vars: { scheduled_tweet_id: '1978000000000000002' }, body: { data: { scheduledtweet_delete: 'Done' } } });
  eq(s.xScheduled().map((d) => d.id), ['1978000000000000001']);
  eq(heard, 3);
});
