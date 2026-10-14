//
//  ComposeWindow.swift
//  Sweeter
//
//  The compose window as a Mac window (Settings ▸ Media ▸ Compose, beta):
//  a toolbar in the title bar, a native text view with real bold and
//  italic, and a pop-up button for who can reply. The page stays the owner
//  of the post (app.js, “the Mac compose window”): it opens the window
//  with a snapshot of the draft (composeShow), hears every edit
//  (Sweeter.native.cw), saves the draft, counts the text, posts it through
//  X Pro, reports back while it does (composeState), and closes the window
//  when the post is done (composeHide). A tool this window doesn't draw
//  yet hands the draft to the web compose window.
//

import Cocoa

// MARK: - The page's side

/// A compose window as the page opens it (app.js nativeSnapshot).
struct ComposeSnapshot: Decodable {
    struct Context: Decodable {
        let label: String
        let name: String
        let handle: String
        let text: String
    }

    let key: String
    let kind: String
    let title: String
    let account: String
    let placeholder: String
    let context: Context?
    let note: String
    let text: String
    let bold: [[Int]]
    let italic: [[Int]]
    let reply: String
    let replyOptions: [String]
    let replyHidden: Bool
    /// The tools this window offers: native ones, and the rest that open
    /// the web window (an edit has only text tools).
    let tools: [String]
    let state: ComposeState
}

/// What the page reports while the window is open (app.js nativeState).
struct ComposeState: Decodable {
    struct Card: Decodable {
        let host: String
        let title: String
        let image: String
    }

    let status: String
    let busy: Bool
    let post: String
    let count: String
    let level: String
    let links: [[Int]]
    let invalid: Bool
    /// "alttext" while X Pro's image description reminder waits.
    let ask: String
    let card: Card?
}

// MARK: - The text view

/// The post's text: plain text with real bold and italic (what X shows),
/// links underlined as X will link them, and a placeholder.
final class ComposeTextView: NSTextView {
    var placeholder = "" {
        didSet { needsDisplay = true }
    }
    var onEscape: (() -> Void)?
    var onStyle: ((ComposeStyle) -> Void)?

    // Rich text from elsewhere comes in as this post's own plain text.
    override func paste(_ sender: Any?) {
        pasteAsPlainText(sender)
    }

    override func cancelOperation(_ sender: Any?) {
        onEscape?()
    }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard window?.firstResponder === self, event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command else {
            return super.performKeyEquivalent(with: event)
        }
        switch event.charactersIgnoringModifiers?.lowercased() {
        case "b":
            onStyle?(.bold)
            return true
        case "i":
            onStyle?(.italic)
            return true
        default:
            return super.performKeyEquivalent(with: event)
        }
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard string.isEmpty, !placeholder.isEmpty else { return }
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font ?? ComposeWindowController.baseFont,
            .foregroundColor: NSColor.placeholderTextColor,
        ]
        let x = textContainerInset.width + (textContainer?.lineFragmentPadding ?? 0)
        (placeholder as NSString).draw(at: NSPoint(x: x, y: textContainerInset.height), withAttributes: attrs)
    }

    override func didChangeText() {
        super.didChangeText()
        needsDisplay = true
    }
}

enum ComposeStyle {
    case bold, italic

    var trait: NSFontDescriptor.SymbolicTraits { self == .bold ? .bold : .italic }
}

// MARK: - The window

final class ComposeWindowController: NSWindowController, NSWindowDelegate, NSToolbarDelegate, NSTextViewDelegate {
    static let shared = ComposeWindowController()
    static let baseFont = NSFont.systemFont(ofSize: 14)
    /// The window exists (a page reload or report may need to reach it).
    private(set) static var made = false

    private(set) var isOpen = false
    private var key = ""
    private var kind = "new"
    private var tools: [String] = []
    private var busy = false
    /// The page closed the window: it needs no word back.
    private var closingFromPage = false
    private var asked = ""
    private var syncTimer: Timer?

