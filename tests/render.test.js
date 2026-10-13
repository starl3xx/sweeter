// Post HTML for the fields X sends besides the text (render.js runs without a DOM).
const path = require('path');
for (const f of ['symbols', 'icons', 'render']) require(path.join(__dirname, '../extension/src/ui', f + '.js'));
const R = globalThis.Sweeter.render;
const N = globalThis.Sweeter.normalize;
const F = require('./fixtures');

const ctx = (extra) => Object.assign({ settings: { badges: true, counts: true, media: 'full', cards: 'medium', actions: 'always', dateFormat: 'relative', fontSize: 14 }, now: Date.now() }, extra || {});

test('who can reply reads as X Pro words it', () => {
  eq(R.replyLimitText({ policy: 'community', owner: 'nadiabuilds' }), 'Accounts @nadiabuilds follows or mentioned can reply');
  eq(R.replyLimitText({ policy: 'invited', owner: 'nadiabuilds' }), 'Accounts @nadiabuilds mentioned can reply');
  eq(R.replyLimitText({ policy: 'other', owner: 'nadiabuilds' }), 'Only some accounts can reply.');
});

test('a refused reply dims the button and says who can reply; the opened post says it too', () => {
  const t = F.tweet({ text: 'limited' });
  t.legacy.conversation_control = { policy: 'Verified', conversation_owner_results: { result: { __typename: 'User', core: { screen_name: 'nadiabuilds' } } } };
  const w = { __typename: 'TweetWithVisibilityResults', tweet: t, limitedActionResults: { limited_actions: [{ action: 'Reply' }] } };
  const p = N.post(w, 0);
  const html = R.post(p, ctx());
  ok(html.includes('data-act="reply" class="off" aria-disabled="true" title="Who can reply? Verified accounts or accounts mentioned by @nadiabuilds can reply"'), 'dimmed reply');
  ok(!html.includes('class="rlim'), 'timeline posts have no line');
  ok(R.post(p, ctx({ focal: true })).includes('<b>Who can reply?</b> Verified accounts'), 'opened post');
});

test('edited, old-version, community note and square avatar markup', () => {
  const t = F.tweet({ text: 'v1', user: F.user('acme', 'Acme', { profile_image_shape: 'Square' }) });
  t.edit_control = { edit_control_initial: { edit_tweet_ids: [t.rest_id, '2104599248595719999'] } };
  t.birdwatch_pivot = { title: 'Readers added context', subtitle: { text: 'Context.', entities: [] }, destinationUrl: 'https://x.com/i/birdwatch/n/1', visualStyle: 'Tentative' };
  const html = R.post(N.post(t, 0), ctx());
  ok(html.includes('<img class="av sq"'), 'square avatar');
  ok(html.includes('class="edt"'), 'pencil');
  ok(html.includes('href="https://x.com/i/status/2104599248595719999"'), 'latest version link');
  ok(html.includes('<div class="bw tentative">') && html.includes('<div class="bw-tx">Context.</div>'), 'note');
});

test('a person row: name, bio, followers, and how they relate to you', () => {
  const u = N.profileOf(F.user('acme', 'Acme', { profile_bio: { description: 'Maps.' }, relationship_counts: { followers: 12345 }, relationship_perspectives: { followed_by: true, following: true } }));
  const html = R.block({ kind: 'person', person: u, key: 'user-1', sortIndex: '1' }, ctx());
  ok(html.startsWith('<article class="cell person" data-person="acme">'), 'row');
  ok(html.includes('<div class="tx">Maps.</div>'), 'bio');
  ok(html.includes('<b>12K</b> followers · Follows you · You follow them') || html.includes('<b>12.3K</b> followers · Follows you · You follow them'), 'stats');
});
