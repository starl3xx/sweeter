// All Sweeter CSS, adopted into the shadow root. Skin tokens come from
// Tweetbot 3.5.8’s Colors.plist (Global and Dark themes), read from the app
// bundle on 2026-09-28. X Pro’s CSP allows no web fonts from us, so every
// skin uses system fonts (Tweetbot did too).
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  const LIGHT = `
    --bg:#FFFFFF; --sub:#F5F5F5; --tint:#EBF4FF; --div:#E6E6E6; --sep:#E6E6E6;
    --t1:#000000; --t2:#4D4D4D; --t3:#767676; --accent:#4590E6; --accent-hl:rgba(69,144,230,.5);
    --mention:#F2F8FF; --sel:#EBF4FF; --selsep:#D9EBFF; --gutter:#B3B3B3; --quote:#F7F7F7; --mquote:#EBF1F7;
    --fav:#E64545; --rt:#E68A2E; --likeic:#E60026; --act:rgba(0,0,0,.2);
    --side:#2C2D30; --side-fg:rgba(255,255,255,.5); --side-on:#FFFFFF;
    --pill:rgba(0,0,0,.3); --pill-fg:#FFFFFF; --sheet:#FFFFFF; --field:#F5F5F5; --shadow:rgba(0,0,0,.25);
    --accent-solid:#4590E6; --accent-solid-press:#3D80CC; --on-accent:#FFFFFF; --img-ring:rgba(0,0,0,.08); --ring:rgba(0,0,0,.08); --thumb:rgba(0,0,0,.34);
    --thread:#CFD3D8;
    --glow-sky:rgba(126,192,250,.30); --glow-pink:rgba(238,90,142,.20); --glow-shadow:rgba(238,90,142,.22);`;
  const DARK = `
    --bg:#262626; --sub:#1A1A1A; --tint:#45484C; --div:#404040; --sep:#333333;
    --t1:#FFFFFF; --t2:#CCCCCC; --t3:#999999; --accent:#B2D6FF; --accent-hl:rgba(178,214,255,.5);
    --mention:#393C40; --sel:#45484C; --selsep:#5C6166; --gutter:#000000; --quote:#404040; --mquote:#45484C;
    --act:#666666; --side:#1C1C1E; --sheet:#2E2E30; --field:#1A1A1A; --shadow:rgba(0,0,0,.6);
    --img-ring:rgba(255,255,255,.08); --ring:rgba(255,255,255,.1); --thumb:rgba(255,255,255,.38);
    --thread:#4A4D52;
    --glow-sky:rgba(126,192,250,.22); --glow-pink:rgba(238,90,142,.18); --glow-shadow:rgba(238,90,142,.35);`;

  // Accent color, contrast and pure black (from Ivory’s theme options).
  // The page sets --al and --ad (the accent for light and dark themes).
  // Light rules come first, so “Match system” in dark mode ends on the dark
  // ones; each dark rule sets every token its light rule sets.
  const light = (sel, body) => `.app[data-skin="light"]${sel},.app[data-skin="system"]${sel}{${body}}`;
  const dark = (sel, body) => `.app[data-skin="dark"]${sel}{${body}}\n@media (prefers-color-scheme:dark){.app[data-skin="system"]${sel}{${body}}}`;
  const HIGH_LIGHT = '--t1:#000000;--t2:#1F1F1F;--t3:#595959;--div:#C7C7C7;--sep:#CFCFCF;--thread:#A3A8AE;--img-ring:rgba(0,0,0,.16)';
  const HIGH_DARK = '--t1:#FFFFFF;--t2:#EBEBEB;--t3:#BDBDBD;--div:#5C5C5C;--sep:#4A4A4A;--thread:#6B6F75;--img-ring:rgba(255,255,255,.16)';
  const THEMES = [
    light('[data-accent]', '--accent:var(--al);--accent-solid:var(--al);--accent-solid-press:color-mix(in srgb,var(--al) 86%,#000);--accent-hl:color-mix(in srgb,var(--al) 50%,transparent);--tint:color-mix(in srgb,var(--al) 10%,#fff);--sel:color-mix(in srgb,var(--al) 10%,#fff);--selsep:color-mix(in srgb,var(--al) 18%,#fff);--mention:color-mix(in srgb,var(--al) 5%,#fff);--mquote:color-mix(in srgb,var(--al) 7%,#F7F7F7)'),
    light('[data-contrast="high"]', HIGH_LIGHT),
    // Standard contrast follows macOS’s Increase Contrast (System Settings ▸
    // Accessibility ▸ Display): High’s tokens, while it is on.
    '@media (prefers-contrast:more){' + light(':not([data-contrast])', HIGH_LIGHT) + '}',
    light('[data-contrast="low"]', '--t1:#262626;--t2:#5E5E5E;--t3:#8A8A8A;--div:#EFEFEF;--sep:#F2F2F2;--thread:#DADDE1;--img-ring:rgba(0,0,0,.05)'),
    dark('[data-accent]', '--accent:var(--ad);--accent-solid:var(--al);--accent-solid-press:color-mix(in srgb,var(--al) 86%,#000);--accent-hl:color-mix(in srgb,var(--ad) 50%,transparent);--tint:#45484C;--sel:#45484C;--selsep:#5C6166;--mention:color-mix(in srgb,var(--al) 12%,#262626);--mquote:#45484C'),
    dark('[data-contrast="high"]', HIGH_DARK),
    '@media (prefers-contrast:more){' + dark(':not([data-contrast])', HIGH_DARK) + '}',
    dark('[data-contrast="low"]', '--t1:#E0E0E0;--t2:#ADADAD;--t3:#8A8A8A;--div:#353535;--sep:#2E2E2E;--thread:#3E4146;--img-ring:rgba(255,255,255,.05)'),
    dark('[data-black]', '--bg:#000000;--sub:#0A0A0A;--quote:#161616;--mquote:#1C1C1E;--div:#262626;--sep:#1C1C1C;--gutter:#1C1C1E;--mention:#0E1216;--sel:#1C1F24;--selsep:#2A2F36;--tint:#1C1F24;--sheet:#1C1C1E;--field:#0A0A0A;--side:#000000'),
    dark('[data-black][data-contrast="high"]', '--div:#3D3D3D;--sep:#2E2E2E'),
    '@media (prefers-contrast:more){' + dark('[data-black]:not([data-contrast])', '--div:#3D3D3D;--sep:#2E2E2E') + '}',
    // A column’s own color: the light or the dark shade of it.
    light(' .col[data-tint]', '--ctint:var(--cl)'),
    dark(' .col[data-tint]', '--ctint:var(--cd)'),
    light(' .ip[data-tint]', '--ipc:var(--cl)'),
    dark(' .ip[data-tint]', '--ipc:var(--cd)'),
    light(' .ipsw', '--sw:var(--cl)'),
    dark(' .ipsw', '--sw:var(--cd)'),
  ].join('\n');


  // Themes beyond Classic: a light and a dark set of tokens each, taken from
  // the palette's own published colors (Catppuccin's palette.json, Nord,
  // Dracula's spec with Alucard), and Sweeter's from its app icon. app.js
  // lists them in Settings ▸ General ▸ Theme; the tests hold their contrast.
  const PALETTES = {
    sweeter: { name: 'Sweeter', mark: '#EE5A8E', light: { 'bg': '#FFFFFF', 'sub': '#F3F8FE', 'tint': '#EAF4FF', 'div': '#E3ECF6', 'sep': '#EAF1F8', 't1': '#1D1726', 't2': '#4E4459', 't3': '#756B82', 'accent': '#2F7FE0', 'mention': '#FFF4F8', 'sel': '#EAF4FF', 'selsep': '#D3E8FF', 'gutter': '#C7B9CD', 'quote': '#F7FAFE', 'mquote': '#FFF0F5', 'fav': '#E8457F', 'rt': '#E8861C', 'likeic': '#E8457F', 'side': '#4A2D52', 'sheet': '#FFFFFF', 'field': '#F3F8FE', 'accent-solid': '#D84A80', 'accent-solid-press': '#C93E73', 'thread': '#F3C1D5' }, dark: { 'bg': '#1C1825', 'sub': '#16121D', 'tint': '#2A2236', 'div': '#2E2738', 'sep': '#262030', 't1': '#F7F2FA', 't2': '#D3C9DB', 't3': '#9C91A8', 'accent': '#7EC0FA', 'mention': '#2A1F2C', 'sel': '#2A2236', 'selsep': '#3A3049', 'gutter': '#0E0B12', 'quote': '#241E2E', 'mquote': '#2C2437', 'fav': '#FF8FB5', 'rt': '#FFAA2C', 'likeic': '#FF8FB5', 'side': '#120E17', 'sheet': '#241E2E', 'field': '#16121D', 'accent-solid': '#D84A80', 'accent-solid-press': '#C93E73', 'thread': '#5A3A55' } },
    catppuccin: { name: 'Catppuccin', mark: '#8839EF', light: { 'bg': '#EFF1F5', 'sub': '#E6E9EF', 'tint': '#E1E6F5', 'div': '#DCE0E8', 'sep': '#E2E5EC', 't1': '#4C4F69', 't2': '#5C5F77', 't3': '#6C6F85', 'accent': '#1E66F5', 'mention': '#E9E3F8', 'sel': '#E1E6F5', 'selsep': '#CCD5F2', 'gutter': '#9CA0B0', 'quote': '#E6E9EF', 'mquote': '#DCE0E8', 'fav': '#D20F39', 'rt': '#FE640B', 'likeic': '#D20F39', 'side': '#181825', 'sheet': '#EFF1F5', 'field': '#E6E9EF', 'accent-solid': '#8839EF', 'accent-solid-press': '#7530D1', 'thread': '#BCC0CC' }, dark: { 'bg': '#1E1E2E', 'sub': '#181825', 'tint': '#313244', 'div': '#313244', 'sep': '#28283A', 't1': '#CDD6F4', 't2': '#BAC2DE', 't3': '#A6ADC8', 'accent': '#89B4FA', 'mention': '#2A2740', 'sel': '#313244', 'selsep': '#45475A', 'gutter': '#11111B', 'quote': '#252536', 'mquote': '#313244', 'fav': '#F38BA8', 'rt': '#FAB387', 'likeic': '#F38BA8', 'side': '#11111B', 'sheet': '#252536', 'field': '#181825', 'accent-solid': '#CBA6F7', 'accent-solid-press': '#B48EE8', 'thread': '#45475A', 'on-accent': '#1E1E2E' } },
    nord: { name: 'Nord', mark: '#5E81AC', light: { 'bg': '#ECEFF4', 'sub': '#E5E9F0', 'tint': '#DEE6EF', 'div': '#D8DEE9', 'sep': '#DEE3EC', 't1': '#2E3440', 't2': '#3B4252', 't3': '#4C566A', 'accent': '#5E81AC', 'mention': '#E1E9F2', 'sel': '#DEE6EF', 'selsep': '#CDD9E8', 'gutter': '#A4ADBD', 'quote': '#E5E9F0', 'mquote': '#D8DEE9', 'fav': '#BF616A', 'rt': '#D08770', 'likeic': '#BF616A', 'side': '#2E3440', 'sheet': '#ECEFF4', 'field': '#E5E9F0', 'accent-solid': '#5E81AC', 'accent-solid-press': '#51719A', 'thread': '#C9D1DD' }, dark: { 'bg': '#2E3440', 'sub': '#272C36', 'tint': '#3B4252', 'div': '#3B4252', 'sep': '#353B48', 't1': '#ECEFF4', 't2': '#D8DEE9', 't3': '#A3ADBF', 'accent': '#88C0D0', 'mention': '#343B4A', 'sel': '#3B4252', 'selsep': '#434C5E', 'gutter': '#20242C', 'quote': '#3B4252', 'mquote': '#434C5E', 'fav': '#BF616A', 'rt': '#D08770', 'likeic': '#BF616A', 'side': '#242933', 'sheet': '#3B4252', 'field': '#272C36', 'accent-solid': '#5E81AC', 'accent-solid-press': '#51719A', 'thread': '#4C566A' } },
    dracula: { name: 'Dracula', mark: '#BD93F9', light: { 'bg': '#FFFBEB', 'sub': '#F6F1DE', 'tint': '#ECEAF4', 'div': '#E8E2CC', 'sep': '#EEE9D6', 't1': '#1F1F1F', 't2': '#3E3B30', 't3': '#6C664B', 'accent': '#644AC9', 'mention': '#F3EEF8', 'sel': '#ECEAF4', 'selsep': '#CFCFDE', 'gutter': '#B9B39A', 'quote': '#F6F1DE', 'mquote': '#ECEAF4', 'fav': '#CB3A2A', 'rt': '#14710A', 'likeic': '#CB3A2A', 'side': '#282A36', 'sheet': '#FFFBEB', 'field': '#F6F1DE', 'accent-solid': '#644AC9', 'accent-solid-press': '#5640AF', 'thread': '#D9D3BC' }, dark: { 'bg': '#282A36', 'sub': '#21222C', 'tint': '#44475A', 'div': '#44475A', 'sep': '#343746', 't1': '#F8F8F2', 't2': '#E2E2DC', 't3': '#9AA5CE', 'accent': '#BD93F9', 'mention': '#33303F', 'sel': '#44475A', 'selsep': '#6272A4', 'gutter': '#191A21', 'quote': '#343746', 'mquote': '#44475A', 'fav': '#FF5555', 'rt': '#50FA7B', 'likeic': '#FF5555', 'side': '#191A21', 'sheet': '#343746', 'field': '#21222C', 'accent-solid': '#FF79C6', 'accent-solid-press': '#E86BB2', 'thread': '#44475A', 'on-accent': '#282A36' } },
  };
  const hexA = (hex, a) => 'rgba(' + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
  const paletteTokens = (t) => Object.entries(Object.assign({ 'accent-hl': hexA(t.accent, 0.5) }, t)).map(([k, v]) => '--' + k + ':' + v).join(';');
  const PALETTE_CSS = Object.entries(PALETTES)
    .map(([id, p]) => light('[data-palette="' + id + '"]', paletteTokens(p.light)) + '\n' + dark('[data-palette="' + id + '"]', paletteTokens(p.dark)))
    .concat([
      // Contrast within a theme's own colors: High lifts quiet text to
      // secondary (as macOS's Increase Contrast does), Low softens body text.
      light('[data-palette][data-contrast="high"]', '--t3:var(--t2)'),
      dark('[data-palette][data-contrast="high"]', '--t3:var(--t2)'),
      '@media (prefers-contrast:more){' + light('[data-palette]:not([data-contrast])', '--t3:var(--t2)') + dark('[data-palette]:not([data-contrast])', '--t3:var(--t2)') + '}',
      light('[data-palette][data-contrast="low"]', '--t1:var(--t2)'),
      dark('[data-palette][data-contrast="low"]', '--t1:var(--t2)'),
      dark('[data-palette][data-black]', '--bg:#000000;--sub:#000000;--gutter:#000000;--side:#000000'),
    ])
    .join('\n');
  Sweeter.PALETTES = PALETTES;

  // The coin a token pill shows until its logo is known (a CSS mask).
  const COIN = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><path d="' + ((Sweeter.SYMBOLS && Sweeter.SYMBOLS.coin) || '') + '"/></svg>') + '")';

  Sweeter.css = `
:host{all:initial}
.app,.popout{--coin:${COIN}}
*{box-sizing:border-box}
.app{${LIGHT}
  --fs:14px; --chh:26px; --av:calc(var(--fs) * 2.475); /* avatar: 75% of Tweetbot’s 3.3em */ --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;
  position:fixed;inset:0;display:flex;background:var(--gutter);color:var(--t2);
  font-family:var(--font);font-size:var(--fs);line-height:1.32;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  pointer-events:auto;z-index:1;outline:none}
.app[hidden]{display:none}
.app[data-skin="dark"]{${DARK}}
@media (prefers-color-scheme:dark){.app[data-skin="system"]{${DARK}}}
${THEMES}
${PALETTE_CSS}
a{color:inherit;text-decoration:none;text-underline-position:from-font;text-decoration-skip-ink:auto}
button{font:inherit;color:inherit}
img{display:block}

/* sidebar: 76 px, Tweetbot’s compact mode. In the Mac app the window’s
   buttons sit at its top, above the avatar. */
.app.native .side{padding-top:38px}
/* Mac app: a real translucent sidebar shows through (drawn by AppKit), the
   arrow cursor on controls, and only post text can be selected. */
.app.native{cursor:default;-webkit-user-select:none;user-select:none}
.app.native.translucent{background:transparent}
.app.native .cols{background:var(--gutter)}
.app.native.translucent .side{background:transparent;border-right-color:rgba(0,0,0,.45)}
.app.native button,.app.native .ch,.app.native .tab,.app.native .round,.app.native .pill,.app.native .media .m,.app.native .quote,.app.native .card{cursor:default}
.app.native .tx,.app.native .quote .tx,.app.native .fmeta,.app.native textarea,.app.native input{-webkit-user-select:text;user-select:text;cursor:auto}
.app.native .tx a,.app.native .rtop a,.app.native .meta a,.app.native .atx a{cursor:pointer}
.side{flex:0 0 76px;background:var(--side);display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:4px;border-right:1px solid #000}
.me{flex:none;border:0;padding:0;cursor:pointer;width:40px;height:40px;border-radius:50%;background:#555 center/cover no-repeat;margin-bottom:10px;box-shadow:0 0 0 2px rgba(255,255,255,.15);display:grid;place-items:center;color:#fff;font-weight:700}
.tab{position:relative;width:44px;height:38px;display:grid;place-items:center;background:none;border:0;border-radius:8px;color:var(--side-fg);cursor:pointer}
.tab svg{width:22px;height:22px}
.tab.on{color:var(--side-on);background:rgba(255,255,255,.08)}
.tab .dot{position:absolute;left:2px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--accent-solid)}
.tab .num{position:absolute;right:0;top:1px;font-size:10px;font-weight:700;color:var(--on-accent);background:var(--accent-solid);border-radius:8px;padding:0 4px;line-height:14px}
.spacer{flex:1}
.round{width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:rgba(255,255,255,.75);display:grid;place-items:center;cursor:pointer}
.round svg{width:19px;height:19px}
.round.post{width:46px;height:46px;background:var(--accent-solid);color:var(--on-accent);margin-bottom:8px;box-shadow:0 3px 10px rgba(0,0,0,.35)}
.round.post svg{width:22px;height:22px}
.round[hidden]{display:none}
.round.upd{position:relative;color:var(--accent-solid);margin-bottom:8px}
.round.upd::after{content:"";position:absolute;top:2px;right:2px;width:9px;height:9px;border-radius:50%;background:var(--accent-solid);box-shadow:0 0 0 2px var(--side,#1C1C1E)}

/* columns */
/* Sizes come from flex-basis, never from content: with flex:1 1 auto the
   browser measured the max-content width of every post each time a cell
   changed (most of Sweeter's idle CPU, measured 2026-10-02). */
.cols{flex:1 1 0;display:flex;gap:1px;overflow-x:auto;overflow-y:hidden;min-width:0;scrollbar-width:thin}
.col{flex:1 0 var(--colw,345px);max-width:520px;display:flex;flex-direction:column;background:var(--bg);min-width:0;position:relative;contain:layout paint;contain:layout paint inline-size;container:col/inline-size}
.col:nth-last-child(1 of .col){max-width:none}
/* A column the person sized (drag its right edge; Sweeter only). */
.col.sized{flex:0 0 var(--w);max-width:none}
.col.removing{display:none}
.rsz{position:absolute;top:0;right:0;bottom:0;width:6px;cursor:col-resize;z-index:4;touch-action:none}
.rsz::after{content:"";position:absolute;top:0;bottom:0;right:2px;width:2px;border-radius:1px;background:var(--accent-solid);opacity:0;transition:opacity .15s}
.col.resizing .rsz::after{opacity:1}
.col.resizing{user-select:none}
.col.flash .ch{animation:sweeter-flash 1.3s ease-out}
@keyframes sweeter-flash{0%{background:color-mix(in srgb,var(--accent) 34%,var(--bg))}100%{background:var(--bg)}}
/* The column menu “…” shows on hover and keyboard focus. */
.ch .mini.cmenu{opacity:0;transition:opacity .15s}
.ch .mini.cmenu:focus-visible{opacity:1}
@media (hover:none){.ch .mini.cmenu{opacity:1}}
@media (hover:hover){.ch:hover .mini.cmenu{opacity:1}.rsz:hover::after{opacity:.55}}
.col.focus .ch{box-shadow:inset 0 -2px 0 var(--accent)}
.ch{height:var(--chh);flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:0 6px 0 10px;border-bottom:1px solid var(--div);background:var(--bg);color:var(--t1);font-weight:600;font-size:12px}
.ch .ct{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch{cursor:pointer}
.ch .live{display:none;width:6px;height:6px;border-radius:50%;background:var(--accent);flex:0 0 auto}
.col.pinned .ch .live{display:block}
.ch .cs{font-weight:400;color:var(--t3);font-size:10.5px;white-space:nowrap}
/* A column X Pro shows as another account: readable, never acted from. */
.col.delegated .ch .cs{color:var(--rt);font-weight:600}
.col.delegated .acts{opacity:.4}
.pill{margin-left:auto;background:var(--pill);color:var(--pill-fg);font-size:10px;font-weight:600;border:0;border-radius:99px;padding:1px 7px;cursor:pointer;font-variant-numeric:tabular-nums}
.pill[hidden]{display:none}
.pill,.ch .mini,.x,.more,.dback{position:relative}
.pill::after,.ch .mini::after,.x::after,.more::after{content:"";position:absolute;inset:-6px}
.ch .mini{background:none;border:0;color:var(--t3);cursor:pointer;padding:2px;border-radius:4px;display:grid;place-items:center}
.ch .mini svg{width:14px;height:14px}
.pill:not([hidden]) + .mini{margin-left:0}
.pill[hidden] + .mini{margin-left:auto}
/* Filters: the funnel fills and a chip names what is on. Find replaces the
   title with a field while it is open. */
.ch .fchip{flex:0 1 auto;min-width:0;max-width:50%;border:0;border-radius:99px;padding:1px 7px;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent);font:inherit;font-size:10.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.ch .fchip[hidden],.ch .find[hidden],.ch .fnum[hidden]{display:none}
.ch .mini.flt.on{color:var(--accent)}
.col[data-kind="notifications"] .ch .flt{display:none}
.col[data-kind="notifications"] .pill[hidden] + .flt + .mini{margin-left:auto}
.col.finding .ch .ct,.col.finding .ch .cs,.col.finding .ch .live,.col.finding .ch .fchip{display:none}
.ch .find{-webkit-appearance:none;appearance:none;flex:1 1 auto;min-width:0;height:19px;margin:0;font:inherit;font-size:12px;font-weight:400;color:var(--t1);background:var(--field);border:1px solid var(--div);border-radius:5px;padding:0 6px;outline:none;cursor:text}
.ch .find:focus{border-color:var(--accent-solid);box-shadow:0 0 0 2px var(--accent-hl)}
.ch .fnum{font-size:10.5px;font-weight:500;color:var(--t3);font-variant-numeric:tabular-nums;white-space:nowrap}
::highlight(sweeter-find){background-color:rgba(255,204,0,.5);color:inherit}
.scroll{flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
.scroll::-webkit-scrollbar,.dscroll::-webkit-scrollbar{display:none;width:0;height:0}
/* Overlay scroll bar: drawn over the column so the posts keep the full
   width. It appears while scrolling or hovering, and the thumb drags. */
.sbar{position:absolute;right:0;bottom:0;width:12px;z-index:3;opacity:0;pointer-events:none;transition:opacity .25s ease}
.sbar.on{opacity:1;pointer-events:auto}
.sbar[hidden]{display:none}
.sthumb{position:absolute;right:2px;top:0;width:6px;border-radius:3px;background:var(--thumb);transition:width .12s ease-out;will-change:transform}
.sbar.drag .sthumb{width:8px}
.empty{padding:40px 16px;text-align:center;color:var(--t3)}
.foot{padding:14px;text-align:center;color:var(--t3);font-size:.86em}

/* cells */
.cell{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding:10px 12px 9px;border-bottom:1px solid var(--sep);background:var(--bg)}
.cell.mention{background:var(--mention);box-shadow:inset 3px 0 0 var(--accent-solid)}
.cell.sel{background:var(--sel);border-bottom-color:var(--selsep)}
.thread .cell{border-bottom:0}
.thread{border-bottom:1px solid var(--sep)}
/* thread line: from under each avatar to the next avatar, unbroken across
   the cell boundary (the part below one avatar plus the part above the next) */
.thread .cell:not(:last-child)::after,.dlist .cell.ancestor::after{content:"";position:absolute;left:calc(12px + var(--av) / 2 - 1px);top:calc(10px + var(--av) + 4px);bottom:0;width:2px;border-radius:1px;background:var(--thread);pointer-events:none}
.thread .cell + .cell::before,.dlist .cell.ancestor + .cell::before{content:"";position:absolute;left:calc(12px + var(--av) / 2 - 1px);top:0;height:6px;width:2px;border-radius:0 0 1px 1px;background:var(--thread);pointer-events:none}
.av,.qav,.minis img,.aff,.media .m,.card img,.cm,.qm,.me{outline:1px solid var(--img-ring);outline-offset:-1px}
.avl{display:block;line-height:0;align-self:start;border-radius:50%}
.minis a{display:block;line-height:0}
.atx a.who{color:inherit}
.av{width:calc(var(--av));height:calc(var(--av));border-radius:6px;background:var(--sub);object-fit:cover;flex:0 0 auto;cursor:pointer}
.app[data-round="true"] .av{border-radius:50%}
.main{min-width:0}
.meta{display:flex;align-items:baseline;gap:5px;min-width:0}
.nm{color:var(--t1);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;cursor:pointer}
.hd{color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;cursor:pointer}
.lock{width:11px;height:11px;color:var(--t3);flex:0 0 auto;align-self:center}
/* checkmarks and organization badges */
.vb{display:inline-flex;flex:0 0 auto;align-self:center;width:1.08em;height:1.08em;margin-left:-1px}
.vb svg{width:100%;height:100%}
.vb.blue{color:#1D9BF0}.vb.gold{color:#E2B719}.vb.gray{color:#829AAB}
.aff{display:inline-block;flex:0 0 auto;align-self:center;width:1.02em;height:1.02em;border-radius:3px;object-fit:cover;border:1px solid var(--div);background:var(--sub)}
.atx .vb,.atx .aff{vertical-align:-0.16em;margin:0 1px 0 3px}
.atx b[data-profile]{cursor:pointer}
.app[data-names="full"] .hd{display:none}
.app[data-names="user"] .nm{display:none}
.app[data-names="user"] .hd{color:var(--t1);font-weight:700}
.tm{margin-left:auto;color:var(--t3);font-size:.86em;white-space:nowrap;padding-left:6px;font-variant-numeric:tabular-nums}
.rpl{color:var(--t3);font-size:.86em;margin-top:1px}
.tx{margin-top:2px;color:var(--t2);overflow-wrap:anywhere;white-space:normal;text-wrap:pretty}
.atx,.snip,.hint,.note,.cpv,.fmeta,.dfoot,.empty{text-wrap:pretty}
.ptitle,.boot-t{text-wrap:balance}
.tx a.m,.tx a.u{color:var(--accent)}
.tx a.m{font-weight:600}
.tx a.h{color:var(--t3)}
/* long posts fold to a few lines until opened */
.tx.long:not(.open){display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
.more{display:block;justify-self:start;text-align:left;border:0;background:none;padding:3px 0 0;color:var(--accent);font:inherit;font-size:.9em;font-weight:600;cursor:pointer}
.u .ld,.u .lf{display:none}
.app[data-links="domain"] .u .ls,.app[data-links="full"] .u .ls{display:none}
.app[data-links="domain"] .u .ld{display:inline}
.app[data-links="full"] .u .lf{display:inline;overflow-wrap:anywhere}
.ctx{display:flex;align-items:center;gap:5px;color:var(--t3);font-size:.86em;margin-top:5px}
.rtop{grid-column:1 / -1;display:grid;grid-template-columns:calc(var(--av)) minmax(0,1fr);gap:10px;align-items:center;margin:-3px 0 -6px;color:var(--t3);font-size:.82em;font-weight:600;min-width:0}
.rtop .ri{display:flex;justify-content:flex-end}
.rtop svg{width:14px;height:14px;color:var(--rt)}
.rtop span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctx svg{width:13px;height:13px;color:var(--rt);flex:0 0 auto}
.quote{margin-top:7px;background:var(--quote);border-radius:6px;padding:7px 9px;font-size:.93em;cursor:pointer}
.cell.mention .quote{background:var(--mquote)}
.quote .meta{gap:4px}
.quote .qav{width:16px;height:16px;border-radius:4px;align-self:center}
.app[data-round="true"] .quote .qav{border-radius:50%}
.quote .tx{-webkit-line-clamp:6;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.quote .qm{float:right;width:calc(var(--fs) * 3.6);height:calc(var(--fs) * 3.6);object-fit:cover;border-radius:4px;margin:3px 0 4px 8px;background:var(--sub)}
.quote::after{content:"";display:block;clear:both}
.gone{color:var(--t3);font-style:italic}

/* media */
.media{position:relative;margin-top:8px;display:grid;gap:2px;border-radius:6px;overflow:hidden;grid-template-columns:1fr 1fr;height:calc(var(--fs) * 12);background:var(--sub)}
.media.n1{grid-template-columns:1fr}
.media.n3 .m:first-child{grid-row:span 2}
.media .m{position:relative;overflow:hidden;cursor:zoom-in;background:var(--sub);min-height:0}
.media img,.media video{width:100%;height:100%;object-fit:cover}
.media.n1.tall{height:calc(var(--fs) * 18)}
.media .play{position:absolute;inset:0;display:grid;place-items:center;cursor:pointer}
.media .play i{width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.55);display:grid;place-items:center}
.media .play svg{width:18px;height:18px;color:#fff;margin-left:3px}
.media .dur{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;border-radius:4px;padding:1px 5px;font-variant-numeric:tabular-nums}
.media .gif{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;font-weight:700;border-radius:4px;padding:1px 5px}
/* whole images: each thumbnail keeps its own shape, nothing is cropped */
.media.full{display:flex;flex-wrap:wrap;gap:4px;height:auto;background:none;border-radius:0;overflow:visible}
.media.full .m{aspect-ratio:var(--r);height:calc(var(--fs) * 9.5);width:auto;max-width:100%;flex:0 0 auto;border-radius:6px;overflow:hidden;background:var(--sub)}
.media.full.one .m{height:auto;width:min(100%, calc(var(--fs) * 24 * var(--r)))}
.media.full img,.media.full video{object-fit:contain}
.media.full.sensitive::after{border-radius:6px}
.media video{display:block;width:100%;height:100%;object-fit:cover;background:#000}
.m[data-auto]{cursor:pointer}
/* Small: the thumbnail gets its own column beside the text, so a short post
   grows to fit it and the action buttons run underneath both. */
/* Small thumbnails: the text and the thumbnail share one row (.sm), so
   nothing spans grid rows (a span left blank rows under long posts). */
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .sm{display:flex;align-items:flex-start;gap:10px}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .sm > .smt{flex:1 1 auto;min-width:0}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .sm > .media{flex:0 0 auto;width:calc(var(--fs) * 4.2);height:calc(var(--fs) * 4.2);margin:3px 0 0;grid-template-columns:1fr}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .sm > .media .m:not(:first-child){display:none}
.media.wide{width:66.6%;min-width:180px;max-width:100%;height:auto;aspect-ratio:16 / 10}
.media.wide.n1[style]{aspect-ratio:var(--r);min-width:0;width:min(66.6%, calc(var(--fs) * 16 * var(--r)))}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .media.wide .mcount{display:none}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .media.wide .dur,:is(.app[data-media="small"] .prof,.col[data-media="small"]) .media.wide .gif{display:block}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .media.wide .play i{width:36px;height:36px}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .media .play i{width:24px;height:24px}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .media .dur,:is(.app[data-media="small"] .prof,.col[data-media="small"]) .media .gif{display:none}
.mcount{display:none}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .mcount{display:flex;align-items:center;gap:2px;position:absolute;right:3px;bottom:3px;z-index:1;background:rgba(0,0,0,.72);color:#fff;font-size:10px;font-weight:700;line-height:1;border-radius:4px;padding:2px 4px;font-variant-numeric:tabular-nums;pointer-events:none}
:is(.app[data-media="small"] .prof,.col[data-media="small"]) .mcount svg{width:10px;height:10px}
.sensitive img{filter:blur(18px)}
.sensitive::after{content:"Sensitive media. Click to show.";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:12px;background:rgba(0,0,0,.25)}

/* cards and polls */
.card{margin-top:8px;box-shadow:0 0 0 1px var(--ring),0 1px 2px var(--ring);border-radius:6px;overflow:hidden;display:flex;flex-direction:column;background:var(--bg)}
.card.summary{flex-direction:row}
.card.medium{width:66.6%;min-width:200px;max-width:100%}
.card img{width:100%;aspect-ratio:1.91/1;object-fit:cover;background:var(--sub)}
.card.summary img{width:calc(var(--fs) * 5);height:auto;aspect-ratio:1;flex:0 0 auto}
.card .cb{padding:6px 9px;min-width:0}
.card .cdom{color:var(--t3);font-size:.82em}
.card .ctt{color:var(--t1);font-size:.93em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card.article .ctt{white-space:normal;font-size:1em;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.card.article .cdom{display:flex;align-items:center;gap:4px;font-weight:600}
.card.article .cdom svg{width:12px;height:12px}
.card.article .cpv{margin-top:2px;color:var(--t3);font-size:.86em;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card.article img{aspect-ratio:2.5/1}
.card.article.summary img{aspect-ratio:1}
.poll{margin-top:8px;display:flex;flex-direction:column;gap:4px}
.poll .ch1{position:relative;border-radius:4px;overflow:hidden;background:var(--sub);padding:3px 8px;display:flex;justify-content:space-between;gap:8px;font-size:.93em}
.poll .bar{position:absolute;inset:0 auto 0 0;background:var(--tint)}
.poll .ch1 span{position:relative}
.poll .pmeta{color:var(--t3);font-size:.82em}

/* actions */
.acts{display:none;gap:2px;margin-top:6px;margin-left:-8px}
.acts button,.acts a{background:none;border:0;padding:4px 10px 4px 8px;color:var(--act);cursor:pointer;border-radius:5px;display:flex;align-items:center;gap:4px;font-size:.82em}
.cell.sel .acts button,.cell.sel .acts a,.cell.sel .acts .vw{color:var(--accent)}
.acts svg{width:17px;height:17px}
.acts .on-like{color:var(--fav) !important}
.acts .on-rt{color:var(--rt) !important}
.acts .on-bm{color:var(--accent) !important}
.acts .cnt{font-variant-numeric:tabular-nums}
.acts .vw{display:flex;align-items:center;gap:4px;padding:4px 10px 4px 8px;color:var(--act);font-size:.82em;cursor:default}
.acts .vw svg{width:15px;height:15px}
/* One line, always, in a column: an item with no room wraps out of sight
   whole (the last first) rather than overflowing the post, whatever the
   font size. The reader's bar is not in a column and keeps every item. */
.col .acts{flex-wrap:wrap;overflow:hidden;height:max(26px,calc(.82em + 9px))}
.col .acts button,.col .acts a,.col .acts .vw{line-height:1}
/* Narrow columns: the bar spans the text's width with tighter buttons, as
   X's does, so its items share what room there is. */
@container col (max-width:31.5em){.acts{justify-content:space-between;gap:0;margin-left:-6px;margin-right:-6px}.acts button,.acts a,.acts .vw{padding:4px 6px;gap:3px}}
/* Narrower still, as few items step aside as the room needs, counting only
   the ones Settings ▸ General ▸ Action bar shows (so turning one off makes
   room for the rest): Open on x.com first (the post's time opens the same
   page), then Copy link, then the view count; the buttons tighten too. */
@container col (max-width:26.5em){.acts:has(> :nth-child(7)) > [data-act="open"],.acts:has(> :nth-child(7)):not(:has(> [data-act="open"])) > [data-act="copy"],.acts:has(> :nth-child(7)):not(:has(> [data-act="open"])):not(:has(> [data-act="copy"])) > .vw{display:none}.acts{margin-left:-4px;margin-right:-4px}.acts button,.acts a,.acts .vw{padding:4px}}
@container col (max-width:22.75em){.acts svg,.acts .vw svg{width:15px;height:15px}.acts button,.acts a,.acts .vw{padding:4px 3px}}
@container col (max-width:21.25em){.acts:has(> :nth-child(6)) > [data-act="open"],.acts:has(> :nth-child(6)):not(:has(> [data-act="open"])) > [data-act="copy"],.acts:has(> :nth-child(7)):has(> [data-act="open"]) > [data-act="copy"],.acts:has(> :nth-child(6)):not(:has(> [data-act="open"])):not(:has(> [data-act="copy"])) > .vw,.acts:has(> :nth-child(7)):has(> [data-act="open"]):not(:has(> [data-act="copy"])) > .vw,.acts:has(> :nth-child(7)):has(> [data-act="copy"]):not(:has(> [data-act="open"])) > .vw{display:none}}
@container col (max-width:20em){.acts:has(> :nth-child(5)) > [data-act="open"],.acts:has(> :nth-child(5)):not(:has(> [data-act="open"])) > [data-act="copy"],.acts:has(> :nth-child(6)):has(> [data-act="open"]) > [data-act="copy"],.acts:has(> :nth-child(5)):not(:has(> [data-act="open"])):not(:has(> [data-act="copy"])) > .vw,.acts:has(> :nth-child(6)):has(> [data-act="open"]):not(:has(> [data-act="copy"])) > .vw,.acts:has(> :nth-child(6)):has(> [data-act="copy"]):not(:has(> [data-act="open"])) > .vw,.acts:has(> :nth-child(7)):has(> [data-act="open"]):has(> [data-act="copy"]) > .vw{display:none}}
.acts button.busy{opacity:.45;pointer-events:none}

/* repost menu */
.tkcs{display:flex;flex-direction:column;gap:6px;margin:8px 0 2px}
.tkc{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto auto;align-items:baseline;gap:8px;width:100%;max-width:440px;box-sizing:border-box;border:1px solid var(--div);border-radius:10px;background:var(--quote);padding:8px 12px;font:inherit;font-size:13px;color:var(--t2);text-align:left;cursor:pointer}
.tkc:hover{background:var(--sub)}
.tkc-l,.tok .tk-l{flex:none;align-self:center;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 16%,var(--sub));color:var(--accent);font-size:11px;font-weight:700;font-style:normal;line-height:1}
.tok .tk-l{width:28px;height:28px;font-size:14px}
.tkc-l.has-logo,.tok .tk-l.has-logo{background:var(--logo) center/cover no-repeat;color:transparent}
.pop .tok .tk-h{align-items:center}
.tkc-s{color:var(--t1);font-weight:600}
.tkc-n{color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tkc-p{color:var(--t1);font-weight:600;font-variant-numeric:tabular-nums}
.tkc-c{font-weight:600;font-variant-numeric:tabular-nums}
.tkc-c.up{color:#2B8F48}
.tkc-c.down{color:#D9443A}
/* Tokens in the text stand apart from links and plain cashtags: a tinted
   pill with a coin (or the token's logo, once known). Addresses keep a
   monospace face. */
.tx a.ca{display:inline-flex;align-items:center;gap:3px;padding:0 5px 0 3px;border-radius:6px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);font-weight:600;white-space:nowrap;text-decoration:none;line-height:1.35;vertical-align:baseline}
.tx a.ca::before{content:'';flex:none;width:1em;height:1em;border-radius:50%;background:currentColor;-webkit-mask:var(--coin) center/contain no-repeat;mask:var(--coin) center/contain no-repeat}
.tx a.ca.has-logo::before{-webkit-mask:none;mask:none;background:var(--logo) center/cover no-repeat}
.tx a.ca:hover{background:color-mix(in srgb,var(--accent) 22%,transparent)}
.tx a.ca:not(.tkl){font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;font-weight:500}
.pop .tok{width:280px;padding:8px 8px 4px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--t2)}
.tok .tk-h{display:flex;align-items:baseline;gap:6px;color:var(--t1)}
.tok .tk-h b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.tok .tk-sym{color:var(--t3);font-size:12px}
.tok .tk-sub,.tok .tk-src{font-size:11.5px;color:var(--t3)}
.tok .tk-price{font-size:18px;font-weight:600;color:var(--t1);font-variant-numeric:tabular-nums}
.tok .tk-price span{font-size:12px;font-weight:600}
.tok .up{color:#2B8F48}
.tok .down{color:#D9443A}
.tok .tk-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-variant-numeric:tabular-nums}
.tok .tk-grid b{text-align:right;font-weight:600;color:var(--t1)}
.tok .tk-a{display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--t3);word-break:break-all;cursor:copy;border-radius:4px;transition:color .15s}
.tok .tk-a:hover{color:var(--t1)}
.tok .tk-a.copied{color:var(--accent)}
.tok .tk-msg{line-height:1.4}
.tok .tk-b{display:flex;flex-direction:column;margin:0 -4px}
.pop{position:fixed;z-index:7;min-width:170px;background:var(--sheet);border-radius:8px;box-shadow:0 0 0 1px var(--ring),0 2px 6px var(--ring),0 10px 30px var(--shadow);padding:4px;display:flex;flex-direction:column}
.pop[hidden]{display:none}
.pop button{display:flex;align-items:center;gap:8px;background:none;border:0;border-radius:4px;padding:7px 10px;text-align:left;font-size:13px;color:var(--t1);cursor:pointer}
.pop button svg{width:16px;height:16px;color:var(--t3)}
.pop .ck{width:14px;flex:0 0 14px;display:grid;place-items:center}
.pop .ck svg{width:13px;height:13px;color:var(--accent-solid)}
.pop .pl2{flex:1 1 auto}
.pop kbd{margin-left:auto;padding-left:18px;font:inherit;font-size:12px;color:var(--t3);font-variant-numeric:tabular-nums}
.pop .psep{height:1px;background:var(--div);margin:4px 6px}
.pop button[disabled]{color:var(--t3);cursor:default}
.app[data-counts="false"] .acts .cnt{display:none}

/* activity */
.act-ic{width:calc(var(--av));display:flex;justify-content:flex-end;padding-top:2px}
.act-ic svg{width:18px;height:18px}
.act-ic.like{color:var(--likeic)}.act-ic.repost{color:var(--rt)}.act-ic.follow,.act-ic.list{color:var(--accent)}.act-ic.bell,.act-ic.news,.act-ic.other,.act-ic.milestone{color:var(--t3)}
.minis{display:flex;gap:4px;margin-bottom:5px;flex-wrap:wrap}
.minis img{width:24px;height:24px;border-radius:5px;background:var(--sub);cursor:pointer}
.app[data-round="true"] .minis img{border-radius:50%}
.atx{color:var(--t2)}
.atx b{color:var(--t1)}
.snip{margin-top:3px;color:var(--t3);-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}

/* reading position */
.marker{position:relative;height:0;margin-top:-1px;z-index:1;pointer-events:none}
/* Where you stopped: an accent line that fades at both ends, with a soft
   glow, and a pill on it. It draws itself in once, when it first appears
   (.fresh); later redraws only move it. */
.marker::before{content:"";position:absolute;left:0;right:0;top:-1px;height:2px;border-radius:1px;background:linear-gradient(90deg,transparent,var(--accent) 16%,var(--accent) 84%,transparent);box-shadow:0 0 10px color-mix(in srgb,var(--accent) 40%,transparent)}
.marker span{position:absolute;left:50%;top:0;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 13%,var(--bg));color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 32%,transparent),0 2px 8px color-mix(in srgb,var(--accent) 16%,transparent);font-size:11px;font-weight:600;line-height:14px;letter-spacing:.01em;white-space:nowrap}
.marker span::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.marker.fresh::before{animation:sweeter-mark-line .55s cubic-bezier(.2,.8,.2,1) both}
.marker.fresh span{animation:sweeter-mark-pill .45s .15s cubic-bezier(.2,.9,.3,1.25) both}
.marker.fresh span::before{animation:sweeter-mark-dot 1.2s .5s ease-out both}
@keyframes sweeter-mark-line{from{transform:scaleX(0);opacity:0}to{transform:none;opacity:1}}
@keyframes sweeter-mark-pill{from{transform:translate(-50%,-50%) scale(.8);opacity:0}to{transform:translate(-50%,-50%);opacity:1}}
@keyframes sweeter-mark-dot{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 45%,transparent)}100%{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}}

/* Settings window, laid out like a Mac settings pane */
/* Profile sheet: the size of Settings, over the columns. */
.prof-back{position:absolute;inset:0;background:rgba(0,0,0,.28);display:grid;place-items:center;z-index:5;padding:24px}
.prof-back[hidden]{display:none}
.prof{position:relative;width:min(600px,100%);height:min(720px,100%);display:flex;flex-direction:column;background:var(--bg);color:var(--t2);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);overflow:hidden;animation:sweeter-sheet .22s cubic-bezier(.2,.85,.25,1)}
.pf-close{position:absolute;right:10px;top:10px;z-index:3;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;display:grid;place-items:center;padding:0;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.pf-close svg{width:13px;height:13px}
.pf-scroll{flex:1 1 0;min-height:0;overflow-y:auto;outline:none;overscroll-behavior:contain}
/* The article reader: a sheet like a profile's, taller and wider, with the
   reader's own typeface (data-font) and text size (--rd-size). */
.rd-back{position:absolute;inset:0;background:rgba(0,0,0,.28);display:grid;place-items:center;z-index:5;padding:24px}
.rd-back[hidden]{display:none}
.rd{--rd-size:18px;--rd-font:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;position:relative;width:min(760px,100%);height:min(1000px,100%);display:flex;flex-direction:column;background:var(--bg);color:var(--t1);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);overflow:hidden;animation:sweeter-sheet .22s cubic-bezier(.2,.85,.25,1)}
.rd[data-font="serif"]{--rd-font:"Iowan Old Style","New York",ui-serif,Georgia,serif}
.rd[data-font="sohne"]{--rd-font:"Söhne",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd[data-font="rounded"]{--rd-font:ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd[data-font="mono"]{--rd-font:ui-monospace,"SF Mono",Menlo,monospace}
.rd-top{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--sep)}
.rd-close,.rd-xo{width:28px;height:28px;display:grid;place-items:center;padding:0;border-radius:6px;color:var(--t2);background:none;border:0;cursor:pointer}
.rd-close svg{width:13px;height:13px}
.rd-xo svg{width:16px;height:16px}
.rd-close:hover,.rd-xo:hover{background:var(--tint)}
.rd-tools{margin:0 auto;display:flex;align-items:center;gap:2px;background:var(--quote);border-radius:8px;padding:2px}
.rd-tools button{height:26px;min-width:32px;padding:0 8px;border:0;border-radius:6px;background:none;color:var(--t2);font:500 13px/1 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;cursor:pointer}
.rd-tools button:hover:not(:disabled):not([aria-pressed="true"]){color:var(--t1)}
.rd-tools button:disabled{opacity:.35;cursor:default}
.rd-sz.s{font-size:11px}
.rd-sz.l{font-size:17px}
.rd-sep{width:1px;height:16px;background:var(--sep);margin:0 4px}
.rd-f[aria-pressed="true"]{background:var(--bg);color:var(--t1);box-shadow:0 1px 2px var(--shadow)}
.rd-f[data-font="serif"]{font-family:"Iowan Old Style","New York",ui-serif,Georgia,serif}
.rd-f[data-font="sohne"]{font-family:"Söhne",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd-f[data-font="rounded"]{font-family:ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd-f[data-font="mono"]{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px}
.rd-scroll{flex:1 1 0;min-height:0;overflow-y:auto;outline:none;overscroll-behavior:contain}
.rd-scroll:focus-visible{outline:none}
.rd-page{display:block;max-width:640px;margin:0 auto;padding:28px 32px 44px;font-family:var(--rd-font);font-size:var(--rd-size);line-height:1.6;color:var(--t1);overflow-wrap:break-word}
.rd-cover{aspect-ratio:var(--r,2.5);border-radius:10px;overflow:hidden;background:var(--quote);margin-bottom:22px}
.rd-cover img{width:100%;height:100%;object-fit:cover;display:block}
.rd-title{font-size:1.75em;line-height:1.2;font-weight:700;margin:0 0 16px;text-wrap:balance}
.rd-by{display:flex;align-items:center;gap:10px;margin-bottom:26px;font:14px/1.35 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd-by .av{width:38px;height:38px;border-radius:50%;display:block}
.rd-who{display:flex;align-items:center;gap:4px;min-width:0}
.rd-who .nm{font-weight:600;color:var(--t1);text-decoration:none}
.rd-who .hd{color:var(--t3);text-decoration:none}
.rd-meta{display:flex;gap:6px;color:var(--t3)}
.rd-meta .tm{margin:0;padding:0;font-size:inherit;color:inherit;text-decoration:none}
.rd-meta span::before{content:"·";margin-right:6px}
.rd-body p{margin:0 0 1em}
.rd-body h2{font-size:1.4em;line-height:1.25;font-weight:700;margin:1.5em 0 .5em}
.rd-body h3{font-size:1.15em;line-height:1.3;font-weight:700;margin:1.3em 0 .4em}
.rd-body ul,.rd-body ol{margin:0 0 1em;padding-left:1.4em}
.rd-body li{margin:.3em 0}
.rd-body blockquote{margin:0 0 1em;padding:.1em 0 .1em 1em;border-left:3px solid var(--accent);color:var(--t2);font-style:italic}
.rd-body a{color:var(--accent);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
.rd-body hr{border:0;height:1px;background:var(--sep);margin:2em 0}
.rd-body pre{margin:0 0 1em;padding:12px 14px;border-radius:8px;background:var(--quote);overflow-x:auto;white-space:pre;font:.8em/1.55 ui-monospace,"SF Mono",Menlo,monospace}
.rd-fig{margin:0 0 1.3em}
.rd-fig.multi{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.rd-fig.multi figcaption{grid-column:1/-1}
.rd-fig.multi .rd-m{aspect-ratio:4/3}
.rd-m{position:relative;border-radius:8px;overflow:hidden;background:var(--quote);aspect-ratio:var(--r,1.7778)}
.rd-m img,.rd-m video{width:100%;height:100%;object-fit:cover;display:block}
.rd-m img{cursor:zoom-in}
.rd-m .gif{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#fff;font:700 10px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;border-radius:4px;padding:1px 5px}
.rd-fig figcaption{margin-top:6px;text-align:center;color:var(--t3);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd-post{margin:0 0 1.3em;font:15px/1.4 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd-post .quote{margin:0;padding:10px 12px}
.rd-body .rd-link{display:flex;align-items:center;gap:8px;margin:0 0 1.3em;padding:10px 12px;border-radius:8px;background:var(--quote);color:var(--t2);text-decoration:none;font:14px/1.3 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.rd-link svg{width:16px;height:16px;flex:none}
.rd-link span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-link em{font-style:normal;color:var(--accent)}
.rd-note{color:var(--t3)}
.rd-wait{animation:sweeter-in .8s ease-in-out infinite alternate}
.rd-foot{flex:none;border-top:1px solid var(--sep);padding:4px 10px;display:flex;justify-content:center}
.rd-foot .cell{display:block;padding:0;border:0;background:none}
.rd-foot .acts{display:flex;margin:0;gap:12px}
.pf-banner{height:150px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent-solid) 55%,#000),var(--accent-solid)) center/cover no-repeat}
.pf-top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:0 16px;margin-top:-44px;position:relative;z-index:1}
.pf-av{width:88px;height:88px;flex:0 0 auto;border-radius:50%;border:4px solid var(--bg);background:var(--sub);object-fit:cover}
.app[data-round="false"] .pf-av{border-radius:14px}
.pf-btns{display:flex;gap:8px;align-items:center;padding-bottom:4px}
.pf-btn{min-width:98px;height:32px;border-radius:16px;border:1px solid var(--div);background:var(--bg);color:var(--t1);font:inherit;font-size:13px;font-weight:600;padding:0 16px;cursor:pointer}
.pf-btn.solid{background:var(--accent-solid);border-color:transparent;color:var(--on-accent)}
.pf-btn.danger{color:var(--fav);border-color:color-mix(in srgb,var(--fav) 40%,transparent)}
.pf-btn .b{display:none}
.pf-btn[disabled]{opacity:.5;cursor:default}
.pf-icon{width:32px;height:32px;border-radius:50%;border:1px solid var(--div);background:var(--bg);color:var(--t1);display:grid;place-items:center;cursor:pointer;padding:0}
.pf-icon svg{width:18px;height:18px}
.pf-name{display:flex;align-items:center;gap:4px;padding:10px 16px 0;font-size:calc(var(--fs) * 1.45);font-weight:800;color:var(--t1);line-height:1.2;min-width:0}
.pf-name > span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-name .vb{width:.95em;height:.95em}
.pf-handle{display:flex;align-items:center;gap:8px;padding:2px 16px 0;color:var(--t3)}
.pf-fy{font-size:11px;font-weight:600;color:var(--t2);background:var(--sub);border-radius:4px;padding:1px 6px}
.pf-bio{padding:10px 16px 0;color:var(--t1);white-space:pre-wrap;overflow-wrap:anywhere}
.pf-meta{display:flex;flex-wrap:wrap;gap:4px 14px;padding:10px 16px 0;color:var(--t3);font-size:.93em}
.pf-meta > *{display:inline-flex;align-items:center;gap:4px}
.pf-meta svg{width:15px;height:15px;flex:0 0 auto}
.pf-meta a{color:var(--accent)}
.pf-counts{display:flex;flex-wrap:wrap;gap:4px 16px;padding:10px 16px 0;color:var(--t3);font-size:.93em}
.pf-counts b{color:var(--t1);font-weight:700;font-variant-numeric:tabular-nums}
.pf-note{margin:12px 16px 0;padding:8px 10px;border-radius:8px;background:var(--sub);color:var(--t3);font-size:12.5px}
.pf-confirm{display:flex;align-items:center;gap:8px;margin:12px 16px 0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--fav) 8%,var(--bg));border:1px solid color-mix(in srgb,var(--fav) 30%,transparent)}
.pf-confirm > div{flex:1 1 auto;display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:var(--t2);min-width:0}
.pf-confirm b{color:var(--t1)}
.pf-confirm button{height:28px;border-radius:14px;border:1px solid var(--div);background:var(--bg);color:var(--t1);font:inherit;font-size:12.5px;font-weight:600;padding:0 12px;cursor:pointer;flex:0 0 auto}
.pf-confirm button.danger{background:var(--fav);border-color:transparent;color:#fff}
.pf-tabs{position:sticky;top:0;z-index:2;display:flex;margin-top:14px;border-bottom:1px solid var(--div);background:color-mix(in srgb,var(--bg) 86%,transparent);-webkit-backdrop-filter:saturate(1.8) blur(14px);backdrop-filter:saturate(1.8) blur(14px)}
.pf-tabs:empty{display:none}
.pf-tab{flex:1 1 0;border:0;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--t3);padding:10px 0;cursor:pointer;position:relative}
.pf-tab[aria-selected="true"]{color:var(--t1)}
.pf-tab[aria-selected="true"]::after{content:"";position:absolute;left:50%;bottom:0;width:44px;height:3px;border-radius:2px;background:var(--accent-solid);transform:translateX(-50%)}
.pf-foot{padding:18px;text-align:center;color:var(--t3);font-size:12.5px}
.pf-foot:empty{display:none}
@keyframes sweeter-sheet{from{opacity:0;transform:scale(.97) translateY(6px)}to{opacity:1;transform:none}}
@media (hover:hover){.pf-btn.on:hover .a{display:none}.pf-btn.on:hover .b{display:inline}.pf-btn.on:hover{color:var(--fav);border-color:color-mix(in srgb,var(--fav) 40%,transparent)}.pf-icon:hover,.pf-btn:not(.solid):not([disabled]):hover{background:var(--sub)}.pf-tab:hover{color:var(--t1)}}
.prefs-back{position:absolute;inset:0;background:rgba(0,0,0,.28);display:grid;place-items:center;z-index:5;padding:24px}
.prefs-back[hidden]{display:none}
.prefs{width:min(600px,100%);max-height:min(720px,100%);display:flex;flex-direction:column;background:var(--sheet);color:var(--t2);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px}
.ptitle{position:relative;text-align:center;font-weight:600;color:var(--t1);padding:12px 40px 4px;font-size:13px}
.ptitle .x{position:absolute;right:8px;top:6px}
.ptabs{display:flex;justify-content:center;gap:4px;padding:6px 10px 10px;border-bottom:1px solid var(--div)}
.ptab{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:74px;padding:6px 8px 5px;border:0;border-radius:7px;background:none;color:var(--t3);font-size:11px;cursor:pointer}
.ptab svg{width:22px;height:22px}
.ptab[aria-selected="true"]{background:var(--sub);color:var(--accent-solid)}
.pbody{overflow-y:auto;padding:18px 26px 22px}
.pgrid{display:grid;grid-template-columns:minmax(120px,38%) 1fr;gap:11px 12px;align-items:center}
.pgrid > .pl{text-align:right;color:var(--t1)}
.pgrid > .pc{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.pgrid > .sep{grid-column:1 / -1;height:1px;background:var(--div);margin:4px 0}
.pc label{display:flex;align-items:center;gap:7px;color:var(--t1)}
.pc .val{color:var(--t3);font-variant-numeric:tabular-nums;min-width:44px}
.pc .note{flex-basis:100%;font-size:11.5px;color:var(--t3);line-height:1.4}
.prefs select,.prefs input[type="text"]{font:inherit;font-size:13px;color:var(--t1);background:var(--field);border:1px solid var(--div);border-radius:6px;padding:4px 7px}
.prefs input[type="range"]{accent-color:var(--accent-solid);width:170px}
.prefs input[type="checkbox"]{accent-color:var(--accent-solid);width:14px;height:14px;margin:0}
.pfoot{border-top:1px solid var(--div);padding:9px 16px;font-size:11.5px;color:var(--t3);display:flex;justify-content:space-between;align-items:center;gap:10px}
.pfoot .done{background:var(--accent-solid);color:var(--on-accent);border:0;border-radius:6px;padding:5px 16px;font-weight:600;cursor:pointer}
.x{background:none;border:0;color:var(--t3);cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:5px}
.mute-add{display:flex;gap:6px;margin:10px 0}
.mute-add input{flex:1 1 auto;min-width:0}
.mute-add button{font-size:12px;border:1px solid var(--div);background:var(--field);color:var(--t1);border-radius:6px;padding:4px 12px;cursor:pointer}
.mutes{display:flex;flex-direction:column;border:1px solid var(--div);border-radius:7px;overflow:hidden}
.mutes .mr{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 10px;border-top:1px solid var(--div)}
.mutes .mr:first-child{border-top:0}
.mutes .mk{font-family:ui-monospace,Menlo,monospace;color:var(--t1);flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mutes .me2{color:var(--t3);font-size:11px;white-space:nowrap}
.hint{font-size:12px;color:var(--t3);line-height:1.45}
.psec{margin:0 0 6px;font-size:13px;font-weight:600;color:var(--t1)}
.psec:not(:first-child){margin-top:22px;padding-top:16px;border-top:1px solid var(--div)}
.hint kbd,.flist kbd{font:inherit;font-size:11px;border:1px solid var(--div);border-radius:4px;padding:0 4px;color:var(--t2)}
.flist{margin-top:10px}
.flist .mk{font-family:inherit;flex:0 1 auto}
.flist .me2{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.lnk{border:0;background:none;color:var(--accent);font:inherit;font-size:12px;cursor:pointer;padding:2px 4px;border-radius:4px}
.fnew{margin-top:10px}
.fnew button,.fbtns button{font-size:12px;border:1px solid var(--div);background:var(--field);color:var(--t1);border-radius:6px;padding:4px 12px;cursor:pointer}
.fbtns .done{background:var(--accent-solid);color:var(--on-accent);border-color:transparent;font-weight:600}
.fedit{margin-top:12px;border:1px solid var(--div);border-radius:8px;padding:12px}
.fedit .pgrid{grid-template-columns:minmax(100px,28%) 1fr}
.fedit input[type="text"]{flex:1 1 auto;min-width:0;width:100%}
.frules{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;width:100%}
.frl{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:var(--t1)}
.prefs .frl select{font-size:12px;padding:2px 4px}
.fbtns{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.swatches{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.sw{position:relative;width:18px;height:18px;border-radius:50%;border:0;padding:0;background:var(--sw);box-shadow:inset 0 0 0 1px rgba(0,0,0,.14);cursor:pointer}
.sw.sys{background:conic-gradient(from 90deg,#D9443A,#C8650F,#A67C00,#2B8F48,#1A8A96,#4590E6,#8A56D6,#D63F7A,#D9443A)}
.sw[aria-checked="true"]::after{content:"";position:absolute;inset:5.5px;border-radius:50%;background:#fff}
.sw::before{content:"";position:absolute;inset:-4px}
.swname{font-size:12px;color:var(--t3);margin-left:4px}
.keys{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:7px 12px;align-items:baseline}
.keys .k{text-align:right;white-space:nowrap}
.keys .d{color:var(--t1)}
kbd{font-family:ui-monospace,Menlo,monospace;font-size:11px;border:1px solid var(--div);border-bottom-width:2px;border-radius:4px;padding:0 4px;color:var(--t1);background:var(--field)}

/* compose window */
.cmp-back{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.18);display:flex;justify-content:center;align-items:flex-start;padding:10vh 16px 16px}
.cmp-back[hidden]{display:none}
/* The compose window in a window of its own (Mac app): the sheet fills it,
   with the app's own title bar in place of its header and the window's
   edges in place of its grip. */
.app.cmpwin{display:block;background:var(--bg)}
.app.cmpwin .cmp-back{background:none;padding:0;display:block}
.app.cmpwin .cmp-back[hidden]{display:none}
.app.cmpwin .cmp{width:100%;height:100%;border-radius:0;box-shadow:none;transform:none !important}
.app.cmpwin .cmp-head,.app.cmpwin .cmp-grip{display:none}
/* The text box takes whatever height the window leaves. */
.app.cmpwin .cmp-body{flex:1 1 auto;min-height:0}
.app.cmpwin .cmp-field{display:flex;flex-direction:column}
.app.cmpwin .cmp-ed{flex:1 1 auto;min-height:60px;height:auto !important}
.cmp{width:min(540px,100%);background:var(--bg);color:var(--t2);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.14);display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
.cmp-head{display:flex;align-items:center;justify-content:center;position:relative;padding:10px 40px;border-bottom:1px solid var(--div);color:var(--t1);font-weight:600;font-size:13px;background:var(--sub);-webkit-user-select:none;user-select:none;touch-action:none}
.cmp-head .x{position:absolute;right:8px}
.cmp-ctx{padding:10px 14px 0;font-size:13px}
.cmp-ctx:empty{display:none}
.cmp-ctx .qbox{border:1px solid var(--div);border-radius:8px;padding:8px 10px;background:var(--quote);max-height:7.5em;overflow:hidden}
.cmp-ctx .qbox .nm{font-weight:700;color:var(--t1)}
.cmp-ctx .qbox .hd{color:var(--t3)}
.cmp-ctx .rto{color:var(--t3);margin-bottom:6px}
.cmp-ctx .rto b{color:var(--accent);font-weight:500}
.cmp-body{display:flex;gap:10px;padding:12px 14px}
.cmp-av{width:40px;height:40px;border-radius:50%;background:var(--sub) center/cover no-repeat;flex:0 0 auto}
.app[data-round="false"] .cmp-av{border-radius:6px}
.cmp-field{flex:1 1 auto;min-width:0;position:relative;overflow:hidden}
.cmp-ed{margin:0;padding:0;border:0;font:inherit;font-size:15px;line-height:1.4;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;tab-size:8}
.cmp-ed{display:block;width:100%;box-sizing:border-box;height:120px;overflow-y:auto;outline:none;background:transparent;color:var(--t1);cursor:text}
/* Links in the text box: a highlight (no DOM), so typing keeps its undo. */
::highlight(sweeter-link){text-decoration:underline;text-decoration-color:var(--accent-solid,#1d9bf0);text-decoration-thickness:1.5px;text-underline-offset:3px}
/* Real bold and italic while writing: the text box's own spans. */
.cmp-ed{-webkit-user-select:text;user-select:text}
.cmp-ed b{font-weight:700}
.cmp-ed i{font-style:italic}
/* The placeholder, over an empty box (its caret stays at the start). */
.cmp-ed.ed-empty::before{content:attr(data-placeholder);position:absolute;left:0;top:0;color:var(--t3);pointer-events:none}
.cmp-foot{display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid var(--div)}
.cmp-foot .grow{flex:1}
.cmp-count{font-size:12px;color:var(--t3);font-variant-numeric:tabular-nums}
.cmp-count.long{color:#E68A2E}
.cmp-count.over{color:#E64545}
.cmp-xpro{background:none;border:1px solid var(--div);color:var(--t2);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer}
.cmp-post{background:var(--accent-solid);color:var(--on-accent);border:0;border-radius:16px;padding:6px 16px;font-weight:600;font-size:13px;cursor:pointer}
.cmp-post[disabled]{opacity:.45;cursor:default}
.cmp-status{flex:1 1 0;min-width:0;font-size:12px;line-height:1.3;color:var(--t3)}
.cmp-foot .grow{display:none}
.cmp-xpro,.cmp-count,.cmp-post{flex:0 0 auto;white-space:nowrap}
.cmp{position:relative}
.cmp-tools{display:flex;align-items:center;gap:1px;padding:0 12px 8px 60px;flex-wrap:wrap}
.cmp-tools .tb{width:32px;height:32px;border:0;border-radius:50%;background:none;color:var(--accent-solid);display:grid;place-items:center;cursor:pointer}
.cmp-tools .tb svg{width:19px;height:19px}
.cmp-tools .sepv{width:1px;height:18px;background:var(--div);margin:0 8px 0 6px}
.cmp-tools .tb.xp{color:var(--t3)}
.cmp-tools .xp-l{display:inline-flex;align-items:center;gap:2px;margin-right:4px;font-size:11px;font-weight:600;color:var(--t3);cursor:default;white-space:nowrap}
.cmp-tools .xp-l svg{width:11px;height:11px}
.cmp-tools .grow{flex:1}
.cmp-who{display:inline-flex;align-items:center;gap:5px;margin:0 12px 6px 64px;align-self:flex-start;color:var(--accent-solid);font-size:12.5px;font-weight:600;cursor:pointer;position:relative}
.cmp-who[hidden]{display:none}
.cmp-who svg{width:15px;height:15px;flex:0 0 auto}
.cmp-who .chev{width:10px;height:10px;margin-left:-2px;pointer-events:none}
.cmp-who select{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer;font:inherit}
.cmp-who .who-t{padding:2px 0}
.cmp-who:has(select:focus-visible){outline:2px solid var(--accent-hl);outline-offset:2px;border-radius:4px}
.cmp-media{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 10px 64px}
.cmp-card{margin:0 14px 10px 64px;border:1px solid var(--div);border-radius:12px;overflow:hidden;background:var(--bg)}
.cmp-card[hidden]{display:none}
.cmp-card img{display:block;width:100%;aspect-ratio:1.91/1;max-height:170px;object-fit:cover;background:var(--sub);border-bottom:1px solid var(--div)}
.cmp-card .cc-t{display:flex;flex-direction:column;gap:1px;padding:7px 10px 8px;font-size:12.5px;line-height:1.3;min-width:0}
.cmp-card .cc-d{color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-card .cc-n{color:var(--t1);font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cmp-media:empty{display:none}
.cm{position:relative;height:96px;border-radius:10px;overflow:hidden;background:var(--sub);border:1px solid var(--div)}
.cm img,.cm video{height:100%;width:auto;max-width:220px;object-fit:cover;display:block}
.cm button{position:absolute;top:5px;right:5px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;display:grid;place-items:center;cursor:pointer}
.cm button svg{width:14px;height:14px}
.cm .kind{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;font-weight:700;border-radius:4px;padding:1px 5px}
.cmp.dragging{box-shadow:0 0 0 3px var(--accent-solid),0 24px 70px var(--shadow)}
.cmp-drop{display:none}
.cmp-grip{position:absolute;left:0;right:0;bottom:0;height:7px;z-index:2;cursor:ns-resize;touch-action:none}
.cmp-grip::after{content:"";position:absolute;left:50%;bottom:2px;width:36px;height:4px;margin-left:-18px;border-radius:2px;background:var(--t3);opacity:0;transition:opacity .15s}
.cmp-grip:hover::after,.cmp.sizing .cmp-grip::after{opacity:.55}
.cmp.dragging .cmp-drop{display:grid;position:absolute;inset:0;place-items:center;background:color-mix(in srgb,var(--accent-solid) 12%,transparent);color:var(--accent-solid);font-weight:600;font-size:15px;z-index:2;pointer-events:none}
.emo,.gifp{position:absolute;z-index:6;width:352px;max-width:calc(100% - 16px);background:var(--sheet);color:var(--t2);border-radius:12px;box-shadow:0 0 0 1px var(--ring),0 16px 44px var(--shadow);display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
.emo[hidden],.gifp[hidden]{display:none}
.gif-grid{height:320px;overflow-y:auto;overscroll-behavior:contain;padding:2px 8px 8px}
.gif-cols{columns:2;column-gap:6px}
.gif-cols button{display:block;width:100%;margin:0 0 6px;padding:0;border:0;border-radius:8px;overflow:hidden;background:var(--sub);cursor:pointer;break-inside:avoid}
.gif-cols img{display:block;width:100%;height:auto}
.gifp .gif-note{color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.emo-top{display:flex;align-items:center;gap:4px;padding:8px 8px 6px}
.emo-top input{flex:1;min-width:0;height:28px;box-sizing:border-box;border-radius:7px;border:1px solid var(--div);background:var(--bg);color:var(--t1);padding:0 9px;font:inherit;font-size:13px;outline:none}
.emo-top input::placeholder{color:var(--t3)}
.emo-top input:focus{border-color:var(--accent-solid);box-shadow:0 0 0 3px var(--accent-hl)}
.emo-tone{width:32px;height:28px;border:0;border-radius:7px;background:none;font-size:18px;line-height:1;cursor:pointer;padding:0}
.emo-tones{display:flex;justify-content:flex-end;gap:2px;padding:0 8px 6px}
.emo-tones[hidden]{display:none}
.emo-tones button{width:32px;height:30px;border:0;border-radius:7px;background:none;font-size:19px;line-height:1;cursor:pointer;padding:0}
.emo-tones button.on{background:var(--tint);box-shadow:inset 0 0 0 1.5px var(--accent-solid)}
.emo-tabs{display:flex;justify-content:space-between;padding:0 6px 5px;border-bottom:1px solid var(--div)}
.emo-tabs.off{opacity:.45}
.emo-tabs button{width:30px;height:26px;border:0;border-radius:6px;background:none;color:var(--t3);display:grid;place-items:center;cursor:pointer;padding:0}
.emo-tabs button svg{width:15px;height:15px}
.emo-tabs button.on{color:var(--accent-solid);background:var(--tint)}
.emo-grid{position:relative;height:260px;overflow-y:auto;overscroll-behavior:contain;padding:0 8px 6px}
.emo-h{position:sticky;top:0;z-index:1;background:var(--sheet);font-size:11px;font-weight:600;color:var(--t3);padding:7px 2px 3px;height:26px;box-sizing:border-box;line-height:16px}
.emo-row{display:grid;grid-template-columns:repeat(9,1fr)}
.emo-row button{height:36px;border:0;border-radius:7px;background:none;font-size:24px;line-height:1;cursor:pointer;padding:0;font-family:"Apple Color Emoji",sans-serif}
.emo-row button.on{background:var(--tint);box-shadow:inset 0 0 0 1.5px var(--accent-solid)}
.emo-empty{padding:40px 12px;text-align:center;color:var(--t3);font-size:13px}
.emo-foot{display:flex;align-items:center;gap:7px;min-height:34px;padding:0 10px;border-top:1px solid var(--div);font-size:12px}
.emo-foot .ef-e{font-size:19px;line-height:1;font-family:"Apple Color Emoji",sans-serif}
.emo-foot .ef-n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--t1)}
.emo-foot .ef-k{color:var(--t3);white-space:nowrap}
.emo-foot .ef-sys{border:0;background:none;color:var(--accent);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;padding:4px 0}

/* conversation pane, pushed into a column like Tweetbot’s details view */
.dpane{position:absolute;inset:var(--chh) 0 0 0;z-index:2;background:var(--bg);display:flex;flex-direction:column;animation:sweeter-push .22s ease-out}
@keyframes sweeter-push{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
.dhead{height:28px;flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:0 8px;border-bottom:1px solid var(--div);background:var(--sub);color:var(--t1);font-weight:600;font-size:13px}
.dback{display:flex;align-items:center;gap:2px;flex:0 1 auto;min-width:0;white-space:nowrap;border:0;background:none;color:var(--accent);font-weight:600;font-size:13px;cursor:pointer;padding:4px 6px;border-radius:6px}
/* A long column title (a search query) ends in “…” on one line. */
.dbl{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dtitle{flex:0 0 auto;margin:0 auto;padding-right:52px;white-space:nowrap}
.dscroll{flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior:contain;position:relative;scrollbar-width:none}
.dfoot{padding:14px;text-align:center;color:var(--t3);font-size:.86em}
.dfoot a{color:var(--accent)}
.cell.focal{background:var(--bg);border-bottom:1px solid var(--div);padding-top:12px}
.cell.focal .tx{font-size:1.18em;line-height:1.35;color:var(--t1)}
.cell.focal .acts{display:flex}
.fmeta{margin-top:10px;color:var(--t3);font-size:.86em}
.fcounts{font-variant-numeric:tabular-nums;margin-top:8px;padding-top:8px;border-top:1px solid var(--div);display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.86em;color:var(--t3)}
.fcounts b{color:var(--t1)}
.dlist .ancestor{border-bottom:0}

/* lightbox */
.lb{position:fixed;inset:0;z-index:8;background:rgba(8,8,10,.94);display:flex;flex-direction:column;animation:sweeter-in .16s ease-out;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
.lb[hidden]{display:none}
.lb-stage{flex:1 1 auto;min-height:0;position:relative;overflow:hidden}
/* Photos: placed and scaled by the page (fit, actual size, pinch), from the
   top left corner, so nothing here limits their size. */
.lb-media{position:absolute;inset:0;overflow:hidden;touch-action:none}
.lb-img{position:absolute;left:0;top:0;max-width:none;max-height:none;transform-origin:0 0;border-radius:4px;box-shadow:0 10px 40px rgba(0,0,0,.5);user-select:none;-webkit-user-drag:none;cursor:default;will-change:transform}
.lb.zoomable .lb-img{cursor:zoom-in}
.lb.zoomed .lb-img{cursor:grab;border-radius:0}
.lb.zoomed.dragging .lb-img{cursor:grabbing}
.lb-media.video{inset:44px 64px 10px}
/* Centered by position, not by a grid: in a grid a percentage max-height
   measures against the row, which grows with a tall (portrait) video, so
   the video sat far below the middle and was cut off. */
.lb-media video{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;border-radius:4px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.lb-top,.lb-nav{z-index:2}
.lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:26px;line-height:1;display:grid;place-items:center;cursor:pointer;z-index:1}
.lb-nav[hidden]{display:none}
.lb-prev{left:12px}.lb-next{right:12px}
.lb-top{position:absolute;top:10px;left:16px;right:10px;display:flex;align-items:center;gap:12px;z-index:1;font-size:13px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.75)}
.lb-top .grow{flex:1}
.lb-top a{color:rgba(255,255,255,.85);text-decoration:none;border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:3px 9px;font-size:12px}
.lb-close{width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center;cursor:pointer}
.lb-close svg{width:16px;height:16px}
.lb-cap{flex:0 0 auto;padding:10px 20px 18px;max-width:760px;margin:0 auto;text-align:center;font-size:13px;line-height:1.4;color:rgba(255,255,255,.85)}
.lb-cap b{color:#fff}
.lb-cap .alt{display:block;margin-top:4px;color:rgba(255,255,255,.55);font-size:12px}
.lb-dots{display:flex;justify-content:center;gap:6px;padding-top:8px}
.lb-dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.3);display:block}
.lb-dots i.on{background:#fff}

/* late-start banner */
.banner{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:10px;background:#1C1C1E;color:#fff;border-radius:14px;padding:8px 8px 8px 14px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.35);max-width:calc(100% - 120px)}
.banner button[data-cmd="reload"]{background:var(--accent-solid);color:var(--on-accent);border:0;border-radius:6px;padding:5px 12px;font-weight:600;cursor:pointer}
.banner .x{color:rgba(255,255,255,.6)}

/* toast and the way back */
.toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100% - 32px);box-sizing:border-box;background:var(--accent-solid);color:var(--on-accent);border-radius:10px;padding:8px 15px 8px 11px;font-size:13px;font-weight:500;line-height:1.3;box-shadow:0 8px 26px rgba(0,0,0,.22);z-index:6;pointer-events:none;transition:opacity .2s}
.toast svg{width:16px;height:16px;flex:none}
.toast span{min-width:0}
/* A problem never looks like a success: the dark HUD, an amber sign. */
.toast[data-kind="warn"]{background:rgba(28,28,30,.94);box-shadow:0 8px 26px rgba(0,0,0,.22),inset 0 0 0 1px rgba(255,255,255,.14)}
.toast[data-kind="warn"] svg{color:#FFB340}
.toast[hidden]{display:none}
/* Undo toast and confirm bar: the toast rises above it when both show. */
.utoast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100% - 32px);background:rgba(28,28,30,.93);color:#fff;border-radius:10px;padding:7px 7px 7px 14px;font-size:13px;z-index:7;box-shadow:0 10px 30px rgba(0,0,0,.3)}
.utoast[hidden]{display:none}
.utoast .um{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.utoast button{flex:0 0 auto;border:0;border-radius:6px;padding:5px 11px;font:inherit;font-weight:600;background:rgba(255,255,255,.16);color:#fff;cursor:pointer}
.utoast button.danger{background:#D9443A}
.utoast button:focus-visible{outline:2px solid #fff;outline-offset:1px}
.utoast:not([hidden]) ~ .toast{bottom:68px}
/* The Add Column sheet. */
.nocols{flex:1 1 auto;display:grid;place-items:center;padding:24px;color:var(--t3);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px}
.nocols[hidden]{display:none}
.nocols-in{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;max-width:320px}
.nocols-in b{color:var(--t1);font-size:15px;font-weight:600}
.nocols-b{display:flex;gap:8px;margin-top:10px}
.nocols-b button{font:inherit;border:0;border-radius:7px;padding:6px 12px;background:var(--chip,rgba(127,127,127,.14));color:var(--t2);cursor:pointer}
.nocols-b button.done{background:var(--accent-solid);color:var(--on-accent)}
.add-back{position:absolute;inset:0;background:rgba(0,0,0,.28);display:grid;place-items:center;z-index:5;padding:24px}
.add-back[hidden]{display:none}
.addsheet{width:min(440px,100%);max-height:min(640px,100%);display:flex;flex-direction:column;background:var(--sheet);color:var(--t2);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px;animation:sweeter-sheet .2s cubic-bezier(.2,.85,.25,1)}
.addsheet .ptitle .aback{left:8px;right:auto;font-size:22px}
.add-body{overflow-y:auto;padding:8px 10px 10px}
.alist{display:flex;flex-direction:column;gap:2px}
.arow{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;border-radius:8px;padding:9px 10px;text-align:left;color:var(--t1);font:inherit;cursor:pointer}
.arow svg{width:22px;height:22px;flex:0 0 auto;color:var(--accent-solid)}
.arow .at{display:flex;flex-direction:column;gap:1px;min-width:0}
.arow .at b{font-weight:600;font-size:13.5px}
.arow .at span{font-size:12px;color:var(--t3)}
.arow[disabled]{opacity:.45;cursor:default}
.arow:focus-visible{outline:2px solid var(--accent-hl);outline-offset:-2px}
.anote{margin:10px 6px;color:var(--t3);font-size:12.5px}
.anote.err{color:#C93C33}
.anote.busy::before{content:"";display:inline-block;width:11px;height:11px;border-radius:50%;border:2px solid var(--accent-solid);border-right-color:transparent;margin-right:8px;vertical-align:-2px;animation:sweeter-spin .8s linear infinite}
@keyframes sweeter-spin{to{transform:rotate(360deg)}}
.asearch{display:flex;gap:8px;padding:6px 4px}
.asearch input{flex:1 1 auto;min-width:0;font:inherit;font-size:13px;color:var(--t1);background:var(--field);border:1px solid var(--div);border-radius:6px;padding:6px 8px}
.cheats{columns:2;column-gap:12px;margin:2px 0 0;padding:10px 0 0;border-top:1px solid var(--div)}
.cheats .cg{break-inside:avoid;margin:0 0 8px}
.cheats h4{margin:0 0 2px;padding:0 6px;font-size:11px;font-weight:600;color:var(--t3)}
.cheats button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;border:0;background:none;border-radius:6px;padding:4px 6px;text-align:left;font:inherit;cursor:pointer}
.cheats code{font:12px ui-monospace,"SF Mono",Menlo,monospace;color:var(--t1)}
.cheats span{font-size:11.5px;color:var(--t3)}
.cheats button:focus-visible{outline:2px solid var(--accent-hl);outline-offset:-2px}
@media (hover:hover){.cheats button:hover{background:var(--sub)}}
.col.lifted{opacity:.45}
.app.reordering,.app.reordering *{cursor:grabbing!important}
.app.reordering .cols{scroll-snap-type:none}
.dropbar{position:fixed;width:4px;border-radius:2px;background:var(--accent-solid);z-index:9;pointer-events:none;box-shadow:0 0 0 1px var(--bg)}
.asearch .done{background:var(--accent-solid);color:var(--on-accent);border:0;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer}
@media (hover:hover){.arow:not([disabled]):hover{background:var(--sub)}}
/* Popover menus: a submenu becomes a labeled section. */
.pop{max-height:calc(100vh - 16px);overflow-y:auto}
.pop .pgrid{display:flex;flex-wrap:wrap;gap:2px;padding:2px 8px 6px;max-width:250px}
.pop .pgrid button{width:28px;height:28px;padding:0;justify-content:center;border-radius:6px}
.pop .pgrid button svg{width:16px;height:16px;color:var(--t2)}
.pop .pgrid button[aria-checked="true"]{box-shadow:inset 0 0 0 2px var(--accent-solid)}
.pop .pgrid i{width:16px;height:16px;border-radius:50%;display:block}
.pop .pgrid i.none{box-sizing:border-box;border:1.5px solid var(--t3);background:linear-gradient(135deg,transparent 44%,var(--t3) 44%,var(--t3) 56%,transparent 56%)}
.ch .cic{display:grid;place-items:center;flex:0 0 auto;color:var(--ctint,var(--t3))}
.ch .cic svg{width:13px;height:13px}
.ch .cic[hidden],.ch .ren[hidden]{display:none}
.ch .ren{-webkit-appearance:none;appearance:none;flex:1 1 auto;min-width:0;height:19px;margin:0;font:inherit;font-size:12px;font-weight:600;color:var(--t1);background:var(--field);border:1px solid var(--accent-solid);border-radius:5px;padding:0 6px;box-shadow:0 0 0 2px var(--accent-hl);outline:none}
.col.renaming .ch .ct,.col.renaming .ch .cs,.col.renaming .ch .live,.col.renaming .ch .fchip,.col.renaming .ch .cic,.col.renaming .ch .pill,.col.renaming .ch .mini{display:none}
.col.hiddencol{display:none}
.col.collapsed{cursor:pointer}
.col.collapsed .scroll,.col.collapsed .rsz,.col.collapsed .sbar,.col.collapsed .dpane{display:none}
.col.collapsed .ch{height:100%;flex-direction:column;justify-content:flex-start;align-items:center;padding:10px 0 40px;gap:8px;border-bottom:0;writing-mode:vertical-rl}
.col.collapsed .ch > :not(.ct):not(.cic):not(.live){display:none}
.col.collapsed .ch .cic svg{transform:rotate(-90deg)}
.col.collapsed::after{content:attr(data-unread);position:absolute;left:50%;bottom:12px;transform:translateX(-50%);background:var(--pill);color:var(--pill-fg);font-size:10px;font-weight:600;border-radius:99px;padding:1px 6px;font-variant-numeric:tabular-nums}
.col.collapsed[data-unread=""]::after{display:none}
.col.collapsed:hover .ch{background:var(--sub)}
.col[data-tint] .ch{box-shadow:inset 0 3px 0 var(--ctint)}
.col.focus[data-tint] .ch{box-shadow:inset 0 3px 0 var(--ctint),inset 0 -2px 0 var(--accent)}
.tab[data-tint]{color:var(--cd)}
.tab.off{opacity:.38}
.app.popout .col{flex:1 1 0;max-width:none;min-width:0}
.app.popout .ch{cursor:default}
.ask-back,.ov-back,.ip-back,.nt-back,.up-back{position:absolute;inset:0;background:rgba(0,0,0,.28);display:grid;place-items:center;z-index:6;padding:24px}
.ask-back[hidden],.ov-back[hidden],.ip-back[hidden],.nt-back[hidden],.up-back[hidden]{display:none}
.up .up-notes{margin:0;font-size:12px;line-height:1.45;color:var(--t2);white-space:pre-line;max-height:11.6em;overflow-y:auto;overscroll-behavior:contain}
.up .up-notes.up-fade{-webkit-mask-image:linear-gradient(#000 calc(100% - 2.2em),transparent);mask-image:linear-gradient(#000 calc(100% - 2.2em),transparent)}
.up .up-notes:empty{display:none}
.up .up-how{margin:0;font-size:12px;color:var(--t3)}
.nt{width:min(390px,100%)}
.nt-head{display:flex;align-items:center;gap:10px}
.nt-ic{width:34px;height:34px;border-radius:9px;background:var(--accent-solid);color:var(--on-accent);display:grid;place-items:center;flex:none}
.nt-ic svg{width:19px;height:19px}
.nt-b{margin:0;line-height:1.45}
.ip{width:min(470px,100%);max-height:min(620px,100%);display:flex;flex-direction:column;background:var(--sheet);color:var(--t2);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px;--ipc:var(--t2)}
.ip-head{display:flex;align-items:center;gap:10px;padding:8px 16px 10px}
.ip-prev{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;color:var(--t1)}
.ip-prev b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ip-pi{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--sub);color:var(--ipc);flex:none}
.ip-pi svg{width:18px;height:18px}
.ip-q{flex:0 1 200px;min-width:0;font:inherit;padding:5px 8px;border:1px solid var(--div);border-radius:6px;background:var(--field);color:var(--t1);outline:none}
.ip-q:focus{border-color:var(--accent-solid);box-shadow:0 0 0 2px var(--accent-hl)}
.ip-colors{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;border-bottom:1px solid var(--div)}
.ipsw{width:26px;height:26px;border-radius:50%;border:0;padding:0;background:none;cursor:pointer;display:grid;place-items:center}
.ipsw i{width:18px;height:18px;border-radius:50%;display:block;background:var(--sw)}
.ipsw i.none{box-sizing:border-box;border:1.5px solid var(--t3);background:linear-gradient(135deg,transparent 44%,var(--t3) 44%,var(--t3) 56%,transparent 56%)}
.ipsw[aria-checked="true"]{box-shadow:inset 0 0 0 2px var(--accent-solid)}
.ipsw:focus-visible,.ipi:focus-visible{outline:2px solid var(--accent-solid);outline-offset:1px}
.ip-body{overflow:auto;padding:0 10px 10px;min-height:140px}
.ip-lab{font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--t3);padding:10px 4px 4px}
.ip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:2px}
.ipi{height:36px;border:0;border-radius:7px;background:none;color:var(--ipc);display:grid;place-items:center;cursor:pointer;padding:0}
.ipi svg{width:19px;height:19px}
.ipi:hover{background:var(--sub)}
.ipi[aria-checked="true"]{background:var(--sub);box-shadow:inset 0 0 0 2px var(--accent-solid)}
.ip-none{padding:28px 0;text-align:center;color:var(--t3)}
.ip-foot{display:flex;align-items:center;gap:8px;border-top:1px solid var(--div);padding:10px 14px}
.ip-foot .grow{flex:1}
.ip-foot button{font:inherit;border:0;border-radius:6px;padding:5px 14px;background:var(--chip,rgba(127,127,127,.14));color:var(--t2);cursor:pointer}
.ip-foot button.done{background:var(--accent-solid);color:var(--on-accent);font-weight:600}
.ask{width:min(360px,100%);background:var(--sheet);color:var(--t2);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);padding:16px;display:flex;flex-direction:column;gap:10px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px}
.ask-t{font-weight:600;color:var(--t1)}
.ask-in{font:inherit;padding:6px 8px;border:1px solid var(--div);border-radius:6px;background:var(--field);color:var(--t1);outline:none}
.ask-in:focus{border-color:var(--accent-solid);box-shadow:0 0 0 2px var(--accent-hl)}
.ask-b{display:flex;justify-content:flex-end;gap:8px}
.ask-b button{font:inherit;border:0;border-radius:6px;padding:5px 14px;background:var(--chip,rgba(127,127,127,.14));color:var(--t2);cursor:pointer}
.ask-b button.done{background:var(--accent-solid);color:var(--on-accent);font-weight:600}
.wc-back{position:absolute;inset:0;background:rgba(0,0,0,.28);display:grid;place-items:center;z-index:6;padding:24px}
.wc-back[hidden]{display:none}
.wc{position:relative;width:min(470px,100%);max-height:100%;overflow-y:auto;box-sizing:border-box;background:var(--sheet);color:var(--t2);border-radius:14px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);padding:30px 28px 16px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px;animation:sweeter-sheet .22s cubic-bezier(.2,.85,.25,1)}
.wc-x{position:absolute;right:10px;top:10px;width:26px;height:26px;display:grid;place-items:center;padding:0}
.wc-x svg{width:12px;height:12px}
.wc-slide{display:flex;flex-direction:column;align-items:center;text-align:center;min-height:290px}
.wc-mark{width:64px;height:64px;margin-bottom:12px}
.wc-ic{width:56px;height:56px;border-radius:14px;background:var(--accent-solid);color:var(--on-accent);display:grid;place-items:center;margin-bottom:14px;flex:none}
.wc-ic svg{width:30px;height:30px}
.wc-t{margin:0 0 6px;font-size:20px;font-weight:700;color:var(--t1);text-wrap:balance}
.wc-p{margin:0 0 18px;line-height:1.5;text-wrap:pretty}
.wc-keys{display:grid;grid-template-columns:auto auto;gap:8px 14px;align-items:baseline;text-align:left}
.wc-keys .k{text-align:right;white-space:nowrap}
.wc-keys .k i{font-style:normal;color:var(--t3);font-size:12px}
.wc-keys .d{color:var(--t1)}
.wc-tips{display:flex;align-items:center;gap:6px;margin-top:20px}
.wc-by{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:22px;color:var(--t3);font-size:12px}
.wc-by button{display:inline-flex;align-items:center;gap:5px;font:inherit;font-weight:600;background:none;border:1px solid var(--accent-solid);color:var(--accent-solid);border-radius:999px;padding:3px 11px 3px 8px;cursor:pointer}
.wc-by button svg{width:13px;height:13px}
.wc-foot{display:flex;align-items:center;gap:8px;margin-top:14px}
.wc-foot .grow,.tip .grow{flex:1}
.wc-dots{display:flex;gap:6px}
.wc-dots i{width:6px;height:6px;border-radius:50%;background:var(--div)}
.wc-dots i.on{background:var(--accent-solid)}
.wc-foot button,.tip-f button{font:inherit;border:0;border-radius:6px;padding:5px 14px;background:var(--chip,rgba(127,127,127,.14));color:var(--t2);cursor:pointer}
.wc-foot button.done{background:var(--accent-solid);color:var(--on-accent);font-weight:600}
.wc-foot button[hidden],.tip-f button[hidden]{display:none}
.tip{position:absolute;right:18px;bottom:18px;width:min(320px,calc(100% - 36px));box-sizing:border-box;background:var(--sheet);color:var(--t2);border-radius:12px;box-shadow:0 14px 40px var(--shadow),0 0 0 1px rgba(0,0,0,.1);padding:10px 12px 12px 14px;z-index:4;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px;animation:sweeter-sheet .22s cubic-bezier(.2,.85,.25,1)}
.tip[hidden]{display:none}
.tip-h{display:flex;align-items:center;gap:7px;color:var(--t1)}
.tip-h .x{width:24px;height:24px;display:grid;place-items:center;padding:0;margin-right:-4px}
.tip-h .x svg{width:11px;height:11px}
.tip-ic{width:22px;height:22px;border-radius:6px;background:var(--accent-solid);color:var(--on-accent);display:grid;place-items:center;flex:none}
.tip-ic svg{width:13px;height:13px}
.tip-b{margin:8px 0 12px;line-height:1.45;color:var(--t1);text-wrap:pretty}
.tip-f{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.tip-f label{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t3);flex-basis:100%;margin-bottom:4px}
.tip-f button{font-size:12px;padding:4px 10px}
.ov{width:min(620px,100%);max-height:min(720px,100%);display:flex;flex-direction:column;background:var(--sheet);color:var(--t2);border-radius:12px;box-shadow:0 24px 70px var(--shadow),0 0 0 1px rgba(0,0,0,.12);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;font-size:13px}
.ov-body{overflow:auto;padding:6px 10px}
.ov-deck{padding:8px 4px;border-bottom:1px solid var(--div)}
.ov-deck:last-child{border-bottom:0}
.ov-dt{display:flex;align-items:center;gap:8px;width:100%;background:none;border:0;padding:4px;border-radius:6px;font:inherit;color:var(--t1);cursor:pointer;text-align:left}
.ov-dt:hover,.ov-dt:focus-visible{background:var(--sub);outline:none}
.ov-ic{font-size:17px;width:22px;text-align:center}
.ov-now{margin-left:auto;font-size:11px;color:var(--t3)}
.ov-now + .ov-now{margin-left:8px}
.ov-cols{display:flex;flex-wrap:wrap;gap:5px;padding:4px 0 2px 34px}
.ov-col{font:inherit;font-size:12px;border:0;border-radius:99px;padding:2px 10px;background:var(--sub);color:var(--t2);cursor:pointer}
.ov-col:hover,.ov-col:focus-visible{background:var(--accent-solid);color:var(--on-accent);outline:none}
.ov-none{font-size:12px;color:var(--t3)}
.ov-deck.on .ov-dt b{color:var(--accent)}
.app[data-density="compact"]{--av:calc(var(--fs) * 2)}
.app[data-density="compact"] .cell{padding:6px 10px 5px;gap:8px}
.app[data-density="compact"] .tx{margin-top:0}
.app[data-density="compact"] .acts{margin-top:2px}
.app[data-density="compact"] .media{margin-top:5px;height:calc(var(--fs) * 9)}
.col.grid .list{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:2px;padding:2px;background:var(--bg)}
.col.grid .marker{display:none}
.col.grid .cell.gt{display:block;padding:0;border:0;aspect-ratio:1;background:var(--sub);overflow:hidden;border-radius:3px}
.col.grid .cell.gt .gph{position:relative;width:100%;height:100%;cursor:zoom-in}
.col.grid .cell.gt img{width:100%;height:100%;object-fit:cover;display:block}
.col.grid .cell.gt .gph.gv svg{position:absolute;right:5px;bottom:5px;width:16px;height:16px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.col.grid .cell.gt.sel{outline:2px solid var(--accent-solid);outline-offset:-2px}
.side .deck{width:36px;height:30px;margin:2px auto 6px;display:grid;place-items:center;background:rgba(255,255,255,.06);border:0;border-radius:8px;font-size:17px;line-height:1;cursor:pointer;color:var(--side-on)}
.side .deck:hover{background:rgba(255,255,255,.14)}
.side .deck[hidden]{display:none}
.dhead .dcol{flex:0 0 auto;white-space:nowrap;margin-left:auto;background:none;border:0;color:var(--accent);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;padding:2px 6px;border-radius:5px}
.dhead .dcol:hover{background:color-mix(in srgb,var(--accent) 12%,transparent)}
.ch .stl{display:grid;place-items:center;flex:0 0 auto;color:#C8650F}
.ch .stl svg{width:12px;height:12px}
.ch .stl[hidden]{display:none}
.col.paused .ch .live{display:block;background:#C8650F}
.cell.seen{opacity:.5}
.cell.seen:hover,.cell.seen.sel{opacity:1}
/* A single column on show (a deck or group of one) shrinks with the window
   instead of scrolling sideways. Hidden columns stay in the DOM. */
.app[data-fit="fill"] .cols:not(:has(> .col:not(.hiddencol) ~ .col:not(.hiddencol))) > .col{flex-shrink:1}
.app[data-fit="fixed"] .col:not(.sized){flex:0 0 var(--colw,345px);max-width:none}
.app[data-fit="equal"] .col{flex:1 1 0;max-width:none;min-width:240px}
.app[data-fit="equal"] .col.sized{flex:0 0 var(--w)}
.app[data-fit^="fit"] .col,.app[data-fit^="fit"] .col.sized{flex:0 0 var(--fitw,345px);max-width:none;min-width:0}
.app[data-snap] .cols{scroll-snap-type:x proximity}
.app[data-snap] .col{scroll-snap-align:start}
.app[data-fit] .col.collapsed,.app[data-fit] .col.collapsed.sized{flex:0 0 34px;min-width:34px;max-width:34px}
.tab.ismerge::after{content:"";position:absolute;right:5px;bottom:6px;width:7px;height:7px;border-radius:50%;box-shadow:0 0 0 1.5px currentColor}
.tab.isview::after{content:"";position:absolute;right:6px;bottom:7px;width:6px;height:6px;border-radius:2px;box-shadow:0 0 0 1.5px currentColor}
.pop .plabel{font-size:11px;font-weight:600;letter-spacing:.03em;color:var(--t3);padding:6px 10px 2px}
.pop button.sub{padding-left:14px}
.fab{position:fixed;left:14px;bottom:14px;pointer-events:auto;z-index:2;border:0;border-radius:18px;padding:8px 14px 8px 12px;background:#1C1C1E;color:#fff;font:600 13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer;display:flex;align-items:center;gap:7px}
.fab[hidden]{display:none}
.fab i{width:9px;height:9px;border-radius:50%;background:#F2A93B;display:block}


/* loading screen: the Sweeter mark over a bouncing amber VU meter */
/* The loading screen, drawn like the About window: starl3xx's bird flaps
   on a glow of the icon's sky and pink (eight poses, 130 ms each, from
   loader.js), and a line fills as columns load. The Mac app's LaunchCover
   (ViewController.swift) draws the same before it. */
.boot{position:absolute;inset:0 0 0 76px;z-index:3;display:grid;place-items:center;background:radial-gradient(circle 240px at calc(50% - 40px) calc(50% - 60px),var(--glow-sky),transparent),radial-gradient(circle 220px at calc(50% + 40px) calc(50% - 40px),var(--glow-pink),transparent),var(--bg);transition:opacity .4s ease,filter .4s ease,transform .4s ease}
.boot.done{opacity:0;filter:blur(4px);transform:scale(.99);pointer-events:none}
.boot-in{display:flex;flex-direction:column;align-items:center;color:var(--t3);font-size:13px;line-height:16px}
/* The strip slides by transform, which the compositor runs even while the
   page is busy loading columns (a moving background-position waits on it). */
.boot-bird{width:120px;height:120px;overflow:hidden}
.boot-bird i{display:block;width:960px;height:120px;background:0 0/960px 120px no-repeat;will-change:transform;animation:sweeter-flap 1040ms steps(8) infinite}
@keyframes sweeter-flap{to{transform:translateX(-960px)}}
.boot-mark{width:104px;height:104px;display:block;margin-bottom:16px;filter:drop-shadow(0 8px 8px var(--glow-shadow))}
.boot-t{font:600 24px/29px ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,sans-serif;color:var(--t1)}
.boot-bar{position:relative;width:160px;height:4px;margin-top:18px;border-radius:2px;background:var(--div);overflow:hidden}
.boot-bar i{position:absolute;top:0;bottom:0;left:0;width:38%;border-radius:2px;background:linear-gradient(90deg,#7EC0FA,#EE5A8E);animation:sweeter-glide 1.5s ease-in-out infinite alternate}
.boot-bar.known i{width:var(--p,0%);animation:none;transition:width .5s cubic-bezier(.2,.85,.25,1)}
@keyframes sweeter-glide{from{transform:none}to{transform:translateX(163%)}}
.boot-s{margin-top:12px;font-variant-numeric:tabular-nums}
.boot.stuck .boot-bird i{animation:none}
.boot.stuck .boot-bar{visibility:hidden}
@media (prefers-reduced-motion:reduce){.boot-bird i{animation:none}.boot-bar i{animation:none;width:100%;opacity:.4}}
/* columns arrive one after another once all have loaded */
.cols.hold{visibility:hidden}
.col.arrive{animation:sweeter-col .55s cubic-bezier(.2,.85,.25,1) both;animation-delay:var(--d,0ms)}
@keyframes sweeter-col{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* like and repost: the new icon scales in from .25 with a 4px blur */
@keyframes sweeter-swap{from{scale:.25;opacity:0;filter:blur(4px)}to{scale:1;opacity:1;filter:blur(0)}}
.acts .swap svg{animation:sweeter-swap .28s cubic-bezier(.2,.85,.25,1)}

/* arrivals */
@keyframes sweeter-in{from{opacity:0}to{opacity:1}}
.enter{animation:sweeter-in .55s ease-out both}
@keyframes sweeter-bump{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
.pill.bump{animation:sweeter-bump .35s ease-out}

/* pressed buttons shrink a touch */
button{transition:scale .2s ease-out}
button:active:not([disabled]){scale:.97}
.acts button:active:not([disabled]),.tab:active,.ptab:active{scale:.95}
/* keyboard focus */
:focus-visible{outline:2px solid var(--accent-solid);outline-offset:2px}
.cell:focus-visible{outline-offset:-2px}
/* switching skins must not animate every color */
.app.switching *,.app.switching{transition:none !important}
/* skip link, visible only when focused */
.skip{position:absolute;left:84px;top:6px;z-index:9;transform:translateY(-200%);background:var(--accent-solid);color:var(--on-accent);border:0;border-radius:6px;padding:6px 10px;font:600 12px -apple-system,BlinkMacSystemFont,sans-serif}
.skip:focus-visible{transform:none}

@media (prefers-reduced-motion:reduce){*{transition:none !important;animation:none !important}}
/* macOS’s Reduce Transparency: solid where Sweeter blurs (the Mac app’s own
   sidebar, an NSVisualEffectView, turns solid by itself). */
@media (prefers-reduced-transparency:reduce){.pf-close{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(0,0,0,.75)}.pf-tabs{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--bg)}}

/* hover only where a pointer can hover (a tap leaves :hover stuck on touch screens) */
@media (hover:hover){
.tab:hover{color:var(--side-on)}
.round:hover{background:rgba(255,255,255,.22);color:#fff}
.round.post:hover{background:var(--accent-solid-press)}
.ch .mini:hover{color:var(--accent)}
.tm:hover{color:var(--accent)}
.more:hover{text-decoration:underline}
.tx a:hover{text-decoration:underline}
.rtop a:hover{text-decoration:underline}
.app[data-actions="always"] .acts,.cell:hover .acts,.cell.sel .acts{display:flex}
.acts button:hover,.acts a:hover{color:var(--accent)}
.pop button:hover,.pop button:focus-visible{background:var(--accent-solid);color:var(--on-accent);outline:none}
.pop button:hover svg,.pop button:focus-visible svg{color:var(--on-accent)}
.pop button:hover kbd,.pop button:focus-visible kbd{color:color-mix(in srgb,var(--on-accent) 80%,transparent)}
.pop button[disabled]:hover{background:none;color:var(--t3)}
.lnk:hover{text-decoration:underline}
.x:hover{color:var(--t1)}
.cmp-tools .tb:hover{background:var(--tint)}
.cmp-tools .tb.xp:hover{color:var(--t2)}
.emo-row button:hover,.emo-tone:hover,.emo-tones button:hover,.emo-tabs button:hover{background:var(--tint)}
.emo-foot .ef-sys:hover{text-decoration:underline}
.gif-cols button:hover{box-shadow:0 0 0 2px var(--accent-solid)}
.dback:hover{background:var(--tint)}
.lb-nav:hover{background:rgba(255,255,255,.24)}
.lb-top a:hover{background:rgba(255,255,255,.12)}
}
`;
})(typeof globalThis !== 'undefined' ? globalThis : this);
