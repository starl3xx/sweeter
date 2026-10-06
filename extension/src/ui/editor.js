// The compose window's text box: a contenteditable element that shows real
// bold and italic, and answers like a textarea (value, selectionStart,
// selectionEnd, setSelectionRange, setRangeText, placeholder), so the
// compose code treats it as one.
//
// Bold and italic are ranges in UTF-16 units of the text (app.js keeps them
// and moves them with each edit); the box draws them as <b> and <i>, and
// draws them again only when its own spans no longer match, so plain typing
// keeps the system's undo. Links are underlined with the CSS Custom
// Highlight API, which never touches the DOM.
//
// Selections: in Sweeter's shadow root, document.getSelection() hides the
// nodes; getComposedRanges({ shadowRoots }) gives them (WebKit, verified
// 2026-10-06). In a compose window (a document of its own) the plain range
// does.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  function textbox(el) {
    const doc = () => el.ownerDocument;
    const win = () => doc().defaultView;
    const shadowOf = () => {
      const r = el.getRootNode();
      return r && r.host ? r : null;
    };

    // A <br> with no text after it is the browser's filler for an empty
    // box or an empty last line, not a newline (Enter types a real "\n"
    // in a plaintext-only box; verified in WebKit 2026-10-06).
    function filler(br) {
      if (br.hasAttribute('data-end')) return true;
      const tw = doc().createTreeWalker(el, 4);
      tw.currentNode = br;
      for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.data) return false;
      return true;
    }

    // The text: text nodes as they are, a <br> as a newline (unless it is
    // filler), and a newline between block elements the browser may have
    // made.
    function text() {
      let out = '';
      const walk = (n) => {
        for (let c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) out += c.data;
          else if (c.nodeName === 'BR') {
            if (!filler(c)) out += '\n';
          } else if (c.nodeType === 1) {
            const block = /^(DIV|P)$/.test(c.nodeName);
            if (block && out && !out.endsWith('\n')) out += '\n';
            walk(c);
          }
        }
      };
      walk(el);
      // WebKit ends an editable pre-wrap text whose last line is empty with
      // one more "\n" than it holds, so the caret has a line to sit on
      // (verified 2026-10-06: one Enter after "abc" reads "abc\n\n").
      if (out.endsWith('\n') && endsInText()) out = out.slice(0, -1);
      return out;
    }

    // Whether the box's last node is a text node (not a <br>).
    function endsInText() {
      let n = el.lastChild;
      while (n && n.nodeType === 1 && n.nodeName !== 'BR') n = n.lastChild;
      return !!n && n.nodeType === 3;
    }

    // A DOM point -> a text offset.
    function offsetOf(node, off) {
      if (!el.contains(node) && node !== el) return null;
      let pos = 0;
      let found = null;
      const walk = (n) => {
        for (let c = n.firstChild, i = 0; c && found == null; c = c.nextSibling, i++) {
          if (n === node && i === off) {
            found = pos;
            return;
          }
          if (c.nodeType === 3) {
            if (c === node) {
              found = pos + Math.min(off, c.data.length);
              return;
            }
            pos += c.data.length;
          } else if (c.nodeName === 'BR') {
            if (!filler(c)) pos += 1;
          } else if (c.nodeType === 1) {
            walk(c);
          }
        }
        if (n === node && found == null) found = pos;
      };
      walk(el);
      return found == null ? pos : found;
    }

    // A text offset -> a DOM point, in a text node when there is one there.
    function pointAt(at) {
      let pos = 0;
      let last = null;
      const walk = (n) => {
        for (let c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) {
            if (at <= pos + c.data.length) return { node: c, offset: at - pos };
            pos += c.data.length;
            last = { node: c, offset: c.data.length };
          } else if (c.nodeName === 'BR') {
            if (filler(c)) continue;
            if (at <= pos) return { node: n, offset: Array.prototype.indexOf.call(n.childNodes, c) };
            pos += 1;
            last = { node: n, offset: Array.prototype.indexOf.call(n.childNodes, c) + 1 };
          } else if (c.nodeType === 1) {
            const r = walk(c);
            if (r) return r;
          }
        }
        return null;
      };
      return walk(el) || last || { node: el, offset: 0 };
    }

    function range() {
      const sel = win().getSelection();
      if (!sel || !sel.rangeCount) return null;
      const sr = shadowOf();
      let r = null;
      if (sr && sel.getComposedRanges) {
        try {
          r = sel.getComposedRanges({ shadowRoots: [sr] })[0] || null;
        } catch (e) {
          r = null;
        }
      }
      if (!r) r = sel.getRangeAt(0);
      if (!r || !el.contains(r.startContainer) && r.startContainer !== el) return null;
      return r;
    }

    // The selection, kept while the box doesn't have it, as a textarea
    // keeps its own: a toolbar button or the emoji picker's search field
    // takes the page's selection, and must still see the box's.
    let saved = null;
    let watched = null;
    function live() {
      const r = range();
      if (!r) return null;
      const a = offsetOf(r.startContainer, r.startOffset);
      const b = offsetOf(r.endContainer, r.endOffset);
      return [a == null ? 0 : a, b == null ? 0 : b];
    }
    function onSelect() {
      const s = live();
      if (s) saved = s;
    }
    // Listens in whichever document holds the box (it moves into a compose
    // window and back).
    function watch() {
      const d = doc();
      if (watched === d) return;
      try {
        if (watched) watched.removeEventListener('selectionchange', onSelect);
      } catch (e) {}
      watched = d;
      d.addEventListener('selectionchange', onSelect);
    }
    function selection() {
      watch();
      const s = live();
      if (s) return (saved = s);
      const n = text().length;
      if (!saved) return [n, n];
      return [Math.min(saved[0], n), Math.min(saved[1], n)];
    }

    function select(a, b) {
      watch();
      const n = text().length;
      saved = [Math.max(0, Math.min(a, n)), Math.max(0, Math.min(b, n))];
      const p = pointAt(Math.max(0, Math.min(a, n)));
      const q = pointAt(Math.max(0, Math.min(b, n)));
      const sel = win().getSelection();
      try {
        sel.setBaseAndExtent(p.node, p.offset, q.node, q.offset);
      } catch (e) {}
    }

    // The styles the DOM shows now, as {bold, italic} ranges.
    function domStyles() {
      const out = { bold: [], italic: [] };
      let pos = 0;
      const add = (list, a, b) => {
        const last = list[list.length - 1];
        if (last && last[1] === a) last[1] = b;
        else list.push([a, b]);
      };
      const walk = (n, bold, italic) => {
        for (let c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) {
            const len = c.data.length;
            if (len && bold) add(out.bold, pos, pos + len);
            if (len && italic) add(out.italic, pos, pos + len);
            pos += len;
          } else if (c.nodeName === 'BR') {
            if (!filler(c)) pos += 1;
          } else if (c.nodeType === 1) {
            walk(c, bold || /^(B|STRONG)$/.test(c.nodeName), italic || /^(I|EM)$/.test(c.nodeName));
          }
        }
      };
      walk(el, false, false);
      return out;
    }

    const same = (x, y) => x.length === y.length && x.every((r, i) => r[0] === y[i][0] && r[1] === y[i][1]);

    // Draws the text with these styles, keeping the selection.
    function render(t, styles) {
      const st = styles || { bold: [], italic: [] };
      const cuts = new Set([0, t.length]);
      for (const [a, b] of st.bold.concat(st.italic)) cuts.add(Math.min(a, t.length)).add(Math.min(b, t.length));
      const pts = Array.from(cuts).sort((x, y) => x - y);
      const inside = (list, x) => list.some(([a, b]) => x >= a && x < b);
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let html = '';
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        let part = esc(t.slice(a, pts[i + 1]));
        if (inside(st.italic, a)) part = '<i>' + part + '</i>';
        if (inside(st.bold, a)) part = '<b>' + part + '</b>';
        html += part;
      }
      // A last newline needs a line to show on.
      if (t.endsWith('\n')) html += '<br data-end>';
      const had = doc().activeElement === el || (shadowOf() && shadowOf().activeElement === el);
      const [a, b] = had ? selection() : [0, 0];
      el.innerHTML = html;
      if (had) select(a, b);
      el.classList.toggle('empty', !t);
    }

    // Matches the DOM to these styles, only when it differs.
    function sync(styles) {
      const st = styles || { bold: [], italic: [] };
      const d = domStyles();
      if (same(d.bold, st.bold) && same(d.italic, st.italic)) {
        el.classList.toggle('empty', !text());
        return false;
      }
      render(text(), st);
      return true;
    }

    // Underlines the links (Custom Highlight API; nothing in the DOM).
    function underline(links) {
      const w = win();
      if (!w.CSS || !w.CSS.highlights || typeof w.Highlight !== 'function') return;
      const hl = new w.Highlight();
      for (const l of links || []) {
        const p = pointAt(l.start);
        const q = pointAt(l.end);
        const r = doc().createRange();
        try {
          r.setStart(p.node, p.offset);
          r.setEnd(q.node, q.offset);
          hl.add(r);
        } catch (e) {}
      }
      w.CSS.highlights.set('sweeter-link', hl);
    }

    Object.defineProperties(el, {
      value: {
        configurable: true,
        get: text,
        set(v) {
          render(String(v == null ? '' : v), null);
        },
      },
      selectionStart: { configurable: true, get: () => selection()[0] },
      selectionEnd: { configurable: true, get: () => selection()[1] },
      placeholder: {
        configurable: true,
        get: () => el.getAttribute('data-placeholder') || '',
        set: (v) => el.setAttribute('data-placeholder', String(v || '')),
      },
    });
    el.setSelectionRange = (a, b) => select(a, b == null ? a : b);
    // As a textarea's: replaces [a, b) with t. Through the editing commands,
    // so it is one undoable step and the box hears an input event.
    el.setRangeText = (t, a, b, mode) => {
      el.focus({ preventScroll: true });
      select(a, b);
      if (!doc().execCommand('insertText', false, t)) {
        const v = text();
        render(v.slice(0, a) + t + v.slice(b), null);
        el.dispatchEvent(new (win().InputEvent || win().Event)('input', { bubbles: true }));
      }
      if (mode === 'select') select(a, a + t.length);
    };
    el.renderStyles = render;
    el.syncStyles = sync;
    el.underline = underline;
    el.classList.toggle('empty', !text());
    watch();
    el.addEventListener('focus', watch);
    // An emptied box keeps no stray <br>, so its placeholder shows.
    el.addEventListener('input', () => {
      if (!text()) el.innerHTML = '';
      el.classList.toggle('empty', !text());
    });
    return el;
  }

  Sweeter.editor = { textbox };
})(typeof globalThis !== 'undefined' ? globalThis : this);
