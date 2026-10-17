const fs = require('fs');
const path = require('path');

// A class app.js puts on a column must not also be a class the stylesheet
// styles on its own: a stale column once took the edited-post link's
// ".stale" rule (6 px down, text at 0.86).
test('classes: a column state never matches a rule meant for something else', () => {
  const app = fs.readFileSync(path.join(__dirname, '../extension/src/ui/app.js'), 'utf8');
  const states = new Set(Array.from(app.matchAll(/c\.el\.classList\.(?:add|toggle|remove)\('([\w-]+)'/g), (m) => m[1]));
  ok(states.size >= 10, 'found the column states (' + states.size + ')');
  const css = globalThis.Sweeter.css;
  const hits = [];
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    for (const sel of m[1].split(',')) {
      for (const part of sel.trim().split(/[\s>+~]+/)) {
        const cls = Array.from(part.matchAll(/\.([\w-]+)/g), (x) => x[1]);
        for (const c of cls) if (states.has(c) && !cls.includes('col')) hits.push(sel.trim());
      }
    }
  }
  eq(hits, [], 'rules a column could match by accident');
});
