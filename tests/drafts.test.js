// X's drafts: FetchDraftTweets as X Pro's Drafts column receives it
// (shape read live 2026-10-14; the text and names here are made up), and
// the saves, edits and deletes X Pro sends from it.
const N = globalThis.Sweeter.normalize;
const createStore = globalThis.Sweeter.createStore;

function draft(id, req, extra) {
  return Object.assign({ rest_id: id, tweet_create_request: Object.assign({ type: 'PostTweetRequest', status: '', media_ids: [], thread_tweets: [] }, req) }, extra || {});
}
function fetchMsg(list) {
  return { op: 'FetchDraftTweets', vars: { ascending: false }, body: { data: { viewer: { draft_list: { response_data: list } } } } };
}
const replyDraft = draft(
  '2012388810630266880',
  { in_reply_to_status_id: '2012388285365051812', auto_populate_reply_metadata: true, exclude_reply_user_ids: [], media_ids: ['2012388803579691008'] },
  {
    media_entities: [{ media_key: '3_2012388803579691008', alt_text: 'A cat', media_info: { __typename: 'ApiImage', original_img_url: 'https://pbs.twimg.com/media/abc.jpg', original_img_width: 1280, original_img_height: 1280 } }],
    replied_tweet_results: { result: { __typename: 'Tweet', rest_id: '2012388285365051812', core: { user_results: { result: { __typename: 'User', rest_id: '1', core: { screen_name: 'sweeterapp', name: 'Sweeter' } } } } } },
  },
);
const textDraft = draft('2110502362939023360', {
  status: 'Hello bold world',
  richtext_options: { richtext_tags: [{ from_index: 6, to_index: 10, richtext_types: ['Bold'] }, { from_index: 11, to_index: 16, richtext_types: ['Italic', 'Bold'] }] },
  thread_tweets: [{ status: 'Second post' }],
});

test('drafts: the list as X keeps it, newest first, with when each was saved', () => {
  const list = N.drafts(fetchMsg([textDraft, replyDraft]).body);
  eq(
    list.map((d) => [d.id, d.text, d.reply, d.replyTo, d.quote, d.more]),
    [
      ['2110502362939023360', 'Hello bold world', null, null, null, ['Second post']],
      ['2012388810630266880', '', '2012388285365051812', 'sweeterapp', null, []],
    ],
  );
  eq(list[0].styles, { bold: [[6, 10], [11, 16]], italic: [[11, 16]] });
  eq(list[1].media, [{ type: 'photo', url: 'https://pbs.twimg.com/media/abc.jpg', alt: 'A cat' }]);
  eq(list[0].at, globalThis.Sweeter.util.snowflakeMs('2110502362939023360'));
});

test('drafts: not a drafts list, an image off X, or a request of another type', () => {
  eq(N.drafts({ data: {} }), null);
  const odd = draft('5', {}, { media_entities: [{ media_info: { __typename: 'ApiImage', original_img_url: 'https://example.com/x.jpg' } }, { media_info: { __typename: 'ApiVideo' } }] });
  eq(N.drafts(fetchMsg([odd, { rest_id: '6', tweet_create_request: { type: 'Other' } }]).body).map((d) => d.media.map((m) => m.type)), [['video']]);
});

test('drafts: the store keeps the list, then the reader’s edits and deletes', () => {
  const s = createStore();
  let heard = 0;
  s.subscribe((k) => k === 'xdrafts' && heard++);
  eq(s.xDrafts(), null);
  s.ingest(fetchMsg([textDraft, replyDraft]));
  eq(s.xDrafts().length, 2);
  s.ingest({ op: 'EditDraftTweet', vars: { draft_tweet_id: '2012388810630266880', post_tweet_request: { status: 'Now with words', in_reply_to_status_id: '2012388285365051812', media_ids: ['2012388803579691008'] } }, body: { data: { drafttweet_put: 'Done' } } });
  const edited = s.xDrafts()[1];
  eq([edited.text, edited.replyTo, edited.media.length, edited.media[0].alt], ['Now with words', 'sweeterapp', 1, 'A cat']);
  s.ingest({ op: 'DeleteDraftTweets', vars: { draft_tweet_ids: ['2110502362939023360'] }, body: { data: { draft_tweets_batch_delete: 'Done' } } });
  eq(s.xDrafts().map((d) => d.id), ['2012388810630266880']);
  s.ingest({ op: 'CreateDraftTweet', vars: { post_tweet_request: { status: 'x' } }, body: { data: { tweet: { rest_id: '777' } } } });
  eq(s.xSaved().id, '777');
  // A refused write changes nothing.
  s.ingest({ op: 'DeleteDraftTweet', vars: { draft_tweet_id: '2012388810630266880' }, body: { __status: 403 } });
  eq(s.xDrafts().length, 1);
  eq(heard, 4);
});
