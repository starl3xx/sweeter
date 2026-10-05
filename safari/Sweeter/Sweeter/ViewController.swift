//
//  ViewController.swift
//  Sweeter
//
//  Hosts pro.x.com in a web view and injects the same Sweeter code the Safari
//  extension ships (read from the embedded extension’s own resources), so the
//  app and the extension never drift apart. X Pro keeps the login and fetches
//  the data; Sweeter draws on top of it.
//

import AppIntents
import Cocoa
import QuickLookUI
import SwiftUI
import UniformTypeIdentifiers
import UserNotifications
import WebKit

let extensionBundleIdentifier = "fun.starl3xx.Sweeter.Extension"
let xProURL = URL(string: "https://pro.x.com/")!

extension Notification.Name {
    static let sweeterCounts = Notification.Name("SweeterCounts")
    static let sweeterState = Notification.Name("SweeterState")
}

class ViewController: NSViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply, NSWindowDelegate {

    @IBOutlet var webView: WKWebView!

    static weak var shared: ViewController?

    /// Sweeter’s scripts run in their own world, like a Safari content script.
    let world = WKContentWorld.world(name: "Sweeter")
    let storage = NativeStorage()
    private var cover: LaunchCover?
    /// Whether the page can let the translucent sidebar show through.
    private var translucentSidebar = false
    /// Last state the page reported (theme, font size, column titles), for menus.
    private(set) var pageState: [String: Any] = [:]
    /// Sweeter is drawn in the page and takes commands (App Intents wait for it).
    private(set) var mounted = false
    let quickLook = QuickLookPhotos()
    /// The Share submenus' pickers, alive until the next context menu.
    private var sharePickers: [NSSharingServicePicker] = []

    /// Runs `body` once Sweeter is drawn and takes commands (after a launch
    /// or a reload, that can take a few seconds); after 20 s the window
    /// comes forward instead, so the reader sees why nothing happened.
    func whenMounted(_ body: @escaping () -> Void) {
        if mounted { return body() }
        var tries = 0
        Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] timer in
            tries += 1
            guard let self else { return timer.invalidate() }
            if self.mounted {
                timer.invalidate()
                body()
            } else if tries >= 80 {
                timer.invalidate()
                self.showWindow()
            }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        ViewController.shared = self
        // The template storyboard gives the web view a fixed frame; pin it to
        // every edge so it follows the window.
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        // No title bar: the page runs to the top edge and the window buttons
        // sit over Sweeter’s sidebar, above the avatar. This strip under them
        // is where the window can be dragged (a web view never moves it).
        if #available(macOS 26.0, *) { webView.obscuredContentInsets = NSEdgeInsetsZero }
        // A real macOS sidebar: dark and translucent, drawn behind the page,
        // which leaves its own sidebar transparent in the app.
        let sidebar = NSVisualEffectView()
        sidebar.material = .sidebar
        sidebar.blendingMode = .behindWindow
        sidebar.state = .followsWindowActiveState
        sidebar.appearance = NSAppearance(named: .darkAqua)
        sidebar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(sidebar, positioned: .below, relativeTo: webView)
        NSLayoutConstraint.activate([
            sidebar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sidebar.topAnchor.constraint(equalTo: view.topAnchor),
            sidebar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            sidebar.widthAnchor.constraint(equalToConstant: 76),
        ])
        // WebKit exposes this only as _setDrawsBackground: (verified on this
        // SDK); key-value coding reaches it through the key "drawsBackground".
        if webView.responds(to: NSSelectorFromString("_setDrawsBackground:")) {
            webView.setValue(false, forKey: "drawsBackground")
            translucentSidebar = true
        }
        webView.underPageBackgroundColor = .clear

        // Shown at once, before the page exists, so launch never flashes blank.
        let launch = LaunchCover(settings: storage.get(["settings"])["settings"] as? [String: Any] ?? [:])
        launch.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(launch, positioned: .above, relativeTo: webView)
        NSLayoutConstraint.activate([
            launch.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 76),
            launch.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            launch.topAnchor.constraint(equalTo: view.topAnchor),
            launch.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        cover = launch
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in self?.dismissCover() }

