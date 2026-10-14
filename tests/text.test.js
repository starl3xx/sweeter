const { richText, plainText, draftLinks } = globalThis.Sweeter.text;
const U = globalThis.Sweeter.util;

test('plain text is escaped and newlines become <br>', () => {
  eq(richText('a <b> & c\nd', {}, null), 'a &lt;b&gt; &amp; c<br>d');
});

test('delivered escapes are decoded once, never twice', () => {
  // X sends "&amp;" for "&"; the reader must see "&", written as &amp; in HTML.
  eq(richText('Q&amp;A &lt;3', {}, null), 'Q&amp;A &lt;3');
  eq(plainText('Q&amp;A &lt;3'), 'Q&A <3');
});

test('entity indices count code points, not UTF-16 units', () => {
  const text = '🦋🦋 hi @maralind';
  const i = Array.from(text).indexOf('@');
  const html = richText(text, { user_mentions: [{ screen_name: 'maralind', indices: [i, i + 9] }] }, null);
  ok(html.includes('>@maralind</a>'), html);
  ok(html.startsWith('🦋🦋 hi '), html);
});

test('entity indices count the escaped text', () => {
  // Verified on live data: an entity after "&amp;" is indexed in the escaped string.
  const text = 'R&amp;D with @ivycodes';
  const i = Array.from(text).indexOf('@');
  const html = richText(text, { user_mentions: [{ screen_name: 'ivycodes', indices: [i, i + 9] }] }, null);
  eq(html, 'R&amp;D with <a class="m" href="https://x.com/ivycodes" target="_blank" rel="noopener noreferrer" data-user="ivycodes">@ivycodes</a>');
});

test('urls show display_url and link to expanded_url', () => {
  const text = 'read https://t.co/abc';
  const html = richText(text, { urls: [{ url: 'https://t.co/abc', expanded_url: 'https://example.com/post', display_url: 'example.com/post', indices: [5, 21] }] }, null);
  ok(html.includes('href="https://example.com/post"'), html);
  ok(html.includes('<span class="ls">example.com/post</span>'), 'short form: ' + html);
  ok(html.includes('<span class="ld">example.com</span>'), 'domain form: ' + html);
  ok(html.includes('<span class="lf">example.com/post</span>'), 'full form: ' + html);
});

test('display_text_range hides the reply prefix and trailing media link', () => {
  const text = '@oskarberg nice build https://t.co/pic';
  const html = richText(text, { media: [{ indices: [22, 38] }] }, [11, 21]);
  eq(html, 'nice build');
});

test('hidden urls (quote permalinks) disappear', () => {
  const text = 'this https://t.co/quote123';
  eq(richText(text, { urls: [{ url: 'https://t.co/quote123', expanded_url: 'https://x.com/a/status/1', display_url: 'x.com/a/…', indices: [5, 26] }] }, null, { hideUrls: ['https://t.co/quote123'] }), 'this');
});

test('hashtags and cashtags render as quiet links', () => {
  const html = richText('#WWDC $WORD', { hashtags: [{ text: 'WWDC', indices: [0, 5] }], symbols: [{ text: 'WORD', indices: [6, 11] }] }, null);
  ok(html.includes('class="h" href="https://x.com/hashtag/WWDC"'), html);
  ok(html.includes('href="https://x.com/search?q=%24WORD"'), html);
});

test('link domain drops www and the path', () => {
  const html = richText('x', { urls: [{ url: 'x', expanded_url: 'https://www.nytimes.com/2026/09/28/tech/a.html?x=1', display_url: 'nytimes.com/2026/09/28/tec…', indices: [0, 1] }] }, null);
  ok(html.includes('<span class="ld">nytimes.com</span>'), html);
  ok(html.includes('<span class="lf">www.nytimes.com/2026/09/28/tech/a.html?x=1</span>'), html);
});

test('entity text cannot inject markup', () => {
  const html = richText('x', { urls: [{ url: 'x', expanded_url: 'javascript:alert(1)"><img>', display_url: '<img>', indices: [0, 1] }] }, null);
  ok(!html.includes('<img>'), html);
});

