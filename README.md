<p align="center"><img src="design/icon-1024.png" width="128" height="128" alt="Sweeter icon"></p>

<h1 align="center">Sweeter</h1>

<p align="center">A fast, keyboard-friendly, Tweetbot-inspired face for X Pro on the Mac.</p>

Sweeter draws X Pro (pro.x.com) as calm, dense columns you can read with the keyboard: unread markers that remember where you stopped, filters and mutes, merged columns, column groups, pop-out windows, a media viewer and a command palette. It comes as a Mac app, and the same thing works as a Safari extension.

It is in early testing. Things will break when X changes X Pro.

## Before you install

1. **You need X Pro.** Sweeter is a new face for pro.x.com, not a separate service. If you can’t open [pro.x.com](https://pro.x.com) with your X account (X includes X Pro with Premium+), Sweeter has nothing to show.
2. **Mac only.** macOS 14 Sonoma or later. Built and tested on macOS 26 Tahoe; earlier versions are untested.
3. **No X API.** Sweeter makes no API calls and has no API keys. It reads the timelines the X Pro page already loads in your own window, and when you like, reply or bookmark, it presses X Pro’s own button for you, once. It never sends a request of its own to X and never reads your cookies, passwords or tokens.
4. **Anonymous usage counts, nothing more.** No accounts and no servers of its own. Your settings, filters, and reading positions stay on your Mac. Besides X Pro itself, Sweeter contacts only:
   - X’s public media server, for an image you ask it to copy or save (as Safari’s Save Image does);
   - [TelemetryDeck](https://telemetrydeck.com), from the Mac app: anonymous counts of opens, of the welcome and its Follow button, of tips turned off, and of the warnings Sweeter shows (with names and links taken out), with the Sweeter version, the theme and appearance you use, and facts about the Mac such as its macOS version, model, and language. TelemetryDeck gets a hash of a random ID made on your Mac, never your name, your X account, or anything from X. Turn it off in Settings ▸ General ▸ Usage data. The Safari extension, and Sweeter built from source, send none.
   - GitHub, to check for a newer version of Sweeter: once a day (you can turn this off in Settings) and when you choose Check for Updates;
   - a page you link in a post, from the Mac app: when you type or paste a link in the compose window, Sweeter loads that page once, without cookies, to show its title and image as X’s card will. The site sees that visit. Never for links to X. Turn it off in Settings ▸ Media;
   - GIPHY’s image servers, for the GIFs X Pro’s GIF search finds when you search in the compose window (the search itself goes to X, as in X Pro);
   - [DexScreener](https://dexscreener.com)’s public API, for token prices and logos: when you click a crypto contract address, and for ticker cards ($RSR) on screen, every few minutes at most. DexScreener sees those requests like any website visit. Turn both off in Settings ▸ Extras. (In Safari, logos also need Sweeter allowed on cdn.dexscreener.com: Safari ▸ Settings ▸ Extensions ▸ Sweeter ▸ Edit Websites.)

   The [Privacy Policy](PRIVACY.md) has the details, and the [Terms of Use](TERMS.md) cover using Sweeter.

## Install

1. Download `Sweeter-x.y.z.zip` from the [latest release](https://github.com/starl3xx/sweeter/releases/latest) and unzip it.
2. Drag **Sweeter.app** into your Applications folder.
3. Open it. macOS stops it the first time, because this test build isn’t notarized by Apple. To allow it: open **System Settings ▸ Privacy & Security**, scroll down to “Sweeter was blocked”, and click **Open Anyway**. (Or, in Terminal: `xattr -dr com.apple.quarantine /Applications/Sweeter.app`.)
4. Sign in to X inside the Sweeter window. That’s it: Sweeter opens X Pro and draws over it.

**Updating:** choose **Sweeter ▸ Check for Updates…** (in Safari: the command palette, ⇧⌘P). Sweeter also checks once a day and tells you when a new version is out; until you update, a button above the gear in the sidebar opens the update window again. Download it, unzip it, and drag Sweeter to Applications, replacing the old one. Your settings and X sign-in live in macOS’s data folder for Sweeter, not inside the app, so they carry over.

### Optional: use it in Safari instead

The app includes a Safari extension that does the same thing on pro.x.com in Safari. Test builds aren’t signed by a registered developer, so Safari hides the extension unless you allow unsigned extensions:

1. Safari ▸ Settings ▸ Advanced: turn on **Show features for web developers**.
2. Safari ▸ Settings ▸ Developer: turn on **Allow unsigned extensions** (Safari asks for your password). Safari turns this off again each time it quits.
3. Safari ▸ Settings ▸ Extensions: turn on **Sweeter**, and allow it on pro.x.com.

The Sweeter app needs none of this.

## Using it

- The first time it opens, Sweeter shows a short welcome; after that, a tip when it opens (at most every few hours). Turn tips off in the tip itself or in Settings. **Help ▸ Welcome to Sweeter** shows the welcome again (in Safari: the command palette).
- **⌥X** shows or hides Sweeter over X Pro. Anything Sweeter doesn’t do yet is one key away in X Pro itself.
- **j / k** move through posts, **1–9** jump to a column, **n** writes a post, **/** finds in a column, **,** opens Settings.
- **⇧⌘P** opens the command palette: every command, found by typing.
- **The compose window** (**n**): drag it by its title to put it where you like. It grows as you write, links are underlined (in the Mac app, with a preview card), the emoji button searches every emoji, in your skin tone (Return inserts one), and the GIF button searches X Pro’s own GIFs (from GIPHY) right there. Polls, scheduling, location, and Grok images open X Pro’s own composer with your text.
- **Themes:** Classic (Tweetbot’s colors), Sweeter, Catppuccin, Nord, and Dracula, each in light and dark, in Settings ▸ General ▸ Theme. Appearance follows macOS or stays light or dark.
- Each column’s **…** menu holds its filters, width, Icon & Color, merge, groups and pop-out window.
- In the Mac app, **⌘Y** shows a post’s photos in Quick Look, an alert for a post has **Like** and **Reply** buttons, every **Share** menu is the Mac’s own, and Shortcuts and Spotlight have **New Post**, **Next Unread**, **Open Column**, and **Show Sweeter**.
- Crypto contract addresses in posts are links: click one for its price, liquidity, and market cap, and again to close it (⌘-click opens DexScreener). Tickers X tags, like $RSR, get a price card under the post.

Columns are X Pro’s own columns. When you add, remove, rename, or reorder one in Sweeter (drag a column by its title, or press ⌥⌘← and ⌥⌘→), Sweeter does it with X Pro’s own controls, so the change follows you to every device. A search column takes X’s search syntax (`from:`, `url:`, `-filter:replies`, and more), and Add a column ▸ Search lists the common operators: click one to add it. Edit Search…, in a search column’s … menu, changes its query in the same sheet. Sweeter’s own touches (colors, icons, filters, merged columns, groups) stay on this Mac.

## Report a problem

In the Mac app choose **Help ▸ Report a Problem…**; in Safari open the command palette (⇧⌘P) and choose **Report a Problem…**, or use the link at the bottom of Settings. It opens a [GitHub issue](https://github.com/starl3xx/sweeter/issues/new?template=bug_report.yml) already filled in with Sweeter’s version, your macOS or Safari version, X’s language and the last error Sweeter showed. Nothing else is included, and nothing is sent until you submit it. Issues are public, so leave out anything private.

## Build from source

Needs Xcode 26 or later and Node.js.

```sh
node tests/run.js            # the tests
scripts/build-safari.sh      # builds and installs /Applications/Sweeter.app
```

Without a Team ID the build is signed ad hoc. To sign with your own Apple Development certificate, put `SWEETER_TEAM=<your Team ID>` in `scripts/local.env` (git ignores it). `scripts/release.sh` makes the downloadable zip.

How it works: `extension/src/page/recorder.js` listens to the responses X Pro’s page receives (it never sends anything); `extension/src/lib` turns them into timelines; `extension/src/ui` draws Sweeter; `extension/src/content/xpro.js` presses X Pro’s buttons. `safari/Sweeter` is the Mac app, which runs the same scripts in its own web view.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md). Free to use, change, and share for any noncommercial purpose. Selling Sweeter or a version of it is not allowed.

Sweeter is independent. It is not made, endorsed, or sponsored by X Corp., and it is not affiliated with X, X Pro, or TweetDeck. X, X Pro, and TweetDeck are trademarks of X Corp.; Tweetbot is a trademark of Tapbots. See the [Terms of Use](TERMS.md) and the [Privacy Policy](PRIVACY.md).