        let strip = DragStrip()
        strip.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(strip, positioned: .above, relativeTo: launch)
        NSLayoutConstraint.activate([
            strip.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            strip.topAnchor.constraint(equalTo: view.topAnchor),
            strip.widthAnchor.constraint(equalToConstant: 76),
            strip.heightAnchor.constraint(equalToConstant: 34),
        ])
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = Self.safariUserAgent()
        webView.allowsBackForwardNavigationGestures = false
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        installScripts()
        webView.load(URLRequest(url: xProURL))
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        guard let window = view.window else { return }
        window.delegate = self
        // The template window is titled and closable only.
        window.styleMask.insert([.resizable, .miniaturizable, .fullSizeContentView])
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.title = "Sweeter"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none
        window.tabbingMode = .disallowed
        window.minSize = NSSize(width: 640, height: 420)
        if !window.setFrameUsingName("SweeterMain") {
            window.setContentSize(NSSize(width: 1440, height: 900))
            window.center()
        }
        window.setFrameAutosaveName("SweeterMain")
    }

    /// X sees the same browser as Safari on this Mac.
    static func safariUserAgent() -> String {
        let version = Bundle(path: "/Applications/Safari.app")?.infoDictionary?["CFBundleShortVersionString"] as? String ?? "26.6"
        return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/\(version) Safari/605.1.15"
    }

    // MARK: - Scripts

    func installScripts() {
        let controller = webView.configuration.userContentController
        guard let resources = Bundle.main.builtInPlugInsURL?.appendingPathComponent("Sweeter Extension.appex/Contents/Resources"),
              let data = try? Data(contentsOf: resources.appendingPathComponent("manifest.json")),
              let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let scripts = manifest["content_scripts"] as? [[String: Any]]
        else {
            Log.write("extension resources missing")
            return
        }
        let version = manifest["version"] as? String ?? ""
        for entry in scripts {
            let files = entry["js"] as? [String] ?? []
            let joined = files
                .compactMap { try? String(contentsOf: resources.appendingPathComponent($0), encoding: .utf8) }
                .joined(separator: "\n;\n")
            // A web view runs user scripts on every page, unlike the
            // extension’s match patterns: keep Sweeter off X’s sign-in pages,
            // and out of its own pop-out windows (named sweeter-…), whose
            // page takes pro.x.com’s address once Sweeter writes into it.
            let source = "if (location.hostname === 'pro.x.com' && !/^sweeter-/.test(window.name)) {\n" + joined + "\n}"
            if (entry["world"] as? String) == "MAIN" {
                // The recorder must run in X Pro’s own page, before X’s code.
                controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
            } else {
                controller.addUserScript(WKUserScript(source: Self.bridge(version: version, translucent: translucentSidebar) + "\n;\n" + source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: world))
            }
        }
        controller.addScriptMessageHandler(self, contentWorld: world, name: "sweeter")
        Log.write("scripts installed, version \(version)")
    }

    /// Stands in for the WebExtension APIs Sweeter uses (storage, manifest) and
    /// adds the native hooks (counts, notifications, log).
    static func bridge(version: String, translucent: Bool) -> String {
        """
        (function () {
          const post = (m) => window.webkit.messageHandlers.sweeter.postMessage(m);
          globalThis.SweeterNative = {
            translucent: \(translucent ? "true" : "false"),
            osVersion: '\(ProcessInfo.processInfo.operatingSystemVersion.majorVersion).\(ProcessInfo.processInfo.operatingSystemVersion.minorVersion).\(ProcessInfo.processInfo.operatingSystemVersion.patchVersion)',
            counts: (c) => { post({ type: 'counts', notifications: c.notifications | 0, posts: c.posts | 0, columns: JSON.stringify(c.columns || []) }); },
            state: (s) => { post({ type: 'state', json: JSON.stringify(s) }); },
            menu: (m) => post({ type: 'menu', json: JSON.stringify(m) }),
            act: (a) => post({ type: 'act', json: JSON.stringify(a) }),
            copy: (t) => { post({ type: 'copy', text: String(t || '') }); },
            save: (f) => { post({ type: 'save', name: String(f.name || 'Sweeter.json'), text: String(f.text || '') }); },
            allowPopup: () => post({ type: 'allowPopup' }),
            show: () => post({ type: 'show' }),
            dex: (a) => post({ type: 'dex', address: String(a || '') }),
            latestRelease: () => post({ type: 'latestRelease' }),
            dexLogo: (u) => post({ type: 'dexLogo', url: String(u || '') }),
            notifyStatus: () => post({ type: 'notifyStatus' }),
            notifyRequest: () => post({ type: 'notifyRequest' }),
            notifySettings: () => post({ type: 'notifySettings' }),
            notify: (n) => { post({ type: 'notify', title: String(n.title || ''), body: String(n.body || ''), url: String(n.url || ''), subtitle: String(n.subtitle || ''), thread: String(n.thread || ''), key: String(n.key || ''), sound: !!n.sound, post: !!n.post }); },
            quickLook: (o) => post({ type: 'quickLook', json: JSON.stringify(o || {}) }),
            log: (m) => { post({ type: 'log', message: String(m) }); },
            signal: (n, p) => { post({ type: 'signal', name: String(n || ''), json: JSON.stringify(p || {}) }); },
            telemetry: (on) => { post({ type: 'telemetry', on: !!on }); },
            alert: (o) => post({ type: 'alert', json: JSON.stringify(o || {}) }),
            openSettings: (tab) => post({ type: 'openSettings', tab: String(tab || '') }),
            prefsChanged: (json) => post({ type: 'prefsChanged', json: String(json || '') }),
          };
          globalThis.browser = {
            runtime: { getManifest: () => ({ version: '\(version)' }) },
            storage: {
              local: {
                get: (keys) => post({ type: 'get', keys: Array.isArray(keys) ? keys : [keys] }).then((v) => v || {}),
                set: (obj) => post({ type: 'set', json: JSON.stringify(obj) }),
              },
            },
          };
        })();
        """
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else {
            replyHandler(nil, "unknown message")
            return
        }
        switch type {
        case "get":
            replyHandler(storage.get(body["keys"] as? [String] ?? []), nil)
        case "set":
            storage.set(json: body["json"] as? String ?? "{}")
            replyHandler(true, nil)
        case "counts":
            var perColumn: [[String: Any]] = []
            if let d = (body["columns"] as? String)?.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [[String: Any]] { perColumn = o }
            NotificationCenter.default.post(name: .sweeterCounts, object: nil, userInfo: [
                "notifications": body["notifications"] as? Int ?? 0,
                "posts": body["posts"] as? Int ?? 0,
                "columns": perColumn,
            ])
            replyHandler(nil, nil)
        case "notify":
            notify(title: body["title"] as? String ?? "", body: body["body"] as? String ?? "", url: body["url"] as? String ?? "",
                   subtitle: body["subtitle"] as? String ?? "", thread: body["thread"] as? String ?? "", key: body["key"] as? String ?? "", sound: body["sound"] as? Bool ?? true,
                   isPost: body["post"] as? Bool ?? false)
            replyHandler(nil, nil)
        case "log":
            let text = body["message"] as? String ?? ""
            Log.write(text)
            if text == "mounted" {
                mounted = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in self?.dismissCover() }
                if SettingsWindowController.made { SettingsWindowController.shared.pageMounted() }
            }
            replyHandler(nil, nil)
        case "state":
            if let d = (body["json"] as? String)?.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                let before = pageState["columns"] as? [String]
                pageState = o
                Telemetry.noteLook(o)
                NotificationCenter.default.post(name: .sweeterState, object: nil)
                // Shortcuts and Spotlight list the columns (Open Column).
                if (o["columns"] as? [String]) != before { SweeterShortcuts.updateAppShortcutParameters() }
            }
            replyHandler(nil, nil)
        // ⌘Y: a post's photos in Quick Look (full size, downloaded first).
        case "quickLook":
            guard let d = (body["json"] as? String)?.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else {
                replyHandler(nil, "bad request")
                return
            }
            // Only X's photo server (pbs.twimg.com), over https.
            let urls = (o["urls"] as? [String] ?? []).compactMap(URL.init(string:)).filter { $0.scheme == "https" && $0.host == "pbs.twimg.com" }
            quickLook.show(urls, at: o["index"] as? Int ?? 0)
            replyHandler(true, nil)
        // A question the page asks (a name, a confirmation, the update): a
        // real alert sheet on the window. Replies { button, text }: the
        // button's index (-1 when none) and the text field's value.
        case "alert":
            guard let d = (body["json"] as? String)?.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else {
                replyHandler(nil, "bad alert")
                return
            }
            presentAlert(o) { button, text in replyHandler(["button": button, "text": text], nil) }
        // Settings is a native window (SettingsWindow.swift); the page opens
        // it and, while it is open, sends every change to it.
        case "openSettings":
            SettingsWindowController.shared.show(tab: body["tab"] as? String ?? "")
            replyHandler(nil, nil)
        case "prefsChanged":
            SettingsWindowController.shared.model.apply(json: body["json"] as? String ?? "")
            replyHandler(nil, nil)
        // A usage count (Telemetry): a name the page chose and a few short
        // string values, never anything from X.
        case "signal":
            let name = body["name"] as? String ?? ""
            var parameters: [String: String] = [:]
            if let d = (body["json"] as? String)?.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                // 120: room for a warning's key (util.problemKey keeps 100).
                for (k, v) in o.prefix(8) { if let s = v as? String, k.count <= 40, s.count <= 120 { parameters[k] = s } }
            }
            if name.range(of: "^Sweeter\\.[A-Za-z][A-Za-z.]{0,60}$", options: .regularExpression) != nil { Telemetry.signal(name, parameters) }
            replyHandler(nil, nil)
        case "telemetry":
            Telemetry.setEnabled(body["on"] as? Bool ?? false)
            replyHandler(nil, nil)
        // Tokens' pairs from DexScreener's public API, for a contract address
        // the reader clicked or ticker cards on screen (up to 30 addresses,
        // comma-separated). Only valid addresses, only that host.
        case "dex":
            let address = body["address"] as? String ?? ""
            let one = "(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})"
            guard address.range(of: "^" + one + "(," + one + "){0,29}$", options: .regularExpression) != nil,
                  let url = URL(string: "https://api.dexscreener.com/latest/dex/tokens/" + address) else {
                replyHandler(nil, "bad address")
                return
            }
            Task {
                guard let (data, response) = try? await URLSession.shared.data(from: url),
                      let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                    replyHandler(nil, "lookup failed")
                    return
                }
                replyHandler(String(data: data, encoding: .utf8), nil)
            }
        // The latest Sweeter release on GitHub, for Check for Updates: its
        // tag, the start of its notes, its page and its zip. Nothing is
        // downloaded here; Download opens the zip in the browser.
        case "latestRelease":
            var req = URLRequest(url: URL(string: "https://api.github.com/repos/starl3xx/sweeter/releases/latest")!)
            req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
            Task {
                guard let (data, response) = try? await URLSession.shared.data(for: req),
                      let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                      let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    replyHandler(nil, "no answer")
                    return
                }
                let assets = j["assets"] as? [[String: Any]] ?? []
                let zip = assets.first(where: { ($0["name"] as? String ?? "").lowercased().hasSuffix(".zip") })?["browser_download_url"] as? String ?? ""
                replyHandler([
                    "tag": j["tag_name"] as? String ?? "",
                    "notes": String((j["body"] as? String ?? "").prefix(2000)),
                    "page": j["html_url"] as? String ?? "",
                    "zip": zip,
                ], nil)
            }
        // A token logo from DexScreener's image server, as a data: URL (X's
        // page allows no other image host). Only https on dexscreener.com,
        // images only, small.
        case "dexLogo":
            guard let url = URL(string: body["url"] as? String ?? ""), url.scheme == "https",
                  let host = url.host, host == "cdn.dexscreener.com" || host == "dd.dexscreener.com" else {
                replyHandler(nil, "bad url")
                return
            }
            Task {
                guard let (data, response) = try? await URLSession.shared.data(from: url),
                      let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                      let type = http.value(forHTTPHeaderField: "Content-Type")?.split(separator: ";").first.map(String.init),
                      type.hasPrefix("image/"), data.count <= 200_000 else {
                    replyHandler(nil, "logo failed")
                    return
                }
                replyHandler("data:" + type + ";base64," + data.base64EncodedString(), nil)
            }
        // Notification permission, asked for when the reader turns alerts on
        // (never at launch, out of context): "on", "off" or "ask".
        case "notifyStatus":
            UNUserNotificationCenter.current().getNotificationSettings { s in
                let v: String
                switch s.authorizationStatus {
                case .notDetermined: v = "ask"
                case .denied: v = "off"
                default: v = s.alertSetting == .disabled ? "off" : "on"
                }
                DispatchQueue.main.async { replyHandler(v, nil) }
            }
        case "notifyRequest":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
                DispatchQueue.main.async { replyHandler(granted, nil) }
            }
        case "notifySettings":
            // Sweeter’s own page in System Settings ▸ Notifications.
            let id = Bundle.main.bundleIdentifier ?? ""
            if let url = URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=" + id) { NSWorkspace.shared.open(url) }
            replyHandler(true, nil)
        case "allowPopup":
            // Sweeter is about to open a pop-out window (a blank page it
            // writes into). Only the next blank window, within two seconds.
            popupAllowedUntil = Date.now + 2
            replyHandler(true, nil)
        case "show":
            showWindow()
            replyHandler(true, nil)
        case "save":
            // A layout export: the person picks where it goes.
            let panel = NSSavePanel()
            panel.nameFieldStringValue = body["name"] as? String ?? "Sweeter.json"
            panel.allowedContentTypes = [.json]
            let text = body["text"] as? String ?? ""
            if let window = view.window {
                panel.beginSheetModal(for: window) { response in
                    if response == .OK, let url = panel.url {
                        do { try text.write(to: url, atomically: true, encoding: .utf8) } catch { Log.write("save failed: \(error.localizedDescription)") }
                    }
                }
            }
            replyHandler(true, nil)
        case "copy":
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(body["text"] as? String ?? "", forType: .string)
            replyHandler(true, nil)
        case "menu":
            // Pop the menu after this callback returns: it runs its own loop.
            let json = body["json"] as? String ?? "{}"
            DispatchQueue.main.async { [weak self] in
                replyHandler(self?.popUpMenu(json: json), nil)
            }
        case "act":
            // Reading List, Copy Image and Save Image As… from the menus.
            guard let d = (body["json"] as? String)?.data(using: .utf8),
                  let a = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                  let action = a["action"] as? String,
                  let url = URL(string: a["url"] as? String ?? ""),
                  ["http", "https"].contains(url.scheme?.lowercased() ?? "") else {
                replyHandler(nil, "bad request")
                return
            }
            perform(action, url: url) { outcome in
                switch outcome {
                case .done: replyHandler(true, nil)
                case .cancelled: replyHandler(false, nil)
                case .failed: replyHandler(nil, "failed")
                }
            }
        default:
            replyHandler(nil, nil)
        }
    }

    /// Runs code in Sweeter’s world (menus and hotkeys call into the page).
    func run(_ js: String) {
        webView.evaluateJavaScript(js, in: nil, in: world) { _ in }
    }

    /// The page's question as an NSAlert sheet: a title, text, up to three
    /// buttons (the first is the default; a "Cancel" or "Not Now" takes Esc),
    /// and either a text field (`input`) or release notes in a scrolling box.
    func presentAlert(_ o: [String: Any], done: @escaping (Int, String) -> Void) {
        let alert = NSAlert()
        alert.messageText = o["title"] as? String ?? ""
        alert.informativeText = o["text"] as? String ?? ""
        for (i, title) in (o["buttons"] as? [String] ?? ["OK"]).prefix(3).enumerated() {
            let button = alert.addButton(withTitle: title)
            if i == 0, o["destructive"] as? Bool == true { button.hasDestructiveAction = true }
            if title == "Cancel" || title == "Not Now" { button.keyEquivalent = "\u{1b}" }
        }
        var field: NSTextField?
        if let value = o["input"] as? String {
            let f = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
            f.stringValue = value
            f.lineBreakMode = .byTruncatingTail
            alert.accessoryView = f
            alert.window.initialFirstResponder = f
            field = f
        } else if let notes = o["notes"] as? String, !notes.isEmpty {
            let scroll = NSScrollView(frame: NSRect(x: 0, y: 0, width: 320, height: 120))
            scroll.hasVerticalScroller = true
            scroll.borderType = .bezelBorder
            // A text view that grows with its text, inside the scroll view.
            let size = scroll.contentSize
            let text = NSTextView(frame: NSRect(x: 0, y: 0, width: size.width, height: 1))
            text.minSize = NSSize(width: 0, height: 0)
            text.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
            text.isVerticallyResizable = true
            text.isHorizontallyResizable = false
            text.autoresizingMask = [.width]
            text.textContainer?.containerSize = NSSize(width: size.width, height: CGFloat.greatestFiniteMagnitude)
            text.textContainer?.widthTracksTextView = true
            text.isEditable = false
            text.font = NSFont.systemFont(ofSize: NSFont.smallSystemFontSize)
            text.textContainerInset = NSSize(width: 4, height: 4)
            text.string = notes
            // As tall as the notes, measured, up to 120 points; longer notes
            // scroll (sizeToFit kept the box's own height for a short note).
            var height: CGFloat = 20
            if let lm = text.layoutManager, let tc = text.textContainer {
                lm.ensureLayout(for: tc)
                height = ceil(lm.usedRect(for: tc).height) + 2 * text.textContainerInset.height
            }
            text.setFrameSize(NSSize(width: size.width, height: height))
            scroll.documentView = text
            scroll.frame.size.height = min(120, height + 4)
            alert.accessoryView = scroll
        }
        let finish = { (response: NSApplication.ModalResponse) in
            done(response.rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue, field?.stringValue ?? "")
        }
        showWindow()
        guard let window = view.window else { return finish(alert.runModal()) }
        alert.beginSheetModal(for: window, completionHandler: finish)
        field?.selectText(nil)
    }

    /// The page's Settings entry point (app.js prefsDo): a request in, its
    /// JSON reply out (nil when X Pro's page is not open).
    func prefs(_ op: String, _ arg: Any?, done: @escaping (Any?) -> Void) {
        webView.callAsyncJavaScript("return Sweeter.native && Sweeter.native.prefs ? Sweeter.native.prefs(op, arg) : null",
                                    arguments: ["op": op, "arg": arg ?? NSNull()], in: nil, in: world) { result in
            done(try? result.get())
        }
    }

    /// Closes the page's top sheet, if one is open (true then).
    func closeTop(_ done: @escaping (Bool) -> Void) {
        webView.evaluateJavaScript("!!(Sweeter.native && Sweeter.native.closeTop && Sweeter.native.closeTop())", in: nil, in: world) { result in
            done((try? result.get()) as? Bool == true)
        }
    }

    /// A command for Sweeter’s page, from a menu item or a hotkey.
    func command(_ name: String) {
        let arg = (try? JSONSerialization.data(withJSONObject: [name])).flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        run("Sweeter.native && Sweeter.native.cmd(\(arg)[0])")
    }

    func dismissCover() {
        guard let c = cover else { return }
        cover = nil
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.25
            c.animator().alphaValue = 0
        }, completionHandler: { c.removeFromSuperview() })
    }

    // MARK: - Context menu

    /// A real macOS menu, built from the page’s list of items. An item can
    /// carry a checkmark, a key equivalent (shown, and live while the menu
    /// is open) and a `share` address for the system share picker.
    func popUpMenu(json: String) -> String? {
        guard let d = json.data(using: .utf8),
              let spec = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let items = spec["items"] as? [[String: Any]] else { return nil }
        let target = MenuTarget()
        sharePickers = []
        // Items may carry `children`: a submenu, built the same way.
        func build(_ items: [[String: Any]]) -> NSMenu {
            let menu = NSMenu()
            menu.autoenablesItems = false
            for it in items {
                if it["separator"] as? Bool == true {
                    menu.addItem(.separator())
                    continue
                }
                let children = it["children"] as? [[String: Any]]
                let item = NSMenuItem(title: it["title"] as? String ?? "", action: children == nil ? #selector(MenuTarget.pick(_:)) : nil, keyEquivalent: "")
                item.target = children == nil ? target : nil
                item.representedObject = it["id"] as? String
                item.isEnabled = it["enabled"] as? Bool ?? true
                if it["checked"] as? Bool == true { item.state = .on }
                if let symbol = it["symbol"] as? String {
                    item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
                }
                // A column color: a filled dot of that color (#RRGGBB).
                if let hex = it["color"] as? String, hex.count == 7, hex.hasPrefix("#"), let rgb = UInt32(hex.dropFirst(), radix: 16) {
                    let color = NSColor(srgbRed: CGFloat((rgb >> 16) & 0xFF) / 255, green: CGFloat((rgb >> 8) & 0xFF) / 255, blue: CGFloat(rgb & 0xFF) / 255, alpha: 1)
                    item.image = NSImage(size: NSSize(width: 12, height: 12), flipped: false) { r in
                        color.setFill()
                        NSBezierPath(ovalIn: r.insetBy(dx: 0.5, dy: 0.5)).fill()
                        return true
                    }
                }
                if let key = it["key"] as? String, !key.isEmpty {
                    item.keyEquivalent = key
                    var mods: NSEvent.ModifierFlags = []
                    for m in it["mods"] as? [String] ?? [] {
                        switch m {
                        case "option": mods.insert(.option)
                        case "command": mods.insert(.command)
                        case "shift": mods.insert(.shift)
                        case "control": mods.insert(.control)
                        default: break
                        }
                    }
                    item.keyEquivalentModifierMask = mods
                }
                // Share: the system's own Share submenu (Messages, AirDrop,
                // Notes…), as in Safari's context menus.
                if let share = it["share"] as? String, let url = URL(string: share), ["http", "https"].contains(url.scheme ?? "") {
                    // The item does not keep its picker; Sweeter does, until
                    // the next menu (a service may run after this one closes).
                    let picker = NSSharingServicePicker(items: [url])
                    sharePickers.append(picker)
                    menu.addItem(picker.standardShareMenuItem)
                    continue
                }
                if let children { item.submenu = build(children) }
                menu.addItem(item)
            }
            return menu
        }
        let menu = build(items)
        let point = webView.convert(view.window?.mouseLocationOutsideOfEventStream ?? .zero, from: nil)
        menu.popUp(positioning: nil, at: point, in: webView)
        return target.chosen
    }

    enum Outcome { case done, cancelled, failed }

    func perform(_ action: String, url: URL, done: @escaping (Outcome) -> Void) {
        switch action {
        case "readingList":
            guard let service = NSSharingService(named: .addToSafariReadingList), service.canPerform(withItems: [url]) else { return done(.failed) }
            service.perform(withItems: [url])
            done(.done)
        case "copyImage":
            Task {
                guard let data = await Self.download(url), let image = NSImage(data: data) else { return done(.failed) }
                NSPasteboard.general.clearContents()
                done(NSPasteboard.general.writeObjects([image]) ? .done : .failed)
            }
        case "saveImage":
            guard let window = view.window else { return done(.failed) }
            let panel = NSSavePanel()
            panel.nameFieldStringValue = Self.fileName(for: url)
            panel.canCreateDirectories = true
            panel.beginSheetModal(for: window) { response in
                guard response == .OK, let dest = panel.url else { return done(.cancelled) }
                Task {
                    guard let data = await Self.download(url) else { return done(.failed) }
                    do {
                        try data.write(to: dest, options: .atomic)
                        done(.done)
                    } catch {
                        done(.failed)
                    }
                }
            }
        default:
            done(.failed)
        }
    }

    /// A public image the reader asked for (pbs.twimg.com), as Safari’s own
    /// Save Image would fetch it. Not an X API request, and only from X’s
    /// public media servers.
    static func download(_ url: URL) async -> Data? {
        guard url.scheme == "https", let host = url.host, host == "twimg.com" || host.hasSuffix(".twimg.com") else { return nil }
        guard let (data, response) = try? await URLSession.shared.data(from: url),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
        return data
    }

    /// “G1abc.jpg” from https://pbs.twimg.com/media/G1abc.jpg?name=orig.
    static func fileName(for url: URL) -> String {
        var name = url.lastPathComponent
        if name.isEmpty || name == "/" { name = "image" }
        if (name as NSString).pathExtension.isEmpty {
            let format = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "format" })?.value ?? "jpg"
            name += "." + format
        }
        return name
    }

    // MARK: - Window

    func showWindow() {
        if #available(macOS 14, *) { NSApp.activate() } else { NSApp.activate(ignoringOtherApps: true) }
        view.window?.makeKeyAndOrderFront(nil)
    }

    func toggleWindow() {
        if let w = view.window, w.isVisible, NSApp.isActive {
            w.orderOut(nil)
        } else {
            showWindow()
        }
    }

    func compose() {
        showWindow()
        run("Sweeter.native && Sweeter.native.compose()")
    }

    func reloadXPro() {
        mounted = false
        closePopouts()
        webView.load(URLRequest(url: xProURL))
    }

    /// Pop-out windows draw from the main page: they close when it reloads.
    func closePopouts() {
        for window in popoutWindows { window.close() }
    }

    /// Closing hides the window, so X Pro keeps refreshing for the Dock badge.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    // MARK: - Notifications

    /// One alert. The subtitle names the column and the thread groups a
    /// column’s alerts; a column set to Banner comes without a sound.
    func notify(title: String, body: String, url: String, subtitle: String, thread: String, key: String, sound: Bool, isPost: Bool) {
        if NSApp.isActive, view.window?.isKeyWindow == true { return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.subtitle = subtitle
        content.body = body
        content.threadIdentifier = thread
        content.sound = sound ? .default : nil
        // A post's alert has Like and Reply (AppDelegate registers "post").
        if isPost { content.categoryIdentifier = "post" }
        content.userInfo = ["url": url, "column": thread, "key": key]
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }

    // Quick Look takes its items from whoever controls the panel: this
    // window's controller, while Sweeter's window is key.
    override func acceptsPreviewPanelControl(_ panel: QLPreviewPanel!) -> Bool { true }

    override func beginPreviewPanelControl(_ panel: QLPreviewPanel!) {
        panel.dataSource = quickLook
        panel.currentPreviewItemIndex = quickLook.start
    }

    override func endPreviewPanelControl(_ panel: QLPreviewPanel!) {
        panel.dataSource = nil
    }

    // MARK: - Navigation

    static func isX(_ host: String) -> Bool {
        ["x.com", "twitter.com"].contains { host == $0 || host.hasSuffix("." + $0) }
    }

    /// The main frame stays on X Pro and X’s sign-in pages. Every other link
    /// opens in the default browser.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.allow) }
        if navigationAction.targetFrame?.isMainFrame == false { return decisionHandler(.allow) }
        Log.write("navigate \(url.host ?? "?")\(url.path)")
        if let scheme = url.scheme, ["about", "blob", "data"].contains(scheme) { return decisionHandler(.allow) }
        let host = url.host ?? ""
        if host == "pro.x.com" || host == "pro.twitter.com" { return decisionHandler(.allow) }
        if Self.isX(host) && url.path == "/home" && navigationAction.navigationType != .linkActivated {
            // Signed in but sent to x.com: go to X Pro instead.
            decisionHandler(.cancel)
            reloadXPro()
            return
        }
        // Only a link the person clicked leaves the app. Redirects and
        // scripted navigations (X’s sign-in runs through several x.com
        // paths, such as /i/jf/onboarding/web) stay inside.
        if navigationAction.navigationType == .linkActivated {
            Log.write("opened in browser: \(host)")
            NSWorkspace.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    /// Pop-out windows Sweeter opened; kept until they close.
    private var popoutWindows: [NSWindow] = []
    private var popupAllowedUntil = Date.distantPast
    private let popoutNav = PopoutNavigation()

    /// target=_blank and window.open go to the default browser, except a
    /// blank window Sweeter asked for: a pop-out column it draws into.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let blank = navigationAction.request.url.map { $0.absoluteString.isEmpty || $0.absoluteString == "about:blank" } ?? true
        if blank && Date.now < popupAllowedUntil {
            popupAllowedUntil = .distantPast
            let size = NSSize(width: windowFeatures.width?.doubleValue ?? 440, height: windowFeatures.height?.doubleValue ?? 860)
            let popup = WKWebView(frame: NSRect(origin: .zero, size: size), configuration: configuration)
            popup.uiDelegate = self
            popup.navigationDelegate = popoutNav
            let window = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false
            window.contentView = popup
            window.title = "Sweeter"
            window.setFrameAutosaveName("")
            window.center()
            window.makeKeyAndOrderFront(nil)
            popoutWindows.append(window)
            NotificationCenter.default.addObserver(forName: NSWindow.willCloseNotification, object: window, queue: .main) { [weak self] note in
                self?.popoutWindows.removeAll { $0 === note.object as? NSWindow }
            }
            Log.write("pop-out window opened")
            return popup
        }
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme ?? "") {
            Log.write("opened in browser: \(url.host ?? "?")")
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    /// A pop-out window closed from its page (window.close()).
    func webViewDidClose(_ webView: WKWebView) {
        popoutWindows.first { $0.contentView === webView }?.close()
    }

    /// File pickers for photos and video in Sweeter’s compose window.
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        guard let window = view.window else { return completionHandler(nil) }
        panel.beginSheetModal(for: window) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Log.write("loaded \(webView.url?.host ?? "?")\(webView.url?.path ?? "")")
        // X’s sign-in pages have no Sweeter to wait for.
        if webView.url?.host != "pro.x.com" { dismissCover() }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        Log.write("load failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        Log.write("load failed: \(error.localizedDescription)")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Log.write("web content process ended; reloading")
        reloadXPro()
    }
}

/// Collects the item picked from a context menu.
final class MenuTarget: NSObject {
    var chosen: String?
    @objc func pick(_ sender: NSMenuItem) {
        chosen = sender.representedObject as? String
    }
}

/// The launch view: the app icon and a spinner over the column area, shown
/// before the page loads, then faded into Sweeter’s own loading screen.
/// Shown at once, before the page exists, so launch never flashes blank. It
/// draws the page's own loading screen (styles.js .boot: the same sizes and
/// glow) in the saved theme's colors, so the page takes over unseen.
final class LaunchCover: NSView {
    init(settings: [String: Any]) {
        super.init(frame: .zero)
        let look = LaunchLook(settings: settings)
        appearance = NSAppearance(named: look.dark ? .darkAqua : .aqua)
        let host = NSHostingView(rootView: LaunchCoverView(look: look))
        host.translatesAutoresizingMaskIntoConstraints = false
        addSubview(host)
        NSLayoutConstraint.activate([
            host.leadingAnchor.constraint(equalTo: leadingAnchor),
            host.trailingAnchor.constraint(equalTo: trailingAnchor),
            host.topAnchor.constraint(equalTo: topAnchor),
            host.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }
}

/// The saved theme's background, text, quiet text and divider colors
/// (styles.js: LIGHT, DARK and PALETTES; tests/themes.test.js keeps them
/// the same).
struct LaunchLook {
    static let colors: [String: [UInt32]] = [
        "classic-light": [0xFFFFFF, 0x000000, 0x767676, 0xE6E6E6],
        "classic-dark": [0x262626, 0xFFFFFF, 0x999999, 0x404040],
        "sweeter-light": [0xFFFFFF, 0x1D1726, 0x756B82, 0xE3ECF6],
        "sweeter-dark": [0x1C1825, 0xF7F2FA, 0x9C91A8, 0x2E2738],
        "catppuccin-light": [0xEFF1F5, 0x4C4F69, 0x6C6F85, 0xDCE0E8],
        "catppuccin-dark": [0x1E1E2E, 0xCDD6F4, 0xA6ADC8, 0x313244],
        "nord-light": [0xECEFF4, 0x2E3440, 0x4C566A, 0xD8DEE9],
        "nord-dark": [0x2E3440, 0xECEFF4, 0xA3ADBF, 0x3B4252],
        "dracula-light": [0xFFFBEB, 0x1F1F1F, 0x6C664B, 0xE8E2CC],
        "dracula-dark": [0x282A36, 0xF8F8F2, 0x9AA5CE, 0x44475A],
    ]

    let dark: Bool
    let bg: Color
    let text: Color
    let quiet: Color
    let track: Color

    init(settings: [String: Any]) {
        let skin = settings["skin"] as? String ?? "light"
        dark = skin == "dark" || (skin == "system" && NSApp.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua)
        let theme = settings["theme"] as? String ?? "classic"
        let side = dark ? "-dark" : "-light"
        let c = Self.colors[theme + side] ?? Self.colors["classic" + side]!
        let color = { (v: UInt32) in Color(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255) }
        bg = color(dark && settings["pureBlack"] as? Bool == true ? 0x000000 : c[0])
        text = color(c[1])
        quiet = color(c[2])
        track = color(c[3])
    }
}

struct LaunchCoverView: View {
    let look: LaunchLook
    @State private var up = false
    @State private var glide = false
    // Reduce Motion: no float, and a still, faint, full bar (as .boot draws it).
    private let still = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion

    // The icon's sky and the bird's pink, as in the About window.
    private let sky = Color(red: 0x7E / 255, green: 0xC0 / 255, blue: 0xFA / 255)
    private let pink = Color(red: 0xEE / 255, green: 0x5A / 255, blue: 0x8E / 255)

    var body: some View {
        ZStack {
            look.bg
            RadialGradient(colors: [sky.opacity(look.dark ? 0.22 : 0.30), sky.opacity(0)], center: .center, startRadius: 0, endRadius: 240)
                .frame(width: 480, height: 480)
                .offset(x: -40, y: -60)
            RadialGradient(colors: [pink.opacity(look.dark ? 0.18 : 0.20), pink.opacity(0)], center: .center, startRadius: 0, endRadius: 220)
                .frame(width: 440, height: 440)
                .offset(x: 40, y: -40)
            VStack(spacing: 0) {
                Image(nsImage: NSApp.applicationIconImage)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: 104, height: 104)
                    .shadow(color: pink.opacity(look.dark ? 0.35 : 0.22), radius: 4, y: 8)
                    .offset(y: up ? -4 : 2)
                Text("Sweeter")
                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                    .foregroundStyle(look.text)
                    .frame(height: 29)
                    .padding(.top, 16)
                Capsule()
                    .fill(look.track)
                    .frame(width: 160, height: 4)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(LinearGradient(colors: [sky, pink], startPoint: .leading, endPoint: .trailing))
                            .frame(width: still ? 160 : 61)
                            .opacity(still ? 0.4 : 1)
                            .offset(x: glide ? 99 : 0)
                    }
                    .clipShape(Capsule())
                    .padding(.top, 18)
                Text("Loading your columns")
                    .font(.system(size: 13))
                    .foregroundStyle(look.quiet)
                    .frame(height: 16)
                    .padding(.top, 12)
            }
        }
        .ignoresSafeArea()
        .onAppear {
            guard !still else { return }
            withAnimation(.easeInOut(duration: 2.8).repeatForever(autoreverses: true)) { up = true }
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) { glide = true }
        }
    }
}

