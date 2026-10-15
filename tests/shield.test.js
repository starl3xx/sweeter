// The reply shield reads two facts about each author: when the account was
// made (core.created_at in timelines, legacy.created_at in older shapes) and
// whether it keeps X's default picture. Accounts here are made up.
const N = globalThis.Sweeter.normalize;
const F = require('./fixtures');

test('shield: an author’s account date and default picture', () => {
  const u = N.user(F.user('oldhand'));
  eq([u.createdMs, u.defaultAvatar], [Date.UTC(2018, 0, 1), false]);
  const fresh = N.user(F.user('newbie', 'New', { core: { created_at: 'Wed Oct 14 09:30:00 +0000 2026', name: 'New', screen_name: 'newbie' }, avatar: { image_url: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' } }));
  eq([fresh.createdMs, fresh.defaultAvatar], [Date.UTC(2026, 9, 14, 9, 30), true]);
  const legacy = N.user({ __typename: 'User', rest_id: '9', legacy: { screen_name: 'legacy', created_at: 'Tue Mar 21 20:50:14 +0000 2006', default_profile_image: true } });
  eq([legacy.createdMs, legacy.defaultAvatar], [Date.UTC(2006, 2, 21, 20, 50, 14), true]);
  eq(N.user(F.user('nodate', 'No date', { core: { name: 'No date', screen_name: 'nodate' } })).createdMs, null);
});
