// The welcome (first open) and the tip that shows when Sweeter opens. The
// words and the rules for when they show live here, without a DOM, so node
// tests can reach them; app.js draws them.
//
// In a tip or a slide, {…} is a key (drawn as <kbd>). `where` limits an
// item to the Mac app ('app') or to Safari ('safari'). `act` is a button
// that does what the tip describes: [label, command for app.js].
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  // Who makes Sweeter: the first slide credits them, with a Follow button.
  const DEVELOPER = 'starl3xx';

  const SLIDES = [
    {
      id: 'hello',
      mark: true,
      by: true,
      title: 'Welcome to Sweeter',
      text: 'Your X Pro decks as calm, dense columns you can read with the keyboard. Anything you can do in X Pro, you can do from Sweeter, and X Pro itself is always one key away.',
      keys: [['{⌥X}', 'Switch between Sweeter and X Pro']],
    },
    {
      id: 'read',
      icon: 'keyboard',
      title: 'Read with the keyboard',
      text: 'Sweeter remembers where you stopped in every column, even after you quit.',
      keys: [
        ['{j} {k}', 'Next, previous post'],
        ['{Space}', 'Page down'],
        ['{1} to {9}', 'Jump to a column'],
        ['{⌘J}', 'Next column with unread posts'],
        ['{⌘K}', 'Mark the column as read'],
      ],
    },
    {
      id: 'act',
      icon: 'compose',
      title: 'Act on a post',
      text: 'Select a post with j and k, then press a key.',
      keys: [
        ['{l}', 'Like or unlike'],
        ['{t}', 'Repost or quote'],
        ['{r}', 'Reply'],
        ['{b}', 'Bookmark'],
        ['{o}', 'Open media or link'],
        ['{n}', 'New post'],
      ],
    },
    {
      id: 'columns',
      icon: 'decks',
      title: 'Make the columns yours',
      text: 'Each column’s … menu holds its filters, width, icon and color, merging, groups, and a window of its own. Adding, removing, and moving columns goes through X Pro, so it follows you to every device.',
      keys: [
        ['{⌥1} to {⌥9}', 'Turn a filter on or off'],
        ['{/}', 'Find in the column'],
        ['{c} then {n}', 'Add a column'],
        ['{⌃⌘1}', 'Show a group of columns'],
      ],
    },
    {
      id: 'more',
      icon: 'sparkle',
      title: 'Everything else, by typing',
      text: 'Themes, accent colors, density, media, mutes, and every shortcut are in Settings.',
      keys: [
        ['{⇧⌘P}', 'Command palette: every command'],
        ['{,}', 'Settings'],
        ['{⌃⌥⌘X}', 'Show or hide Sweeter from any app', 'app'],
      ],
    },
  ];

  // Shown in this order, one each time Sweeter opens; the most useful first.
  const TIPS = [
    { id: 'palette', text: 'Press {⇧⌘P} for the command palette: every command in Sweeter, found by typing a few letters.', act: ['Open the Palette', 'palette'] },
    { id: 'unread', text: '{⌘J} jumps to the next column with unread posts, and {⇧⌘J} goes back.', act: ['Try It', 'nextUnread'] },
    { id: 'header', text: 'Click a column’s header to jump to where you stopped reading. Click it again for the newest post, and the column stays pinned there.' },
    { id: 'find', text: 'Press {/} or {⌘F} to find in a column. {Return} moves from Find to the results.', act: ['Find in Column', 'find'] },
    { id: 'quickFilters', text: '{⌥1} to {⌥9} turn the selected column’s filters on and off, and {⌥0} turns them all off.' },
    { id: 'conversation', text: '{Return} or {→} opens a conversation right in the column, and {←} goes back.' },
    { id: 'mutes', text: 'Mute words, /patterns/, @accounts, #hashtags, or via:Client for a day, a week, a month, or forever.', act: ['Open Mutes', 'prefs:mutes'] },
    { id: 'hotkeys', where: 'app', text: '{⌃⌥⌘X} shows or hides Sweeter from any app, and {⌃⌥⌘N} starts a new post.' },
    { id: 'groups', text: 'Groups show a few columns at a time. Make one from a column’s … menu ▸ Groups, then switch with {⌃⌘1} to {⌃⌘9}. {⌃⌘0} shows every column.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'customFilters', text: 'Make your own filters from words, link domains, and rules such as media, replies, or people you follow.', act: ['Open Filters', 'prefs:filters'] },
    { id: 'merge', text: 'Merge up to five columns into one: a column’s … menu ▸ Merge With.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'quote', text: '{t} asks whether to repost or quote, and {⌥T} goes straight to a quote.' },
    { id: 'alerts', where: 'app', text: 'Get a banner, or a banner and a sound, for new posts in a column: its … menu ▸ Alerts.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'seen', text: 'Seeing the same post in two columns? Settings ▸ General ▸ Seen elsewhere can dim or hide the second copy.', act: ['Open Settings', 'prefs:general'] },
    { id: 'layouts', text: 'Save Sweeter’s whole arrangement as a layout, and export it to another Mac: Settings ▸ Layouts.', act: ['Open Layouts', 'prefs:layouts'] },
    { id: 'compose', text: 'In the compose window, {⌘B} and {⌘I} make selected text bold or italic, and {⌘Return} posts.' },
    { id: 'goKeys', text: '{g} then {h} goes to Home. {g} then {n}, {r}, {i}, or {b} goes to Notifications, Mentions, a list, or Bookmarks.' },
    { id: 'hover', text: 'A pinned column holds still under the pointer, and new posts wait above it.' },
    { id: 'popout', text: 'Give a column a window of its own: its … menu ▸ Open in New Window.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'tokens', text: 'Click a crypto contract address in a post for its price, liquidity, and market cap. ⌘-click opens DexScreener instead.', act: ['Open Extras', 'prefs:extras'] },
    { id: 'dock', where: 'app', text: 'The Dock icon’s menu lists your columns with their unread counts.' },
    { id: 'density', text: 'Compact density fits more posts on screen: Settings ▸ General ▸ Density.', act: ['Open Settings', 'prefs:general'] },
    { id: 'columnKeys', text: '{c} then {n} adds a column, {c} then {⌫} removes the selected one (it asks first), and {c} then {u} brings it back.' },
    { id: 'iconColor', text: 'Give a column its own icon and color: its … menu ▸ Icon & Color.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'decks', text: '{⌥⌘1} to {⌥⌘9} switch X Pro decks, and {d} then {n} makes a new deck.' },
    { id: 'top', text: '{⌘↑} goes to the newest post and pins the column there. {⌘↓} goes to the oldest loaded post.' },
    { id: 'mediaGrid', text: 'A column can show its media as a grid: its … menu ▸ Show as Media Grid.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'draft', text: '{Esc} closes the compose window and keeps the draft.' },
    { id: 'pasteMedia', text: 'Paste or drop photos and videos straight into the compose window.' },
    { id: 'views', text: 'Duplicate as View, in a column’s … menu, shows the same timeline twice, each copy with its own filters.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'moveKeys', text: '{]} and {[} move between columns, and {Space} pages down.' },
    { id: 'theme', text: 'Try the Sweeter, Catppuccin, Nord, or Dracula theme, each in light and dark: Settings ▸ General ▸ Theme.', act: ['Open Settings', 'prefs:general'] },
    { id: 'clearAll', text: '{⌥⌘K} clears every column in Sweeter. X Pro keeps its posts.' },
    { id: 'login', where: 'app', text: 'To start Sweeter when you log in, choose Open at Login from the bird in the menu bar.' },
    { id: 'moveColumn', text: '{⌥⌘←} and {⌥⌘→} move the selected column in X Pro, on all your devices.' },
    { id: 'viewer', text: '{o} opens a post’s media. In the viewer, {←} and {→} move between photos.' },
    { id: 'fit', text: 'Fit two to five columns on screen, whatever the window’s size: Settings ▸ General ▸ Columns.', act: ['Open Settings', 'prefs:general'] },
    { id: 'pureBlack', text: 'For OLED displays and dark rooms: Settings ▸ General ▸ Pure black background.', act: ['Open Settings', 'prefs:general'] },
    { id: 'width', text: 'Set one column’s width from its … menu ▸ Width.', act: ['Open Column Menu', 'colMenu'] },
    { id: 'reposts', text: 'Prefer Tweetbot’s “Reposted by” line under the post? Settings ▸ General ▸ Reposts.', act: ['Open Settings', 'prefs:general'] },
    { id: 'links', text: 'Links can show as X shows them, as the domain only, or in full: Settings ▸ Media ▸ Links.', act: ['Open Settings', 'prefs:media'] },
    { id: 'muteNotes', text: 'Mutes can hide notifications too, such as a like from a muted account: Settings ▸ Filters & Mutes.', act: ['Open Mutes', 'prefs:mutes'] },
    { id: 'report', where: 'app', text: 'Something broken? Help ▸ Report a Problem… opens a GitHub issue with the details filled in.', act: ['Report a Problem', 'report'] },
    { id: 'reportSafari', where: 'safari', text: 'Something broken? Report a Problem…, in the command palette, opens a GitHub issue with the details filled in.', act: ['Report a Problem', 'report'] },
  ];

  // A tip shows when Sweeter opens, but at most this often: a reload or a
  // quick restart shows none.
  const TIP_GAP = 6 * 3600e3;

  const fits = (x, app) => !x.where || x.where === (app ? 'app' : 'safari');

  function slides(app) {
    return SLIDES.map((s) => Object.assign({}, s, { keys: (s.keys || []).filter((k) => !k[2] || k[2] === (app ? 'app' : 'safari')) }));
  }

  function tipsFor(app) {
    return TIPS.filter((t) => fits(t, app));
  }

  // The tip after the last one shown, by id (so new tips can be added
  // anywhere); the first again after the last, or when that one is gone.
  function nextTip(list, lastId) {
    const i = list.findIndex((t) => t.id === lastId);
    return list[(i + 1) % list.length];
  }

  // What the saved settings say about the welcome: 'new' (nothing saved: a
  // first open), 'again' (a first open whose welcome never closed), 'old'
  // (an install from before the welcome existed: no welcome), or '' (seen).
  function welcomeState(saved) {
    if (saved && saved.welcomed) return '';
    if (!saved || !Object.keys(saved).length) return 'new';
    return saved.firstOpenAt ? 'again' : 'old';
  }

  function tipDue(settings, now) {
    return settings.tips !== false && !!settings.welcomed && now - (settings.tipAt || 0) >= TIP_GAP;
  }

  // Text with {keys} as HTML: everything escaped, each key a <kbd>.
  function markup(text) {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    return String(text).split(/(\{[^{}]+\})/).map((part) => (/^\{[^{}]+\}$/.test(part) ? '<kbd>' + esc(part.slice(1, -1)) + '</kbd>' : esc(part))).join('');
  }

  Sweeter.tips = { DEVELOPER, SLIDES, TIPS, TIP_GAP, slides, tipsFor, nextTip, welcomeState, tipDue, markup };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sweeter.tips;
})(typeof globalThis !== 'undefined' ? globalThis : this);
