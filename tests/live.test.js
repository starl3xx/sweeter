// A live video on X: the card names the stream's key, which marks it for
// the Mac app's live video window (shape read on x.com, 2026-10-15; the
// keys here are made up).
const path = require('path');
for (const f of ['symbols', 'icons', 'render']) require(path.join(__dirname, '../extension/src/ui', f + '.js'));
const N = globalThis.Sweeter.normalize;
const R = globalThis.Sweeter.render;
const F = require('./fixtures');

const s = (key, v) => ({ key, value: { type: 'STRING', string_value: v } });
const live = (state, key) => N.post(F.tweet({ text: 'live', card: { name: '745291183405076480:broadcast', url: 'https://t.co/b', values: [s('broadcast_url', 'https://x.com/i/broadcasts/1abc'), s('broadcast_state', state), s('broadcast_media_key', key)] } }), 0);

test('live: the card names its stream key, and a live one says so in its link', () => {
  const p = live('RUNNING', '28_2110000000000000000');
  eq([p.card.live, p.card.mediaKey], [true, '28_2110000000000000000']);
  ok(R.post(p, { settings: { cards: 'large', media: 'full' }, now: Date.now() }).includes('data-bkey="28_2110000000000000000"'));
  ok(!R.post(live('ENDED', '28_1'), { settings: { cards: 'large', media: 'full' }, now: Date.now() }).includes('data-bkey'), 'an ended video links to x.com');
  eq(live('RUNNING', '28_1 bad"').card.mediaKey, '');
});

