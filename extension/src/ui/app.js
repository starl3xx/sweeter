// The Sweeter overlay: a shadow root that covers X Pro and draws its own
// columns from the store. X Pro keeps running underneath and keeps
// refreshing every column; Sweeter never sends a request.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});
  const { escapeHtml: h, compareSort, safeUrl } = Sweeter.util;
  const icon = Sweeter.icon;
  const R = Sweeter.render;

  const DEFAULTS = {
    skin: 'light',
    fontSize: 14,
    names: 'both',
    media: 'full', // whole images, nothing cropped
    autoplayVideo: false,
    autoplayGifs: true,
    cards: 'medium', // link previews at two-thirds width save vertical space
    links: 'short',
    quoteMedia: true,
    badges: true,
    longPosts: 'collapsed',
    repostLabel: 'above',
    actions: 'hover',
    round: true,
    tokenLookup: true, // a click on a contract address shows DexScreener's numbers
    tickerPrices: true, // ticker cards on screen show DexScreener's price
    dateFormat: 'relative',
    pinToTop: true,
    counts: true,
    obscureSensitive: true,
    visible: true,
    colWidth: 345,
    accent: 'blue',
    contrast: 'standard',
    pureBlack: false,
    // Per column, by view id (see vidOf). Sweeter only; X Pro never sees them.
    colFilters: {}, // view id (before 0.15: source key) -> ids of the filters that are on
    colWidths: {}, // view id -> width in px
    colTitles: {}, // view id -> the person’s own title
    colIcons: {}, // view id -> icon name (COL_ICON_GROUPS)
    colTints: {}, // view id -> color id (TINTS)
    colModes: {}, // view id -> 'collapsed' | 'hidden'
    views: [], // Sweeter-only views: { id: 'v:…', src: source key }
    colCleared: {}, // view id -> time (ms): posts from then or before are cleared (Sweeter only)
    colAlerts: {}, // view id -> 'off' | 'banner' | 'sound' (Mac app)
    alertsMuted: false,
    pauseOnHover: true, // a pinned column holds still under the pointer
    dedupe: 'off', // a post already seen in one column: 'dim' | 'hide' | 'off' in the others
    fit: 'fill', // 'fill' | 'equal' | 'fixed' | 'fit2' … 'fit5'
    snap: false, // columns snap into place when scrolled sideways
    muteNotes: false, // mutes hide notifications too (Tweetbot left them alone)
    density: 'comfortable', // or 'compact'
    colMedia: {}, // view id -> media mode for that column ('full' | 'cropped' | 'small' | 'none')
    colGrid: {}, // view id -> true: the column shows its media as a grid
    merges: [], // merged columns: { id: 'm:…', srcs: [2 to 5 source keys], anchor: view id }
    groups: [], // column groups: { id: 'g:…', name, vids: [view ids] }
    group: '', // the group on screen ('' is every column)
    layouts: [], // saved layouts: { name, at, data: { LAYOUT_KEYS… } }
  };
  Sweeter.DEFAULTS = DEFAULTS;

  // Within this many pixels of the top, a column counts as “at the top”.
  const PIN_SLOP = 8;
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const KIND_ICON = { merged: 'decks', home: 'home', notifications: 'bell', list: 'list', search: 'search', user: 'profile', likes: 'like', bookmarks: 'bookmark', conversation: 'reply', placeholder: 'open' };
  // X Pro column types Sweeter shows only as a placeholder.
  const PLACEHOLDERS = { explore: 'Explore', grok: 'Grok', drafts: 'Drafts', scheduled: 'Scheduled posts' };
  // A column’s own icon, chosen in the Icon & Color picker: [name, label, search words].
  const COL_ICON_GROUPS = [
    ['Columns', [
      ['home', 'Home', 'house timeline following'],
      ['bell', 'Notifications', 'bell alerts'],
      ['alert', 'Alert', 'bell badge'],
      ['mention', 'Mentions', 'at replies'],
      ['list', 'List', ''],
      ['search', 'Search', 'magnifying glass'],
      ['user', 'Person', 'profile'],
      ['profile', 'Profile', 'person circle account'],
      ['people', 'People', 'friends two'],
      ['group3', 'Group', 'people team community three'],
      ['like', 'Likes', 'heart love'],
      ['bookmark', 'Bookmarks', 'saved'],
      ['chat', 'Conversation', 'chat bubbles replies'],
      ['inbox', 'Inbox', 'tray'],
      ['mail', 'Mail', 'envelope messages dm'],
      ['megaphone', 'Announcements', 'megaphone loud'],
      ['live', 'Live', 'broadcast radio waves'],
      ['eye', 'Watching', 'eye see'],
      ['verified', 'Verified', 'seal check'],
      ['star', 'Star', 'favorite'],
      ['flag', 'Flag', ''],
      ['pin', 'Place', 'pin map location'],
      ['hash', 'Topic', 'number hashtag'],
      ['tag', 'Tag', 'label'],
      ['paperplane', 'Sent', 'paper plane send'],
    ]],
    ['Work and Money', [
      ['briefcase', 'Work', 'job briefcase'],
      ['chart', 'Markets', 'stocks trend line'],
      ['chartbar', 'Stats', 'chart bar analytics'],
      ['pie', 'Data', 'pie chart analytics'],
      ['coin', 'Crypto', 'bitcoin btc coin'],
      ['dollar', 'Money', 'dollar finance'],
      ['bank', 'Government', 'bank building columns politics'],
      ['city', 'Companies', 'city buildings office'],
      ['cart', 'Shopping', 'cart buy'],
      ['bag', 'Store', 'bag shop'],
      ['card', 'Payments', 'credit card'],
      ['doc', 'Docs', 'document text'],
      ['folder', 'Folder', ''],
      ['calendar', 'Calendar', 'events date'],
      ['clock', 'Time', 'clock'],
      ['hourglass', 'Hourglass', 'time wait'],
      ['target', 'Target', 'scope goal'],
      ['trophy', 'Trophy', 'win award'],
      ['crown', 'Crown', 'king vip'],
      ['diamond', 'Diamond', 'gem'],
      ['scale', 'Law', 'scale justice weight'],
    ]],
    ['Tech and Science', [
      ['code', 'Code', 'developer programming'],
      ['terminal', 'Terminal', 'shell cli'],
      ['cpu', 'Chips', 'cpu hardware'],
      ['laptop', 'Laptop', 'computer mac'],
      ['phone', 'Phone', 'iphone mobile'],
      ['server', 'Servers', 'rack infrastructure'],
      ['cloud', 'Cloud', ''],
      ['wifi', 'Internet', 'wifi network'],
      ['activity', 'Bolt', 'lightning energy fast'],
      ['bolt2', 'Power', 'bolt circle energy'],
      ['spark', 'AI', 'sparkles magic'],
      ['sparkle', 'Sparkle', 'star shine'],
      ['brain', 'Ideas', 'brain mind'],
      ['bulb', 'Idea', 'lightbulb'],
      ['atom', 'Science', 'atom physics'],
      ['flask', 'Lab', 'flask chemistry'],
      ['bug', 'Bugs', 'ladybug'],
      ['hammer', 'Build', 'hammer tools'],
      ['wrench', 'Tools', 'wrench screwdriver'],
      ['gear', 'Settings', 'gear'],
      ['cube', 'Cube', '3d block'],
      ['key', 'Keys', 'key'],
      ['lock', 'Private', 'lock security'],
      ['shield', 'Security', 'shield'],
      ['link', 'Links', 'link url'],
      ['infinity', 'Infinity', 'forever loop'],
      ['globe', 'World', 'globe earth international'],
    ]],
    ['Media and Culture', [
      ['news', 'News', 'newspaper'],
      ['book', 'Book', 'reading'],
      ['books', 'Library', 'books'],
      ['grad', 'Education', 'school graduation'],
      ['photo', 'Photos', 'image picture'],
      ['camera', 'Camera', ''],
      ['video', 'Video', 'camera'],
      ['film', 'Film', 'movies cinema'],
      ['tv', 'TV', 'television shows'],
      ['music', 'Music', 'note song'],
      ['mic', 'Podcasts', 'microphone audio'],
      ['headphones', 'Audio', 'headphones listen'],
      ['guitar', 'Guitars', 'band'],
      ['brush', 'Art', 'paintbrush draw'],
      ['palette', 'Design', 'palette color'],
      ['theater', 'Theater', 'masks drama arts'],
      ['game', 'Games', 'gaming controller'],
      ['dice', 'Dice', 'games luck'],
      ['puzzle', 'Puzzle', 'games piece'],
      ['party', 'Party', 'popper celebrate'],
      ['quote', 'Quotes', 'quote bubble'],
    ]],
    ['Sports and Outdoors', [
      ['sports', 'Sports', 'court'],
      ['football', 'Football', 'nfl'],
      ['basketball', 'Basketball', 'nba hoops'],
      ['baseball', 'Baseball', 'mlb'],
      ['soccer', 'Soccer', 'football fifa'],
      ['tennis', 'Tennis', 'racket'],
      ['hockey', 'Hockey', 'nhl puck'],
      ['golf', 'Golf', ''],
      ['run', 'Running', 'fitness'],
      ['bike', 'Cycling', 'bicycle bike'],
      ['dumbbell', 'Fitness', 'gym workout dumbbell'],
      ['medal', 'Medal', 'award olympics'],
      ['mountain', 'Mountains', 'outdoors hiking'],
      ['tent', 'Camping', 'tent outdoors'],
      ['tree', 'Tree', 'nature'],
      ['leaf', 'Nature', 'leaf green climate'],
      ['flame', 'Flame', 'hot fire trending'],
      ['drop', 'Water', 'drop'],
      ['sun', 'Sun', 'weather summer'],
      ['moon', 'Night', 'moon'],
      ['snow', 'Winter', 'snowflake cold'],
      ['rain', 'Weather', 'rain cloud'],
    ]],
    ['Life', [
      ['cup', 'Coffee', 'cup tea'],
      ['fork', 'Food', 'fork knife restaurant'],
      ['wine', 'Wine', 'drinks'],
      ['cake', 'Birthday', 'cake'],
      ['carrot', 'Cooking', 'carrot vegetables'],
      ['paw', 'Pets', 'paw dog cat animals'],
      ['bird', 'Birds', 'bird'],
      ['fish', 'Fish', 'fishing'],
      ['car', 'Cars', 'auto driving'],
      ['plane', 'Travel', 'airplane flights'],
      ['boat', 'Sailing', 'boat'],
      ['map', 'Map', 'travel'],
      ['location', 'Local', 'location arrow nearby'],
      ['gift', 'Gifts', 'present'],
      ['health', 'Health', 'medical cross'],
      ['pills', 'Medicine', 'pills pharma'],
      ['family', 'Family', 'kids parents'],
      ['heartcircle', 'Love', 'heart'],
      ['thumbsup', 'Thumbs Up', 'good like'],
    ]],
  ];
  const TABS = [
    ['general', 'General', 'gear'],
    ['media', 'Media', 'photo'],
    ['filters', 'Filters', 'filter'],
    ['mutes', 'Mutes', 'mute'],
    ['layouts', 'Layouts', 'decks'],
    ['keys', 'Keyboard', 'keyboard'],
  ];
  // What a layout holds: Sweeter’s own arrangement, never X Pro’s decks.
  const LAYOUT_KEYS = ['colFilters', 'colWidths', 'colTitles', 'colIcons', 'colTints', 'colModes', 'colAlerts', 'colMedia', 'colGrid', 'views', 'merges', 'groups', 'group', 'fit', 'snap', 'density'];
  const REBUILD = new Set(['tickerPrices', 'muteNotes', 'dedupe', 'repostLabel', 'longPosts', 'badges', 'dateFormat', 'counts', 'obscureSensitive', 'media', 'autoplayVideo', 'autoplayGifs', 'cards', 'quoteMedia']);
  const REPLY_OPTIONS = ['Everyone', 'Accounts you follow', 'Accounts you follow and who they follow', 'Only accounts you mention', 'Verified accounts'];
  const EMOJI = '😂 ❤️ 🔥 👀 🙏 😭 🫡 💯 🚀 ✅ 👍 👏 🤝 🎉 😅 🤔 🙌 😎 🥲 😬 💀 🤯 🫠 ✨ ⚡️ 🧠 📈 📉 💰 🪙 🎯 🛠️ 🤖 🙃 ☕️ 🍿 ⚾️ 🏈 🐐 👋'.split(' ');
  const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'];
  const DURATION_LABEL = { day: '1 Day', week: '1 Week', month: '1 Month', forever: 'Forever' };
  const XF = Sweeter.filters;
  // Accent colors: [id, name, light-theme color, dark-theme color]. Blue is
  // Tweetbot’s own pair. The others keep at least Tweetbot’s 3.4:1 contrast
  // on white. “Match macOS” follows the Mac’s accent color setting.
  const SYS_ACCENT = '-apple-system-control-accent';
  const ACCENTS = [
    ['blue', 'Blue', '#4590E6', '#B2D6FF'],
    ['purple', 'Purple', '#8A56D6', '#CDB4FF'],
    ['pink', 'Pink', '#D63F7A', '#FFB3D0'],
    ['red', 'Red', '#D9443A', '#FFB4AD'],
    ['orange', 'Orange', '#C8650F', '#FFC894'],
    ['yellow', 'Yellow', '#A67C00', '#FFE08A'],
    ['green', 'Green', '#2B8F48', '#A8E6B8'],
    ['teal', 'Teal', '#1A8A96', '#9EE3EA'],
    ['graphite', 'Graphite', '#6E6E73', '#C7C7CC'],
    ['system', 'Match macOS', SYS_ACCENT, 'color-mix(in srgb, ' + SYS_ACCENT + ' 45%, #fff)'],
  ];
  // A column’s color: the accent colors, less Match macOS.
  const TINTS = ACCENTS.filter((a) => a[0] !== 'system');

  function mount(opts) {
    const { store, xpro } = opts;
    const settings = Object.assign({}, DEFAULTS, opts.settings);
    // 0.1 stored “thumbs” (large, small, none); 0.2 calls it “media”.
    if (opts.settings && opts.settings.thumbs && !opts.settings.media) settings.media = { large: 'full', small: 'small', none: 'none' }[opts.settings.thumbs] || 'full';
    delete settings.thumbs;
    // 0.15 dimmed posts “read” elsewhere by default, and a column pinned to
    // the top counted everything it had loaded as read: off, once, for all.
    if (!settings.dedupeV2) settings.dedupe = 'off';
    settings.dedupeV2 = 1;
    const version = opts.version || '';
    // Present only inside the native Sweeter app (a bridge to Swift).
    const native = opts.native || null;
    let rules = (opts.mutes || []).filter((r) => !r.expires || r.expires > Date.now());
    let match = Sweeter.mutes.compile(rules);
    let noteMatch = Sweeter.mutes.compileNote ? Sweeter.mutes.compileNote(rules) : null;
    // Saved custom filters (Ivory’s “create your own”), shared by every column.
    let custom = (opts.filters || []).filter((f) => f && f.id);
    const save = opts.save || (() => {});

    // ---------- shell ----------
    const host = document.createElement('div');
    host.id = 'sweeter-host';
    host.dataset.version = opts.version || '';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    if (native) {
      // In the Mac app the sidebar is a real translucent macOS sidebar drawn
      // behind the page, so X Pro’s own page (still running underneath) must
      // not paint while Sweeter is showing.
      const pageStyle = document.createElement('style');
      pageStyle.textContent = 'html.sweeter-cover,html.sweeter-cover body{background:transparent !important}html.sweeter-cover body>*:not(#sweeter-host){opacity:0 !important}';
      (document.head || document.documentElement).appendChild(pageStyle);
    }
    if ('adoptedStyleSheets' in shadow && typeof CSSStyleSheet === 'function' && 'replaceSync' in CSSStyleSheet.prototype) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(Sweeter.css + (Sweeter.paletteCss || ''));
      shadow.adoptedStyleSheets = [sheet];
    } else {
      const st = document.createElement('style');
      st.textContent = Sweeter.css + (Sweeter.paletteCss || '');
      shadow.appendChild(st);
    }
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="app" tabindex="-1">' +
      '<button class="skip" type="button" data-cmd="skip">Skip to the timeline</button>' +
      '<nav class="side"><button type="button" class="me" data-cmd="me" title="Your profile" aria-label="Your profile"></button><button class="deck" type="button" data-cmd="deckmenu" hidden></button><div class="tabs"></div><span class="spacer"></span>' +
      '<button class="round post" type="button" data-cmd="compose" title="New post (n)" aria-label="New post">' + icon('compose') + '</button>' +
      '<button class="round" type="button" data-cmd="settings" title="Preferences (,)" aria-label="Preferences">' + icon('gear') + '</button>' +
      '<button class="round" type="button" data-cmd="xpro" title="Show X Pro (⌥X)" aria-label="Show X Pro">' + icon('swap') + '</button></nav>' +
      (opts.late ? '<div class="banner"><span>Sweeter started after X Pro loaded, so these columns only show new posts.</span><button type="button" data-cmd="reload">Reload</button><button class="x" type="button" data-cmd="banner-close" aria-label="Dismiss">×</button></div>' : '') +
      '<div class="cols hold"><div class="nocols" hidden><div class="nocols-in"><b>No columns to show</b><span>This X Pro deck has no columns Sweeter can show yet.</span>' +
      '<div class="nocols-b"><button type="button" class="done" data-cmd="add-open">Add Column…</button><button type="button" data-cmd="xpro">Show X Pro</button></div></div></div></div>' +
      '<div class="boot" role="status"><div class="boot-in"><img class="boot-mark" src="' + (Sweeter.MARK || '') + '" alt="">' +
      '<div class="vu" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="boot-t">Tuning in to X Pro</div><div class="boot-s">Loading your columns…</div></div></div>' +
      '<div class="prefs-back" hidden><div class="prefs" role="dialog" aria-modal="true" aria-label="Sweeter preferences">' +
      '<div class="ptitle">Sweeter preferences<button class="x" type="button" data-cmd="close" aria-label="Close preferences">×</button></div>' +
      '<div class="ptabs" role="tablist">' + TABS.map(([id, label, ic]) => '<button class="ptab" type="button" role="tab" data-tab="' + id + '">' + icon(ic) + label + '</button>').join('') + '</div>' +
      '<div class="pbody"></div>' +
      '<div class="pfoot"><span>Sweeter' + (version ? ' ' + h(version) : '') + ' reads what X Pro loads and acts only through X Pro’s own buttons.</span><button class="done" type="button" data-cmd="close">Close</button></div>' +
      '</div></div>' +
      '<div class="prof-back" hidden><div class="prof" role="dialog" aria-modal="true" aria-label="Profile">' +
      '<button class="x pf-close" type="button" data-cmd="prof-close" aria-label="Close profile (Esc)" title="Close (Esc)">' + icon('x') + '</button>' +
      '<div class="pf-scroll" tabindex="-1"><div class="pf-head"></div><div class="pf-tabs" role="tablist" aria-label="Profile sections"></div><div class="pf-list"></div><div class="pf-foot"></div></div>' +
      '</div></div>' +
      '<div class="pop" hidden role="menu"></div>' +
      '<div class="cmp-back" hidden><div class="cmp" role="dialog" aria-modal="true" aria-label="Compose">' +
      '<div class="cmp-head"><span class="cmp-title">New post</span><button class="x" type="button" data-cmd="cmp-cancel" aria-label="Close and keep the draft">×</button></div>' +
      '<div class="cmp-ctx"></div>' +
      '<div class="cmp-body"><div class="cmp-av"></div><textarea id="cmp-text" placeholder="What’s happening?" spellcheck="true" aria-label="Post text" aria-describedby="cmp-status"></textarea></div>' +
      '<div class="cmp-media"></div>' +
      // Who can reply, on its own line under the text, as X shows it.
      // A select is as wide as its longest option, so the chosen one shows as
      // text and a transparent select lies over it.
      '<label class="cmp-who">' + icon('globe') + '<span class="who-t">Everyone can reply</span>' + icon('chevron', 'chev') + '<select id="cmp-reply" aria-label="Who can reply">' + REPLY_OPTIONS.map((o) => '<option value="' + o + '">' + o + ' can reply</option>').join('') + '</select></label>' +
      '<div class="cmp-tools">' +
      '<button class="tb" type="button" data-cmd="cmp-photo" title="Add photos or video. Paste or drop works too." aria-label="Add photos or video. Paste or drop works too.">' + icon('photo') + '</button>' +
      '<button class="tb" type="button" data-cmd="cmp-gif" title="Add a GIF, in X Pro" aria-label="Add a GIF, in X Pro">' + icon('gif') + '</button>' +
      '<button class="tb" type="button" data-cmd="cmp-poll" title="Add a poll, in X Pro" aria-label="Add a poll, in X Pro">' + icon('poll') + '</button>' +
      '<button class="tb" type="button" data-cmd="cmp-emoji" title="Emoji. ⌃⌘Space opens all of them." aria-label="Emoji. ⌃⌘Space opens all of them.">' + icon('emoji') + '</button>' +
      '<button class="tb" type="button" data-cmd="cmp-schedule" title="Schedule, in X Pro" aria-label="Schedule, in X Pro">' + icon('schedule') + '</button>' +
      '<button class="tb" type="button" data-cmd="cmp-location" title="Tag location, in X Pro" aria-label="Tag location, in X Pro">' + icon('pin') + '</button>' +
      '<button class="tb" type="button" data-cmd="cmp-grok" title="Generate an image with Grok, in X Pro" aria-label="Generate an image with Grok, in X Pro">' + icon('spark') + '</button>' +
      '<span class="sepv"></span>' +
      '<button class="tb" type="button" data-cmd="cmp-bold" title="Bold (⌘B)" aria-label="Bold (⌘B)">' + icon('bold') + '</button>' +
      '<button class="tb" type="button" data-cmd="cmp-italic" title="Italic (⌘I)" aria-label="Italic (⌘I)">' + icon('italic') + '</button>' +
      '</div>' +
      '<div class="cmp-drop">Drop photos or a video</div>' +
      '<div class="emo" hidden>' + EMOJI.map((e) => '<button type="button" data-emoji="' + e + '">' + e + '</button>').join('') + '<div class="hint">⌃⌘Space opens every emoji.</div></div>' +
      '<input type="file" id="cmp-file" accept="' + ACCEPT.join(',') + '" multiple hidden>' +
      '<div class="cmp-foot"><button class="cmp-xpro" type="button" data-cmd="cmp-xpro" title="Finish in X Pro’s own composer, for photos, polls and scheduling">Open in X Pro</button>' +
      '<span class="cmp-status" id="cmp-status" role="status"></span><span class="grow"></span><span class="cmp-count"></span>' +
      '<button class="cmp-post" type="button" data-cmd="cmp-post" title="Post (⌘Return)">Post</button></div>' +
      '</div></div>' +
      '<div class="lb" hidden role="dialog" aria-label="Media viewer">' +
      '<div class="lb-top"><span class="lb-count"></span><span class="grow"></span><a class="lb-orig" href="#" target="_blank" rel="noopener noreferrer">Open original</a>' +
      '<button class="lb-close" type="button" data-cmd="lb-close" aria-label="Close (Esc)">' + icon('x') + '</button></div>' +
      '<div class="lb-stage"><button class="lb-nav lb-prev" type="button" data-cmd="lb-prev" aria-label="Previous (←)">‹</button><div class="lb-media"></div>' +
      '<button class="lb-nav lb-next" type="button" data-cmd="lb-next" aria-label="Next (→)">›</button></div>' +
      '<div class="lb-cap"></div></div>' +
      '<div class="add-back" hidden><div class="addsheet" role="dialog" aria-modal="true" aria-label="Add a column">' +
      '<div class="ptitle"><button class="x aback" type="button" data-cmd="add-back" aria-label="Back" hidden>‹</button>Add a column<button class="x aclose" type="button" data-cmd="add-close" aria-label="Close">×</button></div>' +
      '<div class="add-body"></div>' +
      '<div class="pfoot"><span>Sweeter adds it through X Pro, so it appears on all your devices.</span></div>' +
      '</div></div>' +
      '<div class="ask-back" hidden><form class="ask" role="dialog" aria-modal="true"><div class="ask-t"></div><input class="ask-in" type="text" autocomplete="off" spellcheck="false" maxlength="40"><div class="ask-b"><button type="button" data-cmd="ask-no">Cancel</button><button type="submit" class="done">OK</button></div></form></div>' +
      '<div class="ov-back" hidden><div class="ov" role="dialog" aria-modal="true" aria-label="All decks"><div class="ptitle">All decks<button class="x" type="button" data-cmd="ov-close" aria-label="Close">×</button></div><div class="ov-body"></div><div class="pfoot"><span>Only the deck on screen loads posts. A click switches X Pro to that deck, on all your devices.</span></div></div></div>' +
      '<div class="ip-back" hidden><div class="ip" role="dialog" aria-modal="true" aria-label="Icon and color"><div class="ptitle">Icon &amp; Color<button class="x" type="button" data-cmd="ip-cancel" aria-label="Cancel">×</button></div>' +
      '<div class="ip-head"><span class="ip-prev"></span><input class="ip-q" type="search" placeholder="Search icons" aria-label="Search icons" autocomplete="off" spellcheck="false"></div>' +
      '<div class="ip-colors" role="radiogroup" aria-label="Color"></div><div class="ip-body" role="radiogroup" aria-label="Icon"></div>' +
      '<div class="ip-foot"><button type="button" data-cmd="ip-reset">Use Defaults</button><span class="grow"></span><button type="button" data-cmd="ip-cancel">Cancel</button><button type="button" class="done" data-cmd="ip-done">Done</button></div></div></div>' +
      '<div class="nt-back" hidden><div class="ask nt" role="alertdialog" aria-modal="true" aria-labelledby="nt-t" aria-describedby="nt-b"><div class="nt-head"><span class="nt-ic"></span><div class="ask-t" id="nt-t">Turn on notifications for Sweeter</div></div><p class="nt-b" id="nt-b"></p><div class="ask-b"><button type="button" data-cmd="nt-no">Not Now</button><button type="button" class="done" data-cmd="nt-go">Open Notification Settings</button></div></div></div>' +
      '<div class="utoast" hidden role="status" aria-live="polite"></div>' +
      '<div class="toast" hidden role="status" aria-live="polite"></div></div>' +
      '<button class="fab" type="button" hidden title="Show Sweeter (⌥X)"><i></i>Sweeter</button>';
    while (wrap.firstChild) shadow.appendChild(wrap.firstChild);

    const app = shadow.querySelector('.app');
    const colsEl = shadow.querySelector('.cols');
    const nocolsEl = shadow.querySelector('.nocols');
    const tabsEl = shadow.querySelector('.tabs');
    const meEl = shadow.querySelector('.me');
    const deckEl = shadow.querySelector('.deck');
    const prefsEl = shadow.querySelector('.prefs-back');
    const pbody = shadow.querySelector('.pbody');
    const pop = shadow.querySelector('.pop');
    const profBack = shadow.querySelector('.prof-back');
    const profBox = shadow.querySelector('.prof');
    const profScroll = shadow.querySelector('.pf-scroll');
    const profHead = shadow.querySelector('.pf-head');
    const profTabs = shadow.querySelector('.pf-tabs');
    const profList = shadow.querySelector('.pf-list');
    const profFoot = shadow.querySelector('.pf-foot');
    const cmpBack = shadow.querySelector('.cmp-back');
    const cmpTitle = shadow.querySelector('.cmp-title');
    const cmpCtx = shadow.querySelector('.cmp-ctx');
    const cmpAv = shadow.querySelector('.cmp-av');
    const cmpText = shadow.querySelector('#cmp-text');
    const cmpCount = shadow.querySelector('.cmp-count');
    const cmpStatus = shadow.querySelector('.cmp-status');
    const cmpPost = shadow.querySelector('.cmp-post');
    const cmpBox = shadow.querySelector('.cmp');
    const cmpMedia = shadow.querySelector('.cmp-media');
    const cmpReply = shadow.querySelector('#cmp-reply');
    const cmpFile = shadow.querySelector('#cmp-file');
    const emoEl = shadow.querySelector('.emo');
    const lbEl = shadow.querySelector('.lb');
    const lbMedia = shadow.querySelector('.lb-media');
    const bootEl = shadow.querySelector('.boot');
    const bootStart = Date.now();
    let booting = true;
    const ntChecked = new Set(); // view ids whose alerts were checked (checkNewAlerts)
    const toastEl = shadow.querySelector('.toast');
    const utoast = shadow.querySelector('.utoast');
    const addBack = shadow.querySelector('.add-back');
    const addBody = shadow.querySelector('.add-body');
    const askBack = shadow.querySelector('.ask-back');
    const ovBack = shadow.querySelector('.ov-back');
    const ipBack = shadow.querySelector('.ip-back');
    const ntBack = shadow.querySelector('.nt-back');
    const fab = shadow.querySelector('.fab');

    // Column identity: every column on screen has a view id. An X Pro
    // column’s is 'c:' + its server id (or its source key until X Pro’s deck
    // model names it); a Sweeter-only view’s is 'v:' + an id of its own.
    // c.key is the source (the store timeline) it draws. Actions on a post
    // go through the X Pro column that shows that source.
    const cols = new Map(); // view id -> column UI state
    let mapping = []; // X Pro’s columns (xpro.order), each with its vid
    let layout = []; // what Sweeter shows: { vid, key, m, view } in order
    let mapSig = '';
    let focusVid = null;
    let viewer = null;
    let toastTimer = 0;
    // Long posts the reader opened (they stay open across redraws).
    const expanded = new Set();
    // True while X Pro’s own composer is on screen: keys and clicks go to X Pro.
    let passthrough = false;
    // True while Sweeter has a conversation open in X Pro for a moment (to
    // bookmark): the column shows that, so leave the mapping alone.
    // Why the column mapping is frozen right now: 'profile', 'bookmark',
    // 'columnOp'… Each owner adds and removes only its own reason, so one
    // operation finishing never unfreezes another’s.
    const holds = new Set();

    function applySettings() {
      app.dataset.skin = settings.skin;
      app.dataset.round = String(settings.round);
      app.dataset.names = settings.names;
      app.dataset.media = settings.media;
      app.dataset.density = settings.density;
      app.dataset.links = settings.links;
      app.dataset.actions = settings.actions;
      app.dataset.counts = String(settings.counts);
      app.style.setProperty('--fs', settings.fontSize + 'px');
      app.style.setProperty('--colw', settings.colWidth + 'px');
      app.dataset.fit = settings.fit;
      if (settings.snap) app.dataset.snap = '';
      else delete app.dataset.snap;
      requestAnimationFrame(fitWidth);
      // Blue keeps Tweetbot’s exact tokens; Winamp keeps its own colors.
      const ac = settings.skin !== 'winamp' && settings.accent !== 'blue' ? ACCENTS.find((a) => a[0] === settings.accent) : null;
      if (ac) {
        app.dataset.accent = ac[0];
        app.style.setProperty('--al', ac[2]);
        app.style.setProperty('--ad', ac[3]);
      } else delete app.dataset.accent;
      if (settings.skin !== 'winamp' && settings.contrast !== 'standard') app.dataset.contrast = settings.contrast;
      else delete app.dataset.contrast;
      if (settings.skin !== 'winamp' && settings.pureBlack) app.dataset.black = '';
      else delete app.dataset.black;
      app.hidden = !settings.visible || passthrough;
      fab.hidden = settings.visible || passthrough;
      if (native) {
        document.documentElement.classList.toggle('sweeter-cover', settings.visible && !passthrough);
        reportState();
      }
    }

    // Equal widths: no column keeps a width of its own, and every column
    // shares the window equally (the last one included).
    function equalWidths() {
      settings.colWidths = {};
      for (const c of cols.values()) applyWidth(c);
      setOne('fit', 'equal');
      toast('Columns share the window equally');
    }

    // Fit N: each column is a 1/N share of the space beside the sidebar.
    function fitWidth() {
      const n = /^fit(\d)$/.exec(settings.fit || '');
      if (!n || !colsEl || !colsEl.clientWidth) return; // hidden: measured when it shows
      const k = Number(n[1]);
      const cs = getComputedStyle(colsEl);
      const space = colsEl.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - (k - 1) * (parseFloat(cs.columnGap) || 0);
      app.style.setProperty('--fitw', Math.floor(space / k) + 'px');
    }
    window.addEventListener('resize', () => fitWidth());
    if ('ResizeObserver' in window) new ResizeObserver(() => fitWidth()).observe(colsEl);

    function persist() {
      save({ settings: Object.assign({}, settings) });
    }

    // The signed-in account, from X Pro’s account button. X Pro draws the
    // button before its picture, so this looks again until it has both; a
    // picture from a loaded post stands in meanwhile.
    function paintMe() {
      if (viewer && viewer.handle && viewer.avatar && !viewer.stand) return;
      const v = xpro.viewer();
      if (!v || !v.handle) return;
      let avatar = v.avatar;
      let stand = false;
      if (!avatar) {
        const u = personOf(v.handle);
        avatar = (u && u.avatar) || '';
        stand = !!avatar;
      }
      if (viewer && viewer.handle === v.handle && viewer.avatar === avatar) return;
      viewer = { handle: v.handle, avatar, stand };
      if (avatar) meEl.style.backgroundImage = 'url("' + safeUrl(avatar.replace(/_(normal|bigger|mini|x96)\./, '_200x200.')) + '")';
      meEl.title = 'Your profile (@' + v.handle + ')';
    }

    // Done (the default, with a check or the icon named), 'info' or 'warn'.
    function toast(msg, kind) {
      const k = kind === 'warn' || kind === 'info' ? kind : 'ok';
      toastEl.dataset.kind = k;
      toastEl.innerHTML = icon(k === 'ok' ? (kind && Sweeter.SYMBOLS && Sweeter.SYMBOLS[kind] ? kind : 'check') : k) + '<span>' + h(msg) + '</span>';
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toastEl.hidden = true), 1800);
    }

    // ---------- contract addresses ----------
    // A click on an address (text.js links them) opens a card from
    // DexScreener's public API: fetched only then, cached two minutes.
    const dexCache = new Map(); // address -> { at, body: { pairs } }
    const DEX_FRESH = 180000;
    const dexFresh = (a) => {
      const hit = dexCache.get(a);
      return hit && Date.now() - hit.at < DEX_FRESH ? hit.body : null;
    };
    // Up to 30 addresses in one request; each address keeps its own pairs.
    async function dexLookupMany(list) {
      const want = [...new Set(list)].filter((a) => !dexFresh(a)).slice(0, 30);
      if (want.length) {
        let body;
        if (native && native.dex) body = await native.dex(want.join(','));
        else if (opts.dex) body = await opts.dex(want.join(','));
        else throw new Error('no lookup');
        if (typeof body === 'string') body = JSON.parse(body);
        const pairs = (body && body.pairs) || [];
        const at = Date.now();
        for (const a of want) {
          const key = (x) => (a.startsWith('0x') ? String(x || '').toLowerCase() === a.toLowerCase() : x === a);
          dexCache.set(a, { at, body: { pairs: pairs.filter((pr) => pr && ((pr.baseToken && key(pr.baseToken.address)) || (pr.quoteToken && key(pr.quoteToken.address)))) } });
        }
      }
      return list.map((a) => dexFresh(a) || (dexCache.get(a) || {}).body || { pairs: [] });
    }
    async function dexLookup(a) {
      return (await dexLookupMany([a]))[0];
    }
    // The most liquid pair where the address is the token itself (else one
    // where it is the quote side, with no price of its own).
    function dexPick(body, a, chain) {
      let pairs = (body && body.pairs) || [];
      // A ticker card names its chain: the same address can be on several.
      if (chain && pairs.some((x) => x && x.chainId === chain)) pairs = pairs.filter((x) => x && x.chainId === chain);
      const same = (x) => !!x && (a.startsWith('0x') ? x.toLowerCase() === a.toLowerCase() : x === a);
      const base = pairs.filter((p) => p && p.baseToken && same(p.baseToken.address));
      const pool = base.length ? base : pairs.filter((p) => p && p.quoteToken && same(p.quoteToken.address));
      pool.sort((x, y) => ((y.liquidity || {}).usd || 0) - ((x.liquidity || {}).usd || 0));
      return pool[0] ? { pair: pool[0], token: base.length ? pool[0].baseToken : pool[0].quoteToken, priced: base.length > 0 } : null;
    }
    const CHAIN_NAMES = { ethereum: 'Ethereum', base: 'Base', solana: 'Solana', arbitrum: 'Arbitrum', optimism: 'Optimism', polygon: 'Polygon', bsc: 'BNB Chain', avalanche: 'Avalanche', blast: 'Blast', linea: 'Linea', zksync: 'zkSync', hyperevm: 'HyperEVM', unichain: 'Unichain', abstract: 'Abstract', sonic: 'Sonic' };
    const EXPLORERS = { ethereum: 'https://etherscan.io/token/', base: 'https://basescan.org/token/', arbitrum: 'https://arbiscan.io/token/', optimism: 'https://optimistic.etherscan.io/token/', polygon: 'https://polygonscan.com/token/', bsc: 'https://bscscan.com/token/', avalanche: 'https://snowtrace.io/token/', blast: 'https://blastscan.io/token/', linea: 'https://lineascan.build/token/', solana: 'https://solscan.io/token/' };
    function explorerUrl(a, chain) {
      if (EXPLORERS[chain]) return EXPLORERS[chain] + a;
      return a.startsWith('0x') ? 'https://blockscan.com/address/' + a : 'https://solscan.io/account/' + a;
    }
    // A pair's age: 40m, 5h, 12d, 4mo, 3y.
    function ageLabel(ms) {
      const m = Math.max(0, (Date.now() - ms) / 60000);
      if (m < 60) return Math.round(m) + 'm';
      if (m < 1440) return Math.round(m / 60) + 'h';
      if (m < 1440 * 60) return Math.round(m / 1440) + 'd';
      if (m < 1440 * 730) return Math.round(m / 43800) + 'mo';
      return Math.round(m / 525600) + 'y';
    }
    function usd(n) {
      if (n == null || !isFinite(n)) return '–';
      const v = Number(n);
      if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
      if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
      if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
      if (v >= 1) return '$' + v.toFixed(2);
      return '$' + Number(v.toPrecision(3)).toString();
    }
    function tokenCard(a, state, data) {
      const short = a.slice(0, 6) + '…' + a.slice(-4);
      const foot = '<div class="tk-b">' +
        '<button type="button" data-cmd="tk-open" data-v="' + h(data && data.pair ? data.pair.url : 'https://dexscreener.com/search?q=' + encodeURIComponent(a)) + '">' + icon('open') + 'Open on DexScreener</button>' +
        '<button type="button" data-cmd="tk-scan" data-v="' + h(explorerUrl(a, data && data.pair ? data.pair.chainId : '')) + '">' + icon('search') + 'Block Explorer</button>' +
        '<button type="button" data-cmd="tk-copy" data-v="' + h(a) + '">' + icon('link') + 'Copy Address</button></div>';
      let body;
      if (state === 'loading') body = '<div class="tk-msg">Looking up ' + h(short) + ' on DexScreener…</div>';
      else if (state === 'error') body = '<div class="tk-msg">DexScreener didn’t answer. Try again, or open it there.</div>';
      else if (!data) body = '<div class="tk-msg">DexScreener has no trading pairs for ' + h(short) + '. It may be a wallet or an unlisted token.</div>';
      else {
        const p = data.pair;
        const chg = p.priceChange && p.priceChange.h24 != null ? Number(p.priceChange.h24) : null;
        const age = p.pairCreatedAt ? ageLabel(p.pairCreatedAt) : '';
        const dex = p.dexId ? String(p.dexId).replace(/(^|[-_ ])([a-z])/g, (x, s, c) => (s ? ' ' : '') + c.toUpperCase()) : '';
        body = '<div class="tk-h"><b>' + h(data.token.name || 'Token') + '</b><span class="tk-sym">$' + h(data.token.symbol || '') + '</span></div>' +
          '<div class="tk-sub">' + h([CHAIN_NAMES[p.chainId] || p.chainId, dex, age ? 'pair ' + age + ' old' : ''].filter(Boolean).join(' · ')) + '</div>' +
          (data.priced ? '<div class="tk-price">' + h(usd(p.priceUsd)) + (chg != null ? ' <span class="' + (chg >= 0 ? 'up' : 'down') + '">' + (chg >= 0 ? '+' : '') + chg.toFixed(1) + '% 24h</span>' : '') + '</div>' : '') +
          '<div class="tk-grid"><span>Market cap</span><b>' + h(usd(p.marketCap != null ? p.marketCap : p.fdv)) + '</b><span>Liquidity</span><b>' + h(usd((p.liquidity || {}).usd)) + '</b><span>24h volume</span><b>' + h(usd((p.volume || {}).h24)) + '</b></div>';
      }
      return '<div class="tok" role="dialog" aria-label="Token ' + h(short) + '">' + body + '<div class="tk-a" title="' + h(a) + '">' + h(a) + '</div>' + foot + '<div class="tk-src">Data from DexScreener, fetched when you clicked.</div></div>';
    }
    let tokenFor = null;
    async function openToken(el) {
      const a = el.dataset.ca;
      const chain = el.dataset.chain || '';
      closePop();
      tokenFor = a;
      pop.innerHTML = tokenCard(a, 'loading');
      placePop(el);
      let html;
      try {
        html = tokenCard(a, 'done', dexPick(await dexLookup(a), a, chain));
      } catch (e) {
        html = tokenCard(a, 'error');
      }
      // Still showing this address: fill it in (and keep it on screen).
      if (tokenFor !== a || pop.hidden) return;
      pop.innerHTML = html;
      placePop(el);
    }

    // Ticker cards: filled from DexScreener once on screen (if the reader
    // allows it), batched and cached, in the main window and pop-outs.
    const tkWant = new Set();
    let tkTimer = 0;
    const tkIO = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          for (const en of entries) {
            if (!en.isIntersecting) continue;
            tkIO.unobserve(en.target);
            tkWant.add(en.target.dataset.ca);
          }
          if (tkWant.size && !tkTimer) tkTimer = setTimeout(fillTickers, 250);
        })
      : null;
    function paintTicker(el) {
      const a = el.dataset.ca;
      const hit = dexFresh(a);
      if (!hit) return false;
      const d = dexPick(hit, a, el.dataset.chain);
      el.dataset.filled = '1';
      if (!d) return true;
      if (d.token.symbol) el.querySelector('.tkc-s').textContent = '$' + d.token.symbol;
      el.querySelector('.tkc-n').textContent = d.token.name || '';
      if (d.priced) {
        el.querySelector('.tkc-p').textContent = usd(d.pair.priceUsd);
        const chg = d.pair.priceChange && d.pair.priceChange.h24 != null ? Number(d.pair.priceChange.h24) : null;
        const c = el.querySelector('.tkc-c');
        c.textContent = chg != null ? (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%' : '';
        c.className = 'tkc-c' + (chg == null ? '' : chg >= 0 ? ' up' : ' down');
      }
      return true;
    }
    function tickerRoots() {
      const roots = [shadow];
      for (const rec of popouts.values()) if (!rec.w.closed) roots.push(rec.root);
      return roots;
    }
    // eager: a pop-out window (this window's observer can't see its
    // viewport): every card it shows loads at once.
    function watchTickers(root, eager) {
      if (!settings.tickerPrices || !root) return;
      for (const el of root.querySelectorAll('.tkc:not([data-filled]):not([data-obs])')) {
        if (paintTicker(el)) continue;
        el.dataset.obs = '1';
        if (eager || !tkIO) tkWant.add(el.dataset.ca);
        else tkIO.observe(el);
      }
      if (tkWant.size && !tkTimer) tkTimer = setTimeout(fillTickers, 250);
    }
    async function fillTickers() {
      tkTimer = 0;
      const list = [...tkWant];
      tkWant.clear();
      try {
        await dexLookupMany(list);
      } catch (e) {
        return;
      }
      for (const root of tickerRoots()) for (const el of root.querySelectorAll('.tkc:not([data-filled])')) if (list.includes(el.dataset.ca)) paintTicker(el);
    }

    function openUrl(url) {
      const u = safeUrl(url);
      if (u !== '#') window.open(u, '_blank', 'noopener,noreferrer');
    }

    // ---------- columns ----------

    function makeCol(e) {
      const key = e.key;
      const el = document.createElement('section');
      el.className = 'col' + (e.view ? ' isview' : '') + (e.merge ? ' ismerge' : '');
      el.dataset.key = key;
      el.dataset.vid = e.vid;
      el.innerHTML =
        '<header class="ch" title="Click: where you stopped reading. Click again: the top, and stay there."><span class="cic" hidden></span><span class="ct"></span><input class="ren" type="text" hidden aria-label="Column title" autocomplete="off" spellcheck="false"><span class="live" title="Pinned to the top: new posts stream in"></span><span class="stl" hidden>' + icon('clock') + '</span><span class="cs"></span>' +
        '<button class="fchip" type="button" data-cmd="filter" hidden title="Filters on. Click to change them."></button>' +
        '<input class="find" type="search" placeholder="Find in loaded posts" aria-label="Find in this column’s loaded posts" autocomplete="off" spellcheck="false" hidden>' +
        '<span class="fnum" hidden></span>' +
        '<button class="pill" type="button" data-cmd="jump" hidden title="Jump to where you stopped reading"></button>' +
        '<button class="mini flt" type="button" data-cmd="filter" title="Filter this column (⌥1 to ⌥9)" aria-label="Filter this column" aria-haspopup="menu">' + icon('filter') + '</button>' +
        '<button class="mini" type="button" data-cmd="markread" title="Mark all as read (⌘K)" aria-label="Mark all as read">' + icon('check') + '</button>' +
        '<button class="mini cmenu" type="button" data-cmd="colmenu" title="Column menu" aria-label="Column menu" aria-haspopup="menu">' + icon('more') + '</button></header>' +
        '<div class="scroll"><div class="list"></div><div class="foot"></div></div>' +
        '<div class="rsz" title="Drag to resize. Double-click to reset." aria-hidden="true"></div>';
      const c = {
        key,
        vid: e.vid,
        view: !!e.view,
        merge: e.merge || null,
        el,
        scroll: el.querySelector('.scroll'),
        list: el.querySelector('.list'),
        foot: el.querySelector('.foot'),
        pill: el.querySelector('.pill'),
        title: el.querySelector('.ct'),
        cic: el.querySelector('.cic'),
        stl: el.querySelector('.stl'),
        renEl: el.querySelector('.ren'),
        sub: el.querySelector('.cs'),
        chip: el.querySelector('.fchip'),
        fbtn: el.querySelector('.flt'),
        findEl: el.querySelector('.find'),
        fnum: el.querySelector('.fnum'),
        pred: null, // the column’s filters, as one test
        find: '',
        findPred: null,
        nodes: new Map(),
        marker: null,
        markerSort: null,
        visSorts: [],
        lastOlder: 0,
        ticking: false,
        full: true,
        pinned: settings.pinToTop,
      };
      c.scroll.style.position = 'relative';
      c.scroll.addEventListener('scroll', () => onScroll(c), { passive: true });
      c.scroll.addEventListener('pointerenter', () => {
        c.hover = true;
        c.hoverAt = Date.now();
      });
      c.scroll.addEventListener('pointerleave', () => {
        c.hover = false;
        if (!c.paused) return;
        // Leaving a paused column resumes the stream at the newest post.
        c.paused = false;
        c.el.classList.remove('paused');
        if (c.pinned) {
          c.scroll.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
          setTimeout(() => renderColumn(c, false), 400);
        }
      });
      c.sb = overlayBar(c.scroll, el, 'var(--chh)', c.list);
      c.findEl.addEventListener('input', () => setFind(c, c.findEl.value));
      // Leaving the field saves Sweeter’s own title; a title in X Pro (on
      // every device) is sent only with Return.
      c.renEl.addEventListener('blur', () => endRename(c, !c.renX));
      buildPreds(c);
      paintFilterUI(c);
      return c;
    }

    // Overlay scroll bar: the native one is hidden so posts keep the full
    // column width. The thumb shows while scrolling or hovering and drags.
    function overlayBar(scroller, host, top, content) {
      const bar = document.createElement('div');
      bar.className = 'sbar';
      bar.style.top = top;
      bar.innerHTML = '<div class="sthumb"></div>';
      host.appendChild(bar);
      const thumb = bar.firstChild;
      let hideTimer = 0;
      let drag = null;
      const update = () => {
        const h = scroller.clientHeight;
        const H = scroller.scrollHeight;
        if (H <= h + 1) {
          bar.hidden = true;
          return;
        }
        bar.hidden = false;
        const th = Math.max(28, (h * h) / H);
        thumb.style.height = th + 'px';
        thumb.style.transform = 'translateY(' + (scroller.scrollTop / (H - h)) * (h - th) + 'px)';
      };
      const show = () => {
        update();
        bar.classList.add('on');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (!drag && !bar.matches(':hover')) bar.classList.remove('on');
        }, 1000);
      };
      scroller.addEventListener('scroll', show, { passive: true });
      host.addEventListener('pointerenter', show);
      bar.addEventListener('pointerleave', show);
      thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        thumb.setPointerCapture(e.pointerId);
        drag = { y: e.clientY, top: scroller.scrollTop };
        bar.classList.add('drag');
      });
      thumb.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const h = scroller.clientHeight;
        scroller.scrollTop = drag.top + ((e.clientY - drag.y) * (scroller.scrollHeight - h)) / Math.max(1, h - thumb.offsetHeight);
      });
      const end = () => {
        drag = null;
        bar.classList.remove('drag');
        show();
      };
      thumb.addEventListener('pointerup', end);
      thumb.addEventListener('pointercancel', end);
      // A click on the track pages toward it.
      bar.addEventListener('pointerdown', (e) => {
        if (e.target !== bar) return;
        const r = thumb.getBoundingClientRect();
        scroller.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * (scroller.clientHeight - 60) });
      });
      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(update);
        ro.observe(scroller);
        if (content) ro.observe(content);
      }
      return { update, bar };
    }

    // The column’s own title in X Pro (a rename), then what the data says
    // (a list’s name), then the title on X Pro’s header when the data has
    // only a generic one (“List”, “Profile”).
    function columnTitle(key, s, own) {
      const m = own || mapping.find((x) => x.key === key);
      if (m && m.col && m.col.title) return m.col.title;
      const generic = (s.kind === 'list' && s.title === 'List') || s.kind === 'user' || s.kind === 'conversation';
      return (generic && m && m.dom && m.dom.title) || s.title || (m && m.dom && m.dom.title) || '';
    }

    const vidOf = (m) => (m.colId ? 'c:' + m.colId : m.key);
    const entryOf = (vid) => layout.find((e) => e.vid === vid) || null;
    // The column on screen for a source: its X Pro column first, else a view.
    function colOfSrc(key) {
      const m = mappingFor(key);
      return (m && cols.get(m.vid)) || Array.from(cols.values()).find((c) => c.key === key) || null;
    }
    // What a column is called: the person’s own title, then X Pro’s.
    function titleOf(vid) {
      const own = (settings.colTitles || {})[vid];
      if (own) return own;
      const e = entryOf(vid);
      if (e && e.merge) return e.merge.srcs.map((k) => (store.get(k) ? columnTitle(k, store.get(k)) : '')).filter(Boolean).join(' + ') || 'Merged';
      const s = e && store.get(e.key);
      return s ? columnTitle(e.key, s, e.m || (entryOf(e.base) || {}).m) : '';
    }
    const modeOf = (vid) => (settings.colModes || {})[vid] || null;
    // The settings a column renders with: its own media mode, if it has one.
    function colSettings(c) {
      const md = c && (settings.colMedia || {})[c.vid];
      return md && md !== settings.media ? Object.assign({}, settings, { media: md }) : settings;
    }
    // A column made this session is known by X Pro’s local-<uuid> until the
    // deck model names it: carry it, and its settings, to its real id.
    function moveVid(from, to) {
      const c = cols.get(from);
      cols.delete(from);
      c.vid = to;
      c.el.dataset.vid = to;
      cols.set(to, c);
      if (focusVid === from) focusVid = to;
      if (ntChecked.delete(from)) ntChecked.add(to);
      let changed = false;
      for (const n of OWN) {
        if (settings[n] && from in settings[n]) {
          const next = Object.assign({}, settings[n]);
          next[to] = next[from];
          delete next[from];
          settings[n] = next;
          changed = true;
        }
      }
      if ((settings.views || []).some((v) => v.col === from)) {
        settings.views = settings.views.map((v) => (v.col === from ? Object.assign({}, v, { col: to }) : v));
        changed = true;
      }
      if (changed) persist();
    }
    // The layout: X Pro’s columns in deck order, each followed by the
    // Sweeter views of its source (a view shows only with its column).
    // A view follows its column’s id (so it survives an Edit Search or a
    // Home tab change in X Pro); a view saved without one, the source.
    // A merged column shows after the column it was made from (or after
    // the first of its sources), and only while two of its sources are here.
    function buildLayout(maps) {
      const out = [];
      const merges = (settings.merges || []).filter((r) => r.srcs.filter((k) => maps.some((m) => m.key === k)).length >= 2);
      const placed = new Set();
      for (const m of maps) {
        out.push({ vid: m.vid, key: m.key, m, view: null, base: m.vid });
        for (const v of settings.views || []) if (v.col ? v.col === m.vid : v.src === m.key) out.push({ vid: v.id, key: m.key, m: null, view: v, base: m.vid });
        for (const r of merges) {
          if (placed.has(r.id)) continue;
          const here = maps.some((x) => x.vid === r.anchor) ? r.anchor === m.vid : r.srcs.includes(m.key);
          if (!here) continue;
          placed.add(r.id);
          out.push({ vid: r.id, key: mergeKey(r), m: null, view: null, merge: r, base: r.id });
        }
      }
      return out;
    }
    // ---------- merged columns ----------
    const mergeKey = (r) => 'merge:' + r.id.slice(2);
    // Sources a merged column can take: time-ordered ones Sweeter acts from.
    function mergeable(e) {
      if (!e || e.view || e.merge || !e.m || actingAs(e.vid) !== null) return false;
      const s = store.get(e.key);
      if (!s) return false;
      return e.key === 'home' || s.kind === 'list' || s.kind === 'user' || (s.kind === 'search' && /:Latest$/.test(e.key));
    }
    // The newest post id in a block: its time, as X numbers posts.
    function idOf(b) {
      // A profile’s pinned post sits outside time order: never counted.
      if (b.pinned) return null;
      let best = null;
      for (const p of b.kind === 'post' ? [b.post] : b.kind === 'thread' ? b.posts : []) {
        const id = p && !p.unavailable ? p.repostId || p.id : null;
        if (id && (!best || compareSort(id, best) > 0)) best = id;
      }
      return best;
    }
    const mergeCopies = new Map(); // merge id -> Map(block key -> { src, copy })
    const mergeBelow = new Map(); // merge id -> { n, by }: posts older than the horizon
    // The merged list: every source’s posts once, by post time (never by
    // sortIndex, which X numbers per fetch), down to the horizon: the
    // oldest post every source still reaches, so no source leaves a gap.
    function feedMerge(r) {
      const key = mergeKey(r);
      if (!store.get(key)) store.declare({ key, kind: 'merged', title: 'Merged' });
      // Only sources on this deck (a removed column’s posts would go stale).
      const feeders = r.srcs.filter((k) => mappingFor(k)).map((k) => store.get(k)).filter((s) => s && s.sorted.length);
      let horizon = null;
      let by = null;
      for (const s of feeders) {
        let oldest = null;
        for (const b of s.sorted) {
          const id = idOf(b);
          if (id && (!oldest || compareSort(id, oldest) < 0)) oldest = id;
        }
        if (oldest && (!horizon || compareSort(oldest, horizon) > 0)) {
          horizon = oldest;
          by = s.key;
        }
      }
      let below = 0;
      const cache = mergeCopies.get(r.id) || new Map();
      const next = new Map();
      const seenIds = new Set();
      const out = [];
      for (const s of feeders) {
        for (const b of s.sorted) {
          const id = idOf(b);
          if (!id) continue;
          if (horizon && feeders.length > 1 && compareSort(id, horizon) < 0) {
            below++;
            continue;
          }
          const ps = b.kind === 'post' ? [b.post] : b.posts;
          if (ps.every((x) => seenIds.has(x.id))) continue;
          for (const x of ps) seenIds.add(x.id);
          let hit = cache.get(b.key);
          if (!hit || hit.src !== b) hit = { src: b, copy: Object.assign({}, b, { sortIndex: id }) };
          next.set(b.key, hit);
          out.push(hit.copy);
        }
      }
      mergeCopies.set(r.id, next);
      mergeBelow.set(r.id, below ? { n: below, by } : null);
      store.feed(key, out);
    }
    function createMerge(c, other) {
      const id = 'm:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      settings.merges = (settings.merges || []).concat([{ id, srcs: [c.key, other.key], anchor: (entryOf(c.vid) || {}).base || c.vid }]);
      persist();
      joinGroup(id);
      remap(true);
      for (const cc of cols.values()) renderColumn(cc, false);
      goCol(id);
      toast('Merged “' + titleOf(c.vid) + '” and “' + titleOf(other.vid) + '”');
    }
    function setMergeSource(vid, key, on) {
      const r = (settings.merges || []).find((x) => x.id === vid);
      if (!r) return;
      if (on && r.srcs.length >= 5) return toast('A merged column takes at most five columns.', 'warn');
      if (!on && r.srcs.length <= 2) return toast('A merged column needs two columns. “Unmerge” removes it.', 'warn');
      if (!on && mappingFor(key) && r.srcs.filter((k) => k !== key && mappingFor(k)).length < 2) return toast('A merged column needs two columns here. “Unmerge” removes it.', 'warn');
      const srcs = on ? r.srcs.concat([key]) : r.srcs.filter((k) => k !== key);
      settings.merges = settings.merges.map((x) => (x.id === vid ? Object.assign({}, x, { srcs }) : x));
      persist();
      mergeCopies.delete(vid);
      remap(true);
      const e = entryOf(vid);
      if (e && e.merge) feedMerge(e.merge);
    }
    function removeMerge(vid) {
      const r = (settings.merges || []).find((x) => x.id === vid);
      if (!r) return;
      const title = titleOf(vid);
      const saved = {};
      for (const n of OWN) {
        if (settings[n] && vid in settings[n]) {
          saved[n] = settings[n][vid];
          const next = Object.assign({}, settings[n]);
          delete next[vid];
          settings[n] = next;
        }
      }
      settings.merges = settings.merges.filter((x) => x.id !== vid);
      persist();
      remap(true);
      if (pendingRemove) commitRemove(pendingRemove);
      showUndo('Merged column “' + title + '” removed', () => {
        settings.merges = (settings.merges || []).concat([r]);
        for (const n of Object.keys(saved)) settings[n] = Object.assign({}, settings[n], { [vid]: saved[n] });
        persist();
        remap(true);
        for (const cc of cols.values()) renderColumn(cc, false);
        goCol(vid);
      }, 6000);
    }

    // ---------- groups ----------
    // A group is a named set of this deck’s columns; while one is on, only
    // those columns show (the rest stay in X Pro and keep loading).
    // A group belongs to the deck it was made on; on another deck (or with
    // none of its columns here) every column shows.
    function activeGroup() {
      const g = settings.group && (settings.groups || []).find((x) => x.id === settings.group);
      if (!g) return null;
      const d = store.decks.activeDeck();
      if (g.deck && d && g.deck !== d.id) return null;
      if (layout.length && !g.vids.some((v) => layout.some((e) => e.vid === v))) return null;
      return g;
    }
    const deckGroups = () => {
      const d = store.decks.activeDeck();
      return (settings.groups || []).filter((g) => !g.deck || !d || g.deck === d.id);
    };
    function inGroup(vid) {
      const g = activeGroup();
      return !g || g.vids.includes(vid);
    }
    function setGroup(id) {
      settings.group = id || '';
      persist();
      for (const c of cols.values()) applyLook(c);
      renderTabs();
      const s = shown();
      if (!focusVid || !s.some((e) => e.vid === focusVid)) setFocus(s.length ? s[0].vid : null);
      const g = activeGroup();
      toast(g ? 'Group: ' + g.name : 'All columns', 'decks');
      reportState();
    }
    function saveGroups(groups) {
      settings.groups = groups;
      persist();
      for (const c of cols.values()) applyLook(c);
      renderTabs();
      reportState();
    }
    function joinGroup(vid) {
      const g = activeGroup();
      if (g && !g.vids.includes(vid)) saveGroups((settings.groups || []).map((x) => (x.id === g.id ? Object.assign({}, x, { vids: x.vids.concat([vid]) }) : x)));
    }
    function newGroup(vids) {
      askText('Name the new group', '', (name) => {
        const id = 'g:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const d = store.decks.activeDeck();
        saveGroups((settings.groups || []).concat([{ id, name, vids: vids.slice(), deck: d ? d.id : null }]));
        setGroup(id);
      });
    }
    function toggleInGroup(gid, vid) {
      const groups = (settings.groups || []).map((g) => (g.id !== gid ? g : Object.assign({}, g, { vids: g.vids.includes(vid) ? g.vids.filter((v) => v !== vid) : g.vids.concat([vid]) })));
      saveGroups(groups);
      if (!shown().some((e) => e.vid === focusVid)) setFocus(shown().length ? shown()[0].vid : null);
    }
    function groupByNumber(n) {
      const gs = deckGroups();
      if (n === 0) return setGroup('');
      if (gs[n - 1]) setGroup(gs[n - 1].id);
      else toast('No group ' + n, 'info');
    }

    // A small sheet that asks for a name.
    let askDone = null;
    function askText(title, value, onOk) {
      askBack.querySelector('.ask-t').textContent = title;
      const input = askBack.querySelector('.ask-in');
      input.value = value || '';
      askDone = onOk;
      askBack.hidden = false;
      input.focus();
      input.select();
    }
    function closeAsk() {
      askBack.hidden = true;
      askDone = null;
      app.focus({ preventScroll: true });
    }
    askBack.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = askBack.querySelector('.ask-in').value.trim();
      const fn = askDone;
      closeAsk();
      if (v && fn) fn(v);
    });

    // ---------- icon and color picker ----------
    // Changes show at once on the column; Cancel (or Esc) puts back what was
    // there when the picker opened.
    let ipState = null; // { vid, icon0, tint0 }
    function openIconPicker(c) {
      closePop();
      ipState = { vid: c.vid, icon0: (settings.colIcons || {})[c.vid] || '', tint0: (settings.colTints || {})[c.vid] || '' };
      ipBack.querySelector('.ip-q').value = '';
      ipBack.querySelector('.ip-colors').innerHTML =
        '<button type="button" role="radio" class="ipsw" data-ipt="" aria-label="No color" title="No color"><i class="none"></i></button>' +
        TINTS.map(([id, label, lc, dc]) => '<button type="button" role="radio" class="ipsw" data-ipt="' + id + '" aria-label="' + h(label) + '" title="' + h(label) + '" style="--cl:' + lc + ';--cd:' + dc + '"><i></i></button>').join('');
      drawPickerIcons();
      ipBack.hidden = false;
      ipBack.querySelector('.ip-q').focus({ preventScroll: true });
      const on = ipBack.querySelector('.ipi[aria-checked="true"]');
      if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function drawPickerIcons() {
      const c = ipState && cols.get(ipState.vid);
      if (!c) return closePicker(true);
      const s = store.get(c.key);
      const def = KIND_ICON[s ? s.kind : ''] || 'home';
      const words = ipBack.querySelector('.ip-q').value.toLowerCase().split(/\s+/).filter(Boolean);
      // Each typed word starts a word of the icon’s name or search words
      // (“bell” finds Notifications, not Fitness through “dumbbell”).
      const hit = (name, label, kw) => {
        const hay = (label + ' ' + kw + ' ' + name).toLowerCase().split(/\s+/);
        return words.every((w) => hay.some((x) => x.startsWith(w)));
      };
      const cell = (name, label, ic) => '<button type="button" role="radio" class="ipi" data-ipi="' + name + '" aria-label="' + h(label) + '" title="' + h(label) + '">' + icon(ic) + '</button>';
      let html = '';
      for (const [g, items] of COL_ICON_GROUPS) {
        const list = items.filter(([n, l, kw]) => hit(n, l, kw)).map(([n, l]) => cell(n, l, n));
        if (g === 'Columns' && hit('', 'Default', 'reset usual')) list.unshift(cell('', 'Default', def));
        if (list.length) html += '<div class="ip-lab">' + h(g) + '</div><div class="ip-grid">' + list.join('') + '</div>';
      }
      ipBack.querySelector('.ip-body').innerHTML = html || '<p class="ip-none">No icons match.</p>';
      paintPicker();
    }
    // Marks the choices and colors the icons, without redrawing them.
    function paintPicker() {
      const c = ipState && cols.get(ipState.vid);
      if (!c) return;
      const ic = (settings.colIcons || {})[c.vid] || '';
      const tint = (settings.colTints || {})[c.vid] || '';
      const t = TINTS.find((x) => x[0] === tint);
      const ip = ipBack.querySelector('.ip');
      if (t) {
        ip.dataset.tint = t[0];
        ip.style.setProperty('--cl', t[2]);
        ip.style.setProperty('--cd', t[3]);
      } else {
        delete ip.dataset.tint;
        ip.style.removeProperty('--cl');
        ip.style.removeProperty('--cd');
      }
      for (const b of ipBack.querySelectorAll('.ipi')) b.setAttribute('aria-checked', String(b.dataset.ipi === ic));
      for (const b of ipBack.querySelectorAll('.ipsw')) b.setAttribute('aria-checked', String(b.dataset.ipt === tint));
      const s = store.get(c.key);
      ipBack.querySelector('.ip-prev').innerHTML = '<i class="ip-pi">' + icon(ic || KIND_ICON[s ? s.kind : ''] || 'home') + '</i><b>' + h(titleOf(c.vid)) + '</b>';
    }
    function pickInPicker(b) {
      if (!ipState || !b) return;
      if (b.dataset.ipi != null) setOwn('colIcons', ipState.vid, b.dataset.ipi);
      else setOwn('colTints', ipState.vid, b.dataset.ipt);
      paintPicker();
    }
    function closePicker(keep) {
      if (!ipState) return;
      const { vid, icon0, tint0 } = ipState;
      ipState = null;
      ipBack.hidden = true;
      if (!keep && cols.get(vid)) {
        if (((settings.colIcons || {})[vid] || '') !== icon0) setOwn('colIcons', vid, icon0);
        if (((settings.colTints || {})[vid] || '') !== tint0) setOwn('colTints', vid, tint0);
      }
      app.focus({ preventScroll: true });
    }
    // Arrow keys: left and right in order, up and down to the nearest cell
    // in the row above or below; from the top row on to the colors, then
    // the search field.
    function pickerNext(from, key) {
      const q = ipBack.querySelector('.ip-q');
      const icons = Array.from(ipBack.querySelectorAll('.ipi'));
      const sws = Array.from(ipBack.querySelectorAll('.ipsw'));
      const swOn = ipBack.querySelector('.ipsw[aria-checked="true"]') || sws[0];
      const iconOn = ipBack.querySelector('.ipi[aria-checked="true"]') || icons[0];
      if (!from || from === q) return key === 'ArrowDown' ? swOn : null;
      const isSw = from.classList.contains('ipsw');
      const row = isSw ? sws : icons;
      const i = row.indexOf(from);
      if (key === 'ArrowLeft') return row[i - 1] || null;
      if (key === 'ArrowRight') return row[i + 1] || null;
      if (isSw) return key === 'ArrowUp' ? q : iconOn;
      const r = from.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      let best = null;
      let bdy = Infinity;
      let bdx = Infinity;
      for (const x of icons) {
        const xr = x.getBoundingClientRect();
        const dy = key === 'ArrowDown' ? xr.top - r.top : r.top - xr.top;
        if (dy < 4) continue;
        const dx = Math.abs(xr.left + xr.width / 2 - cx);
        if (dy < bdy - 4 || (Math.abs(dy - bdy) <= 4 && dx < bdx)) {
          bdy = dy;
          bdx = dx;
          best = x;
        }
      }
      return best || (key === 'ArrowUp' ? swOn : null);
    }
    function pickerKey(e, t) {
      const q = ipBack.querySelector('.ip-q');
      const inQ = t === q;
      const k = e.key;
      if (k === 'Escape') {
        if (inQ && q.value) {
          q.value = '';
          drawPickerIcons();
        } else closePicker(false);
        return true;
      }
      if (inQ) {
        if (k === 'ArrowDown') {
          const n = pickerNext(q, k);
          if (n) n.focus();
          return true;
        }
        if (k === 'Enter') {
          // Type a word and press Return: the first icon that matches.
          if (q.value.trim()) pickInPicker(ipBack.querySelector('.ipi:not([data-ipi=""])'));
          closePicker(true);
          return true;
        }
        return false;
      }
      const cell = t && t.closest ? t.closest('.ipi, .ipsw') : null;
      if (k === 'Enter') {
        if (cell) pickInPicker(cell);
        closePicker(true);
        return true;
      }
      if (k === ' ' && cell) {
        pickInPicker(cell);
        return true;
      }
      if (k.startsWith('Arrow')) {
        const n = pickerNext(cell, k);
        if (n) n.focus();
        return true;
      }
      // Typing anywhere in the picker searches.
      if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) q.focus();
      return false;
    }
    ipBack.querySelector('.ip-q').addEventListener('input', drawPickerIcons);
    ipBack.addEventListener('dblclick', (e) => {
      if (e.target.closest('.ipi')) closePicker(true);
    });

    // ---------- all decks ----------
    // Every deck from X Pro’s model, with its columns. Only the deck on
    // screen loads posts, so the others show names, not counts.
    function colLabel(col) {
      if (col.title) return col.title;
      const k = Sweeter.decks.keyFor(col, () => false, (h) => store.userId(h));
      if (!k) {
        const path = (col.pathname || '').split('?')[0];
        if (/^\/i\/bookmarks\//.test(path)) return 'Bookmarks';
        if (/^\/i\/communities\//.test(path)) return 'Community';
        const likes = /^\/([A-Za-z0-9_]{1,15})\/likes$/.exec(path);
        if (likes) return '@' + likes[1] + ' Likes';
        const m = /^\/([A-Za-z0-9_]{1,15})$/.exec(path);
        return m && !['i', 'home', 'explore', 'notifications', 'messages', 'search', 'settings', 'compose'].includes(m[1].toLowerCase()) ? '@' + m[1] : 'Column';
      }
      if (k === 'home') return 'Home';
      if (k === 'home-foryou') return 'For You';
      if (k === 'mentions') return 'Mentions';
      if (k.startsWith('notifications:')) return 'Notifications';
      if (k.startsWith('list:')) return store.listName(k.slice(5)) || 'List';
      if (k.startsWith('search:')) return k.split(':').slice(1, -1).join(':');
      if (k === 'bookmarks') return 'Bookmarks';
      if (k.startsWith('conv:')) return 'Conversation';
      if (k.startsWith('x:')) return PLACEHOLDERS[k.slice(2)] || 'X Pro column';
      const s = store.get(k);
      return s ? columnTitle(k, s) : 'Column';
    }
    function openOverview() {
      const { all, act } = decksNow();
      ovBack.querySelector('.ov-body').innerHTML = all.length
        ? all.map((d) => '<div class="ov-deck' + (act && act.id === d.id ? ' on' : '') + '"><button type="button" class="ov-dt" data-cmd="ov-deck" data-v="' + h(d.id) + '"><span class="ov-ic">' + h(d.icon || '★') + '</span><b>' + h(d.title || 'Untitled') + '</b>' + (act && act.id === d.id ? '<span class="ov-now">On screen</span>' : '') + (d.pinned ? '' : '<span class="ov-now">Unpinned</span>') + '</button>' +
            '<div class="ov-cols">' + (d.columns.length ? d.columns.filter((c) => !/^\/i\/columns\/picker/.test(c.pathname || '')).map((c) => '<button type="button" class="ov-col" data-cmd="ov-col" data-v="' + h(d.id) + '" data-c="' + h(c.id) + '">' + h(colLabel(c)) + '</button>').join('') : '<span class="ov-none">No columns</span>') + '</div></div>').join('')
        : '<p class="anote">X Pro hasn’t sent its decks yet.</p>';
      closePop();
      ovBack.hidden = false;
      const first = ovBack.querySelector('button.ov-dt');
      if (first) first.focus({ preventScroll: true });
    }
    function closeOverview() {
      ovBack.hidden = true;
      app.focus({ preventScroll: true });
    }
    async function overviewGo(deckId, colId) {
      closeOverview();
      const { all, act } = decksNow();
      const d = all.find((x) => x.id === deckId);
      if (!d) return;
      if (!act || act.id !== d.id) await switchDeckTo(d);
      if (!colId) return;
      // After a switch, wait for the column to arrive.
      const t0 = Date.now();
      const tick = () => {
        const vid = 'c:' + colId;
        if (cols.has(vid)) return goCol(vid, true);
        if (Date.now() - t0 < 8000) setTimeout(tick, 400);
      };
      tick();
    }

    // Columns on screen, in order, that the keyboard moves through.
    const shown = () => layout.filter((e) => !removing.has(e.vid) && modeOf(e.vid) !== 'hidden' && inGroup(e.vid));

    // A column X Pro shows as another account (a delegate): Sweeter shows it
    // but never acts from it, so nothing can go out as the wrong account.
    // null: the person’s own column. '': X Pro’s signed-in account isn’t
    // on the page yet, so Sweeter can’t tell. Otherwise the other account.
    function actingAs(key) {
      const m = key ? target(key).m : null;
      if (!m || !xpro.delegated(m)) return null;
      if (!xpro.viewerHandle()) return '';
      return (m.dom && m.dom.actingAs) || (m.col && m.col.creator) || 'another account';
    }
    function refuseDelegated(key) {
      const who = actingAs(key);
      if (who === null) return false;
      if (!who) toast('Sweeter can’t see which account X Pro is signed in as yet, so it did nothing.', 'warn');
      else toast('This column acts as ' + (who === 'another account' ? who : '@' + who) + ' in X Pro. Sweeter doesn’t act from it.', 'warn');
      return true;
    }

    // Mutes hide first; then the column’s filters and Find choose what to
    // show from what is left. Notifications take Find but no filters.
    function visibleBlocks(s, c) {
      const out = [];
      const filter = s.kind !== 'notifications';
      const pred = filter && c ? c.pred : null;
      const fp = c ? c.findPred : null;
      const hideSeen = c && settings.dedupe === 'hide' && filter ? (p) => seenElsewhere(p, c) : null;
      const keep = (p) => !(filter && match(p)) && (!pred || pred(p)) && (!fp || fp(p)) && !(hideSeen && hideSeen(p));
      // A clear is a time, not a sortIndex: X renumbers entries on every load.
      const cv = c ? (settings.colCleared || {})[c.vid] : null;
      const cleared = !cv ? 0 : String(cv).length >= 16 ? Sweeter.util.snowflakeMs(String(cv)) || 0 : Number(cv) || 0;
      const np = c && !filter ? c.notePred : null;
      const nm = !filter && settings.muteNotes ? noteMatch : null;
      for (const b of s.sorted) {
        // What “Unread only” asks about (the post’s block, in this column).
        if (c) c.unreadNow = !!s.readSort && compareSort(b.sortIndex, s.readSort) > 0;
        if (np && !np(b)) continue;
        if (nm && b.kind === 'notification' && nm(b.n)) continue;
        if (!filter && settings.muteNotes && b.kind === 'post' && match(b.post)) continue;
        if (cleared) {
          const t = store.timeOf(s.key, b);
          if (t != null && t <= cleared) continue;
        }
        if (b.kind === 'post') {
          if (!keep(b.post)) continue;
          out.push({ b, posts: null });
        } else if (b.kind === 'thread') {
          const ps = filter || fp ? b.posts.filter(keep) : b.posts;
          if (ps.length) out.push({ b, posts: ps });
        } else {
          if (c && c.findNote && b.kind === 'notification' && !c.findNote(b.n)) continue;
          out.push({ b, posts: null });
        }
      }
      return out;
    }

    // Autoplaying videos play only while at least half visible.
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              for (const en of entries) {
                const v = en.target;
                if (en.isIntersecting && en.intersectionRatio >= 0.5 && settings.visible && !passthrough) {
                  const pr = v.play();
                  if (pr && pr.catch) pr.catch(() => {});
                } else v.pause();
              }
            },
            { threshold: [0, 0.5] },
          )
        : null;

    function observeVideos(rootEl) {
      if (!io) return;
      for (const v of rootEl.querySelectorAll('.m[data-auto] video:not([data-obs])')) {
        v.dataset.obs = '1';
        io.observe(v);
      }
    }

    function dropNode(node) {
      if (io) for (const v of node.querySelectorAll('video[data-obs]')) io.unobserve(v);
      if (seenIO && node.__seenObs) {
        clearTimeout(node.__visT);
        seenIO.unobserve(node);
      }
    }

    function build(b, posts, ctx) {
      const t = document.createElement('template');
      t.innerHTML = R.block(b, ctx, posts || (b.kind === 'thread' ? b.posts : null));
      const node = t.content.firstElementChild;
      node.dataset.key = b.key;
      node.dataset.sort = b.sortIndex;
      node.__b = b;
      node.__n = posts ? posts.length : 0;
      return node;
    }

    function firstVisible(c) {
      const st = c.scroll.scrollTop;
      for (const node of c.list.children) {
        if (node === c.marker) continue;
        if (node.offsetTop + node.offsetHeight > st + 1) return node;
      }
      return null;
    }

    function renderColumn(c, dataChanged) {
      const s = store.get(c.key);
      if (!s) return;
      c.title.textContent = titleOf(c.vid);
      c.title.title = c.title.textContent;
      c.sub.textContent = c.merge ? 'Merged' : (s.kind === 'list' ? 'List' : s.kind === 'search' ? 'Search' : '') + (c.view ? (s.kind === 'list' || s.kind === 'search' ? ' view' : 'View') : '');
      const who = actingAs(c.vid);
      c.el.classList.toggle('delegated', !!who);
      if (who) c.sub.textContent = who === 'another account' ? 'as ' + who : 'as @' + who;
      c.el.dataset.kind = s.kind;
      if (c.predFor !== s.kind) {
        buildPreds(c);
        paintFilterUI(c);
      }
      c.el.dataset.media = colSettings(c).media;
      const grid = !!(settings.colGrid || {})[c.vid] && s.kind !== 'notifications' && s.kind !== 'placeholder';
      c.el.classList.toggle('grid', grid);
      if (grid) return renderGrid(c, s, dataChanged);
      if (c.wasGrid) {
        // Back from the grid: the list is drawn from nothing.
        c.wasGrid = false;
        c.list.textContent = '';
        c.nodes.clear();
        c.marker = null;
        c.full = true;
      }
      if (s.kind === 'placeholder') {
        c.list.textContent = '';
        c.nodes.clear();
        c.foot.innerHTML = 'Sweeter can’t show X’s ' + h(s.title) + ' yet. It stays in your X Pro deck.<br><button class="more" type="button" data-cmd="xpro">Show X Pro</button>';
        c.rendered = true;
        return;
      }
      const vis = visibleBlocks(s, c);

      const st = c.scroll.scrollTop;
      // Pinned: the column follows the newest post, a constant stream.
      // Pause on hover: a pinned column keeps still under the pointer (up to
      // three minutes); new posts wait above and the pill counts them.
      const paused = !!(c.hover && settings.pauseOnHover && c.pinned && Date.now() - c.hoverAt < 180000);
      c.paused = paused;
      // Collapsed or hidden: nothing is on screen to scroll or pin, so the
      // posts are drawn and the scroll state is left as it is.
      const frozen = !!modeOf(c.vid);
      const pinned = !frozen && !paused && (c.pinned || (settings.pinToTop && st <= PIN_SLOP));
      const anchor = pinned || frozen ? null : firstVisible(c);
      const delta = anchor ? anchor.offsetTop - st : 0;

      if (dataChanged || c.markerSort == null) c.markerSort = s.readSort;
      if (dataChanged) notifyNew(c, s);
      if (c.marker) c.marker.remove();
      // The post that was on top before this refresh; new posts land above it.
      const prevFirst = pinned && dataChanged && c.rendered ? firstNode(c) : null;

      const ctx = { settings: colSettings(c), now: Date.now(), viewer, expanded };
      const wanted = new Set();
      let prev = null;
      let boundary = null;
      c.visSorts = [];
      for (const { b, posts } of vis) {
        wanted.add(b.key);
        let node = c.nodes.get(b.key);
        if (!node || c.full || node.__b !== b || (posts && node.__n !== posts.length)) {
          const fresh = build(b, posts, ctx);
          if (node) {
            dropNode(node);
            node.replaceWith(fresh);
          }
          node = fresh;
          c.nodes.set(b.key, node);
        }
        const next = prev ? prev.nextSibling : c.list.firstChild;
        if (next !== node) c.list.insertBefore(node, next);
        prev = node;
        markSeen(node, b, c);
        if (seenIO && settings.dedupe !== 'off' && !node.__seenObs && b.kind !== 'notification') {
          node.__seenObs = true;
          seenIO.observe(node);
        }
        c.visSorts.push(b.sortIndex);
        if (!boundary && c.markerSort && compareSort(b.sortIndex, c.markerSort) <= 0) boundary = node;
      }
      for (const [k, node] of c.nodes) {
        if (!wanted.has(k)) {
          dropNode(node);
          node.remove();
          c.nodes.delete(k);
        }
      }
      c.full = false;

      if (!pinned && boundary && boundary !== c.list.firstChild) {
        if (!c.marker) {
          c.marker = document.createElement('div');
          c.marker.className = 'marker';
          c.marker.innerHTML = '<span>You were here</span>';
        }
        c.list.insertBefore(c.marker, boundary);
      }

      if (pinned) {
        c.pinned = true;
        c.scroll.scrollTop = 0;
        if (prevFirst && prevFirst.isConnected && prevFirst.offsetTop > 0) {
          for (let n = c.list.firstChild; n && n !== prevFirst; n = n.nextSibling) n.classList.add('enter');
          slideIn(c, prevFirst.offsetTop);
        }
      } else if (anchor && anchor.isConnected) {
        c.scroll.scrollTop = anchor.offsetTop - delta;
        c.progTop = c.scroll.scrollTop;
      }
      c.el.classList.toggle('pinned', !!c.pinned);
      c.el.classList.toggle('paused', paused && c.scroll.scrollTop > PIN_SLOP);
      c.rendered = true;

      const below = c.merge && mergeBelow.get(c.merge.id);
      const clearedAt = (settings.colCleared || {})[c.vid];
      const belowText = () => {
        const bs = store.get(below.by);
        return below.n + (below.n === 1 ? ' older post waits' : ' older posts wait') + ' until “' + (bs ? columnTitle(below.by, bs) : 'a column') + '” loads that far back. Scroll down to load more.';
      };
      if (vis.length && !clearedAt) c.foot.textContent = c.loadingUntil > Date.now() ? 'Loading older posts…' : below ? belowText() : '';
      else if (clearedAt) c.foot.innerHTML = (vis.length ? '' : 'Cleared. New posts show up here as they arrive.<br>') + '<button class="more" type="button" data-cmd="uncleared">Show Cleared Posts</button>';
      else if (s.sorted.length && c.findPred) c.foot.innerHTML = 'No loaded post has “' + h(c.find.trim()) + '”. Find searches only what this column has loaded.<br><button class="more" type="button" data-cmd="find-close">Clear Find</button>';
      else if (s.sorted.length && (c.pred || c.notePred)) c.foot.innerHTML = 'Nothing loaded matches “' + h(activeLabel(c)) + '”.<br><button class="more" type="button" data-cmd="flt-clear">Show everything</button>';
      else if (s.sorted.length) c.foot.innerHTML = 'Your mute filters hide every post here.<br><button class="more" type="button" data-cmd="edit-mutes">Edit mute filters</button>';
      else c.foot.innerHTML = 'No posts here yet. X Pro checks for new ones every 30 seconds.<br><button class="more" type="button" data-cmd="reload">Reload X Pro</button>';
      reselect(c);
      watchTickers(c.el);
      checkRead(c);
      updatePill(c);
      observeVideos(c.list);
      if (c.findPred) {
        c.fnum.hidden = false;
        c.fnum.textContent = String(c.list.querySelectorAll('.cell[data-id], .cell[data-note]').length);
        highlightFinds();
      }
    }

    // Media grid: every photo, video and GIF the column shows, as tiles.
    // A tile is the post’s cell (so j, k, o and the viewer work as usual).
    function renderGrid(c, s, dataChanged) {
      if (!c.wasGrid) {
        for (const node of c.nodes.values()) dropNode(node);
        c.nodes.clear();
        c.marker = null;
        c.wasGrid = true;
      }
      if (dataChanged) notifyNew(c, s);
      const st = c.scroll.scrollTop;
      const pinned = !modeOf(c.vid) && (c.pinned || (settings.pinToTop && st <= PIN_SLOP));
      let html = '';
      let n = 0;
      c.visSorts = [];
      for (const { b, posts } of visibleBlocks(s, c)) {
        const ps = b.kind === 'post' ? [b.post] : b.kind === 'thread' ? posts || b.posts : [];
        for (const p of ps) {
          if (!p || p.unavailable) continue;
          const own = (p.media || []).map((m, i) => [p, m, i]);
          for (const [host, m, i] of own) {
            const vid = m.type !== 'photo';
            const attr = vid ? ' data-video="' + h(safeUrl(m.videoUrl || '')) + '" data-i="' + i + '"' : ' data-photo="' + h(sized(m.url, 'orig')) + '" data-i="' + i + '"';
            html += '<div class="cell gt" data-id="' + h(host.id) + '" data-sort="' + h(b.sortIndex) + '" data-url="' + h(safeUrl(host.url)) + '" title="' + h(host.author.name + ': ' + (host.plain || '').slice(0, 140)) + '">' +
              '<div class="gph' + (vid ? ' gv' : '') + '"' + attr + '><img src="' + h(sized(m.url, 'small')) + '" alt="' + h(m.alt || '') + '" loading="lazy" decoding="async">' + (vid ? icon('play') : '') + '</div></div>';
            n++;
          }
        }
        c.visSorts.push(b.sortIndex);
      }
      c.list.innerHTML = html;
      c.foot.textContent = n ? '' : 'No media here yet.';
      if (pinned) {
        c.pinned = true;
        c.scroll.scrollTop = 0;
      } else c.scroll.scrollTop = st;
      c.el.classList.toggle('pinned', !!c.pinned);
      c.rendered = true;
      reselect(c);
      watchTickers(c.el);
      updatePill(c);
    }

    function firstNode(c) {
      for (const n of c.list.children) if (n !== c.marker) return n;
      return null;
    }

    // New posts push the old ones down: the list starts shifted up by the
    // height of what arrived and glides back to rest. Transform only, so the
    // scroll position and every measurement stay untouched.
    function slideIn(c, height) {
      if (reduceMotion.matches) return;
      const list = c.list;
      const dist = Math.min(height, c.scroll.clientHeight);
      const dur = Math.round(Math.min(700, 300 + dist * 0.6));
      clearTimeout(c.slideTimer);
      list.style.willChange = 'transform';
      list.style.transition = 'none';
      list.style.transform = 'translateY(' + -dist + 'px)';
      void list.offsetHeight; // commit the start position before animating
      list.style.transition = 'transform ' + dur + 'ms cubic-bezier(.2,.85,.25,1)';
      list.style.transform = 'translateY(0)';
      c.el.dataset.slide = dist + '/' + dur;
      c.slideTimer = setTimeout(() => {
        list.style.transition = '';
        list.style.transform = '';
        list.style.willChange = '';
        // Moving a node later would replay its fade; drop the class once it has run.
        for (const n of list.querySelectorAll('.enter')) n.classList.remove('enter');
      }, dur + 60);
    }

    function unreadCount(c) {
      const s = store.get(c.key);
      if (!s || !s.readSort) return 0;
      let n = 0;
      for (const si of c.visSorts) {
        if (compareSort(si, s.readSort) > 0) n++;
        else break;
      }
      return n;
    }

    // Native app: what the menus need (theme checkmark, column names).
    function reportState() {
      if (!native || !native.state) return;
      const fc = focusCol();
      const on = fc ? filterIds(fc) : [];
      native.state({
        skin: settings.skin,
        accent: settings.accent,
        filters: (fc ? filterList(fc) : XF.all(custom)).map((f) => ({ title: f.name, on: on.includes(f.id) })),
        filtersEnabled: !!fc,
        fontSize: settings.fontSize,
        fit: settings.fit,
        snap: !!settings.snap,
        groups: [{ title: 'All Columns', active: !activeGroup() }].concat(deckGroups().map((g) => ({ title: g.name, active: !!activeGroup() && activeGroup().id === g.id }))),
        decks: store.decks.decks().map((d) => ({ title: (d.icon ? d.icon + '  ' : '') + (d.title || 'Untitled'), active: !!store.decks.activeDeck() && store.decks.activeDeck().id === d.id })),
        alertsMuted: !!settings.alertsMuted,
        columns: shown().map((e) => titleOf(e.vid)), // Go ▸ ⌘1 to ⌘9, in the order the keys count
      });
    }

    // Native app: Dock badge and menu bar count, throttled.
    let countsTimer = 0;
    function reportCounts() {
      if (countsTimer) return;
      countsTimer = setTimeout(() => {
        countsTimer = 0;
        let notes = 0;
        let posts = 0;
        const perCol = [];
        for (const e of shown()) {
          const c = cols.get(e.vid);
          const s = c && store.get(c.key);
          if (!s) continue;
          const n = unreadCount(c);
          perCol.push({ title: titleOf(c.vid), n });
          if (c.view || c.merge) continue;
          if (s.kind === 'notifications') notes += n;
          else posts += n;
        }
        if (native) native.counts({ notifications: notes, posts, columns: perCol });
      }, 800);
    }

    // Native app: a system notification for each new notification-column
    // item (at most three per refresh; nothing on the first load).
    function notifyNew(c, s) {
      if (!native) return;
      const newest = s.sorted.length ? s.sorted[0].sortIndex : null;
      if (c.notifiedSort == null) {
        c.notifiedSort = newest;
        return;
      }
      const mode = alertOf(c);
      const since = c.notifiedSort;
      if (newest) c.notifiedSort = newest;
      if (mode === 'off' || settings.alertsMuted) return;
      // What this column shows (its filters and mutes apply), at most three.
      const fresh = visibleBlocks(s, c)
        .map((x) => x.b)
        .filter((b) => compareSort(b.sortIndex, since) > 0)
        .slice(0, 3);
      const base = { subtitle: titleOf(c.vid), thread: c.vid, sound: mode === 'sound' };
      const at = (b) => Object.assign({ key: b.key }, base);
      for (const b of fresh) {
        if (b.kind === 'notification') native.notify(Object.assign({ title: b.n.plain, body: b.n.target ? b.n.target.plain : '', url: b.n.target ? b.n.target.url : b.n.url }, at(b)));
        else if (b.kind === 'post') native.notify(Object.assign({ title: b.post.author.name + ' (@' + b.post.author.handle + ')', body: b.post.plain, url: b.post.url }, at(b)));
        else if (b.kind === 'thread' && b.posts[0]) native.notify(Object.assign({ title: b.posts[0].author.name + ' (@' + b.posts[0].author.handle + ')', body: b.posts[0].plain, url: b.posts[0].url }, at(b)));
      }
    }

    function updatePill(c) {
      reportCounts();
      const n = unreadCount(c);
      c.pill.hidden = n === 0;
      c.pill.textContent = n > 999 ? '1K+' : String(n);
      // A small bump when more unread posts arrive below the fold.
      if (n > (c.lastUnread || 0) && !reduceMotion.matches) {
        c.pill.classList.remove('bump');
        void c.pill.offsetWidth;
        c.pill.classList.add('bump');
      }
      c.lastUnread = n;
      c.el.dataset.unread = n > 999 ? '1K+' : n ? String(n) : '';
      const tab = tabsEl.querySelector('[data-vid="' + CSS.escape(c.vid) + '"]');
      if (tab) {
        const dot = tab.querySelector('.dot');
        if (dot) dot.hidden = n === 0;
      }
    }

    function checkRead(c) {
      // A filtered or searched view skips posts, so it never moves the
      // reading position: posts it hides are still unread afterward.
      if (!settings.visible || booting || c.pred || c.notePred || c.findPred || modeOf(c.vid)) return;
      const node = firstVisible(c);
      if (node && node.dataset.sort && store.markRead(c.key, node.dataset.sort)) updatePill(c);
    }

    // ---------- seen in another column (cross-column dedupe) ----------
    // A post counts as seen in a column once it has been on screen there for
    // a second (not when a read line passes it: a column pinned to the top
    // passes everything it loads). A copy is dimmed only when another column
    // showed it clearly earlier, so two copies on screen together never dim
    // each other. Ids only, kept for this session.
    const seen = new Map(); // post id -> Map(source key -> first time on screen)
    const SEEN_GAP = 3000;
    const seenIO = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          for (const en of entries) {
            const node = en.target;
            clearTimeout(node.__visT);
            // Mostly on screen: 60% of the post, or 240 px of a tall one.
            if (!en.isIntersecting || en.intersectionRect.height < Math.min(en.boundingClientRect.height * 0.6, 240)) continue;
            node.__visT = setTimeout(() => {
              const colEl = node.isConnected && node.closest('.col');
              const c = colEl && cols.get(colEl.dataset.vid);
              if (!c || !node.__b || !settings.visible || document.hidden || modeOf(c.vid)) return;
              noteOnScreen(node.__b, c);
              seenIO.unobserve(node);
            }, 1000);
          }
        }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] })
      : null;
    function noteOnScreen(b, c) {
      let added = false;
      for (const p of b.kind === 'post' ? [b.post] : b.kind === 'thread' ? b.posts : []) {
        if (!p) continue;
        let m = seen.get(p.id);
        if (!m) seen.set(p.id, (m = new Map()));
        if (!m.has(c.key)) {
          m.set(c.key, Date.now());
          added = true;
        }
      }
      while (seen.size > 5000) seen.delete(seen.keys().next().value);
      if (added) paintSeenSoon();
    }
    function seenElsewhere(p, c) {
      const m = p && seen.get(p.id);
      if (!m) return false;
      const mine = m.get(c.key);
      for (const [k, t] of m) if (k !== c.key && (mine == null || t < mine - SEEN_GAP)) return true;
      return false;
    }
    function markSeen(node, b, c) {
      const on = settings.dedupe === 'dim' && b.kind !== 'notification' && (b.kind === 'post' ? seenElsewhere(b.post, c) : b.kind === 'thread' && b.posts.every((p) => seenElsewhere(p, c)));
      node.classList.toggle('seen', on);
    }
    let seenTimer = 0;
    function paintSeenSoon() {
      if (seenTimer) return;
      seenTimer = setTimeout(() => {
        seenTimer = 0;
        for (const c of cols.values()) {
          if (settings.dedupe === 'hide') renderColumn(c, false);
          else for (const node of c.nodes.values()) if (node.__b) markSeen(node, node.__b, c);
        }
      }, 400);
    }

    function onScroll(c) {
      if (c.ticking) return;
      c.ticking = true;
      requestAnimationFrame(() => {
        c.ticking = false;
        // Scrolling away from the top unpins; scrolling back re-pins when the
        // “Pin timeline to top when at top” setting is on (Tweetbot’s default).
        const top = c.scroll.scrollTop <= PIN_SLOP;
        const was = c.pinned;
        const prog = c.paused && c.progTop != null && Math.abs(c.scroll.scrollTop - c.progTop) < 2;
        if (!prog) c.pinned = top && (c.pinned || settings.pinToTop);
        if (was !== c.pinned) c.el.classList.toggle('pinned', !!c.pinned);
        checkRead(c);
        const sc = c.scroll;
        if (sc.scrollTop + sc.clientHeight > sc.scrollHeight - 900 && Date.now() - c.lastOlder > 5000) {
          let m = mapOf(c);
          if (c.merge) {
            // The source whose oldest post is newest holds the rest back.
            let best = null;
            for (const k of c.merge.srcs.filter((x) => mappingFor(x))) {
              const s = store.get(k);
              let oldest = null;
              for (const b of s ? s.sorted : []) {
                const id = idOf(b);
                if (id && (!oldest || compareSort(id, oldest) < 0)) oldest = id;
              }
              if (oldest && (!best || compareSort(oldest, best.oldest) > 0)) best = { k, oldest };
            }
            m = best ? mappingFor(best.k) : null;
          }
          if (xpro.loadOlder(m)) {
            c.lastOlder = Date.now();
            c.loadingUntil = Date.now() + 4000;
            c.foot.textContent = 'Loading older posts…';
            setTimeout(() => {
              if (c.loadingUntil <= Date.now() && c.foot.textContent === 'Loading older posts…') c.foot.textContent = '';
            }, 4100);
          }
        }
      });
    }

    function renderTabs() {
      let n = 0;
      tabsEl.innerHTML = layout
        .filter((e) => !removing.has(e.vid) && inGroup(e.vid))
        .map((e) => {
          const s = store.get(e.key);
          if (!s) return '';
          const hid = modeOf(e.vid) === 'hidden';
          const i = hid ? -1 : n++;
          const label = titleOf(e.vid) + (hid ? ' (hidden: click to show)' : i < 9 ? ' (' + (i + 1) + ')' : '');
          const tint = TINTS.find((t) => t[0] === (settings.colTints || {})[e.vid]);
          return '<button class="tab' + (e.vid === focusVid ? ' on' : '') + (hid ? ' off' : '') + (e.view ? ' isview' : '') + (e.merge ? ' ismerge' : '') + '" type="button" data-cmd="col" data-vid="' + h(e.vid) + '" data-key="' + h(e.key) + '"' +
            (tint ? ' data-tint style="--cl:' + tint[2] + ';--cd:' + tint[3] + '"' : '') + ' title="' + h(label) + '" aria-label="' + h(label) + '">' +
            icon((settings.colIcons || {})[e.vid] || KIND_ICON[s.kind] || 'home') + '<i class="dot" hidden></i></button>';
        })
        .join('');
      for (const c of cols.values()) updatePill(c);
    }

    function remap(force) {
      // While a conversation is open, X Pro’s column shows the stack, not the
      // timeline, so matching by post IDs would go wrong: keep the mapping.
      if (holds.size || (!force && Array.from(cols.values()).some((c) => c.detail))) return false;
      const next = xpro.order(store);
      for (const m of next) {
        m.vid = vidOf(m);
        // A column X Pro’s model names exists before its first posts do (a
        // conversation’s and a placeholder’s data come another way, or never).
        if (m.bound && !store.get(m.key)) {
          const d = declared(m.key);
          if (d) store.declare(d);
        }
      }
      // The deck is known and holds nothing Sweeter can show.
      nocolsEl.hidden = next.length > 0 || !store.decks.ready();
      for (const m of next) {
        const old = m.id && m.colId && m.colId !== m.id ? 'c:' + m.id : null;
        if (old && cols.has(old) && !cols.has(m.vid)) moveVid(old, m.vid);
      }
      const lay = buildLayout(next);
      const sig = lay.map((e) => e.vid + '=' + e.key).join('|');
      if (!force && sig === mapSig) {
        mapping = next;
        layout = lay;
        return false;
      }
      mapping = next;
      layout = lay;
      mapSig = sig;

      let prev = null;
      const redraw = [];
      for (const e of layout) {
        let c = cols.get(e.vid);
        if (!c) {
          // Drawn now: its source may already hold posts and not change
          // again soon (X Pro serves a column it remounts from its cache).
          c = makeCol(e);
          cols.set(e.vid, c);
          redraw.push(c);
        } else if (c.key !== e.key) {
          // The same X Pro column now shows another source (its route
          // changed in X Pro): start it over.
          if (c.detail) dropDetail(c);
          c.key = e.key;
          c.el.dataset.key = e.key;
          for (const node of c.nodes.values()) dropNode(node);
          c.nodes.clear();
          c.list.textContent = '';
          c.marker = null;
          c.markerSort = null;
          c.notifiedSort = null;
          c.lastUnread = 0;
          c.selId = null;
          c.full = true;
          if ((settings.colCleared || {})[c.vid]) {
            const nc = Object.assign({}, settings.colCleared);
            delete nc[c.vid];
            settings.colCleared = nc;
            persist();
          }
          redraw.push(c);
        }
        const next2 = prev ? prev.nextSibling : colsEl.firstChild;
        if (next2 !== c.el) colsEl.insertBefore(c.el, next2);
        prev = c.el;
        applyWidth(c);
        applyLook(c);
      }
      for (const [k, c] of cols) {
        if (!layout.some((e) => e.vid === k)) {
          c.el.remove();
          cols.delete(k);
          redrawPopFor(k);
        }
      }
      for (const e of layout) {
        if (!e.merge) continue;
        const c = cols.get(e.vid);
        if (c) c.merge = e.merge;
        feedMerge(e.merge);
      }
      for (const c of redraw) renderColumn(c, false);
      if (!focusVid || !cols.has(focusVid)) setFocus(shown().length ? shown()[0].vid : null);
      renderTabs();
      reportState();
      paintMe();
      return true;
    }

    // ---------- loading screen ----------
    // Columns stay hidden until every X Pro column has data (or 10 s pass),
    // then arrive one after another.
    function checkBoot() {
      if (!booting) return;
      const total = xpro.domColumns().filter((d) => !d.picker).length;
      const loaded = mapping.filter((m) => m.dom && store.get(m.key) && (store.get(m.key).sorted.length || store.get(m.key).kind === 'placeholder')).length;
      const s = bootEl.querySelector('.boot-s');
      if (total) s.textContent = loaded + ' of ' + total + ' columns';
      const waited = Date.now() - bootStart;
      if ((total && loaded >= total) || (mapping.length && waited > 10000) || (!nocolsEl.hidden && waited > 1500)) finishBoot();
    }

    function finishBoot() {
      booting = false;
      setTimeout(checkNewAlerts, 1500);
      colsEl.classList.remove('hold');
      let i = 0;
      for (const el of colsEl.children) {
        if (el === nocolsEl) continue;
        el.style.setProperty('--d', i++ * 70 + 'ms');
        el.classList.add('arrive');
      }
      bootEl.classList.add('done');
      setTimeout(() => bootEl.remove(), 600);
      for (const c of cols.values()) checkRead(c);
    }

    // ---------- scheduling ----------

    const dirty = new Set();
    let frame = 0;
    function schedule(key) {
      if (key) dirty.add(key);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        remap(false);
        for (const e of layout) if (e.merge && e.merge.srcs.some((k) => dirty.has(k))) feedMerge(e.merge);
        for (const c of cols.values()) if (dirty.has(c.key)) renderColumn(c, true);

        dirty.clear();
        checkBoot();
      });
    }

    function rebuildAll() {
      for (const c of cols.values()) {
        c.full = true;
        renderColumn(c, false);
      }
      for (const rec of popouts.values()) drawPop(rec);
    }

    store.subscribe((key) => {
      if (key && popouts.size) {
        // With the main window hidden its frames stop; merged columns are fed here then.
        if (document.hidden) for (const e of layout) if (e.merge && e.merge.srcs.includes(key)) feedMerge(e.merge);
        for (const rec of popouts.values()) if (rec.c.key === key) redrawPop(rec);
      }
      if (key && (key.startsWith('profile:') || key.startsWith('timeline:'))) {
        if (prof) renderProfile();
        return;
      }
      if (key && key.startsWith('detail:')) {
        for (const c of cols.values()) if (c.detail && 'detail:' + c.detail.id === key) renderDetail(c, false);
        return;
      }
      if (key === 'decks') {
        // X Pro’s deck model changed: remap, then refresh titles and tabs.
        host.dataset.decks = store.decks.synced() ? 'sync' : store.decks.ready() ? 'saved' : 'none';
        paintDeck();
        reportState();
        for (const c of cols.values()) applyLook(c);
        schedule(null);
        requestAnimationFrame(() => {
          for (const c of cols.values()) if (store.get(c.key)) c.title.textContent = titleOf(c.vid);
          renderTabs();
        });
      } else if (key) schedule(key);
      else {
        for (const c of cols.values()) if (store.get(c.key)) c.title.textContent = titleOf(c.vid);
        renderTabs();
      }
    });

    // ---------- selection and focus ----------

    function setFocus(vid) {
      const changed = focusVid !== vid;
      focusVid = vid;
      if (changed && native) setTimeout(reportState, 0);
      for (const c of cols.values()) c.el.classList.toggle('focus', c.vid === vid);
      for (const t of tabsEl.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.vid === vid);
    }

    function focusCol() {
      return cols.get(focusVid) || null;
    }

    function rootOf(c) {
      return c.detail && c.dlist ? c.dlist : c.list;
    }

    function cellsOf(c) {
      return Array.from(rootOf(c).querySelectorAll('.cell[data-id], .cell[data-note]'));
    }

    function selectCell(cell, scroll) {
      for (const s of shadow.querySelectorAll('.cell.sel')) s.classList.remove('sel');
      // One selection at a time. A column that loses it forgets it, or its
      // next redraw (every poll) would select the post again.
      for (const x of cols.values()) {
        x.selId = null;
        if (x.detail) x.detail.selId = null;
      }
      if (!cell) return;
      cell.classList.add('sel');
      const col = cell.closest('.col');
      if (col) {
        const c = cols.get(col.dataset.vid);
        if (c.detail && cell.closest('.dpane')) c.detail.selId = cell.dataset.id;
        else c.selId = cell.dataset.id || cell.dataset.note;
        setFocus(col.dataset.vid);
      }
      if (scroll) cell.scrollIntoView({ block: 'nearest' });
    }

    function reselect(c) {
      if (!c.selId) return;
      const cell = c.list.querySelector('.cell[data-id="' + CSS.escape(c.selId) + '"], .cell[data-note="' + CSS.escape(c.selId) + '"]');
      if (cell) cell.classList.add('sel');
    }

    function move(dir) {
      const c = focusCol();
      if (!c) return;
      const cells = cellsOf(c);
      if (!cells.length) return;
      const cur = rootOf(c).querySelector('.cell.sel');
      const i = cur ? cells.indexOf(cur) : -1;
      if (i < 0 && c.detail) {
        selectCell(rootOf(c).querySelector('.cell.focal') || cells[0], true);
        return;
      }
      if (i < 0) {
        // Nothing selected yet: start at the first post on screen.
        const fv = firstVisible(c);
        const start = fv ? cells.findIndex((x) => fv === x || fv.contains(x)) : 0;
        selectCell(cells[Math.max(0, start)], true);
        return;
      }
      selectCell(cells[Math.max(0, Math.min(cells.length - 1, i + dir))], true);
    }

    function moveCol(dir) {
      const list = shown();
      if (!list.length) return;
      const i = list.findIndex((e) => e.vid === focusVid);
      const next = list[i < 0 ? 0 : (i + dir + list.length) % list.length];
      goCol(next.vid);
    }

    function page(dir) {
      const c = focusCol();
      if (c) c.scroll.scrollBy({ top: dir * (c.scroll.clientHeight - 60) });
    }

    function toEdge(end) {
      const c = focusCol();
      if (!c) return;
      if (end) {
        c.pinned = false;
        c.scroll.scrollTop = c.scroll.scrollHeight;
      } else pinTop(c);
    }

    // o: Tweetbot’s “Open Link/Media”. Media opens in the viewer.
    function openSelected() {
      const c = focusCol();
      const cell = c && rootOf(c).querySelector('.cell.sel');
      if (!cell) return;
      const p = cell.dataset.id ? findPost(cell.dataset.id) : null;
      if (p && p.media.length) return openLightbox(p, 0);
      const a = cell.querySelector('.tx a.u, .card[href]');
      openUrl(a ? a.getAttribute('href') : cell.dataset.url);
    }

    // ---------- lightbox ----------

    let lb = null;
    const sized = (u, n) => {
      const x = safeUrl(u);
      return x === '#' ? x : x + (x.includes('?') ? '&' : '?') + 'name=' + n;
    };

    // index is the position in post.media (photos and videos together).
    function openLightbox(post, index) {
      const items = (post.media || []).filter((m) => m.type === 'photo' || (m.videoUrl && safeUrl(m.videoUrl) !== '#'));
      if (!items.length) return;
      closePop();
      for (const v of shadow.querySelectorAll('.m[data-auto] video')) v.pause();
      const at = items.indexOf((post.media || [])[index || 0]);
      lb = { post, items, i: at < 0 ? 0 : at };
      lbEl.hidden = false;
      showLightbox();
    }

    // Photos work like Preview: the whole image fits the window, a click
    // shows actual size at that spot, drag or scroll moves it, pinch or +/-
    // scales it, 0 fits it again. The layout uses the original’s size from
    // X’s data; the large copy shows at once and the original replaces it.
    const LB_PAD = { l: 64, r: 64, t: 44, b: 10 };
    function lbView() {
      const r = lbMedia.getBoundingClientRect();
      return { w: r.width, h: r.height, l: r.left, t: r.top };
    }
    function lbFit() {
      const v = lbView();
      return Math.min(1, (v.w - LB_PAD.l - LB_PAD.r) / lb.nw, (v.h - LB_PAD.t - LB_PAD.b) / lb.nh);
    }
    // Centered while it fits (inside the padding, then the whole view);
    // edge to edge once it is larger than the view.
    function lbPlace(size, view, a, b, pos) {
      const box = view - a - b;
      if (size <= box) return a + (box - size) / 2;
      if (size <= view) return (view - size) / 2;
      return Math.min(0, Math.max(view - size, pos));
    }
    function lbApply(animate) {
      const img = lbMedia.querySelector('.lb-img');
      if (!img || !lb || !lb.nw) return;
      const v = lbView();
      lb.x = lbPlace(lb.nw * lb.s, v.w, LB_PAD.l, LB_PAD.r, lb.x);
      lb.y = lbPlace(lb.nh * lb.s, v.h, LB_PAD.t, LB_PAD.b, lb.y);
      img.style.width = lb.nw + 'px';
      img.style.height = lb.nh + 'px';
      img.style.transition = animate && !reduceMotion.matches ? 'transform .24s cubic-bezier(.2,.85,.25,1)' : 'none';
      img.style.transform = 'translate(' + lb.x + 'px,' + lb.y + 'px) scale(' + lb.s + ')';
      const fit = lbFit();
      lbEl.classList.toggle('zoomable', fit < 0.999);
      lbEl.classList.toggle('zoomed', lb.s > fit + 0.001);
    }
    function lbFitNow(animate) {
      if (!lb || !lb.nw) return;
      lb.s = lbFit();
      lbApply(animate);
    }
    // Scale about a point on screen, which stays under the pointer.
    function lbZoomAt(s, px, py, animate) {
      if (!lb || !lb.nw) return;
      const v = lbView();
      const ns = Math.max(lbFit(), Math.min(4, s));
      const cx = px - v.l;
      const cy = py - v.t;
      lb.x = cx - (cx - lb.x) * (ns / lb.s);
      lb.y = cy - (cy - lb.y) * (ns / lb.s);
      lb.s = ns;
      lbApply(animate);
    }
    function lbZoomBy(f) {
      const v = lbView();
      lbZoomAt(lb.s * f, v.l + v.w / 2, v.t + v.h / 2, true);
    }
    function lbToggle(e) {
      if (!lb || !lb.nw) return;
      const fit = lbFit();
      if (lb.s > fit + 0.001) lbFitNow(true);
      else if (fit < 0.999) lbZoomAt(1, e.clientX, e.clientY, true);
    }

    lbMedia.addEventListener('pointerdown', (e) => {
      if (!lb || !e.target.classList.contains('lb-img') || !lbEl.classList.contains('zoomed')) return;
      e.preventDefault();
      e.target.setPointerCapture(e.pointerId);
      lb.drag = { x: e.clientX, y: e.clientY, ox: lb.x, oy: lb.y, moved: false };
      lbEl.classList.add('dragging');
    });
    lbMedia.addEventListener('pointermove', (e) => {
      const d = lb && lb.drag;
      if (!d) return;
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
      lb.x = d.ox + e.clientX - d.x;
      lb.y = d.oy + e.clientY - d.y;
      lbApply(false);
    });
    const lbDragEnd = () => {
      if (!lb || !lb.drag) return;
      lb.dragged = lb.drag.moved;
      lb.drag = null;
      lbEl.classList.remove('dragging');
    };
    lbMedia.addEventListener('pointerup', lbDragEnd);
    lbMedia.addEventListener('pointercancel', lbDragEnd);
    // Trackpad: two fingers move a zoomed photo; a pinch (⌃-wheel) scales.
    lbMedia.addEventListener('wheel', (e) => {
      if (!lb || !lb.nw || !lbMedia.querySelector('.lb-img')) return;
      if (e.ctrlKey) {
        e.preventDefault();
        lbZoomAt(lb.s * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY, false);
      } else if (lbEl.classList.contains('zoomed')) {
        e.preventDefault();
        lb.x -= e.deltaX;
        lb.y -= e.deltaY;
        lbApply(false);
      }
    }, { passive: false });
    // Safari reports a trackpad pinch as gesture events.
    lbMedia.addEventListener('gesturestart', (e) => {
      if (!lb || !lb.nw) return;
      e.preventDefault();
      lb.g = lb.s;
    });
    lbMedia.addEventListener('gesturechange', (e) => {
      if (!lb || !lb.nw || lb.g == null) return;
      e.preventDefault();
      lbZoomAt(lb.g * e.scale, e.clientX, e.clientY, false);
    });
    lbMedia.addEventListener('gestureend', (e) => {
      if (lb) lb.g = null;
      e.preventDefault();
    });
    window.addEventListener('resize', () => {
      if (!lb || !lb.nw) return;
      if (lbEl.classList.contains('zoomed')) lbApply(false);
      else lbFitNow(false);
    });

    function showLightbox() {
      const m = lb.items[lb.i];
      lbEl.classList.remove('zoomed', 'zoomable', 'dragging');
      lb.s = 1;
      lb.x = 0;
      lb.y = 0;
      lb.nw = m.w || 0;
      lb.nh = m.h || 0;
      lbMedia.classList.toggle('video', m.type !== 'photo');
      if (m.type === 'photo') {
        lbMedia.innerHTML = '<img class="lb-img" src="' + h(sized(m.url, 'large')) + '" alt="' + h(m.alt) + '" draggable="false">';
        const img = lbMedia.firstChild;
        // No size in X’s data: measure the copy once it arrives.
        if (!lb.nw) {
          img.addEventListener('load', () => {
            if (!lb || lb.items[lb.i] !== m) return;
            lb.nw = img.naturalWidth;
            lb.nh = img.naturalHeight;
            lbFitNow(false);
          }, { once: true });
        }
        const full = new Image();
        full.onload = () => {
          if (lb && lb.items[lb.i] === m && img.isConnected) img.src = full.src;
        };
        full.src = sized(m.url, 'orig');
      } else {
        const gif = m.type === 'gif';
        lbMedia.innerHTML = '<video src="' + h(safeUrl(m.videoUrl)) + '" poster="' + h(sized(m.url, 'small')) + '" playsinline autoplay' + (gif ? ' loop muted' : ' controls') + '></video>';
      }
      const many = lb.items.length > 1;
      shadow.querySelector('.lb-count').textContent = many ? lb.i + 1 + ' of ' + lb.items.length : '';
      shadow.querySelector('.lb-prev').hidden = !many;
      shadow.querySelector('.lb-next').hidden = !many;
      shadow.querySelector('.lb-orig').href = m.type === 'photo' ? sized(m.url, 'orig') : safeUrl(m.videoUrl);
      const p = lb.post;
      const text = p.plain.length > 280 ? p.plain.slice(0, 280) + '…' : p.plain;
      shadow.querySelector('.lb-cap').innerHTML =
        '<b>' + h(p.author.name) + '</b> @' + h(p.author.handle) + (text ? ' · ' + h(text) : '') +
        (m.alt ? '<span class="alt">ALT  ' + h(m.alt) + '</span>' : '') +
        (many ? '<div class="lb-dots">' + lb.items.map((_, i) => '<i class="' + (i === lb.i ? 'on' : '') + '"></i>').join('') + '</div>' : '');
      // Fit only now: the caption above sets how tall the stage is.
      if (m.type === 'photo') lbFitNow(false);
      // Warm the neighbors so arrowing through is instant.
      for (const d of [1, -1]) {
        const n = lb.items[(lb.i + d + lb.items.length) % lb.items.length];
        if (n && n.type === 'photo') new Image().src = sized(n.url, 'large');
      }
    }

    function stepLightbox(d) {
      if (!lb || lb.items.length < 2) return;
      lb.i = (lb.i + d + lb.items.length) % lb.items.length;
      showLightbox();
    }

    function closeLightbox() {
      lbEl.hidden = true;
      lbMedia.innerHTML = '';
      lb = null;
    }

    // ---------- conversations, pushed into the column ----------

    async function openDetail(c, post, parentId) {
      if (!c || !post || post.unavailable) return;
      closePop();
      // A view and its column share one X Pro column, and X Pro shows one
      // stack there: close a conversation another of them has open.
      const mine = mapOf(c);
      for (const o of cols.values()) if (o !== c && o.detail && mapOf(o) && mine && mapOf(o).id === mine.id) dropDetail(o);
      c.detail = { id: post.id, post, parentId: parentId || null, failed: false, scrolled: false, lastMore: 0 };
      ensurePane(c);
      renderDetail(c, true);
      const ask = () => xpro.openDetail({ id: post.id, handle: post.author.handle, parentId: parentId || null, mapping: mapOf(c), hint: hintFor(parentId || post.id, c.key) });
      let r = await ask();
      // X Pro may still be redrawing a column it just closed: try once more.
      if (!r.ok && c.detail && c.detail.id === post.id) {
        await new Promise((res) => setTimeout(res, 700));
        r = await ask();
      }
      if (c.detail && c.detail.id === post.id && !r.ok) {
        c.detail.failed = r.reason || 'unknown';
        if (native) native.log('conversation failed: ' + c.detail.failed + (parentId ? ' (quote)' : ''));
        renderDetail(c, false);
      }
    }

    function ensurePane(c) {
      if (c.dpane) return;
      const el = document.createElement('div');
      el.className = 'dpane';
      el.innerHTML =
        '<div class="dhead"><button class="dback" type="button" data-cmd="back" title="Back (←)">‹ ' + h(c.title.textContent || 'Back') + '</button><span class="dtitle">Post</span>' +
        '<button class="dcol" type="button" data-cmd="asColumn" title="Open this conversation as a column of its own, in X Pro on all your devices">Open as Column</button></div>' +
        '<div class="dscroll"><div class="dlist"></div><div class="dfoot"></div></div>';
      c.el.appendChild(el);
      c.dpane = el;
      c.dlist = el.querySelector('.dlist');
      c.dfoot = el.querySelector('.dfoot');
      c.dscroll = el.querySelector('.dscroll');
      c.dscroll.addEventListener('scroll', () => onDetailScroll(c), { passive: true });
      overlayBar(c.dscroll, el, '28px', c.dlist);
    }

    function renderDetail(c, first) {
      const d = c.detail;
      if (!d || !c.dpane) return;
      const data = store.detail(d.id);
      const ctx = { settings, now: Date.now(), viewer, expanded };
      const focalCtx = Object.assign({}, ctx, { focal: true });
      let html = '';
      let focalSeen = false;
      for (const b of data ? data.blocks : []) {
        if (b.kind === 'post' && b.post.id === d.id) {
          html += R.post(b.post, focalCtx);
          focalSeen = true;
        } else if (b.kind === 'post' && !focalSeen) {
          html += R.post(b.post, ctx, 'ancestor'); // what the post replies to
        } else html += R.block(b, ctx, b.kind === 'thread' ? b.posts : null);
      }
      if (!focalSeen) html = R.post(d.post, focalCtx) + html;
      const keep = c.dscroll.scrollTop;
      const sel = d.selId;
      c.dlist.innerHTML = html;
      watchTickers(c.dlist);
      c.dfoot.dataset.reason = d.failed || '';
      const dcol = c.dpane.querySelector('.dcol');
      if (dcol) dcol.disabled = !!d.failed;
      c.dfoot.innerHTML = d.failed
        ? 'X Pro couldn’t open this conversation. <a href="' + h(safeUrl(d.post.url)) + '" target="_blank" rel="noopener noreferrer">Open on x.com</a>'
        : !data
          ? 'Loading the conversation…'
          : data.blocks.length <= 1
            ? 'No replies yet.'
            : '';
      if (data && !d.scrolled) {
        // Land on the opened post, with what it replies to above.
        const f = c.dlist.querySelector('.cell.focal');
        c.dscroll.scrollTop = f ? Math.max(0, f.offsetTop - 6) : 0;
        d.scrolled = true;
      } else if (!first) c.dscroll.scrollTop = keep;
      if (sel) {
        const cell = c.dlist.querySelector('.cell[data-id="' + CSS.escape(sel) + '"]');
        if (cell) cell.classList.add('sel');
      }
      observeVideos(c.dlist);
    }

    function onDetailScroll(c) {
      const sc = c.dscroll;
      if (!c.detail || sc.scrollTop + sc.clientHeight < sc.scrollHeight - 700 || Date.now() - c.detail.lastMore < 4000) return;
      // More replies: scroll X Pro’s own stack so it loads the next page.
      if (xpro.loadOlder(mapOf(c))) c.detail.lastMore = Date.now();
    }

    // Sweeter’s pane only; X Pro’s stack is left for the caller.
    function dropDetail(c) {
      c.detail = null;
      if (c.dpane) {
        dropNode(c.dpane);
        c.dpane.remove();
        c.dpane = null;
      }
    }

    function closeDetail(c) {
      if (!c || !c.detail) return;
      c.detail = null;
      if (c.dpane) {
        dropNode(c.dpane);
        c.dpane.remove();
        c.dpane = null;
      }
      xpro.closeDetail(mapOf(c));
      setTimeout(() => {
        if (remap(true)) for (const cc of cols.values()) renderColumn(cc, false);
      }, 700);
    }

    function markAllRead(c) {
      if (!c) return;
      if (store.markAllRead(c.key)) {
        c.markerSort = store.get(c.key).readSort;
        renderColumn(c, false);
        toast('Marked as read');
      }
    }

    // A click on the column header: go to the newest post and stay there.
    function pinTop(c) {
      if (!c) return;
      c.pinned = true;
      c.scroll.scrollTop = 0;
      store.markAllRead(c.key);
      const s = store.get(c.key);
      c.markerSort = s ? s.readSort : null;
      renderColumn(c, false);
    }

    function jumpToMarker(c) {
      if (!c) return;
      if (c.marker && c.marker.isConnected) c.scroll.scrollTop = Math.max(0, c.marker.offsetTop - c.scroll.clientHeight + 80);
    }

    // ---------- filters and Find (from Ivory) ----------

    function filterIds(c) {
      const f = settings.colFilters || {};
      if (!c) return [];
      if (Object.prototype.hasOwnProperty.call(f, c.vid)) return f[c.vid] || [];
      return (!c.view && f[c.key]) || []; // before 0.15: by source, shared by every deck
    }

    // A notification column’s filters are notification types; a post
    // column’s are the post filters (Unread only asks the column).
    const filterList = (c) => (isNotes(c) ? XF.NOTE_QUICK || [] : XF.all(custom));
    function buildPreds(c) {
      const ids = filterIds(c);
      c.predFor = (store.get(c.key) || {}).kind || null;
      if (isNotes(c)) {
        c.pred = null;
        c.notePred = XF.buildNote ? XF.buildNote(ids) : null;
      } else {
        c.notePred = null;
        c.pred = XF.build(ids, custom, c.fctx || (c.fctx = { unread: () => !!c.unreadNow }));
      }
    }

    function activeLabel(c) {
      const ids = filterIds(c);
      return filterList(c)
        .filter((f) => ids.includes(f.id))
        .map(XF.label)
        .join(' · ');
    }

    // The header says what is on: a chip with the filter names, and the
    // funnel fills (Ivory’s cue that a timeline is filtered).
    function paintFilterUI(c) {
      const label = c.pred || c.notePred ? activeLabel(c) : '';
      c.chip.hidden = !label;
      c.chip.textContent = label;
      c.fbtn.classList.toggle('on', !!label);
      c.fbtn.innerHTML = icon(label ? 'filterOn' : 'filter');
      c.fbtn.title = label ? 'Filters on: ' + label + '. ⌥0 turns them off.' : 'Filter this column (⌥1 to ⌥9)';
      c.el.classList.toggle('filtered', !!label);
    }

    function isNotes(c) {
      const s = c && store.get(c.key);
      return !!s && s.kind === 'notifications';
    }

    function setFilters(c, ids) {
      if (!c) return;
      const next = Object.assign({}, settings.colFilters);
      // An empty list is kept while a pre-0.15 entry for the source exists,
      // so “none” here is not read as that older choice.
      if (ids.length || (!c.view && c.key !== c.vid && next[c.key])) next[c.vid] = ids;
      else delete next[c.vid];
      settings.colFilters = next;
      persist();
      buildPreds(c);
      paintFilterUI(c);
      redrawPopFor(c.vid);
      // A new view of the column starts at its top.
      c.pinned = settings.pinToTop;
      c.scroll.scrollTop = 0;
      renderColumn(c, false);
      reportState();
    }

    function toggleFilter(c, id, say) {
      if (!c) return;
      const ids = filterIds(c);
      const on = !ids.includes(id);
      setFilters(c, on ? ids.concat([id]) : ids.filter((x) => x !== id));
      const f = filterList(c).find((x) => x.id === id);
      if (say && f) toast('“' + f.name + '” ' + (on ? 'on' : 'off'));
    }

    // The nth filter in menu order; 0 turns every filter off.
    function filterByNumber(c, n, say) {
      if (!c) return;
      if (n === 0) {
        if (filterIds(c).length) {
          setFilters(c, []);
          if (say) toast('Filters off');
        }
        return;
      }
      const f = filterList(c)[n - 1];
      if (f) toggleFilter(c, f.id, say);
    }

    function placePop(anchor) {
      pop.hidden = false;
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth;
      const hgt = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
      const top = r.bottom + hgt + 8 > window.innerHeight ? r.top - hgt - 4 : r.bottom + 4;
      pop.style.top = Math.max(8, Math.min(window.innerHeight - hgt - 8, top)) + 'px';
      const first = pop.querySelector('button:not([disabled])');
      if (first) first.focus();
    }

    function showFilterMenu(c, anchor) {
      if (!c) return;
      closePop();
      const on = filterIds(c);
      const list = filterList(c);
      const notes = isNotes(c);
      if (native && native.menu) {
        const items = list.map((f, i) => ({ id: f.id, title: f.name, checked: on.includes(f.id), key: i < 9 ? String(i + 1) : '', mods: ['option'] }));
        items.push({ separator: true }, { id: 'clear', title: 'Clear Filters', enabled: on.length > 0, key: '0', mods: ['option'] }, notes ? null : { id: 'edit', title: 'Edit Filters…' });
        native.menu({ items: tidy(items) }).then((choice) => {
          if (choice === 'clear') setFilters(c, []);
          else if (choice === 'edit') openPrefsTab('filters');
          else if (choice) toggleFilter(c, choice);
        });
        return;
      }
      const item = (cmd, label, checked, key, attrs) =>
        '<button type="button" role="' + (checked == null ? 'menuitem' : 'menuitemcheckbox') + '"' + (checked == null ? '' : ' aria-checked="' + checked + '"') + ' data-cmd="' + cmd + '"' + (attrs || '') + '>' +
        '<span class="ck">' + (checked ? icon('check') : '') + '</span><span class="pl2">' + h(label) + '</span>' + (key ? '<kbd>' + key + '</kbd>' : '') + '</button>';
      pop.innerHTML =
        list.map((f, i) => item('flt-toggle', f.name, on.includes(f.id), i < 9 ? '⌥' + (i + 1) : '', ' data-fid="' + h(f.id) + '"')).join('') +
        '<div class="psep" role="separator"></div>' +
        item('flt-clear', 'Clear filters', null, '⌥0', on.length ? '' : ' disabled') +
        (notes ? '' : item('flt-prefs', 'Edit filters…', null, ''));
      pop.dataset.kind = 'filter';
      pop.dataset.vid = c.vid;
      placePop(anchor);
    }

    // Find (⌘F): only the posts this column has loaded, as in Ivory.
    function openFind(c, q) {
      if (!c) return;
      if (c.detail) closeDetail(c);
      setFocus(c.vid);
      c.el.classList.add('finding');
      c.findEl.hidden = false;
      if (q != null) {
        c.findEl.value = q;
        setFind(c, q, true);
      }
      c.findEl.focus({ preventScroll: true });
      c.findEl.select();
    }

    // Typing redraws after a short pause; a search set from a menu at once.
    function setFind(c, q, now) {
      c.find = q;
      c.findPred = XF.find(q);
      c.findNote = XF.findNote(q);
      c.findTerms = XF.terms(q);
      clearTimeout(c.findTimer);
      const draw = () => {
        c.pinned = settings.pinToTop;
        c.scroll.scrollTop = 0;
        renderColumn(c, false);
        if (!c.findPred) {
          c.fnum.hidden = true;
          highlightFinds();
        }
      };
      if (now) draw();
      else c.findTimer = setTimeout(draw, 60);
    }

    function closeFind(c) {
      if (!c || !c.el.classList.contains('finding')) return;
      clearTimeout(c.findTimer);
      c.findEl.value = '';
      c.findEl.hidden = true;
      c.fnum.hidden = true;
      c.el.classList.remove('finding');
      c.find = '';
      c.findPred = null;
      c.findNote = null;
      c.findTerms = null;
      renderColumn(c, false);
      highlightFinds();
      app.focus({ preventScroll: true });
    }

    // Matches glow in the text (the CSS Custom Highlight API, Safari 17.2
    // and later): no markup changes, so nothing redraws.
    function highlightFinds() {
      if (!(window.CSS && CSS.highlights && typeof Highlight === 'function')) return;
      try {
        const ranges = [];
        for (const c of cols.values()) {
          if (!c.findTerms || !c.findTerms.length) continue;
          for (const el of c.list.querySelectorAll('.tx, .nm, .hd, .atx, .snip')) {
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = walk.nextNode(); n && ranges.length < 500; n = walk.nextNode()) {
              const text = n.data.toLowerCase();
              for (const t of c.findTerms) {
                for (let i = text.indexOf(t); i >= 0 && ranges.length < 500; i = text.indexOf(t, i + t.length)) {
                  const r = new Range();
                  r.setStart(n, i);
                  r.setEnd(n, i + t.length);
                  ranges.push(r);
                }
              }
            }
          }
        }
        if (ranges.length) CSS.highlights.set('sweeter-find', new Highlight(...ranges));
        else CSS.highlights.delete('sweeter-find');
      } catch (e) {}
    }

    // ---------- profile sheet ----------
    // Clicking a person opens their profile over the columns, the size of
    // Preferences. X Pro opens the same profile underneath (as a stack in
    // the column), so the data comes from X Pro’s own responses and Follow,
    // Mute and the rest press X Pro’s own buttons.

    const PTABS = [
      ['posts', 'Posts', ['UserOriginalsTimeline', 'UserTweets']],
      ['replies', 'Replies', ['UserTweetsAndReplies']],
      ['media', 'Media', ['UserMedia']],
    ];
    let prof = null; // { handle, id, key, postId, tab, status, xpro, confirm, token }
    let profStack = null; // { handle, key, levels } while X Pro has profile stacks open for Sweeter
    let profToken = 0;

    // The best copy of the person Sweeter has: X Pro’s profile, or the
    // author record of any loaded post.
    function personOf(handle) {
      const pr = store.profile(handle);
      if (pr) return pr;
      const hl = handle.toLowerCase();
      let found = null;
      eachPost((p) => {
        if (!found && p && !p.unavailable && p.author.handle.toLowerCase() === hl) found = p.author;
      });
      return found;
    }

    function openProfile(handle, from) {
      if (!handle) return;
      closePop();
      const f = from || {};
      const u = personOf(handle);
      const token = ++profToken;
      prof = { handle, id: (u && u.id) || null, key: f.key || (profStack && profStack.key) || null, postId: f.postId || null, tab: 'posts', status: 'loading', xpro: !!profStack, confirm: null, token };
      store.watch(handle, prof.id);
      holds.add('profile');
      profBack.hidden = false;
      profScroll.scrollTop = 0;
      renderProfile();
      profScroll.focus({ preventScroll: true });
      xpro.openProfile({ handle, postId: prof.postId, mapping: mappingFor(prof.key), hint: prof.postId && prof.key ? hintFor(prof.postId, prof.key) : null }).then((r) => {
        if (r.ok && !r.already) {
          if (profStack) profStack.levels++;
          else profStack = { handle, key: prof ? prof.key : f.key || null, levels: 1 };
        }
        if (!prof || prof.token !== token) return;
        prof.xpro = r.ok;
        prof.status = r.ok ? 'ready' : 'failed';
        renderProfile();
        if (r.ok && prof.addAfter) {
          prof.addAfter = false;
          addProfileColumn();
        }
      });
    }

    // Add as Column: X Pro’s profile stack becomes a column next to the
    // one it opened in. Its posts then belong to that column, not the sheet.
    async function addProfileColumn() {
      const p0 = prof;
      if (!p0) return;
      if (!p0.xpro) {
        p0.addAfter = true;
        return toast('Opening the profile in X Pro first…', 'info');
      }
      if (colOp) return toast(XOP_FAIL.busy, 'warn');
      const pr = store.profile(p0.handle);
      const uid = p0.id || (pr && pr.id);
      // The new column’s first posts must reach the column, not the sheet.
      store.unwatch(p0.handle, uid, true);
      const r = await xproOp(() => xpro.profileToColumn(p0.handle), null);
      if (!r.ok) {
        store.watch(p0.handle, uid);
        return;
      }
      // X Pro closed that stack level itself (a profile X Pro already
      // showed was not one Sweeter opened, so it is not counted).
      if (profStack && --profStack.levels <= 0) profStack = null;
      if (prof === p0) closeProfile();
      toast('@' + p0.handle + ' is a column now');
    }

    // From a menu: open the person’s profile, then add it as a column.
    function addColumnFor(handle, from) {
      openProfile(handle, from);
      if (prof) prof.addAfter = true;
    }

    function closeProfile() {
      if (!prof) return;
      const p = prof;
      prof = null;
      profBack.hidden = true;
      const pr = store.profile(p.handle);
      store.unwatch(p.handle, p.id || (pr && pr.id));
      if (profStack) {
        const under = Array.from(cols.values()).find((x) => x.key === profStack.key && x.detail) || null;
        xpro.closeProfile(profStack.handle, mappingFor(profStack.key), !!(under && under.detail), profStack.levels);
        profStack = null;
      }
      setTimeout(() => {
        if (prof) return;
        holds.delete('profile');
        if (remap(true)) for (const cc of cols.values()) renderColumn(cc, false);
      }, 900);
      app.focus({ preventScroll: true });
    }

    function fmtCount(n) {
      return n == null ? '–' : Number(n).toLocaleString();
    }

    function profileHead(u, p) {
      const me = viewer && viewer.handle && viewer.handle.toLowerCase() === p.handle.toLowerCase();
      const big = u.avatar ? safeUrl(String(u.avatar).replace(/_(normal|bigger|mini|x96|200x200)\./, '_400x400.')) : '';
      let follow = '';
      if (me) follow = '';
      else if (!p.xpro) follow = '<button class="pf-btn" type="button" disabled title="Follow works once X Pro has opened this profile.">Follow</button>';
      else if (u.blocking) follow = '<button class="pf-btn danger" type="button" data-cmd="prof-ask" data-v="unblock">Blocked</button>';
      else if (u.requested) follow = '<button class="pf-btn" type="button" disabled>Requested</button>';
      else if (u.following) follow = '<button class="pf-btn on" type="button" data-cmd="prof-ask" data-v="unfollow"><span class="a">Following</span><span class="b">Unfollow</span></button>';
      else follow = '<button class="pf-btn solid" type="button" data-cmd="prof-follow">Follow</button>';
      const meta = [];
      if (u.location) meta.push('<span>' + icon('pin') + h(u.location) + '</span>');
      if (u.website) meta.push('<a href="' + h(safeUrl(u.website)) + '" target="_blank" rel="noopener noreferrer">' + icon('link') + h(u.websiteLabel || u.website) + '</a>');
      if (u.joinedMs) meta.push('<span>' + icon('calendar') + 'Joined ' + h(new Date(u.joinedMs).toLocaleDateString([], { month: 'long', year: 'numeric' })) + '</span>');
      const counts = u.followers != null || u.followingCount != null
        ? '<div class="pf-counts"><span><b>' + fmtCount(u.followingCount) + '</b> Following</span><span><b>' + fmtCount(u.followers) + '</b> Followers</span>' + (u.posts != null ? '<span><b>' + fmtCount(u.posts) + '</b> Posts</span>' : '') + '</div>'
        : '';
      let note = '';
      if (p.status === 'loading' && !store.profile(p.handle)) note = '<div class="pf-note">Opening the profile in X Pro…</div>';
      else if (p.status === 'failed') note = '<div class="pf-note">X Pro couldn’t open this profile from here, so Follow and posts aren’t available. <button class="lnk" type="button" data-cmd="prof-web">Open on X</button></div>';
      let confirm = '';
      if (p.confirm) {
        const q = {
          unfollow: ['Unfollow @' + p.handle + '?', 'Their posts will no longer show in your Home timeline.', 'Unfollow'],
          block: ['Block @' + p.handle + '?', 'They can’t follow you or see your posts, and you won’t see their posts.', 'Block'],
          unblock: ['Unblock @' + p.handle + '?', 'They can follow you and see your posts again.', 'Unblock'],
          remove: ['Remove @' + p.handle + ' as a follower?', 'They won’t be told. They can follow you again.', 'Remove'],
        }[p.confirm.kind];
        confirm = '<div class="pf-confirm" role="alertdialog" aria-label="' + h(q[0]) + '"><div><b>' + h(q[0]) + '</b><span>' + h(q[1]) + '</span></div>' +
          '<button type="button" data-cmd="prof-cancel">Cancel</button><button class="danger" type="button" data-cmd="prof-do">' + h(q[2]) + '</button></div>';
      }
      return '<div class="pf-banner"' + (u.banner ? ' style="background-image:url(&quot;' + h(safeUrl(u.banner)) + '&quot;)"' : '') + '></div>' +
        '<div class="pf-top">' + (big ? '<img class="pf-av" src="' + h(big) + '" alt="">' : '<div class="pf-av"></div>') +
        '<div class="pf-btns">' + (p.xpro ? '<button class="pf-icon" type="button" data-cmd="prof-addcol" title="Add as a column, in X Pro on all your devices" aria-label="Add as a column">' + icon('addcol') + '</button>' : '') +
        (p.xpro && !me ? '<button class="pf-icon" type="button" data-cmd="prof-more" title="More" aria-label="More" aria-haspopup="menu">' + icon('more') + '</button>' : '') + follow + '</div></div>' +
        confirm +
        '<div class="pf-name"><span>' + h(u.name || p.handle) + '</span>' + R.badges(u, { settings }) + (u.protected ? icon('lock', 'lock') : '') + '</div>' +
        '<div class="pf-handle">@' + h(u.handle || p.handle) + (u.followedBy ? '<span class="pf-fy">Follows you</span>' : '') + '</div>' +
        (u.bio ? '<div class="pf-bio tx">' + u.bio + '</div>' : '') +
        (meta.length ? '<div class="pf-meta">' + meta.join('') + '</div>' : '') +
        counts + note;
    }

    function profileList(p, pr) {
      const tab = PTABS.find((t) => t[0] === p.tab) || PTABS[0];
      const id = pr ? pr.id : p.id;
      const t = id ? store.timeline(id, tab[2]) : null;
      if (!t || !t.sorted.length) {
        const msg = p.status === 'failed' ? '' : p.xpro ? 'Loading ' + tab[1].toLowerCase() + ' from X Pro…' : '';
        return { html: '', foot: msg };
      }
      const ctx = { settings, now: Date.now(), viewer, expanded };
      return { html: t.sorted.map((b) => R.block(b, ctx, b.kind === 'thread' ? b.posts : null)).join(''), foot: '' };
    }

    function renderProfile() {
      if (!prof) return;
      const p = prof;
      const pr = store.profile(p.handle);
      if (pr && !p.id) p.id = pr.id;
      const u = pr || personOf(p.handle) || { handle: p.handle, name: p.handle };
      profHead.innerHTML = profileHead(u, p);
      profTabs.innerHTML = p.xpro
        ? PTABS.map(([id, label]) => '<button class="pf-tab" type="button" role="tab" aria-selected="' + (p.tab === id) + '" data-cmd="prof-tab" data-tab="' + id + '">' + label + '</button>').join('')
        : '';
      const l = profileList(p, pr);
      if (profList.dataset.sig !== p.tab + '|' + l.html.length + '|' + (pr ? pr.id : '')) {
        profList.innerHTML = l.html;
        profList.dataset.sig = p.tab + '|' + l.html.length + '|' + (pr ? pr.id : '');
      }
      profFoot.textContent = l.foot;
      profBox.setAttribute('aria-label', (u.name || p.handle) + ', profile');
    }

    async function profFollow(want) {
      const p = prof;
      const u = p && store.profile(p.handle);
      if (!u) return;
      p.confirm = null;
      const flip = (on) => {
        u.following = on;
        if (u.followers != null) u.followers = Math.max(0, u.followers + (on ? 1 : -1));
        // Posts carry the same flag (the Mutuals filter reads it).
        eachPost((q) => {
          if (q && !q.unavailable && q.author.id === u.id) q.author.following = on;
        });
      };
      flip(want);
      renderProfile();
      const r = await xpro.setFollowing(u.id, want);
      if (!r.ok) {
        flip(!want);
        toast(want ? 'X Pro didn’t confirm the follow.' : 'X Pro didn’t confirm the unfollow.', 'warn');
      } else toast((want ? 'Following @' : 'Unfollowed @') + u.handle, 'follow');
      renderProfile();
    }

    // Runs one item of X Pro’s More menu. Lists and Report open X Pro’s own
    // dialog: Sweeter steps aside until it closes (⌥X also returns).
    async function profMenuAction(text, opts) {
      const p = prof;
      if (!p) return;
      const r = await xpro.profileAction(p.handle, text, opts.confirm);
      if (!r.ok) return toast('X Pro didn’t do that. Try again in X Pro (⌥X).', 'warn');
      if (opts.dialog) {
        passthrough = true;
      closePalette();
        applySettings();
        const timer = setInterval(() => {
          if (!passthrough) return clearInterval(timer);
          if (!xpro.dialogOpen()) {
            clearInterval(timer);
            endPassthrough();
          }
        }, 400);
        return;
      }
      const u = store.profile(p.handle);
      if (u && opts.set) Object.assign(u, opts.set);
      if (opts.done) toast(opts.done);
      renderProfile();
    }

    async function showProfileMenu(anchor) {
      const p = prof;
      if (!p) return;
      const items = (await xpro.readProfileMenu(p.handle)) || [];
      if (!prof || prof !== p) return;
      const find = (re) => items.find((i) => re.test(i.text));
      const handle = p.handle;
      const url = 'https://x.com/' + handle;
      const x = {
        reposts: find(/^Turn (off|on) reposts/i),
        lists: find(/^Add\/remove from Lists/i),
        mute: find(/^(Mute|Unmute)\b/i),
        remove: find(/^Remove this follower/i),
        block: find(/^(Block|Unblock) @/i),
        report: find(/^Report @/i),
      };
      const list = tidy([
        x.reposts ? { id: 'reposts', title: x.reposts.text, symbol: 'arrow.2.squarepath' } : null,
        x.lists ? { id: 'lists', title: 'Add or Remove from Lists…', symbol: 'list.bullet' } : null,
        { separator: true },
        { id: 'copy', title: 'Copy Link to Profile', symbol: 'link' },
        { id: 'web', title: 'Open on X', symbol: 'safari' },
        { id: 'share', title: 'Share…', symbol: 'square.and.arrow.up', share: url },
        { separator: true },
        x.mute ? { id: 'mute', title: x.mute.text, symbol: /^Unmute/i.test(x.mute.text) ? 'speaker.wave.2' : 'speaker.slash' } : null,
        x.remove ? { id: 'remove', title: 'Remove This Follower…', symbol: 'person.badge.minus' } : null,
        x.block ? { id: 'block', title: x.block.text + (/^Block/i.test(x.block.text) ? '…' : ''), symbol: 'hand.raised' } : null,
        x.report ? { id: 'report', title: x.report.text + '…', symbol: 'exclamationmark.bubble' } : null,
      ]);
      const run = (choice) => {
        switch (choice) {
          case 'reposts':
            return profMenuAction(x.reposts.text, { done: /off/i.test(x.reposts.text) ? 'Reposts from @' + handle + ' are off' : 'Reposts from @' + handle + ' are on' });
          case 'lists':
            return profMenuAction(x.lists.text, { dialog: true });
          case 'copy':
            return copyText(url, 'Link copied');
          case 'web':
            return openUrl(url);
          case 'mute': {
            const on = !/^Unmute/i.test(x.mute.text);
            return profMenuAction(x.mute.text, { set: { muting: on }, done: (on ? 'Muted @' : 'Unmuted @') + handle });
          }
          case 'remove':
            prof.confirm = { kind: 'remove', text: x.remove.text };
            return renderProfile();
          case 'block':
            if (/^Unblock/i.test(x.block.text)) return profMenuAction(x.block.text, { confirm: true, set: { blocking: false }, done: 'Unblocked @' + handle });
            prof.confirm = { kind: 'block', text: x.block.text };
            return renderProfile();
          case 'report':
            return profMenuAction(x.report.text, { dialog: true });
          default:
        }
      };
      if (native && native.menu) return native.menu({ items: list }).then((c) => c && run(c));
      // Share… needs the Mac app’s share sheet.
      pop.innerHTML = tidy(list.filter((it) => !it.share)).map((it) => (it.separator ? '<div class="psep" role="separator"></div>' : '<button type="button" role="menuitem" data-cmd="prof-menu" data-v="' + h(it.id) + '"><span class="pl2">' + h(it.title) + '</span></button>')).join('');
      pop.dataset.kind = 'profile';
      pop.__run = run;
      placePop(anchor);
    }

    // Unfollow, block, unblock and remove-follower ask first, inside the sheet.
    function profConfirmed() {
      const p = prof;
      if (!p || !p.confirm) return;
      const c = p.confirm;
      p.confirm = null;
      if (c.kind === 'unfollow') return profFollow(false);
      if (c.kind === 'block') return profMenuAction(c.text, { confirm: true, set: { blocking: true, following: false }, done: 'Blocked @' + p.handle });
      if (c.kind === 'remove') return profMenuAction(c.text, { confirm: true, set: { followedBy: false }, done: 'Removed @' + p.handle + ' as a follower' });
      if (c.kind === 'unblock') return profMenuAction('Unblock @' + p.handle, { confirm: true, set: { blocking: false }, done: 'Unblocked @' + p.handle });
    }

    function setProfileTab(tab) {
      if (!prof || prof.tab === tab) return;
      prof.tab = tab;
      const t = PTABS.find((x) => x[0] === tab);
      if (t && prof.xpro) xpro.profileTab(prof.handle, t[1]);
      renderProfile();
    }

    // ---------- column management (Release 1) ----------

    const WIDTHS = [
      [300, 'Narrow'],
      [400, 'Medium'],
      [600, 'Wide'],
    ]; // X Pro’s own base widths, as Sweeter-only choices

    function applyWidth(c) {
      const w = (settings.colWidths || {})[c.vid];
      c.el.classList.toggle('sized', !!w);
      if (w) c.el.style.setProperty('--w', w + 'px');
      else c.el.style.removeProperty('--w');
    }

    function setColWidth(vid, w) {
      const next = Object.assign({}, settings.colWidths);
      if (w) next[vid] = Math.round(Math.max(240, Math.min(800, w)));
      else delete next[vid];
      settings.colWidths = next;
      persist();
      const c = cols.get(vid);
      if (c) applyWidth(c);
    }

    // Drag a column’s right edge to resize it; double-click it to reset.
    // Sweeter only: X Pro keeps its own three widths.
    colsEl.addEventListener('pointerdown', (e) => {
      const hnd = e.target.closest && e.target.closest('.rsz');
      if (!hnd || e.button !== 0) return;
      const colEl = hnd.closest('.col');
      if (!colEl || !cols.has(colEl.dataset.vid)) return;
      e.preventDefault();
      hnd.setPointerCapture(e.pointerId);
      const x0 = e.clientX;
      const w0 = colEl.getBoundingClientRect().width;
      let w = w0;
      let frame = 0;
      let moved = false;
      colEl.classList.add('sized', 'resizing');
      colEl.style.setProperty('--w', Math.round(w0) + 'px');
      const move = (ev) => {
        if (Math.abs(ev.clientX - x0) > 3) moved = true;
        w = Math.round(Math.max(240, Math.min(800, w0 + ev.clientX - x0)));
        if (!frame)
          frame = requestAnimationFrame(() => {
            frame = 0;
            colEl.style.setProperty('--w', w + 'px');
          });
      };
      // A click, or a cancelled drag, leaves the width as it was.
      const up = (ev) => {
        hnd.removeEventListener('pointermove', move);
        hnd.removeEventListener('pointerup', up);
        hnd.removeEventListener('pointercancel', up);
        cancelAnimationFrame(frame);
        colEl.classList.remove('resizing');
        const c = cols.get(colEl.dataset.vid);
        if (moved && ev.type === 'pointerup') setColWidth(colEl.dataset.vid, w);
        else if (c) applyWidth(c);
      };
      hnd.addEventListener('pointermove', move);
      hnd.addEventListener('pointerup', up);
      hnd.addEventListener('pointercancel', up);
    });
    colsEl.addEventListener('dblclick', (e) => {
      const hnd = e.target.closest && e.target.closest('.rsz');
      if (!hnd) return;
      e.stopPropagation();
      setColWidth(hnd.closest('.col').dataset.vid, 0);
    });

    // The column menu: “…” on the header, or right-click a header or tab.
    function columnMenu(c) {
      const s = store.get(c.key);
      const m = mapOf(c);
      const w = (settings.colWidths || {})[c.vid] || 0;
      const on = filterIds(c);
      const collapsed = modeOf(c.vid) === 'collapsed';
      const cleared = !!(settings.colCleared || {})[c.vid];
      const own = removable(m) && !removing.has(c.vid); // X Pro shows it and its model names it
      const local = !!(c.view || c.merge);
      const me = entryOf(c.vid);
      const others = layout.filter((x) => x.vid !== c.vid && mergeable(x));
      const mine = actingAs(c.vid) === null;
      const items = [
        { id: 'read', title: 'Mark All as Read', symbol: 'checkmark.circle' },
        { id: 'find', title: 'Find in Column…', symbol: 'magnifyingglass' },
        s ? { id: 'filters', title: 'Filters', symbol: 'line.3.horizontal.decrease.circle', children: filterList(c).map((f) => ({ id: 'f:' + f.id, title: f.name, checked: on.includes(f.id) })).concat([{ separator: true }, { id: 'fclear', title: 'Clear Filters', enabled: on.length > 0 }]) } : null,
        { separator: true },
        { id: 'width', title: 'Width', symbol: 'arrow.left.and.right', children: WIDTHS.map(([n, label]) => ({ id: 'w:' + n, title: label, checked: w === n })).concat([{ separator: true }, { id: 'w:0', title: 'Default Width', checked: !w }, { id: 'equal', title: 'Make All Columns Equal', checked: settings.fit === 'equal' && !Object.keys(settings.colWidths || {}).length }]) },
        { id: 'look', title: 'Icon & Color…', symbol: 'paintpalette' },
        { id: 'media', title: 'Media', symbol: 'photo', children: [['', 'Like Preferences'], ['full', 'Full Thumbnails'], ['cropped', 'Cropped Grid'], ['small', 'Small'], ['none', 'None']].map(([v, label]) => ({ id: 'm:' + v, title: label, checked: ((settings.colMedia || {})[c.vid] || '') === v })) },
        s && s.kind !== 'notifications' ? { id: 'grid', title: (settings.colGrid || {})[c.vid] ? 'Show as Posts' : 'Show as Media Grid', symbol: 'square.grid.3x3' } : null,
        { id: 'rename', title: 'Rename…', symbol: 'pencil' },
        { id: 'collapse', title: collapsed ? 'Expand' : 'Collapse', symbol: collapsed ? 'arrow.up.left.and.arrow.down.right' : 'arrow.down.right.and.arrow.up.left' },
        { id: 'hide', title: 'Hide Column', symbol: 'eye.slash' },
        { id: 'popout', title: 'Open in New Window', symbol: 'macwindow.badge.plus' },
        { id: 'groups', title: 'Groups', symbol: 'rectangle.3.group', children: deckGroups().map((g) => ({ id: 'gi:' + g.id, title: g.name, checked: g.vids.includes(c.vid) })).concat([{ separator: true }, { id: 'gnew1', title: 'New Group With This Column…' }]) },
        c.merge ? null : { id: 'dup', title: 'Duplicate as View', symbol: 'square.on.square' },
        c.view ? { id: 'rmview', title: 'Remove View', symbol: 'minus.square' } : null,
        mergeable(me) && others.length ? { id: 'mergeWith', title: 'Merge With', symbol: 'arrow.triangle.merge', children: others.map((x) => ({ id: 'mw:' + x.vid, title: titleOf(x.vid) })) } : null,
        c.merge ? { id: 'msrc', title: 'Merged Columns', symbol: 'arrow.triangle.merge', children: layout.filter((x) => mergeable(x)).map((x) => ({ id: 'ms:' + x.key, title: titleOf(x.vid), checked: c.merge.srcs.includes(x.key) })).concat(c.merge.srcs.filter((k) => !mappingFor(k)).map((k) => ({ id: 'ms:' + k, title: (store.get(k) ? columnTitle(k, store.get(k)) : k) + ' (not in this deck)', checked: true }))) } : null,
        c.merge ? { id: 'unmerge', title: 'Unmerge', symbol: 'minus.square' } : null,
        { separator: true },
        cleared ? { id: 'uncleared', title: 'Show Cleared Posts', symbol: 'arrow.uturn.backward' } : { id: 'clear', title: 'Clear', symbol: 'clear' },
        native ? { id: 'alerts', title: 'Alerts', symbol: 'bell.badge', children: [['off', 'Off'], ['banner', 'Banner'], ['sound', 'Banner and Sound']].map(([v, label]) => ({ id: 'a:' + v, title: label, checked: alertOf(c) === v })) } : null,
        { separator: true },
        { id: 'note', title: 'These change X Pro on all your devices:', enabled: false, label: true },
        { id: 'add', title: 'Add Column…', symbol: 'plus.rectangle.on.rectangle' },
        local ? null : { id: 'left', title: 'Move Left', symbol: 'arrow.left', enabled: own && mine && neighbor(c, -1) != null },
        local ? null : { id: 'right', title: 'Move Right', symbol: 'arrow.right', enabled: own && mine && neighbor(c, 1) != null },
        local || (s && s.kind === 'list') ? null : { id: 'xrename', title: 'Rename in X Pro…', symbol: 'pencil.line', enabled: own && mine },
        local || !xpro.canClear(m) ? null : { id: 'xclear', title: 'Clear in X Pro Too…', symbol: 'clear', enabled: own && mine },
        !local && m && m.col && m.col.cleared ? { id: 'xlatest', title: 'Show Latest Posts in X Pro', symbol: 'arrow.uturn.backward', enabled: own && mine } : null,
        !local && s && s.kind === 'search' ? { id: 'xsearch', title: 'Edit Search in X Pro…', symbol: 'magnifyingglass', enabled: own && mine } : null,
        local ? null : { id: 'xcopy', title: 'Make a Copy in X Pro', symbol: 'plus.square.on.square', enabled: own && mine },
        !local && s && s.kind === 'list' ? { id: 'xconvert', title: 'Convert to Search Column…', symbol: 'magnifyingglass', enabled: own && mine } : null,
        local || decksNow().all.length < 2 ? null : { id: 'xmove', title: 'Move to Deck', symbol: 'rectangle.portrait.and.arrow.right', children: decksNow().all.filter((d) => !decksNow().act || d.id !== decksNow().act.id).map((d) => ({ id: 'xm:' + d.id, title: (d.icon ? d.icon + '  ' : '') + (d.title || 'Untitled'), enabled: own && mine })) },
        !local && s && s.kind === 'list' ? { id: 'xreport', title: 'Report List in X Pro…', symbol: 'exclamationmark.bubble', enabled: own && mine } : null,
        s && s.kind === 'notifications' ? { id: 'nsettings', title: 'Notification Settings…', symbol: 'gear' } : null,
        local ? null : { id: 'remove', title: 'Remove “' + titleOf(c.vid) + '”…', symbol: 'minus.rectangle', enabled: removable(m) && !removing.has(c.vid) && mine },
      ];
      const run = (choice) => {
        if (!choice) return;
        if (choice === 'read') return markAllRead(c);
        if (choice === 'find') return openFind(c);
        if (choice === 'fclear') return setFilters(c, []);
        if (choice.startsWith('f:')) return toggleFilter(c, choice.slice(2));
        if (choice.startsWith('w:')) return setColWidth(c.vid, Number(choice.slice(2)));
        if (choice === 'equal') return equalWidths();
        if (choice === 'look') return openIconPicker(c);
        if (choice.startsWith('i:')) return setOwn('colIcons', c.vid, choice.slice(2));
        if (choice.startsWith('t:')) return setOwn('colTints', c.vid, choice.slice(2));
        if (choice === 'rename') return startRename(c);
        if (choice.startsWith('m:')) {
          setOwn('colMedia', c.vid, choice.slice(2));
          c.full = true;
          return renderColumn(c, false);
        }
        if (choice === 'grid') {
          setOwn('colGrid', c.vid, (settings.colGrid || {})[c.vid] ? '' : true);
          c.scroll.scrollTop = 0;
          return renderColumn(c, false);
        }
        if (choice === 'collapse') return setMode(c.vid, collapsed ? null : 'collapsed');
        if (choice === 'hide') return setMode(c.vid, 'hidden');
        if (choice === 'popout') return popOut(c);
        if (choice.startsWith('gi:')) return toggleInGroup(choice.slice(3), c.vid);
        if (choice === 'gnew1') return newGroup([c.vid]);
        if (choice === 'dup') return duplicateView(c);
        if (choice === 'rmview') return removeView(c.vid);
        if (choice.startsWith('mw:')) return createMerge(c, cols.get(choice.slice(3)));
        if (choice.startsWith('ms:')) return setMergeSource(c.vid, choice.slice(3), !c.merge.srcs.includes(choice.slice(3)));
        if (choice === 'unmerge') return removeMerge(c.vid);
        if (choice === 'clear') return clearCol(c, true);
        if (choice === 'uncleared') return clearCol(c, false);
        if (choice.startsWith('a:')) return setAlert(c, choice.slice(2));
        if (choice === 'add') return openAddSheet();
        if (choice === 'remove') return removeColumnAsk(c.vid, false);
        if (choice === 'left' || choice === 'right') return moveBy(c, choice === 'left' ? -1 : 1);
        if (choice === 'xrename') return startRename(c, true);
        if (choice === 'xclear') return clearInXPro(c);
        if (choice === 'xlatest') return xproOp(() => xpro.showLatestInXPro(m.id), 'Showing the latest posts again in X Pro');
        if (choice === 'xsearch') return editSearch(c);
        if (choice === 'xcopy') return xproOp(() => xpro.makeCopy(m.id), 'Copied in X Pro, on all your devices');
        if (choice === 'xconvert') return convertToSearch(c);
        if (choice.startsWith('xm:')) return moveToDeck(c, choice.slice(3));
        if (choice === 'xreport') {
          if (refuseDelegated(c.vid)) return;
          if (pendingRemove) commitRemove(pendingRemove);
          let opened = null;
          return xproHandoff(async () => {
            const r = await xpro.openReportList(m.id);
            opened = r.opened;
            return r;
          }, () => xpro.dialogOpen(), () => {
            if (opened === 'opened') xpro.closeDrawer(m.id);
          });
        }
        if (choice === 'nsettings') return openUrl('https://x.com/settings/notifications');
      };
      return { items, run };
    }

    // The source a model-named column will have, from its key alone.
    function declared(key) {
      if (key.startsWith('conv:')) return { key, kind: 'conversation', title: 'Conversation' };
      if (key.startsWith('x:')) return { key, kind: 'placeholder', title: PLACEHOLDERS[key.slice(2)] || 'X Pro column' };
      if (key === 'home') return { key, kind: 'home', title: 'Home' };
      if (key === 'home-foryou') return { key, kind: 'home', title: 'For You' };
      if (key === 'mentions') return { key, kind: 'notifications', title: 'Mentions' };
      if (key.startsWith('notifications:')) return { key, kind: 'notifications', title: key === 'notifications:all' ? 'Notifications' : key.slice(14).replace(/^./, (x) => x.toUpperCase()) };
      if (key.startsWith('list:')) return { key, kind: 'list', title: 'List', listId: key.slice(5) };
      if (key.startsWith('search:')) return { key, kind: 'search', title: key.split(':').slice(1, -1).join(':') };
      if (key === 'bookmarks') return { key, kind: 'bookmarks', title: 'Bookmarks' };
      if (key.startsWith('user:')) return { key, kind: 'user', title: 'Profile' };
      return null;
    }

    // ---------- X Pro column operations (Release 2) ----------

    const XOP_FAIL = {
      busy: 'Another column change is still running. Try again in a moment.',
      delegated: 'That column acts as another account in X Pro, so nothing changed.',
      nohandle: 'X Pro shows no handle to move that column. Nothing changed.',
      nomove: 'X Pro didn’t move the column. Nothing changed.',
      nooptions: 'X Pro’s column options didn’t open. Nothing changed.',
      norename: 'X Pro can’t rename that kind of column.',
      nocopy: 'X Pro shows no “Make a copy” for that column.',
      noconvert: 'X Pro can’t convert that column.',
      nodeck: 'X Pro’s Move list doesn’t show that deck.',
      ambiguous: 'Two decks share that name. Move it in X Pro (⌥X).',
      noclear: 'X Pro can’t clear that kind of column.',
      notcleared: 'That column isn’t cleared in X Pro.',
      nostack: 'X Pro has nothing open there to make a column of.',
    };
    async function xproOp(fn, done) {
      const r = await runColumnOp(fn);
      if (r.ok) {
        if (done) toast(done);
      } else toast(XOP_FAIL[r.reason] || 'X Pro didn’t do that. Nothing changed.', 'warn');
      return r;
    }
    // The next X Pro column Sweeter shows, to the left or right.
    function neighbor(c, dir) {
      const own = layout.filter((e) => !e.view && e.m && e.m.id && !removing.has(e.vid));
      const i = own.findIndex((e) => e.vid === c.vid);
      const n = own[i + dir];
      return i < 0 || !n ? null : n;
    }
    // Move Left / Right: past the neighbor Sweeter shows (X Pro may hold
    // columns Sweeter does not show between them, so count X Pro’s own).
    function moveBy(c, dir) {
      if (refuseDelegated(c.key)) return;
      const m = mapOf(c);
      const n = neighbor(c, dir);
      if (!m || !n || !removable(m)) return;
      const order = xpro.wrappers().map((w) => w.id);
      const a = order.indexOf(m.id);
      const b = order.indexOf(n.m.id);
      if (a < 0 || b < 0) return toast('X Pro hasn’t shown both columns yet.', 'warn');
      xproOp(async () => {
        const r = await xpro.moveColumn(m.id, b - a);
        return r.ok ? { ok: true, id: m.id } : r;
      });
    }
    function clearInXPro(c) {
      const m = mapOf(c);
      if (!m || refuseDelegated(c.key)) return;
      if (pendingRemove) commitRemove(pendingRemove);
      showConfirm('Clear “' + titleOf(c.vid) + '” in X Pro on all your devices too?', 'Clear', () => {
        const r = xpro.clearInXPro(m.id);
        if (!r.ok) return toast(XOP_FAIL[r.reason] || 'X Pro didn’t clear it.', 'warn');
        clearCol(c, true, true);
        // X Pro empties its own column too, so Sweeter shows the same.
        for (const v of cols.values()) if (v !== c && v.view && (entryOf(v.vid) || {}).base === c.vid && !(settings.colCleared || {})[v.vid]) clearCol(v, true, true);
        toast('Cleared in X Pro too');
      });
    }
    // Hand X Pro the screen for one of its own dialogs or drawers; Sweeter
    // comes back when it closes (or on ⌥X).
    async function xproHandoff(start, stillOpen, onEnd) {
      closePop();
      passthrough = true;
      closePalette();
      applySettings();
      let r;
      try {
        r = await start();
      } catch (e) {
        r = false;
      }
      if (!r || r.ok === false) {
        endPassthrough();
        return toast('X Pro didn’t open that. Nothing changed.', 'warn');
      }
      const t0 = Date.now();
      const timer = setInterval(() => {
        if (!passthrough) return clearInterval(timer);
        if (Date.now() - t0 > 1200 && !stillOpen()) {
          clearInterval(timer);
          endPassthrough();
          if (onEnd) onEnd();
        }
      }, 400);
    }
    // Convert to search: the list column becomes a search of that list, on
    // every device. X Pro offers “Change back” for a few seconds.
    function convertToSearch(c) {
      const m = mapOf(c);
      if (!m || refuseDelegated(c.key)) return;
      if (pendingRemove) commitRemove(pendingRemove);
      showConfirm('Convert “' + titleOf(c.vid) + '” to a search column on all your devices? The list column is replaced.', 'Convert', async () => {
        const r = await xproOp(() => xpro.convertToSearch(m.id), null);
        if (r.ok) showUndo('Converted to a search column', () => {
          if (!xpro.changeBack()) toast('X Pro’s Change back is gone. Convert it back in X Pro (⌥X).', 'warn');
        }, 5000);
      });
    }
    // Move to Deck: X Pro makes the column anew in that deck, removes it
    // here, and shows that deck on every device.
    function moveToDeck(c, deckId) {
      const m = mapOf(c);
      const d = decksNow().all.find((x) => x.id === deckId);
      if (!m || !d || refuseDelegated(c.key)) return;
      if (pendingRemove) commitRemove(pendingRemove);
      const label = (d.icon || '') + (d.title || '');
      if (decksNow().all.filter((x) => (x.icon || '') + (x.title || '') === label).length > 1) return toast('Two decks share that name. Move it in X Pro (⌥X).', 'warn');
      showConfirm('Move “' + titleOf(c.vid) + '” to ' + (d.icon ? d.icon + ' ' : '') + '“' + d.title + '”? X Pro then shows that deck on all your devices.', 'Move', () => xproOp(() => xpro.moveToDeck(m.id, label), 'Moved to “' + d.title + '”'));
    }

    function editSearch(c) {
      const m = mapOf(c);
      if (!m || refuseDelegated(c.key)) return;
      xproHandoff(() => xpro.openSearchEditor(m.id), () => xpro.drawerOpen(m.id));
    }
    // Open as Column: the conversation open in this column becomes a column.
    async function conversationToColumn(c) {
      if (!c || !c.detail) return;
      if (c.detail.failed) return toast('X Pro doesn’t have this conversation open, so nothing changed.', 'warn');
      const m = mapOf(c);
      if (refuseDelegated(c.key)) return;
      const id = c.detail.id;
      const r = await xproOp(() => xpro.conversationToColumn(m, id), null);
      if (r.ok) {
        // X Pro closed that stack level itself, and the rest is closed too.
        dropDetail(c);
        toast('Opened as a column');
      }
    }

    // ---------- decks ----------

    function decksNow() {
      const all = store.decks.decks();
      const act = store.decks.activeDeck();
      return { all, act, pinned: all.filter((d) => d.pinned) };
    }
    function paintDeck() {
      const { act } = decksNow();
      deckEl.hidden = !act;
      if (!act) return;
      deckEl.textContent = act.icon || '★';
      deckEl.title = 'Deck: ' + (act.title || 'Untitled') + ' (click for decks)';
      deckEl.setAttribute('aria-label', deckEl.title);
    }
    // A deck change waits for any column change, and drops the Add
    // sheet’s placeholder column first (it belongs to this deck).
    function deckBusy() {
      if (colOp || passthrough || (addState && addState.step === 'busy')) {
        toast('Finish the column change first.', 'info');
        return true;
      }
      if (addState) closeAddSheet();
      return false;
    }
    async function switchDeckTo(d) {
      const { act } = decksNow();
      if (!d || (act && act.id === d.id) || deckBusy()) return;
      if (!d.pinned) return xproHandoff(() => ({ ok: xpro.manageDecks() }), () => xpro.deckDialogOpen());
      // A deck switch ends a pending removal’s undo window, in X Pro too.
      if (pendingRemove) await commitRemove(pendingRemove);
      const r = xpro.switchDeck(d.title);
      if (!r.ok) return toast(r.reason === 'ambiguous' ? 'Two decks share that name. Switch in X Pro (⌥X).' : 'X Pro shows no button for that deck.', 'warn');
      toast('Deck: ' + (d.icon ? d.icon + ' ' : '') + d.title, 'decks');
    }
    function showDeckMenu(anchor) {
      const { all, act } = decksNow();
      const items = all.map((d, i) => ({ id: 'd:' + d.id, title: (d.icon ? d.icon + '  ' : '') + (d.title || 'Untitled') + (d.pinned ? '' : ' (unpinned)'), checked: !!act && act.id === d.id, key: i < 9 ? String(i + 1) : '', mods: ['option', 'command'] }));
      for (const it of items) it.kbd = it.key ? '⌥⌘' + it.key : '';
      items.push({ id: 'overview', title: 'All Decks…', symbol: 'rectangle.3.group' });
      items.push({ separator: true }, { id: 'new', title: 'New Deck…', symbol: 'plus.square.on.square' }, { id: 'edit', title: 'Edit Deck…', symbol: 'pencil' }, { id: 'manage', title: 'Manage Decks…', symbol: 'square.stack' });
      // Groups of this deck’s columns (Sweeter only).
      const gs = deckGroups();
      const allGroups = settings.groups || [];
      const g = activeGroup();
      items.push({ separator: true }, { id: 'groupsLabel', title: 'Groups (Sweeter only)', enabled: false, label: true });
      items.push({ id: 'g:', title: 'All Columns', checked: !g, key: '0', mods: ['control', 'command'], kbd: '⌃⌘0' });
      gs.forEach((x, i) => items.push({ id: 'g:' + x.id, title: x.name + ' (' + x.vids.filter((v) => cols.has(v)).length + ')', checked: !!g && g.id === x.id, key: i < 9 ? String(i + 1) : '', mods: ['control', 'command'], kbd: i < 9 ? '⌃⌘' + (i + 1) : '' }));
      items.push({ id: 'gnew', title: 'New Group From These Columns…', symbol: 'rectangle.stack.badge.plus' });
      if (g) items.push({ id: 'gren', title: 'Rename “' + g.name + '”…', symbol: 'pencil' }, { id: 'gdel', title: 'Delete “' + g.name + '”', symbol: 'trash' });
      const run = (v) => {
        if (!v) return;
        if (v.startsWith('d:')) return switchDeckTo(all.find((d) => d.id === v.slice(2)));
        if (v === 'overview') return openOverview();
        if (v.startsWith('g:')) return setGroup(v.slice(2));
        if (v === 'gnew') return newGroup(shown().map((e) => e.vid));
        if (v === 'gren' && g) return askText('Rename the group', g.name, (name) => saveGroups(allGroups.map((x) => (x.id === g.id ? Object.assign({}, x, { name }) : x))));
        if (v === 'gdel' && g) {
          const before = allGroups;
          saveGroups(allGroups.filter((x) => x.id !== g.id));
          setGroup('');
          return showUndo('Group “' + g.name + '” deleted', () => {
            saveGroups(before);
            setGroup(g.id);
          }, 6000);
        }
        deckAction(v);
      };
      closePop();
      if (native && native.menu) return native.menu({ items }).then(run);
      pop.innerHTML = items
        .map((it) => (it.separator ? '<div class="psep" role="separator"></div>' : it.label ? '<div class="plabel">' + h(it.title) + '</div>' : '<button type="button" role="' + (it.checked == null ? 'menuitem' : 'menuitemradio') + '"' + (it.checked == null ? '' : ' aria-checked="' + it.checked + '"') + ' data-cmd="pop-run" data-v="' + h(it.id) + '"><span class="ck">' + (it.checked ? icon('check') : '') + '</span><span class="pl2">' + h(it.title) + '</span>' + (it.kbd ? '<kbd>' + h(it.kbd) + '</kbd>' : '') + '</button>'))
        .join('');
      pop.dataset.kind = 'deck';
      pop.__run = run;
      placePop(anchor);
    }
    // New, Edit and Manage Decks are X Pro’s own dialogs. Deleting a deck
    // happens there too: X Pro asks, and Sweeter never answers for you.
    function deckAction(v) {
      if (deckBusy()) return;
      const fn = { new: xpro.newDeck, edit: xpro.editDeck, manage: xpro.manageDecks }[v];
      if (fn) xproHandoff(() => ({ ok: fn() }), () => xpro.deckDialogOpen());
    }
    function deckByNumber(n) {
      const { all } = decksNow();
      const d = n === 0 ? all[all.length - 1] : all[n - 1];
      if (d) switchDeckTo(d);
      else toast('No deck ' + n, 'info');
    }

    // ---------- the local layer: clear, catch-up, alerts ----------

    // Clear (Sweeter only): hide everything loaded so far; new posts still
    // arrive. “Show Cleared Posts” brings them back. X Pro is not touched.
    function clearCol(c, on, quiet) {
      if (!c) return;
      const s = store.get(c.key);
      const next = Object.assign({}, settings.colCleared);
      if (on && s && s.sorted.length) {
        next[c.vid] = Math.max(0, ...s.sorted.slice(0, 50).map((b) => store.timeOf(c.key, b) || 0)) || Date.now();
        store.markAllRead(c.key);
        c.markerSort = s.readSort;
      } else delete next[c.vid];
      settings.colCleared = next;
      persist();
      c.full = true;
      c.pinned = settings.pinToTop;
      c.scroll.scrollTop = 0;
      renderColumn(c, false);
      redrawPopFor(c.vid);
      if (!quiet) toast(on ? 'Cleared “' + titleOf(c.vid) + '”' : 'Cleared posts are back');
    }
    function clearAll() {
      let n = 0;
      for (const e of shown()) {
        const c = cols.get(e.vid);
        if (c && !(settings.colCleared || {})[c.vid]) {
          clearCol(c, true, true);
          n++;
        }
      }
      toast(n ? 'Cleared ' + n + (n === 1 ? ' column' : ' columns') : 'Every column is clear');
    }

    // Next unread (⌘J): the next column, to the right, with unread posts,
    // at its “You were here” line. ⇧⌘J goes left.
    function nextUnread(dir) {
      const list = shown();
      if (!list.length) return;
      const i = Math.max(0, list.findIndex((e) => e.vid === focusVid));
      for (let k = 1; k <= list.length; k++) {
        const e = list[(i + dir * k + list.length * 2) % list.length];
        const c = cols.get(e.vid);
        if (c && unreadCount(c) > 0) {
          if (modeOf(e.vid)) return goCol(e.vid, true); // opens at the marker
          goCol(e.vid);
          if (c.marker && c.marker.isConnected) jumpToMarker(c);
          return;
        }
      }
      toast('Nothing unread', 'info');
    }

    // Alerts (Mac app): per column. A notifications column alerts with sound
    // unless it is set otherwise; every other column is off by default.
    function alertOf(c) {
      const a = (settings.colAlerts || {})[c.vid];
      if (a) return a;
      const s = store.get(c.key);
      return s && s.kind === 'notifications' && !c.view ? 'sound' : 'off';
    }
    function setAlert(c, v) {
      settings.colAlerts = Object.assign({}, settings.colAlerts, { [c.vid]: v });
      persist();
      toast(v === 'off' ? 'Alerts off for “' + titleOf(c.vid) + '”' : 'Alerts on for “' + titleOf(c.vid) + '”', 'bell');
      if (v !== 'off') {
        ntChecked.add(c.vid);
        checkNotify([c], true);
      }
    }

    // Notification permission (Mac app). macOS is asked when alerts are
    // turned on, the first time. If notifications are off for Sweeter in
    // System Settings, a sheet says so (always after turning alerts on; at
    // launch, once a week) and opens the right page.
    let ntWaiting = false;
    const alertCols = () => shown().map((e) => cols.get(e.vid)).filter((c) => c && alertOf(c) !== 'off');
    async function checkNotify(list, fromUser) {
      if (!native || !native.notifyStatus || settings.alertsMuted) return;
      // Unasked, nothing that would alert asks nothing.
      const l = list || alertCols();
      if (!l.length && !fromUser) return;
      const st = await native.notifyStatus();
      if (st === 'ask') {
        // macOS shows its own prompt; a no there is respected until the
        // next launch.
        await native.notifyRequest();
        return;
      }
      if (st !== 'off') return;
      if (!fromUser) {
        if (Date.now() - (settings.notifyNagAt || 0) < 7 * 864e5) return;
        settings.notifyNagAt = Date.now();
        persist();
      }
      const what = l.length === 1 ? '“' + titleOf(l[0].vid) + '”' : l.length ? l.length + ' columns' : 'Sweeter';
      ntBack.querySelector('.nt-ic').innerHTML = icon('bell');
      ntBack.querySelector('.nt-b').textContent = 'Alerts are on for ' + what + ', but notifications for Sweeter are turned off in macOS, so none can show. Turn on Allow Notifications for Sweeter in System Settings.';
      closePop();
      ntBack.hidden = false;
      ntBack.querySelector('[data-cmd="nt-go"]').focus({ preventScroll: true });
    }
    // Columns that alert, checked once each (ntChecked, by view id): after
    // loading, then as they arrive (a notifications column alerts by
    // default, and its kind is known only once its posts are).
    function checkNewAlerts() {
      if (booting || !native || !native.notifyStatus) return;
      const fresh = alertCols().filter((c) => !ntChecked.has(c.vid));
      if (!fresh.length) return;
      for (const c of fresh) ntChecked.add(c.vid);
      checkNotify(fresh, false);
    }
    function closeNotify() {
      ntBack.hidden = true;
      app.focus({ preventScroll: true });
    }
    // Back from System Settings: say so once notifications are on.
    window.addEventListener('focus', async () => {
      if (!ntWaiting || !native || !native.notifyStatus) return;
      if ((await native.notifyStatus()) !== 'on') return;
      ntWaiting = false;
      toast('Notifications are on', 'bell');
    });

    // Stale columns: X Pro normally refreshes each column every 30 s. With
    // no word for 75 s, a clock shows in the header.
    function paintStale() {
      const now = Date.now();
      for (const c of cols.values()) {
        const s = store.get(c.key);
        const age = s && s.updated && s.kind !== 'placeholder' && s.kind !== 'conversation' ? now - s.updated : 0;
        const stale = age > 75000;
        c.stl.hidden = !stale;
        c.el.classList.toggle('stale', stale);
        if (stale) c.stl.title = 'X Pro last refreshed this column ' + Math.round(age / 60000) + ' min ago. It may be off screen in X Pro, or X is slow.';
      }
    }

    // ---------- the local layer: looks, modes, titles and views ----------

    function applyLook(c) {
      const mode = modeOf(c.vid);
      c.el.classList.toggle('collapsed', mode === 'collapsed');
      c.el.classList.toggle('hiddencol', mode === 'hidden' || !inGroup(c.vid));
      const t = TINTS.find((x) => x[0] === (settings.colTints || {})[c.vid]);
      if (t) {
        c.el.dataset.tint = t[0];
        c.el.style.setProperty('--cl', t[2]);
        c.el.style.setProperty('--cd', t[3]);
      } else {
        delete c.el.dataset.tint;
        c.el.style.removeProperty('--cl');
        c.el.style.removeProperty('--cd');
      }
      const ic = (settings.colIcons || {})[c.vid];
      c.cic.hidden = !ic;
      c.cic.innerHTML = ic ? icon(ic) : '';
    }

    // One per-column setting (colTitles, colIcons, colTints); '' clears it.
    function setOwn(name, vid, value) {
      const next = Object.assign({}, settings[name]);
      if (value) next[vid] = value;
      else delete next[vid];
      settings[name] = next;
      persist();
      const c = cols.get(vid);
      if (c) {
        applyLook(c);
        c.title.textContent = titleOf(vid);
        c.title.title = c.title.textContent;
      }
      redrawPopFor(vid);
      renderTabs();
      reportState();
    }

    // Collapsed: a narrow strip with the title and the unread count.
    // Hidden: off screen, its tab dimmed (a click on it shows it again).
    // Either way the X Pro column stays, so its posts keep arriving.
    function setMode(vid, mode) {
      const next = Object.assign({}, settings.colModes);
      if (mode) next[vid] = mode;
      else delete next[vid];
      settings.colModes = next;
      persist();
      const c = cols.get(vid);
      if (c) applyLook(c);
      if (mode === 'hidden' && focusVid === vid) {
        const s = shown();
        setFocus(s.length ? s[0].vid : null);
        toast('Column hidden. Its tab shows it again.', 'info');
      }
      renderTabs();
      if (c && !mode) {
        // With unread posts, open at “You were here”, not the top.
        if (unreadCount(c) > 0) c.pinned = false;
        renderColumn(c, false);
        goCol(vid);
        requestAnimationFrame(() => jumpToMarker(c));
      }
    }

    // Rename: Sweeter’s own title for the column (X Pro keeps its own).
    function startRename(c, inXPro) {
      if (!c) return;
      setFocus(c.vid);
      c.renX = !!inXPro;
      c.el.classList.add('renaming');
      c.renEl.hidden = false;
      c.renEl.maxLength = inXPro ? 25 : 60;
      c.renEl.title = inXPro ? 'X Pro’s own title (25 characters, on every device). Empty goes back to the usual title.' : 'Sweeter’s title for this column. Empty goes back to X Pro’s.';
      c.renEl.value = inXPro ? (mapOf(c) && mapOf(c).col && mapOf(c).col.title) || '' : titleOf(c.vid);
      c.renEl.placeholder = (() => {
        const s = store.get(c.key);
        return s ? columnTitle(c.key, s) : '';
      })();
      c.renEl.focus({ preventScroll: true });
      c.renEl.select();
    }
    function endRename(c, save) {
      if (!c || c.renEl.hidden) return;
      const v = c.renEl.value.trim();
      c.renEl.hidden = true;
      c.el.classList.remove('renaming');
      if (save && c.renX) {
        const m = mapOf(c);
        // The usual name, from the data (X Pro’s own default title).
        const s = store.get(c.key);
        const usual = s && !(s.kind === 'list' && s.title === 'List') && s.kind !== 'user' && s.kind !== 'conversation' ? s.title : '';
        if (m && m.id) xproOp(() => xpro.renameColumn(m.id, v, usual), v ? 'Renamed in X Pro' : 'X Pro’s title is back');
      } else if (save) {
        const s = store.get(c.key);
        const base = s ? columnTitle(c.key, s) : '';
        setOwn('colTitles', c.vid, v && v !== base ? v.slice(0, 60) : '');
      }
      app.focus({ preventScroll: true });
    }

    // A view: a second column over the same timeline, with its own filters,
    // title, icon and color. It costs X Pro nothing (no column, no fetch).
    function duplicateView(c) {
      if (!c) return;
      const id = 'v:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const base = (entryOf(c.vid) || {}).base || c.vid;
      settings.views = (settings.views || []).concat([{ id, src: c.key, col: base }]);
      const f = filterIds(c);
      if (f.length) settings.colFilters = Object.assign({}, settings.colFilters, { [id]: f.slice() });
      persist();
      joinGroup(id);
      remap(true);
      for (const cc of cols.values()) renderColumn(cc, false);
      goCol(id);
      const el = cols.get(id) && cols.get(id).el;
      if (el) {
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1400);
      }
      toast('A view of “' + titleOf(c.vid) + '”: the same posts, with its own filters.', 'info');
    }
    const OWN = ['colFilters', 'colWidths', 'colTitles', 'colIcons', 'colTints', 'colModes', 'colCleared', 'colAlerts', 'colMedia', 'colGrid'];
    function removeView(vid) {
      const v = (settings.views || []).find((x) => x.id === vid);
      if (!v) return;
      const title = titleOf(vid);
      const saved = { view: v, own: {} };
      for (const n of OWN) {
        if (settings[n] && vid in settings[n]) {
          saved.own[n] = settings[n][vid];
          const next = Object.assign({}, settings[n]);
          delete next[vid];
          settings[n] = next;
        }
      }
      settings.views = settings.views.filter((x) => x.id !== vid);
      persist();
      remap(true);
      if (pendingRemove) commitRemove(pendingRemove);
      showUndo('View “' + title + '” removed', () => {
        settings.views = (settings.views || []).concat([saved.view]);
        for (const n of Object.keys(saved.own)) settings[n] = Object.assign({}, settings[n], { [vid]: saved.own[n] });
        persist();
        remap(true);
        for (const cc of cols.values()) renderColumn(cc, false);
        goCol(vid);
      }, 6000);
    }

    function showColumnMenu(c, anchor) {
      if (!c) return;
      closePop();
      setFocus(c.vid);
      const m = columnMenu(c);
      if (native && native.menu) return native.menu({ items: tidy(m.items) }).then(m.run);
      // Safari: Sweeter’s own popover; a submenu becomes a labeled section.
      const btn = (it, sub) =>
        '<button type="button" role="' + (it.checked == null ? 'menuitem' : 'menuitemcheckbox') + '"' + (it.checked == null ? '' : ' aria-checked="' + it.checked + '"') + ' data-cmd="pop-run" data-v="' + h(it.id) + '"' + (it.enabled === false ? ' disabled' : '') + (sub ? ' class="sub"' : '') + '>' +
        '<span class="ck">' + (it.checked ? icon('check') : '') + '</span><span class="pl2">' + h(it.title) + '</span></button>';
      const cell = (k) =>
        '<button type="button" role="menuitemradio" aria-checked="' + !!k.checked + '" data-cmd="pop-run" data-v="' + h(k.id) + '" title="' + h(k.title) + '" aria-label="' + h(k.title) + '">' +
        (k.icon ? icon(k.icon) : k.color ? '<i style="background:' + h(k.color) + '"></i>' : '<i class="none"></i>') + '</button>';
      pop.innerHTML = tidy(m.items)
        .map((it) => {
          if (it.separator) return '<div class="psep" role="separator"></div>';
          if (it.grid) return '<div class="plabel">' + h(it.title) + '</div><div class="pgrid ' + it.grid + '">' + it.children.map(cell).join('') + '</div>';
          if (it.children) return '<div class="plabel">' + h(it.title) + '</div>' + it.children.filter((k) => !k.separator).map((k) => btn(k, true)).join('');
          if (it.label) return '<div class="plabel">' + h(it.title) + '</div>';
          return btn(it);
        })
        .join('');
      pop.dataset.kind = 'column';
      pop.__run = m.run;
      placePop(anchor);
    }

    // An undo toast (and a confirm bar, the same element with two buttons).
    let undoTimer = 0;
    let undoAct = null;
    let utoastKind = null; // 'undo' or 'confirm'
    // A bar that replaces an Undo bar runs that bar’s expiry first (a
    // pending column removal then commits instead of being stranded).
    let undoExpire = null;
    function endUndo() {
      const f = utoastKind === 'undo' ? undoExpire : null;
      undoExpire = null;
      if (f) f();
    }
    function showUndo(msg, onUndo, ms, onExpire) {
      endUndo();
      clearTimeout(undoTimer);
      utoastKind = 'undo';
      undoExpire = onExpire || null;
      utoast.innerHTML = '<span class="um"></span><button type="button" data-cmd="utoast-yes">Undo</button>';
      utoast.querySelector('.um').textContent = msg;
      utoast.hidden = false;
      undoAct = onUndo;
      undoTimer = setTimeout(() => {
        utoast.hidden = true;
        undoAct = null;
        utoastKind = null;
        undoExpire = null;
        if (onExpire) onExpire();
      }, ms);
    }
    function showConfirm(msg, yes, onYes) {
      endUndo();
      clearTimeout(undoTimer);
      utoastKind = 'confirm';
      utoast.innerHTML = '<span class="um"></span><button type="button" data-cmd="utoast-no">Cancel</button><button type="button" class="danger" data-cmd="utoast-yes">' + h(yes) + '</button>';
      utoast.querySelector('.um').textContent = msg;
      utoast.hidden = false;
      undoAct = onYes;
      undoTimer = setTimeout(() => {
        utoast.hidden = true;
        undoAct = null;
        utoastKind = null;
      }, 12000);
      utoast.querySelector('.danger').focus({ preventScroll: true });
    }
    function utoastYes() {
      const fn = undoAct;
      undoExpire = null; // undone (or confirmed): nothing left to expire
      clearTimeout(undoTimer);
      utoast.hidden = true;
      undoAct = null;
      utoastKind = null;
      if (fn) fn();
      return !!fn;
    }
    function utoastNo() {
      undoExpire = null;
      clearTimeout(undoTimer);
      utoast.hidden = true;
      undoAct = null;
      utoastKind = null;
    }
    // Undo the pending removal, whatever the bar shows now.
    function undoRemove() {
      if (!pendingRemove) return false;
      const p = pendingRemove;
      if (utoastKind === 'undo') utoastNo();
      keepColumn(p);
      return true;
    }

    // Removing a column: Sweeter hides it at once and waits ~9 s for an
    // Undo; only then does it press X Pro’s own delete (which X Pro commits
    // about 6 s later). Nothing reaches X Pro while Undo is on screen.
    let pendingRemove = null;
    const removing = new Set(); // keys hidden while their removal is pending
    // Only a column the deck model named, and that X Pro shows now: a
    // column matched by guesswork is never deleted.
    const removable = (m) => !!(m && m.bound && m.id && xpro.columnWrap(m.id));
    function removeColumnAsk(vid, confirmFirst) {
      const e = entryOf(vid);
      if (e && e.view) return removeView(vid);
      if (e && e.merge) return removeMerge(vid);
      if (removing.has(vid)) return toast('That column is already being removed.', 'warn');
      const m = e && e.m;
      if (!cols.has(vid) || !removable(m)) return toast('Sweeter can’t remove this column yet: X Pro hasn’t confirmed which column it is.', 'warn');
      if (refuseDelegated(m.key)) return;
      const title = titleOf(vid);
      if (confirmFirst) {
        // A new removal ends the last one’s undo window.
        if (pendingRemove) commitRemove(pendingRemove);
        return showConfirm('Remove “' + title + '” from X Pro on all your devices?', 'Remove', () => removeColumnSoft(vid));
      }
      removeColumnSoft(vid);
    }
    function removeColumnSoft(vid) {
      if (removing.has(vid)) return;
      if (pendingRemove) commitRemove(pendingRemove);
      const e = entryOf(vid);
      const m = e && e.m;
      const c = cols.get(vid);
      if (!c || !removable(m)) return;
      const deck = store.decks.activeDeck();
      const p = { vid, key: m.key, id: m.id, deckId: deck ? deck.id : null, title: titleOf(vid), focused: focusVid === vid };
      pendingRemove = p;
      // Its views go with it (they show only with their column).
      const gone = layout.filter((x) => x.vid === vid || (x.view && x.base === vid)).map((x) => x.vid);
      p.gone = gone;
      for (const g of gone) {
        removing.add(g);
        if (cols.get(g)) cols.get(g).el.classList.add('removing');
      }
      renderTabs();
      if (p.focused || gone.includes(focusVid)) {
        // Focus the neighbor on the right, or on the left for the last one.
        const i = layout.findIndex((x) => x.vid === vid);
        const ok = (x) => !removing.has(x.vid) && modeOf(x.vid) !== 'hidden';
        const next = layout.slice(i + 1).find(ok) || layout.slice(0, i).reverse().find(ok);
        setFocus(next ? next.vid : null);
      }
      showUndo('Column “' + p.title + '” removed', () => keepColumn(p), 9000, () => commitRemove(p));
    }
    function keepColumn(p) {
      if (pendingRemove === p) pendingRemove = null;
      for (const g of p.gone || [p.vid]) {
        removing.delete(g);
        const cg = cols.get(g);
        if (cg) cg.el.classList.remove('removing');
      }
      renderTabs();
      if (cols.get(p.vid) && p.focused) goCol(p.vid);
    }
    async function commitRemove(p) {
      if (pendingRemove !== p) return;
      pendingRemove = null;
      // Never while an Add is pressing X Pro’s controls.
      for (let i = 0; colOp && i < 60; i++) await new Promise((r) => setTimeout(r, 250));
      const deck = store.decks.activeDeck();
      const sameDeck = !p.deckId || (deck && deck.id === p.deckId);
      const m = mapping.find((x) => x.id === p.id);
      if (colOp || !settings.visible || passthrough || !sameDeck || !m || m.key !== p.key || !removable(m) || xpro.delegated(m)) {
        keepColumn(p);
        return toast('Column kept: X Pro’s deck changed in the meantime.', 'warn');
      }
      const hold = 'remove:' + p.id;
      holds.add(hold);
      colOp = true;
      let r;
      try {
        r = await xpro.removeColumn(p.id);
      } catch (e) {
        r = { ok: false };
      }
      colOp = false;
      if (!r.ok) {
        holds.delete(hold);
        keepColumn(p);
        return toast(r.opened ? 'X Pro didn’t delete the column, so it’s still there.' : 'X Pro didn’t remove the column. Nothing changed.', 'warn');
      }
      // X Pro commits RemoveColumn about 6 s after its own toast appears.
      // If the column is still there then (X Pro’s own Undo), it shows again.
      setTimeout(() => {
        holds.delete(hold);
        for (const g of p.gone || [p.vid]) {
          removing.delete(g);
          const cg = cols.get(g);
          if (cg) cg.el.classList.remove('removing');
        }
        if (remap(true)) for (const cc of cols.values()) renderColumn(cc, false);
        renderTabs();
      }, 7500);
    }

    // One column operation at a time; the mapping stays frozen while X Pro
    // works, then the new column is found by its id and focused.
    let colOp = false;
    async function runColumnOp(fn) {
      if (colOp) return { ok: false, reason: 'busy' };
      colOp = true;
      holds.add('add');
      let r;
      try {
        r = await fn();
      } catch (e) {
        r = { ok: false, reason: 'error' };
      }
      holds.delete('add');
      colOp = false;
      if (r && r.ok && r.id) {
        const t0 = Date.now();
        const tick = () => {
          if (remap(true)) for (const cc of cols.values()) renderColumn(cc, false);
          const m = mapping.find((x) => x.id === r.id || x.colId === r.id);
          const g = activeGroup();
          if (m && g && !g.vids.includes(m.vid)) saveGroups((settings.groups || []).map((x) => (x.id === g.id ? Object.assign({}, x, { vids: x.vids.concat([m.vid]) }) : x)));
          if (m && cols.has(m.vid)) {
            goCol(m.vid);
            const el = cols.get(m.vid).el;
            el.classList.add('flash');
            setTimeout(() => el.classList.remove('flash'), 1400);
            return;
          }
          if (Date.now() - t0 < 12000) setTimeout(tick, 700);
          else toast('X Pro added the column, but Sweeter can’t show that kind of column yet.', 'warn');
        };
        tick();
      }
      return r || { ok: false };
    }

    // `reveal`: the caller will show posts, so a collapsed column opens too.
    function goCol(vid, reveal) {
      const c = cols.get(vid);
      if (!c) return;
      if (modeOf(vid) === 'hidden' || (reveal && modeOf(vid))) return setMode(vid, null);
      setFocus(vid);
      c.el.scrollIntoView({ inline: settings.snap ? 'start' : 'nearest', block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    // ---------- Add Column sheet ----------
    let addState = null; // { step: 'menu' | 'lists' | 'search' | 'busy', pickerId, names, error }
    const ADD_FAIL = {
      busy: 'Another column change is still running. Try again in a moment.',
      nopicker: 'X Pro didn’t open its column picker. Nothing changed.',
      nobase: 'That needs its base column in view first.',
      notab: 'X Pro shows no tab for that in the base column.',
      nosearch: 'X Pro’s search field didn’t open. Nothing changed.',
      notyped: 'X Pro’s search field didn’t take the text. Nothing changed.',
      ambiguous: 'Two lists have that name, so Sweeter stopped. Pick it in X Pro (⌥X).',
      nolist: 'That list is gone from X Pro’s chooser.',
    };
    const hasCol = (key) => mapping.some((m) => m.key === key && !removing.has(m.vid));
    // By the list’s own name (a column can be renamed in X Pro).
    const hasListNamed = (n) => mapping.some((m) => {
      if (!m.key.startsWith('list:') || removing.has(m.vid)) return false;
      const own = store.listName(m.key.slice(5));
      return own ? own === n : !!(m.dom && m.dom.title === n);
    });

    function openAddSheet() {
      if (addState && addState.step === 'busy') return;
      // The list step’s placeholder column is Sweeter’s to remove.
      if (addState && addState.pickerId) xpro.removePicker(addState.pickerId);
      closePop();
      addState = { step: 'menu' };
      addBack.hidden = false;
      renderAdd();
      const first = addBody.querySelector('button:not([disabled])');
      if (first) first.focus({ preventScroll: true });
    }
    function closeAddSheet() {
      if (!addState || addState.step === 'busy') return;
      // A list chooser left open is a placeholder column Sweeter made.
      if (addState.pickerId) xpro.removePicker(addState.pickerId);
      addState = null;
      addBack.hidden = true;
      app.focus({ preventScroll: true });
    }
    function renderAdd() {
      const s = addState;
      if (!s) return;
      const row = (id, ic, title, sub, disabled, cmd) =>
        '<button type="button" class="arow" data-cmd="' + (cmd || 'add-pick') + '" data-v="' + h(id) + '"' + (disabled ? ' disabled' : '') + '>' + icon(ic) + '<span class="at"><b>' + h(title) + '</b><span>' + h(sub) + '</span></span></button>';
      let body = '';
      if (s.step === 'menu') {
        const took = 'Already a column';
        body =
          '<div class="alist">' +
          row('home', 'home', 'Home', hasCol('home') ? took : 'Following: people you follow, newest first', hasCol('home')) +
          row('foryou', 'spark', 'For you', hasCol('home-foryou') ? took : hasCol('home') ? 'X’s recommended posts' : 'Needs a Home column first', hasCol('home-foryou') || !hasCol('home')) +
          row('notifications', 'bell', 'Notifications', hasCol('notifications:all') ? took : 'Likes, reposts, follows and mentions', hasCol('notifications:all')) +
          row('mentions', 'mention', 'Mentions', hasCol('mentions') ? took : hasCol('notifications:all') ? 'Only posts that mention you' : 'Needs a Notifications column first', hasCol('mentions') || !hasCol('notifications:all')) +
          row('list', 'list', 'List…', 'One of your lists', false) +
          row('search', 'search', 'Search…', 'Words, a #hashtag, or from:someone', false) +
          row('bookmarks', 'bookmark', 'Bookmarks', hasCol('bookmarks') ? took : 'Every post you bookmarked', hasCol('bookmarks')) +
          '</div>';
      } else if (s.step === 'lists') {
        body = !s.names
          ? '<p class="anote">Opening your lists in X Pro…</p>'
          : s.names.length
            ? '<div class="alist">' + s.names.map((n) => row(n, 'list', n, hasListNamed(n) ? 'Already a column' : '', hasListNamed(n), 'add-list')).join('') + '</div>'
            : '<p class="anote">You have no lists yet. Make one on x.com, then add it here.</p>';
      } else if (s.step === 'search') {
        body = '<form class="asearch"><input id="add-q" type="search" placeholder="#buildinpublic, from:tapbots, sweeter" autocomplete="off" spellcheck="false" aria-label="Search for"><button type="submit" class="done">Add Column</button></form><p class="anote">A search column shows the newest posts first.</p>';
      } else {
        body = '<p class="anote busy">' + h(s.label || 'Adding the column in X Pro…') + '</p>';
      }
      if (s.error) body += '<p class="anote err" role="alert">' + h(s.error) + '</p>';
      addBody.innerHTML = body;
      addBack.querySelector('.aback').hidden = s.step === 'menu' || s.step === 'busy';
      addBack.querySelector('.aclose').disabled = s.step === 'busy';
    }
    async function doAdd(fn, onFail) {
      addState = { step: 'busy' };
      renderAdd();
      const r = await runColumnOp(fn);
      if (r.ok) {
        addState = null;
        addBack.hidden = true;
        return;
      }
      if (onFail) onFail(r);
      if (r.pickerId) xpro.removePicker(r.pickerId);
      addState = { step: 'menu', error: ADD_FAIL[r.reason] || 'X Pro didn’t add the column. Nothing changed.' };
      renderAdd();
    }
    async function addPick(v) {
      if (v === 'search') {
        addState = { step: 'search' };
        renderAdd();
        addBody.querySelector('#add-q').focus();
        return;
      }
      if (v === 'list') {
        addState = { step: 'lists' };
        renderAdd();
        const r = await runColumnOp(() => xpro.openListPicker());
        if (!addState || addState.step !== 'lists') {
          if (r.ok) xpro.removePicker(r.pickerId);
          return;
        }
        if (!r.ok) {
          addState = { step: 'menu', error: ADD_FAIL[r.reason] || 'X Pro didn’t open its list chooser. Nothing changed.' };
          return renderAdd();
        }
        addState.pickerId = r.pickerId;
        addState.names = r.names;
        return renderAdd();
      }
      const fn = {
        home: () => xpro.addColumn('home'),
        notifications: () => xpro.addColumn('notifications'),
        foryou: () => xpro.addFromTab(mappingFor('home'), 'For you'),
        mentions: () => xpro.addFromTab(mappingFor('notifications:all'), 'Mentions'),
        bookmarks: () => xpro.addBookmarks(),
      }[v];
      if (fn) doAdd(fn);
    }
    addBack.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (addBody.querySelector('#add-q').value || '').trim();
      if (!q) return;
      if (hasCol('search:' + q + ':Latest')) {
        addState.error = 'A search column for “' + q + '” is already in this deck.';
        return renderAdd();
      }
      doAdd(() => xpro.addSearch(q));
    });

    function toggle(show) {
      settings.visible = show == null ? !settings.visible : !!show;
      if (!settings.visible) {
        closePalette();
        closePicker(true);
      }
      applySettings();
      persist();
      if (settings.visible) {
        app.focus({ preventScroll: true });
        schedule(null);
      }
    }

    // ---------- actions (through X Pro’s own buttons) ----------

    function eachPost(fn) {
      for (const s of store.all()) {
        for (const b of s.sorted) {
          if (b.kind === 'post') {
            fn(b.post);
            if (b.post.quote) fn(b.post.quote);
          } else if (b.kind === 'thread') b.posts.forEach(fn);
          else if (b.kind === 'notification' && b.n.target) fn(b.n.target);
        }
      }
      for (const c of cols.values()) {
        if (!c.detail) continue;
        fn(c.detail.post);
        const d = store.detail(c.detail.id);
        for (const b of d ? d.blocks : []) {
          if (b.kind === 'post') {
            fn(b.post);
            if (b.post.quote) fn(b.post.quote);
          } else if (b.kind === 'thread') b.posts.forEach(fn);
        }
      }
    }

    function findPost(id) {
      let found = null;
      eachPost((p) => {
        if (!found && p && p.id === id) found = p;
      });
      return found;
    }

    // Change a post everywhere it appears, then redraw only those cells.
    function updatePost(id, fn) {
      eachPost((p) => {
        if (p && p.id === id) fn(p);
      });
      for (const c of cols.values()) {
        let hit = false;
        for (const node of c.nodes.values()) {
          if (node.querySelector('.cell[data-id="' + CSS.escape(id) + '"]') || (node.dataset && node.dataset.id === id)) {
            node.__b = null;
            hit = true;
          }
        }
        if (hit) renderColumn(c, false);
        if (c.detail) renderDetail(c, false);
      }
      for (const rec of popouts.values()) if (!rec.w.closed && rec.list.querySelector('.cell[data-id="' + CSS.escape(id) + '"]')) redrawPop(rec);
    }

    function copyText(text, done) {
      const ic = /^Link /.test(done) ? 'link' : 'check';
      if (native && native.copy) {
        native.copy(text);
        toast(done, ic);
        return;
      }
      navigator.clipboard.writeText(text).then(() => toast(done, ic), () => toast('Copy failed', 'warn'));
    }

    function swapIcon(id, act) {
      for (const b of shadow.querySelectorAll('.cell[data-id="' + CSS.escape(id) + '"] [data-act="' + act + '"]')) b.classList.add('swap');
    }

    // The X Pro column a Sweeter column acts through: its own, a view’s or
    // merge’s base, else the first X Pro column with that timeline (two of
    // the person’s own columns may share one).
    function mapOf(c) {
      const e = c && entryOf(c.vid);
      if (e && e.m) return e.m;
      const b = e && e.base && entryOf(e.base);
      if (b && b.m) return b.m;
      return c ? mappingFor(c.key) : null;
    }

    // Post actions name where they happened: a column’s view id (so each
    // of two copies acts through its own X Pro column) or a source key.
    function target(ref) {
      const col = ref ? cols.get(ref) : null;
      if (col) return { col, key: col.key, m: mapOf(col) };
      return { col: ref ? colOfSrc(ref) : null, key: ref, m: ref ? mappingFor(ref) : null };
    }

    function mappingFor(key) {
      return mapping.find((m) => m.key === key) || null;
    }

    // Where the post sits in its Sweeter column, from 0 (top) to 1 (bottom):
    // X Pro’s column holds the same timeline, so it is a good first guess.
    function hintFor(id, key) {
      const c = (key && cols.get(key)) || colOfSrc(key);
      if (!c) return null;
      const cells = cellsOf(c);
      const i = cells.findIndex((x) => x.dataset.id === id);
      return i < 0 || !cells.length ? null : i / cells.length;
    }

    const FAIL = {
      notfound: 'X Pro doesn’t have this post loaded, so nothing changed.',
      nobutton: 'X Pro shows no button for that on this post.',
      nomenu: 'X Pro’s repost menu didn’t open. Nothing changed.',
      delegated: 'That column acts as another account in X Pro, so nothing changed.',
    };

    async function doLike(id, key) {
      if (refuseDelegated(key)) return;
      const p = findPost(id);
      if (!p || p.unavailable) return;
      const want = !p.state.liked;
      const flip = (on) => (q) => {
        q.state.liked = on;
        q.counts.like = Math.max(0, q.counts.like + (on ? 1 : -1));
      };
      updatePost(id, flip(want));
      swapIcon(id, 'like');
      const r = await xpro.setLiked(id, target(key).m, want, hintFor(id, key));
      if (!r.ok) {
        updatePost(id, flip(!want));
        toast(FAIL[r.reason] || 'X Pro didn’t confirm that. Try again.', 'warn');
      }
    }

    // X Pro bookmarks only from an opened conversation, so this takes a
    // second: the icon fills at once and goes back if X Pro says no.
    async function doBookmark(id, key) {
      if (refuseDelegated(key)) return;
      const p = findPost(id);
      if (!p || p.unavailable) return;
      const want = !p.state.bookmarked;
      const flip = (on) => (q) => {
        q.state.bookmarked = on;
        q.counts.bookmark = Math.max(0, q.counts.bookmark + (on ? 1 : -1));
      };
      updatePost(id, flip(want));
      swapIcon(id, 'bookmark');
      holds.add('bookmark');
      let r;
      try {
        r = await xpro.setBookmarked(id, target(key).m, want, hintFor(id, key));
      } finally {
        setTimeout(() => holds.delete('bookmark'), 900);
      }
      if (!r.ok) {
        updatePost(id, flip(!want));
        toast(FAIL[r.reason] || 'X Pro didn’t confirm that. Try again.', 'warn');
      } else toast(want ? 'Bookmarked' : 'Bookmark removed', 'bookmark');
    }

    async function doRepost(id, key) {
      if (refuseDelegated(key)) return;
      const p = findPost(id);
      if (!p || p.unavailable) return;
      const want = !p.state.reposted;
      const flip = (on) => (q) => {
        q.state.reposted = on;
        q.counts.repost = Math.max(0, q.counts.repost + (on ? 1 : -1));
      };
      updatePost(id, flip(want));
      swapIcon(id, 'repost');
      const r = await xpro.setReposted(id, target(key).m, want, hintFor(id, key));
      if (!r.ok) {
        updatePost(id, flip(!want));
        toast(FAIL[r.reason] || 'X Pro didn’t confirm that. Try again.', 'warn');
      } else toast(want ? 'Reposted' : 'Repost removed', 'repost');
    }

    // ---------- compose ----------
    //
    // Sweeter’s own compose window. Posting opens X Pro’s composer out of
    // sight, pastes the text, checks that it arrived intact, and presses X
    // Pro’s Post (or Reply) button: one press, because the person pressed Post.

    let compose = null;
    let posting = false;
    const drafts = new Map();
    const draftKey = (c) => c.kind + ':' + (c.id || '');

    // X’s weighted length: URLs count 23; most characters outside Latin and
    // common punctuation (emoji, CJK) count 2.
    function weighted(text) {
      let n = 0;
      const rest = String(text).replace(/https?:\/\/\S+/g, () => {
        n += 23;
        return '';
      });
      for (const ch of Array.from(rest)) {
        const cp = ch.codePointAt(0);
        n += cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200d) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037) ? 1 : 2;
      }
      return n;
    }

    function updateCount() {
      const n = weighted(cmpText.value);
      cmpCount.textContent = n > 280 ? n.toLocaleString() + ' · long post' : n + ' / 280';
      cmpCount.className = 'cmp-count' + (n > 25000 ? ' over' : n > 280 ? ' long' : '');
      cmpPost.disabled = posting;
      if (cmpText.getAttribute('aria-invalid') === 'true' && (cmpText.value.trim() || (compose && compose.files.length)) && n <= 25000) {
        cmpText.removeAttribute('aria-invalid');
        cmpStatus.textContent = '';
      }
    }

    // ---------- media in the compose window ----------

    function addFiles(list) {
      if (!compose) return;
      const incoming = Array.from(list || []).filter((f) => f && f.type);
      const bad = incoming.filter((f) => !ACCEPT.includes(f.type));
      const good = incoming.filter((f) => ACCEPT.includes(f.type));
      if (bad.length) toast('X takes JPEG, PNG, WebP, GIF, MP4 or MOV.', 'warn');
      const all = compose.files.concat(good);
      const motion = all.filter((f) => /^video\//.test(f.type) || f.type === 'image/gif');
      if (motion.length > 1 || (motion.length && all.length > 1)) {
        toast('A post can have one video or GIF, or up to four photos.', 'warn');
        return;
      }
      if (all.length > 4) {
        toast('A post can have up to four photos.', 'warn');
        return;
      }
      for (const f of good) f.__url = URL.createObjectURL(f);
      compose.files = all;
      renderMedia();
      updateCount();
    }

    function renderMedia() {
      cmpMedia.innerHTML = (compose ? compose.files : [])
        .map((f, i) => {
          const preview = /^video\//.test(f.type) ? '<video src="' + h(f.__url) + '" muted playsinline></video><span class="kind">VIDEO</span>' : '<img src="' + h(f.__url) + '" alt="">' + (f.type === 'image/gif' ? '<span class="kind">GIF</span>' : '');
          return '<div class="cm">' + preview + '<button type="button" data-cmd="cmp-unfile" data-i="' + i + '" title="Remove" aria-label="Remove">' + icon('x') + '</button></div>';
        })
        .join('');
    }

    function dropFiles(files) {
      for (const f of files || []) if (f.__url) URL.revokeObjectURL(f.__url);
    }

    // ---------- bold and italic ----------
    // X has no text formatting of its own; like most X apps, Sweeter swaps in
    // Unicode’s mathematical sans-serif letters. Screen readers may spell
    // them out, so use them sparingly.
    const STYLE = {
      bold: { A: 0x1d5d4, a: 0x1d5ee, d: 0x1d7ec },
      italic: { A: 0x1d608, a: 0x1d622, d: null },
    };

    function plainChar(ch) {
      const c = ch.codePointAt(0);
      for (const m of Object.values(STYLE)) {
        if (c >= m.A && c < m.A + 26) return String.fromCharCode(65 + c - m.A);
        if (c >= m.a && c < m.a + 26) return String.fromCharCode(97 + c - m.a);
        if (m.d && c >= m.d && c < m.d + 10) return String.fromCharCode(48 + c - m.d);
      }
      return ch;
    }

    function styled(ch, style) {
      const c = ch.codePointAt(0);
      const m = STYLE[style];
      return (c >= m.A && c < m.A + 26) || (c >= m.a && c < m.a + 26) || (m.d && c >= m.d && c < m.d + 10);
    }

    function applyStyle(style) {
      const a = cmpText.selectionStart;
      const b = cmpText.selectionEnd;
      if (a === b) {
        toast('Select some text first.', 'info');
        return;
      }
      const m = STYLE[style];
      const chars = Array.from(cmpText.value.slice(a, b));
      const undo = chars.some((ch) => styled(ch, style)) && !chars.some((ch) => /[A-Za-z0-9]/.test(ch));
      const out = chars
        .map((ch) => {
          const p = plainChar(ch);
          if (undo) return p;
          const c = p.charCodeAt(0);
          if (c >= 65 && c <= 90) return String.fromCodePoint(m.A + c - 65);
          if (c >= 97 && c <= 122) return String.fromCodePoint(m.a + c - 97);
          if (m.d && c >= 48 && c <= 57) return String.fromCodePoint(m.d + c - 48);
          return p;
        })
        .join('');
      cmpText.setRangeText(out, a, b, 'select');
      cmpText.focus();
      updateCount();
    }

    function insertText(t) {
      const a = cmpText.selectionStart;
      cmpText.setRangeText(t, a, cmpText.selectionEnd, 'end');
      cmpText.focus();
      updateCount();
    }

    function contextHTML(kind, p) {
      const box = '<div class="qbox"><span class="nm">' + h(p.author.name) + '</span> <span class="hd">@' + h(p.author.handle) + '</span><div>' + (p.html || '') + '</div></div>';
      return kind === 'reply' ? '<div class="rto">Replying to <b>@' + h(p.author.handle) + '</b></div>' + box : box;
    }

    function openCompose(kind, id, key) {
      if (key && refuseDelegated(key)) return;
      closePop();
      const p = id ? findPost(id) : null;
      if (id && (!p || p.unavailable)) return;
      // A compose window already open keeps its text as a draft.
      if (compose && !cmpBack.hidden && (cmpText.value.trim() || compose.files.length)) drafts.set(draftKey(compose), { text: cmpText.value, files: compose.files, reply: cmpReply.value });
      compose = { kind, id: id || null, key: key || null, files: [] };
      cmpTitle.textContent = kind === 'reply' ? 'Reply' : kind === 'quote' ? 'Quote post' : 'New post';
      cmpPost.textContent = kind === 'reply' ? 'Reply' : 'Post';
      cmpCtx.innerHTML = p ? contextHTML(kind, p) : '';
      if (viewer && viewer.avatar) cmpAv.style.backgroundImage = 'url("' + safeUrl(viewer.avatar.replace(/_(normal|bigger|mini|x96)\./, '_200x200.')) + '")';
      cmpText.placeholder = kind === 'reply' ? 'Post your reply' : kind === 'quote' ? 'Add a comment' : 'What’s happening?';
      const draft = drafts.get(draftKey(compose)) || { text: '', files: [], reply: 'Everyone' };
      cmpText.value = draft.text;
      compose.files = draft.files.slice();
      cmpReply.value = draft.reply;
      syncWho();
      cmpReply.closest('.cmp-who').hidden = kind === 'reply';
      emoEl.hidden = true;
      renderMedia();
      cmpStatus.textContent = '';
      updateCount();
      cmpBack.hidden = false;
      cmpText.focus();
      cmpText.setSelectionRange(cmpText.value.length, cmpText.value.length);
    }

    function closeCompose(keepDraft) {
      if (compose) {
        if (keepDraft && (cmpText.value.trim() || compose.files.length)) drafts.set(draftKey(compose), { text: cmpText.value, files: compose.files, reply: cmpReply.value });
        else {
          drafts.delete(draftKey(compose));
          dropFiles(compose.files);
        }
      }
      emoEl.hidden = true;
      compose = null;
      cmpBack.hidden = true;
      app.focus({ preventScroll: true });
    }

    const COMPOSE_FAIL = {
      notfound: 'X Pro doesn’t have that post loaded. Your text is still here.',
      nobutton: 'X Pro’s compose button isn’t there. Your text is still here.',
      nomenu: 'X Pro’s quote option didn’t open. Your text is still here.',
      mismatch: 'X Pro’s composer didn’t take the text. Nothing was posted.',
      disabled: 'X Pro didn’t enable its Post button. Nothing was posted.',
      unsent: 'X Pro didn’t confirm the post. Check X Pro before trying again.',
      upload: 'X Pro didn’t finish uploading the media. Nothing was posted.',
      nofileinput: 'X Pro’s composer has no place for media here. Nothing was posted.',
      noreply: 'X Pro’s reply setting didn’t open. Nothing was posted.',
    };

    async function submitCompose() {
      if (!compose || posting) return;
      const text = cmpText.value;
      const c = compose;
      const problem = !text.trim() && !c.files.length ? 'Write something or add a photo first.' : weighted(text) > 25000 ? 'This post is over 25,000 characters.' : null;
      if (problem) {
        cmpText.setAttribute('aria-invalid', 'true');
        cmpStatus.textContent = problem;
        cmpText.focus();
        return;
      }
      posting = true;
      updateCount();
      cmpStatus.textContent = c.files.length ? 'Uploading and posting through X Pro…' : 'Posting through X Pro…';
      let r = await xpro.openComposer(c.kind, c.id, target(c.key).m, c.id ? hintFor(c.id, c.key) : null);
      if (r.ok) r = await xpro.fillAndPost(text, { files: c.files, reply: c.kind === 'reply' ? null : cmpReply.value });
      posting = false;
      if (r.ok) {
        closeCompose(false);
        toast(c.kind === 'reply' ? 'Reply sent' : 'Posted', 'compose');
        return;
      }
      if (r.reason !== 'unsent') {
        xpro.clearEditor();
        xpro.closePanel();
      }
      if (native) native.log('compose failed: ' + c.kind + ' ' + (r.reason || 'unknown'));
      if (compose === c) {
        cmpStatus.textContent = COMPOSE_FAIL[r.reason] || 'X Pro didn’t post it. Your text is still here.';
        updateCount();
      }
    }

    // “Open in X Pro”: Sweeter steps aside and shows X Pro’s own composer with
    // the text already in it, then comes back when that composer closes.
    async function handoff(kind, id, key, text, files, tool) {
      closePop();
      passthrough = true;
      closePalette();
      applySettings();
      const r = await xpro.openComposer(kind, id, target(key).m, id ? hintFor(id, key) : null);
      if (!r.ok) {
        endPassthrough();
        toast(COMPOSE_FAIL[r.reason] || 'X Pro’s composer didn’t open.', 'warn');
        return;
      }
      await xpro.prefill(text, files, tool);
      const timer = setInterval(() => {
        if (!passthrough) return clearInterval(timer);
        if (!xpro.composerOpen()) {
          clearInterval(timer);
          endPassthrough();
        }
      }, 400);
    }

    function syncWho() {
      const o = cmpReply.selectedOptions[0];
      shadow.querySelector('.who-t').textContent = o ? o.textContent : '';
    }
    cmpReply.addEventListener('change', syncWho);

    cmpText.addEventListener('input', updateCount);
    // A pasted image arrives as a file; keep it out of the text.
    cmpText.addEventListener('paste', (e) => {
      const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    });
    cmpBox.addEventListener('dragover', (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      cmpBox.classList.add('dragging');
    });
    cmpBox.addEventListener('dragleave', (e) => {
      if (!cmpBox.contains(e.relatedTarget)) cmpBox.classList.remove('dragging');
    });
    cmpBox.addEventListener('drop', (e) => {
      cmpBox.classList.remove('dragging');
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      e.stopPropagation();
      addFiles(e.dataTransfer.files);
    });
    cmpFile.addEventListener('change', () => {
      addFiles(cmpFile.files);
      cmpFile.value = '';
    });
    emoEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-emoji]');
      if (b) insertText(b.dataset.emoji);
    });

    function endPassthrough() {
      passthrough = false;
      applySettings();
      if (settings.visible) app.focus({ preventScroll: true });
    }

    function selectedPost() {
      const c = focusCol();
      const cell = c && rootOf(c).querySelector('.cell.sel[data-id]');
      return cell ? { id: cell.dataset.id, key: c.vid, cell, c } : null;
    }

    function showRepostMenu(anchor, id, key) {
      const p = findPost(id);
      if (!p) return;
      pop.innerHTML =
        '<button type="button" role="menuitem" data-cmd="pop-repost">' + icon('repost') + (p.state.reposted ? 'Undo repost' : 'Repost') + '</button>' +
        '<button type="button" role="menuitem" data-cmd="pop-quote">' + icon('quote') + 'Quote</button>';
      pop.dataset.id = id;
      pop.dataset.key = key;
      pop.dataset.kind = 'repost';
      placePop(anchor);
    }

    function closePop() {
      pop.hidden = true;
    }

    // ---------- media ----------

    function playVideo(m) {
      if (m.dataset.auto) {
        const v = m.querySelector('video');
        if (!v) return;
        if (m.dataset.auto === 'gif') {
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        } else {
          // First click on an autoplaying video: sound and controls.
          v.muted = false;
          v.controls = true;
          v.play().catch(() => {});
          m.removeAttribute('data-auto');
          if (io) io.unobserve(v);
        }
        return;
      }
      const url = m.dataset.video;
      if (!url || url === '#') {
        const cell = m.closest('[data-url]');
        return cell && openUrl(cell.dataset.url);
      }
      const v = document.createElement('video');
      v.src = url;
      v.playsInline = true;
      v.autoplay = true;
      if (m.dataset.gif) {
        v.loop = true;
        v.muted = true;
      } else v.controls = true;
      m.textContent = '';
      m.appendChild(v);
      m.removeAttribute('data-video');
    }

    // ---------- clicks ----------

    function run(cmd, el) {
      const col = el.closest('.col');
      const c = col ? cols.get(col.dataset.vid) : null;
      switch (cmd) {
        case 'settings':
          openPrefs();
          break;
        case 'close':
          closePrefs();
          break;
        case 'compose':
          openCompose('new');
          break;
        case 'pop-repost':
          closePop();
          doRepost(pop.dataset.id, pop.dataset.key);
          break;
        case 'pop-quote':
          openCompose('quote', pop.dataset.id, pop.dataset.key);
          break;
        case 'lb-close':
          closeLightbox();
          break;
        case 'lb-prev':
          stepLightbox(-1);
          break;
        case 'lb-next':
          stepLightbox(1);
          break;
        case 'back':
          closeDetail(c);
          break;
        case 'cmp-cancel':
          closeCompose(true);
          break;
        case 'cmp-post':
          submitCompose();
          break;
        case 'cmp-xpro':
        case 'cmp-gif':
        case 'cmp-poll':
        case 'cmp-schedule':
        case 'cmp-location':
        case 'cmp-grok': {
          const c = compose;
          const text = cmpText.value;
          const files = c ? c.files.slice() : [];
          const tool = cmd === 'cmp-xpro' ? null : cmd.slice(4);
          if (c) drafts.delete(draftKey(c));
          compose = null;
          cmpBack.hidden = true;
          if (c) handoff(c.kind, c.id, c.key, text, files, tool);
          break;
        }
        case 'cmp-photo':
          cmpFile.click();
          break;
        case 'cmp-emoji':
          emoEl.hidden = !emoEl.hidden;
          break;
        case 'cmp-bold':
          applyStyle('bold');
          break;
        case 'cmp-italic':
          applyStyle('italic');
          break;
        case 'cmp-unfile':
          if (compose) {
            const [f] = compose.files.splice(Number(el.dataset.i), 1);
            dropFiles([f]);
            renderMedia();
            updateCount();
          }
          break;
        case 'xpro':
          toggle(false);
          toast('X Pro. Press ⌥X to come back.', 'info');
          break;
        case 'markread':
          markAllRead(c);
          break;
        case 'jump':
          jumpToMarker(c);
          break;
        case 'col': {
          // A hidden column’s tab shows it again.
          const vid = el.dataset.vid;
          if (modeOf(vid) === 'hidden') setMode(vid, null);
          setFocus(vid);
          const cc = cols.get(vid);
          if (cc) cc.el.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
          break;
        }
        case 'mute-add':
          addMutes();
          break;
        case 'reload':
          location.reload();
          break;
        case 'edit-mutes':
          prefsTab = 'mutes';
          openPrefs();
          break;
        case 'skip': {
          const first = shown().length && cols.get(shown()[0].vid);
          const cell = first && cellsOf(first)[0];
          if (cell) selectCell(cell, true);
          app.focus({ preventScroll: true });
          break;
        }
        case 'banner-close':
          el.closest('.banner').remove();
          break;
        case 'mute-del':
          rules = rules.filter((r) => r.id !== el.dataset.id);
          mutesChanged();
          break;
        case 'filter':
          showFilterMenu(c, el);
          break;
        case 'flt-toggle':
          closePop();
          toggleFilter(cols.get(pop.dataset.vid), el.dataset.fid);
          break;
        case 'flt-clear': {
          const cc = el.closest('.pop') ? cols.get(pop.dataset.vid) : c;
          closePop();
          setFilters(cc, []);
          break;
        }
        case 'flt-prefs':
          closePop();
          openPrefsTab('filters');
          break;
        case 'flt-new':
          editing = { id: null, name: '', include: '', exclude: '', match: 'all', rules: [] };
          renderPrefs();
          pbody.querySelector('#fe-name').focus();
          break;
        case 'flt-edit': {
          const f = custom.find((x) => x.id === el.dataset.id);
          if (!f) break;
          editing = JSON.parse(JSON.stringify(f));
          renderPrefs();
          pbody.querySelector('#fe-name').focus();
          break;
        }
        case 'flt-cancel':
          editing = null;
          renderPrefs();
          break;
        case 'flt-save':
          saveFilter();
          break;
        case 'flt-del':
          custom = custom.filter((f) => f.id !== el.dataset.id);
          if (editing && editing.id === el.dataset.id) editing = null;
          filtersChanged();
          break;
        case 'find-close':
          closeFind(c);
          break;
        case 'prof-close':
          closeProfile();
          break;
        case 'prof-follow':
          profFollow(true);
          break;
        case 'prof-ask':
          if (prof) {
            prof.confirm = { kind: el.dataset.v };
            renderProfile();
          }
          break;
        case 'prof-cancel':
          if (prof) {
            prof.confirm = null;
            renderProfile();
          }
          break;
        case 'prof-do':
          profConfirmed();
          break;
        case 'prof-more':
          showProfileMenu(el);
          break;
        case 'prof-menu':
        case 'pop-run': {
          const fn = pop.__run;
          closePop();
          if (fn) fn(el.dataset.v);
          break;
        }
        case 'colmenu':
          showColumnMenu(c, el);
          break;
        case 'utoast-yes':
          utoastYes();
          break;
        case 'utoast-no':
          utoastNo();
          break;
        case 'add-close':
          closeAddSheet();
          break;
        case 'add-open':
          openAddSheet();
          break;
        case 'deckmenu':
          showDeckMenu(el);
          break;
        case 'ask-no':
          closeAsk();
          break;
        case 'lay-save':
          saveLayout();
          break;
        case 'lay-restore':
          restoreLayout(el.dataset.v);
          break;
        case 'lay-del':
          settings.layouts = (settings.layouts || []).filter((l) => l.name !== el.dataset.v);
          persist();
          renderPrefs();
          break;
        case 'lay-export':
          exportLayout();
          break;
        case 'lay-import':
          importLayout();
          break;
        case 'ov-close':
          closeOverview();
          break;
        case 'tk-open':
        case 'tk-scan':
          closePop();
          openUrl(el.dataset.v);
          break;
        case 'tk-copy':
          closePop();
          copyText(el.dataset.v, 'Address copied');
          break;
        case 'me':
          paintMe();
          if (viewer && viewer.handle) openProfile(viewer.handle);
          else toast('X Pro hasn’t shown which account is signed in yet.', 'info');
          break;
        case 'nt-no':
          closeNotify();
          break;
        case 'nt-go':
          closeNotify();
          ntWaiting = true;
          if (native && native.notifySettings) native.notifySettings();
          break;
        case 'ip-cancel':
          closePicker(false);
          break;
        case 'ip-done':
          closePicker(true);
          break;
        case 'ip-reset':
          if (ipState) {
            setOwn('colIcons', ipState.vid, '');
            setOwn('colTints', ipState.vid, '');
            paintPicker();
          }
          break;
        case 'ov-deck':
          overviewGo(el.dataset.v, null);
          break;
        case 'ov-col':
          overviewGo(el.dataset.v, el.dataset.c);
          break;
        case 'asColumn':
          conversationToColumn(c);
          break;
        case 'prof-addcol':
          addProfileColumn();
          break;
        case 'uncleared':
          clearCol(c, false);
          break;
        case 'add-back':
          if (addState && addState.pickerId) xpro.removePicker(addState.pickerId);
          addState = { step: 'menu' };
          renderAdd();
          break;
        case 'add-pick':
          addPick(el.dataset.v);
          break;
        case 'add-list': {
          const pid = addState && addState.pickerId;
          if (!pid) break;
          addState.pickerId = null;
          const name = el.dataset.v;
          doAdd(() => xpro.chooseList(pid, name), () => xpro.removePicker(pid));
          break;
        }
        case 'prof-tab':
          setProfileTab(el.dataset.tab);
          break;
        case 'prof-web':
          if (prof) openUrl('https://x.com/' + prof.handle);
          break;
        case 'accent': {
          setOne('accent', el.dataset.v);
          for (const b of pbody.querySelectorAll('.sw')) b.setAttribute('aria-checked', String(b.dataset.v === el.dataset.v));
          const nm = pbody.querySelector('.swname');
          const a = ACCENTS.find((x) => x[0] === el.dataset.v);
          if (nm && a) nm.textContent = a[1];
          break;
        }
        default:
          break;
      }
    }

    app.addEventListener('click', (e) => {
      const t = e.target;
      const cmd = t.closest('[data-cmd]');
      if (cmd) {
        run(cmd.dataset.cmd, cmd);
        return;
      }
      if (!pop.hidden && !t.closest('.pop')) closePop();
      if (t.closest('.lb')) {
        if (t.classList && t.classList.contains('lb-img')) {
          if (lb && lb.dragged) lb.dragged = false;
          else lbToggle(e);
        } else if (!t.closest('.lb-top') && !t.closest('video') && !t.closest('a')) closeLightbox();
        return;
      }
      if (t.closest('.prefs-back') && !t.closest('.prefs')) {
        closePrefs();
        return;
      }
      if (t.closest('.add-back')) {
        if (!t.closest('.addsheet')) closeAddSheet();
        return;
      }
      if (t.closest('.ask-back')) {
        if (!t.closest('.ask')) closeAsk();
        return;
      }
      if (t.closest('.ov-back')) {
        if (!t.closest('.ov')) closeOverview();
        return;
      }
      if (t.closest('.nt-back')) {
        if (!t.closest('.nt')) closeNotify();
        return;
      }
      if (t.closest('.ip-back')) {
        if (!t.closest('.ip')) closePicker(false);
        else pickInPicker(t.closest('.ipi, .ipsw'));
        return;
      }
      if (t.closest('.prof-back') && !t.closest('.prof')) {
        closeProfile();
        return;
      }
      const tab = t.closest('.ptab');
      if (tab) {
        prefsTab = tab.dataset.tab;
        renderPrefs();
        return;
      }
      if (t.closest('.cmp-back') && !t.closest('.cmp')) {
        closeCompose(true);
        return;
      }
      if (t.closest('.prefs') || t.closest('.pop') || t.closest('.cmp') || t.closest('.find')) return;
      // A collapsed column opens again on a click anywhere on it.
      const strip = t.closest('.col.collapsed');
      if (strip) {
        setMode(strip.dataset.vid, null);
        return;
      }
      // A header click: first to your last unread post (where you stopped),
      // then, on the next click, to the top.
      const head = t.closest('.ch');
      if (head && !t.closest('.ren')) {
        const hc = cols.get(head.parentElement.dataset.vid);
        setFocus(hc.vid);
        if (!hc.atMarker && unreadCount(hc) > 0 && hc.marker && hc.marker.isConnected) {
          hc.atMarker = true;
          hc.pinned = false;
          jumpToMarker(hc);
        } else {
          hc.atMarker = false;
          pinTop(hc);
        }
        return;
      }
      // A person (avatar, name, handle, @mention, a notification’s faces)
      // opens their profile sheet; ⌘-click still opens x.com.
      const who = t.closest('a.avl, a.nm, a.hd, .tx a.m, .minis a, a.who, .rtop a');
      if (who && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        const handle = who.dataset.user || handleOf(who.getAttribute('href'));
        if (handle) {
          e.preventDefault();
          const pc = who.closest('.cell[data-id]');
          const pcol = who.closest('.col');
          if (pc) selectCell(pc, false);
          openProfile(handle, { postId: pc ? pc.dataset.id : null, key: pcol ? pcol.dataset.key : null });
          return;
        }
      }
      // A contract address: the token card (⌘-click opens DexScreener).
      const ca = t.closest('a.ca, .tkc');
      if (ca && settings.tokenLookup && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        return openToken(ca);
      }
      if (ca && ca.classList.contains('tkc')) return openUrl('https://dexscreener.com/search?q=' + encodeURIComponent(ca.dataset.ca));
      if (t.closest('a[href]')) return; // links open in a new tab by themselves
      const prof = t.closest('[data-profile]');
      if (prof) return openUrl('https://x.com/' + encodeURIComponent(prof.dataset.profile));
      const act = t.closest('[data-act]');
      if (act) {
        const cell = act.closest('.cell[data-id]');
        if (!cell) return;
        const colEl = cell.closest('.col');
        const key = colEl ? colEl.dataset.vid : null;
        selectCell(cell, false);
        switch (act.dataset.act) {
          case 'like':
            doLike(cell.dataset.id, key);
            break;
          case 'bookmark':
            doBookmark(cell.dataset.id, key);
            break;
          case 'repost':
            showRepostMenu(act, cell.dataset.id, key);
            break;
          case 'reply':
            openCompose('reply', cell.dataset.id, key);
            break;
          case 'copy':
            copyText(cell.dataset.url, 'Link copied');
            break;
          case 'more-text': {
            const id = cell.dataset.id;
            const open = !expanded.has(id);
            if (open) expanded.add(id);
            else expanded.delete(id);
            const tx = act.previousElementSibling;
            if (tx) tx.classList.toggle('open', open);
            act.textContent = open ? 'Show less' : 'Show more';
            break;
          }
          default:
            openUrl(cell.dataset.url);
        }
        return;
      }
      const mediaBox = t.closest('.media');
      if (mediaBox && mediaBox.classList.contains('sensitive')) {
        mediaBox.classList.remove('sensitive');
        return;
      }
      const hostCell = t.closest('.cell[data-id]');
      const hostPost = hostCell ? findPost(hostCell.dataset.id) : null;
      const colEl = t.closest('.col');
      const hostCol = colEl ? cols.get(colEl.dataset.vid) : null;
      if (t.closest('.quote .qm') && hostPost && hostPost.quote) return openLightbox(hostPost.quote, 0);
      const ph = t.closest('[data-photo]');
      if (ph) return hostPost ? openLightbox(hostPost, Number(ph.dataset.i) || 0) : openUrl(ph.dataset.photo);
      const vd = t.closest('[data-video]');
      if (vd && hostPost && vd.dataset.i != null) return openLightbox(hostPost, Number(vd.dataset.i) || 0);
      if (vd) return playVideo(vd);
      // A quoted post opens in this column, with its replies, like Tweetbot.
      const quote = t.closest('.quote[data-url]');
      if (quote && hostPost && hostPost.quote && !hostPost.quote.unavailable) return hostCol ? openDetail(hostCol, hostPost.quote, hostPost.id) : openUrl(quote.dataset.url);
      const q = t.closest('.snip[data-url]');
      if (q) return openUrl(q.dataset.url);
      const cell = t.closest('.cell');
      if (cell) selectCell(cell, false);
      const col = t.closest('.col');
      if (col) setFocus(col.dataset.vid);
    });

    fab.addEventListener('click', () => toggle(true));

    // Mac app: right-click anything for a real macOS menu about that thing,
    // like Ivory’s press-and-hold menus: a person, a link, a hashtag, an
    // image, a video, the repost button, or else the whole post. Text fields
    // and selected text keep the system’s own menu (Copy, Look Up, spelling).
    const RESERVED = new Set(['i', 'search', 'home', 'hashtag', 'explore', 'settings', 'intent', 'share', 'notifications', 'messages']);
    function handleOf(href) {
      const m = /^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/?(?:[?#]|$)/.exec(href || '');
      return m && !RESERVED.has(m[1].toLowerCase()) ? m[1] : null;
    }

    function muteRule(token) {
      const r = Sweeter.mutes.parse(token);
      if (!r) return;
      rules = rules.concat([r]);
      mutesChanged();
      toast('Muted ' + Sweeter.mutes.label(r), 'mute');
    }

    function nativeAct(a, ok, fail) {
      if (!native || !native.act) return;
      native.act(a).then((r) => r && toast(ok), () => fail && toast(fail, 'warn'));
    }

    function userMenu(handle, c, from) {
      const url = 'https://x.com/' + handle;
      return {
        items: [
          { id: 'sheet', title: 'Show Profile', symbol: 'person.crop.rectangle' },
          { id: 'addcol', title: 'Add Column for @' + handle, symbol: 'rectangle.stack.badge.plus' },
          { id: 'profile', title: 'View @' + handle + ' on X', symbol: 'safari' },
          c ? { id: 'find', title: 'Find @' + handle + ' in This Column', symbol: 'magnifyingglass' } : null,
          { separator: true },
          { id: 'copyHandle', title: 'Copy @' + handle, symbol: 'at' },
          { id: 'copyLink', title: 'Copy Profile Link', symbol: 'link' },
          { id: 'share', title: 'Share…', symbol: 'square.and.arrow.up', share: url },
          { separator: true },
          { id: 'mute', title: 'Mute @' + handle, symbol: 'speaker.slash' },
        ],
        run: {
          sheet: () => openProfile(handle, from),
          addcol: () => addColumnFor(handle, from),
          profile: () => openUrl(url),
          find: () => openFind(c, '@' + handle),
          copyHandle: () => copyText('@' + handle, 'Handle copied'),
          copyLink: () => copyText(url, 'Link copied'),
          mute: () => muteRule('@' + handle),
        },
      };
    }

    function tagMenu(tag, href, c) {
      return {
        items: [
          { id: 'search', title: 'Search ' + tag + ' on X', symbol: 'magnifyingglass' },
          c ? { id: 'find', title: 'Find ' + tag + ' in This Column', symbol: 'text.magnifyingglass' } : null,
          { separator: true },
          { id: 'copy', title: 'Copy ' + tag, symbol: 'doc.on.doc' },
          tag.charAt(0) === '#' ? { id: 'mute', title: 'Mute ' + tag, symbol: 'speaker.slash' } : null,
        ],
        run: {
          search: () => openUrl(href),
          find: () => openFind(c, tag),
          copy: () => copyText(tag, 'Copied'),
          mute: () => muteRule(tag),
        },
      };
    }

    function linkMenu(url) {
      return {
        items: [
          { id: 'open', title: 'Open Link', symbol: 'arrow.up.right.square' },
          { separator: true },
          { id: 'copy', title: 'Copy Link', symbol: 'link' },
          { id: 'later', title: 'Add to Reading List', symbol: 'eyeglasses' },
          { id: 'share', title: 'Share…', symbol: 'square.and.arrow.up', share: url },
        ],
        run: {
          open: () => openUrl(url),
          copy: () => copyText(url, 'Link copied'),
          later: () => nativeAct({ action: 'readingList', url }, 'Added to Reading List', 'Reading List is not available'),
        },
      };
    }

    function imageMenu(p, index, url) {
      return {
        items: [
          p ? { id: 'view', title: 'View Image', symbol: 'photo' } : null,
          { separator: true },
          { id: 'copyImage', title: 'Copy Image', symbol: 'doc.on.doc' },
          { id: 'save', title: 'Save Image As…', symbol: 'square.and.arrow.down' },
          { separator: true },
          { id: 'copyUrl', title: 'Copy Image Address', symbol: 'link' },
          { id: 'open', title: 'Open Image in Browser', symbol: 'safari' },
          { id: 'share', title: 'Share Image…', symbol: 'square.and.arrow.up', share: url },
        ],
        run: {
          view: () => openLightbox(p, index),
          copyImage: () => nativeAct({ action: 'copyImage', url }, 'Image copied', 'The image did not copy'),
          save: () => nativeAct({ action: 'saveImage', url }, 'Image saved', 'The image did not save'),
          copyUrl: () => copyText(url, 'Image address copied'),
          open: () => openUrl(url),
        },
      };
    }

    function videoMenu(p, index, url) {
      return {
        items: [
          { id: 'play', title: 'Play Video', symbol: 'play.rectangle' },
          { separator: true },
          url && url !== '#' ? { id: 'copyUrl', title: 'Copy Video Address', symbol: 'link' } : null,
          { id: 'browser', title: 'Open Post in Browser', symbol: 'safari' },
        ],
        run: {
          play: () => openLightbox(p, index),
          copyUrl: () => copyText(url, 'Video address copied'),
          browser: () => openUrl(p.url),
        },
      };
    }

    function postMenu(p, key, cell, c) {
      const ref = c ? c.vid : key;
      const link = cell.querySelector('.tx a.u, .card[href]');
      const handle = p.author.handle;
      return {
        items: [
          { id: 'reply', title: 'Reply', symbol: 'arrowshape.turn.up.left' },
          { id: 'repost', title: p.state.reposted ? 'Undo Repost' : 'Repost', symbol: 'arrow.2.squarepath' },
          { id: 'quote', title: 'Quote', symbol: 'quote.bubble' },
          { id: 'like', title: p.state.liked ? 'Unlike' : 'Like', symbol: p.state.liked ? 'heart.slash' : 'heart' },
          { id: 'bookmark', title: p.state.bookmarked ? 'Remove Bookmark' : 'Bookmark', symbol: p.state.bookmarked ? 'bookmark.slash' : 'bookmark' },
          { separator: true },
          { id: 'open', title: 'Open Conversation', symbol: 'bubble.left.and.bubble.right' },
          p.media.length ? { id: 'media', title: p.media.length > 1 ? 'View Media' : p.media[0].type === 'photo' ? 'View Image' : 'Play Video', symbol: 'photo' } : null,
          link ? { id: 'link', title: 'Open Link', symbol: 'arrow.up.right.square' } : null,
          { separator: true },
          { id: 'copyLink', title: 'Copy Link to Post', symbol: 'link' },
          { id: 'copyText', title: 'Copy Post Text', symbol: 'doc.on.doc' },
          { id: 'browser', title: 'Open in Browser', symbol: 'safari' },
          { id: 'share', title: 'Share…', symbol: 'square.and.arrow.up', share: p.url },
          { separator: true },
          { id: 'profile', title: 'Show @' + handle + '’s Profile', symbol: 'person.crop.circle' },
          { id: 'addcol', title: 'Add Column for @' + handle, symbol: 'rectangle.stack.badge.plus' },
          { id: 'muteUser', title: 'Mute @' + handle, symbol: 'speaker.slash' },
          p.source ? { id: 'muteClient', title: 'Mute “' + p.source + '”', symbol: 'nosign' } : null,
        ],
        run: {
          reply: () => openCompose('reply', p.id, ref),
          repost: () => doRepost(p.id, ref),
          quote: () => openCompose('quote', p.id, ref),
          like: () => doLike(p.id, ref),
          bookmark: () => doBookmark(p.id, ref),
          open: () => openDetail(c || colOfSrc(key), p),
          media: () => openLightbox(p, 0),
          link: () => openUrl(link.getAttribute('href')),
          copyLink: () => copyText(p.url, 'Link copied'),
          copyText: () => copyText(p.plain, 'Text copied'),
          browser: () => openUrl(p.url),
          profile: () => openProfile(handle, { postId: p.id, key }),
          addcol: () => addColumnFor(handle, { postId: p.id, key }),
          muteUser: () => muteRule('@' + handle),
          muteClient: () => muteRule('via:' + p.source),
        },
      };
    }

    // No separator at either end or twice in a row.
    function tidy(items) {
      const out = [];
      for (const it0 of items) {
        if (!it0) continue;
        const it = it0.children ? Object.assign({}, it0, { children: tidy(it0.children) }) : it0;
        if (it.separator && (!out.length || out[out.length - 1].separator)) continue;
        out.push(it);
      }
      while (out.length && out[out.length - 1].separator) out.pop();
      return out;
    }

    function menuFor(t) {
      const colEl = t.closest('.col');
      const c = colEl ? cols.get(colEl.dataset.vid) : null;
      const key = colEl ? colEl.dataset.key : null;
      const ref = colEl ? colEl.dataset.vid : null;
      const cell = t.closest('.cell[data-id]');
      const p = cell ? findPost(cell.dataset.id) : null;
      if (p && p.unavailable) return null;
      const rp = t.closest('[data-act="repost"]');
      if (rp && p) {
        return {
          items: [
            { id: 'repost', title: p.state.reposted ? 'Undo Repost' : 'Repost', symbol: 'arrow.2.squarepath' },
            { id: 'quote', title: 'Quote…', symbol: 'quote.bubble' },
          ],
          run: { repost: () => doRepost(p.id, ref), quote: () => openCompose('quote', p.id, ref) },
        };
      }
      const lbImg = t.closest('.lb-media img');
      if (lbImg) return imageMenu(null, 0, lbImg.currentSrc || lbImg.src);
      const ph = t.closest('[data-photo]');
      if (ph && p) return imageMenu(p, Number(ph.dataset.i) || 0, ph.dataset.photo);
      if (t.closest('.quote .qm') && p && p.quote && p.quote.media.length && p.quote.media[0].type === 'photo') return imageMenu(p.quote, 0, p.quote.media[0].url + '?name=orig');
      const vd = t.closest('.media .m[data-video], .media .m[data-auto]');
      if (vd && p) return videoMenu(p, Number(vd.dataset.i) || 0, vd.dataset.video);
      const a = t.closest('a[href]');
      if (a) {
        const href = a.getAttribute('href');
        const handle = a.dataset.user || handleOf(href);
        if (handle) return userMenu(handle, c, { postId: cell ? cell.dataset.id : null, key });
        if (a.classList.contains('h')) return tagMenu(a.textContent, href, c);
        if (!a.classList.contains('tm') && /^https?:/.test(href)) return linkMenu(href);
      }
      if (p) return postMenu(p, key, cell, c);
      const note = t.closest('.cell[data-note]');
      if (note && note.dataset.url) {
        const url = note.dataset.url;
        return {
          items: [
            { id: 'browser', title: 'Open in Browser', symbol: 'safari' },
            { id: 'copy', title: 'Copy Link', symbol: 'link' },
          ],
          run: { browser: () => openUrl(url), copy: () => copyText(url, 'Link copied') },
        };
      }
      return null;
    }

    app.addEventListener('contextmenu', (e) => {
      const t0 = e.composedPath()[0];
      const head = t0 && t0.closest && (t0.closest('.col > .ch') || t0.closest('.tab[data-vid]') || t0.closest('.col.collapsed'));
      if (head && !t0.closest('input')) {
        e.preventDefault();
        const vid = head.dataset.vid || head.closest('.col').dataset.vid;
        return showColumnMenu(cols.get(vid), head);
      }
      if (!native || !native.menu) return;
      const t = e.composedPath()[0];
      if (!t || !t.closest) return;
      if (t.closest('textarea, input, select, .prefs, .cmp')) return;
      const sel = shadow.getSelection ? shadow.getSelection() : document.getSelection();
      if (sel && String(sel).trim()) return;
      e.preventDefault();
      const m = menuFor(t);
      if (!m) return;
      const cell = t.closest('.cell[data-id], .cell[data-note]');
      if (cell) selectCell(cell, false);
      native.menu({ items: tidy(m.items) }).then((choice) => {
        if (choice && m.run[choice]) m.run[choice]();
      });
    });
    // Double-click a post to open its conversation in the column.
    app.addEventListener('dblclick', (e) => {
      const t = e.target;
      if (t.closest('a, button, .media, .quote, .card, .prefs, .cmp, .lb')) return;
      const cell = t.closest('.cell[data-id]');
      const colEl = cell && cell.closest('.col');
      if (!cell || !colEl) return;
      const p = findPost(cell.dataset.id);
      if (p) openDetail(cols.get(colEl.dataset.vid), p);
    });

    // ---------- command palette (⇧⌘P) ----------
    // Every command Sweeter has, found by typing: the focused column’s menu
    // (the same items, so the two never differ), the columns, decks and
    // groups, layouts, and the app’s own commands.
    function paletteCommands() {
      const out = [];
      const add = (id, title, group, run, more) => out.push(Object.assign({ id, title, group, run }, more || {}));
      for (const [i, e] of shown().entries()) add('go:' + e.vid, 'Go to ' + titleOf(e.vid), 'Columns', () => goCol(e.vid, true), { keys: i < 9 ? (native ? '⌘' : '') + (i + 1) : '', icon: (settings.colIcons || {})[e.vid] || KIND_ICON[(store.get(e.key) || {}).kind] || 'home' });
      // Each column’s own menu: the focused column’s first, as written;
      // the others with “in “Name”” so “wl hide” finds Hide in WL.
      const fc = focusCol();
      const order = (fc ? [fc] : []).concat(shown().map((e) => cols.get(e.vid)).filter((x) => x && x !== fc));
      for (const col of order) {
        const m = columnMenu(col);
        const name = titleOf(col.vid);
        const tail = col === fc ? '' : ' in “' + name + '”';
        const walk = (items, prefix) => {
          for (const it of items) {
            if (!it || it.separator || it.label) continue;
            if (it.children) walk(it.children, (prefix ? prefix + ': ' : '') + it.title);
            else {
              // Removing asks first here, as ⌥⌘⌫ does.
              const run = it.id === 'remove' ? () => removeColumnAsk(col.vid, true) : () => m.run(it.id);
              const base = (prefix ? prefix + ': ' : '') + it.title.replace(/…$/, '');
              add('col:' + col.vid + ':' + it.id, base + (it.checked ? ' (on)' : '') + tail, name, run, { enabled: it.enabled !== false, danger: it.id === 'remove' || it.id.startsWith('xm:'), keywords: [name + ' ' + base] });
            }
          }
        };
        walk(m.items, '');
      }
      const { all, act } = decksNow();
      all.forEach((d, i) => {
        if (!act || d.id !== act.id) add('deck:' + d.id, 'Switch to Deck ' + (d.icon ? d.icon + ' ' : '') + (d.title || 'Untitled'), 'Decks', () => switchDeckTo(d), { keys: i < 9 ? '⌥⌘' + (i + 1) : '', keywords: ['deck'] });
      });
      add('overview', 'All Decks', 'Decks', openOverview);
      add('deck-new', 'New Deck', 'Decks', () => deckAction('new'));
      add('deck-manage', 'Manage Decks', 'Decks', () => deckAction('manage'));
      add('group:', 'Show All Columns', 'Groups', () => setGroup(''), { keys: '⌃⌘0' });
      deckGroups().forEach((g, i) => add('group:' + g.id, 'Show Group ' + g.name, 'Groups', () => setGroup(g.id), { keys: i < 9 ? '⌃⌘' + (i + 1) : '' }));
      add('group-new', 'New Group From These Columns', 'Groups', () => newGroup(shown().map((e) => e.vid)));
      add('compose', 'New Post', 'Sweeter', () => openCompose('new'), { keys: 'n', icon: 'compose' });
      add('add', 'Add Column', 'Sweeter', openAddSheet, { keys: '⌥⌘N' });
      add('unread', 'Next Unread', 'Sweeter', () => nextUnread(1), { keys: '⌘J' });
      add('clearall', 'Clear All Columns', 'Sweeter', clearAll, { keys: '⌥⌘K' });
      add('equal', 'Make All Columns Equal', 'Sweeter', equalWidths);
      for (const [v, label] of [['fill', 'Fill the Window'], ['equal', 'Equal Widths'], ['fixed', 'Fixed Width'], ['fit2', 'Fit 2'], ['fit3', 'Fit 3'], ['fit4', 'Fit 4'], ['fit5', 'Fit 5']]) add('fit:' + v, 'Column Layout: ' + label + (settings.fit === v ? ' (on)' : ''), 'Sweeter', () => (v === 'equal' ? equalWidths() : setOne('fit', v)));
      add('snap', 'Snap Columns: ' + (settings.snap ? 'Off' : 'On'), 'Sweeter', () => setOne('snap', !settings.snap));
      add('density', 'Density: ' + (settings.density === 'compact' ? 'Comfortable' : 'Compact'), 'Sweeter', () => setOne('density', settings.density === 'compact' ? 'comfortable' : 'compact'));
      for (const [v, label] of [['system', 'Match System'], ['light', 'Light'], ['dark', 'Dark'], ['winamp', 'Winamp Classic']]) add('skin:' + v, 'Theme: ' + label + (settings.skin === v ? ' (on)' : ''), 'Sweeter', () => setOne('skin', v));
      add('lay-save', 'Save Current Layout', 'Layouts', saveLayout);
      for (const l of settings.layouts || []) add('lay:' + l.name, 'Restore Layout ' + l.name, 'Layouts', () => restoreLayout(l.name));
      add('lay-export', 'Export Layout', 'Layouts', exportLayout);
      add('lay-import', 'Import Layout', 'Layouts', importLayout);
      add('prefs', 'Preferences', 'Sweeter', openPrefs, { keys: ',', icon: 'gear' });
      add('keys', 'Keyboard Shortcuts', 'Sweeter', () => openPrefsTab('keys'), { icon: 'keyboard' });
      add('mutes', 'Edit Mute Filters', 'Sweeter', () => openPrefsTab('mutes'));
      add('filters', 'Edit Filters', 'Sweeter', () => openPrefsTab('filters'));
      add('xpro', 'Show X Pro', 'Sweeter', () => toggle(false), { keys: '⌥X' });
      add('reload', 'Reload X Pro', 'Sweeter', () => location.reload());
      return out;
    }
    const palette = Sweeter.palette ? Sweeter.palette.create({ root: app, icon, commands: paletteCommands, onClose: () => {
      if (!shadow.activeElement) app.focus({ preventScroll: true });
    } }) : null;
    function closePalette() {
      if (palette && palette.isOpen()) palette.close();
    }
    function openPalette() {
      if (!palette) return;
      closePop();
      palette.open();
    }

    // ---------- pop-out windows ----------
    // A column in a window of its own. The window is a blank page Sweeter
    // writes into (never a second X Pro page); it draws the column’s posts
    // as they arrive and sends every action back to this window.
    const popouts = new Map(); // view id -> { w, c, root, list, scroll, title }
    // A reload ends the page that draws them: they close with it.
    window.addEventListener('pagehide', () => {
      for (const rec of popouts.values()) if (!rec.w.closed) rec.w.close();
    });
    async function popOut(c) {
      if (!c) return;
      const old = popouts.get(c.vid);
      if (old && !old.w.closed) return old.w.focus();
      // The Mac app opens a window only right after Sweeter asks for one.
      if (native && native.allowPopup) await native.allowPopup();
      const w = window.open('', 'sweeter-' + Math.random().toString(36).slice(2, 10), 'popup,width=440,height=860');
      if (!w) return toast('The window didn’t open. Allow pop-up windows for pro.x.com.', 'warn');
      const d = w.document;
      d.open();
      d.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sweeter</title></head><body style="margin:0"></body></html>');
      d.close();
      const st = d.createElement('style');
      st.textContent = Sweeter.css;
      d.head.appendChild(st);
      const root = d.createElement('div');
      root.className = 'app popout';
      d.body.appendChild(root);
      root.innerHTML = '<section class="col focus"><header class="ch"><span class="cic" hidden></span><span class="ct"></span><span class="cs"></span></header><div class="scroll"><div class="list"></div><div class="foot"></div></div></section>';
      const rec = { w, c, root, list: root.querySelector('.list'), scroll: root.querySelector('.scroll'), title: root.querySelector('.ct'), sub: root.querySelector('.cs'), cic: root.querySelector('.cic'), col: root.querySelector('.col') };
      popouts.set(c.vid, rec);
      root.addEventListener('click', (e) => popClick(rec, e));
      root.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('.cell[data-id]');
        const p = cell && findPost(cell.dataset.id);
        if (p && cols.get(c.vid)) {
          showMain();
          openDetail(cols.get(c.vid), p);
        }
      });
      w.addEventListener('pagehide', () => popouts.delete(c.vid));
      drawPop(rec);
    }
    // The look follows the main window (skin, accent, size, density).
    function popLook(rec) {
      for (const k of ['skin', 'round', 'names', 'media', 'links', 'actions', 'counts', 'accent', 'contrast', 'black', 'density']) {
        if (app.dataset[k] != null) rec.root.dataset[k] = app.dataset[k];
        else delete rec.root.dataset[k];
      }
      rec.root.setAttribute('style', app.getAttribute('style') || '');
    }
    // A pop-out redraws in its own window’s next frame, once per frame.
    function redrawPop(rec) {
      if (!rec || rec.pending || rec.w.closed) return;
      rec.pending = true;
      rec.w.requestAnimationFrame(() => {
        rec.pending = false;
        drawPop(rec);
      });
    }
    const redrawPopFor = (vid) => redrawPop(popouts.get(vid));

    function drawPop(rec) {
      if (rec.w.closed) return popouts.delete(rec.c.vid);
      const c = cols.get(rec.c.vid);
      if (!c) {
        rec.list.innerHTML = '';
        rec.root.querySelector('.foot').textContent = 'This column is no longer in the deck.';
        return;
      }
      rec.c = c;
      const s = store.get(c.key);
      if (!s) return;
      popLook(rec);
      rec.title.textContent = titleOf(c.vid);
      rec.sub.textContent = c.sub.textContent;
      rec.cic.hidden = c.cic.hidden;
      rec.cic.innerHTML = c.cic.innerHTML;
      if (c.el.dataset.tint) {
        rec.col.dataset.tint = c.el.dataset.tint;
        rec.col.style.setProperty('--cl', c.el.style.getPropertyValue('--cl'));
        rec.col.style.setProperty('--cd', c.el.style.getPropertyValue('--cd'));
      } else delete rec.col.dataset.tint;
      rec.col.dataset.media = colSettings(c).media;
      rec.w.document.title = titleOf(c.vid) + ' · Sweeter';
      // Keep the reader’s place: the first block on screen stays put.
      const top = rec.scroll.scrollTop <= PIN_SLOP;
      let anchor = null;
      let delta = 0;
      if (!top) {
        for (const n of rec.list.children) {
          if (n.offsetTop + n.offsetHeight > rec.scroll.scrollTop) {
            anchor = n.dataset.key;
            delta = n.offsetTop - rec.scroll.scrollTop;
            break;
          }
        }
      }
      const ctx = { settings: colSettings(c), now: Date.now(), viewer, expanded };
      // The main column’s Find is not the pop-out’s (and its Unread only
      // state is the column’s own, kept off the main column).
      const vis = visibleBlocks(s, Object.assign(Object.create(c), { findPred: null, findNote: null }));
      rec.list.innerHTML = vis.map(({ b, posts }) => R.block(b, ctx, posts || (b.kind === 'thread' ? b.posts : null))).join('');
      Array.from(rec.list.children).forEach((n, i) => {
        if (vis[i]) n.dataset.key = vis[i].b.key;
      });
      rec.root.querySelector('.foot').textContent = vis.length ? '' : 'No posts here yet.';
      if (anchor) {
        const n = Array.from(rec.list.children).find((x) => x.dataset.key === anchor);
        if (n) rec.scroll.scrollTop = n.offsetTop - delta;
      } else rec.scroll.scrollTop = 0;
      watchTickers(rec.root, true);
    }
    // The main window comes forward (the Mac app raises its window).
    function showMain() {
      if (native && native.show) native.show();
      else window.focus();
    }
    // Repost or Quote, as the main window asks (never a one-click repost).
    function popRepostMenu(rec, anchor, id) {
      const p = findPost(id);
      if (!p) return;
      const d = rec.w.document;
      let m = rec.root.querySelector('.pop');
      if (!m) {
        m = d.createElement('div');
        m.className = 'pop';
        m.setAttribute('role', 'menu');
        rec.root.appendChild(m);
      }
      m.innerHTML = '<button type="button" role="menuitem" data-pcmd="repost">' + icon('repost') + (p.state.reposted ? 'Undo repost' : 'Repost') + '</button><button type="button" role="menuitem" data-pcmd="quote">' + icon('quote') + 'Quote</button>';
      m.dataset.id = id;
      m.hidden = false;
      const r = anchor.getBoundingClientRect();
      m.style.left = Math.max(8, Math.min(rec.w.innerWidth - 180, r.left)) + 'px';
      m.style.top = Math.min(rec.w.innerHeight - 90, r.bottom + 4) + 'px';
    }
    function popClick(rec, e) {
      const t = e.target;
      const ref = rec.c.vid;
      const menu = rec.root.querySelector('.pop');
      const pc = t.closest('[data-pcmd]');
      if (menu && !menu.hidden) {
        menu.hidden = true;
        if (pc) {
          e.preventDefault();
          if (pc.dataset.pcmd === 'repost') return doRepost(menu.dataset.id, ref);
          showMain();
          return openCompose('quote', menu.dataset.id, ref);
        }
      }
      const cell = t.closest('.cell[data-id]');
      const act = t.closest('[data-act]');
      if (act && cell) {
        e.preventDefault();
        const id = cell.dataset.id;
        const a = act.dataset.act;
        if (a === 'like') return doLike(id, ref);
        if (a === 'bookmark') return doBookmark(id, ref);
        if (a === 'repost') return popRepostMenu(rec, act, id);
        if (a === 'reply') {
          showMain();
          return openCompose('reply', id, ref);
        }
        if (a === 'copy') return copyText(cell.dataset.url, 'Link copied');
        if (a === 'more-text') {
          if (expanded.has(id)) expanded.delete(id);
          else expanded.add(id);
          return drawPop(rec);
        }
        return openUrl(cell.dataset.url);
      }
      // Photos and videos open in the main window’s viewer.
      const media = t.closest('[data-photo], [data-video]');
      const p = cell && findPost(cell.dataset.id);
      if (media && p && media.dataset.i != null) {
        e.preventDefault();
        showMain();
        return openLightbox(p, Number(media.dataset.i) || 0);
      }
      // Links open in the browser by themselves (target=_blank).
    }

    // ---------- layouts ----------

    function layoutData() {
      const d = {};
      for (const k of LAYOUT_KEYS) d[k] = JSON.parse(JSON.stringify(settings[k] == null ? DEFAULTS[k] : settings[k]));
      return d;
    }
    // Only known keys, each of the type it should be.
    const str = (x) => typeof x === 'string' && x.length > 0 && x.length < 400;
    const strs = (a, min, max) => Array.isArray(a) && a.length >= min && a.length <= max && a.every(str);
    const ITEM_OK = {
      merges: (r) => r && str(r.id) && r.id.startsWith('m:') && strs(r.srcs, 2, 5) && (r.anchor == null || str(r.anchor)),
      views: (v) => v && str(v.id) && v.id.startsWith('v:') && str(v.src) && (v.col == null || str(v.col)),
      groups: (g) => g && str(g.id) && g.id.startsWith('g:') && str(g.name) && strs(g.vids, 0, 200) && (g.deck == null || str(g.deck)),
    };
    function cleanLayout(d) {
      if (!d || typeof d !== 'object') return null;
      const out = {};
      for (const k of LAYOUT_KEYS) {
        if (!(k in d)) continue;
        const want = DEFAULTS[k];
        let v = d[k];
        if (!(Array.isArray(want) ? Array.isArray(v) : typeof want === 'object' ? v && typeof v === 'object' && !Array.isArray(v) : typeof v === typeof want)) continue;
        // Each entry is checked too; one that is not whole is dropped.
        if (ITEM_OK[k]) v = v.filter(ITEM_OK[k]);
        out[k] = v;
      }
      return Object.keys(out).length ? out : null;
    }
    function applyLayout(d) {
      const before = layoutData();
      Object.assign(settings, JSON.parse(JSON.stringify(d)));
      try {
        applySettings();
        mergeCopies.clear();
        remap(true);
      } catch (e) {
        // Never keep a layout Sweeter cannot draw.
        Object.assign(settings, before);
        persist();
        applySettings();
        remap(true);
        toast('That layout can’t be used here. Nothing changed.', 'warn');
        return;
      }
      persist();
      for (const c of cols.values()) {
        buildPreds(c);
        paintFilterUI(c);
        applyWidth(c);
        applyLook(c);
        c.title.textContent = titleOf(c.vid);
        c.full = true;
        renderColumn(c, false);
      }
      renderTabs();
      reportState();
    }
    function saveLayout() {
      askText('Name this layout', '', (name) => {
        const rest = (settings.layouts || []).filter((l) => l.name !== name);
        settings.layouts = rest.concat([{ name, at: Date.now(), data: layoutData() }]);
        persist();
        if (!prefsEl.hidden) renderPrefs();
        toast('Layout “' + name + '” saved');
      });
    }
    function restoreLayout(name) {
      const l = (settings.layouts || []).find((x) => x.name === name);
      const d = l && cleanLayout(l.data);
      if (!d) return;
      const before = layoutData();
      applyLayout(d);
      showUndo('Layout “' + name + '” restored', () => applyLayout(before), 8000);
    }
    function exportLayout() {
      const text = JSON.stringify({ sweeterLayout: 1, version, exported: new Date().toISOString(), settings: layoutData() }, null, 2);
      const name = 'Sweeter layout ' + new Date().toISOString().slice(0, 10) + '.json';
      if (native && native.save) return native.save({ name, text });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = name;
      shadow.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    function importLayout() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        if (!f) return;
        f.text().then((t) => {
          let j = null;
          try {
            j = JSON.parse(t);
          } catch (e) {}
          const d = j && j.sweeterLayout === 1 ? cleanLayout(j.settings) : null;
          if (!d) return toast('That file isn’t a Sweeter layout.', 'warn');
          const before = layoutData();
          applyLayout(d);
          showUndo('Layout imported', () => applyLayout(before), 8000);
        });
      });
      input.click();
    }

    // ---------- Preferences window ----------

    let prefsTab = 'general';
    // The custom filter being edited in Preferences, or null.
    let editing = null;

    function select(key, options) {
      return '<select data-set="' + key + '" id="set-' + key + '">' + options.map(([v, label]) => '<option value="' + h(v) + '"' + (String(settings[key]) === String(v) ? ' selected' : '') + '>' + h(label) + '</option>').join('') + '</select>';
    }
    function check(key, label) {
      return '<label><input type="checkbox" id="set-' + key + '" data-set="' + key + '"' + (settings[key] ? ' checked' : '') + '>' + h(label) + '</label>';
    }
    function range(key, min, max, step, unit) {
      return '<input type="range" id="set-' + key + '" data-set="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + settings[key] + '"><span class="val" data-unit="' + unit + '">' + settings[key] + ' ' + unit + '</span>';
    }
    // With `forKey`, the left text is the control’s <label>.
    function row(label, control, note, forKey) {
      const l = forKey ? '<label class="pl" for="set-' + forKey + '">' + h(label) + '</label>' : '<div class="pl">' + h(label) + '</div>';
      return l + '<div class="pc">' + control + (note ? '<div class="note">' + h(note) + '</div>' : '') + '</div>';
    }
    function expiry(r) {
      if (!r.expires) return 'Forever';
      const d = Math.max(0, r.expires - Date.now());
      if (d < 3600e3) return Math.ceil(d / 60e3) + 'm left';
      if (d < 86400e3) return Math.ceil(d / 3600e3) + 'h left';
      return Math.ceil(d / 86400e3) + 'd left';
    }

    // Accent colors as round swatches, like macOS’s own Appearance settings.
    function swatches() {
      const cur = ACCENTS.find((a) => a[0] === settings.accent) || ACCENTS[0];
      return '<div class="swatches" role="radiogroup" aria-label="Accent color">' +
        ACCENTS.map(([id, name, light]) => '<button type="button" role="radio" class="sw' + (id === 'system' ? ' sys' : '') + '" aria-checked="' + (id === cur[0]) + '" data-cmd="accent" data-v="' + id + '" title="' + h(name) + '" aria-label="' + h(name) + '" style="--sw:' + h(light) + '"></button>').join('') +
        '<span class="swname">' + h(cur[1]) + '</span></div>';
    }

    function describe(f) {
      const parts = [];
      if (f.include) parts.push('with ' + f.include);
      if (f.exclude) parts.push('without ' + f.exclude);
      const rs = (f.rules || []).map((r) => (r.not ? 'no ' : '') + ((XF.CRITERIA.find((x) => x[0] === r.k) || [0, r.k])[1]).toLowerCase());
      if (rs.length) parts.push(rs.join(f.match === 'any' ? ' or ' : ' and '));
      return parts.join(' · ') || 'Every post';
    }

    function filterEditor(e) {
      const rule = (k) => {
        const r = e.rules.find((x) => x.k === k);
        return r ? (r.not ? 'no' : 'yes') : '';
      };
      const opt = (v, label, cur) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>';
      return '<div class="fedit" role="group" aria-label="' + (e.id ? 'Edit filter' : 'New filter') + '"><div class="pgrid">' +
        '<label class="pl" for="fe-name">Name:</label><div class="pc"><input type="text" id="fe-name" value="' + h(e.name) + '" placeholder="Links from mutuals" autocomplete="off"></div>' +
        '<label class="pl" for="fe-inc">Only posts with:</label><div class="pc"><input type="text" id="fe-inc" value="' + h(e.include) + '" placeholder="macstories.net OR sixcolors.com" autocomplete="off" spellcheck="false"><div class="note">Words, names or link domains. Separate choices with OR or commas. Empty means any post.</div></div>' +
        '<label class="pl" for="fe-exc">Hide posts with:</label><div class="pc"><input type="text" id="fe-exc" value="' + h(e.exclude) + '" placeholder="tiktok" autocomplete="off" spellcheck="false"></div>' +
        '<div class="pl">Rules:</div><div class="pc"><div class="frules">' +
        XF.CRITERIA.map(([k, label]) => '<label class="frl"><span>' + h(label) + '</span><select data-rule="' + k + '">' + opt('', 'Doesn’t matter', rule(k)) + opt('yes', 'Yes', rule(k)) + opt('no', 'No', rule(k)) + '</select></label>').join('') +
        '</div></div>' +
        '<label class="pl" for="fe-match">Match:</label><div class="pc"><select id="fe-match">' + opt('all', 'All rules', e.match) + opt('any', 'Any rule', e.match) + '</select></div>' +
        '</div><div class="fbtns"><button type="button" data-cmd="flt-cancel">Cancel</button><button class="done" type="button" data-cmd="flt-save">Save filter</button></div></div>';
    }

    const PANES = {
      general: () =>
        '<div class="pgrid">' +
        row('Theme:', select('skin', [['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark'], ['winamp', 'Winamp Classic']]), null, 'skin') +
        row('Accent color:', swatches(), 'Winamp Classic keeps its own colors.') +
        row('Contrast:', select('contrast', [['low', 'Low'], ['standard', 'Standard'], ['high', 'High']]), null, 'contrast') +
        row('Dark mode:', check('pureBlack', 'Pure black background'), 'For OLED displays and dark rooms.') +
        '<div class="sep"></div>' +
        row('Font size:', range('fontSize', 11, 21, 1, 'pt'), null, 'fontSize') +
        row('Density:', select('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']]), null, 'density') +
        row('Column width:', range('colWidth', 280, 520, 5, 'px'), null, 'colWidth') +
        row('Columns:', select('fit', [['fill', 'Fill the window'], ['equal', 'Equal widths, fill the window'], ['fixed', 'Fixed width, scroll sideways'], ['fit2', 'Fit 2 on screen'], ['fit3', 'Fit 3 on screen'], ['fit4', 'Fit 4 on screen'], ['fit5', 'Fit 5 on screen']]), 'Fit ignores widths set on single columns.', 'fit') +
        row('', check('snap', 'Snap columns into place when scrolling sideways')) +
        '<div class="sep"></div>' +
        row('Display name:', select('names', [['full', 'Full name'], ['user', 'Username'], ['both', 'Both']]), null, 'names') +
        row('Date format:', select('dateFormat', [['relative', 'Relative'], ['absolute', 'Absolute']]), null, 'dateFormat') +
        row('Reposts:', select('repostLabel', [['above', '“Name reposted” above, like X Pro'], ['below', '“Reposted by” below, like Tweetbot']]), null, 'repostLabel') +
        row('Long posts:', select('longPosts', [['collapsed', 'Fold after a few lines'], ['expanded', 'Show in full']]), 'Posts longer than 280 characters. “Show more” opens one.', 'longPosts') +
        row('Post action buttons:', select('actions', [['always', 'Show always'], ['hover', 'Show on mouseover']]), null, 'actions') +
        '<div class="sep"></div>' +
        row('Avatars:', check('round', 'Round avatars')) +
        row('Contract addresses:', check('tokenLookup', 'Show token details on click'), 'Asks DexScreener only when you click an address or ticker card. Off: they open DexScreener.', 'tokenLookup') +
        row('Ticker cards:', check('tickerPrices', 'Show prices'), 'Asks DexScreener for the prices of ticker cards on screen, every few minutes at most.', 'tickerPrices') +
        row('Checkmarks:', check('badges', 'Show verified checkmarks and organization badges')) +
        row('Counts:', check('counts', 'Show reply, repost and like counts')) +
        row('Timeline:', check('pinToTop', 'Pin timeline to top when at top'), 'Clicking a column header also jumps to the newest post and keeps it pinned.') +
        row('', check('pauseOnHover', 'Hold a pinned column still under the pointer'), 'New posts wait above; the count shows how many.') +
        row('Seen elsewhere:', select('dedupe', [['off', 'Show every post as usual'], ['dim', 'Dim posts you saw earlier in another column'], ['hide', 'Hide them']]), 'A post counts as seen after a second on screen. Two copies on screen together are never dimmed.', 'dedupe') +
        '</div>',
      media: () =>
        '<div class="pgrid">' +
        row('Images:', select('media', [['full', 'Full thumbnails'], ['cropped', 'Cropped grid'], ['small', 'Small'], ['none', 'None']]), 'Full thumbnails keep each image’s own shape, so nothing is cropped.', 'media') +
        row('Videos:', check('autoplayVideo', 'Auto-play in the timeline, muted')) +
        row('GIFs:', check('autoplayGifs', 'Auto-play and loop')) +
        row('Sensitive media:', check('obscureSensitive', 'Obscure possibly sensitive media')) +
        '<div class="sep"></div>' +
        row('Link previews:', select('cards', [['large', 'Large, full width'], ['medium', 'Medium, two-thirds width'], ['compact', 'Compact'], ['none', 'None']]), null, 'cards') +
        row('Links:', select('links', [['short', 'Short, as X shows them'], ['domain', 'Domain only'], ['full', 'Full address']]), null, 'links') +
        row('Quoted posts:', check('quoteMedia', 'Show a thumbnail of their media')) +
        '</div>',
      filters: () => {
        const quick = XF.QUICK.map((f, i) => h(f.name) + ' <kbd>⌥' + (i + 1) + '</kbd>').join(', ');
        const n0 = XF.QUICK.length;
        return '<div class="hint">A filter shows only some of a column’s loaded posts. Click the funnel in a column header, or press <kbd>⌥1</kbd> to <kbd>⌥9</kbd> for the selected column; <kbd>⌥0</kbd> turns them all off. With several on, a post must match all of them. Built in: ' + quick + '.</div>' +
          '<div class="mutes flist">' +
          (custom.length
            ? custom.map((f, i) => '<div class="mr"><span class="mk">' + h(f.name) + (n0 + i < 9 ? ' <kbd>⌥' + (n0 + i + 1) + '</kbd>' : '') + '</span><span class="me2">' + h(describe(f)) + '</span><button class="lnk" type="button" data-cmd="flt-edit" data-id="' + h(f.id) + '">Edit</button><button class="x" type="button" data-cmd="flt-del" data-id="' + h(f.id) + '" title="Delete" aria-label="Delete ' + h(f.name) + '">×</button></div>').join('')
            : '<div class="mr"><span class="me2">No custom filters yet.</span></div>') +
          '</div>' +
          (editing ? filterEditor(editing) : '<div class="fnew"><button type="button" data-cmd="flt-new">New filter…</button></div>');
      },
      mutes: () =>
        '<div class="hint">Keywords, <kbd>/regex/</kbd>, <kbd>@user</kbd>, <kbd>#hashtag</kbd> or <kbd>via:Client</kbd>. Separate several with commas. Mutes hide posts in Home, lists and searches.</div>' +
        '<div class="pgrid">' + row('Notifications:', check('muteNotes', 'Mutes hide notifications too'), 'A like, repost or follow from a muted account, or on a muted post, is hidden. Tweetbot left notifications alone.') + '</div>' +
        '<div class="mute-add"><input type="text" id="mute-in" placeholder="airdrop, /^gm\\b/i, @someone" autocomplete="off" spellcheck="false" aria-label="Words, patterns or accounts to mute">' +
        '<select id="mute-dur" aria-label="How long to mute">' + Object.keys(DURATION_LABEL).map((k) => '<option value="' + k + '"' + (k === 'forever' ? ' selected' : '') + '>' + DURATION_LABEL[k] + '</option>').join('') + '</select>' +
        '<button type="button" data-cmd="mute-add">Mute</button></div>' +
        '<div class="mutes">' +
        (rules.length
          ? rules.map((r) => '<div class="mr"><span class="mk">' + h(Sweeter.mutes.label(r)) + '</span><span class="me2">' + h(expiry(r)) + '</span><button class="x" type="button" data-cmd="mute-del" data-id="' + h(r.id) + '" title="Remove" aria-label="Remove">×</button></div>').join('')
          : '<div class="mr"><span class="me2">No mute filters yet.</span></div>') +
        '</div>',
      layouts: () => {
        const ls = settings.layouts || [];
        return '<div class="hint">A layout is Sweeter’s own arrangement: views, merged columns, groups, widths, filters, titles, icons, colors, media and the column layout. X Pro’s decks and columns stay as they are, so a layout fits the decks it was made with.</div>' +
          '<div class="mutes flist">' +
          (ls.length
            ? ls.map((l) => '<div class="mr"><span class="mk">' + h(l.name) + '</span><span class="me2">' + h(new Date(l.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })) + '</span><button class="lnk" type="button" data-cmd="lay-restore" data-v="' + h(l.name) + '">Restore</button><button class="x" type="button" data-cmd="lay-del" data-v="' + h(l.name) + '" title="Delete" aria-label="Delete ' + h(l.name) + '">×</button></div>').join('')
            : '<div class="mr"><span class="me2">No saved layouts yet.</span></div>') +
          '</div>' +
          '<div class="fnew"><button type="button" data-cmd="lay-save">Save Current Layout…</button> <button type="button" data-cmd="lay-export">Export…</button> <button type="button" data-cmd="lay-import">Import…</button></div>';
      },
      keys: () => {
        const k = [
          ['j k', 'Next, previous post'], ['l', 'Like or unlike'],
          ['t', 'Repost or quote'], ['⌥ t', 'Quote'],
          ['r', 'Reply'], ['n', 'New post'],
          ['b', 'Bookmark or remove bookmark'],
          ['⌘ Return', 'Send from the compose window'], ['Esc', 'Close compose, keep the draft'],
          ['⌘ B', 'Bold selected text'], ['⌘ I', 'Italic selected text'],
          ['o', 'Open media or link'], ['Return  →', 'Open the conversation here'],
          ['←', 'Back from a conversation'], ['← →', 'Previous, next photo in the viewer'],
          ['Tab', 'Next column'], ['1 to 9', 'Jump to a column'],
          ['Space', 'Page down'], ['⌘ ↑  ⌘ ↓', 'Top (pins), bottom'],
          ['⌘ K', 'Mark column as read'], [',', 'Preferences'],
          ['⌘ F  /', 'Find in the column'], ['⌥ 1', 'Filter 1 on or off (⌥2 to ⌥9: the others)'],
          ['⌥ 0', 'All filters off'], ['Return', 'From Find to the results'],
          ['c  n', 'Add a column (also ⌥⌘N)'], ['c  ⌫', 'Remove the column (asks first)'],
          ['c  u', 'Undo removing a column'], ['c  o', 'Column menu'],
          ['c  1', 'Column 1 (c 0: the last one)'], [']  [', 'Next, previous column'],
          ['g  h', 'Go to Home (g n, g r, g i, g b)'], ['⌘ ,', 'Settings'],
          ['⌘ J', 'Next column with unread posts (⇧⌘J: previous)'], ['⌥ ⌘ K', 'Clear every column (Sweeter only)'],
          ['⌥ ⌘ ←', 'Move the column left in X Pro (⌥⌘→: right)'], ['d  1', 'Deck 1 (d n new, d e edit, d m manage)'],
          ['⇧ ⌘ P', 'Command palette: every command, by typing'], ['⌥ ⌘ 1', 'Deck 1 (to ⌥⌘9)'], ['⌃ ⌘ 1', 'Group 1 (⌃⌘0: every column)'],
          ['Esc', 'Deselect, close'], ['⌥ X', 'Switch to X Pro'],
        ];
        return '<div class="keys">' + k.map(([keys, d]) => '<span class="k">' + keys.split(/\s{2}/).map((g) => g.split(' ').map((x) => '<kbd>' + h(x) + '</kbd>').join(' ')).join(' ') + '</span><span class="d">' + h(d) + '</span>').join('') + '</div>';
      },
    };

    function renderPrefs() {
      for (const t of shadow.querySelectorAll('.ptab')) t.setAttribute('aria-selected', String(t.dataset.tab === prefsTab));
      pbody.innerHTML = PANES[prefsTab]();
    }

    function openPrefsTab(tab) {
      prefsTab = tab;
      openPrefs();
    }

    function saveFilter() {
      if (!editing) return;
      const val = (id) => pbody.querySelector(id).value.trim();
      const rs = [];
      for (const sel of pbody.querySelectorAll('[data-rule]')) if (sel.value) rs.push({ k: sel.dataset.rule, not: sel.value === 'no' });
      const f = { id: editing.id || 'f:' + Date.now().toString(36), name: val('#fe-name') || 'Filter ' + (custom.length + 1), include: val('#fe-inc'), exclude: val('#fe-exc'), match: pbody.querySelector('#fe-match').value, rules: rs };
      if (!f.include && !f.exclude && !rs.length) return toast('Add words or a rule first.', 'info');
      custom = editing.id ? custom.map((x) => (x.id === f.id ? f : x)) : custom.concat([f]);
      editing = null;
      filtersChanged();
      toast('Saved “' + f.name + '”');
    }

    function filtersChanged() {
      save({ filters: custom });
      // A deleted filter is off everywhere.
      const known = new Set(XF.all(custom).concat(XF.NOTE_QUICK || []).map((f) => f.id));
      const next = {};
      for (const [k, v] of Object.entries(settings.colFilters || {})) next[k] = v.filter((x) => known.has(x));
      settings.colFilters = next;
      persist();
      for (const c of cols.values()) {
        buildPreds(c);
        paintFilterUI(c);
        renderColumn(c, false);
      }
      if (!prefsEl.hidden) renderPrefs();
      reportState();
    }

    function openPrefs() {
      closePop();
      renderPrefs();
      prefsEl.hidden = false;
      const first = pbody.querySelector('select, input');
      if (first) first.focus({ preventScroll: true });
    }

    function closePrefs() {
      prefsEl.hidden = true;
      app.focus({ preventScroll: true });
    }

    function setOne(key, val) {
      if (key === 'skin' || key === 'accent' || key === 'contrast' || key === 'pureBlack') {
        app.classList.add('switching');
        requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('switching')));
      }
      settings[key] = val;
      applySettings();
      persist();
      if (REBUILD.has(key)) rebuildAll();
      if (key === 'fit' || key === 'snap' || key === 'alertsMuted') reportState();
    }

    pbody.addEventListener('input', (e) => {
      const el = e.target.closest('[data-set]');
      if (!el || el.type !== 'range') return;
      setOne(el.dataset.set, Number(el.value));
      const v = el.parentElement.querySelector('.val');
      if (v) v.textContent = el.value + ' ' + v.dataset.unit;
    });
    pbody.addEventListener('change', (e) => {
      const el = e.target.closest('[data-set]');
      if (!el || el.type === 'range') return;
      setOne(el.dataset.set, el.type === 'checkbox' ? el.checked : el.value);
    });

    function addMutes() {
      const input = pbody.querySelector('#mute-in');
      const dur = pbody.querySelector('#mute-dur').value;
      const added = [];
      for (const tok of input.value.split(',')) {
        const r = Sweeter.mutes.parse(tok, dur);
        if (r) added.push(r);
      }
      if (!added.length) {
        toast('Nothing to mute. Check the pattern.', 'warn');
        return;
      }
      rules = rules.concat(added);
      mutesChanged();
      toast(added.length === 1 ? 'Muted ' + Sweeter.mutes.label(added[0]) : 'Added ' + added.length + ' mute filters', 'mute');
    }

    function mutesChanged() {
      match = Sweeter.mutes.compile(rules);
      noteMatch = Sweeter.mutes.compileNote ? Sweeter.mutes.compileNote(rules) : null;
      save({ mutes: rules });
      rebuildAll();
      if (!prefsEl.hidden) renderPrefs();
    }

    // ---------- keyboard ----------

    let chord = null;
    let chordTimer = 0;

    function handleKey(e) {
      if (palette && palette.isOpen()) return palette.handleKey(e) || e.key.length === 1;
      if (e.altKey && e.code === 'KeyX') {
        toggle();
        return true;
      }
      if (e.metaKey && e.shiftKey && e.code === 'KeyP') {
        openPalette();
        return true;
      }
      if (!settings.visible) return false;
      if (!askBack.hidden || !ovBack.hidden || !ipBack.hidden || !ntBack.hidden) {
        if (e.key === 'Escape') {
          if (!ntBack.hidden) closeNotify();
          else if (!askBack.hidden) closeAsk();
          else if (!ipBack.hidden) closePicker(false);
          else closeOverview();
          return true;
        }
        return false;
      }
      if (!addBack.hidden) {
        if (e.key === 'Escape') {
          if (addState && addState.step !== 'menu' && addState.step !== 'busy') run('add-back', addBack);
          else closeAddSheet();
          return true;
        }
        return false;
      }
      // The confirm bar: Return confirms, Esc cancels.
      if (!utoast.hidden && utoast.querySelector('[data-cmd="utoast-no"]')) {
        if (e.key === 'Escape') {
          utoastNo();
          return true;
        }
        if (e.key === 'Enter') {
          utoastYes();
          return true;
        }
      }
      if (!prefsEl.hidden) {
        if (e.key === 'Escape') {
          closePrefs();
          return true;
        }
        return false;
      }
      if (!profBack.hidden && pop.hidden && !lb) {
        if (e.key === 'Escape' || (e.metaKey && e.key.toLowerCase() === 'w')) {
          if (prof && prof.confirm) {
            prof.confirm = null;
            renderProfile();
          } else closeProfile();
          return true;
        }
        return false;
      }
      if (!pop.hidden) {
        const items = Array.from(pop.querySelectorAll('button:not([disabled])'));
        const i = items.indexOf(shadow.activeElement);
        if (e.key === 'Escape') closePop();
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
        else if (e.key === 'Enter' || e.key === ' ') (items[i] || items[0]).click();
        else if (e.key === 't' && pop.dataset.kind === 'repost') items[0].click();
        else if (e.altKey && /^Digit[0-9]$/.test(e.code) && pop.dataset.kind === 'filter') {
          closePop();
          filterByNumber(cols.get(pop.dataset.vid), Number(e.code.slice(5)), true);
        } else return false;
        return true;
      }
      if (!cmpBack.hidden) {
        if (e.key === 'Escape') {
          closeCompose(true);
          return true;
        }
        return false;
      }
      if (lb) {
        if (e.key === 'ArrowRight') stepLightbox(1);
        else if (e.key === 'ArrowLeft') stepLightbox(-1);
        else if (e.key === 'Escape' || e.key === ' ') closeLightbox();
        else if (e.key === '=' || e.key === '+') lbZoomBy(1.5);
        else if (e.key === '-') lbZoomBy(1 / 1.5);
        else if (e.key === '0') lbFitNow(true);
        else if (e.key === '1' && lb.nw) lbZoomBy(1 / lb.s);
        return true;
      }
      // Two-key chords, X Pro’s own column keys, run in Sweeter only (never
      // forwarded: X Pro’s single keys act on its own selected post).
      if (chord) {
        const pre = chord;
        chord = null;
        clearTimeout(chordTimer);
        // The hint toast goes; an outcome toast below may replace it.
        if (toastEl.textContent.startsWith(pre + ': ')) toastEl.hidden = true;
        const list = shown();
        if (pre === 'c') {
          if (e.key === 'n') openAddSheet();
          else if (e.key === 'Backspace' || e.key === 'Delete') {
            if (focusCol()) removeColumnAsk(focusVid, true);
          } else if (e.key === 'u') {
            if (!undoRemove()) toast('Nothing to undo.', 'info');
          } else if (e.key === 'o') {
            const fc = focusCol();
            if (fc) showColumnMenu(fc, fc.el.querySelector('.cmenu'));
          } else if (/^[0-9]$/.test(e.key)) {
            const m = e.key === '0' ? list[list.length - 1] : list[Number(e.key) - 1];
            if (m) goCol(m.vid);
          }
        } else if (pre === 'd') {
          if (/^[0-9]$/.test(e.key)) deckByNumber(Number(e.key));
          else if (e.key === 'n') deckAction('new');
          else if (e.key === 'e') deckAction('edit');
          else if (e.key === 'm') deckAction('manage');
        } else if (pre === 'g') {
          const want = { h: ['home'], n: ['notifications:all', 'notifications:priority', 'notifications:verified'], r: ['mentions'], b: ['bookmarks'] }[e.key];
          // Hidden columns count here: going to one shows it.
          const all = layout.filter((x) => !removing.has(x.vid));
          let m = want ? all.find((x) => want.includes(x.key)) : null;
          if (e.key === 'i') m = all.find((x) => store.get(x.key) && store.get(x.key).kind === 'list');
          if (m) goCol(m.vid);
          else toast('No such column in this deck.', 'info');
        }
        return true;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'c' || e.key === 'g' || e.key === 'd')) {
        chord = e.key;
        clearTimeout(chordTimer);
        chordTimer = setTimeout(() => (chord = null), 1200);
        toast({ c: 'c: n add · ⌫ remove · u undo · o menu · 1–9 go', g: 'g: h Home · n Notifications · r Mentions · i List · b Bookmarks', d: 'd: 1–9 deck · n new · e edit · m manage' }[e.key], 'keyboard');
        return true;
      }
      if (e.metaKey && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const fc = focusCol();
        if (fc && !fc.view) moveBy(fc, e.key === 'ArrowLeft' ? -1 : 1);
        return true;
      }
      if (e.metaKey && e.altKey && /^Digit[1-9]$/.test(e.code)) {
        deckByNumber(Number(e.code.slice(5)));
        return true;
      }
      if (e.metaKey && e.ctrlKey && /^Digit[0-9]$/.test(e.code)) {
        groupByNumber(Number(e.code.slice(5)));
        return true;
      }
      if (!e.metaKey && !e.ctrlKey && (e.key === ']' || e.key === '[')) {
        moveCol(e.key === ']' ? 1 : -1);
        return true;
      }
      if (e.metaKey && e.altKey && e.code === 'KeyN') {
        openAddSheet();
        return true;
      }
      if (e.metaKey && !e.altKey && !e.ctrlKey && e.code === 'KeyJ') {
        nextUnread(e.shiftKey ? -1 : 1);
        return true;
      }
      if (e.metaKey && e.altKey && e.code === 'KeyK') {
        clearAll();
        return true;
      }
      if (e.metaKey && e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
        if (focusCol()) removeColumnAsk(focusVid, true);
        return true;
      }
      // ⌥1 to ⌥9: the filters in menu order; ⌥0 turns them off (Ivory).
      if (e.altKey && !e.metaKey && !e.ctrlKey && /^Digit[0-9]$/.test(e.code)) {
        filterByNumber(focusCol(), Number(e.code.slice(5)), true);
        return true;
      }
      if (e.altKey && e.code === 'KeyT') {
        const sp = selectedPost();
        if (sp) openCompose('quote', sp.id, sp.key);
        return true;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.metaKey && e.key.toLowerCase() === 'k') {
          markAllRead(focusCol());
          return true;
        }
        if (e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'f') return openFind(focusCol()), true;
        if (e.metaKey && e.key === 'ArrowUp') return toEdge(false), true;
        if (e.metaKey && e.key === 'ArrowDown') return toEdge(true), true;
        return false;
      }
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          move(1);
          return true;
        case 'k':
        case 'ArrowUp':
          move(-1);
          return true;
        case 'Tab':
          moveCol(e.shiftKey ? -1 : 1);
          return true;
        case ' ':
          page(e.shiftKey ? -1 : 1);
          return true;
        case 'PageDown':
          page(1);
          return true;
        case 'PageUp':
          page(-1);
          return true;
        case 'Home':
          toEdge(false);
          return true;
        case 'End':
          toEdge(true);
          return true;
        case 'Enter':
        case 'ArrowRight': {
          // Tweetbot’s → “View Details”: the conversation, in this column.
          const sp = selectedPost();
          const p = sp && findPost(sp.id);
          if (p) openDetail(sp.c, p);
          return true;
        }
        case 'ArrowLeft':
        case 'Backspace': {
          const c = focusCol();
          if (c && c.detail) closeDetail(c);
          return true;
        }
        case 'o':
          openSelected();
          return true;
        case 'l':
        case 'f': {
          const sp = selectedPost();
          if (sp) doLike(sp.id, sp.key);
          return true;
        }
        case 't': {
          const sp = selectedPost();
          const btn = sp && sp.cell.querySelector('[data-act="repost"]');
          if (sp) showRepostMenu(btn && btn.offsetParent ? btn : sp.cell, sp.id, sp.key);
          return true;
        }
        case 'r': {
          const sp = selectedPost();
          if (sp) openCompose('reply', sp.id, sp.key);
          return true;
        }
        case 'b': {
          const sp = selectedPost();
          if (sp) doBookmark(sp.id, sp.key);
          return true;
        }
        case 'n':
          openCompose('new');
          return true;
        case '/':
          openFind(focusCol());
          return true;
        case ',':
          openPrefs();
          return true;
        case 'Escape': {
          const c = focusCol();
          if (c && c.detail) closeDetail(c);
          else if (c && c.find) closeFind(c);
          else selectCell(null);
          return true;
        }
        default:
          if (/^[1-9]$/.test(e.key) && shown()[Number(e.key) - 1]) {
            goCol(shown()[Number(e.key) - 1].vid);
            return true;
          }
          return false;
      }
    }

    // Called from a window capture listener registered at document_start,
    // so it runs before any of X Pro’s own keyboard shortcuts.
    function onWindowKey(e) {
      // Synthetic events (such as the Escape Sweeter sends to close an X Pro
      // menu) pass straight through.
      if (!e.isTrusted) return;
      if (passthrough) {
        // X Pro’s composer is open: every key belongs to it, except ⌥X.
        if (e.type === 'keydown' && e.altKey && e.code === 'KeyX') {
          e.preventDefault();
          e.stopImmediatePropagation();
          endPassthrough();
        }
        return;
      }
      const path = e.composedPath ? e.composedPath() : [];
      const inHost = path.includes(host);
      if (!settings.visible && !inHost) {
        if (e.type === 'keydown' && e.altKey && e.code === 'KeyX') {
          e.preventDefault();
          e.stopImmediatePropagation();
          toggle(true);
        }
        return;
      }
      const t = path[0];
      const typing = inHost && t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.type === 'keydown') {
        let handled = false;
        if (palette && palette.isOpen()) handled = palette.handleKey(e);
        else if (!ipBack.hidden) handled = pickerKey(e, t);
        else if (typing) {
          const findCol = t.classList && t.classList.contains('find') ? cols.get(t.closest('.col').dataset.vid) : null;
          const renCol = t.classList && t.classList.contains('ren') ? cols.get(t.closest('.col').dataset.vid) : null;
          if (renCol && (e.key === 'Enter' || e.key === 'Escape')) {
            endRename(renCol, e.key === 'Enter');
            handled = true;
          } else if (findCol && e.key === 'Escape') {
            closeFind(findCol);
            handled = true;
          } else if (findCol && (e.key === 'Enter' || e.key === 'ArrowDown')) {
            // Leave the field for the results: j and k move through them.
            app.focus({ preventScroll: true });
            const first = cellsOf(findCol)[0];
            if (first) selectCell(first, true);
            handled = true;
          } else if (findCol && e.metaKey && e.key.toLowerCase() === 'f') {
            t.select();
            handled = true;
          } else if (e.key === 'Enter' && /^fe-/.test(t.id)) {
            saveFilter();
            handled = true;
          } else if (e.key === 'Enter' && t.id === 'mute-in') {
            addMutes();
            handled = true;
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && t.id === 'cmp-text') {
            submitCompose();
            handled = true;
          } else if (e.metaKey && t.id === 'cmp-text' && (e.key === 'b' || e.key === 'i')) {
            applyStyle(e.key === 'b' ? 'bold' : 'italic');
            handled = true;
          } else if (e.key === 'Escape') handled = handleKey(e);
        } else handled = handleKey(e);
        if (handled) e.preventDefault();
      }
      // While Sweeter is showing, X Pro must not act on keys it cannot see.
      e.stopImmediatePropagation();
    }

    // ---------- timers ----------

    setInterval(() => {
      const now = Date.now();
      const stamps = Array.from(shadow.querySelectorAll('.tm[data-ts]'));
      for (const rec of popouts.values()) if (!rec.w.closed) stamps.push(...rec.root.querySelectorAll('.tm[data-ts]'));
      for (const el of stamps) {
        const ms = Number(el.dataset.ts);
        if (ms) el.textContent = R.timeLabel(ms, { settings, now });
      }
    }, 30000);
    setInterval(() => {
      if (settings.visible && remap(false)) for (const c of cols.values()) renderColumn(c, false);
      paintMe();
      checkNewAlerts();
    }, 3000);
    setInterval(paintStale, 5000);
    const bootTimer = setInterval(() => {
      if (!booting) return clearInterval(bootTimer);
      remap(false);
      checkBoot();
    }, 500);

    applySettings();
    remap(true);
    paintDeck();
    for (const c of cols.values()) renderColumn(c, true);
    if (settings.visible) app.focus({ preventScroll: true });

    if (native) app.classList.add('native');
    // Only when the app could turn off the web view’s own background does the
    // translucent AppKit sidebar show through; otherwise keep the solid one.
    if (native && native.translucent) app.classList.add('translucent');
    return {
      onWindowKey,
      toggle,
      host,
      compose() {
        if (!settings.visible) toggle(true);
        openCompose('new');
      },
      // Commands from the Mac app’s menus.
      cmd(name) {
        // The argument is everything after the first colon (a URL has more).
        const i = String(name).indexOf(':');
        const c = i < 0 ? String(name) : String(name).slice(0, i);
        const arg = i < 0 ? undefined : String(name).slice(i + 1);
        const sp = selectedPost();
        const needPost = ['reply', 'quote', 'repost', 'like', 'bookmark', 'open', 'browser', 'copyLink', 'profile'];
        if (needPost.includes(c) && !sp) return toast('Select a post first (j and k move).', 'info');
        const p = sp ? findPost(sp.id) : null;
        switch (c) {
          case 'reply':
            return openCompose('reply', sp.id, sp.key);
          case 'quote':
            return openCompose('quote', sp.id, sp.key);
          case 'repost': {
            const btn = sp.cell.querySelector('[data-act="repost"]');
            return showRepostMenu(btn && btn.offsetParent ? btn : sp.cell, sp.id, sp.key);
          }
          case 'like':
            return doLike(sp.id, sp.key);
          case 'bookmark':
            return doBookmark(sp.id, sp.key);
          case 'open':
            return p && openDetail(sp.c, p);
          case 'browser':
            return openUrl(sp.cell.dataset.url);
          case 'copyLink':
            return copyText(sp.cell.dataset.url, 'Link copied');
          case 'profile':
            return p && openProfile(p.author.handle, { postId: p.id, key: sp.c.key });
          case 'prefs':
            return arg ? openPrefsTab(arg) : openPrefs();
          case 'skin':
            return setOne('skin', arg);
          case 'bigger':
            return setOne('fontSize', Math.min(21, settings.fontSize + 1));
          case 'smaller':
            return setOne('fontSize', Math.max(11, settings.fontSize - 1));
          case 'actual':
            return setOne('fontSize', 14);
          case 'markRead':
            return markAllRead(focusCol());
          case 'top':
            return toEdge(false);
          case 'column': {
            const m = shown()[Number(arg) - 1];
            return m && goCol(m.vid);
          }
          case 'xpro':
            return toggle();
          case 'find':
            if (!cmpBack.hidden || !prefsEl.hidden) return;
            if (!settings.visible) toggle(true);
            return openFind(focusCol());
          case 'filter':
            return filterByNumber(focusCol(), Number(arg) || 0, true);
          case 'accent':
            return setOne('accent', arg);
          case 'addColumn':
            if (!settings.visible) toggle(true);
            return openAddSheet();
          case 'removeColumn':
            return focusCol() ? removeColumnAsk(focusVid, true) : toast('Select a column first.', 'info');
          case 'colWidth':
            return focusCol() && setColWidth(focusVid, Number(arg) || 0);
          case 'colMenu': {
            const fc = focusCol();
            return fc && showColumnMenu(fc, fc.el.querySelector('.cmenu'));
          }
          case 'nextUnread':
            return nextUnread(arg === 'back' ? -1 : 1);
          case 'deck':
            if (!settings.visible) toggle(true);
            return deckByNumber(Number(arg) || 0);
          case 'deckAction':
            return deckAction(arg);
          case 'group':
            return groupByNumber(Number(arg) || 0);
          case 'overview':
            if (!settings.visible) toggle(true);
            return openOverview();
          case 'palette':
            if (!settings.visible) toggle(true);
            return openPalette();
          case 'moveCol': {
            const fc = focusCol();
            return fc && !fc.view ? moveBy(fc, arg === 'left' ? -1 : 1) : toast('Select a column first.', 'info');
          }
          case 'clearAll':
            return clearAll();
          case 'fit':
            return arg === 'equal' ? equalWidths() : setOne('fit', arg);
          case 'snap':
            return setOne('snap', !settings.snap);
          case 'muteAlerts':
            setOne('alertsMuted', !settings.alertsMuted);
            if (!settings.alertsMuted) checkNotify(null, true);
            return toast(settings.alertsMuted ? 'Alerts muted' : 'Alerts on', 'bell');
          case 'openPost': {
            // A click on an alert: “<column>\n<block key>\n<url>” (the URL
            // alone from older builds). The column that alerted comes first.
            const [vid, bkey, url] = String(arg || '').split('\n').length === 3 ? String(arg).split('\n') : [null, null, arg];
            const sid = (/\/status\/(\d+)/.exec(url || '') || [])[1];
            const order = layout.filter((e) => !removing.has(e.vid)).sort((a, b) => (a.vid === vid ? -1 : b.vid === vid ? 1 : 0));
            for (const e of order) {
              const c = cols.get(e.vid);
              if (!c) continue;
              const node = (e.vid === vid && bkey && c.nodes.get(bkey)) || (sid && c.list.querySelector('.cell[data-id="' + sid + '"]'));
              if (!node) continue;
              goCol(e.vid, true);
              const cell = node.matches('.cell') ? node : node.querySelector('.cell[data-id], .cell[data-note]');
              requestAnimationFrame(() => {
                if (cell) selectCell(cell, true);
                const p = sid && findPost(sid);
                if (p && cell && cell.dataset.id === sid) openDetail(c, p);
              });
              return;
            }
            return;
          }
          default:
        }
      },
      // For the local harness only.
      debug: {
        openDetail: (key, post) => openDetail(cols.get(key) || colOfSrc(key), post), openLightbox, cols, layout: () => layout, setFilters: (key, ids) => setFilters(cols.get(key) || colOfSrc(key), ids), openFind: (key, q) => openFind(cols.get(key) || colOfSrc(key), q), menuFor: (el) => menuFor(el), setOne, key: (key, o) => handleKey(Object.assign({ key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key, altKey: false, metaKey: false, ctrlKey: false, shiftKey: false, preventDefault() {}, stopPropagation() {} }, o || {})) },
    };
  }

  Sweeter.ui = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
