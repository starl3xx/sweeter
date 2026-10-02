const M = globalThis.Sweeter.mutes;
const N = globalThis.Sweeter.normalize;
const F = require('./fixtures');

const now = 1_790_000_000_000;
const post = (o) => N.post(F.tweet(o), 0);

test('parse recognizes every rule kind', () => {
  eq(M.parse('airdrop').kind, 'keyword');
  eq(M.parse('/^gm\\b/i').kind, 'regex');
  eq(M.parse('@SamOrtiz').value, 'samortiz');
  eq(M.parse('#WWDC').value, 'wwdc');
  eq(M.parse('via:Autoposter').kind, 'client');
  eq(M.parse('/(/'), null);
  eq(M.parse('   '), null);
});

test('durations set an expiry; forever does not', () => {
  eq(M.parse('x', 'day', now).expires, now + 864e5);
  eq(M.parse('x', 'forever', now).expires, null);
});

test('keywords match whole words, case-insensitively', () => {
  const m = M.compile([M.parse('art')], now);
  ok(m(post({ text: 'New ART drop' })));
  ok(!m(post({ text: 'Start here' })));
});

test('keywords with symbols match as substrings', () => {
  const m = M.compile([M.parse('$WORD')], now);
  ok(m(post({ text: 'buying $WORD today' })));
});

test('regex, user, hashtag and client rules', () => {
  const m = M.compile([M.parse('/^gm\\b/i'), M.parse('@samortiz'), M.parse('#wwdc'), M.parse('via:Autoposter')], now);
  ok(m(post({ text: 'gm frens' })));
  ok(!m(post({ text: 'agm' })));
  ok(m(post({ user: F.user('SamOrtiz', 'Sam') })));
  ok(m(post({ text: '#WWDC soon', entities: { hashtags: [{ text: 'WWDC', indices: [0, 5] }] } })));
  ok(m(post({ source: 'Autoposter' })));
  ok(!m(post({ text: 'fine', source: 'X for iPhone' })));
});

test('muting a user also hides their reposts', () => {
  const m = M.compile([M.parse('@priya')], now);
  ok(m(post({ user: F.user('priya', 'Priya'), retweetOf: F.tweet({ text: 'x', user: F.user('other') }) })));
});

test('expired rules stop matching', () => {
  const r = M.parse('airdrop', 'day', now);
  ok(M.compile([r], now + 1000)(post({ text: 'airdrop' })));
  ok(!M.compile([r], now + 2 * 864e5)(post({ text: 'airdrop' })));
});

test('labels round-trip', () => {
  eq(['airdrop', '/^gm\\b/i', '@samortiz', '#wwdc', 'via:Autoposter'].map((t) => M.label(M.parse(t))), ['airdrop', '/^gm\\b/i', '@samortiz', '#wwdc', 'via:Autoposter']);
});

// A normalized notification, as the store holds it.
const note = (icon, text, users, target) => N.notification(F.notificationEntry(icon, text, users, '1790000000500', target).content.itemContent);

test('compileNote hides a notification whose post is muted', () => {
  const theo = F.user('theo', 'Theo');
  const hide = M.compileNote([M.parse('airdrop'), M.parse('#wwdc')], now);
  ok(hide(note('heart_icon', 'Theo liked your post', [theo], F.tweet({ text: 'free airdrop here' }))));
  ok(hide(note('reply_icon', 'Theo replied', [theo], F.tweet({ text: '#WWDC soon', entities: { hashtags: [{ text: 'WWDC', indices: [0, 5] }] } }))));
  ok(!hide(note('heart_icon', 'Theo liked your post', [theo], F.tweet({ text: 'a fine post' }))));
  // Only the post and the people count, not X’s own message text.
  ok(!hide(note('heart_icon', 'Theo liked your airdrop post', [theo], F.tweet({ text: 'a fine post' }))));
  // A deleted post is never muted by its text.
  ok(!hide(note('heart_icon', 'Theo liked your post', [theo], { __typename: 'TweetTombstone' })));
});

test('compileNote hides a notification from a muted user', () => {
  const priya = F.user('Priya', 'Priya');
  const theo = F.user('theo', 'Theo');
  const hide = M.compileNote([M.parse('@priya')], now);
  ok(hide(note('person_icon', 'Priya followed you', [priya])));
  // One muted user among several hides the whole row.
  ok(hide(note('heart_icon', 'Theo and Priya liked your post', [theo, priya], F.tweet({ text: 'mine', user: theo }))));
  // A reply from a muted user: the post’s author matches.
  ok(hide(note('reply_icon', 'New reply', [], F.tweet({ text: 'hey', user: priya }))));
  ok(!hide(note('person_icon', 'Theo followed you', [theo])));
  ok(!hide(null));
  ok(!M.compileNote([], now)(note('person_icon', 'Theo followed you', [theo])));
});

test('compileNote ignores expired rules', () => {
  const priya = F.user('priya', 'Priya');
  const r = M.parse('@priya', 'day', now);
  const n = note('person_icon', 'Priya followed you', [priya]);
  ok(M.compileNote([r], now + 1000)(n));
  ok(!M.compileNote([r], now + 2 * 864e5)(n));
  const kw = M.parse('airdrop', 'day', now);
  const k = note('heart_icon', 'Priya liked your post', [priya], F.tweet({ text: 'airdrop' }));
  ok(!M.compileNote([kw], now + 2 * 864e5)(k));
});
