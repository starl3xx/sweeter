// Runs in X Pro’s own page world at document_start, before X’s code.
//
// It copies the JSON of the timeline responses X Pro already requests and
// hands them to Sweeter’s content script. It never sends a request, never
// changes one, and never reads cookies or storage. X Pro issues its GraphQL
// calls with XMLHttpRequest (verified 2026-09-28); fetch is covered too.
(function () {
  'use strict';
  // Not in a pop-out window Sweeter writes into (named sweeter-…; see main.js).
  if (window.__sweeterRecorder || !/^pro\.(x|twitter)\.com$/.test(location.hostname) || /^sweeter-/.test(window.name)) return;
  window.__sweeterRecorder = true;

  // X moved Bookmarks to a History page (feature switch
  // responsive_web_history_screen_enabled, seen 2026-10-05). X's router then
  // redirects /i/bookmarks/all, an All Bookmarks column's path, to
  // /i/history, which X Pro can't show in a column, so the column loads
  // nothing. Jake chose (2026-10-05) to turn that one switch off in X Pro's
  // page before X Pro reads it: X Pro's router keeps its own Bookmarks
  // screen, and X Pro loads bookmarks with its own request, as it did
  // before. X Pro's HTML assigns the switches in an inline script
  // (window.__INITIAL_STATE__.featureSwitch: defaultConfig and user.config,
  // verified); this sets them as they arrive. Nothing else in it changes.
  const SWITCHES_OFF = ['responsive_web_history_screen_enabled'];
  function switchesOff(st) {
    const fs = st && typeof st === 'object' ? st.featureSwitch : null;
    if (!fs || typeof fs !== 'object') return;
    for (const conf of [fs.defaultConfig, fs.user && fs.user.config]) {
      if (!conf || typeof conf !== 'object') continue;
      for (const k of SWITCHES_OFF) if (conf[k] && typeof conf[k] === 'object') conf[k].value = false;
    }
  }
  try {
    let initialState;
    Object.defineProperty(window, '__INITIAL_STATE__', {
      configurable: true,
      enumerable: true,
      get() {
        return initialState;
      },
      set(v) {
        try {
          switchesOff(v);
        } catch (e) {
          // X's state as it came
        }
        initialState = v;
      },
    });
  } catch (e) {
    // already defined: X Pro keeps its own switches
  }

  // While Sweeter covers X Pro, nobody can click anything in X Pro, so a
  // window X Pro opens then is one nobody asked for: it is not opened.
  // X Pro's router opens a route it can't show in a column with
  // window.open(url, '_blank') (verified 2026-10-05), and since X moved
  // Bookmarks to /i/history (responsive_web_history_screen_enabled), an
  // All Bookmarks column redirects there whenever it loads: every load of a
  // deck with one opened x.com/i/history in the browser. Sweeter's own
  // windows open from its content script, a world this does not touch;
  // with Sweeter hidden (⌥X) or X Pro's composer handed over, X Pro opens
  // windows as before.
  const openWindow = window.open;
  window.open = function () {
    if (document.documentElement.classList.contains('sweeter-cover')) {
      let where = '';
      try {
        const u = new URL(String(arguments[0] || ''), location.href);
        where = u.host + u.pathname;
      } catch (e) {
        where = '?';
      }
      window.postMessage({ __sweeter: 1, op: 'BlockedWindow', body: { where: where.slice(0, 120) } }, '*');
      return null;
    }
    return openWindow.apply(window, arguments);
  };

  const OPS = new Set([
    'HomeLatestTimeline',
    'HomeTimeline',
    'NotificationsTimeline',
    'ListLatestTweetsTimeline',
    'ListByRestId',
    'SearchTimeline',
    'UserTweets',
    'UserTweetsAndReplies',
    'UserMedia',
    'Likes',
    'Bookmarks',
    'TweetDetail',
    // X Pro's answer when the reader posts (CreateTweet, or CreateNoteTweet
    // for a long post): only the new post's id or X's error is passed on,
    // never the text (see trim).
    'CreateTweet',
    'CreateNoteTweet',
    // A profile X Pro opens as a stack (verified 2026-09-28): the person,
    // then their posts.
    'UserByScreenName',
    'UserByRestId',
    'UserOriginalsTimeline',
    // X Pro’s decks and columns: its periodic sync, and the column and deck
    // writes X Pro itself sends (verified 2026-09-30). Read, never sent.
    'ViewerAccountSync',
    'CreateColumn',
    'UpdateColumn',
    'RemoveColumn',
    'ReorderColumns',
    'CreateDeck',
    'UpdateDeck',
    'RemoveDeck',
    'ReorderDecks',
    'UpdateClientSettings',
    // X Pro's GIF search (verified 2026-10-05): trending when its picker
    // opens, then the results for what is typed. Sweeter's own GIF picker
    // shows them; only each GIF's id, text, and GIPHY image is passed on.
    'GifSearch',
    'GifEnumerateCategory',
  ]);

  // The deck sync carries more than Sweeter needs (onboarding state, each
  // column creator’s full record): pass on only the deck model, with the
  // creator’s handle alone.
  const POSTING = new Set(['CreateTweet', 'CreateNoteTweet']);
  const GIFS = new Set(['GifSearch', 'GifEnumerateCategory']);
  function trim(op, json, status) {
    if (GIFS.has(op)) {
      try {
        const d = json.data || {};
        const slice = d.gif_search_slice || d.gif_enumerate_category_slice || {};
        return {
          items: (slice.items || [])
            .slice(0, 60)
            .map((x) => {
              const t = (x.thumbnail_images || [])[0] || x.preview_image || {};
              return { id: String(x.id || ''), alt: String(x.alt_text || '').slice(0, 200), url: String(t.url || ''), still: String(t.still_image_url || ''), w: t.width | 0, h: t.height | 0 };
            })
            .filter((x) => x.id && /^https:\/\/media\d?\.giphy\.com\//.test(x.url) && /^https:\/\/media\d?\.giphy\.com\//.test(x.still)),
        };
      } catch (e) {
        return null;
      }
    }
    if (POSTING.has(op)) {
      const d = (json && json.data) || {};
      const r = d.create_tweet || d.notetweet_create || d.create_note_tweet || null;
      const id = r && r.tweet_results && r.tweet_results.result && r.tweet_results.result.rest_id;
      const err = json && Array.isArray(json.errors) ? json.errors[0] : null;
      return { status: status || 0, id: id ? String(id) : null, error: err ? { code: err.code || null, message: String(err.message || '').slice(0, 300) } : !id && status !== 200 ? { code: null, message: 'HTTP ' + status } : null };
    }
    if (op !== 'ViewerAccountSync') return json;
    try {
      const v = json.data.viewer_v2;
      const cfg = v.accountsync_client_config || {};
      return {
        data: {
          viewer_v2: {
            accountsync_client_config: { active_deck_id: cfg.active_deck_id },
            decks: (v.decks || []).map((d) => ({
              rest_id: d.rest_id,
              config: d.config,
              deck_columns_v2: (d.deck_columns_v2 || []).map((c) => ({
                rest_id: c.rest_id,
                pathname: c.pathname,
                creator: c.creator_ref_results && c.creator_ref_results.result && c.creator_ref_results.result.core ? c.creator_ref_results.result.core.screen_name : undefined,
                title: c.title,
                width: c.width,
                media_preview: c.media_preview,
                latest: c.latest,
                hide_header: c.hide_header,
                show_tweets_after: c.show_tweets_after ? 1 : 0,
                show_drawer: c.show_drawer,
              })),
            })),
          },
        },
      };
    } catch (e) {
      return null;
    }
  }

  function opOf(url) {
    const m = /\/graphql\/[^/]+\/([A-Za-z0-9_]+)/.exec(String(url || ''));
    return m ? m[1] : null;
  }

  function varsOf(url, body) {
    try {
      const q = new URL(url, location.href).searchParams.get('variables');
      if (q) return JSON.parse(q);
    } catch (e) {}
    try {
      if (typeof body === 'string' && body.charAt(0) === '{') return JSON.parse(body).variables || null;
    } catch (e) {}
    return null;
  }

  // Requests are numbered as X Pro sends them: two writes to one column can
  // come back in the other order, and the later request is the one X keeps.
  let sent = 0;

  function emit(op, vars, body, seq, status) {
    body = trim(op, body, status);
    if (!body) return;
    try {
      window.postMessage({ __sweeter: 1, op, vars: vars || {}, body, seq }, location.origin);
    } catch (e) {}
  }

  // Move Left / Right: the content script asks for X Pro’s own keyboard
  // drag on one column’s handle (Space, arrows, Space). X Pro’s sensor reads
  // keyCode in this world, so the keys are made here. Nothing else.
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window || !d || d.__sweeterKeys !== 1 || typeof d.column !== 'string' || !Array.isArray(d.keys) || d.keys.length > 20) return;
    const box = document.querySelector('[data-rfd-droppable-id="deck-columns"]');
    const w = box && box.querySelector('[data-rfd-draggable-id="' + CSS.escape(d.column) + '"]');
    const h = w && w.querySelector('[aria-label^="Reorder column - "]');
    if (!h) return;
    h.focus();
    d.keys.forEach(([code, name], i) => {
      setTimeout(() => {
        const ev = new KeyboardEvent('keydown', { key: name, code: name === ' ' ? 'Space' : name, bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'keyCode', { get: () => code });
        Object.defineProperty(ev, 'which', { get: () => code });
        (document.activeElement || h).dispatchEvent(ev);
        if (i === d.keys.length - 1 && code !== 27) setTimeout(() => h.blur(), 50);
      }, i * 150);
    });
  });

  const XHR = XMLHttpRequest.prototype;
  const open = XHR.open;
  const send = XHR.send;
  XHR.open = function (method, url) {
    try {
      this.__sweeterOp = opOf(url);
      this.__sweeterUrl = url;
    } catch (e) {}
    return open.apply(this, arguments);
  };
  XHR.send = function (body) {
    try {
      const op = this.__sweeterOp;
      if (op && OPS.has(op)) {
        const url = this.__sweeterUrl;
        const seq = ++sent;
        this.addEventListener('load', function () {
          // A post's answer counts even when X refuses it (403 with errors).
          const posting = POSTING.has(op);
          // A refused refresh (429 and the like): only its status, so the
          // column can say why it is stale.
          if (this.status !== 200 && !posting) {
            if (this.status) emit(op, varsOf(url, body), { __status: this.status }, seq);
            return;
          }
          let json = null;
          try {
            if (this.responseType === '' || this.responseType === 'text') json = JSON.parse(this.responseText);
            else if (this.responseType === 'json') json = this.response;
          } catch (e) {}
          try {
            if (json || posting) emit(op, posting ? {} : varsOf(url, body), json || {}, seq, this.status);
          } catch (e) {}
        });
      }
    } catch (e) {}
    return send.apply(this, arguments);
  };

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const op = opOf(url);
      const p = nativeFetch.apply(this, arguments);
      if (op && OPS.has(op)) {
        const seq = ++sent;
        p.then((r) => {
          const posting = POSTING.has(op);
          if (r.status !== 200 && !posting) {
            if (r.status) emit(op, varsOf(url, init && init.body), { __status: r.status }, seq);
            return;
          }
          r.clone()
            .json()
            .then((json) => emit(op, posting ? {} : varsOf(url, init && init.body), json, seq, r.status), () => posting && emit(op, {}, {}, seq, r.status));
        }, () => {});
      }
      return p;
    };
  }
})();
