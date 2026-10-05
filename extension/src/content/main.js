// Content script entry (isolated world, document_start). Receives the
// recorder’s messages, keeps the store, and mounts the overlay once the
// page has a body.
(function () {
  'use strict';
  // Only X Pro’s own page, never a pop-out window Sweeter writes into: once
  // written, that page has pro.x.com’s address too, so its name (sweeter-…,
  // from app.js popOut) tells them apart.
  if (!/^pro\.(x|twitter)\.com$/.test(location.hostname) || /^sweeter-/.test(window.name)) return;
  const Sweeter = globalThis.Sweeter;
  const api = globalThis.browser || globalThis.chrome;
  const queue = [];
  // At document_start the page is still loading. Anything else means Safari
  // injected Sweeter into a page that had already fetched its timelines.
  const late = document.readyState !== 'loading';
  let store = null;
  let ui = null;

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__sweeter !== 1) return;
    const m = e.data;
    if (typeof m.op !== 'string' || !m.body || typeof m.body !== 'object') return;
    if (store) store.ingest(m);
    else queue.push(m);
  });


  // Registered now, before X Pro’s scripts run, so Sweeter sees keys first.
  for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, (e) => ui && ui.onWindowKey(e), true);
  }

  function debounce(fn, ms) {
    let t = 0;
    let args = null;
    return function () {
      args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function get(keys) {
    return new Promise((resolve) => {
      try {
        const r = api.storage.local.get(keys, (v) => resolve(v || {}));
        if (r && typeof r.then === 'function') r.then((v) => resolve(v || {}), () => resolve({}));
      } catch (e) {
        resolve({});
      }
    });
  }

  function set(obj) {
    try {
      const r = api.storage.local.set(obj);
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (e) {}
  }

  get(['settings', 'mutes', 'read', 'filters', 'decks']).then((saved) => {
    store = Sweeter.createStore({
      readPositions: saved.read || {},
      onRead: debounce((key, sortIndex, all) => set({ read: all }), 1500),
    });
    // The last deck model stands in until X Pro’s first deck sync arrives.
    store.decks.load(saved.decks);
    store.decks.subscribe(debounce(() => set({ decks: store.decks.snapshot() }), 2000));
    for (const m of queue.splice(0)) store.ingest(m);

    const start = () => {
      ui = Sweeter.ui.mount({
        store,
        xpro: Sweeter.xpro,
        settings: saved.settings || {},
        mutes: saved.mutes || [],
        filters: saved.filters || [],
        save: set,
        late,
        version: (api.runtime && api.runtime.getManifest && api.runtime.getManifest().version) || '',
        native: globalThis.SweeterNative || null,
        // Token details for a clicked contract address, via the background
        // script (Safari). The Mac app answers through its own bridge.
        dex: api.runtime && api.runtime.sendMessage && !globalThis.SweeterNative
          ? (address) => Promise.resolve(api.runtime.sendMessage({ type: 'dex', address })).then((r) => (r && r.ok ? r.body : Promise.reject(new Error('lookup failed'))))
          : null,
        latestRelease: api.runtime && api.runtime.sendMessage && !globalThis.SweeterNative
          ? () => Promise.resolve(api.runtime.sendMessage({ type: 'latestRelease' })).then((r) => (r && r.ok ? r.body : Promise.reject(new Error('no answer'))))
          : null,
        dexLogo: api.runtime && api.runtime.sendMessage && !globalThis.SweeterNative
          ? (url) => Promise.resolve(api.runtime.sendMessage({ type: 'dexLogo', url })).then((r) => (r && r.ok ? r.body : ''))
          : null,
        geckoLogo: api.runtime && api.runtime.sendMessage && !globalThis.SweeterNative
          ? (network, address) => Promise.resolve(api.runtime.sendMessage({ type: 'geckoLogo', network, address })).then((r) => (r && r.ok ? r.body : ''))
          : null,
      });
      // The native Mac app drives these from its menus and global hotkeys.
      Sweeter.native = { compose: ui.compose, toggle: ui.toggle, cmd: ui.cmd, closeTop: ui.closeTop, prefs: ui.prefs };
      if (globalThis.SweeterNative) globalThis.SweeterNative.log('mounted');
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  });
})();