test('relative time uses Tweetbot’s formats', () => {
  const now = 1_790_000_000_000;
  eq(U.relativeTime(now - 2000, now), 'Now');
  eq(U.relativeTime(now - 45e3, now), '45s');
  eq(U.relativeTime(now - 12 * 60e3, now), '12m');
  eq(U.relativeTime(now - 3 * 3600e3, now), '3h');
  eq(U.relativeTime(now - 2 * 86400e3, now), '2d');
});

test('snowflake time decodes a post ID', () => {
  // 2104599248595714273 is a Snowflake from 2026-09-28.
  const ms = U.snowflakeMs('2104599248595714273');
  eq(new Date(ms).toISOString().slice(0, 10), '2026-09-28');
});

test('sortIndex strings compare numerically', () => {
  ok(U.compareSort('2104599280995008512', '999999999999999999') > 0);
  ok(U.compareSort('1790610459401', '1790610459400') > 0);
  eq(U.compareSort('5', '5'), 0);
});

test('compact counts', () => {
  eq(U.compactCount(999), '999');
  eq(U.compactCount(1500), '1.5K');
  eq(U.compactCount(25000), '25K');
  eq(U.compactCount(1200000), '1.2M');
});

test('contract addresses link to DexScreener, shortened; links and hashes stay as they are', () => {
  const { richText } = globalThis.Sweeter.text;
  const evm = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  let html = richText('CA: ' + evm + ' on Base');
  ok(html.includes('class="ca"') && html.includes('data-ca="' + evm + '"'), html);
  ok(html.includes('>0x8335…2913</a>'), 'shortened: ' + html);
  ok(html.includes('https://dexscreener.com/search?q=' + evm), html);
  // A 64-digit transaction hash is not an address.
  ok(!richText('tx 0x' + 'ab'.repeat(32)).includes('class="ca"'), 'tx hash');
  // An address inside a link entity stays that link.
  const url = 'https://basescan.org/token/' + evm;
  const linked = richText('see https://t.co/abc', { urls: [{ url: 'https://t.co/abc', expanded_url: url, display_url: 'basescan.org/token/0x83…', indices: [4, 20] }] });
  ok(!linked.includes('class="ca"'), linked);
  // Solana: base58 with a digit and both cases; a long plain word is not one.
  const sol = '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
  ok(richText('sol ' + sol + ' pump').includes('data-ca="' + sol + '"'), 'solana');
  ok(!richText('pneumonoultramicroscopicsilicovolcanoconiosis').includes('class="ca"'), 'long word');
  ok(!richText('x' + evm).includes('class="ca"'), 'glued to a word');
});

test('draft links: the addresses X counts, without closing punctuation', () => {
  const at = (t) => draftLinks(t).map((l) => t.slice(l.start, l.end));
  eq(at('see https://starl3xx.fun/sweeter.'), ['https://starl3xx.fun/sweeter']);
  eq(at('(https://example.com/a) and http://b.example.org/x?y=1, ok'), ['https://example.com/a', 'http://b.example.org/x?y=1']);
  eq(at('https://en.wikipedia.org/wiki/Fish_(food)'), ['https://en.wikipedia.org/wiki/Fish_(food)']);
  eq(at('“https://example.com”'), ['https://example.com']);
  eq(at('https:// and https://localhost and https://x.'), []);
});

test('draft links count UTF-16 offsets, as a textarea does', () => {
  const t = '🦋 https://example.com';
  eq(draftLinks(t), [{ start: 3, end: t.length, url: 'https://example.com' }]);
});

