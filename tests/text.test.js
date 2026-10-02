const { richText, plainText } = globalThis.Sweeter.text;
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