    private let textView = ComposeTextView(usingTextLayoutManager: false)
    private let scroll = NSScrollView()
    private let noteLabel = NSTextField(wrappingLabelWithString: "")
    private let contextLabel = NSTextField(labelWithString: "")
    private let quoteName = NSTextField(labelWithString: "")
    private let quoteText = NSTextField(wrappingLabelWithString: "")
    private let quoteBox = NSBox()
    private let cardBox = NSBox()
    private let cardImage = NSImageView()
    private let cardHost = NSTextField(labelWithString: "")
    private let cardTitle = NSTextField(labelWithString: "")
    private let replyPopUp = NSPopUpButton(frame: .zero, pullsDown: false)
    private let spinner = NSProgressIndicator()
    private let statusLabel = NSTextField(labelWithString: "")
    private let countLabel = NSTextField(labelWithString: "")
    private let postButton = NSButton(title: "Post", target: nil, action: nil)

    private init() {
        let panel = QuietPanel(contentRect: NSRect(x: 0, y: 0, width: 560, height: 380), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: true)
        panel.isReleasedWhenClosed = false
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = true
        // A window of its own to the person: Mission Control and ⌘` too.
        panel.collectionBehavior = [.managed, .participatesInCycle, .fullScreenAuxiliary]
        panel.becomesKeyOnlyIfNeeded = false
        panel.contentMinSize = NSSize(width: 420, height: 240)
        panel.toolbarStyle = .unified
        super.init(window: panel)
        Self.made = true
        panel.delegate = self
        build()
        let toolbar = NSToolbar(identifier: "SweeterCompose")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        panel.toolbar = toolbar
        if !panel.setFrameUsingName("SweeterComposeMac") { panel.center() }
        panel.setFrameAutosaveName("SweeterComposeMac")
    }

    required init?(coder: NSCoder) { nil }

    // MARK: Layout

