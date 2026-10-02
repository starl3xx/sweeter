const D = globalThis.Sweeter.decks;
const createStore = globalThis.Sweeter.createStore;

// The ViewerAccountSync shape verified live on 2026-09-30 (ids made up).
function sync(columns, extra) {
  return {
    data: {
      viewer_v2: Object.assign(
        {
          accountsync_client_config: { active_deck_id: '900', default_column_width: 'Narrow' },
          decks: [{ rest_id: '900', config: { icon: '⭐️', is_pinned: true, title: 'Personal' }, deck_columns_v2: columns }],
        },
        extra || {},
      ),
    },
  };
}
const col = (id, pathname, more) => Object.assign({ rest_id: id, pathname, width: 'Medium', media_preview: 'Small', latest: true, show_drawer: false, drawer_selected_tab: 'Options' }, more || {});

test('column routes map to Sweeter’s source keys', () => {
  const k = (p) => D.keyFor({ pathname: p });
  eq(k('/home?mode=home_latest'), 'home');
  eq(k('/home?mode=home'), 'home-foryou');
  eq(k('/home'), 'home-foryou'); // no mode is For you
  eq(k('/notifications'), 'notifications:all');
  eq(k('/notifications/mentions'), 'mentions');
  eq(k('/i/lists/1000000000000000001'), 'list:1000000000000000001');
  eq(k('/search?q=%23buildinpublic&f=live'), 'search:#buildinpublic:Latest');
  eq(k('/search?q=sweeter'), 'search:sweeter:Top');
  // Each URL filter is its own SearchTimeline product.
  eq(k('/search?q=x&f=media'), 'search:x:Media');
  eq(k('/search?q=x&f=user'), 'search:x:People');
  eq(k('/search?q=x&src=advanced_search_page&f=live&urtUrl='), 'search:x:Latest');
  eq(k('/jack'), null); // a profile, before X Pro has said who it is
  eq(D.keyFor({ pathname: '/Jack?urtUrl=' }, null, (h) => (h.toLowerCase() === 'jack' ? '12' : null)), 'user:12');
  eq(k('/nadiabuilds/status/2104599248595714999?urtUrl='), 'conv:2104599248595714999');
  eq(k('/i/bookmarks/all'), 'bookmarks');
  eq(k('/explore'), 'x:explore');
  eq(k('/i/grok'), 'x:grok');
  eq(k('/compose/post/unsent/drafts'), 'x:drafts');
  eq(k('/settings'), null);
  eq(k('/i/bookmarks'), 'bookmarks');
  eq(k('/i/columns/picker'), null);
  eq(D.keyFor({ pathname: '/notifications/priority' }, (x) => x === 'notifications:verified'), 'notifications:verified');
});

test('the sync gives decks, columns and the active deck', () => {
  const s = createStore();
  const seen = [];
  s.subscribe((k) => seen.push(k));
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('1', '/notifications'), col('2', '/i/lists/7', { hide_header: true, show_tweets_after: 'DAAB' }), col('3', '/home?mode=home_latest')]) });
  const d = s.decks.activeDeck();
  eq([d.title, d.icon, d.pinned], ['Personal', '⭐️', true]);
  eq(d.columns.map((c) => c.id), ['1', '2', '3']);
  eq([s.decks.column('2').cleared, s.decks.column('2').width, s.decks.column('1').cleared], [true, 'medium', false]);
  eq(seen, ['decks']);
  eq(s.all().length, 0, 'deck traffic makes no timeline source');
});

test('X Pro’s own column writes update the model between syncs', () => {
  const s = createStore();
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('1', '/notifications'), col('2', '/i/lists/7'), col('3', '/home?mode=home_latest')]) });
  s.ingest({ op: 'UpdateColumn', vars: { columnId: '3', deckId: '900', pathname: '/home?mode=home', width: 'Wide', showDrawer: true }, body: { data: {} } });
  eq([s.decks.column('3').pathname, s.decks.column('3').width, s.decks.column('3').showDrawer], ['/home?mode=home', 'wide', true]);
  s.ingest({ op: 'ReorderColumns', vars: { deckId: '900', columnOrder: ['3', '1', '2'] }, body: { data: {} } });
  eq(s.decks.activeDeck().columns.map((c) => c.id), ['3', '1', '2']);
  s.ingest({ op: 'RemoveColumn', vars: { deckId: '900', columnId: '1' }, body: { data: {} } });
  eq(s.decks.activeDeck().columns.map((c) => c.id), ['3', '2']);
  s.ingest({ op: 'CreateColumn', vars: { deckId: '900', pathname: '/i/columns/picker', width: 'Narrow' }, body: { data: { deck_column_create: { rest_id: '44' } } } });
  eq(s.decks.column('44').pathname, '/i/columns/picker');
  // A write X refused changed nothing.
  s.ingest({ op: 'RemoveColumn', vars: { deckId: '900', columnId: '2' }, body: { errors: [{ message: 'nope' }] } });
  ok(s.decks.column('2'), 'still there');
});

