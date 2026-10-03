// Labels for a new issue, from the Report a Problem form: "needs triage",
// where it came from (Mac app or Safari extension), and "older version"
// when it names a version before the latest release. Run by
// .github/workflows/triage.yml with the issue event; labelsFor is pure, for
// the tests. The issue text is only read, never run.
'use strict';

// A form field's answer: the first line under its "### Label" heading.
function field(body, label) {
  const lines = String(body || '').split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === '### ' + label);
  if (at < 0) return '';
  const v = lines.slice(at + 1).find((l) => l.trim());
  return !v || v.startsWith('### ') || v.trim() === '_No response_' ? '' : v.trim();
}

const parts = (v) => String(v).replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
function isOlder(v, latest) {
  const a = parts(v);
  const b = parts(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  return false;
}

function labelsFor(body, latestTag) {
  const labels = ['needs triage'];
  const client = field(body, 'Mac app or Safari extension');
  if (/mac app/i.test(client)) labels.push('mac app');
  else if (/safari/i.test(client)) labels.push('safari extension');
  const version = (/\d+\.\d+(\.\d+)?/.exec(field(body, 'Sweeter version')) || [])[0];
  if (version && latestTag && isOlder(version, latestTag)) labels.push('older version');
  return labels;
}

async function main() {
  const fs = require('fs');
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const repo = process.env.GITHUB_REPOSITORY;
  const headers = { authorization: 'Bearer ' + process.env.GITHUB_TOKEN, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'sweeter-triage' };
  const latest = await fetch('https://api.github.com/repos/' + repo + '/releases/latest', { headers }).then((r) => (r.ok ? r.json() : null));
  const labels = labelsFor(event.issue.body, latest && latest.tag_name);
  const r = await fetch('https://api.github.com/repos/' + repo + '/issues/' + event.issue.number + '/labels', { method: 'POST', headers, body: JSON.stringify({ labels }) });
  if (!r.ok) throw new Error('labels: HTTP ' + r.status);
  console.log('#' + event.issue.number + ': ' + labels.join(', '));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
module.exports = { field, isOlder, labelsFor };
