// Records Sweeter's download counts (and, with TRAFFIC_TOKEN, the repo's
// traffic) into CSV files plus a README summary, in the directory given as
// the first argument: the `stats` branch, checked out by
// .github/workflows/stats.yml. GitHub keeps only lifetime download totals
// and 14 days of traffic, so a daily snapshot is the history.
//
//   GITHUB_TOKEN=… [TRAFFIC_TOKEN=…] node scripts/stats.mjs <dir>
//
// Traffic needs a token with Administration: read on the repo, which the
// Actions GITHUB_TOKEN cannot have; without TRAFFIC_TOKEN it is skipped.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const repo = process.env.GITHUB_REPOSITORY || 'starl3xx/sweeter';
const token = process.env.GITHUB_TOKEN;
const trafficToken = process.env.TRAFFIC_TOKEN;
if (!dir || !token) {
  console.error('usage: GITHUB_TOKEN=… [TRAFFIC_TOKEN=…] node scripts/stats.mjs <dir>');
  process.exit(2);
}
const today = new Date().toISOString().slice(0, 10);

async function api(p, tok) {
  const r = await fetch('https://api.github.com/repos/' + repo + p, {
    headers: { authorization: 'Bearer ' + tok, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'sweeter-stats' },
  });
  if (!r.ok) throw new Error(p + ': HTTP ' + r.status);
  return r.json();
}

// A CSV keyed by its first `keys` columns: rows for the same key replace
// the old ones (a rerun on the same day, or a traffic day GitHub revised).
function upsert(file, header, keys, rows) {
  const f = path.join(dir, file);
  const map = new Map();
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').trim().split('\n').slice(1)) {
      if (!line) continue;
      const cells = parseLine(line);
      map.set(cells.slice(0, keys).join('\u0000'), cells);
    }
  }
  for (const row of rows) map.set(row.slice(0, keys).map(String).join('\u0000'), row.map(String));
  const out = [...map.values()].sort((a, b) => a.slice(0, keys).join('\u0000').localeCompare(b.slice(0, keys).join('\u0000')));
  fs.writeFileSync(f, [header.join(','), ...out.map((r) => r.map(cell).join(','))].join('\n') + '\n');
  return out;
}
function cell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function parseLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const releases = [];
for (let page = 1; ; page++) {
  const batch = await api('/releases?per_page=100&page=' + page, token);
  releases.push(...batch);
  if (batch.length < 100) break;
}
const assetRows = [];
for (const rel of releases) for (const a of rel.assets) assetRows.push([today, rel.tag_name, a.name, a.download_count]);
const downloads = upsert('downloads.csv', ['date', 'release', 'file', 'downloads'], 3, assetRows);

let traffic = null;
let trafficError = null;
if (trafficToken) {
  // A bad or expired token must not cost the day's download counts: they
  // are saved anyway, and the run fails at the end so GitHub emails.
  try {
    const views = await api('/traffic/views', trafficToken);
    const clones = await api('/traffic/clones', trafficToken);
    const referrers = await api('/traffic/popular/referrers', trafficToken);
    traffic = {
      // GitHub's own 14-day totals (days with no views are left out of the
      // daily list, so counting rows would span more than 14 days).
      total: { views: views.count, uniques: views.uniques },
      views: upsert('views.csv', ['date', 'views', 'unique_visitors'], 1, views.views.map((d) => [d.timestamp.slice(0, 10), d.count, d.uniques])),
      clones: upsert('clones.csv', ['date', 'clones', 'unique_cloners'], 1, clones.clones.map((d) => [d.timestamp.slice(0, 10), d.count, d.uniques])),
      referrers: upsert('referrers.csv', ['date', 'referrer', 'views_14_days', 'unique_visitors_14_days'], 2, referrers.map((r) => [today, r.referrer, r.count, r.uniques])),
    };
  } catch (e) {
    trafficError = e.message;
  }
} else console.log('TRAFFIC_TOKEN not set: traffic skipped, downloads recorded.');

// README: the latest totals, so the branch page is the dashboard.
const latest = new Map();
for (const [date, rel, file, n] of downloads) {
  const k = rel + '\u0000' + file;
  if (!latest.has(k) || latest.get(k).date < date) latest.set(k, { date, rel, file, n: Number(n) });
}
const rows = [...latest.values()].sort((a, b) => b.rel.localeCompare(a.rel, undefined, { numeric: true }));
const total = rows.reduce((s, r) => s + r.n, 0);
let md = '# Sweeter download stats\n\nUpdated ' + today + ' by `.github/workflows/stats.yml` on main. The CSV files here are the full daily history.\n\n';
md += '## Downloads\n\n**' + total + '** in total (every file of every release, as GitHub counts them, bots and repeats included).\n\n| Release | File | Downloads |\n|---|---|---:|\n';
md += rows.map((r) => '| ' + r.rel + ' | ' + r.file + ' | ' + r.n + ' |').join('\n') + '\n';
if (traffic) {
  md += '\n## Repo traffic, last 14 days\n\n' + traffic.total.views + ' views from ' + traffic.total.uniques + ' unique visitors. History: `views.csv`, `clones.csv`, `referrers.csv`.\n';
  const refs = traffic.referrers.filter((r) => r[0] === today);
  if (refs.length) md += '\n| Referrer | Views | Unique |\n|---|---:|---:|\n' + refs.map((r) => '| ' + r[1] + ' | ' + r[2] + ' | ' + r[3] + ' |').join('\n') + '\n';
} else if (trafficError) md += '\nRepo traffic was not recorded on ' + today + ' (' + trafficError + '): the TRAFFIC_TOKEN secret is wrong or expired. Earlier days stay in the CSV files.\n';
else md += '\nRepo traffic is not recorded yet: it needs the TRAFFIC_TOKEN secret (see `scripts/stats.mjs`).\n';
fs.writeFileSync(path.join(dir, 'README.md'), md);
console.log('downloads: ' + total + ' total across ' + rows.length + ' files' + (traffic ? '; traffic recorded' : ''));
if (trafficError) {
  console.log('::error::Traffic not recorded (' + trafficError + '). Downloads were saved. Check the TRAFFIC_TOKEN secret.');
  process.exitCode = 1;
}
