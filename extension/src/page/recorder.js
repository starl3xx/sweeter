// Runs in X Pro’s own page world at document_start, before X’s code.
//
// It copies the JSON of the timeline responses X Pro already requests and
// hands them to Sweeter’s content script. It never sends a request, never
// changes one, and never reads cookies or storage. X Pro issues its GraphQL
// calls with XMLHttpRequest (verified 2026-09-28); fetch is covered too.
(function () {
  'use strict';
  if (window.__sweeterRecorder || !/^pro\.(x|twitter)\.com$/.test(location.hostname)) return;
  window.__sweeterRecorder = true;

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
  ]);

  // The deck sync carries more than Sweeter needs (onboarding state, each
  // column creator’s full record): pass on only the deck model, with the
  // creator’s handle alone.
  const POSTING = new Set(['CreateTweet', 'CreateNoteTweet']);
  function trim(op, json, status) {
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