    private func build() {
        let content = NSView()

        noteLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        noteLabel.textColor = .secondaryLabelColor

        contextLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        contextLabel.textColor = .secondaryLabelColor
        quoteName.font = .boldSystemFont(ofSize: NSFont.smallSystemFontSize)
        quoteName.lineBreakMode = .byTruncatingTail
        quoteText.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        quoteText.textColor = .secondaryLabelColor
        quoteText.maximumNumberOfLines = 4
        quoteText.lineBreakMode = .byTruncatingTail
        let quoteStack = NSStackView(views: [quoteName, quoteText])
        quoteStack.orientation = .vertical
        quoteStack.alignment = .leading
        quoteStack.spacing = 2
        quoteBox.boxType = .custom
        quoteBox.cornerRadius = 8
        quoteBox.borderColor = .separatorColor
        quoteBox.borderWidth = 1
        quoteBox.fillColor = .clear
        quoteBox.titlePosition = .noTitle
        quoteBox.contentViewMargins = NSSize(width: 10, height: 8)
        quoteBox.contentView = quoteStack

        textView.delegate = self
        textView.font = Self.baseFont
        textView.typingAttributes = [.font: Self.baseFont, .foregroundColor: NSColor.textColor]
        textView.isRichText = true
        textView.importsGraphics = false
        textView.allowsUndo = true
        textView.isContinuousSpellCheckingEnabled = true
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 2, height: 4)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.minSize = .zero
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        textView.textContainer?.containerSize = NSSize(width: 500, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = true
        textView.onEscape = { [weak self] in self?.window?.performClose(nil) }
        textView.onStyle = { [weak self] style in self?.toggle(style) }
        scroll.documentView = textView
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        scroll.borderType = .noBorder

        cardImage.imageScaling = .scaleProportionallyUpOrDown
        cardImage.wantsLayer = true
        cardImage.layer?.cornerRadius = 4
        cardImage.layer?.masksToBounds = true
        cardHost.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        cardHost.textColor = .secondaryLabelColor
        cardTitle.font = .systemFont(ofSize: NSFont.smallSystemFontSize, weight: .medium)
        cardTitle.lineBreakMode = .byTruncatingTail
        let cardText = NSStackView(views: [cardHost, cardTitle])
        cardText.orientation = .vertical
        cardText.alignment = .leading
        cardText.spacing = 1
        let cardRow = NSStackView(views: [cardImage, cardText])
        cardRow.spacing = 8
        cardImage.widthAnchor.constraint(equalToConstant: 44).isActive = true
        cardImage.heightAnchor.constraint(equalToConstant: 44).isActive = true
        cardBox.boxType = .custom
        cardBox.cornerRadius = 8
        cardBox.borderColor = .separatorColor
        cardBox.borderWidth = 1
        cardBox.fillColor = .clear
        cardBox.titlePosition = .noTitle
        cardBox.contentViewMargins = NSSize(width: 8, height: 6)
        cardBox.contentView = cardRow
        cardBox.toolTip = "A preview of the page. X makes the card itself when you post."

        replyPopUp.target = self
        replyPopUp.action = #selector(replyChanged)
        replyPopUp.controlSize = .small
        replyPopUp.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        spinner.style = .spinning
        spinner.controlSize = .small
        spinner.isDisplayedWhenStopped = false
        statusLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        statusLabel.textColor = .secondaryLabelColor
        statusLabel.lineBreakMode = .byTruncatingTail
        statusLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        statusLabel.allowsExpansionToolTips = true
        countLabel.font = .monospacedDigitSystemFont(ofSize: NSFont.smallSystemFontSize, weight: .regular)
        countLabel.textColor = .secondaryLabelColor
        countLabel.alignment = .right
        countLabel.setContentHuggingPriority(.required, for: .horizontal)
        let bar = NSStackView(views: [replyPopUp, spinner, statusLabel, countLabel])
        bar.spacing = 8
        bar.setHuggingPriority(.defaultLow, for: .horizontal)
        statusLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

        let stack = NSStackView(views: [noteLabel, contextLabel, quoteBox, scroll, cardBox, bar])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 12, left: 16, bottom: 10, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        for v in [noteLabel, quoteBox, scroll, cardBox, bar] as [NSView] {
            v.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -32).isActive = true
        }
        scroll.setContentHuggingPriority(.defaultLow, for: .vertical)
        scroll.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 80).isActive = true
        content.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            stack.topAnchor.constraint(equalTo: content.topAnchor),
            stack.bottomAnchor.constraint(equalTo: content.bottomAnchor),
        ])
        window?.contentView = content

        postButton.bezelStyle = .push
        postButton.bezelColor = .controlAccentColor
        postButton.keyEquivalent = "\r"
        postButton.keyEquivalentModifierMask = [.command]
        postButton.target = self
        postButton.action = #selector(post)
        postButton.toolTip = "Post (⌘Return)"
    }

    // MARK: The page opens, updates and closes it

    /// Opens the window on a draft, or puts another draft in the open one.
    func show(json: String) {
        guard let data = json.data(using: .utf8), let snap = try? JSONDecoder().decode(ComposeSnapshot.self, from: data) else {
            Log.write("compose window: bad snapshot")
            return
        }
        // An edit still waiting to reach the page goes first.
        flushSync()
        key = snap.key
        kind = snap.kind
        tools = snap.tools
        asked = ""
        window?.title = snap.title
        window?.subtitle = snap.account
        textView.placeholder = snap.placeholder
        noteLabel.stringValue = snap.note
        noteLabel.isHidden = snap.note.isEmpty
        if let c = snap.context {
            contextLabel.stringValue = c.label
            quoteName.stringValue = c.name.isEmpty ? c.handle : c.name + "  " + c.handle
            quoteText.stringValue = c.text
            contextLabel.isHidden = c.label.isEmpty
            quoteBox.isHidden = false
        } else {
            contextLabel.isHidden = true
            quoteBox.isHidden = true
        }
        setText(snap.text, bold: snap.bold, italic: snap.italic)
        replyPopUp.removeAllItems()
        for o in snap.replyOptions {
            replyPopUp.addItem(withTitle: o + " can reply")
            replyPopUp.lastItem?.representedObject = o
        }
        if let i = snap.replyOptions.firstIndex(of: snap.reply) { replyPopUp.selectItem(at: i) }
        replyPopUp.isHidden = snap.replyHidden
        rebuildToolbar()
        apply(snap.state)
        isOpen = true
        closingFromPage = false
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        window?.makeFirstResponder(textView)
        textView.setSelectedRange(NSRange(location: (textView.string as NSString).length, length: 0))
    }

    /// The page's report: status, progress, the count, links and the card.
    func update(json: String) {
        guard isOpen, let data = json.data(using: .utf8), let s = try? JSONDecoder().decode(ComposeState.self, from: data) else { return }
        apply(s)
    }

    /// The page is done with the window (posted, or moved elsewhere).
    func closeFromPage() {
        guard isOpen else { return }
        syncTimer?.invalidate()
        syncTimer = nil
        closingFromPage = true
        window?.close()
    }

    private func apply(_ s: ComposeState) {
        busy = s.busy
        statusLabel.stringValue = s.status
        statusLabel.textColor = s.invalid ? .systemRed : .secondaryLabelColor
        statusLabel.toolTip = s.status.isEmpty ? nil : s.status
        if s.busy { spinner.startAnimation(nil) } else { spinner.stopAnimation(nil) }
        postButton.title = s.post.isEmpty ? "Post" : s.post
        postButton.isEnabled = !s.busy
        textView.isEditable = !s.busy
        replyPopUp.isEnabled = !s.busy
        countLabel.stringValue = s.count
        countLabel.textColor = s.level == "over" ? .systemRed : s.level == "long" ? .systemOrange : .secondaryLabelColor
        underline(s.links)
        showCard(s.card)
        if s.ask != asked {
            asked = s.ask
            if s.ask == "alttext" { askAltText() }
        }
    }

    // MARK: Text, bold and italic

    private func setText(_ text: String, bold: [[Int]], italic: [[Int]]) {
        let s = NSMutableAttributedString(string: text, attributes: [.font: Self.baseFont, .foregroundColor: NSColor.textColor])
        let n = s.length
        for (ranges, style) in [(bold, ComposeStyle.bold), (italic, .italic)] {
            for r in ranges where r.count == 2 {
                let a = max(0, min(n, r[0])), b = max(a, min(n, r[1]))
                guard b > a else { continue }
                s.enumerateAttribute(.font, in: NSRange(location: a, length: b - a)) { v, sub, _ in
                    s.addAttribute(.font, value: Self.font(v as? NSFont, style, on: true), range: sub)
                }
            }
        }
        textView.textStorage?.setAttributedString(s)
        textView.typingAttributes = [.font: Self.baseFont, .foregroundColor: NSColor.textColor]
        textView.undoManager?.removeAllActions()
        textView.needsDisplay = true
    }

    static func font(_ f: NSFont?, _ style: ComposeStyle, on: Bool) -> NSFont {
        let f = f ?? baseFont
        var traits = f.fontDescriptor.symbolicTraits
        if on { traits.insert(style.trait) } else { traits.remove(style.trait) }
        return NSFont(descriptor: baseFont.fontDescriptor.withSymbolicTraits(traits), size: baseFont.pointSize) ?? baseFont
    }

    /// ⌘B, ⌘I and the toolbar: the selection becomes bold (italic) unless
    /// all of it already is; with nothing selected, what is typed next.
    private func toggle(_ style: ComposeStyle) {
        guard textView.isEditable, let storage = textView.textStorage else { return }
        let range = textView.selectedRange()
        if range.length == 0 {
            var attrs = textView.typingAttributes
            let f = attrs[.font] as? NSFont ?? Self.baseFont
            attrs[.font] = Self.font(f, style, on: !f.fontDescriptor.symbolicTraits.contains(style.trait))
            textView.typingAttributes = attrs
            return
        }
        var all = true
        storage.enumerateAttribute(.font, in: range) { v, _, _ in
            if !((v as? NSFont) ?? Self.baseFont).fontDescriptor.symbolicTraits.contains(style.trait) { all = false }
        }
        guard textView.shouldChangeText(in: range, replacementString: nil) else { return }
        storage.beginEditing()
        storage.enumerateAttribute(.font, in: range) { v, sub, _ in
            storage.addAttribute(.font, value: Self.font(v as? NSFont, style, on: !all), range: sub)
        }
        storage.endEditing()
        textView.didChangeText()
    }

    /// Bold and italic runs as the page keeps them: [start, end) in UTF-16
    /// units, which NSString counts too.
    private func styles() -> (bold: [[Int]], italic: [[Int]]) {
        var bold: [[Int]] = [], italic: [[Int]] = []
        guard let storage = textView.textStorage else { return ([], []) }
        storage.enumerateAttribute(.font, in: NSRange(location: 0, length: storage.length)) { v, r, _ in
            let t = ((v as? NSFont) ?? Self.baseFont).fontDescriptor.symbolicTraits
            if t.contains(.bold) { bold.append([r.location, r.location + r.length]) }
            if t.contains(.italic) { italic.append([r.location, r.location + r.length]) }
        }
        return (bold, italic)
    }

    /// Only the system font, in bold and italic or not: text dropped in from
    /// elsewhere keeps its words and loses its looks.
    private func normalizeLooks() {
        guard let storage = textView.textStorage, storage.length > 0 else { return }
        let all = NSRange(location: 0, length: storage.length)
        var odd = false
        storage.enumerateAttributes(in: all) { attrs, _, stop in
            let f = attrs[.font] as? NSFont
            if attrs.keys.contains(where: { $0 != .font && $0 != .foregroundColor && $0 != .paragraphStyle }) || f?.familyName != Self.baseFont.familyName || f?.pointSize != Self.baseFont.pointSize {
                odd = true
                stop.pointee = true
            }
        }
        guard odd else { return }
        storage.beginEditing()
        storage.enumerateAttribute(.font, in: all) { v, r, _ in
            let t = ((v as? NSFont) ?? Self.baseFont).fontDescriptor.symbolicTraits.intersection([.bold, .italic])
            let f = NSFont(descriptor: Self.baseFont.fontDescriptor.withSymbolicTraits(t), size: Self.baseFont.pointSize) ?? Self.baseFont
            storage.setAttributes([.font: f, .foregroundColor: NSColor.textColor], range: r)
        }
        storage.endEditing()
    }

    private func underline(_ links: [[Int]]) {
        guard let lm = textView.layoutManager else { return }
        let n = (textView.string as NSString).length
        lm.removeTemporaryAttribute(.underlineStyle, forCharacterRange: NSRange(location: 0, length: n))
        lm.removeTemporaryAttribute(.foregroundColor, forCharacterRange: NSRange(location: 0, length: n))
        for l in links where l.count == 2 {
            let a = max(0, min(n, l[0])), b = max(a, min(n, l[1]))
            guard b > a else { continue }
            let r = NSRange(location: a, length: b - a)
            lm.addTemporaryAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, forCharacterRange: r)
            lm.addTemporaryAttribute(.foregroundColor, value: NSColor.linkColor, forCharacterRange: r)
        }
    }

    private func showCard(_ card: ComposeState.Card?) {
        guard let card, !(card.title.isEmpty && card.image.isEmpty) else {
            cardBox.isHidden = true
            return
        }
        cardHost.stringValue = card.host.hasPrefix("www.") ? String(card.host.dropFirst(4)) : card.host
        cardTitle.stringValue = card.title
        cardTitle.isHidden = card.title.isEmpty
        if let comma = card.image.firstIndex(of: ","), card.image.hasPrefix("data:image/"), let data = Data(base64Encoded: String(card.image[card.image.index(after: comma)...])), let img = NSImage(data: data) {
            cardImage.image = img
            cardImage.isHidden = false
        } else {
            cardImage.image = nil
            cardImage.isHidden = true
        }
        cardBox.isHidden = false
    }

    // MARK: Edits go to the page

    func textDidChange(_ notification: Notification) {
        normalizeLooks()
        scheduleSync()
    }

    @objc private func replyChanged() {
        sync()
    }

    private func scheduleSync() {
        syncTimer?.invalidate()
        syncTimer = Timer.scheduledTimer(withTimeInterval: 0.12, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated { self?.sync() }
        }
    }

    private func flushSync() {
        guard syncTimer != nil else { return }
        sync()
    }

    /// The draft as it is now, for the page.
    private func draft() -> [String: Any] {
        let s = styles()
        return [
            "key": key,
            "text": textView.string,
            "bold": s.bold,
            "italic": s.italic,
            "reply": replyPopUp.selectedItem?.representedObject as? String ?? "Everyone",
        ]
    }

    private func sync() {
        syncTimer?.invalidate()
        syncTimer = nil
        guard isOpen else { return }
        send("edit", draft())
    }

    /// One request to the page; its reply, when it has one, is a state.
    private func send(_ op: String, _ arg: Any?) {
        guard let vc = ViewController.shared else { return }
        vc.composeOp(op, arg) { [weak self] reply in
            guard let self, self.isOpen, let text = reply as? String, !text.isEmpty else { return }
            self.update(json: text)
        }
    }

    @objc private func post() {
        guard isOpen, !busy else { return }
        syncTimer?.invalidate()
        syncTimer = nil
        busy = true
        postButton.isEnabled = false
        send("post", draft())
    }

    // MARK: Closing

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closingFromPage { return true }
        // The page keeps the draft; the window closes whether or not it answers.
        syncTimer?.invalidate()
        syncTimer = nil
        if isOpen { ViewController.shared?.composeOp("close", draft()) { _ in } }
        return true
    }

    /// Escape anywhere in the window closes it and keeps the draft.
    override func cancelOperation(_ sender: Any?) {
        window?.performClose(nil)
    }

    func windowWillClose(_ notification: Notification) {
        isOpen = false
        closingFromPage = false
        busy = false
        if let sheet = window?.attachedSheet { window?.endSheet(sheet) }
    }

    // MARK: X Pro's image description reminder

    private func askAltText() {
        guard let window else { return }
        let alert = NSAlert()
        alert.messageText = "Describe your images?"
        alert.informativeText = "X Pro reminds you to describe your images for people who can’t see them."
        alert.addButton(withTitle: "Describe in X Pro")
        alert.addButton(withTitle: "Not This Time")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { [weak self] response in
            guard let self, self.isOpen else { return }
            let choice = response == .alertFirstButtonReturn ? "add" : response == .alertSecondButtonReturn ? "post" : "back"
            self.send("alt", ["choice": choice])
        }
    }

    // MARK: The toolbar

    private enum Tool: String, CaseIterable {
        case photo, gif, emoji, bold, italic, poll, schedule, thread

        var symbol: String {
            switch self {
            case .photo: return "photo.on.rectangle"
            case .gif: return "rectangle.and.text.magnifyingglass"
            case .emoji: return "face.smiling"
            case .bold: return "bold"
            case .italic: return "italic"
            case .poll: return "chart.bar.xaxis"
            case .schedule: return "calendar.badge.clock"
            case .thread: return "plus.square.on.square"
            }
        }

        var label: String {
            switch self {
            case .photo: return "Photos or Video"
            case .gif: return "GIF"
            case .emoji: return "Emoji"
            case .bold: return "Bold"
            case .italic: return "Italic"
            case .poll: return "Poll"
            case .schedule: return "Schedule"
            case .thread: return "Add Post"
            }
        }

        var tip: String {
            switch self {
            case .photo: return "Add photos or a video"
            case .gif: return "Add a GIF"
            case .emoji: return "Emoji & Symbols (⌃⌘Space)"
            case .bold: return "Bold (⌘B)"
            case .italic: return "Italic (⌘I)"
            case .poll: return "Add a poll"
            case .schedule: return "Schedule the post"
            case .thread: return "Add a post to make a thread"
            }
        }
    }

    private static let moreID = NSToolbarItem.Identifier("more")
    private static let postID = NSToolbarItem.Identifier("post")

    private func identifiers() -> [NSToolbarItem.Identifier] {
        let mine = Tool.allCases.filter { tools.contains($0.rawValue) }.map { NSToolbarItem.Identifier($0.rawValue) }
        return mine + [.flexibleSpace] + (tools.contains("xpro") ? [Self.moreID] : []) + [Self.postID]
    }

    /// The items for this draft (an edit has fewer), in order.
    private func rebuildToolbar() {
        guard let toolbar = window?.toolbar else { return }
        let want = identifiers()
        if toolbar.items.map(\.itemIdentifier) == want { return }
        while !toolbar.items.isEmpty { toolbar.removeItem(at: 0) }
        for (i, id) in want.enumerated() { toolbar.insertItem(withItemIdentifier: id, at: i) }
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        Tool.allCases.map { NSToolbarItem.Identifier($0.rawValue) } + [.flexibleSpace, Self.moreID, Self.postID]
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        identifiers()
    }

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        if id == Self.postID {
            let item = NSToolbarItem(itemIdentifier: id)
            item.view = postButton
            item.label = "Post"
            return item
        }
        if id == Self.moreID {
            let item = NSMenuToolbarItem(itemIdentifier: id)
            item.image = NSImage(systemSymbolName: "ellipsis.circle", accessibilityDescription: "X Pro")
            item.label = "X Pro"
            item.toolTip = "Finish in X Pro’s own composer"
            item.showsIndicator = true
            let menu = NSMenu()
            for (title, tool) in [("Open in X Pro", "xpro"), ("Tag a Location in X Pro", "location"), ("Make an Image with Grok in X Pro", "grok")] {
                let m = NSMenuItem(title: title, action: #selector(xpro(_:)), keyEquivalent: "")
                m.target = self
                m.representedObject = tool
                menu.addItem(m)
            }
            item.menu = menu
            return item
        }
        guard let tool = Tool(rawValue: id.rawValue) else { return nil }
        let item = NSToolbarItem(itemIdentifier: id)
        item.image = NSImage(systemSymbolName: tool.symbol, accessibilityDescription: tool.label)
        item.label = tool.label
        item.toolTip = tool.tip
        item.isBordered = true
        item.target = self
        item.action = #selector(toolPressed(_:))
        return item
    }

    @objc private func toolPressed(_ sender: NSToolbarItem) {
        guard !busy, let tool = Tool(rawValue: sender.itemIdentifier.rawValue) else { return }
        switch tool {
        case .bold:
            window?.makeFirstResponder(textView)
            toggle(.bold)
        case .italic:
            window?.makeFirstResponder(textView)
            toggle(.italic)
        case .emoji:
            window?.makeFirstResponder(textView)
            NSApp.orderFrontCharacterPalette(textView)
        default:
            // Not drawn here yet: the web compose window takes the draft and opens it.
            syncTimer?.invalidate()
            syncTimer = nil
            var d = draft()
            d["tool"] = tool.rawValue
            send("web", d)
        }
    }

    @objc private func xpro(_ sender: NSMenuItem) {
        guard !busy, let tool = sender.representedObject as? String else { return }
        syncTimer?.invalidate()
        syncTimer = nil
        var d = draft()
        d["tool"] = tool
        send("xpro", d)
    }
}
