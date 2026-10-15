// Column health: the store measures how often X Pro refreshes a column
// from the gaps between its answers. A page of older posts the reader
// scrolled to (its cursor is the column's Bottom cursor) is not a refresh.
const createStore = globalThis.Sweeter.createStore;
const F = require('./fixtures');

test('health: a column’s refresh rhythm, without the older pages', () => {
  const s = createStore();
  const realNow = Date.now;
  let t = Date.UTC(2026, 9, 15, 12);
  Date.now = () => t;
  try {
    const page = (n) => F.home([F.tweetEntry(F.tweet({ text: 'post ' + n, at: n }), String(1000 + n)), F.cursor('Bottom', 'bottom-' + n, '1'), F.cursor('Top', 'top-' + n, '9999')]);
    s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: page(1) });
    eq(s.cadence('home'), null, 'one answer is no rhythm');
    t += 30000;
    s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: page(2) });
    eq(s.cadence('home'), null, 'one gap is not enough');
    // The reader scrolls down: X Pro asks with the Bottom cursor.
    t += 4000;
    s.ingest({ op: 'HomeLatestTimeline', vars: { cursor: s.get('home').cursors.bottom }, body: page(3) });
    t += 26000;
    s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: page(4) });
    t += 31000;
    s.ingest({ op: 'HomeLatestTimeline', vars: {}, body: page(5) });
    eq(s.cadence('home'), 30000);
    eq(s.get('home').updated, t);
  } finally {
    Date.now = realNow;
  }
});
