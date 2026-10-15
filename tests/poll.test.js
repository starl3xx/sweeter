// Polls: X's card binding values as X Pro reads them (module 153256):
// counts_are_final is a boolean_value, selected_choice the reader's vote
// from 1. Sweeter offers the choices until the reader votes or the poll
// ends, never on their own post, and then shows results with the vote.
const path = require('path');
for (const f of ['symbols', 'icons', 'render']) require(path.join(__dirname, '../extension/src/ui', f + '.js'));
const N = globalThis.Sweeter.normalize;
const R = globalThis.Sweeter.render;
const F = require('./fixtures');

const NOW = Date.UTC(2026, 9, 14, 12);
const str = (key, v) => ({ key, value: { type: 'STRING', string_value: v } });
function pollPost(extra, handle) {
  const values = [str('choice1_label', 'Yes'), str('choice1_count', '30'), str('choice2_label', 'No'), str('choice2_count', '10'), str('end_datetime_utc', new Date(NOW + 5 * 36e5).toISOString())].concat(extra || []);
  return N.post(F.tweet({ text: 'Ship it?', handle, card: { name: 'poll2choice_text_only', url: 'https://t.co/p', values } }), 0);
}
const ctx = { settings: { cards: 'large' }, now: NOW, viewer: { handle: 'me' } };

test('poll: the reader’s vote and final counts', () => {
  eq(pollPost().card, { kind: 'poll', choices: [{ label: 'Yes', count: 30 }, { label: 'No', count: 10 }], ends: new Date(NOW + 5 * 36e5).toISOString(), final: false, selected: null });
  const voted = pollPost([str('selected_choice', '2'), { key: 'counts_are_final', value: { type: 'BOOLEAN', boolean_value: true } }]).card;
  eq([voted.selected, voted.final], [2, true]);
  eq(pollPost([str('selected_choice', '7')]).card.selected, null);
});

test('poll: choices to vote on, until voted, ended, or the reader’s own', () => {
  const open = R.post(pollPost(), ctx);
  ok(open.includes('data-act="vote" data-i="1">Yes</button>') && open.includes('data-i="2">No</button>'));
  ok(open.includes('40 votes · 5 hours left'));
  const p = pollPost();
  p.card.selected = 1;
  const voted = R.post(p, ctx);
  ok(!voted.includes('data-act="vote"') && voted.includes('pmine') && voted.includes('75%'));
  ok(!R.post(pollPost(), Object.assign({}, ctx, { now: NOW + 6 * 36e5 })).includes('data-act="vote"'), 'ended');
  ok(R.post(pollPost(), Object.assign({}, ctx, { now: NOW + 6 * 36e5 })).includes('Final results'));
  const mine = pollPost();
  mine.author.handle = 'Me';
  ok(!R.post(mine, ctx).includes('data-act="vote"'), 'own post');
});
