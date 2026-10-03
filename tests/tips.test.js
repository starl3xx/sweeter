const W = globalThis.Sweeter.tips;

test('tips: the welcome shows on a first open only', () => {
  eq(W.welcomeState(undefined), 'new');
  eq(W.welcomeState({}), 'new');
  // A first open whose welcome never closed shows it again.
  eq(W.welcomeState({ firstOpenAt: 1 }), 'again');
  // Saved settings from before the welcome existed: an old install.
  eq(W.welcomeState({ skin: 'dark', dedupeV2: 1 }), 'old');
  eq(W.welcomeState({ firstOpenAt: 1, welcomed: 1 }), '');
  eq(W.welcomeState({ welcomed: 1 }), '');
});

test('tips: one tip when Sweeter opens, at most every few hours', () => {
  const now = 1e12;
  ok(W.tipDue({ welcomed: 1 }, now), 'never shown');
  ok(!W.tipDue({ welcomed: 1, tipAt: now - 60e3 }, now), 'a reload a minute later');
  ok(W.tipDue({ welcomed: 1, tipAt: now - W.TIP_GAP }, now), 'after the gap');
  ok(!W.tipDue({ welcomed: 1, tips: false }, now), 'turned off');
  // The first open has the welcome instead.
  ok(!W.tipDue({ firstOpenAt: now }, now), 'welcome not closed yet');
});

test('tips: each open shows the tip after the last one, by id', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  eq(W.nextTip(list, undefined).id, 'a');
  eq(W.nextTip(list, 'a').id, 'b');
  eq(W.nextTip(list, 'c').id, 'a');
  // A tip removed in a later version: start again from the top.
  eq(W.nextTip(list, 'gone').id, 'a');
});

test('tips: app-only and Safari-only items stay where they work', () => {
  const app = W.tipsFor(true).map((t) => t.id);
  const safari = W.tipsFor(false).map((t) => t.id);
  ok(app.includes('hotkeys') && !safari.includes('hotkeys'), 'global hotkeys are in the app only');
  ok(safari.includes('reportSafari') && !app.includes('reportSafari'), 'the palette route is for Safari');
  ok(app.includes('palette') && safari.includes('palette'), 'shared tips in both');
  const keys = (app) => W.slides(app).flatMap((s) => s.keys.map((k) => k[0]));
  ok(keys(true).includes('{⌃⌥⌘X}') && !keys(false).includes('{⌃⌥⌘X}'), 'the global hotkey slide row');
});

test('tips: ids are unique and every action is one app.js knows', () => {
  const ids = W.TIPS.map((t) => t.id);
  eq(new Set(ids).size, ids.length);
  const known = /^(palette|find|nextUnread|report|colMenu|prefs:(general|media|filters|mutes|layouts|keys|extras))$/;
  for (const t of W.TIPS) if (t.act) ok(known.test(t.act[1]), t.id + ': ' + t.act[1]);
});

test('tips: copy keeps the house style', () => {
  const all = W.TIPS.map((t) => t.text).concat(W.SLIDES.flatMap((s) => [s.title, s.text].concat(s.keys.map((k) => k[1]))));
  for (const s of all) {
    ok(!/[—]|&mdash;/.test(s), 'no em dash: ' + s);
    ok(!/['"]/.test(s.replace(/\{[^}]*\}/g, '')), 'curly quotes: ' + s);
  }
});

test('tips: markup escapes text and draws keys', () => {
  eq(W.markup('Press {⌘J} <now>'), 'Press <kbd>⌘J</kbd> &lt;now&gt;');
  eq(W.markup('{<}'), '<kbd>&lt;</kbd>');
  eq(W.markup('a {b} and {c}'), 'a <kbd>b</kbd> and <kbd>c</kbd>');
});
