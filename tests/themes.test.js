const P = globalThis.Sweeter.PALETTES;

// WCAG relative luminance and contrast of two #RRGGBB colors.
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const NEEDED = ['bg', 'sub', 'tint', 'div', 'sep', 't1', 't2', 't3', 'accent', 'mention', 'sel', 'selsep', 'gutter', 'quote', 'mquote', 'fav', 'rt', 'likeic', 'side', 'sheet', 'field', 'accent-solid', 'accent-solid-press', 'thread'];

test('themes: every theme sets every token, light and dark, as #RRGGBB', () => {
  ok(Object.keys(P).length >= 4, 'four themes');
  for (const [id, p] of Object.entries(P)) {
    ok(p.name && /^#[0-9A-F]{6}$/i.test(p.mark), id + ' name and menu color');
    for (const side of ['light', 'dark']) for (const k of NEEDED) ok(/^#[0-9A-F]{6}$/i.test(p[side][k] || ''), id + ' ' + side + ' --' + k);
  }
});

test('themes: text stays readable (body 7:1, quiet 4:1, links and button labels 3:1)', () => {
  for (const [id, p] of Object.entries(P)) {
    for (const side of ['light', 'dark']) {
      const t = p[side];
      const at = id + ' ' + side;
      ok(contrast(t.t1, t.bg) >= 7, at + ' body text ' + contrast(t.t1, t.bg).toFixed(1));
      ok(contrast(t.t2, t.bg) >= 4.5, at + ' secondary text ' + contrast(t.t2, t.bg).toFixed(1));
      ok(contrast(t.t3, t.bg) >= 4, at + ' quiet text ' + contrast(t.t3, t.bg).toFixed(1));
      ok(contrast(t.accent, t.bg) >= 3, at + ' links ' + contrast(t.accent, t.bg).toFixed(1));
      ok(contrast(t['on-accent'] || '#FFFFFF', t['accent-solid']) >= 3, at + ' button label ' + contrast(t['on-accent'] || '#FFFFFF', t['accent-solid']).toFixed(1));
    }
  }
});

test('themes: the CSS draws each theme for light, dark and Match system', () => {
  for (const id of Object.keys(P)) {
    ok(globalThis.Sweeter.css.includes('.app[data-skin="light"][data-palette="' + id + '"]'), id + ' light');
    ok(globalThis.Sweeter.css.includes('.app[data-skin="dark"][data-palette="' + id + '"]'), id + ' dark');
    ok(globalThis.Sweeter.css.includes('.app[data-skin="system"][data-palette="' + id + '"]'), id + ' system');
  }
});

test('themes: the Mac app’s launch cover uses each theme’s own colors', () => {
  const fs = require('fs');
  const path = require('path');
  const swift = fs.readFileSync(path.join(__dirname, '../safari/Sweeter/Sweeter/ViewController.swift'), 'utf8');
  const table = {};
  for (const m of swift.matchAll(/"(\w+)-(light|dark)": \[(0x[0-9A-F]{6}(?:, 0x[0-9A-F]{6}){3})\]/g)) table[m[1] + '-' + m[2]] = m[3].split(', ').map((x) => '#' + x.slice(2));
  const css = globalThis.Sweeter.css;
  const tokens = (body) => Object.fromEntries(Array.from(body.matchAll(/--([\w-]+):\s*([^;]+);/g), (m) => [m[1], m[2].trim()]));
  const classic = { light: tokens(/\.app\{([^}]*)\}/.exec(css)[1]), dark: tokens(/\.app\[data-skin="dark"\]\{([^}]*)\}/.exec(css)[1]) };
  const want = { classic };
  for (const [id, p] of Object.entries(P)) want[id] = { light: p.light, dark: p.dark };
  eq(Object.keys(table).sort(), Object.keys(want).flatMap((id) => [id + '-dark', id + '-light']).sort());
  for (const [id, sides] of Object.entries(want)) {
    for (const side of ['light', 'dark']) eq(table[id + '-' + side], ['bg', 't1', 't3', 'div'].map((k) => sides[side][k].toUpperCase()), id + ' ' + side);
  }
});