test('draft links: bare domains as X links them', () => {
  const at = (t) => draftLinks(t).map((l) => [t.slice(l.start, l.end), l.url]);
  eq(at('Sweeter starl3xx.fun/sweeter'), [['starl3xx.fun/sweeter', 'https://starl3xx.fun/sweeter']]);
  eq(at('see example.com. and github.io'), [['example.com', 'https://example.com'], ['github.io', 'https://github.io']]);
  // A two-letter country domain needs a path; a word with a dot is not a link.
  eq(at('nyt.ms/abc but not nyt.ms, file.md, e.g. v1.2.3 or foo.bar'), [['nyt.ms/abc', 'https://nyt.ms/abc']]);
  // Not inside an address with https://, and not after @.
  eq(at('https://a.example.com/x and me@example.com'), [['https://a.example.com/x', 'https://a.example.com/x']]);
  eq(at('(sweeter.app)'), [['sweeter.app', 'https://sweeter.app']]);
});

test('style ranges follow edits, toggle, and merge (real bold and italic while writing)', () => {
  const T = globalThis.Sweeter.text;
  eq(T.normRanges([[5, 8], [0, 2], [2, 4], [7, 9], [3, 3]]), [[0, 4], [5, 9]]);
  ok(T.rangesCover([[0, 4], [4, 8]], 1, 7));
  ok(!T.rangesCover([[0, 4]], 2, 5));
  // Toggle on, then off a middle part.
  eq(T.toggleRange([], 2, 6), [[2, 6]]);
  eq(T.toggleRange([[2, 6]], 3, 5), [[2, 3], [5, 6]]);
  eq(T.toggleRange([[2, 3]], 1, 5), [[1, 5]]);
  const ed = (a, b) => T.textEdit(a, b);
  eq(ed('hello', 'hello!'), { at: 5, removed: 0, inserted: 1 });
  eq(ed('abcdef', 'abXYef'), { at: 2, removed: 2, inserted: 2 });
  const sh = (r, a, b) => T.shiftRanges(r, ed(a, b));
  // Typing at a range's end joins it; just before its start, it moves.
  eq(sh([[0, 4]], 'bold rest', 'boldy rest'), [[0, 5]]);
  eq(sh([[4, 8]], 'say bold', 'say xbold'), [[5, 9]]);
  // Inside it grows; deleting inside shrinks; deleting it all removes it.
  eq(sh([[0, 8]], 'abcdefgh', 'abcZdefgh'), [[0, 9]]);
  eq(sh([[0, 8]], 'abcdefgh', 'abgh'), [[0, 4]]);
  eq(sh([[4, 8]], 'say bold', 'say '), []);
  // Replacing a whole styled word keeps the style; text after moves.
  eq(sh([[4, 8], [9, 11]], 'say bold it', 'say x it'), [[4, 5], [6, 8]]);
  // A deletion that runs into a range's start.
  eq(sh([[3, 10]], 'abcdefghijk', 'aefghijk'), [[1, 7]]);
  // UTF-16: an emoji counts two.
  eq(sh([[2, 4]], '🔥ab', '🔥🔥ab'), [[4, 6]]);
});

test('poll rules: X Pro’s length limits, its choices, and when it refuses', () => {
  const T = globalThis.Sweeter.text;
  const L = (d, h, m) => { const r = T.pollLength({ days: d, hours: h, minutes: m }); return [r.days, r.hours, r.minutes]; };
  eq(L(1, 0, 0), [1, 0, 0]); // X Pro's default
  eq(L(7, 5, 30), [7, 0, 0]); // 7 days takes no hours or minutes
  eq(T.pollLength({ days: 7 }).hoursMax, 0);
  eq(L(0, 0, 2), [0, 0, 5]); // under an hour: 5 minutes at least
  eq(T.pollLength({ days: 0, hours: 0 }).minutesMin, 5);
  eq(L(0, 1, 0), [0, 1, 0]);
  eq(L(9, 30, 99), [7, 0, 0]);
  eq(L(-1, 25, 61), [0, 23, 59]);
  eq(L('2', '3', '4'), [2, 3, 4]);
  eq(T.pollChoices({ choices: [' Yes ', '', 'No', '  '] }), ['Yes', 'No']);
  const P = { choices: ['Yes', 'No'], days: 1 };
  eq(T.pollProblem('Which?', P), null);
  eq(T.pollProblem('Which?', null), null);
  ok(/question/.test(T.pollProblem('  ', P)));
  ok(/two choices/.test(T.pollProblem('Which?', { choices: ['Yes', ' '] })));
  ok(/25/.test(T.pollProblem('Which?', { choices: ['Yes', 'x'.repeat(26)] })));
  ok(/media/.test(T.pollProblem('Which?', P, { media: true })));
  ok(/quote/.test(T.pollProblem('Which?', P, { quote: true })));
});

