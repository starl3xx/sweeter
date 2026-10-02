// The command palette (⌘K in Linear, ⇧⌘P in editors): type a few letters of
// any command and press Return. rank() is pure so node tests can reach it;
// create() builds the overlay inside whatever element the host gives it and
// knows nothing about Sweeter’s own commands.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  // ---------- ranking ----------

  // Scores in the style of fzf: every matched character earns MATCH plus a
  // bonus for where it lands, and every gap costs a little. The gap cost is
  // capped below MATCH, so each matched character always adds to the score
  // (keyword scores are scaled down, which only works on positive numbers).
  const MATCH = 16;
  const GAP_START = 3;
  const GAP_EXTEND = 1;
  const GAP_CAP = 12;
  const BONUS_START = 10; // the title’s first character
  const BONUS_WORD = 8; // after a space or punctuation
  const BONUS_CAMEL = 7; // “lowerUpper” or “letter1”
  const BONUS_RUN = 4; // the least a consecutive character earns
  const FIRST_MULT = 2; // where the query starts matters most
  const LEAD = 0.2; // a nudge toward matches that start early
  const LEAD_MAX = 20;
  // Whole-query tiers on top of the fuzzy score, so the order the reader
  // expects always holds: exact, then prefix, then the start of a later
  // word, then inside a word, then scattered letters.
  const TIER_EXACT = 300;
  const TIER_PREFIX = 200;
  const TIER_WORD = 100;
  const TIER_INSIDE = 50;
  // A keyword match counts for half: an exact keyword still beats scattered
  // letters in a title, but not a title word that starts with the query.
  const KEYWORD_WEIGHT = 0.5;
  // Gaps at least this long all cost GAP_CAP.
  const FAR = Math.ceil((GAP_CAP - GAP_START) / GAP_EXTEND) + 1;

  const COMBINING = /\p{Mn}/gu;
  const IS_COMBINING = /\p{M}/u;
  const WORDCHAR = /[\p{L}\p{N}]/u;
  const LOWER = /\p{Ll}/u;
  const UPPER = /\p{Lu}/u;
  const LETTER = /\p{L}/u;
  const DIGIT = /\p{N}/u;
  // Letters that Unicode does not decompose into a base letter and a mark.
  const EXTRA = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };

  // One character, lowercased and without diacritics. It can become two
  // (ß, æ) or none (a combining accent typed on its own).
  function foldChar(ch) {
    return ch.toLowerCase().normalize('NFKD').replace(COMBINING, '').replace(/[ßæœøłđðþı]/g, (c) => EXTRA[c]);
  }

  // Words only, for the whole-query tiers: “Add Column…” and “add column”
  // are the same string here.
  function flatten(chars) {
    return chars.join('').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  // A title or keyword, folded once and kept: the same titles are scored on
  // every keystroke. idx maps each folded character back to the original
  // string, so hits can highlight the title as written.
  const prepared = new Map();
  function prep(s) {
    let p = prepared.get(s);
    if (p) return p;
    const chars = [];
    const idx = [];
    const bonus = [];
    let i = 0;
    let prevChar = '';
    let prevFold = '';
    for (const ch of s) {
      const f = foldChar(ch);
      let first = true;
      // By code point, as the query is, so an emoji stays one character.
      for (const c of f) {
        let b = 0;
        if (first) {
          if (!chars.length) b = BONUS_START;
          else if (!WORDCHAR.test(prevFold)) b = BONUS_WORD;
          else if ((LOWER.test(prevChar) && UPPER.test(ch)) || (LETTER.test(prevChar) && DIGIT.test(ch))) b = BONUS_CAMEL;
          first = false;
        }
        chars.push(c);
        idx.push(i);
        bonus.push(b);
        prevFold = c;
      }
      if (f) prevChar = ch;
      i += ch.length;
    }
    p = { chars, idx, bonus, flat: flatten(chars) };
    if (prepared.size > 2000) prepared.clear();
    prepared.set(s, p);
    return p;
  }

  // The query ignores spaces, so “new post” and “newpost” both find “New Post”.
  function prepQuery(query) {
    const chars = [];
    for (const ch of String(query == null ? '' : query)) for (const c of foldChar(ch)) chars.push(c);
    return { chars: chars.filter((c) => !/\s/.test(c)), flat: flatten(chars) };
  }

  // The best way to find the query’s characters, in order, in one string:
  // { score, hits } or null. A small dynamic program, query × string, that
  // remembers how it got to each cell so the hits can be read back.
  function match(q, p) {
    const m = q.chars.length;
    const n = p.chars.length;
    if (!m || m > n) return null;
    // Most strings do not contain the query at all; find that out cheaply.
    for (let i = 0, j = 0; i < m; i++, j++) {
      while (j < n && p.chars[j] !== q.chars[i]) j++;
      if (j === n) return null;
    }
    const NONE = -Infinity;
    let prev = new Array(n).fill(NONE);
    let prevRun = new Array(n).fill(0);
    const back = [];
    for (let j = 0; j < n; j++) {
      if (p.chars[j] !== q.chars[0]) continue;
      prev[j] = MATCH + p.bonus[j] * FIRST_MULT - Math.min(j, LEAD_MAX) * LEAD;
      prevRun[j] = p.bonus[j];
    }
    for (let i = 1; i < m; i++) {
      const cur = new Array(n).fill(NONE);
      const run = new Array(n).fill(0);
      const from = new Array(n).fill(-1);
      let far = NONE;
      let farK = -1;
      for (let j = 1; j < n; j++) {
        const kf = j - 1 - FAR;
        if (kf >= 0 && prev[kf] > far) {
          far = prev[kf];
          farK = kf;
        }
        if (p.chars[j] !== q.chars[i]) continue;
        let best = NONE;
        // Right after the previous character: the run keeps the bonus of
        // the place it started, so a whole word prefix scores as one.
        if (prev[j - 1] > NONE) {
          const r = Math.max(prevRun[j - 1], p.bonus[j]);
          best = prev[j - 1] + MATCH + Math.max(r, BONUS_RUN);
          from[j] = j - 1;
          run[j] = r;
        }
        // After a gap.
        let g = farK >= 0 ? far - GAP_CAP : NONE;
        let gk = farK;
        for (let k = Math.max(0, j - FAR); k <= j - 2; k++) {
          if (prev[k] === NONE) continue;
          const v = prev[k] - Math.min(GAP_START + (j - k - 2) * GAP_EXTEND, GAP_CAP);
          if (v > g) {
            g = v;
            gk = k;
          }
        }
        if (gk >= 0 && g + MATCH + p.bonus[j] > best) {
          best = g + MATCH + p.bonus[j];
          from[j] = gk;
          run[j] = p.bonus[j];
        }
        cur[j] = best;
      }
      back.push(from);
      prev = cur;
      prevRun = run;
    }
    let end = -1;
    for (let j = 0; j < n; j++) if (prev[j] > NONE && (end < 0 || prev[j] > prev[end])) end = j;
    if (end < 0) return null;
    let score = prev[end];
    const pos = [end];
    for (let i = m - 1; i > 0; i--) pos.unshift(back[i - 1][pos[0]]);
    const hits = [];
    for (const j of pos) if (hits[hits.length - 1] !== p.idx[j]) hits.push(p.idx[j]);
    if (q.flat) {
      if (p.flat === q.flat) score += TIER_EXACT;
      else if (p.flat.startsWith(q.flat)) score += TIER_PREFIX;
      else if ((' ' + p.flat).includes(' ' + q.flat)) score += TIER_WORD;
      else if (p.flat.includes(q.flat)) score += TIER_INSIDE;
    }
    return { score, hits };
  }

  function keywordsOf(cmd) {
    const k = cmd.keywords;
    if (Array.isArray(k)) return k.filter((s) => s != null).map(String);
    return k ? [String(k)] : [];
  }

  // rank(query, commands, recent) -> [{ cmd, score, hits }], best first.
  // hits are indexes into cmd.title. An empty query keeps every command:
  // recently run ones first (recent is a list of ids, newest first), then
  // the order given.
  function rank(query, commands, recent) {
    const list = Array.isArray(commands) ? commands : [];
    const recency = new Map();
    (Array.isArray(recent) ? recent : []).forEach((id, i) => {
      if (!recency.has(id)) recency.set(id, i);
    });
    const rec = (cmd) => (recency.has(cmd.id) ? recency.get(cmd.id) : Number.MAX_SAFE_INTEGER);
    const q = prepQuery(query);
    const out = [];
    list.forEach((cmd, i) => {
      if (!cmd) return;
      if (!q.chars.length) {
        out.push({ cmd, score: 0, hits: [], i });
        return;
      }
      const t = match(q, prep(String(cmd.title == null ? '' : cmd.title)));
      let score = t ? t.score : -Infinity;
      for (const kw of keywordsOf(cmd)) {
        const k = match(q, prep(kw));
        if (k && k.score * KEYWORD_WEIGHT > score) score = k.score * KEYWORD_WEIGHT;
      }
      if (score === -Infinity) return;
      out.push({ cmd, score, hits: t ? t.hits : [], i });
    });
    out.sort((a, b) => b.score - a.score || rec(a.cmd) - rec(b.cmd) || a.i - b.i);
    return out.map((r) => ({ cmd: r.cmd, score: r.score, hits: r.hits }));
  }

  // ---------- overlay ----------

  const MAX_ROWS = 50;
  const MAX_RECENT = 20;
  let seq = 0;

  const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => HTML_ESC[c]);
  }

  // What the reader sees as one character: “é” written as e plus an accent,
  // “👍🏽”, a family emoji. A <mark> must not split one, or the halves draw
  // as separate glyphs. Without Intl.Segmenter, a combining mark stays with
  // the character before it.
  const GRAPHEMES = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function clusters(s) {
    if (GRAPHEMES) return Array.from(GRAPHEMES.segment(s), (g) => ({ text: g.segment, at: g.index }));
    const out = [];
    let i = 0;
    for (const ch of s) {
      if (out.length && IS_COMBINING.test(ch)) out[out.length - 1].text += ch;
      else out.push({ text: ch, at: i });
      i += ch.length;
    }
    return out;
  }

  // highlight(title, hits) -> HTML: the title, escaped, with the characters
  // at hits (UTF-16 indexes, as rank returns them) in <mark class="pal-m">.
  // A cluster is marked when any of its code points was matched.
  function highlight(title, hits) {
    const s = String(title == null ? '' : title);
    if (!hits || !hits.length) return esc(s);
    const set = new Set(hits);
    let out = '';
    let on = false;
    for (const c of clusters(s)) {
      let want = false;
      for (let i = c.at; i < c.at + c.text.length && !want; i++) want = set.has(i);
      if (want !== on) {
        out += want ? '<mark class="pal-m">' : '</mark>';
        on = want;
      }
      out += esc(c.text);
    }
    return out + (on ? '</mark>' : '');
  }

  // create({ root, icon, commands, onClose }) -> { open, close, isOpen, handleKey }
  function create(opts) {
    const o = opts || {};
    const host = o.root;
    if (!host || typeof host.appendChild !== 'function') throw new TypeError('palette.create needs a root element');
    const icon = typeof o.icon === 'function' ? o.icon : null;
    const source = o.commands;
    const onClose = o.onClose;
    const uid = 'pal' + ++seq;
    const recent = [];
    // The host calls handleKey from its own key listener, and the input
    // listens too (so the palette also works on its own). Each event is
    // acted on once.
    const seen = new WeakMap();
    let back = null;
    let input = null;
    let list = null;
    let shown = false;
    let results = [];
    let sel = 0;
    let prevFocus = null;
    let downOnBack = false;
    let lastPoint = '';

    function current() {
      try {
        const c = typeof source === 'function' ? source() : source;
        return Array.isArray(c) ? c : [];
      } catch (err) {
        console.error('Sweeter palette: the command list failed', err);
        return [];
      }
    }

    function focused() {
      const rn = host.getRootNode ? host.getRootNode() : null;
      return (rn && rn.activeElement) || null;
    }

    function mount() {
      if (back) {
        if (!back.isConnected) host.appendChild(back);
        return;
      }
      back = host.ownerDocument.createElement('div');
      back.className = 'pal-back';
      back.hidden = true;
      back.innerHTML =
        '<div class="pal-panel" role="dialog" aria-modal="true" aria-label="Command palette">' +
        '<div class="pal-top"><label class="pal-field">' + (icon ? icon('search') : '') +
        '<input class="pal-in" type="text" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="' + uid + '-list"' +
        ' autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Type a command" aria-label="Command"></label></div>' +
        '<div class="pal-list" id="' + uid + '-list" role="listbox" aria-label="Commands"></div></div>';
      host.appendChild(back);
      input = back.querySelector('.pal-in');
      list = back.querySelector('.pal-list');
      input.addEventListener('input', refresh);
      input.addEventListener('keydown', (e) => {
        if (handleKey(e)) e.preventDefault();
      });
      back.addEventListener('mousedown', (e) => {
        downOnBack = e.target === back;
        // Clicks inside the panel leave the focus in the input.
        if (e.target !== input) e.preventDefault();
      });
      back.addEventListener('click', (e) => {
        if (e.target === back) {
          if (downOnBack) close();
          return;
        }
        const row = e.target.closest && e.target.closest('.pal-row');
        if (row && list.contains(row)) choose(Number(row.dataset.i));
      });
      // Follow the pointer only when it moves, so rows scrolling under a
      // still pointer do not steal the selection from the keyboard.
      list.addEventListener('mousemove', (e) => {
        const pt = e.clientX + ',' + e.clientY;
        if (pt === lastPoint) return;
        lastPoint = pt;
        const row = e.target.closest && e.target.closest('.pal-row');
        if (row && Number(row.dataset.i) !== sel) select(Number(row.dataset.i), false);
      });
    }

    function refresh() {
      results = rank(input.value, current(), recent).slice(0, MAX_ROWS);
      sel = 0;
      render();
    }

    function render() {
      list.scrollTop = 0;
      if (!results.length) {
        list.innerHTML = '<div class="pal-empty">' + (input.value.trim() ? 'No matching commands' : 'No commands') + '</div>';
        input.removeAttribute('aria-activedescendant');
        return;
      }
      // Icon and key slots appear on every row once any row needs them, so
      // titles and group labels line up.
      const icons = !!icon && results.some((r) => r.cmd.icon);
      const keys = results.some((r) => r.cmd.keys);
      list.innerHTML = results.map((r, i) => row(r, i, icons, keys)).join('');
      input.setAttribute('aria-activedescendant', uid + '-' + sel);
    }

    function row(r, i, icons, keys) {
      const c = r.cmd;
      return (
        '<div class="pal-row' + (c.danger ? ' pal-danger' : '') + '" role="option" id="' + uid + '-' + i + '" data-i="' + i + '" aria-selected="' + (i === sel) + '"' +
        (c.enabled === false ? ' aria-disabled="true"' : '') + '>' +
        (icons ? '<span class="pal-ic">' + (c.icon ? icon(String(c.icon)) : '') + '</span>' : '') +
        '<span class="pal-t">' + highlight(String(c.title == null ? '' : c.title), r.hits) + '</span>' +
        (c.group ? '<span class="pal-g">' + esc(c.group) + '</span>' : '') +
        (keys ? '<span class="pal-ks">' + (c.keys ? '<kbd class="pal-k">' + esc(c.keys) + '</kbd>' : '') + '</span>' : '') +
        '</div>'
      );
    }

    function select(i, scroll) {
      const rows = list.children;
      if (!results.length || !rows[i]) return;
      if (rows[sel]) rows[sel].setAttribute('aria-selected', 'false');
      sel = i;
      rows[i].setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', rows[i].id);
      if (scroll) reveal(rows[i]);
    }

    // Scroll the list (never the page) just enough to show the row.
    function reveal(el) {
      const pad = 6;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (top - pad < list.scrollTop) list.scrollTop = top - pad;
      else if (bottom + pad > list.scrollTop + list.clientHeight) list.scrollTop = bottom + pad - list.clientHeight;
    }

    function move(delta) {
      const n = results.length;
      if (n) select((sel + delta + n) % n, true);
    }

    function remember(id) {
      if (id == null) return;
      const at = recent.indexOf(id);
      if (at >= 0) recent.splice(at, 1);
      recent.unshift(id);
      if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    }

    // Close first, then run, so a command that opens something of its own
    // finds the palette gone and the focus back where it was.
    function choose(i) {
      const r = results[i];
      if (!r || r.cmd.enabled === false || typeof r.cmd.run !== 'function') return;
      const cmd = r.cmd;
      remember(cmd.id);
      close();
      // A failing command must not break out of the host’s key handler
      // halfway (X Pro would then see the key).
      try {
        const p = cmd.run();
        if (p && typeof p.catch === 'function') p.catch((err) => console.error('Sweeter palette: “' + cmd.title + '” failed', err));
      } catch (err) {
        console.error('Sweeter palette: “' + cmd.title + '” failed', err);
      }
    }

    function open(initialQuery) {
      mount();
      if (!shown) {
        const f = focused();
        prevFocus = f && !back.contains(f) ? f : null;
        shown = true;
        back.hidden = false;
        input.value = initialQuery == null ? '' : String(initialQuery);
      } else if (initialQuery != null) {
        input.value = String(initialQuery);
      }
      refresh();
      input.focus({ preventScroll: true });
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }

    function close() {
      if (!shown) return;
      shown = false;
      back.hidden = true;
      results = [];
      list.innerHTML = '';
      input.removeAttribute('aria-activedescendant');
      const f = prevFocus;
      prevFocus = null;
      if (f && f.isConnected && typeof f.focus === 'function') f.focus({ preventScroll: true });
      else if (focused() === input) input.blur();
      if (typeof onClose === 'function') {
        try {
          onClose();
        } catch (err) {
          console.error('Sweeter palette: onClose failed', err);
        }
      }
    }

    function isOpen() {
      return shown;
    }

    // Keys the palette owns while it is open. Everything else returns false
    // and goes to the input as typing. Only keydown acts: Sweeter’s window
    // listener also passes keypress and keyup, and a keyup ↓ must not move
    // the selection a second time.
    function handleKey(e) {
      if (!shown || !e || typeof e !== 'object') return false;
      if (e.type && e.type !== 'keydown') return false;
      if (seen.has(e)) return seen.get(e);
      const handled = key(e);
      seen.set(e, handled);
      return handled;
    }

    function key(e) {
      // An input method is still choosing characters: its keys are its own.
      if (e.isComposing || e.keyCode === 229) return false;
      const k = e.key;
      const ctrlOnly = e.ctrlKey && !e.metaKey && !e.altKey;
      if (k === 'Escape') {
        close();
        return true;
      }
      if (k === 'Enter') {
        choose(sel);
        return true;
      }
      if (k === 'ArrowDown' || (ctrlOnly && (k === 'n' || k === 'N'))) {
        if (e.metaKey && results.length) select(results.length - 1, true);
        else move(1);
        return true;
      }
      if (k === 'ArrowUp' || (ctrlOnly && (k === 'p' || k === 'P'))) {
        if (e.metaKey && results.length) select(0, true);
        else move(-1);
        return true;
      }
      // The palette is modal: Tab must not walk the focus out to the app.
      if (k === 'Tab') return true;
      return false;
    }

    return { open, close, isOpen, handleKey };
  }

  // Uses the host app’s skin tokens; --fav (Sweeter’s red) marks danger.
  Sweeter.paletteCss = `
.pal-back{position:fixed;inset:0;z-index:8;display:flex;justify-content:center;align-items:flex-start;padding:16vh 16px 16px;background:rgba(0,0,0,.2);animation:pal-fade .12s ease-out}
.pal-back[hidden]{display:none}
.pal-back,.pal-back *{box-sizing:border-box}
.pal-panel{width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--sheet);color:var(--t1);border-radius:12px;box-shadow:0 0 0 1px var(--ring),0 24px 70px var(--shadow);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px;line-height:1.3;text-align:left;animation:pal-in .14s ease-out}
.pal-top{flex:0 0 auto;padding:10px;border-bottom:1px solid var(--div)}
.pal-field{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border-radius:8px;background:var(--field);color:var(--t3);cursor:text}
.pal-field svg{width:16px;height:16px;flex:0 0 auto}
.pal-in{-webkit-appearance:none;appearance:none;flex:1 1 auto;min-width:0;height:100%;margin:0;padding:0;border:0;outline:none;background:none;font:inherit;font-size:15px;color:var(--t1)}
.pal-in::placeholder{color:var(--t3)}
.pal-list{position:relative;flex:0 1 auto;min-height:0;max-height:calc(12 * 34px + 12px);overflow-y:auto;overscroll-behavior:contain;padding:6px}
.pal-row{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:6px;color:var(--t1);white-space:nowrap;cursor:pointer}
.pal-ic{flex:0 0 16px;height:16px;display:grid;place-items:center;color:var(--t3)}
.pal-ic svg{width:16px;height:16px}
.pal-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.pal-m{background:none;color:inherit;font-weight:700}
.pal-g{flex:0 0 auto;font-size:11px;color:var(--t3)}
.pal-ks{flex:0 0 auto;min-width:44px;display:flex;justify-content:flex-end}
.pal-k{min-width:20px;padding:1px 5px;border:1px solid var(--div);border-radius:4px;background:var(--field);color:var(--t2);font:500 11.5px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;text-align:center;font-variant-numeric:tabular-nums}
.pal-danger{color:var(--fav,#E64545)}
.pal-row[aria-selected="true"]{background:var(--accent-solid);color:#fff}
.pal-row.pal-danger[aria-selected="true"]{background:var(--fav,#E64545)}
.pal-row[aria-selected="true"] .pal-ic,.pal-row[aria-selected="true"] .pal-g{color:rgba(255,255,255,.8)}
.pal-row[aria-selected="true"] .pal-k{color:#fff;background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.3)}
.pal-row[aria-disabled="true"]{cursor:default}
.pal-row[aria-disabled="true"]>*{opacity:.45}
.pal-empty{padding:18px 10px;text-align:center;color:var(--t3)}
@keyframes pal-fade{from{opacity:0}to{opacity:1}}
@keyframes pal-in{from{opacity:0;transform:translateY(-6px) scale(.985)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pal-back,.pal-panel{animation:none}}
`;

  Sweeter.palette = { rank, highlight, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.palette;
})(typeof globalThis !== 'undefined' ? globalThis : this);
