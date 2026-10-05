// Everything Sweeter needs to know about X Pro’s own page, read from the DOM.
// Hooks are data-testid attributes (X’s class names are machine generated).
// Verified on the live page 2026-09-28: multi-column-layout-column-content,
// column-title-wrapper, SideNav_AccountSwitcher_Button, UserAvatar-Container-*.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  function findScroller(el) {
    let e = el;
    while (e && e !== document.body) {
      const st = getComputedStyle(e);
      if (/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 5) return e;
      e = e.parentElement;
    }
    return null;
  }

  function columnTitle(el) {
    let p = el;
    for (let i = 0; i < 8 && p; i++) {
      const t = p.querySelector && p.querySelector('[data-testid="column-title-wrapper"]');
      if (t) return t.textContent.replace(/\s+/g, ' ').trim();
      p = p.parentElement;
    }
    return null;
  }

  // The active deck’s columns in X Pro’s order. Each column’s wrapper
  // carries data-rfd-draggable-id: its server id, or local-<uuid> for a
  // column made this session (verified 2026-09-30). The header names the
  // account the column acts as (“Delegate”, UserAvatar-Container-<handle>).
  const OPTIONS_LABEL = /^(Open|Close) column options - /;
  function wrapperInfo(w, idx) {
    const opt = w.querySelector('[aria-label^="Open column options - "], [aria-label^="Close column options - "]');
    const av = w.querySelector('[aria-label="Delegate"] [data-testid^="UserAvatar-Container-"]');
    return {
      id: w.getAttribute('data-rfd-draggable-id'),
      wrap: w,
      el: w.querySelector('[data-testid="multi-column-layout-column-content"]') || w,
      title: opt ? opt.getAttribute('aria-label').replace(OPTIONS_LABEL, '') : columnTitle(w),
      idx,
      picker: !!w.querySelector('[aria-label="Delete column - Column Picker"]'),
      actingAs: av ? av.getAttribute('data-testid').slice('UserAvatar-Container-'.length) : null,
    };
  }

  function wrappers() {
    const box = document.querySelector('[data-rfd-droppable-id="deck-columns"]');
    if (!box) return [];
    return Array.from(box.querySelectorAll('[data-rfd-draggable-id]'))
      .filter((w) => w.parentElement && w.parentElement.closest('[data-rfd-droppable-id]') === box)
      // A column X Pro is removing collapses to width 0 until it commits.
      .filter((w) => w.getBoundingClientRect().width > 0)
      .map(wrapperInfo);
  }

  function domColumns() {
    const w = wrappers();
    if (w.length) return w;
    return Array.from(document.querySelectorAll('[data-testid="multi-column-layout-column-content"]')).map((el, idx) => ({ id: null, wrap: el, el, title: columnTitle(el), idx, picker: false, actingAs: null }));
  }

  function columnWrap(id) {
    if (!id) return null;
    const box = document.querySelector('[data-rfd-droppable-id="deck-columns"]') || document;
    return box.querySelector('[data-rfd-draggable-id="' + CSS.escape(id) + '"]');
  }

  // A column that acts as another account (a delegate): Sweeter never
  // presses anything inside it.
  function viewerHandle() {
    const box = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"] [data-testid^="UserAvatar-Container-"]');
    return box ? box.getAttribute('data-testid').slice('UserAvatar-Container-'.length).toLowerCase() : null;
  }
  // The deck model order() last used, for the columns’ creators.
  let model = null;
  const paired = new Map(); // local-<uuid> wrapper id -> server column id, this session
  // Fails closed: with no signed-in handle to compare, nothing is written.
  function isDelegated(wrap) {
    if (!wrap) return false;
    const me = viewerHandle();
    if (!me) return true;
    const id = wrap.getAttribute && wrap.getAttribute('data-rfd-draggable-id');
    const col = model && id ? model.column(id) : null;
    if (col && col.creator && col.creator !== me) return true;
    const av = wrap.querySelector('[aria-label="Delegate"] [data-testid^="UserAvatar-Container-"]');
    return !!(av && av.getAttribute('data-testid').slice('UserAvatar-Container-'.length).toLowerCase() !== me);
  }
  function wrapOf(el) {
    return el && el.closest ? el.closest('[data-rfd-draggable-id]') : null;
  }
  // Where a press may happen: the mapped column’s current wrapper (found
  // again by id, since X Pro replaces elements), never a delegated one.
  // `null` means “anywhere outside delegated columns”; false means refuse.
  function scopeOf(mapping) {
    if (!mapping) return null;
    const w = mapping.id ? columnWrap(mapping.id) : null;
    if (w) return isDelegated(w) ? false : w;
    if (mapping.dom && mapping.dom.el && mapping.dom.el.isConnected) {
      const w2 = wrapOf(mapping.dom.el) || mapping.dom.el;
      return isDelegated(w2) ? false : w2;
    }
    return null;
  }
  function allowed(el) {
    return !isDelegated(wrapOf(el));
  }

  function statusIds(el) {
    const ids = new Set();
    for (const a of el.querySelectorAll('a[href*="/status/"]')) {
      const m = /\/status\/(\d+)/.exec(a.getAttribute('href') || '');
      if (m) ids.add(m[1]);
    }
    return ids;
  }

  const idCache = new Map(); // source key -> { updated, ids }
  function sourceIds(s) {
    const c = idCache.get(s.key);
    if (c && c.updated === s.updated) return c.ids;
    const ids = new Set();
    const addPost = (p) => {
      if (!p || p.unavailable) return;
      ids.add(p.id);
      if (p.repostId) ids.add(p.repostId);
    };
    for (const b of s.sorted) {
      if (b.kind === 'post') addPost(b.post);
      else if (b.kind === 'thread') b.posts.forEach(addPost);
      else if (b.kind === 'notification') addPost(b.n.target);
    }
    idCache.set(s.key, { updated: s.updated, ids });
    return ids;
  }

  function titleMatches(domTitle, s) {
    if (!domTitle) return false;
    const t = domTitle.toLowerCase();
    if (s.title && t === s.title.toLowerCase()) return true;
    if (s.key === 'home' && /^(home|following)/.test(t)) return true;
    if (s.kind === 'notifications' && /^notifications/.test(t)) return true;
    return false;
  }

  // X Pro’s columns in deck order, each bound to a store source. With the
  // deck model (lib/decks.js), a column’s route names its source outright.
  // Columns the model does not know yet (made this session) fall back to
  // three passes: shared post IDs, then titles, then first-seen order.
  // Placeholder “Column Picker” columns are skipped. Model columns X Pro
  // has not mounted keep their place without a page element.
  function order(store) {
    const sources = store.all();
    // Only a source with posts settles a choice (Priority or Verified):
    // one declared for an empty column must not.
    const has = (k) => sources.some((s) => s.key === k && s.blocks.size > 0);
    const me = viewerHandle();
    let decks = store.decks && store.decks.ready() ? store.decks : null;
    // A saved model is one account’s: after an account switch it waits for
    // that account’s own sync.
    if (decks && me) {
      if (decks.synced()) decks.setViewer(me);
      else if (decks.viewer() && decks.viewer() !== me) decks = null;
    }
    model = decks;
    const keyOf = (col) => Sweeter.decks.keyFor(col, has, (h) => store.userId(h));
    const used = new Set();
    const slots = domColumns()
      .filter((d) => !d.picker)
      .map((dom) => ({ dom, key: null, id: dom.id, col: null, bound: false, delegated: isDelegated(dom.wrap) }));
    for (const slot of slots) slot.col = decks && slot.id ? decks.column(slot.id) : null;
    // The deck on screen must be the model’s active deck before the model
    // may pair new columns or add columns X Pro has not mounted.
    const deck0 = decks && decks.activeDeck();
    const deckOk = !!deck0 && (!slots.length || slots.some((x) => x.col && deck0.columns.includes(x.col)) || slots.every((x) => x.id && x.id.startsWith('local-')));
    // A column made this session shows local-<uuid> in the page while X Pro
    // writes its server id. Pair such columns, in deck order, with model
    // columns no page column claims (placeholders excluded).
    // A pairing, once made, holds for the session (the page keeps showing
    // local-<uuid>), so the column keeps one identity.
    for (const slot of slots) {
      if (!slot.col && slot.id && paired.has(slot.id) && decks) slot.col = decks.column(paired.get(slot.id));
    }
    if (deckOk) {
      const locals = slots.filter((x) => !x.col && x.id && x.id.startsWith('local-'));
      const spare = deck0.columns.filter((c) => !/^\/i\/columns\/picker/.test(c.pathname) && !slots.some((x) => x.id === c.id || x.col === c));
      if (locals.length && locals.length === spare.length) {
        locals.forEach((x, i) => {
          x.col = spare[i];
          paired.set(x.id, spare[i].id);
        });
      }
    }
    // Routes name sources. The person’s own columns claim a route before a
    // delegated column with the same route does.
    for (const pass of [false, true]) {
      for (const slot of slots) {
        if (slot.delegated !== pass || !slot.col) continue;
        const k = keyOf(slot.col);
        // Two of the person’s own columns may show one route (X Pro’s “Make
        // a copy”): each is its own Sweeter column. A delegated column never
        // takes a route that is already shown.
        if (k && (!used.has(k) || !slot.delegated)) {
          slot.key = k;
          slot.bound = true;
          used.add(k);
        }
      }
    }
    // Columns the model cannot name by route: profiles and likes by shared
    // post IDs; columns the model does not know at all by any source.
    const guessable = (slot) => !slot.key && (!slot.col || keyOf(slot.col) === null);
    for (const slot of slots) {
      if (!guessable(slot)) continue;
      const ids = statusIds(slot.dom.el);
      let best = null;
      let score = 0;
      for (const s of sources) {
        if (used.has(s.key)) continue;
        if (slot.col && s.kind !== 'user' && s.kind !== 'likes') continue;
        const sid = sourceIds(s);
        let n = 0;
        ids.forEach((i) => {
          if (sid.has(i)) n++;
        });
        if (n > score) {
          score = n;
          best = s;
        }
      }
      if (best) {
        used.add(best.key);
        slot.key = best.key;
      }
    }
    for (const slot of slots) {
      if (slot.key || slot.col) continue;
      const s = sources.find((x) => !used.has(x.key) && titleMatches(slot.dom.title, x));
      if (s) {
        used.add(s.key);
        slot.key = s.key;
      }
    }
    for (const slot of slots) {
      if (slot.key || slot.col) continue;
      const s = sources.find((x) => !used.has(x.key) && x.kind !== 'home' && x.kind !== 'notifications' && x.kind !== 'conversation' && x.kind !== 'placeholder');
      if (s) {
        used.add(s.key);
        slot.key = s.key;
      }
    }
    // id: the page’s wrapper id (what Sweeter presses); colId: the server
    // id (what Sweeter keeps settings under); bound: the model named it.
    const entry = (x) => ({ key: x.key, dom: x.dom, id: x.id, colId: x.col ? x.col.id : x.id, col: x.col, bound: x.bound });
    const out = slots.filter((x) => x.key).map(entry);
    if (deckOk) {
      // Model columns X Pro has not mounted: after their model neighbor.
      const cols = deck0.columns;
      cols.forEach((col, i) => {
        if (slots.some((x) => x.id === col.id || x.col === col)) return;
        const k = keyOf(col);
        if (!k || slots.some((x) => x.delegated && x.key === k)) return;
        used.add(k);
        let at = 0;
        for (let j = i - 1; j >= 0; j--) {
          const n = out.findIndex((e) => e.colId === cols[j].id);
          if (n >= 0) {
            at = n + 1;
            break;
          }
        }
        out.splice(at, 0, { key: k, dom: null, id: col.id, colId: col.id, col, bound: true });
      });
    } else if (!slots.length && !decks) {
      // No X Pro columns and no model yet (the page is still rendering, or
      // the local harness): show every source. With a model, an unknown
      // active deck (made moments ago, before the next sync) shows nothing:
      // never another deck's columns.
      for (const s of sources) if (!used.has(s.key) && s.kind !== 'conversation' && s.kind !== 'placeholder') out.push({ key: s.key, dom: null, id: null, colId: null, col: null, bound: false });
    }
    return out;
  }

  // Scrolling X Pro’s own column makes X Pro request the next page itself.
  function loadOlder(mapping) {
    const scope = scopeOf(mapping);
    if (!scope) return false;
    const sc = findScroller(scope.querySelector('[data-testid="multi-column-layout-column-content"]') || scope);
    if (!sc) return false;
    sc.scrollTop = sc.scrollHeight;
    return true;
  }

  function viewer() {
    const btn = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (!btn) return null;
    const img = btn.querySelector('img');
    const box = btn.querySelector('[data-testid^="UserAvatar-Container-"]');
    const handle = box ? box.getAttribute('data-testid').replace('UserAvatar-Container-', '') : null;
    return { handle, avatar: img ? img.src : '' };
  }

  // ---------- actions ----------
  //
  // Sweeter never builds a request. Each action presses X Pro’s own control,
  // once, because the person clicked or pressed a key in Sweeter. X Pro then
  // sends exactly the request it would send for a click on its own page.
  // Test IDs verified in X Pro’s code and DOM (2026-09-28): like, unlike,
  // retweet, unretweet, reply, retweetConfirm, unretweetConfirm; the compose
  // button carries aria-label “Compose post”.

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, ms) {
    const t0 = Date.now();
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() - t0 > ms) return null;
      await wait(60);
    }
  }

  function permalinkId(a) {
    const m = /\/status\/(\d+)(?:[/?#]|$)/.exec(a.getAttribute('href') || '');
    return m ? m[1] : null;
  }

  // The article whose own timestamp link points at this post. A quoted post
  // has no timestamp link of its own, so it can never be mistaken for it.
  // Inside `scope` when given; otherwise anywhere outside delegated columns.
  function findArticle(id, scope) {
    for (const art of (scope || document).querySelectorAll('article[data-testid="tweet"]')) {
      const time = art.querySelector('a[href*="/status/"] time');
      const a = time && time.closest('a');
      if (a && permalinkId(a) === id && (scope || allowed(art))) return art;
    }
    return null;
  }

  // X Pro renders only the posts near each column’s scroll position. If the
  // post is not in the DOM, scroll X Pro’s own column (hidden under Sweeter)
  // until it renders. `hint` is the post’s position in Sweeter’s column (0 to
  // 1): jump there first, then search outward. Measured on the live page
  // before this: a plain top-down scan needed 32 steps (5 s) for post 80.
  async function reveal(id, mapping, hint) {
    const scope = scopeOf(mapping);
    if (scope === false) return null; // a delegated column: never press there
    const art = findArticle(id, scope);
    if (art) return { art, restore() {} };
    const els = scope ? [scope.querySelector('[data-testid="multi-column-layout-column-content"]') || scope] : domColumns().filter((c) => !isDelegated(c.wrap)).map((c) => c.el);
    for (const el of els) {
      const sc = findScroller(el);
      if (!sc) continue;
      const start = sc.scrollTop;
      const restore = () => {
        sc.scrollTop = start;
      };
      const step = Math.round(sc.clientHeight * 0.8);
      const at = async (top) => {
        sc.scrollTop = Math.max(0, Math.min(top, sc.scrollHeight - sc.clientHeight));
        await wait(90);
        return findArticle(id, scope);
      };
      let found = null;
      if (typeof hint === 'number' && isFinite(hint)) {
        const center = hint * sc.scrollHeight - sc.clientHeight / 2;
        found = await at(center);
        for (let i = 1; !found && i <= 12; i++) {
          found = (await at(center + i * step)) || (await at(center - i * step));
        }
      }
      if (!found) {
        found = await at(0);
        for (let i = 0; !found && i < 40 && sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2; i++) {
          found = await at(sc.scrollTop + step);
        }
      }
      if (found) return { art: found, restore };
      restore();
    }
    return null;
  }

  function button(art, testid) {
    return art.querySelector('[data-testid="' + testid + '"]');
  }

  async function setLiked(id, mapping, want, hint) {
    const r = await reveal(id, mapping, hint);
    if (!r) return { ok: false, reason: 'notfound' };
    const art = r.art;
    try {
      return await like(art, want, id);
    } finally {
      r.restore();
    }
  }

  // X Pro may redraw the post after the click, so confirm on a fresh lookup.
  function current(art, id) {
    return art.isConnected ? art : findArticle(id, wrapOf(art) && wrapOf(art).isConnected ? wrapOf(art) : null);
  }

  async function like(art, want, id) {
    const btn = button(art, want ? 'like' : 'unlike');
    if (!btn) return button(art, want ? 'unlike' : 'like') ? { ok: true, already: true } : { ok: false, reason: 'nobutton' };
    btn.click();
    const done = await waitFor(() => {
      const a = current(art, id);
      return a && button(a, want ? 'unlike' : 'like');
    }, 3000);
    return { ok: !!done };
  }

  async function setReposted(id, mapping, want, hint) {
    const r = await reveal(id, mapping, hint);
    if (!r) return { ok: false, reason: 'notfound' };
    try {
      return await repost(r.art, want, id);
    } finally {
      r.restore();
    }
  }

  async function repost(art, want, id) {
    const btn = button(art, want ? 'retweet' : 'unretweet');
    if (!btn) return button(art, want ? 'unretweet' : 'retweet') ? { ok: true, already: true } : { ok: false, reason: 'nobutton' };
    btn.click();
    const item = await waitFor(() => document.querySelector('[data-testid="' + (want ? 'retweetConfirm' : 'unretweetConfirm') + '"]'), 2500);
    if (!item) {
      await closeMenu(btn);
      return { ok: false, reason: 'nomenu' };
    }
    item.click();
    const done = await waitFor(() => {
      const a = current(art, id);
      return a && button(a, want ? 'unretweet' : 'retweet');
    }, 3000);
    return { ok: !!done };
  }

  // Closes a menu X Pro left open (Sweeter lets synthetic keys through).
  function dismiss() {
    const t = document.activeElement || document.body;
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  function composerOpen() {
    return !!editor();
  }

  // Opens X Pro’s own composer: a reply, a quote, or a new post.
  async function openComposer(kind, id, mapping, hint) {
    if (kind === 'new') {
      // The button toggles X Pro’s compose panel, so press it only when closed.
      if (!composerOpen()) {
        const b = document.querySelector('[role="button"][aria-label="Compose post"], [data-testid="SideNav_NewTweet_Button"]');
        if (!b) return { ok: false, reason: 'nobutton' };
        b.click();
      }
    } else {
      // An empty compose panel left open would catch the text meant for the reply.
      if (composerOpen()) {
        closePanel();
        await waitFor(() => !composerOpen(), 1500);
      }
      const r = await reveal(id, mapping, hint);
      if (!r) return { ok: false, reason: 'notfound' };
      const art = r.art;
      if (kind === 'reply') {
        const b = button(art, 'reply');
        if (!b) return { ok: false, reason: 'nobutton' };
        b.click();
      } else {
        const b = button(art, 'retweet') || button(art, 'unretweet');
        if (!b) return { ok: false, reason: 'nobutton' };
        b.click();
        const quote = await waitFor(
          () => Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => /quote/i.test(m.textContent || '')),
          2500,
        );
        if (!quote) {
          await closeMenu(b);
          return { ok: false, reason: 'nomenu' };
        }
        quote.click();
      }
    }
    const open = await waitFor(composerOpen, 3000);
    return { ok: !!open };
  }

  // ---------- Sweeter’s compose window, posted through X Pro ----------
  //
  // Verified in X Pro on 2026-09-28 without posting: the editor is a
  // Draft.js textbox (tweetTextarea_0); a paste event inserts text exactly
  // once (execCommand('insertText') doubled it); the Post button has no
  // test ID, reads “Post” (“Reply” in a reply), and drops aria-disabled
  // once there is text; the panel closes with its “Done” button.

  // Only X Pro’s compose drawer counts (drawerAnimatedDiv, verified
  // 2026-09-28). An open conversation adds its own inline reply editor
  // inside the column (inline_reply_offscreen, in a timeline cell); taking
  // that one made posting fail with “the composer didn’t take the text”.
  function editor() {
    const all = Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"]')).filter((e) => !e.closest('[data-testid^="inline_reply"], [data-testid="cellInnerDiv"]'));
    const drawer = all.filter((e) => e.closest('[data-testid="drawerAnimatedDiv"], [role="dialog"]'));
    const pool = drawer.length ? drawer : all;
    return pool.length ? pool[pool.length - 1] : null;
  }

  const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();

  // Draft.js keeps its own block elements inside the editor. Select-all
  // and delete on an EMPTY editor deletes those too, and from then on the
  // editor takes no text at all (verified 2026-10-01: every post and reply
  // failed with “didn’t take the text”). So an empty editor is left alone,
  // and only the text itself is selected and deleted.
  function selectText(e) {
    const leaves = e.querySelectorAll('[data-text="true"]');
    if (!leaves.length) return false;
    const r = document.createRange();
    r.setStart(leaves[0], 0);
    const last = leaves[leaves.length - 1];
    r.setEnd(last, last.childNodes.length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    return true;
  }
  function clearEditor() {
    const e = editor();
    if (!e || !norm(e.innerText)) return;
    e.focus();
    if (selectText(e)) document.execCommand('delete');
  }

  function postButton(from) {
    let box = from;
    for (let i = 0; i < 40 && box; i++) {
      const b = Array.from(box.querySelectorAll('[role="button"], button')).find((x) => /^\s*(Post|Reply|Post all|Reply all)\s*$/.test(x.textContent || ''));
      if (b) return b;
      box = box.parentElement;
    }
    return null;
  }

  async function paste(text) {
    const e = await waitFor(editor, 3000);
    if (!e) return null;
    const ed = editor();
    ed.focus();
    // Text already there (a draft) is replaced by the paste itself.
    if (norm(ed.innerText)) selectText(ed);
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return waitFor(() => {
      const x = editor();
      return x && norm(x.innerText) === norm(text) ? x : null;
    }, 2500);
  }

  // The composer box: the nearest ancestor of the editor that also holds
  // X Pro’s toolbar and its file input (both verified test IDs).
  function composerRoot() {
    let box = editor();
    for (let i = 0; i < 40 && box; i++) {
      if (box.querySelector('[data-testid="toolBar"]') && box.querySelector('input[data-testid="fileInput"]')) return box;
      box = box.parentElement;
    }
    return null;
  }

  function postEnabled() {
    const b = postButton(editor());
    return b && b.getAttribute('aria-disabled') !== 'true' ? b : null;
  }

  // Attach files through X Pro’s own file input (it accepts JPEG, PNG, WebP,
  // GIF, MP4 and QuickTime, several at once). X Pro uploads them itself and
  // enables Post once they are ready.
  async function attach(files) {
    if (!files || !files.length) return { ok: true };
    const root = composerRoot();
    const input = root && root.querySelector('input[data-testid="fileInput"]');
    if (!input) return { ok: false, reason: 'nofileinput' };
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const video = files.some((f) => /^video\//.test(f.type));
    const ready = await waitFor(postEnabled, video ? 120000 : 45000);
    return ready ? { ok: true } : { ok: false, reason: 'upload' };
  }

  // Who can reply: X Pro shows radio options under its “Everyone can reply”
  // button (verified labels: Everyone, Accounts you follow, Accounts you
  // follow and who they follow, Only accounts you mention, Verified accounts).
  async function setReplySetting(label) {
    if (!label || label === 'Everyone') return { ok: true };
    const root = composerRoot();
    const open = root && Array.from(root.querySelectorAll('[role="button"], button')).find((b) => /can reply/i.test(b.textContent || '') && (b.textContent || '').length < 60);
    if (!open) return { ok: false, reason: 'noreply' };
    open.click();
    const option = await waitFor(() => Array.from(document.querySelectorAll('[role="radiogroup"] label')).find((l) => (l.textContent || '').trim() === label), 2500);
    if (!option) return { ok: false, reason: 'noreply' };
    option.click();
    await wait(250);
    // The chooser stays open after a choice; its button toggles it closed.
    if (document.querySelector('[role="radiogroup"]')) {
      const again = Array.from((composerRoot() || document).querySelectorAll('[role="button"], button')).find((b) => /can reply|follow|mention|verified/i.test(b.textContent || '') && (b.textContent || '').length < 80);
      if (again) again.click();
    }
    return { ok: true };
  }

  // X Pro's own answer to a post (the recorder reads CreateTweet's
  // response): the new post's id, or X's error. Read, never sent.
  let lastPostResult = null;
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.__sweeter !== 1 || (d.op !== 'CreateTweet' && d.op !== 'CreateNoteTweet') || !d.body) return;
    lastPostResult = { at: Date.now(), id: d.body.id || null, error: d.body.error || null, status: d.body.status || 0 };
  });

  // Put text and media into X Pro’s open composer and press its Post (or
  // Reply) button once.
  async function fillAndPost(text, opts) {
    const o = opts || {};
    await waitFor(editor, 3000);
    const media = o.gif ? await attachGif(o.gif) : await attach(o.files);
    if (!media.ok) {
      clearEditor();
      return media;
    }
    if (text && text.trim() && !(await paste(text))) {
      clearEditor();
      return { ok: false, reason: 'mismatch' };
    }
    const rs = await setReplySetting(o.reply);
    if (!rs.ok) return rs;
    const btn = await waitFor(postEnabled, 4000);
    if (!btn) {
      clearEditor();
      return { ok: false, reason: 'disabled' };
    }
    // A test run stops here, with nothing sent.
    if (o.dryRun) return { ok: true, dry: true };
    const t0 = Date.now();
    btn.click();
    // Sent: X Pro's own answer names the new post (or X's error), or, if
    // that never arrives, the composer closes or resets to empty.
    const answer = () => (lastPostResult && lastPostResult.at >= t0 ? lastPostResult : null);
    const closed = () => !composerOpen() || (norm(editor().innerText) === '' && !postEnabled());
    const done = await waitFor(() => answer() || closed(), 45000);
    // X's answer decides. The composer emptying is ambiguous (a photo-only
    // post starts empty), so when it comes first the answer gets a moment
    // more before the fallback counts it as sent.
    const res = answer() || (done ? await waitFor(answer, 8000) : null);
    if (res && !res.id) {
      const e = res.error || {};
      return { ok: false, reason: 'xerror', detail: (e.message || 'HTTP ' + res.status) + (e.code ? ' (code ' + e.code + ')' : '') };
    }
    if (res || done) {
      await waitFor(() => !composerOpen(), 3000);
      closePanel();
      return { ok: true, id: res ? res.id : null };
    }
    // No answer at all: what X Pro shows, if anything.
    const t = document.querySelector('[data-testid="toast"]');
    return { ok: false, reason: 'unsent', detail: t ? norm(t.innerText).slice(0, 200) : '' };
  }

  // Hand over to X Pro’s own composer with text and media already in place,
  // and optionally open one of its tools (GIF, poll, schedule and so on).
  const TOOLS = {
    gif: '[data-testid="gifSearchButton"]',
    poll: '[data-testid="createPollButton"]',
    schedule: '[data-testid="scheduleOption"]',
    location: '[data-testid="geoButton"]',
    grok: '[data-testid="grokImgGen"]',
    disclosure: '[data-testid="contentDisclosureButton"]',
  };

  // ---------- GIFs, through X Pro’s own GIF search ----------
  // Verified 2026-10-05: the composer’s gifSearchButton opens a dialog at
  // /i/foundmedia/search. Its <input data-testid=gifSearchSearchInput> takes
  // a typed query (GraphQL GifSearch); it opens on trending
  // (GifEnumerateCategory). Each result is a gifSearchGifImage div, its
  // aria-label the GIF’s text and its background the GIF on GIPHY; pressing
  // its button attaches the GIF to the composer, with no request, as
  // [data-testid=attachments] [role=group]. The recorder passes the results.
  const gifCache = new Map(); // query ('' is trending) -> items, newest last
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.__sweeter !== 1 || (d.op !== 'GifSearch' && d.op !== 'GifEnumerateCategory') || !d.body || !Array.isArray(d.body.items)) return;
    const q = d.op === 'GifSearch' ? String((d.vars && d.vars.query) || '') : '';
    gifCache.delete(q);
    gifCache.set(q, d.body.items);
    if (gifCache.size > 30) gifCache.delete(gifCache.keys().next().value);
  });
  const gifInput = () => document.querySelector('[data-testid="gifSearchSearchInput"]');
  function gifType(q) {
    const i = gifInput();
    if (!i) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String(q || ''));
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  // The compose panel’s own GIF button (not an inline reply’s), found
  // without its editor, which X Pro loads a moment later.
  function gifButton() {
    const all = Array.from(document.querySelectorAll(TOOLS.gif)).filter((b) => !b.closest('[data-testid^="inline_reply"], [data-testid="cellInnerDiv"]'));
    const drawer = all.filter((b) => b.closest('[data-testid="drawerAnimatedDiv"], [role="dialog"]'));
    return (drawer.length ? drawer : all).pop() || null;
  }
  async function gifDialogClose() {
    const i = gifInput();
    const d = i && i.closest('[role="dialog"]');
    const c = d && d.querySelector('[data-testid="app-bar-close"]');
    if (!c) return;
    c.click();
    await waitFor(() => !gifInput(), 1500);
  }
  // One search in X Pro’s GIF picker for Sweeter’s: the picker opens (from
  // the compose panel, opened for it when closed), gets the query, and
  // closes again once X has answered, so no X Pro dialog, and no focus trap,
  // stays open under Sweeter. Never lifted: X Pro stays hidden, so it cannot
  // take the focus from Sweeter’s search field. `opened` says Sweeter opened
  // the panel (gifClose closes it).
  async function gifSearchOnce(q) {
    q = String(q || '').trim();
    if (gifCache.has(q)) return { ok: true, opened: false, items: gifCache.get(q) };
    let opened = false;
    if (!gifButton()) {
      const b = document.querySelector('[role="button"][aria-label="Compose post"], [data-testid="SideNav_NewTweet_Button"]');
      if (!b) return { ok: false, reason: 'nobutton' };
      b.click();
      opened = true;
      if (!(await waitFor(gifButton, 5000))) return { ok: false, reason: 'nogif', opened };
    }
    if (!gifInput()) {
      gifButton().click();
      if (!(await waitFor(gifInput, 4000))) return { ok: false, reason: 'nogif', opened };
      await wait(120);
    }
    if (q) gifType(q);
    const items = await waitFor(() => gifCache.get(q), 8000);
    await gifDialogClose();
    return items ? { ok: true, opened, items } : { ok: false, reason: 'noanswer', opened };
  }
  // Closes X Pro’s GIF picker if it is open, and the compose panel when
  // Sweeter opened it and it still holds nothing.
  async function gifClose(panelToo) {
    await gifDialogClose();
    if (!panelToo || !gifButton()) return;
    const e = editor();
    const root = composerRoot();
    if ((e && norm(e.innerText)) || (root && root.querySelector('[data-testid="attachments"]'))) return;
    const done = document.querySelector('[aria-label="Done"]');
    if (done) done.click();
  }
  // A GIF the person picked in Sweeter, attached to the composer now open:
  // X Pro’s GIF search again, with the same query, and that GIF pressed.
  async function attachGif(gif) {
    if (!gif || !gif.id) return { ok: true };
    const b = await waitFor(gifButton, 4000);
    if (!b) return { ok: false, reason: 'nogif' };
    b.click();
    if (!(await waitFor(gifInput, 4000))) return { ok: false, reason: 'nogif' };
    if (gif.query) gifType(gif.query);
    const key = '/' + String(gif.id).replace(/^giphy_/, '') + '/';
    const cell = await waitFor(() => Array.from(document.querySelectorAll('[data-testid="gifSearchGifImage"]')).find((x) => x.innerHTML.includes(key)), 8000);
    if (!cell) {
      await gifDialogClose();
      return { ok: false, reason: 'gifgone' };
    }
    (cell.closest('button, [role="button"]') || cell).click();
    const att = await waitFor(() => {
      const r = composerRoot();
      return r && r.querySelector('[data-testid="attachments"] [role="group"]');
    }, 5000);
    return att ? { ok: true } : { ok: false, reason: 'gifgone' };
  }

  async function prefill(text, files, tool, gif) {
    await waitFor(editor, 3000);
    if (files && files.length) await attach(files);
    if (gif) await attachGif(gif);
    if (text && text.trim()) await paste(text);
    if (tool && TOOLS[tool]) {
      const root = composerRoot();
      const b = root && root.querySelector(TOOLS[tool]);
      if (b) b.click();
    }
    return true;
  }

  // The compose drawer closes with “Done”; a reply or quote opens X Pro’s
  // Reply dialog, which closes with its own Close button (the first click
  // can go to the dialog’s focus handling, so it is pressed until it goes).
  async function closePanel() {
    if (!editor()) return;
    const done = document.querySelector('[aria-label="Done"]');
    if (done) return done.click();
    for (let i = 0; i < 3 && editor(); i++) {
      const c = document.querySelector('[role="dialog"] [data-testid="app-bar-close"]');
      if (!c) return;
      c.click();
      await waitFor(() => !editor(), 800);
    }
  }

  // ---------- conversations ----------
  //
  // Verified 2026-09-28: clicking a post (or the quoted-post card, a
  // div[role=link] holding a User-Name) makes X Pro load TweetDetail and show
  // the conversation as a “stack” in the same column, closed by the button
  // with test ID “action-icon_Close stack”.

  async function openDetail(o) {
    if (o.parentId) {
      const r = await reveal(o.parentId, o.mapping, o.hint);
      if (!r) return { ok: false, reason: 'notfound' };
      // The quote card is a div[role=link] holding the quoted author’s
      // User-Name. It often has no link to the quoted post (only photos
      // carry one, or none at all; verified), so match in order: a link to
      // the post, the author’s handle, or the only card.
      const cards = Array.from(r.art.querySelectorAll('div[role="link"]')).filter((d) => d.querySelector('[data-testid="User-Name"]'));
      const byHandle = (d) => o.handle && (d.querySelector('[data-testid="User-Name"]').textContent || '').toLowerCase().includes('@' + o.handle.toLowerCase());
      const card = cards.find((d) => o.id && d.querySelector('a[href*="/status/' + o.id + '"]')) || cards.find(byHandle) || (cards.length === 1 ? cards[0] : null);
      if (!card) return { ok: false, reason: 'nobutton' };
      card.click();
      return { ok: true };
    }
    const r = await reveal(o.id, o.mapping, o.hint);
    if (!r) return { ok: false, reason: 'notfound' };
    const time = r.art.querySelector('a[href*="/status/' + o.id + '"] time');
    const link = time && time.closest('a');
    if (!link) return { ok: false, reason: 'nobutton' };
    link.click();
    return { ok: true };
  }

  // X Pro’s timeline posts have no bookmark button (verified 2026-09-28:
  // reply, repost, like, views, share; the share menu offers only
  // “Bookmark to Folder”). The opened post of a conversation does have X’s
  // bookmark button, so open the conversation in the column, press it,
  // confirm it flipped, and close the conversation again.
  function focalArticle(id, scope) {
    return Array.from((scope || document).querySelectorAll('article')).find((a) => a.querySelector('a[href*="/status/' + id + '"]') && a.querySelector('[data-testid="bookmark"], [data-testid="removeBookmark"]') && (scope || allowed(a))) || null;
  }

  async function setBookmarked(id, mapping, want, hint) {
    const scope = scopeOf(mapping);
    if (scope === false) return { ok: false, reason: 'delegated' };
    const here = () => focalArticle(id, scope && scope.isConnected ? scope : scopeOf(mapping) || null);
    let art = here();
    let opened = false;
    if (!art) {
      const r = await openDetail({ id, mapping, hint });
      if (!r.ok) return r;
      opened = true;
      art = await waitFor(here, 5000);
    }
    try {
      if (!art) return { ok: false, reason: 'nobutton' };
      const btn = button(art, want ? 'bookmark' : 'removeBookmark');
      if (!btn) return button(art, want ? 'removeBookmark' : 'bookmark') ? { ok: true, already: true } : { ok: false, reason: 'nobutton' };
      btn.click();
      const done = await waitFor(() => {
        const a = here();
        return a && button(a, want ? 'removeBookmark' : 'bookmark');
      }, 3000);
      return { ok: !!done };
    } finally {
      if (opened) closeDetail(mapping);
    }
  }

  // ---------- profiles ----------
  // Clicking a person in X Pro opens their profile as a stack in that
  // column (verified 2026-09-28): UserByScreenName, then their posts. The
  // stack holds X’s own buttons: “{userId}-follow” or “-unfollow”,
  // “userActions” (the More menu), and the Posts, Replies and Media tabs.

  function hrefHandle(a) {
    const m = /^(?:https:\/\/(?:x|twitter)\.com)?\/([A-Za-z0-9_]{1,15})\/?$/.exec(a.getAttribute('href') || '');
    return m ? m[1].toLowerCase() : null;
  }

  // The person’s name block in an open profile stack, and the stack itself
  // (the nearest ancestor holding a Close stack button).
  // Exact handle match (a name can contain “@other”; one handle can be the
  // start of another), and never inside a delegated column.
  function profileName(h) {
    const re = new RegExp('@' + String(h).replace(/[^A-Za-z0-9_]/g, '') + '(?![A-Za-z0-9_])', 'i');
    return Array.from(document.querySelectorAll('[data-testid="UserName"]')).find((n) => re.test(n.textContent || '') && allowed(n)) || null;
  }

  function profileStack(h) {
    let box = profileName(h);
    for (let i = 0; i < 30 && box; i++) {
      if (box.querySelector && box.querySelector('[data-testid="action-icon_Close stack"]')) return box;
      box = box.parentElement;
    }
    return null;
  }

  async function openProfile(o) {
    const h = String(o.handle).toLowerCase();
    if (profileName(h)) return { ok: true, already: true };
    const pick = (root) => {
      const links = Array.from(root.querySelectorAll('a[href]')).filter((a) => hrefHandle(a) === h && allowed(a));
      return links.find((a) => a.closest('[data-testid="Tweet-User-Avatar"]')) || links[0] || null;
    };
    let link = null;
    if (o.postId) {
      const r = await reveal(o.postId, o.mapping, o.hint);
      if (r) {
        link = pick(r.art);
        if (!link) r.restore();
      }
    }
    // A notification or a quote: any link to them in the column.
    const scope = scopeOf(o.mapping);
    if (scope === false) return { ok: false, reason: 'delegated' };
    if (!link && scope) link = pick(scope);
    if (!link) link = pick(document);
    if (!link) return { ok: false, reason: 'notfound' };
    link.click();
    const name = await waitFor(() => profileName(h), 6000);
    return name ? { ok: true } : { ok: false, reason: 'noprofile' };
  }

  // `levels`: the profiles Sweeter pushed; with a conversation below them,
  // only those come off.
  function closeProfile(h, mapping, keepBelow, levels) {
    if (mapping && mapping.id && columnWrap(mapping.id) && stackButton(columnWrap(mapping.id))) {
      popStack(mapping, keepBelow ? levels || 1 : true);
      return true;
    }
    const stack = profileStack(String(h).toLowerCase());
    const b = stack && stack.querySelector('[data-testid="action-icon_Close stack"]');
    if (b) {
      pressClose(b);
      return true;
    }
    return closeDetail(mapping);
  }

  // Follow or unfollow with X Pro’s own button; X asks to confirm an
  // unfollow, and the reader already did in Sweeter.
  async function setFollowing(userId, want) {
    const sel = (s) => Array.from(document.querySelectorAll('[data-testid="' + userId + '-' + s + '"]')).find(allowed) || null;
    const btn = sel(want ? 'follow' : 'unfollow');
    if (!btn) return sel(want ? 'unfollow' : 'follow') ? { ok: true, already: true } : { ok: false, reason: 'nobutton' };
    btn.click();
    if (!want) {
      const c = await waitFor(() => document.querySelector('[data-testid="confirmationSheetConfirm"]'), 2500);
      if (c) c.click();
    }
    // A protected account answers with a pending request instead.
    const done = await waitFor(() => sel(want ? 'unfollow' : 'follow') || (want && sel('cancel')), 5000);
    return { ok: !!done };
  }

  async function openProfileMenu(h) {
    const stack = profileStack(h);
    const more = stack && stack.querySelector('[data-testid="userActions"]');
    if (!more) return null;
    more.click();
    const menu = await waitFor(() => document.querySelector('[role="menu"]'), 2500);
    return menu ? { menu, more } : null;
  }

  // X Pro’s menus ignore a synthetic Escape (verified 2026-09-28); pressing
  // the button that opened one again closes it.
  async function closeMenu(more) {
    if (!document.querySelector('[role="menu"]')) return;
    more.click();
    await waitFor(() => !document.querySelector('[role="menu"]'), 1000);
  }

  // The More menu’s items as X Pro shows them right now (so Mute becomes
  // Unmute after a mute), then the menu closes again.
  async function readProfileMenu(handle) {
    const h = String(handle).toLowerCase();
    const open = await openProfileMenu(h);
    if (!open) return null;
    const items = Array.from(open.menu.querySelectorAll('[role="menuitem"]')).map((m) => ({ text: (m.textContent || '').trim(), testid: m.getAttribute('data-testid') || '' }));
    await closeMenu(open.more);
    return items;
  }

  // Picks one item by its text (any letter case). `confirm`: press X’s confirmation too
  // (the reader confirmed in Sweeter). Returns once the menu item was pressed.
  async function profileAction(handle, text, confirm) {
    const h = String(handle).toLowerCase();
    const open = await openProfileMenu(h);
    if (!open) return { ok: false, reason: 'nomenu' };
    const want = text.toLowerCase();
    const item = Array.from(open.menu.querySelectorAll('[role="menuitem"]')).find((m) => (m.textContent || '').trim().toLowerCase() === want);
    if (!item) {
      await closeMenu(open.more);
      return { ok: false, reason: 'nobutton' };
    }
    item.click();
    if (confirm) {
      const c = await waitFor(() => document.querySelector('[data-testid="confirmationSheetConfirm"]'), 2500);
      if (!c) return { ok: false, reason: 'noconfirm' };
      c.click();
    }
    return { ok: true };
  }

  // Posts, Replies or Media: X Pro loads the tab when it is chosen.
  function profileTab(handle, label) {
    const stack = profileStack(String(handle).toLowerCase());
    const tab = stack && Array.from(stack.querySelectorAll('[role="tab"]')).find((t) => (t.textContent || '').trim() === label);
    if (!tab) return false;
    tab.click();
    return true;
  }

  function dialogOpen() {
    return !!document.querySelector('[role="dialog"]');
  }

  // ---------- column management (Release 1) ----------
  // Verified on a throwaway deck, 2026-09-30.
  // Each function is one person’s command and presses X Pro’s own controls.

  // X Pro’s links point at x.com. X Pro handles its own clicks, but if it
  // ever did not, a programmatic click would leave X Pro: stop it then.
  function pressLink(a) {
    const guard = (e) => {
      if (!e.defaultPrevented) e.preventDefault();
    };
    window.addEventListener('click', guard, { once: true });
    try {
      a.click();
    } finally {
      setTimeout(() => window.removeEventListener('click', guard), 0);
    }
  }

  function headerReady(w) {
    return !!(w && w.querySelector('[aria-label^="Open column options - "]') && !w.querySelector('[aria-label="Delete column - Column Picker"]'));
  }

  // A placeholder column from the trailing “Add column” tile (it lands at
  // the end of the deck). Returns its wrapper id.
  async function newPicker() {
    const before = new Set(wrappers().map((w) => w.id));
    const tile = document.querySelector('a[aria-label="Add column"][href="/i/columns/picker"]');
    if (!tile) return null;
    pressLink(tile);
    const p = await waitFor(() => wrappers().find((w) => !before.has(w.id) && w.picker), 5000);
    return p ? p.id : null;
  }

  // Removes a placeholder column Sweeter made, and only while it is one.
  function removePicker(id) {
    const w = columnWrap(id);
    const b = w && w.querySelector('[aria-label="Delete column - Column Picker"]');
    if (!b) return false;
    b.click();
    return true;
  }

  // Home (X Pro picks Following) or Notifications (All), at the end.
  async function addColumn(kind) {
    const href = { home: 'https://x.com/home', notifications: 'https://x.com/notifications' }[kind];
    if (!href) return { ok: false, reason: 'kind' };
    const id = await newPicker();
    if (!id) return { ok: false, reason: 'nopicker' };
    const row = columnWrap(id) && columnWrap(id).querySelector('a[role="menuitem"][href="' + href + '"]');
    if (!row) {
      removePicker(id);
      return { ok: false, reason: 'norow' };
    }
    pressLink(row);
    const done = await waitFor(() => headerReady(columnWrap(id)), 6000);
    return done ? { ok: true, id } : { ok: false, reason: 'nochange', pickerId: id };
  }

  // Lists: the picker’s list step shows the person’s lists by name.
  const listName = (cell) => (cell.textContent || '').split('·')[0].trim();
  async function openListPicker() {
    const id = await newPicker();
    if (!id) return { ok: false, reason: 'nopicker' };
    const row = columnWrap(id) && columnWrap(id).querySelector('a[role="menuitem"][href="/i/columns/picker/list"]');
    if (!row) {
      removePicker(id);
      return { ok: false, reason: 'norow' };
    }
    pressLink(row);
    const cells = await waitFor(() => {
      const w = columnWrap(id);
      const c = w ? Array.from(w.querySelectorAll('[data-testid="listCell"]')) : [];
      return c.length ? c : null;
    }, 6000);
    return { ok: true, pickerId: id, names: cells ? cells.map(listName) : [] };
  }

  async function chooseList(pickerId, name) {
    const w = columnWrap(pickerId);
    const cells = w ? Array.from(w.querySelectorAll('[data-testid="listCell"]')).filter((c) => listName(c) === name) : [];
    if (cells.length !== 1) return { ok: false, reason: cells.length ? 'ambiguous' : 'nolist' };
    cells[0].click();
    const done = await waitFor(() => headerReady(columnWrap(pickerId)), 6000);
    return done ? { ok: true, id: pickerId } : { ok: false, reason: 'nochange' };
  }

  // A search column from the sidebar’s Search field (a contenteditable
  // textbox, filled by a paste). Enter with no suggestion selected searches.
  async function addSearch(q) {
    const before = new Set(wrappers().map((w) => w.id));
    const open = () => document.querySelector('form[role="search"] [role="textbox"][aria-label="Search query"]');
    if (!open()) {
      const b = document.querySelector('button[aria-label="Search"], [role="button"][aria-label="Search"]');
      if (!b) return { ok: false, reason: 'nosearch' };
      b.click();
    }
    const box = await waitFor(open, 3000);
    if (!box) return { ok: false, reason: 'nosearch' };
    box.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', q);
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    const typed = await waitFor(() => (open() && open().innerText.trim() === q ? open() : null), 2500);
    if (!typed || document.querySelector('[role="option"][aria-selected="true"]')) return { ok: false, reason: 'notyped' };
    typed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    const w = await waitFor(() => wrappers().find((x) => !before.has(x.id) && !x.picker), 6000);
    return w ? { ok: true, id: w.id } : { ok: false, reason: 'nochange' };
  }

  // Mentions or For you: X Pro has no picker row for them. Its tab opens
  // a stack in the column; “Create separate column” makes it a column of
  // its own (next to this one); then the stack is closed again.
  async function addFromTab(mapping, tab) {
    const w = mapping && mapping.id ? columnWrap(mapping.id) : null;
    if (!w || isDelegated(w) || !headerReady(w)) return { ok: false, reason: 'nobase' };
    const link = Array.from(w.querySelectorAll('a[role="tab"]')).find((a) => (a.textContent || '').trim() === tab);
    if (!link) return { ok: false, reason: 'notab' };
    const before = new Set(wrappers().map((x) => x.id));
    pressLink(link);
    const sep = await waitFor(() => {
      const i = columnWrap(mapping.id) && columnWrap(mapping.id).querySelector('[data-testid="action-icon_Create separate column"]');
      return i ? i.closest('button,[role="button"]') || i : null;
    }, 4000);
    if (!sep) {
      await popStack(mapping, true);
      return { ok: false, reason: 'nostack' };
    }
    sep.click();
    const added = await waitFor(() => wrappers().find((x) => !before.has(x.id) && !x.picker), 6000);
    await popStack(mapping, true);
    return added ? { ok: true, id: added.id } : { ok: false, reason: 'nochange' };
  }

  // Removal: the column’s options drawer, then its “Delete column” button.
  // X Pro shows its own undo toast and commits RemoveColumn about 6 s later.
  async function removeColumn(id) {
    const w = columnWrap(id);
    if (!w) return { ok: false, reason: 'gone' };
    const del = () => Array.from((columnWrap(id) || w).querySelectorAll('button,[role="button"]')).find((b) => (b.textContent || '').trim() === 'Delete column');
    let opened = false;
    if (!del()) {
      const o = w.querySelector('[aria-label^="Open column options - "]');
      if (!o) return { ok: false, reason: 'nooptions' };
      (o.closest('button,[role="button"]') || o).click();
      opened = true;
    }
    const b = await waitFor(del, 3000);
    if (!b) {
      // Leave the column as it was: close the drawer Sweeter opened.
      const c = opened && (columnWrap(id) || w).querySelector('[aria-label^="Close column options - "]');
      if (c) (c.closest('button,[role="button"]') || c).click();
      return { ok: false, reason: 'nodelete', opened };
    }
    b.click();
    return { ok: true };
  }

  // ---------- Release 2 (verified on a throwaway deck, 2026-09-30) ----------

  const press = (el) => (el.closest('button,[role="button"]') || el).click();
  const optionsOf = (w) => w && w.querySelector('[aria-label^="Open column options - "], [aria-label^="Close column options - "]');
  // The drawer shows its own tabs (Options, and Search on a search column).
  // On its Search tab the header button reads “Open column options” again
  // (verified 2026-10-01), so the tabs are what say it is open.
  const drawerTab = (w) => w && Array.from(w.querySelectorAll('a[role="tab"]')).find((t) => t.textContent.trim() === 'Options' && t.offsetParent);
  const drawerOpen = (id) => {
    const w = columnWrap(id);
    const o = optionsOf(w);
    return (!!o && /^Close/.test(o.getAttribute('aria-label'))) || !!drawerTab(w);
  };
  // 'opened' when Sweeter opened it (and so closes it), 'was' when it
  // was open already, null when it would not open.
  async function openDrawer(id) {
    if (drawerOpen(id)) return 'was';
    const o = optionsOf(columnWrap(id));
    if (!o) return null;
    press(o);
    return (await waitFor(() => drawerOpen(id), 2500)) ? 'opened' : null;
  }
  function closeDrawer(id) {
    const w = columnWrap(id);
    const o = optionsOf(w);
    if (o && /^Close/.test(o.getAttribute('aria-label'))) return press(o);
    // The drawer’s own Close button (the header one may not say Close).
    const c = drawerTab(w) && Array.from(w.querySelectorAll('button')).find((b) => b.offsetParent && b.textContent.trim() === 'Close');
    if (c) c.click();
  }

  // Move a column: X Pro’s drag handle takes Space, arrows, Space (its
  // keyboard sensor reads keyCode and does not check isTrusted). X Pro
  // sends ReorderColumns itself on the drop. These keys go only to that
  // handle, because the person asked to move the column.
  async function moveColumn(id, delta) {
    const w = columnWrap(id);
    const h = w && w.querySelector('[aria-label^="Reorder column - "]');
    if (!h || !delta) return { ok: false, reason: 'nohandle' };
    if (isDelegated(w)) return { ok: false, reason: 'delegated' };
    const order = () => wrappers().map((x) => x.id).join('|');
    const before = order();
    // X Pro’s sensor reads keyCode in the page’s own script world, which
    // this content script cannot reach; the recorder (in that world) sends
    // the keys for it (recorder.js, sweeterKeys).
    const keys = [[32, ' ']];
    for (let i = 0; i < Math.abs(delta); i++) keys.push(delta > 0 ? [39, 'ArrowRight'] : [37, 'ArrowLeft']);
    keys.push([32, ' ']);
    const t0 = Date.now();
    window.postMessage({ __sweeterKeys: 1, column: id, keys }, location.origin);
    const moved = await waitFor(() => order() !== before, 1500 + keys.length * 160);
    // X Pro's order changes at the first arrow, but the rest of the keys and
    // the drop still follow, 150 ms apart (recorder.js). Return only after
    // they have all gone out: the caller's lift (X Pro visible, so the
    // handle keeps focus) must cover the whole drag.
    const rest = keys.length * 150 + 100 - (Date.now() - t0);
    if (rest > 0) await wait(rest);
    if (!moved) {
      window.postMessage({ __sweeterKeys: 1, column: id, keys: [[27, 'Escape']] }, location.origin); // cancel a drag X Pro did not finish
      return { ok: false, reason: 'nomove' };
    }
    return { ok: true };
  }

  // A stack (a profile or a conversation) becomes a column of its own,
  // next to this one; X Pro closes that stack level.
  async function stackToColumn(w) {
    const i = w && w.querySelector('[data-testid="action-icon_Create separate column"]');
    if (!i || isDelegated(w)) return { ok: false, reason: i ? 'delegated' : 'nostack' };
    const before = new Set(wrappers().map((x) => x.id));
    press(i);
    const added = await waitFor(() => wrappers().find((x) => !before.has(x.id) && !x.picker), 6000);
    return added ? { ok: true, id: added.id } : { ok: false, reason: 'nochange' };
  }
  // Only when the top of that column’s stack is the conversation Sweeter
  // shows; any levels below it are closed after.
  async function conversationToColumn(mapping, postId) {
    const w = scopeOf(mapping) || null;
    const id = String(postId || '');
    if (!w || !id || !(focalArticle(id, w) || findArticle(id, w))) return { ok: false, reason: 'nostack' };
    const r = await stackToColumn(w);
    if (r.ok) await popStack(mapping, true);
    return r;
  }
  function profileToColumn(h) {
    const box = profileStack(String(h).toLowerCase());
    return stackToColumn(box ? wrapOf(box) : null);
  }

  // Rename in X Pro: the drawer’s Rename switch, then its name field
  // (textarea[name=columnName], 25 characters). X Pro saves as it is typed.
  // X’s server keeps the last title when Rename is switched off, so an
  // empty name writes `fallback` (the column’s usual name) when there is one.
  async function renameColumn(id, title, fallback) {
    if (isDelegated(columnWrap(id))) return { ok: false, reason: 'delegated' };
    const opened = await openDrawer(id);
    if (!opened) return { ok: false, reason: 'nooptions' };
    try {
      const w = () => columnWrap(id);
      const sw = w() && w().querySelector('input[role="switch"][aria-label="Rename column"]');
      if (!sw) return { ok: false, reason: 'norename' };
      const want = String(title || fallback || '').trim().slice(0, 25);
      if (!want) {
        if (sw.checked) sw.click();
        await wait(1500);
        return { ok: true };
      }
      const wasOn = sw.checked;
      if (!wasOn) sw.click();
      const box = await waitFor(() => w() && w().querySelector('textarea[name="columnName"]'), 2000);
      if (!box) {
        if (!wasOn && sw.checked) sw.click(); // put the switch back
        return { ok: false, reason: 'nofield' };
      }
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      box.focus();
      set.call(box, want);
      box.dispatchEvent(new Event('input', { bubbles: true }));
      const t = await waitFor(() => {
        const tw = w() && w().querySelector('[data-testid="column-title-wrapper"]');
        return tw && tw.textContent.trim() === want;
      }, 3000);
      await wait(2500); // X Pro saved within about 2 s of typing (probe W7)
      return t ? { ok: true } : { ok: false, reason: 'nochange' };
    } finally {
      if (opened === 'opened') closeDrawer(id);
    }
  }

  // ---------- Release 3 (verified on throwaway decks, 2026-10-01) ----------

  const drawerButton = (id, test) => {
    const w = columnWrap(id);
    return w ? Array.from(w.querySelectorAll('button,[role="button"]')).find((b) => b.offsetParent && test(b)) || null : null;
  };

  // Make a copy: the drawer’s “Make a copy” (CreateColumn right after this
  // one). X Pro opens the copy’s drawer too; both are closed after.
  async function makeCopy(id) {
    if (isDelegated(columnWrap(id))) return { ok: false, reason: 'delegated' };
    const opened = await openDrawer(id);
    if (!opened) return { ok: false, reason: 'nooptions' };
    const b = await waitFor(() => drawerButton(id, (x) => x.getAttribute('aria-label') === 'Make a copy'), 1500);
    if (!b) {
      if (opened === 'opened') closeDrawer(id);
      return { ok: false, reason: 'nocopy' };
    }
    const before = new Set(wrappers().map((w) => w.id));
    b.click();
    const added = await waitFor(() => wrappers().find((w) => !before.has(w.id) && !w.picker), 6000);
    if (added) {
      await waitFor(() => drawerOpen(added.id), 1500);
      closeDrawer(added.id);
    }
    if (opened === 'opened') closeDrawer(id);
    return added ? { ok: true, id: added.id } : { ok: false, reason: 'nochange' };
  }

  // Convert to search: the DRAWER’s “Search posts” (its text says
  // “Convert…”; the header button of the same name does the same, so only
  // the drawer one is pressed). X Pro then shows a toast with Change back.
  async function convertToSearch(id) {
    if (isDelegated(columnWrap(id))) return { ok: false, reason: 'delegated' };
    const opened = await openDrawer(id);
    if (!opened) return { ok: false, reason: 'nooptions' };
    const b = await waitFor(() => drawerButton(id, (x) => x.getAttribute('aria-label') === 'Search posts' && /Convert/.test(x.textContent || '')), 1500);
    if (!b) {
      if (opened === 'opened') closeDrawer(id);
      return { ok: false, reason: 'noconvert' };
    }
    b.click();
    const t = await waitFor(() => Array.from(document.querySelectorAll('[data-testid="toast"]')).find((x) => /Converted/.test(x.textContent || '')), 3000);
    if (opened === 'opened') closeDrawer(id);
    return t ? { ok: true } : { ok: false, reason: 'nochange' };
  }
  // X Pro’s own “Change back”, only while its toast is on screen.
  function changeBack() {
    const t = Array.from(document.querySelectorAll('[data-testid="toast"]')).find((x) => /Converted/.test(x.textContent || ''));
    const b = t && Array.from(t.querySelectorAll('button,[role="button"]')).find((x) => (x.textContent || '').trim() === 'Change back');
    if (!b) return false;
    b.click();
    return true;
  }

  // Move to another deck: the drawer’s Move, then the deck’s button in X
  // Pro’s “Move column to Deck” dialog (its text is the deck’s emoji and
  // title). X Pro makes the column anew there, removes this one, and shows
  // that deck on every device.
  async function moveToDeck(id, label) {
    if (isDelegated(columnWrap(id))) return { ok: false, reason: 'delegated' };
    const opened = await openDrawer(id);
    if (!opened) return { ok: false, reason: 'nooptions' };
    const tab = Array.from(columnWrap(id).querySelectorAll('a[role="tab"]')).find((t) => t.getAttribute('aria-label') === 'Move');
    if (!tab) {
      if (opened === 'opened') closeDrawer(id);
      return { ok: false, reason: 'nomove' };
    }
    tab.click();
    const dlg = await waitFor(() => Array.from(document.querySelectorAll('[role="dialog"]')).find((d) => /Move column to Deck/.test(d.textContent || '')), 3000);
    const rows = dlg ? Array.from(dlg.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === label) : [];
    if (rows.length !== 1) {
      const close = dlg && dlg.querySelector('[data-testid="app-bar-close"]');
      if (close) close.click();
      if (opened === 'opened') closeDrawer(id);
      return { ok: false, reason: rows.length ? 'ambiguous' : 'nodeck' };
    }
    const path = location.pathname;
    rows[0].click();
    const moved = await waitFor(() => location.pathname !== path || !columnWrap(id), 6000);
    return moved ? { ok: true } : { ok: false, reason: 'nochange' };
  }

  // Report List: X Pro’s own dialog, handed over to the person.
  async function openReportList(id) {
    if (isDelegated(columnWrap(id))) return { ok: false, reason: 'delegated' };
    const opened = await openDrawer(id);
    if (!opened) return { ok: false, reason: 'nooptions' };
    const b = await waitFor(() => drawerButton(id, (x) => (x.textContent || '').trim() === 'Report List'), 1500);
    if (!b) {
      if (opened === 'opened') closeDrawer(id);
      return { ok: false, reason: 'noreport' };
    }
    b.click();
    return { ok: true, opened };
  }

  // Bookmarks: the picker’s Bookmarked posts row, then All Bookmarks
  // (writes /i/bookmarks/all; folders are a later step).
  async function addBookmarks() {
    const id = await newPicker();
    if (!id) return { ok: false, reason: 'nopicker' };
    const row = columnWrap(id) && columnWrap(id).querySelector('a[role="menuitem"][href="/i/columns/picker/bookmarks"]');
    if (!row) {
      removePicker(id);
      return { ok: false, reason: 'norow' };
    }
    pressLink(row);
    const all = await waitFor(() => columnWrap(id) && columnWrap(id).querySelector('a[href="https://x.com/i/bookmarks/all"]'), 5000);
    if (!all) return { ok: false, reason: 'nochange', pickerId: id };
    pressLink(all);
    const done = await waitFor(() => headerReady(columnWrap(id)), 6000);
    return done ? { ok: true, id } : { ok: false, reason: 'nochange', pickerId: id };
  }

  const canClear = (m) => !!(m && m.id && columnWrap(m.id) && columnWrap(m.id).querySelector('button[aria-label="Clear posts"]'));

  // Clear in X Pro: the header’s own “Clear posts” (on every device).
  function clearInXPro(id) {
    const w = columnWrap(id);
    const b = w && w.querySelector('button[aria-label="Clear posts"]');
    if (!b || isDelegated(w)) return { ok: false, reason: b ? 'delegated' : 'noclear' };
    b.click();
    return { ok: true };
  }
  // Undo it: the drawer’s “Show latest posts”, there only while cleared.
  async function showLatestInXPro(id) {
    const opened = await openDrawer(id);
    if (!opened) return { ok: false, reason: 'nooptions' };
    try {
      const b = await waitFor(() => columnWrap(id) && columnWrap(id).querySelector('button[aria-label="Show latest posts"]'), 1500);
      if (!b) return { ok: false, reason: 'notcleared' };
      b.click();
      await wait(500);
      return { ok: true };
    } finally {
      if (opened === 'opened') closeDrawer(id);
    }
  }

  // Edit Search: the drawer’s Search tab. The person edits it in X Pro.
  async function openSearchEditor(id) {
    if (!(await openDrawer(id))) return { ok: false, reason: 'nooptions' };
    const tab = Array.from(columnWrap(id).querySelectorAll('a[role="tab"]')).find((t) => t.textContent.trim() === 'Search');
    if (!tab) {
      closeDrawer(id);
      return { ok: false, reason: 'nosearch' };
    }
    tab.click();
    return { ok: true };
  }

  // Paste over all of a Draft.js field’s text. Draft keeps its own
  // selection, takes a new one only from a select event, and ignores that
  // event until the render its focus handler asked for has run. So: focus,
  // a moment, select, a moment, paste (verified live 2026-10-05; a paste
  // straight after the select went beside the old text).
  async function pasteOver(box, text) {
    box.focus();
    await wait(50);
    window.getSelection().selectAllChildren(box);
    document.dispatchEvent(new Event('selectionchange'));
    await wait(50);
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }

  // Change a search column’s query: the drawer’s Search tab holds X Pro’s
  // own “Search query” field (Draft.js, like the sidebar’s). Its text is
  // replaced by a paste, and Enter searches, as a person does it. X Pro
  // also saves the field by itself about 2 s after any change (verified
  // 2026-10-05), so a text that came out wrong is put back to the old query
  // rather than left to be saved. The caller checks that X Pro saved the
  // new one (UpdateColumn in the deck model); if not, the drawer stays open
  // for the person to finish.
  async function editSearch(id, q) {
    if (isDelegated(columnWrap(id))) return { ok: false, reason: 'delegated' };
    const opened = await openDrawer(id);
    if (!opened) return { ok: false, reason: 'nooptions' };
    const tab = Array.from(columnWrap(id).querySelectorAll('a[role="tab"]')).find((t) => t.textContent.trim() === 'Search');
    if (!tab) {
      if (opened === 'opened') closeDrawer(id);
      return { ok: false, reason: 'nosearch' };
    }
    tab.click();
    const field = () => (columnWrap(id) && columnWrap(id).querySelector('[role="textbox"][aria-label="Search query"]')) || null;
    const box = await waitFor(field, 2500);
    if (!box) return { ok: false, reason: 'nosearch', opened };
    const before = box.innerText.trim();
    // Draft showed the pasted text within 300 ms (verified 2026-10-05), so
    // each check is short: two misses and the restore all land within
    // about 1 s, before X Pro’s own save of the wrong text.
    const put = async (text) => {
      for (let i = 0; i < 2; i++) {
        if (!field()) return null;
        await pasteOver(field(), text);
        const b = await waitFor(() => (field() && field().innerText.trim() === text ? field() : null), 300);
        if (b) return b;
      }
      return null;
    };
    const typed = await put(q);
    if (!typed) {
      if (before) await put(before);
      return { ok: false, reason: 'notyped', opened };
    }
    // With a suggestion selected, Enter would take the suggestion; X Pro’s
    // own save still comes, so the caller waits for it either way.
    if (!document.querySelector('[role="option"][aria-selected="true"]')) typed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    return { ok: true, opened };
  }

  // Decks. Switching presses the nav’s deck button, matched by its exact
  // label; two pinned decks with one name are not guessed between.
  function switchDeck(title) {
    const want = 'Unselected Deck ' + title;
    const bs = Array.from(document.querySelectorAll('[aria-label^="Unselected Deck "]')).filter((b) => b.getAttribute('aria-label') === want);
    if (bs.length !== 1) return { ok: false, reason: bs.length ? 'ambiguous' : 'nodeck' };
    press(bs[0]);
    return { ok: true };
  }
  function deckLink(label) {
    const a = document.querySelector('a[aria-label="' + label + '"]');
    if (!a) return false;
    pressLink(a);
    return true;
  }
  const deckDialogOpen = () => !!(document.querySelector('[role="dialog"]') || document.querySelector('input[name="deckTitle"]') || /\/i\/decks\/(new|manage|\d+\/edit)/.test(location.pathname));

  function undoRemove() {
    const t = document.querySelector('[data-testid="undoDeleteToast"]');
    const b = t && Array.from(t.querySelectorAll('button,[role="button"]')).find((x) => (x.textContent || '').trim() === 'Undo');
    if (!b) return false;
    b.click();
    return true;
  }

  // Stacks: “Go back in stack” while deeper than one level, “Close stack”
  // at the last one. One level, `all` of them, or a number of levels.
  function stackButton(w) {
    const i = w && (w.querySelector('[data-testid="action-icon_Go back in stack"]') || w.querySelector('[data-testid="action-icon_Close stack"]'));
    return i ? i.closest('button,[role="button"]') || i : null;
  }
  async function popStack(mapping, all) {
    const at = () => (mapping && mapping.id ? columnWrap(mapping.id) : null) || wrapOf(mapping && mapping.dom && mapping.dom.el);
    let popped = false;
    const n = typeof all === 'number' ? Math.max(1, Math.min(8, all)) : all ? 8 : 1;
    for (let i = 0; i < n; i++) {
      const b = stackButton(at());
      if (!b) break;
      b.click();
      popped = true;
      await waitFor(() => stackButton(at()) !== b, 1500);
    }
    return popped;
  }

  // The test ID sits on the button’s <svg> icon, and an SVG element has no
  // click() method (verified): press the button around it.
  function pressClose(icon) {
    const btn = icon.closest('[role="button"], button');
    if (btn) btn.click();
    else icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  // X Pro replaces the column’s element when it opens a stack, so the one
  // Sweeter holds may be detached: fall back to the only open stack, then to
  // the column at the same position.
  function closeDetail(mapping) {
    if (mapping && mapping.id && columnWrap(mapping.id) && stackButton(columnWrap(mapping.id))) {
      popStack(mapping, true);
      return true;
    }
    // Upward from a column element, but never past its own wrapper.
    const from = (el) => {
      const top = wrapOf(el);
      let box = el;
      for (let i = 0; i < 12 && box; i++) {
        const b = box.querySelector && box.querySelector('[data-testid="action-icon_Close stack"]');
        if (b && allowed(b)) {
          pressClose(b);
          return true;
        }
        if (box === top) break;
        box = box.parentElement;
      }
      return false;
    };
    // The column is on the page and shows no stack: nothing to close.
    const wrap = mapping && mapping.id ? columnWrap(mapping.id) : null;
    if (wrap) return from(wrap.querySelector('[data-testid="multi-column-layout-column-content"]') || wrap);
    const dom = mapping && mapping.dom;
    if (dom && dom.el.isConnected && from(dom.el)) return true;
    const open = Array.from(document.querySelectorAll('[data-testid="action-icon_Close stack"]')).filter(allowed);
    if (open.length === 1) {
      pressClose(open[0]);
      return true;
    }
    const col = dom && typeof dom.idx === 'number' ? domColumns()[dom.idx] : null;
    return !!(col && from(col.el));
  }

  // While Sweeter covers X Pro, X Pro's page is visibility:hidden (app.js).
  // Focus, selections and innerText need it visible, so the few actions
  // that type into X Pro lift it for their duration (and a moment more for
  // keys sent after they return). Nested calls share one lift.
  let acting = 0;
  async function awake(fn, linger) {
    if (acting++ === 0) document.documentElement.classList.add('sweeter-acting');
    try {
      return await fn();
    } finally {
      setTimeout(() => {
        if (--acting === 0) document.documentElement.classList.remove('sweeter-acting');
      }, linger || 0);
    }
  }
  const lifted = (fn, linger) => (...args) => awake(() => fn(...args), linger);

  Sweeter.xpro = { makeCopy, convertToSearch, changeBack, moveToDeck, openReportList, addBookmarks, canClear, moveColumn: lifted(moveColumn, 300), stackToColumn, conversationToColumn, profileToColumn, renameColumn: lifted(renameColumn), clearInXPro, showLatestInXPro, openSearchEditor, editSearch: lifted(editSearch), drawerOpen: (id) => drawerOpen(id), closeDrawer, switchDeck, newDeck: () => deckLink('New Deck'), editDeck: () => deckLink('Edit Deck'), manageDecks: () => deckLink('Manage Decks'), deckDialogOpen, addColumn, openListPicker, chooseList, removePicker, addSearch: lifted(addSearch), addFromTab, removeColumn, undoRemove, popStack, wrappers, columnWrap, delegated: (mapping) => scopeOf(mapping) === false, viewerHandle, openProfile, closeProfile, setFollowing, readProfileMenu, profileAction, profileTab, dialogOpen, openDetail, closeDetail, order, loadOlder, viewer, domColumns, findArticle, setLiked, setReposted, setBookmarked, openComposer: lifted(openComposer), composerOpen, gifSearchOnce, gifClose, fillAndPost: lifted(fillAndPost), prefill: lifted(prefill), clearEditor: lifted(clearEditor), closePanel };
})(typeof globalThis !== 'undefined' ? globalThis : this);
