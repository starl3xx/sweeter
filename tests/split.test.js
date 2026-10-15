// The thread splitter (Sweeter.text.splitThread): posts of at most 280 by
// X's count, cut at blank lines, then line ends, sentence ends, and spaces.
const T = globalThis.Sweeter.text;
const words = (s) => s.split(/\s+/).filter(Boolean);
const unnumbered = (posts) => posts.map((p) => p.replace(/ \d+\/\d+$/, '')).join(' ');
const sentence = (n) => 'Sentence number ' + n + ' says a little more about the thing we are building here.';

test('split: a short post stays one post, unnumbered', () => {
  eq(T.splitThread('Just one post.'), ['Just one post.']);
  eq(T.splitThread('  '), []);
  // 280 with a trailing line break: still one post, never “1/2” and “2/2”.
  const full = 'y'.repeat(280);
  eq(T.splitThread(full + '\n'), [full]);
});

test('split: paragraphs, then sentences, every post within 280 with its number', () => {
  const para = (k) => [1, 2, 3].map((i) => sentence(k * 10 + i)).join(' ');
  const text = [para(1), para(2), para(3), para(4)].join('\n\n');
  const posts = T.splitThread(text);
  ok(posts.length >= 4, 'several posts');
  posts.forEach((p, i) => {
    ok(T.weight(p) <= 280, 'post ' + (i + 1) + ' fits: ' + T.weight(p));
    ok(p.endsWith(' ' + (i + 1) + '/' + posts.length), 'numbered');
    ok(/\.\s\d+\/\d+$/.test(p), 'ends at a sentence: ' + p.slice(-30));
  });
  eq(words(unnumbered(posts)), words(text), 'every word, in order');
});

test('split: short paragraphs share a post, joined by their blank line', () => {
  const posts = T.splitThread('One.\n\nTwo.\n\n' + 'x '.repeat(200).trim());
  eq(posts[0].startsWith('One.\n\nTwo.'), true);
});

test('split: a link counts 23, a word longer than a post is cut, and numbers can go', () => {
  const url = 'https://example.com/' + 'a'.repeat(300);
  eq(T.weight('see ' + url), 27);
  eq(T.splitThread('see ' + url), ['see ' + url]);
  const long = 'z'.repeat(700);
  const posts = T.splitThread(long, { numbered: false });
  eq(posts.map((p) => p.length), [280, 280, 140]);
  eq(posts.join(''), long);
});
