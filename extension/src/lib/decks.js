// X Pro’s decks and columns, as X Pro itself receives them. The deck sync
// (ViewerAccountSync, verified 2026-09-30) lists every deck and column; X
// Pro’s own column writes (CreateColumn, UpdateColumn, RemoveColumn,
// ReorderColumns, the deck mutations, UpdateClientSettings) change it
// between syncs, and Sweeter applies them from the request X Pro sent.
// Sweeter never sends any of these itself.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  const OPS = new Set(['ViewerAccountSync', 'CreateColumn', 'UpdateColumn', 'RemoveColumn', 'ReorderColumns', 'CreateDeck', 'UpdateDeck', 'RemoveDeck', 'ReorderDecks', 'UpdateClientSettings']);

  // Wire enums are capitalized (“Medium”); keep them lowercase here.
  const lc = (v) => (typeof v === 'string' ? v.toLowerCase() : v || null);

  function column(c) {
    if (!c || !c.rest_id) return null;
    return {
      id: String(c.rest_id),
      pathname: c.pathname || '',
      title: c.title || null, // unset means the route’s own default title
      width: lc(c.width),
      mediaPreview: lc(c.media_preview),
      latest: !!c.latest,
      hideHeader: !!c.hide_header,
      cleared: !!c.show_tweets_after,
      showDrawer: !!c.show_drawer,
      // The account that made the column (X Pro’s own “creator”); another
      // account’s column is never written to.
      creator: typeof c.creator === 'string' && c.creator ? c.creator.toLowerCase() : null,
    };
  }

  function deck(d) {
    if (!d || !d.rest_id) return null;
    const cfg = d.config || {};
    return {
      id: String(d.rest_id),
      title: cfg.title || '',
      icon: cfg.icon || '',
      pinned: !!cfg.is_pinned,
      columns: (d.deck_columns_v2 || []).map(column).filter(Boolean),
    };
  }

  // Columns Sweeter shows only as a placeholder with “Open in X Pro”.
  const PLACEHOLDER = { '/explore': 'explore', '/i/grok': 'grok', '/compose/post/unsent/drafts': 'drafts', '/compose/post/unsent/scheduled': 'scheduled' };
  const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'search', 'settings', 'compose', 'i', 'login', 'logout', 'tos', 'privacy']);

  // The store source key for a column’s route, or null when Sweeter cannot
  // show that column type yet. `has(key)` picks between alternative names;
  // `userId(handle)` names a profile column’s person once X Pro has said who.
  function keyFor(col, has, userId) {
    let u;
    try {
      u = new URL(String(col.pathname || ''), 'https://pro.x.com');
    } catch (e) {
      return null;
    }
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (path === '/home') return u.searchParams.get('mode') === 'home_latest' ? 'home' : 'home-foryou';
    if (path === '/notifications') return 'notifications:all';
    if (path === '/notifications/mentions') return 'mentions';
    if (path === '/notifications/priority' || path === '/notifications/verified') {
      const alt = ['notifications:priority', 'notifications:verified'];
      return (has && alt.find(has)) || alt[0];
    }
    const list = /^\/i\/lists\/(\d+)$/.exec(path);
    if (list) return 'list:' + list[1];
    if (path === '/search') {
      const q = u.searchParams.get('q');
      if (!q) return null;
      // The URL filter names SearchTimeline’s product; no filter is Top.
      const P = { live: 'Latest', user: 'People', media: 'Media', list: 'Lists' };
      return 'search:' + q + ':' + (P[u.searchParams.get('f')] || 'Top');
    }
    if (path === '/i/bookmarks' || path === '/i/bookmarks/all') return 'bookmarks';
    if (PLACEHOLDER[path]) return 'x:' + PLACEHOLDER[path];
    const conv = /^\/[A-Za-z0-9_]{1,15}\/status\/(\d+)$/.exec(path);
    if (conv) return 'conv:' + conv[1];
    const prof = /^\/([A-Za-z0-9_]{1,15})$/.exec(path);
    if (prof && !RESERVED.has(prof[1].toLowerCase())) {
      const id = userId ? userId(prof[1]) : null;
      return id ? 'user:' + id : null;
    }
    return null;
  }

  function createDecks() {
    let state = { active: null, decks: [], synced: 0, viewer: null };
    // The send number of the last write applied to each target, and of the
    // last write at all: a response that returns after a later request’s
    // (or a sync sent before a write) is out of date.
    const lastSeq = new Map();
    let lastWrite = 0;
    const listeners = new Set();
    const emit = () => listeners.forEach((fn) => fn());

    function findColumn(id) {
      for (const d of state.decks) for (const c of d.columns) if (c.id === id) return { deck: d, col: c };
      return null;
    }

    function fromSync(body) {
      const v = body && body.data && body.data.viewer_v2;
      if (!v || !Array.isArray(v.decks)) return false;
      const cfg = v.accountsync_client_config || {};
      const active = cfg.active_deck_id ? String(cfg.active_deck_id) : null;
      const decks = v.decks.map(deck).filter(Boolean);
      // X Pro re-syncs every few minutes; an identical sync changes nothing.
      // (Compared with the current state, so a sync that undoes a local
      // write still counts.)
      if (state.synced && JSON.stringify({ active, decks }) === JSON.stringify({ active: state.active, decks: state.decks })) {
        state.synced = Date.now();
        return false;
      }
      state = { active, decks, synced: Date.now(), viewer: state.viewer };
      return true;
    }

    // One X Pro column write, applied from the variables X Pro sent.
    function apply(op, v, body) {
      if (op === 'ViewerAccountSync') return fromSync(body);
      if (!v) return false;
      switch (op) {
        case 'UpdateColumn': {
          const f = findColumn(String(v.columnId || ''));
          if (!f) return false;
          const c = f.col;
          // X Pro sends the whole column (verified 2026-09-30): a field it
          // leaves out is unset (“Show latest posts” drops showTweetsAfter),
          // except the title, which X’s server keeps when a write leaves it
          // out (switching Rename off came back after a reload, 2026-10-01).
          const full = 'pathname' in v;
          const has = (k) => full || k in v;
          if ('pathname' in v) c.pathname = v.pathname || c.pathname;
          if ('title' in v) c.title = v.title || null;
          if ('width' in v) c.width = lc(v.width);
          if ('mediaPreview' in v) c.mediaPreview = lc(v.mediaPreview);
          if ('latest' in v) c.latest = !!v.latest;
          if (has('hideHeader')) c.hideHeader = !!v.hideHeader;
          if (has('showTweetsAfter')) c.cleared = !!v.showTweetsAfter;
          if ('showDrawer' in v) c.showDrawer = !!v.showDrawer;
          return true;
        }
        case 'RemoveColumn': {
          const f = findColumn(String(v.columnId || ''));
          if (!f) return false;
          f.deck.columns = f.deck.columns.filter((c) => c !== f.col);
          return true;
        }
        case 'ReorderColumns': {
          const d = state.decks.find((x) => x.id === String(v.deckId || ''));
          if (!d || !Array.isArray(v.columnOrder)) return false;
          const at = new Map(v.columnOrder.map((id, i) => [String(id), i]));
          d.columns.sort((a, b) => (at.has(a.id) ? at.get(a.id) : 1e9) - (at.has(b.id) ? at.get(b.id) : 1e9));
          return true;
        }
        case 'CreateColumn': {
          // The new column’s server id is in X Pro’s response when it has one;
          // otherwise the next sync brings it.
          const d = state.decks.find((x) => x.id === String(v.deckId || ''));
          const id = findRestId(body);
          if (!d || !id || findColumn(id)) return false;
          d.columns.push(column({ rest_id: id, pathname: v.pathname, width: v.width, media_preview: v.mediaPreview, latest: v.latest, hide_header: v.hideHeader }));
          return true;
        }
        case 'UpdateClientSettings':
          if (!v.activeDeckId) return false;
          state.active = String(v.activeDeckId);
          return true;
        case 'UpdateDeck': {
          const d = state.decks.find((x) => x.id === String(v.deckId || ''));
          if (!d) return false;
          if ('title' in v) d.title = v.title || d.title;
          if ('icon' in v) d.icon = v.icon || d.icon;
          if ('isPinned' in v) d.pinned = !!v.isPinned;
          return true;
        }
        case 'RemoveDeck': {
          const n = state.decks.length;
          state.decks = state.decks.filter((x) => x.id !== String(v.deckId || ''));
          return state.decks.length !== n;
        }
        case 'ReorderDecks': {
          if (!Array.isArray(v.deckOrder)) return false;
          const at = new Map(v.deckOrder.map((id, i) => [String(id), i]));
          state.decks.sort((a, b) => (at.has(a.id) ? at.get(a.id) : 1e9) - (at.has(b.id) ? at.get(b.id) : 1e9));
          return true;
        }
        case 'CreateDeck': {
          // A new deck starts empty; X Pro’s response carries its id.
          const id = findRestId(body);
          if (!id || state.decks.some((x) => x.id === id)) return false;
          const cfg = v.config || v;
          state.decks.push({ id, title: typeof cfg.title === 'string' ? cfg.title : '', icon: typeof cfg.icon === 'string' ? cfg.icon : '', pinned: !!cfg.isPinned, columns: [] });
          return true;
        }
        default:
          return false;
      }
    }

    // What a write changes, for ordering; creates and removes need none.
    function targetOf(op, v) {
      v = v || {};
      if (op === 'UpdateColumn') return 'c:' + v.columnId;
      if (op === 'ReorderColumns') return 'o:' + v.deckId;
      if (op === 'UpdateDeck') return 'd:' + v.deckId;
      if (op === 'UpdateClientSettings') return 'active';
      if (op === 'ReorderDecks') return 'decks';
      return null;
    }

    function findRestId(body) {
      let found = null;
      (function walk(o, depth) {
        if (found || !o || typeof o !== 'object' || depth > 6) return;
        if (typeof o.rest_id === 'string' && /^\d+$/.test(o.rest_id)) {
          found = o.rest_id;
          return;
        }
        for (const k in o) walk(o[k], depth + 1);
      })(body && body.data, 0);
      return found;
    }

    return {
      // One recorder message. True when the model changed. A response that
      // carries errors changed nothing on X’s side, so it is ignored.
      ingest(msg) {
        if (!msg || !OPS.has(msg.op)) return false;
        if (msg.body && Array.isArray(msg.body.errors) && msg.body.errors.length) return false;
        const seq = typeof msg.seq === 'number' ? msg.seq : 0;
        const target = seq ? targetOf(msg.op, msg.vars) : null;
        if (seq) {
          if (msg.op === 'ViewerAccountSync' ? seq < lastWrite : target && (lastSeq.get(target) || 0) > seq) return false;
        }
        const changed = apply(msg.op, msg.vars, msg.body);
        if (changed && seq && msg.op !== 'ViewerAccountSync') {
          lastWrite = Math.max(lastWrite, seq);
          if (target) lastSeq.set(target, seq);
        }
        if (changed) emit();
        return changed;
      },
      // A saved copy from the last session, used until the first sync.
      load(saved) {
        if (!saved || !Array.isArray(saved.decks) || state.synced) return;
        state = { active: saved.active || null, decks: saved.decks.filter((d) => d && d.id && Array.isArray(d.columns)), synced: 0, viewer: typeof saved.viewer === 'string' ? saved.viewer : null };
        emit();
      },
      snapshot: () => JSON.parse(JSON.stringify({ active: state.active, decks: state.decks, viewer: state.viewer })),
      // The signed-in account the model belongs to (a saved model is one
      // account’s; after an account switch it must not stand in).
      viewer: () => state.viewer,
      setViewer(h) {
        const v = h ? String(h).toLowerCase() : null;
        if (!v || v === state.viewer) return;
        state.viewer = v;
        emit();
      },
      ready: () => state.decks.length > 0,
      synced: () => state.synced,
      decks: () => state.decks,
      activeDeck: () => state.decks.find((d) => d.id === state.active) || null,
      column: (id) => {
        const f = findColumn(String(id));
        return f ? f.col : null;
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  }

  Sweeter.decks = { OPS, keyFor, createDecks };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.decks;
})(typeof globalThis !== 'undefined' ? globalThis : this);
