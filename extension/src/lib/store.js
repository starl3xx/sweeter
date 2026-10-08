// Keeps one timeline per X Pro column and the reading position for each.
// It only ever receives data; it never asks X for anything.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});
  const { compareSort, snowflakeMs } = Sweeter.util;
  const N = Sweeter.normalize;

  const MAX_BLOCKS = 600;

  function createStore(opts) {
    const o = opts || {};
    const sources = new Map(); // key -> column state
    const listNames = new Map(); // listId -> name
    const details = new Map(); // focal post id -> { blocks (X’s order), updated }
    let lastPosted = null; // the last post the reader made: shown or why not
    // Single posts X Pro looked up by id, by id: TweetResultByRestId, and
    // TweetResultsByRestIds, which brings the posts an X Article embeds
    // (verified 2026-10-06). The newest POSTS_MAX are kept.
    const posts = new Map();
    const POSTS_MAX = 300;
    // Profiles Sweeter asked X Pro to open: the person (by lowercase handle)
    // and their timelines (by user id, then by X’s operation name, one per
    // profile tab). A watched user’s timelines never become columns.
    const profiles = new Map();
    const profileIds = new Map(); // user id -> lowercase handle
    const timelines = new Map(); // user id -> Map(op -> { blocks, sorted })
    const watched = new Set();
    const expected = new Set(); // lowercase handles whose id is not known yet
    // X Pro’s decks and columns (lib/decks.js), from X Pro’s own traffic.
    const decks = Sweeter.decks.createDecks();
    // Reading positions, saved by time (ms). X numbers a timeline’s entries
    // (sortIndex) afresh on every page load, so a saved sortIndex means
    // nothing after a reload (verified 2026-09-30, P6). Notifications keep
    // theirs, which is already a time. A pre-0.15 saved sortIndex from a
    // timeline was itself a Snowflake made at fetch time: its time stands in.
    const readPositions = {}; // key -> ms
    for (const [k, v] of Object.entries(o.readPositions || {})) {
      const t = typeof v === 'number' ? v : String(v).length >= 16 ? snowflakeMs(String(v)) : Number(v);
      if (isFinite(t) && t > 0) readPositions[k] = t;
    }
    const listeners = new Set();

    function emit(key) {
      for (const fn of listeners) fn(key);
    }

    function ensure(src) {
      let s = sources.get(src.key);
      if (!s) {
        s = {
          key: src.key,
          kind: src.kind,
          title: src.listId && listNames.has(src.listId) ? listNames.get(src.listId) : src.title,
          listId: src.listId || null,
          blocks: new Map(),
          sorted: [],
          cursors: {},
          readSort: null,
          readAt: readPositions[src.key] || null,
          xUnreadAbove: null,
          updated: 0,
          order: sources.size,
        };
        sources.set(src.key, s);
      }
      return s;
    }

    function resort(s) {
      s.sorted = Array.from(s.blocks.values()).sort((a, b) => compareSort(b.sortIndex, a.sortIndex));
      if (s.sorted.length > MAX_BLOCKS) {
        for (const b of s.sorted.slice(MAX_BLOCKS)) s.blocks.delete(b.key);
        s.sorted.length = MAX_BLOCKS;
      }
    }

    // One captured response from the recorder: { op, vars, body }.
    function ingest(msg) {
      if (!msg || !msg.op || !msg.body) return null;
      // A refused request carries only its status. It touches nothing (no
      // deck or column write X rejected, no profile, no posts): it only lets
      // a column's stale clock say why.
      if (msg.body.__status) {
        const src = N.sourceFor(msg.op, msg.vars);
        if (src && sources.has(src.key)) sources.get(src.key).lastError = { status: msg.body.__status, at: Date.now() };
        return null;
      }
      if (Sweeter.decks.OPS.has(msg.op)) {
        if (decks.ingest(msg)) emit('decks');
        return 'decks';
      }
      // X Pro's answer when the reader posts (CreateTweet, or CreateNoteTweet
      // for a long post). A reply shows at once in an open conversation of
      // the post it answers, under that post, as on X: X Pro doesn't ask for
      // the conversation again (asked for in a user's report, 2026-10-07).
      if (msg.op === 'CreateTweet' || msg.op === 'CreateNoteTweet') {
        const raw = msg.body && msg.body.post;
        if (!raw) {
          lastPosted = { shown: false, why: msg.body && msg.body.id ? 'no post in X’s answer' : 'X didn’t take the post', shape: 'none' };
          emit('posted');
          return null;
        }
        const p = N.post(typed(raw), 0);
        let hit = null;
        if (p && !p.unavailable && p.id && p.replyToId) {
          for (const [fid, d] of details) {
            if (!addReply(d, fid, p)) continue;
            hit = 'detail:' + fid;
            emit(hit);
            if (sources.has('conv:' + fid)) {
              fillConv(sources.get('conv:' + fid), d);
              emit('conv:' + fid);
            }
          }
        }
        // For the app's log: why a reply didn't show, by field names only.
        lastPosted = {
          shown: !!hit,
          why: hit ? '' : !p ? 'unreadable' : p.unavailable ? 'unavailable' : !p.replyToId ? 'not a reply' : 'no open conversation has its post',
          shape: shapeOf(raw),
        };
        emit('posted');
        return hit;
      }
      if (msg.op === 'TweetResultsByRestIds' || msg.op === 'TweetResultByRestId') {
        const d = (msg.body.data && msg.body.data.tweetResult) || [];
        let n = 0;
        for (const r of Array.isArray(d) ? d : [d]) {
          const p = r && r.result ? N.post(r.result, 0) : null;
          if (!p || p.unavailable || !p.id) continue;
          posts.delete(p.id);
          posts.set(p.id, p);
          n++;
        }
        while (posts.size > POSTS_MAX) posts.delete(posts.keys().next().value);
        if (!n) return null;
        emit('posts');
        return 'posts';
      }
      if (msg.op === 'ListByRestId') {
        const info = N.listInfo(msg.body);
        if (info && info.id) {
          listNames.set(info.id, info.name);
          for (const s of sources.values()) if (s.listId === info.id) s.title = info.name;
          emit(null);
        }
        return null;
      }
      if (msg.op === 'UserByScreenName' || msg.op === 'UserByRestId') {
        const pr = N.profile(msg.body);
        if (!pr) return null;
        const hl = pr.handle.toLowerCase();
        profiles.set(hl, pr);
        profileIds.set(String(pr.id), hl);
        if (expected.has(hl)) {
          expected.delete(hl);
          watched.add(String(pr.id));
        }
        emit('profile:' + hl);
        return 'profile:' + hl;
      }
      const uid = msg.vars && msg.vars.userId != null ? String(msg.vars.userId) : null;
      if (uid && watched.has(uid) && msg.op !== 'Likes') {
        let byOp = timelines.get(uid);
        if (!byOp) timelines.set(uid, (byOp = new Map()));
        let t = byOp.get(msg.op);
        if (!t) byOp.set(msg.op, (t = { blocks: new Map(), sorted: [], pinned: null }));
        for (const ins of N.timeline(msg.body)) {
          if (ins.type === 'clear') t.blocks.clear();
          else if (ins.type === 'add') for (const b of ins.blocks) t.blocks.set(b.key, b);
          else if (ins.type === 'pin') t.pinned = ins.block;
        }
        t.sorted = Array.from(t.blocks.values()).sort((a, b) => compareSort(b.sortIndex, a.sortIndex));
        if (t.pinned) t.sorted = [t.pinned].concat(t.sorted.filter((b) => b.key !== t.pinned.key));
        emit('timeline:' + uid);
        // Their profile column (if the deck has one) keeps getting posts
        // while the sheet is open: only the ones it lacks, so a sheet’s own
        // fetch never renumbers posts the column already shows.
        const src = N.sourceFor(msg.op, msg.vars);
        const cs = src && sources.get(src.key);
        if (cs) {
          let added = false;
          for (const b of t.blocks.values()) {
            if (!cs.blocks.has(b.key)) {
              cs.blocks.set(b.key, b);
              added = true;
            }
          }
          if (added) {
            resort(cs);
            cs.updated = Date.now();
            emit(cs.key);
          }
        }
        return 'timeline:' + uid;
      }
      if (msg.op === 'TweetDetail') {
        // A conversation X Pro opened: the focal post, what it replies to,
        // and reply threads, kept in X’s order (not sorted like a timeline).
        const id = msg.vars && msg.vars.focalTweetId ? String(msg.vars.focalTweetId) : null;
        if (!id) return null;
        let d = details.get(id);
        for (const ins of N.timeline(msg.body)) {
          if (ins.type === 'clear' || !d) d = { blocks: [], keys: new Set(), updated: 0 };
          if (ins.type === 'add') {
            for (const b of ins.blocks) {
              if (d.keys.has(b.key)) continue;
              // A reply the reader just posted, already shown (addReply).
              if (d.posted && postsOf(b).length && postsOf(b).every((x) => d.posted.has(x.id))) continue;
              d.keys.add(b.key);
              d.blocks.push(b);
            }
          }
        }
        if (!d) return null;
        d.updated = Date.now();
        details.set(id, d);
        emit('detail:' + id);
        // A conversation column (declared by the UI) draws the same blocks.
        if (sources.has('conv:' + id)) {
          fillConv(sources.get('conv:' + id), d);
          emit('conv:' + id);
        }
        return 'detail:' + id;
      }
      const src = N.sourceFor(msg.op, msg.vars);
      if (!src) return null;
      const isNew = !sources.has(src.key);
      const s = ensure(src);
      s.lastError = null;
      const firstLoad = s.blocks.size === 0;
      const readBefore = s.readSort;
      // X Pro polls every column every ~30 s, and most answers carry
      // nothing new: only a change redraws (and wakes) anything.
      let changed = isNew;
      for (const ins of N.timeline(msg.body)) {
        switch (ins.type) {
          case 'clear':
            if (s.blocks.size) changed = true;
            s.blocks.clear();
            break;
          case 'add':
            if (ins.blocks.length) changed = true;
            for (const b of ins.blocks) s.blocks.set(b.key, b);
            if (ins.cursors.top && (!s.cursors.top || firstLoad)) s.cursors.top = ins.cursors.top;
            if (ins.cursors.bottom) s.cursors.bottom = ins.cursors.bottom;
            break;
          case 'pin':
            // A profile’s pinned post: shown first, but outside time order.
            ins.block.pinned = true;
            s.blocks.set(ins.block.key, ins.block);
            changed = true;
            break;
          case 'cursor':
            s.cursors[ins.cursorType] = ins.value;
            break;
          case 'unreadAbove':
            s.xUnreadAbove = ins.sortIndex;
            break;
          default:
            break;
        }
      }
      resort(s);
      // First sight of a column this session: a saved position (a time)
      // becomes this session’s sortIndex; with none, start “all read”,
      // except notifications, where X tells us what is unread.
      // ('1' means every post loaded so far was newer: look again as older
      // pages arrive, until the reader moves the position themselves.)
      if (s.sorted.length && (!s.readSort || (s.readSort === '1' && s.readAt))) {
        if (s.readAt) s.readSort = sortAt(s, s.readAt);
        else s.readSort = s.kind === 'notifications' && s.xUnreadAbove ? s.xUnreadAbove : s.sorted[0].sortIndex;
      }
      if (s.readSort !== readBefore) changed = true;
      // Always: the stale clock reads it.
      s.updated = Date.now();
      if (changed) emit(s.key);
      return s.key;
    }

    // A block’s own time: a notification’s sortIndex (ms); a post’s id,
    // or the repost’s that put it in the timeline; a thread’s newest post.
    function blockTime(s, b) {
      if (s.kind === 'notifications' || b.kind === 'notification') {
        const n = Number(b.sortIndex);
        return isFinite(n) && n > 1e12 && n < 1e14 ? n : null;
      }
      const ps = b.kind === 'post' ? [b.post] : b.kind === 'thread' ? b.posts : [];
      let t = null;
      for (const p of ps) {
        const pt = p ? snowflakeMs(p.repostId || p.id) : NaN;
        if (isFinite(pt) && (t == null || pt > t)) t = pt;
      }
      return t;
    }
    // This session’s sortIndex for a saved time: the newest block at or
    // before it. Everything loaded is newer: all of it is unread.
    function sortAt(s, t) {
      for (const b of s.sorted) {
        const bt = blockTime(s, b);
        if (bt != null && bt <= t) return b.sortIndex;
      }
      return '1';
    }

    // X numbers a conversation in the order it shows it, so newest
    // sortIndex first is X’s own order.
    // X's answer to a new post can leave out the __typename its timelines
    // carry (the post's, and its author's); normalize needs them.
    function typed(raw) {
      const t = Object.assign({ __typename: 'Tweet' }, raw);
      const u = t.core && t.core.user_results && t.core.user_results.result;
      if (u && !u.__typename) t.core = Object.assign({}, t.core, { user_results: Object.assign({}, t.core.user_results, { result: Object.assign({ __typename: 'User' }, u) }) });
      return t;
    }

    function shapeOf(raw) {
      const keys = (o) => (o && typeof o === 'object' ? Object.keys(o).sort().join(',') : String(typeof o));
      const u = raw && raw.core && raw.core.user_results && raw.core.user_results.result;
      return 'post[' + keys(raw) + '] typename=' + (raw && raw.__typename) + ' user[' + keys(u) + '] usertype=' + (u && u.__typename) + ' usercore[' + keys(u && u.core) + '] reply=' + !!(raw && raw.legacy && raw.legacy.in_reply_to_status_id_str);
    }

    function postsOf(b) {
      return b.kind === 'thread' ? b.posts || [] : b.kind === 'post' && b.post ? [b.post] : [];
    }

    // Puts the reader's new reply p into conversation d (focal fid): under
    // the focal post, at the top of the replies; at the end of the thread
    // whose last post it answers; or under another reply it answers. A
    // reply to a post above the focal one isn't part of this view.
    function addReply(d, fid, p) {
      if (d.blocks.some((b) => postsOf(b).some((x) => x.id === p.id))) return false;
      const key = 'conversationthread-' + p.id;
      for (let i = 0; i < d.blocks.length; i++) {
        const b = d.blocks[i];
        const posts = postsOf(b);
        const at = posts.findIndex((x) => x.id === p.replyToId);
        if (at < 0) continue;
        if (b.kind === 'post' && p.replyToId !== fid) return false;
        if (b.kind === 'thread' && at === posts.length - 1) {
          d.blocks[i] = Object.assign({}, b, { posts: posts.concat(p) });
        } else {
          // Its sortIndex is one below the post it answers, so a
          // conversation column (sorted) puts it right under it, whatever
          // X Pro's later pages bring: nothing falls between the two.
          let si = b.sortIndex;
          try {
            si = String(BigInt(b.sortIndex) - 1n);
          } catch (e) {}
          d.blocks.splice(i + 1, 0, { key, sortIndex: si, kind: 'thread', posts: [p] });
        }
        d.keys.add(key);
        (d.posted || (d.posted = new Set())).add(p.id);
        d.updated = Date.now();
        return true;
      }
      return false;
    }

    function fillConv(cs, d) {
      cs.blocks = new Map(d.blocks.map((b) => [b.key, b]));
      resort(cs);
      if (!cs.readSort && cs.sorted.length) cs.readSort = cs.sorted[0].sortIndex;
      cs.updated = Date.now();
    }

    function markRead(key, sortIndex) {
      const s = sources.get(key);
      if (!s || !sortIndex) return false;
      if (s.readSort && compareSort(sortIndex, s.readSort) <= 0) return false;
      s.readSort = sortIndex;
      const b = s.sorted.find((x) => x.sortIndex === String(sortIndex));
      const t = b ? blockTime(s, b) : null;
      if (t != null && (!readPositions[key] || t > readPositions[key])) {
        readPositions[key] = t;
        s.readAt = t;
        if (o.onRead) o.onRead(key, t, Object.assign({}, readPositions));
      }
      return true;
    }

    function markAllRead(key) {
      const s = sources.get(key);
      if (s && s.sorted.length) return markRead(key, s.sorted[0].sortIndex);
      return false;
    }

    function isUnread(s, block) {
      return !!s.readSort && compareSort(block.sortIndex, s.readSort) > 0;
    }

    return {
      ingest,
      decks,
      markRead,
      markAllRead,
      isUnread,
      // A block’s own time (ms), or null: what a saved position compares.
      timeOf: (key, b) => {
        const s = sources.get(key);
        return s && b ? blockTime(s, b) : null;
      },
      get: (key) => sources.get(key),
      detail: (id) => details.get(String(id)) || null,
      lastPosted: () => lastPosted,
      post: (id) => posts.get(String(id)) || null,
      profile: (handle) => profiles.get(String(handle).toLowerCase()) || null,
      // Route this person’s timelines to the profile, by id or (when only
      // the handle is known) once X Pro’s profile response names the id.
      watch(handle, id) {
        if (id) watched.add(String(id));
        else if (handle) expected.add(String(handle).toLowerCase());
      },
      unwatch(handle, id, keep) {
        if (id) {
          watched.delete(String(id));
          if (!keep) timelines.delete(String(id));
        }
        if (handle) expected.delete(String(handle).toLowerCase());
      },
      timeline: (id, ops) => {
        const byOp = timelines.get(String(id));
        if (!byOp) return null;
        for (const op of ops) if (byOp.has(op)) return byOp.get(op);
        return null;
      },
      all: () => Array.from(sources.values()).sort((a, b) => a.order - b.order),
      listName: (id) => listNames.get(id),
      // The id of a person X Pro has shown, by handle.
      userId: (handle) => {
        const pr = profiles.get(String(handle).toLowerCase());
        return pr && pr.id ? String(pr.id) : null;
      },
      // A source Sweeter makes itself (a merged column): its blocks come
      // from the UI, already deduplicated and numbered by post time.
      feed(key, blocks) {
        const s = sources.get(key);
        if (!s) return;
        s.blocks = new Map(blocks.map((b) => [b.key, b]));
        resort(s);
        if (s.sorted.length && (!s.readSort || (s.readSort === '1' && s.readAt))) s.readSort = s.readAt ? sortAt(s, s.readAt) : s.sorted[0].sortIndex;
        s.updated = Date.now();
        emit(key);
      },
      // A column whose timeline has not arrived yet (or never will: a
      // placeholder) still needs a source to draw.
      declare(src) {
        if (!src || !src.key || sources.has(src.key)) return;
        const s = ensure(src);
        s.updated = Date.now();
        const conv = /^conv:(\d+)$/.exec(src.key);
        if (conv && details.has(conv[1])) fillConv(s, details.get(conv[1]));
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  }

  Sweeter.createStore = createStore;
  if (typeof module !== 'undefined' && module.exports) module.exports = createStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
