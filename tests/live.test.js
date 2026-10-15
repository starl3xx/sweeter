// A live video on X: the card names the stream's key, and the store keeps
// the HLS address X Pro got when it played the video (shape read on x.com,
// 2026-10-15; keys and addresses here are made up).
const path = require('path');
for (const f of ['symbols', 'icons', 'render']) require(path.join(__dirname, '../extension/src/ui', f + '.js'));
const N = globalThis.Sweeter.normalize;
const R = globalThis.Sweeter.render;
const createStore = globalThis.Sweeter.createStore;
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

test('live: the store keeps the stream X Pro asked for, only from X’s video servers', () => {
  const st = createStore();
  let heard = 0;
  st.subscribe((k) => k === 'stream:28_7' && heard++);
  eq(st.stream('28_7'), null);
  const body = (location) => ({ source: { location, status: 'LIVE_PUBLIC', streamType: 'HLS' } });
  st.ingest({ op: 'LiveVideoStreamStatus', vars: { mediaKey: '28_7' }, body: body('https://example.com/a.m3u8') });
  eq(st.stream('28_7'), null, 'not X’s video servers');
  st.ingest({ op: 'LiveVideoStreamStatus', vars: { mediaKey: '28_7' }, body: { __status: 403 } });
  eq(st.stream('28_7'), null, 'a refusal');
  st.ingest({ op: 'LiveVideoStreamStatus', vars: { mediaKey: '28_7' }, body: body('https://prod-fastly-us-east-1.video.pscp.tv/Transcoding/v1/hls/x/master_dynamic_delta.m3u8?type=live') });
  eq([st.stream('28_7').url.endsWith('?type=live'), st.stream('28_7').status, heard], [true, 'LIVE_PUBLIC', 1]);
});
