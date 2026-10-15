// Cards Sweeter used to drop: a video page (player), a live video on X
// (<n>:broadcast), and a Space (<n>:audiospace, its details from
// AudioSpaceById). Shapes as X sent them (seen 2026-10-14); the titles,
// names and ids here are made up.
const path = require('path');
for (const f of ['symbols', 'icons', 'render']) require(path.join(__dirname, '../extension/src/ui', f + '.js'));
const N = globalThis.Sweeter.normalize;
const R = globalThis.Sweeter.render;
const createStore = globalThis.Sweeter.createStore;
const F = require('./fixtures');

const s = (key, v) => ({ key, value: { type: 'STRING', string_value: v } });
const im = (key, url) => ({ key, value: { type: 'IMAGE', image_value: { url, width: 800, height: 419 } } });
const cardOf = (name, values) => N.post(F.tweet({ text: 'look https://t.co/c', entities: { urls: [{ url: 'https://t.co/c', expanded_url: 'https://www.youtube.com/watch?v=abc', display_url: 'youtube.com/watch?v=abc', indices: [5, 19] }] }, card: { name, url: 'https://t.co/c', values } }), 0).card;
const ctx = { settings: { cards: 'large', media: 'full' }, now: Date.UTC(2026, 9, 14, 12) };

test('cards: a video page shows its still with a play mark', () => {
  const c = cardOf('player', [s('title', 'A talk'), s('domain', 'youtube.com'), s('card_url', 'https://t.co/c'), im('player_image_large', 'https://pbs.twimg.com/card_img/1/a')]);
  eq(c, { kind: 'large', title: 'A talk', description: '', domain: 'youtube.com', url: 'https://www.youtube.com/watch?v=abc', image: 'https://pbs.twimg.com/card_img/1/a', play: true });
  ok(R.post(Object.assign(N.post(F.tweet({ text: 'x' }), 0), { card: c }), ctx).includes('class="cpl"'));
});

test('cards: a live video on X, LIVE while it runs', () => {
  const c = cardOf('745291183405076480:broadcast', [s('broadcast_url', 'https://x.com/i/broadcasts/1yAbC'), s('broadcast_title', 'Morning show'), s('broadcast_state', 'RUNNING'), s('broadcaster_display_name', 'Studio'), im('broadcast_thumbnail_large', 'https://pbs.twimg.com/card_img/2/b')]);
  eq([c.kind, c.title, c.domain, c.url, c.image, c.live, c.play], ['large', 'Morning show', 'Studio', 'https://x.com/i/broadcasts/1yAbC', 'https://pbs.twimg.com/card_img/2/b', true, true]);
  const ended = cardOf('745291183405076480:broadcast', [s('broadcast_url', 'https://x.com/i/broadcasts/1yAbC'), s('broadcast_state', 'ENDED')]);
  eq([ended.title, ended.live], ['Live video', false]);
  eq(cardOf('745291183405076480:broadcast', [s('broadcast_url', 'https://example.com/live')]), null);
});

test('cards: a Space, then what AudioSpaceById says about it', () => {
  const c = cardOf('3691233323:audiospace', [s('id', '1AbCdEfGhIjK'), s('card_url', 'https://t.co/c'), s('narrow_cast_space_type', '0')]);
  eq(c, { kind: 'space', id: '1AbCdEfGhIjK', url: 'https://x.com/i/spaces/1AbCdEfGhIjK' });
  // Before X Pro asks: a Space, with no details.
  R.useSpaces(() => null);
  ok(R.post(Object.assign(N.post(F.tweet({ text: 'x' }), 0), { card: c }), ctx).includes('A Space on X'));
  const store = createStore();
  const body = (state, listeners) => ({ data: { audioSpace: { metadata: { rest_id: '1AbCdEfGhIjK', state, title: 'Friday chat', total_live_listeners: listeners, is_space_available_for_replay: true, creator_results: { result: { __typename: 'User', rest_id: '7', core: { screen_name: 'host', name: 'The Host' } } } } } } });
  let heard = 0;
  store.subscribe((k) => k === 'space:1AbCdEfGhIjK' && heard++);
  store.ingest({ op: 'AudioSpaceById', vars: { id: '1AbCdEfGhIjK' }, body: body('Running', 1200) });
  store.ingest({ op: 'AudioSpaceById', vars: { id: '1AbCdEfGhIjK' }, body: body('Running', 1200) });
  eq(heard, 1, 'the same answer again is no news');
  eq(store.space('1AbCdEfGhIjK'), { id: '1AbCdEfGhIjK', state: 'Running', title: 'Friday chat', start: null, listeners: 1200, replay: true, host: { name: 'The Host', handle: 'host' } });
  R.useSpaces((id) => store.space(id));
  const live = R.post(Object.assign(N.post(F.tweet({ text: 'x' }), 0), { card: c }), ctx);
  ok(live.includes('Space · Live · 1.2K listening') && live.includes('Friday chat') && live.includes('Hosted by The Host') && live.includes('card summary space live'));
  store.ingest({ op: 'AudioSpaceById', vars: {}, body: body('Ended', 0) });
  ok(R.post(Object.assign(N.post(F.tweet({ text: 'x' }), 0), { card: c }), ctx).includes('Space · Ended · Replay'));
  R.useSpaces(() => null);
});
