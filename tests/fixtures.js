// Synthetic X responses built on the shapes captured from live X Pro on
// 2026-09-28. Accounts and text are fictional.

let seq = 0;
const BASE = 2104599248595714273n; // a real-looking Snowflake from late Sept 2026

function id(offsetSeconds) {
  return String(BASE + BigInt(Math.round((offsetSeconds || 0) * 1000)) * 4194304n + BigInt(++seq));
}

function user(handle, name, extra) {
  return Object.assign(
    {
      __typename: 'User',
      rest_id: String(1000 + handle.length),
      core: { created_at: 'Mon Jan 01 00:00:00 +0000 2018', name: name || handle, screen_name: handle },
      avatar: { image_url: 'https://pbs.twimg.com/profile_images/1/' + handle + '_normal.jpg' },
      is_blue_verified: false,
      verification: { verified: false },
      privacy: { protected: false },
      relationship_perspectives: { following: true },
    },
    extra || {},
  );
}

function tweet(opts) {
  const o = opts || {};
  const tid = o.id || id(o.at || 0);
  const r = {
    __typename: 'Tweet',
    rest_id: tid,
    source: '<a href="https://mobile.twitter.com" rel="nofollow">' + (o.source || 'X Web App') + '</a>',
    core: { user_results: { result: o.user || user('nadiabuilds', 'Nadia Okafor') } },
    views: { count: '1234', state: 'EnabledWithCount' },
    legacy: {
      full_text: o.text || 'Hello from Sweeter.',
      display_text_range: o.range || [0, Array.from(o.text || 'Hello from Sweeter.').length],
      entities: Object.assign({ hashtags: [], symbols: [], urls: [], user_mentions: [] }, o.entities || {}),
      favorite_count: 3,
      retweet_count: 1,
      reply_count: 0,
      quote_count: 0,
      bookmark_count: 0,
      favorited: !!o.liked,
      retweeted: false,
      bookmarked: false,
      id_str: tid,
      conversation_id_str: tid,
      lang: 'en',
      created_at: 'Sun Sep 28 12:00:00 +0000 2026',
    },
  };
  if (o.media) r.legacy.extended_entities = { media: o.media };
  if (o.retweetOf) r.legacy.retweeted_status_result = { result: o.retweetOf };
  if (o.quote) {
    r.quoted_status_result = { result: o.quote };
    r.legacy.is_quote_status = true;
    r.legacy.quoted_status_permalink = { url: 'https://t.co/quote123', expanded: 'https://x.com/q/status/1', display: 'x.com/q/status/1' };
  }
  if (o.note) r.note_tweet = { note_tweet_results: { result: { id: 'n1', text: o.note.text, entity_set: o.note.entities || {} } } };
  if (o.card) r.card = { legacy: { name: o.card.name, url: o.card.url, binding_values: o.card.values } };
  if (o.visibility) return { __typename: 'TweetWithVisibilityResults', tweet: r };
  return r;
}

// One extended_entities media item: 'photo', 'video' or 'animated_gif'.
function media(type) {
  const t = type || 'photo';
  const m = { type: t, media_url_https: 'https://pbs.twimg.com/media/' + t + '.jpg', original_info: { width: 10, height: 10 } };
  if (t !== 'photo') m.video_info = { duration_millis: t === 'video' ? 5000 : 0, variants: [{ content_type: 'video/mp4', bitrate: 832000, url: 'https://video.twimg.com/' + t + '.mp4' }] };
  return m;
}

function tweetEntry(result, sortIndex) {
  return {
    entryId: 'tweet-' + (result.rest_id || result.tweet.rest_id),
    sortIndex: sortIndex,
    content: {
      entryType: 'TimelineTimelineItem',
      __typename: 'TimelineTimelineItem',
      itemContent: { __typename: 'TimelineTweet', itemType: 'TimelineTweet', tweetDisplayType: 'Tweet', tweet_results: { result } },
    },
  };
}

function cursor(type, value, sortIndex) {
  return {
    entryId: 'cursor-' + type.toLowerCase() + '-' + sortIndex,
    sortIndex,
    content: { entryType: 'TimelineTimelineCursor', __typename: 'TimelineTimelineCursor', cursorType: type, value },
  };
}

function home(entries, extra) {
  return { data: { home: { home_timeline_urt: { instructions: [{ type: 'TimelineAddEntries', entries }].concat(extra || []) } } } };
}

function list(entries) {
  return { data: { list: { tweets_timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries }] } } } } };
}

function notifications(entries, unreadAbove) {
  return {
    data: {
      viewer_v2: {
        user_results: {
          result: {
            notification_timeline: {
              timeline: {
                instructions: [
                  { type: 'TimelineClearCache' },
                  { type: 'TimelineAddEntries', entries },
                  { type: 'TimelineClearEntriesUnreadState' },
                  { type: 'TimelineMarkEntriesUnreadGreaterThanSortIndex', sort_index: unreadAbove },
                ],
              },
            },
          },
        },
      },
    },
  };
}

function notificationEntry(icon, text, users, sortIndex, target) {
  // Mirrors the live shape: ranges are code points into rich_message.text.
  const entities = [];
  let at = 0;
  for (const u of users) {
    const i = Array.from(text).join('').indexOf(u.core.name, at);
    if (i < 0) continue;
    const from = Array.from(text.slice(0, i)).length;
    entities.push({ fromIndex: from, toIndex: from + Array.from(u.core.name).length, ref: { type: 'TimelineRichTextUser', user_results: { result: u } } });
    at = i + u.core.name.length;
  }
  return {
    entryId: 'notification-' + sortIndex,
    sortIndex,
    content: {
      entryType: 'TimelineTimelineItem',
      itemContent: {
        __typename: 'TimelineNotification',
        itemType: 'TimelineNotification',
        id: 'n' + sortIndex,
        notification_icon: icon,
        rich_message: { rtl: false, text, entities },
        template: {
          __typename: 'TimelineNotificationAggregateUserActions',
          from_users: users.map((u) => ({ __typename: 'TimelineNotificationUserRef', user_results: { result: u } })),
          target_objects: target ? [{ __typename: 'TimelineNotificationTweetRef', tweet_results: { result: target } }] : [],
        },
        timestamp_ms: new Date(Number(sortIndex)).toISOString(), // live data sends an ISO string
        notification_url: { url: 'https://x.com/i/notifications', urlType: 'ExternalUrl' },
      },
    },
  };
}

function conversation(results, sortIndex) {
  return {
    entryId: 'home-conversation-' + sortIndex,
    sortIndex,
    content: {
      entryType: 'TimelineTimelineModule',
      __typename: 'TimelineTimelineModule',
      displayType: 'VerticalConversation',
      items: results.map((r) => ({ entryId: 'tweet-' + r.rest_id, item: { itemContent: { itemType: 'TimelineTweet', tweet_results: { result: r } } } })),
      metadata: { conversationMetadata: { allTweetIds: results.map((r) => r.rest_id), enableDeduplication: true } },
    },
  };
}

module.exports = { id, user, tweet, media, tweetEntry, cursor, home, list, notifications, notificationEntry, conversation };
