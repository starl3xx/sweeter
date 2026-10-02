// Builds build/harness.html: the real Sweeter scripts plus captured X Pro
// responses (fixtures/raw, gitignored), so the UI can be checked in a
// browser without X. Output stays in build/ and is never committed.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
const scripts = manifest.content_scripts[1].js.filter((f) => !f.endsWith('main.js'));
const raw = path.join(root, 'fixtures/raw');
const msgs = fs.existsSync(raw)
  ? fs.readdirSync(raw).filter((f) => f.endsWith('.json')).sort().map((f) => {
      const j = JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8'));
      return { op: f.split('.')[0], vars: j.vars || {}, body: j.body };
    })
  : [];
const skin = process.argv[2] || 'light';
const tab = process.argv[3] || '';

let html = '<!doctype html><html><head><meta charset="utf-8"><title>Sweeter harness</title></head><body style="margin:0">';
for (const s of scripts) html += '<script>' + fs.readFileSync(path.join(root, 'extension', s), 'utf8') + '</script>';
html += '<script>const MSGS=' + JSON.stringify(msgs).replace(/</g, '\\u003c') + ';</script>';
html += `<script>
  const store = Sweeter.createStore({});
  for (const m of MSGS) store.ingest(m);
  // A deck sync in X Pro’s shape (ViewerAccountSync), so columns come from
  // the deck model: Notifications, the lists, then Home, like a typical deck.
  (function () {
    const cols = [{ rest_id: '101', pathname: '/notifications' }];
    store.all().filter((s) => s.kind === 'list').forEach((s, i) => cols.push({ rest_id: String(102 + i), pathname: '/i/lists/' + s.listId, hide_header: true }));
    cols.push({ rest_id: '199', pathname: '/home?mode=home_latest' });
    // ?r2: the Release 2 column types too (a conversation, Explore).
    if (/[?&]r2/.test(location.search)) {
      const det = MSGS.find((m) => m.op === 'TweetDetail');
      if (det) cols.push({ rest_id: '201', pathname: '/someone/status/' + det.vars.focalTweetId + '?urtUrl=' });
      cols.push({ rest_id: '202', pathname: '/explore' });
    }
    const second = { rest_id: '901', config: { icon: '🧪', is_pinned: true, title: 'Lab' }, deck_columns_v2: [{ rest_id: '301', pathname: '/home?mode=home_latest', width: 'Medium' }] };
    store.ingest({ op: 'ViewerAccountSync', vars: {}, body: { data: { viewer_v2: { accountsync_client_config: { active_deck_id: '900' }, decks: [{ rest_id: '900', config: { icon: '⭐️', is_pinned: true, title: 'Personal' }, deck_columns_v2: cols.map((c) => Object.assign({ width: 'Medium', media_preview: 'Small', latest: true }, c)) }, second] } } } });
  })();
  const ui = Sweeter.ui.mount({ store, xpro: Sweeter.xpro, settings: Object.assign({ skin: ${JSON.stringify(skin)} }, ${JSON.stringify(tab)} === 'small' ? { media: 'small', actions: 'always' } : {}), mutes: [], save: () => {}, native: ${JSON.stringify(tab)} === 'native' ? { counts() {}, notify() {}, log() {} } : null });
  for (const t of ['keydown','keypress','keyup']) window.addEventListener(t, (e) => ui.onWindowKey(e), true);
  window.__ui = ui; window.__store = store;
  const TAB = ${JSON.stringify(tab)};
  if (TAB === 'detail' || TAB === 'lightbox') {
    const det = MSGS.find((m) => m.op === 'TweetDetail');
    const id = String(det.vars.focalTweetId);
    const d = store.detail(id);
    const focal = d.blocks.find((b) => b.kind === 'post' && b.post.id === id).post;
    if (TAB === 'detail') ui.debug.openDetail(ui.debug.cols.keys().next().value, focal);
    else {
      let multi = null;
      for (const s of store.all()) for (const b of s.sorted) if (!multi && b.kind === 'post' && b.post.media.filter((m) => m.type === 'photo').length > 1) multi = b.post;
      ui.debug.openLightbox(multi || focal, 1);
    }
  }
  else if (TAB === 'selftest') {
    const sr = ui.host.shadowRoot; const out = {};
    sr.querySelector('[data-cmd=compose]').click();
    const ta = sr.querySelector('#cmp-text');
    ta.value = 'Hello World 123 ok'; ta.dispatchEvent(new Event('input'));
    ta.setSelectionRange(0, 15); sr.querySelector('[data-cmd=cmp-bold]').click(); out.bold = ta.value;
    ta.setSelectionRange(0, ta.value.length - 3); sr.querySelector('[data-cmd=cmp-bold]').click(); out.unbold = ta.value;
    ta.setSelectionRange(6, 11); sr.querySelector('[data-cmd=cmp-italic]').click(); out.italic = ta.value;
    const png = new File([new Uint8Array([137,80,78,71])], 'shot.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(png); dt.setData('text/plain', '/Users/x/shot.png');
    const before = ta.value;
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    out.pasteKeptText = ta.value === before; out.thumbs = sr.querySelectorAll('.cmp-media .cm').length;
    const dt2 = new DataTransfer(); for (let i = 0; i < 4; i++) dt2.items.add(new File([new Uint8Array([1])], 'p' + i + '.jpg', { type: 'image/jpeg' }));
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt2, bubbles: true, cancelable: true }));
    out.afterFiveTry = sr.querySelectorAll('.cmp-media .cm').length; out.toast = sr.querySelector('.toast').textContent;
    sr.querySelector('.cm [data-cmd=cmp-unfile]').click(); out.afterRemove = sr.querySelectorAll('.cmp-media .cm').length;
    out.postEnabled = !sr.querySelector('.cmp-post').disabled; out.count = sr.querySelector('.cmp-count').textContent;
    const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  }
  else if (TAB === 'compose') { const sr = ui.host.shadowRoot; const cell = sr.querySelector('.cell[data-id] [data-act=reply]'); cell.click(); sr.querySelector('#cmp-text').value = 'Tweetbot energy, X Pro engine. “Nice.” 👋'; sr.querySelector('#cmp-text').dispatchEvent(new Event('input')); }
  else if (TAB && TAB !== 'native' && TAB !== 'small') { const sr = ui.host.shadowRoot; sr.querySelector('[data-cmd=settings]').click(); const t = sr.querySelector('.ptab[data-tab="' + TAB + '"]'); if (t) t.click(); }
</script></body></html>`;
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build/harness.html'), html);
console.log('build/harness.html', (html.length / 1e6).toFixed(1) + ' MB,', msgs.length, 'messages, skin', skin);
