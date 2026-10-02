// Runs only where fixtures/raw exists (captured from live X Pro, gitignored).
// Checks invariants over real data without printing any of it.
const fs = require('fs');
const path = require('path');
const N = globalThis.Sweeter.normalize;
const createStore = globalThis.Sweeter.createStore;

const RAW = path.join(__dirname, '../fixtures/raw');
const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => f.endsWith('.json')) : [];

function load(f) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  return { op: f.split('.')[0], vars: j.vars || {}, body: j.body };
}

function countEntries(body, pred) {
  let n = 0;
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.entryId && o.content && pred(o)) n++;
    for (const k in o) walk(o[k]);
  })(body);
  return n;
}

for (const f of files.filter((f) => /Timeline/.test(f))) {
  test('real ' + f + ': every post and notification entry normalizes', () => {
    const { op, vars, body } = load(f);
    ok(N.sourceFor(op, vars), 'source for ' + op);
    const ins = N.timeline(body);
    const blocks = ins.filter((i) => i.type === 'add').flatMap((i) => i.blocks);
    const expectedItems = countEntries(body, (e) => e.content.entryType === 'TimelineTimelineItem' && e.content.itemContent && /TimelineTweet|TimelineNotification/.test(e.content.itemContent.itemType) && !e.content.itemContent.promotedMetadata);
    const items = blocks.filter((b) => b.kind === 'post' || b.kind === 'notification').length;
    eq(items, expectedItems, 'item blocks');
    for (const b of blocks) {
      const posts = b.kind === 'thread' ? b.posts : b.kind === 'post' ? [b.post] : b.n.target ? [b.n.target] : [];
      for (const p of posts) {
        if (p.unavailable) continue;
        ok(p.id && /^\d+$/.test(p.id), 'post id');
        ok(p.author && p.author.handle, 'author handle');
        ok(typeof p.html === 'string' && typeof p.plain === 'string', 'text');
        ok(isFinite(p.createdMs), 'time');
        ok(!/<script|onerror=|javascript:/i.test(p.html), 'safe html');
      }
      if (b.kind === 'notification') ok(b.n.html.length > 0 && b.n.icon && isFinite(b.n.timeMs), 'notification text, icon and time');
    }
  });
}

if (files.length) {
  test('real: the full capture builds columns with titles', () => {
    const s = createStore();
    for (const f of files.sort()) s.ingest(load(f));
    const cols = s.all();
    ok(cols.length >= 3, 'at least home, notifications and a list');
    for (const c of cols) ok(c.sorted.length > 0 && c.title, c.key);
    ok(cols.some((c) => c.kind === 'list' && c.title !== 'List'), 'a list got its name');
  });
}

if (files.length) {
  test('real: every captured X Article has a title and a link', () => {
    let n = 0;
    for (const f of files.filter((f) => /Timeline/.test(f))) {
      for (const ins of N.timeline(load(f).body)) {
        for (const b of ins.blocks || []) {
          for (const p of b.kind === 'thread' ? b.posts : b.kind === 'post' ? [b.post] : []) {
            if (p.unavailable || !p.article) continue;
            n++;
            ok(p.article.title && /^https:\/\/x\.com\/i\/article\/\d+$/.test(p.article.url), 'article fields');
            ok(!/x\.com\/i\/article/.test(p.html), 'bare article link hidden');
          }
        }
      }
    }
    ok(n > 0, 'captures contain articles');
  });
}