/// The top of Sweeter’s sidebar, under the window buttons: drag to move the
/// window, double-click to zoom it, as a title bar would.
final class DragStrip: NSView {
    override var mouseDownCanMoveWindow: Bool { true }

    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 {
            window?.performZoom(nil)
        } else {
            window?.performDrag(with: event)
        }
    }
}

/// Sweeter’s settings, mutes and reading positions (browser.storage.local in
/// the Safari extension), kept as one JSON file in the app’s container.
final class NativeStorage {
    private var data: [String: Any] = [:]
    private let url: URL

    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Sweeter", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        url = dir.appendingPathComponent("storage.json")
        if let d = try? Data(contentsOf: url), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
            data = o
        }
    }

    func get(_ keys: [String]) -> [String: Any] {
        var out: [String: Any] = [:]
        for k in keys { if let v = data[k] { out[k] = v } }
        return out
    }

    func set(json: String) {
        guard let d = json.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return }
        for (k, v) in o { data[k] = v }
        if let out = try? JSONSerialization.data(withJSONObject: data) {
            try? out.write(to: url, options: .atomic)
        }
    }
}

/// A short diagnostic log (no post content) in the app’s container.
enum Log {
    static let url: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Sweeter", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("sweeter.log")
    }()

    static func write(_ message: String) {
        let line = ISO8601DateFormatter().string(from: Date()) + "  " + message + "\n"
        if let h = try? FileHandle(forWritingTo: url) {
            h.seekToEndOfFile()
            h.write(line.data(using: .utf8)!)
            try? h.close()
        } else {
            try? line.data(using: .utf8)!.write(to: url)
        }
    }
}


