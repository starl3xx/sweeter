const F = require('./fixtures');
const N = globalThis.Sweeter.normalize;
const createStore = globalThis.Sweeter.createStore;

// The UserByScreenName shape verified live on 2026-09-28 (no `legacy`).
function profileBody(extra) {
  return {
    data: {
      user: {
        result: Object.assign(
          {
            __typename: 'User',
            rest_id: '1000000000000000042',
            core: { created_at: 'Mon Mar 04 12:00:00 +0000 2019', name: 'Quiet Finch', screen_name: 'quietfiNch' },
            avatar: { image_url: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg' },
            banner: { image_url: 'https://pbs.twimg.com/profile_banners/1000000000000000042/1700000000' },
            location: { location: 'Portland' },
            website: { url: '' },
            profile_bio: {
              description: 'Making things. Studio: https://t.co/Ab12Cd34Ef',
              entities: { description: { urls: [{ display_url: 'quietfinch.example', expanded_url: 'http://quietfinch.example', indices: [23, 46], url: 'https://t.co/Ab12Cd34Ef' }] } },
            },
            relationship_counts: { followers: 2286, following: 1435 },
            relationship_perspectives: { following: true, followed_by: true, blocking: false, muting: false },
            tweet_counts: { tweets: 1876, media_tweets: 100 },
            notifications_settings: { notifications_enabled: false },
            privacy: { protected: false },
            is_blue_verified: true,
          },
          extra || {},
        ),
      },
    },
  };
}

test('a profile reads the new UserByScreenName shape', () => {
  const p = N.profile(profileBody());
  eq([p.handle, p.name, p.followers, p.followingCount, p.posts, p.location], ['quietfiNch', 'Quiet Finch', 2286, 1435, 1876, 'Portland']);
  eq([p.following, p.followedBy, p.muting, p.blocking], [true, true, false, false]);
  eq(p.banner, 'https://pbs.twimg.com/profile_banners/1000000000000000042/1700000000/1500x500');
  ok(p.bio.includes('quietfinch.example'), 'bio link shows its display address');
  eq(new Date(p.joinedMs).getUTCFullYear(), 2019);
  // A t.co website shows its real address when X sends the entity.
  const w = N.profile(profileBody({ website: { url: 'https://t.co/abc' }, profile_bio: { description: '', entities: { url: { urls: [{ url: 'https://t.co/abc', expanded_url: 'https://studio.example', display_url: 'studio.example' }] } } } }));
  eq([w.website, w.websiteLabel], ['https://studio.example', 'studio.example']);
  eq(N.profile(profileBody({ website: { url: 'https://t.co/xyz' } })).websiteLabel, 'Website');
});

test('a watched person’s timeline goes to the profile, not a column', () => {
  const s = createStore();
  const seen = [];
  s.subscribe((k) => seen.push(k));
  s.watch('QuietfiNch', null); // only the handle is known yet
  s.ingest({ op: 'UserByScreenName', vars: { screen_name: 'quietfinch' }, body: profileBody() });
  eq(s.profile('QUIETFINCH').id, '1000000000000000042', 'handles match in any case');
  const posts = F.list([F.tweetEntry(F.tweet({ text: 'one' }), '20'), F.tweetEntry(F.tweet({ text: 'two' }), '30')]);
  s.ingest({ op: 'UserOriginalsTimeline', vars: { userId: '1000000000000000042' }, body: posts });
  eq(s.all().length, 0, 'no column was made');
  const t = s.timeline('1000000000000000042', ['UserOriginalsTimeline', 'UserTweets']);
  eq(t.sorted.map((b) => b.sortIndex), ['30', '20']);
  eq(seen, ['profile:quietfinch', 'timeline:1000000000000000042']);
  s.unwatch('quietfiNch', '1000000000000000042');
  s.ingest({ op: 'UserTweets', vars: { userId: '1000000000000000042' }, body: posts });
  eq(s.all().length, 1, 'unwatched: a real profile column again');
});
