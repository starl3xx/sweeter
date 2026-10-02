//
//  AppDelegate.swift
//  Sweeter
//
//  The native shell around Sweeter: menu bar item, global hotkeys, Dock badge,
//  notifications and Open at Login, the things Tweetbot had and a Safari tab
//  cannot do. The window itself is ViewController.
//

import Carbon.HIToolbox
import Cocoa
import SafariServices
import ServiceManagement
import UserNotifications

extension Notification.Name {
    static let sweeterHotKey = Notification.Name("SweeterHotKey")
}

/// Carbon calls this for a registered global hotkey, off the main actor.
private func hotKeyHandler(_ next: EventHandlerCallRef?, _ event: EventRef?, _ userData: UnsafeMutableRawPointer?) -> OSStatus {
    var id = EventHotKeyID()
    GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
    let which = id.id
    DispatchQueue.main.async {
        NotificationCenter.default.post(name: .sweeterHotKey, object: nil, userInfo: ["id": which])
    }
    return noErr
}

@main
class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {

    var statusItem: NSStatusItem?
    var hotKeyRefs: [EventHotKeyRef?] = []
    var loginItem: NSMenuItem?

    // Global hotkeys, like Tweetbot’s “Global Show/Hide Key” and
    // “Global New Tweet Key”.
    static let showHideHotKey: (key: Int, mods: Int, label: String) = (kVK_ANSI_X, controlKey | optionKey | cmdKey, "⌃⌥⌘X")
    static let newPostHotKey: (key: Int, mods: Int, label: String) = (kVK_ANSI_N, controlKey | optionKey | cmdKey, "⌃⌥⌘N")

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Permission is asked for when alerts are turned on (the page calls
        // notifyRequest), not here: a prompt at launch has no context.
        UNUserNotificationCenter.current().delegate = self
        setUpStatusItem()
        setUpMenus()
        registerHotKeys()
        NotificationCenter.default.addObserver(self, selector: #selector(countsChanged(_:)), name: .sweeterCounts, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(hotKeyPressed(_:)), name: .sweeterHotKey, object: nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    /// The Dock menu: each column with its unread count, and Next Unread.
    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        let menu = NSMenu()
        menu.addItem(menuItem("Next Unread", "nextUnread", "", [], nil))
        if !columnCounts.isEmpty { menu.addItem(.separator()) }
        for (i, c) in columnCounts.prefix(12).enumerated() {
            let n = c["n"] as? Int ?? 0
            let title = (c["title"] as? String ?? "Column") + (n > 0 ? " (\(n > 999 ? "999+" : String(n)))" : "")
            menu.addItem(menuItem(title, "column:\(i + 1)", "", [], nil))
        }
        return menu
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        ViewController.shared?.showWindow()
        return true
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }

    // MARK: - Counts

    private var columnCounts: [[String: Any]] = []

    @objc func countsChanged(_ note: Notification) {
        columnCounts = note.userInfo?["columns"] as? [[String: Any]] ?? []
        let notes = note.userInfo?["notifications"] as? Int ?? 0
        NSApp.dockTile.badgeLabel = notes > 0 ? String(notes) : nil
        statusItem?.button?.title = notes > 0 ? " \(notes)" : ""
    }

    // MARK: - Menu bar item

    func setUpStatusItem() {
        let status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        let image = NSImage(systemSymbolName: "bird.fill", accessibilityDescription: "Sweeter")
        image?.isTemplate = true
        status.button?.image = image
        status.button?.imagePosition = .imageLeading

        let menu = NSMenu()
        menu.addItem(item(title: "Show Sweeter", action: #selector(showMain), hint: Self.showHideHotKey.label))
        menu.addItem(item(title: "New Post", action: #selector(newPost), hint: Self.newPostHotKey.label))
        menu.addItem(item(title: "Reload X Pro", action: #selector(reloadXPro), hint: nil))
        menu.addItem(.separator())
        let login = item(title: "Open at Login", action: #selector(toggleLogin), hint: nil)
        loginItem = login
        menu.addItem(login)
        menu.addItem(item(title: "Safari Extension Settings…", action: #selector(safariSettings), hint: nil))
        menu.addItem(.separator())
        menu.addItem(item(title: "Quit Sweeter", action: #selector(NSApplication.terminate(_:)), hint: nil))
        menu.delegate = self
        status.menu = menu
        statusItem = status
        refreshLoginState()
    }

    private func item(title: String, action: Selector, hint: String?) -> NSMenuItem {
        let i = NSMenuItem(title: hint.map { "\(title)    \($0)" } ?? title, action: action, keyEquivalent: "")
        i.target = action == #selector(NSApplication.terminate(_:)) ? NSApp : self
        return i
    }

    // MARK: - Main menu

    /// Native menus for everything Sweeter does, with Tweetbot’s shortcuts
    /// where they fit: Settings… (⌘,), a Post menu, a View menu with the
    /// theme and text size, and a Go menu for columns (⌘1 to ⌘9).
    func setUpMenus() {
        guard let main = NSApp.mainMenu else { return }
        let appMenu = main.items.first?.submenu
        if let settings = appMenu?.items.first(where: { $0.keyEquivalent == "," }) {
            settings.title = "Settings…"
            settings.action = #selector(openSettings)
            settings.target = self
        }
        // The template’s Format and Help menus do nothing in Sweeter.
        for title in ["Format", "Help"] {
            if let m = main.items.first(where: { $0.submenu?.title == title }) { main.removeItem(m) }
        }
        // The template storyboard has no File, Edit or Window menu. Edit
        // matters most: ⌘C, ⌘V, ⌘Z and ⌘A reach the web view through it.
        let file = NSMenu(title: "File")
        file.addItem(menuItem("New Post", "newPost", "n", [.command], "square.and.pencil"))
        file.addItem(.separator())
        file.addItem(standard("Close", #selector(NSWindow.performClose(_:)), "w", [.command]))
        main.insertItem(wrap(file), at: min(1, main.items.count))

        let edit = NSMenu(title: "Edit")
        edit.addItem(standard("Undo", Selector(("undo:")), "z", [.command]))
        edit.addItem(standard("Redo", Selector(("redo:")), "z", [.command, .shift]))
        edit.addItem(.separator())
        edit.addItem(standard("Cut", #selector(NSText.cut(_:)), "x", [.command]))
        edit.addItem(standard("Copy", #selector(NSText.copy(_:)), "c", [.command]))
        edit.addItem(standard("Paste", #selector(NSText.paste(_:)), "v", [.command]))
        edit.addItem(standard("Paste and Match Style", #selector(NSTextView.pasteAsPlainText(_:)), "v", [.command, .option, .shift]))
        edit.addItem(standard("Delete", #selector(NSText.delete(_:)), "", []))
        edit.addItem(standard("Select All", #selector(NSText.selectAll(_:)), "a", [.command]))
        edit.addItem(.separator())
        edit.addItem(menuItem("Find…", "find", "f", [.command], "magnifyingglass"))
        main.insertItem(wrap(edit), at: min(2, main.items.count))

        let post = NSMenu(title: "Post")
        post.addItem(menuItem("New Post", "newPost", "n", [.command], "square.and.pencil"))
        post.addItem(menuItem("Reply", "reply", "r", [.command], "arrowshape.turn.up.left"))
        post.addItem(menuItem("Repost…", "repost", "", [], "arrow.2.squarepath"))
        post.addItem(menuItem("Quote…", "quote", "", [], "quote.bubble"))
        post.addItem(menuItem("Like", "like", "l", [.command], "heart"))
        post.addItem(menuItem("Bookmark", "bookmark", "d", [.command], "bookmark"))
        post.addItem(.separator())
        post.addItem(menuItem("Open Conversation", "open", "o", [.command], "bubble.left.and.bubble.right"))
        post.addItem(menuItem("Open in Browser", "browser", "t", [.command], "safari"))
        post.addItem(menuItem("Copy Link to Post", "copyLink", "c", [.command, .shift], "link"))
        post.addItem(.separator())
        post.addItem(menuItem("View Profile", "profile", "u", [.command, .shift], "person.crop.circle"))
        insert(post, after: "Edit", in: main)

        // Columns: adding and removing change X Pro's deck on every device;
        // widths are Sweeter's own.
        let column = NSMenu(title: "Column")
        column.addItem(menuItem("Add Column…", "addColumn", "n", [.command, .option], "plus.rectangle.on.rectangle"))
        column.addItem(menuItem("Remove Column…", "removeColumn", String(Character(UnicodeScalar(NSBackspaceCharacter)!)), [.command, .option], "minus.rectangle"))
        column.addItem(.separator())
        let width = NSMenu(title: "Width")
        for (title, px) in [("Narrow", 300), ("Medium", 400), ("Wide", 600), ("Default Width", 0)] {
            if px == 0 { width.addItem(.separator()) }
            width.addItem(menuItem(title, "colWidth:\(px)", "", [], nil))
        }
        let widthItem = NSMenuItem(title: "Width", action: nil, keyEquivalent: "")
        widthItem.submenu = width
        widthItem.image = NSImage(systemSymbolName: "arrow.left.and.right", accessibilityDescription: nil)
        column.addItem(widthItem)
        column.addItem(menuItem("Column Menu", "colMenu", "", [], "ellipsis.circle"))
        column.addItem(.separator())
        column.addItem(menuItem("Move Left", "moveCol:left", String(Character(UnicodeScalar(NSLeftArrowFunctionKey)!)), [.command, .option], "arrow.left"))
        column.addItem(menuItem("Move Right", "moveCol:right", String(Character(UnicodeScalar(NSRightArrowFunctionKey)!)), [.command, .option], "arrow.right"))
        column.addItem(.separator())
        column.addItem(menuItem("Clear All Columns", "clearAll", "k", [.command, .option], "clear"))
        let mute = menuItem("Mute All Alerts", "muteAlerts", "", [], "bell.slash")
        mute.tag = 5
        column.addItem(mute)
        insert(column, after: "Post", in: main)

        let view = main.items.first(where: { $0.submenu?.title == "View" })?.submenu ?? {
            let m = NSMenu(title: "View")
            insert(m, after: "Column", in: main)
            return m
        }()
        // Drop the template’s toolbar and sidebar items; keep Enter Full Screen.
        for item in view.items where [#selector(NSWindow.toggleToolbarShown(_:)), #selector(NSWindow.runToolbarCustomizationPalette(_:)), NSSelectorFromString("toggleSidebar:")].contains(item.action) {
            view.removeItem(item)
        }
        let theme = NSMenu(title: "Theme")
        for (title, value) in [("Match System", "system"), ("Light", "light"), ("Dark", "dark"), ("Winamp Classic", "winamp")] {
            let i = menuItem(title, "skin:" + value, "", [], nil)
            i.tag = 1
            theme.addItem(i)
        }
        let themeItem = NSMenuItem(title: "Theme", action: nil, keyEquivalent: "")
        themeItem.submenu = theme
        themeItem.image = NSImage(systemSymbolName: "paintpalette", accessibilityDescription: nil)
        // The same colors as the page’s accent swatches (app.js ACCENTS).
        let accent = NSMenu(title: "Accent Color")
        for (title, value, hex) in [("Blue", "blue", 0x4590E6), ("Purple", "purple", 0x8A56D6), ("Pink", "pink", 0xD63F7A), ("Red", "red", 0xD9443A),
                                    ("Orange", "orange", 0xC8650F), ("Yellow", "yellow", 0xA67C00), ("Green", "green", 0x2B8F48), ("Teal", "teal", 0x1A8A96),
                                    ("Graphite", "graphite", 0x6E6E73), ("Match macOS", "system", -1)] {
            let i = menuItem(title, "accent:" + value, "", [], nil)
            i.tag = 2
            i.image = swatch(hex < 0 ? .controlAccentColor : NSColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1))
            accent.addItem(i)
        }
        let accentItem = NSMenuItem(title: "Accent Color", action: nil, keyEquivalent: "")
        accentItem.submenu = accent
        accentItem.image = NSImage(systemSymbolName: "circle.lefthalf.filled", accessibilityDescription: nil)
        // The selected column’s filters. No key equivalents here: ⌥1 to ⌥9
        // reach the page, so they still type ¡ ™ £ in a text field.
        let filter = NSMenu(title: "Filter")
        filter.delegate = self
        filterMenu = filter
        let filterItem = NSMenuItem(title: "Filter", action: nil, keyEquivalent: "")
        filterItem.submenu = filter
        filterItem.image = NSImage(systemSymbolName: "line.3.horizontal.decrease.circle", accessibilityDescription: nil)
        let layout = NSMenu(title: "Column Layout")
        for (title, value) in [("Fill the Window", "fill"), ("Equal Widths", "equal"), ("Fixed Width", "fixed"), ("Fit 2", "fit2"), ("Fit 3", "fit3"), ("Fit 4", "fit4"), ("Fit 5", "fit5")] {
            let i = menuItem(title, "fit:" + value, "", [], nil)
            i.tag = 4
            layout.addItem(i)
        }
        layout.addItem(.separator())
        let snap = menuItem("Snap Columns", "snap", "", [], nil)
        snap.tag = 6
        layout.addItem(snap)
        let layoutItem = NSMenuItem(title: "Column Layout", action: nil, keyEquivalent: "")
        layoutItem.submenu = layout
        layoutItem.image = NSImage(systemSymbolName: "rectangle.split.3x1", accessibilityDescription: nil)
        var at = 0
        for item in [themeItem, accentItem, .separator(), filterItem, layoutItem, .separator(),
                     menuItem("Bigger", "bigger", "+", [.command], "textformat.size.larger"),
                     menuItem("Smaller", "smaller", "-", [.command], "textformat.size.smaller"),
                     menuItem("Actual Size", "actual", "0", [.command], nil),
                     .separator(),
                     menuItem("Mark All as Read", "markRead", "k", [.command], "checkmark.circle"),
                     menuItem("Scroll to Top", "top", String(Character(UnicodeScalar(NSUpArrowFunctionKey)!)), [.command], nil),
                     .separator(),
                     menuItem("Command Palette…", "palette", "p", [.command, .shift], "command"),
                     menuItem("Show X Pro", "xpro", "x", [.command, .option], nil),
                     menuItem("Reload X Pro", "reload", "r", [.command, .shift], "arrow.clockwise"),
                     .separator()] {
            view.insertItem(item, at: at)
            at += 1
        }

        view.addItem(standard("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]))

        let go = NSMenu(title: "Go")
        go.delegate = self
        insert(go, after: "View", in: main)
        goMenu = go

        let window = NSMenu(title: "Window")
        window.addItem(standard("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m", [.command]))
        window.addItem(standard("Zoom", #selector(NSWindow.performZoom(_:)), "", []))
        window.addItem(.separator())
        window.addItem(standard("Bring All to Front", #selector(NSApplication.arrangeInFront(_:)), "", []))
        insert(window, after: "Go", in: main)
        NSApp.windowsMenu = window

        // Help: report a problem (a filled-in GitHub issue) or visit the repo.
        let help = NSMenu(title: "Help")
        help.addItem(menuItem("Report a Problem…", "report", "", [], "exclamationmark.bubble"))
        help.addItem(menuItem("Sweeter on GitHub", "github", "", [], "arrow.up.right.square"))
        insert(help, after: "Window", in: main)
        NSApp.helpMenu = help
    }

    /// A standard item sent down the responder chain (target nil).
    private func standard(_ title: String, _ action: Selector, _ key: String, _ mods: NSEvent.ModifierFlags) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.keyEquivalentModifierMask = mods
        return item
    }

    private func wrap(_ menu: NSMenu) -> NSMenuItem {
        let item = NSMenuItem(title: menu.title, action: nil, keyEquivalent: "")
        item.submenu = menu
        return item
    }

    private var goMenu: NSMenu?
    private var filterMenu: NSMenu?

    /// A small round color sample for a menu item.
    private func swatch(_ color: NSColor) -> NSImage {
        NSImage(size: NSSize(width: 12, height: 12), flipped: false) { rect in
            color.setFill()
            NSBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5)).fill()
            NSColor.black.withAlphaComponent(0.15).setStroke()
            let ring = NSBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5))
            ring.lineWidth = 1
            ring.stroke()
            return true
        }
    }

    private func menuItem(_ title: String, _ command: String, _ key: String, _ mods: NSEvent.ModifierFlags, _ symbol: String?) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(runCommand(_:)), keyEquivalent: key)
        item.keyEquivalentModifierMask = mods
        item.representedObject = command
        item.target = self
        if let symbol { item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil) }
        return item
    }

    private func insert(_ menu: NSMenu, after title: String, in main: NSMenu) {
        let item = NSMenuItem(title: menu.title, action: nil, keyEquivalent: "")
        item.submenu = menu
        let index = main.items.firstIndex(where: { $0.submenu?.title == title }).map { $0 + 1 } ?? main.items.count
        main.insertItem(item, at: index)
    }

    @objc func runCommand(_ sender: NSMenuItem) {
        guard let command = sender.representedObject as? String else { return }
        if command == "reload" {
            ViewController.shared?.reloadXPro()
            return
        }
        if command == "newPost" {
            ViewController.shared?.compose()
            return
        }
        ViewController.shared?.showWindow()
        ViewController.shared?.command(command)
    }

    @objc func openSettings() {
        ViewController.shared?.showWindow()
        ViewController.shared?.command("prefs")
    }

    /// Theme checkmarks follow what the page reports.
    @objc func validateMenuItem(_ item: NSMenuItem) -> Bool {
        if item.tag == 1, let command = item.representedObject as? String {
            let skin = ViewController.shared?.pageState["skin"] as? String
            item.state = command == "skin:" + (skin ?? "") ? .on : .off
        }
        if item.tag == 2, let command = item.representedObject as? String {
            let accent = ViewController.shared?.pageState["accent"] as? String ?? "blue"
            item.state = command == "accent:" + accent ? .on : .off
        }
        if item.tag == 3 {
            return ViewController.shared?.pageState["filtersEnabled"] as? Bool ?? false
        }
        if item.tag == 4, let command = item.representedObject as? String {
            let fit = ViewController.shared?.pageState["fit"] as? String ?? "fill"
            item.state = command == "fit:" + fit ? .on : .off
        }
        if item.tag == 5 { item.state = ViewController.shared?.pageState["alertsMuted"] as? Bool == true ? .on : .off }
        if item.tag == 6 { item.state = ViewController.shared?.pageState["snap"] as? Bool == true ? .on : .off }
        return true
    }

    @IBAction func newDocument(_ sender: Any?) {
        newPost()
    }

    @objc func showMain() {
        ViewController.shared?.showWindow()
    }

    @objc func newPost() {
        ViewController.shared?.compose()
    }

    @objc func reloadXPro() {
        ViewController.shared?.reloadXPro()
    }

    @objc func safariSettings() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in }
    }

    // MARK: - Open at Login

    @objc func toggleLogin() {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            Log.write("open at login: \(error.localizedDescription)")
        }
        refreshLoginState()
    }

    func refreshLoginState() {
        loginItem?.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    // MARK: - Global hotkeys

    func registerHotKeys() {
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), hotKeyHandler, 1, &spec, nil, nil)
        register(Self.showHideHotKey, id: 1)
        register(Self.newPostHotKey, id: 2)
    }

    private func register(_ hk: (key: Int, mods: Int, label: String), id: UInt32) {
        var ref: EventHotKeyRef?
        let hotKeyID = EventHotKeyID(signature: OSType(0x5357_5452), id: id) // 'SWTR'
        let status = RegisterEventHotKey(UInt32(hk.key), UInt32(hk.mods), hotKeyID, GetApplicationEventTarget(), 0, &ref)
        if status != noErr { Log.write("hotkey \(hk.label) not registered (\(status))") }
        hotKeyRefs.append(ref)
    }

    @objc func hotKeyPressed(_ note: Notification) {
        switch note.userInfo?["id"] as? UInt32 {
        case 1: ViewController.shared?.toggleWindow()
        case 2: ViewController.shared?.compose()
        default: break
        }
    }

    // MARK: - Notifications

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        let url = info["url"] as? String ?? ""
        let column = info["column"] as? String ?? ""
        let key = info["key"] as? String ?? ""
        DispatchQueue.main.async {
            ViewController.shared?.showWindow()
            // The column that alerted and the post’s block, then its URL.
            if !url.isEmpty || !key.isEmpty { ViewController.shared?.command("openPost:" + column + "\n" + key + "\n" + url) }
        }
        completionHandler()
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}

extension AppDelegate: NSMenuDelegate {
    func menuWillOpen(_ menu: NSMenu) {
        refreshLoginState()
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        if menu === filterMenu {
            menu.removeAllItems()
            let filters = ViewController.shared?.pageState["filters"] as? [[String: Any]] ?? []
            for (i, f) in filters.enumerated() {
                let item = menuItem(f["title"] as? String ?? "Filter", "filter:\(i + 1)", "", [], nil)
                item.tag = 3
                item.state = f["on"] as? Bool == true ? .on : .off
                menu.addItem(item)
            }
            menu.addItem(.separator())
            let clear = menuItem("Clear Filters", "filter:0", "", [], nil)
            clear.tag = 3
            menu.addItem(clear)
            menu.addItem(menuItem("Edit Filters…", "prefs:filters", "", [], nil))
            return
        }
        guard menu === goMenu else { return }
        menu.removeAllItems()
        menu.addItem(menuItem("Next Unread", "nextUnread", "j", [.command], "arrow.down.circle"))
        menu.addItem(menuItem("Previous Unread", "nextUnread:back", "j", [.command, .shift], "arrow.up.circle"))
        menu.addItem(.separator())
        // Decks, from X Pro’s own deck list (⌥⌘1 to ⌥⌘9).
        let decks = ViewController.shared?.pageState["decks"] as? [[String: Any]] ?? []
        if !decks.isEmpty {
            let head = NSMenuItem(title: "Decks", action: nil, keyEquivalent: "")
            head.isEnabled = false
            menu.addItem(head)
            for (i, deck) in decks.prefix(9).enumerated() {
                let item = menuItem(deck["title"] as? String ?? "Deck", "deck:\(i + 1)", String(i + 1), [.command, .option], nil)
                item.state = deck["active"] as? Bool == true ? .on : .off
                menu.addItem(item)
            }
            menu.addItem(menuItem("New Deck…", "deckAction:new", "", [], "plus.square.on.square"))
            menu.addItem(menuItem("Edit Deck…", "deckAction:edit", "", [], "pencil"))
            menu.addItem(menuItem("Manage Decks…", "deckAction:manage", "", [], "square.stack"))
            menu.addItem(menuItem("All Decks…", "overview", "", [], "rectangle.3.group"))
            menu.addItem(.separator())
        }
        // Groups of this deck’s columns (Sweeter only), ⌃⌘0 to ⌃⌘9.
        let groups = ViewController.shared?.pageState["groups"] as? [[String: Any]] ?? []
        if groups.count > 1 {
            let head = NSMenuItem(title: "Groups", action: nil, keyEquivalent: "")
            head.isEnabled = false
            menu.addItem(head)
            for (i, g) in groups.prefix(10).enumerated() {
                let item = menuItem(g["title"] as? String ?? "Group", "group:\(i)", String(i), [.command, .control], nil)
                item.state = g["active"] as? Bool == true ? .on : .off
                menu.addItem(item)
            }
            menu.addItem(.separator())
        }
        let titles = ViewController.shared?.pageState["columns"] as? [String] ?? []
        if titles.isEmpty {
            let empty = NSMenuItem(title: "No Columns Yet", action: nil, keyEquivalent: "")
            empty.isEnabled = false
            menu.addItem(empty)
            return
        }
        for (i, title) in titles.prefix(9).enumerated() {
            menu.addItem(menuItem(title, "column:\(i + 1)", String(i + 1), [.command], nil))
        }
    }
}
