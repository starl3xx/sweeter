// No framework: node tests/run.js
const path = require('path');
const fs = require('fs');

const LIB = ['util', 'text', 'normalize', 'mutes', 'filters', 'decks', 'store'];
for (const f of LIB) require(path.join(__dirname, '../extension/src/lib', f + '.js'));
// UI files whose logic runs without a DOM.
const UI = ['styles', 'palette', 'tips'];
for (const f of UI) require(path.join(__dirname, '../extension/src/ui', f + '.js'));

let passed = 0;
let failed = 0;
const failures = [];

global.test = function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push(name + '\n    ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e));
  }
};

global.eq = function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + b + ', got ' + a);
};

global.ok = function ok(v, msg) {
  if (!v) throw new Error(msg || 'expected truthy, got ' + JSON.stringify(v));
};

for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, f));
}

for (const f of failures) console.log('FAIL ' + f);
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