test('schedule rules: a real local time, after now, within 18 months, as X Pro allows', () => {
  const T = globalThis.Sweeter.text;
  const now = new Date(2026, 9, 13, 18, 0).getTime();
  const W = (y, mo, d, h, mi) => ({ y, mo, d, h, mi });
  eq(T.whenDate(W(2026, 10, 14, 9, 5)).getTime(), new Date(2026, 9, 14, 9, 5).getTime());
  eq(T.whenDate(W(2026, 2, 30, 9, 0)), null); // no February 30
  eq(T.whenDate(W(2026, 10, 14, 24, 0)), null);
  eq(T.whenDate({ y: 2026, mo: 10, d: 14, h: 9 }), null);
  eq(T.whenDate(null), null);
  eq(T.whenOf(new Date(2026, 9, 14, 9, 5)), W(2026, 10, 14, 9, 5));
  eq(T.scheduleProblem(W(2026, 10, 14, 9, 0), now), null);
  ok(/past/.test(T.scheduleProblem(W(2026, 10, 13, 17, 59), now)));
  ok(/past/.test(T.scheduleProblem(W(2026, 10, 13, 18, 0), now)));
  ok(/2 minutes/.test(T.scheduleProblem(W(2026, 10, 13, 18, 1), now)));
  eq(T.scheduleProblem(W(2026, 10, 13, 18, 2), now), null);
  eq(T.scheduleProblem(W(2028, 4, 13, 18, 0), now), null); // 18 months to the minute
  ok(/18 months/.test(T.scheduleProblem(W(2028, 4, 13, 18, 1), now)));
  ok(/date and time/.test(T.scheduleProblem(W(2026, 2, 30, 9, 0), now)));
  ok(/poll/.test(T.scheduleProblem(W(2026, 10, 14, 9, 0), now, { poll: true })));
  ok(/everyone/.test(T.scheduleProblem(W(2026, 10, 14, 9, 0), now, { reply: 'Accounts you follow' })));
  eq(T.scheduleProblem(W(2026, 10, 14, 9, 0), now, { reply: 'Everyone' }), null);
  ok(/bold or italic/.test(T.scheduleProblem(W(2026, 10, 14, 9, 0), now, { styledReply: true })));
  ok(/280/.test(T.scheduleProblem(W(2026, 10, 14, 9, 0), now, { longReply: true })));
  ok(/ at /.test(T.whenLabel(W(2026, 10, 14, 9, 5), now)));
  ok(!/2026/.test(T.whenLabel(W(2026, 10, 14, 9, 5), now)));
  ok(/2027/.test(T.whenLabel(W(2027, 1, 4, 9, 5), now)));
  eq(T.whenLabel(null, now), '');
});

test('editable text: full links back in, a quoted post’s link left out, as X Pro’s Edit does', () => {
  const T = globalThis.Sweeter.text;
  const text = 'See https://t.co/abc and 🔥 https://t.co/q https://t.co/m';
  const ents = { urls: [{ url: 'https://t.co/abc', expanded_url: 'https://starl3xx.fun/sweeter', indices: [4, 20] }, { url: 'https://t.co/q', expanded_url: 'https://x.com/a/status/1', indices: [27, 41] }] };
  eq(T.editableText(text, [0, 41], ents, ['https://t.co/q']), 'See https://starl3xx.fun/sweeter and 🔥');
  eq(T.editableText(text, [0, 41], ents, []), 'See https://starl3xx.fun/sweeter and 🔥 https://x.com/a/status/1');
  eq(T.editableText('a &amp; b', null, {}), 'a & b');
  eq(T.editableText('', null, null), '');
});
