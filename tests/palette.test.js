const P = globalThis.Sweeter.palette;

const ids = (rs) => rs.map((r) => r.cmd.id);
const cmd = (id, title, more) => Object.assign({ id, title, run() {} }, more);

test('palette: exact beats prefix beats word start beats scattered', () => {
  // Listed worst first, so the order cannot come from the input.
  const list = [
    cmd('scattered', 'Pop out stats'),
    cmd('inside', 'Repost'),
    cmd('word', 'New post'),
    cmd('prefix', 'Posts and replies'),
    cmd('exact', 'Post'),
    cmd('none', 'Mute words'),
  ];
  eq(ids(P.rank('post', list, [])), ['exact', 'prefix', 'word', 'inside', 'scattered']);
  // Case and surrounding punctuation do not stop an exact match.
  eq(ids(P.rank('ADD COLUMN', [cmd('pre', 'Add column to deck'), cmd('ex', 'Add Column…')], [])), ['ex', 'pre']);
});

test('palette: hits are title indexes, at word starts when possible', () => {
  eq(P.rank('np', [cmd('a', 'New post')], [])[0].hits, [0, 4]);
  // “col” could take the c and o of “Close”; the word “columns” is better.
  eq(P.rank('col', [cmd('a', 'Close all columns')], [])[0].hits, [10, 11, 12]);
  // Spaces in the query are ignored, so a spaced query still lines up.
  eq(P.rank('new p', [cmd('a', 'New post')], [])[0].hits, [0, 1, 2, 4]);
});

test('palette: keyword matches rank below title matches', () => {
  const list = [cmd('saved', 'Saved posts', { keywords: ['bookmark'] }), cmd('bm', 'Show bookmarks')];
  const rs = P.rank('bookmark', list, []);
  eq(ids(rs), ['bm', 'saved']);
  // A keyword match is kept, without title highlights.
  eq(rs[1].hits, []);
  ok(rs[1].score > 0);
  // The same quality of match counts for less as a keyword.
  eq(ids(P.rank('mute', [cmd('k', 'Silence', { keywords: ['mute'] }), cmd('t', 'Mute words')], [])), ['t', 'k']);
  // But an exact keyword still beats letters scattered through a title.
  eq(ids(P.rank('prefs', [cmd('s', 'Pin reply for sharing'), cmd('k', 'Settings', { keywords: ['prefs', 'preferences'] })], [])), ['k', 's']);
});

test('palette: empty query lists recent first, then the given order', () => {
  const list = [cmd('a', 'Alpha'), cmd('b', 'Bravo'), cmd('c', 'Charlie'), cmd('d', 'Delta')];
  eq(ids(P.rank('', list, ['c', 'a', 'gone'])), ['c', 'a', 'b', 'd']);
  eq(ids(P.rank('   ', list, ['d'])), ['d', 'a', 'b', 'c']);
  eq(ids(P.rank('', list)), ['a', 'b', 'c', 'd']);
  eq(P.rank('', list, [])[0].hits, []);
  // Recent also breaks ties between equal matches.
  const two = [cmd('reply', 'Reply'), cmd('repost', 'Repost')];
  eq(ids(P.rank('rep', two, [])), ['reply', 'repost']);
  eq(ids(P.rank('rep', two, ['repost'])), ['repost', 'reply']);
});

test('palette: diacritics and case are ignored both ways', () => {
  eq(P.rank('resume', [cmd('a', 'Résumé builder')], [])[0].hits, [0, 1, 2, 3, 4, 5]);
  eq(P.rank('CAFÉ', [cmd('a', 'cafe')], []).length, 1);
  // Decomposed accents: hits still point at the base letters.
  eq(P.rank('resume', [cmd('a', 'Résumé')], [])[0].hits, [0, 1, 3, 4, 5, 6]);
  // Letters Unicode does not decompose, including one that becomes two.
  eq(P.rank('strasse', [cmd('a', 'Straße')], [])[0].hits, [0, 1, 2, 3, 4, 5]);
  eq(P.rank('oresund', [cmd('a', 'Øresund')], []).length, 1);
  // Exact still means exact once accents are gone.
  eq(ids(P.rank('ecran', [cmd('pre', 'Écrans'), cmd('ex', 'ÉCRAN')], [])), ['ex', 'pre']);
});

test('palette: commands that do not match are left out', () => {
  const list = [cmd('a', 'New post'), cmd('b', 'Mute words', { keywords: ['silence'] })];
  eq(P.rank('zzz', list, []), []);
  eq(ids(P.rank('tsop', list, [])), []);
  eq(ids(P.rank('silence', list, [])), ['b']);
  eq(P.rank('a much longer query than any title', list, []), []);
  // Missing titles and keywords do not throw.
  eq(ids(P.rank('x', [{ id: 'q' }, null, cmd('x', 'X Pro')], [])), ['x']);
});

test('palette: keywords can be one string', () => {
  const rs = P.rank('mute', [cmd('k', 'Silence', { keywords: 'mute' })], []);
  eq(ids(rs), ['k']);
  eq(rs[0].hits, []);
});

test('palette: highlight escapes and marks whole characters', () => {
  eq(P.highlight('New post', [0, 4]), '<mark class="pal-m">N</mark>ew <mark class="pal-m">p</mark>ost');
  eq(P.highlight('<b>&', [0]), '<mark class="pal-m">&lt;</mark>b&gt;&amp;');
  eq(P.highlight('<b>', []), '&lt;b&gt;');
  // A decomposed accent stays inside the mark with its letter.
  eq(P.highlight('Résumé', [0, 1]), '<mark class="pal-m">Ré</mark>sumé');
  // A skin tone or a joined emoji is never split by a mark.
  const thumb = P.rank('👍', [cmd('a', '👍🏽 Like')], [])[0];
  eq(P.highlight(thumb.cmd.title, thumb.hits), '<mark class="pal-m">👍🏽</mark> Like');
  eq(P.highlight('👨‍👩‍👧 Family', [0]), '<mark class="pal-m">👨‍👩‍👧</mark> Family');
  // Hits from rank line up with the title as written.
  const r = P.rank('strasse', [cmd('a', 'Straße')], [])[0];
  eq(P.highlight(r.cmd.title, r.hits), '<mark class="pal-m">Straße</mark>');
});