test('a saved model stands in until the first sync, never after it', () => {
  const s = createStore();
  s.decks.load({ active: '900', decks: [{ id: '900', title: 'Personal', icon: '⭐️', pinned: true, columns: [{ id: '1', pathname: '/notifications' }] }] });
  eq(s.decks.activeDeck().columns.length, 1);
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('5', '/home?mode=home_latest')]) });
  s.decks.load({ active: '900', decks: [{ id: '900', columns: [] }] });
  eq(s.decks.activeDeck().columns.map((c) => c.id), ['5']);
  eq(JSON.parse(JSON.stringify(s.decks.snapshot())).decks[0].columns[0].id, '5');
});

test('a deck made in X Pro is known at once and starts empty', () => {
  const s = createStore();
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('1', '/notifications')]) });
  s.ingest({ op: 'CreateDeck', vars: { title: 'Test' }, body: { data: { deck_create: { rest_id: '901' } } } });
  s.ingest({ op: 'UpdateClientSettings', vars: { activeDeckId: '901' }, body: { data: {} } });
  eq([s.decks.activeDeck().id, s.decks.activeDeck().title, s.decks.activeDeck().columns.length], ['901', 'Test', 0]);
  // The same id twice (a retry, or the next sync first) adds nothing.
  eq(s.decks.ingest({ op: 'CreateDeck', vars: {}, body: { data: { deck_create: { rest_id: '901' } } } }), false);
});

test('writes apply in the order X Pro sent them, not the order they came back', () => {
  const s = createStore();
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('1', '/i/columns/picker?urtUrl=')]), seq: 1 });
  // Sent: /home (2), then /home?mode=home_latest (3). Returned: 3, then 2.
  s.ingest({ op: 'UpdateColumn', vars: { columnId: '1', pathname: '/home?mode=home_latest' }, body: { data: {} }, seq: 3 });
  s.ingest({ op: 'UpdateColumn', vars: { columnId: '1', pathname: '/home' }, body: { data: {} }, seq: 2 });
  eq(s.decks.column('1').pathname, '/home?mode=home_latest');
  // A sync sent before that write, returning after it, is out of date.
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('1', '/home')]), seq: 2 });
  eq(s.decks.column('1').pathname, '/home?mode=home_latest');
  // Messages without numbers (a saved model, older builds) still apply.
  s.ingest({ op: 'UpdateColumn', vars: { columnId: '1', pathname: '/notifications' }, body: { data: {} } });
  eq(s.decks.column('1').pathname, '/notifications');
});

test('each column keeps its creator, and a saved model names its account', () => {
  const s = createStore();
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('1', '/home?mode=home_latest', { creator: 'SweeterDev' }), col('2', '/notifications')]) });
  eq([s.decks.column('1').creator, s.decks.column('2').creator], ['sweeterdev', null]);
  s.decks.setViewer('SweeterDev');
  eq(s.decks.snapshot().viewer, 'sweeterdev');
  const t = createStore();
  t.decks.load(s.decks.snapshot());
  eq(t.decks.viewer(), 'sweeterdev');
});

test('X Pro’s full column write unsets what it leaves out', () => {
  const s = createStore();
  s.ingest({ op: 'ViewerAccountSync', vars: {}, body: sync([col('1', '/home?mode=home_latest', { title: 'Mine', show_tweets_after: 'DAAB' })]) });
  eq([s.decks.column('1').title, s.decks.column('1').cleared], ['Mine', true]);
  // “Show latest posts”: the whole column again, without showTweetsAfter
  // or a title. The clear is gone; the title stays (X’s server keeps it).
  s.ingest({ op: 'UpdateColumn', vars: { columnId: '1', deckId: '900', pathname: '/home?mode=home_latest', width: 'Narrow', showDrawer: true }, body: { data: {} } });
  eq([s.decks.column('1').title, s.decks.column('1').cleared], ['Mine', false]);
  // A partial write leaves the rest alone.
  s.ingest({ op: 'UpdateColumn', vars: { columnId: '1', showTweetsAfter: 'X' }, body: { data: {} } });
  eq([s.decks.column('1').cleared, s.decks.column('1').pathname], [true, '/home?mode=home_latest']);
});
