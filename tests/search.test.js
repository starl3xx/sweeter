// The search form: X's operators as fields, and back.
const { searchParse, searchBuild, SEARCH_FIELDS } = globalThis.Sweeter.text;
const F = (o) => Object.assign({}, SEARCH_FIELDS, o);

test('search form: fields make the query X reads', () => {
  eq(
    searchBuild(F({ all: 'mac app', exact: 'release notes', any: 'swift, swiftui', none: 'ios -android', tags: '#wwdc', from: '@starl3xx sweeterapp', replies: 'none', reposts: 'none', media: 'images', minLikes: '10', since: '2026-10-01', lang: 'EN' })),
    'mac app "release notes" (swift OR swiftui) -ios -android #wwdc (from:starl3xx OR from:sweeterapp) -filter:replies -filter:nativeretweets filter:images min_faves:10 since:2026-10-01 lang:en',
  );
  eq(searchBuild(F({ site: 'https://sixcolors.com/', links: 'only', verified: true, follows: true, minReplies: '0', until: 'soon' })), 'url:sixcolors.com filter:links filter:blue_verified filter:follows');
  eq(searchBuild(F({})), '');
});

test('search form: a query fills the fields and keeps the rest as typed', () => {
  const f = searchParse('mac "release notes" (swift OR swiftui) -ios (from:a OR from:b) to:c @d #e url:x.org filter:replies -filter:quote filter:videos filter:blue_verified min_retweets:5 until:2026-10-14 lang:ja near:tokyo list:123');
  eq([f.all, f.exact, f.any, f.none, f.from, f.to, f.mention, f.tags, f.site], ['mac', 'release notes', 'swift swiftui', 'ios', 'a b', 'c', 'd', 'e', 'x.org']);
  eq([f.replies, f.quotes, f.media, f.verified, f.minReposts, f.until, f.lang], ['only', 'none', 'videos', true, '5', '2026-10-14', 'ja']);
  eq(f.rest, 'near:tokyo list:123');
});

test('search form: a bare OR keeps its chain whole, and fields round-trip', () => {
  const f = searchParse('cats OR dogs -filter:replies');
  eq([f.all, f.rest, f.replies], ['', 'cats OR dogs', 'none']);
  eq(searchBuild(f), 'cats OR dogs -filter:replies');
  // Operators in a chain stay in it: a form edit can't split the choice.
  const g = searchParse('sweeter from:a OR from:b OR to:c');
  eq([g.all, g.from, g.to, g.rest], ['sweeter', '', '', 'from:a OR from:b OR to:c']);
  eq(searchBuild(Object.assign(g, { minLikes: '5' })), 'sweeter from:a OR from:b OR to:c min_faves:5');
  eq(searchParse('OR cats').rest, 'OR');
  const q = 'sweeter "mac app" (a OR b) -x (from:c OR from:d) filter:links min_faves:3 lang:en';
  eq(searchBuild(searchParse(q)), q);
});
