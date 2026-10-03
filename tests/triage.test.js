const path = require('path');
const T = require(path.join(__dirname, '../scripts/triage.js'));
const { problemKey } = globalThis.Sweeter.util;

// The body GitHub writes for an issue form, as Report a Problem fills it.
const form = (o) =>
  '### What happened?\n\nI pressed Like.\n\n### Error message\n\n' + (o.error || '_No response_') +
  '\n\n### Sweeter version\n\n' + (o.version || '_No response_') +
  '\n\n### Mac app or Safari extension\n\n' + (o.client || '_No response_') +
  '\n\n### macOS or Safari version\n\nmacOS 26.0.1\n\n### X language\n\nen';

test('triage: labels from the Report a Problem form', () => {
  eq(T.labelsFor(form({ version: '0.19.0', client: 'Mac app' }), 'v0.19.0'), ['needs triage', 'mac app']);
  eq(T.labelsFor(form({ version: '0.18.3', client: 'Safari extension' }), 'v0.19.1'), ['needs triage', 'safari extension', 'older version']);
  // A newer build than the latest release (built from source) is not older.
  eq(T.labelsFor(form({ version: '0.20.0', client: 'Mac app' }), 'v0.19.1'), ['needs triage', 'mac app']);
  // Blank answers, and a blank issue with no form at all.
  eq(T.labelsFor(form({}), 'v0.19.1'), ['needs triage']);
  eq(T.labelsFor('It crashed.', 'v0.19.1'), ['needs triage']);
  eq(T.labelsFor(form({ version: 'Sweeter 0.18.1 (Mac)', client: 'mac app' }), null), ['needs triage', 'mac app']);
});

test('triage: a field answer never runs into the next heading', () => {
  eq(T.field(form({}), 'Sweeter version'), '');
  eq(T.field(form({ version: '0.19.0' }), 'Sweeter version'), '0.19.0');
  eq(T.field('### Sweeter version\n\n### Mac app or Safari extension\n\nMac app', 'Sweeter version'), '');
});

test('problem keys: same problem, same key, nothing personal', () => {
  eq(problemKey('This column acts as @someone_else in X Pro. Sweeter doesn’t act from it.'), 'This column acts as @… in X Pro. Sweeter doesn’t act from it.');
  eq(problemKey('X Pro didn’t post it. X says: “You already said that to @bob” [reply: xerror]'), 'X Pro didn’t post it. X says: “…” [reply: xerror]');
  eq(problemKey('Layout “Work” saved at https://x.com/i/lists/1234567890'), 'Layout “…” saved at …');
  ok(problemKey('a'.repeat(300)).length === 100, 'at most 100 characters');
  eq(problemKey(''), '');
});