/// A pop-out window shows only the blank page Sweeter writes into; any
/// link in it opens in the default browser.
final class PopoutNavigation: NSObject, WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.allow) }
        if let scheme = url.scheme, ["about", "blob", "data"].contains(scheme) { return decisionHandler(.allow) }
        if ["http", "https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
}

/// Photos for Quick Look: downloaded into the app's temporary folder (the
/// panel previews files), then shown starting at the chosen one.
final class QuickLookPhotos: NSObject, QLPreviewPanelDataSource {
    private var files: [URL] = []
    private(set) var start = 0
    private var token = 0

    func show(_ urls: [URL], at index: Int) {
        guard !urls.isEmpty else { return }
        token += 1
        let mine = token
        Task {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Quick Look", isDirectory: true)
            try? FileManager.default.removeItem(at: dir)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            var saved: [URL] = []
            for (i, url) in urls.prefix(4).enumerated() {
                guard let (data, response) = try? await URLSession.shared.data(from: url),
                      let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                      let type = http.value(forHTTPHeaderField: "Content-Type"), type.hasPrefix("image/") else { continue }
                let ext = UTType(mimeType: type.split(separator: ";").first.map(String.init) ?? "")?.preferredFilenameExtension ?? "jpg"
                let file = dir.appendingPathComponent("Photo \(i + 1).\(ext)")
                if (try? data.write(to: file)) != nil { saved.append(file) }
            }
            await MainActor.run {
                guard mine == self.token, !saved.isEmpty, let panel = QLPreviewPanel.shared() else { return }
                self.files = saved
                self.start = min(max(0, index), saved.count - 1)
                if panel.isVisible {
                    panel.reloadData()
                    panel.currentPreviewItemIndex = self.start
                } else {
                    panel.makeKeyAndOrderFront(nil)
                }
            }
        }
    }

    func numberOfPreviewItems(in panel: QLPreviewPanel!) -> Int { files.count }

    func previewPanel(_ panel: QLPreviewPanel!, previewItemAt index: Int) -> QLPreviewItem! { files[index] as NSURL }
}
