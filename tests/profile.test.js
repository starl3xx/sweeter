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

test('a profile tab shows the timeline X Pro loaded last, under its new names too', () => {
  const s = createStore();
  s.watch('quietfinch', '1000000000000000042');
  const vars = { userId: '1000000000000000042' };
  const one = (text, sort) => F.list([F.tweetEntry(F.tweet({ text }), sort)]);
  // X Pro's Replies tab now loads UserRepliesTimeline (seen 2026-10-14).
  s.ingest({ op: 'UserRepliesTimeline', vars, body: one('a reply', '40') });
  eq(s.all().length, 0, 'still no column');
  eq(s.timeline('1000000000000000042', ['UserRepliesTimeline', 'UserTweetsAndReplies']).sorted.length, 1);
  // Its media tab is Photos or Videos: each its own timeline.
  s.ingest({ op: 'UserVideoTimeline', vars, body: one('a video', '50') });
  s.ingest({ op: 'UserPhotoTimeline', vars, body: one('a photo', '60') });
  eq(s.timeline('1000000000000000042', ['UserPhotoTimeline', 'UserMedia']).sorted[0].sortIndex, '60');
  eq(s.timeline('1000000000000000042', ['UserVideoTimeline']).sorted[0].sortIndex, '50');
  // Of a tab's operations, the newest wins whatever their order.
  s.ingest({ op: 'UserMedia', vars, body: one('old shape', '70') });
  eq(s.timeline('1000000000000000042', ['UserPhotoTimeline', 'UserMedia']).sorted[0].sortIndex, '70');
});
