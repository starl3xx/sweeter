# Sweeter Privacy Policy

Last updated: October 5, 2026

Sweeter is a Mac app and a Safari extension that gives X Pro a different interface. Starl3xx Labs LLC (“we”, “us”) makes it. Sweeter runs on your Mac, inside the X Pro page you are signed in to. We run no server for Sweeter and have no accounts, so we never see who you are.

## In short

- What you read and post on X stays between your Mac and X. Sweeter never sends it to us.
- The Mac app sends anonymous usage counts through TelemetryDeck. You can turn them off. The Safari extension, and Sweeter built from source, send none.
- A few features ask other services for public information: GitHub for updates, DexScreener for token prices, and X’s media servers for images you save.
- No ads, no tracking across apps or websites, and we never sell or share data.

## What stays on your Mac

- **Your X sign-in.** You sign in on X’s own pages. Sweeter never reads your password, cookies, or tokens, and never sends them anywhere.
- **What X Pro shows you.** Sweeter reads the timelines the X Pro page loads in your window and draws them in its own columns. That content stays in memory on your Mac.
- **Your settings.** Settings, filters, mute filters, layouts, and where you stopped reading in each column are saved on your Mac: in `~/Library/Containers/fun.starl3xx.Sweeter` for the Mac app, and in Safari’s storage for the extension. The Mac app also keeps a small log of errors there. Neither is sent anywhere.
- **Alerts, Shortcuts, and Spotlight.** Banners for new posts are made on your Mac and shown by macOS. Your column titles are offered to Shortcuts and Spotlight on your Mac.

## Usage counts (Mac app only)

The Mac app sends anonymous usage counts to [TelemetryDeck](https://telemetrydeck.com), an analytics service built for privacy. They tell us how many people use Sweeter, which features and themes they pick, and what goes wrong.

What is sent:

- **Events:** Sweeter opened, and for how long (counted by TelemetryDeck); the first open; the welcome closed (on which slide, and whether it was finished); the welcome’s Follow button pressed; tips turned off; and a warning Sweeter showed, with @handles, quoted text, and links taken out.
- **With each event:** the Sweeter version, the theme and appearance you use, and facts TelemetryDeck’s software adds: your Mac’s model and chip, the macOS version, screen size, language, region, and time zone, light or dark mode, some accessibility settings (such as Reduce Motion and Bold Text), the time of day and day of the week, how many sessions and days you have used Sweeter, and the date of your first session.
- **An anonymous ID:** a random ID made on your Mac. Only a one-way hash of it is sent, so it can’t be traced back to you. It is not linked to your X account, your name, or your email.

What is never sent: anything from X (posts, profiles, handles, or your account), and anything you type.

TelemetryDeck receives each request over the internet, as any server does. How it handles that connection data is set out in [TelemetryDeck’s privacy policy](https://telemetrydeck.com/privacy/).

**To turn it off:** Settings ▸ General ▸ Usage data. It stops at once, and nothing more is sent.

## Services Sweeter contacts for you

- **X.** Sweeter shows X Pro, so X receives what it always receives when you use X Pro, under [X’s privacy policy](https://x.com/en/privacy). When you save, share, or preview an image, Sweeter downloads it from X’s public media servers, as Safari’s Save Image does.
- **GitHub.** To check for a newer version, Sweeter asks GitHub’s public API for the latest release: once a day, and when you choose Check for Updates. GitHub receives that request under [GitHub’s privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement). We see only the overall traffic counts GitHub shows every repository owner. To turn the daily check off: Settings ▸ General ▸ Updates.
- **DexScreener.** For crypto price cards, Sweeter sends a token’s contract address to [DexScreener](https://dexscreener.com)’s public API, and loads token logos from DexScreener: when you click a contract address in a post, and for ticker cards on screen, every few minutes at most. DexScreener receives those requests as it would a visit to its website. To turn either off: Settings ▸ Extras.
- **Report a Problem.** Help ▸ Report a Problem opens a GitHub issue form in your browser, filled in with the Sweeter version, whether you use the Mac app or the Safari extension, your macOS or Safari version, X’s language, and the last warning Sweeter showed in the past hour. Nothing is sent until you submit the form, and you can change or delete any of it first. Issues on GitHub are public.
- **Links** you click open in your browser.

## Your choices

- Turn off usage counts, update checks, and price lookups in Settings at any time.
- To delete everything Sweeter saved, delete the app and the folder `~/Library/Containers/fun.starl3xx.Sweeter`, or remove the Safari extension.
- Usage counts are anonymous, so we can’t find the counts of any one person. You can still write to us with any question or request about your data, including requests under laws such as the GDPR or the CCPA.

## Children

Sweeter is for people old enough to use X under X’s terms. We don’t knowingly collect information from children, and Sweeter collects nothing that identifies anyone.

## Changes

When this policy changes, we update this page and the date at the top. If a change affects what Sweeter sends, the release notes for that version say so.

## Contact

Starl3xx Labs LLC: [hello@starl3xxlabs.co](mailto:hello@starl3xxlabs.co)
