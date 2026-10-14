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
    struct FileRef: Decodable {
        let id: String
        let alt: String
    }

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
    /// The window's own media in this draft, by id, with descriptions.
    let files: [FileRef]
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
    /// Photos or a video pasted or dropped: files, or a pasted image as PNG.
    var onFiles: (([URL], Data?) -> Void)?

    // Files and a copied image become media; rich text from elsewhere
    // comes in as this post's own plain text.
    override func paste(_ sender: Any?) {
        let pb = NSPasteboard.general
        if let onFiles {
            let urls = Self.fileURLs(pb)
            if !urls.isEmpty { return onFiles(urls, nil) }
            if pb.availableType(from: [.string]) == nil, let png = Self.png(pb) { return onFiles([], png) }
        }
        pasteAsPlainText(sender)
    }

    static func fileURLs(_ pb: NSPasteboard) -> [URL] {
        (pb.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL]) ?? []
    }

    static func png(_ pb: NSPasteboard) -> Data? {
        if let d = pb.data(forType: .png) { return d }
        guard let tiff = pb.data(forType: .tiff), let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .png, properties: [:])
    }

    /// Photos and other apps drag a picture as a file promise, which this
    /// view must ask for; NSTextView doesn't register for those itself.
    func acceptPromises() {
        registerForDraggedTypes(registeredDraggedTypes + NSFilePromiseReceiver.readableDraggedTypes.map { NSPasteboard.PasteboardType($0) })
    }

    private func carriesFiles(_ pb: NSPasteboard) -> Bool {
        !Self.fileURLs(pb).isEmpty || pb.canReadObject(forClasses: [NSFilePromiseReceiver.self], options: nil)
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        onFiles != nil && carriesFiles(sender.draggingPasteboard) ? .copy : super.draggingEntered(sender)
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        onFiles != nil && carriesFiles(sender.draggingPasteboard) ? .copy : super.draggingUpdated(sender)
    }

    private static let promiseQueue: OperationQueue = {
        let q = OperationQueue()
        q.qualityOfService = .userInitiated
        return q
    }()

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let pb = sender.draggingPasteboard
        guard let onFiles else { return super.performDragOperation(sender) }
        let urls = Self.fileURLs(pb)
        if !urls.isEmpty {
            onFiles(urls, nil)
            return true
        }
        guard let promises = pb.readObjects(forClasses: [NSFilePromiseReceiver.self], options: nil) as? [NSFilePromiseReceiver], !promises.isEmpty else {
            return super.performDragOperation(sender)
        }
        // Each promised file is written to a folder of its own, then they come in together.
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("SweeterDrops", isDirectory: true).appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let group = DispatchGroup()
        let lock = NSLock()
        var got: [URL] = []
        for p in promises {
            group.enter()
            p.receivePromisedFiles(atDestination: dir, options: [:], operationQueue: Self.promiseQueue) { url, error in
                if error == nil {
                    lock.lock()
                    got.append(url)
                    lock.unlock()
                }
                group.leave()
            }
        }
        group.notify(queue: .main) {
            MainActor.assumeIsolated {
                if !got.isEmpty { onFiles(got, nil) }
            }
        }
        return true
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
    /// Bytes are on their way to the page: nothing else may start, whatever
    /// a late state says.
    private var uploading = false
    /// The page is deciding on new media.
    private var adding = false
    /// The page closed the window: it needs no word back.
    private var closingFromPage = false
    private var asked = ""
    private var syncTimer: Timer?

    /// The open post's media, and every draft's this session (its bytes
    /// stay here until Post).
    private var media: [ComposeMedia] = []
    private var mediaByKey: [String: [ComposeMedia]] = [:]
    private let mediaRow = NSStackView()
    private let mediaScroll = NSScrollView()
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
        textView.onFiles = { [weak self] urls, png in self?.add(urls: urls, png: png) }
        textView.acceptPromises()
        mediaRow.orientation = .horizontal
        mediaRow.spacing = 8
        mediaRow.alignment = .centerY
        mediaRow.translatesAutoresizingMaskIntoConstraints = false
        // Wider than the window: the row scrolls sideways.
        mediaScroll.documentView = mediaRow
        mediaScroll.hasHorizontalScroller = true
        mediaScroll.hasVerticalScroller = false
        mediaScroll.autohidesScrollers = true
        mediaScroll.drawsBackground = false
        mediaScroll.borderType = .noBorder
        mediaScroll.verticalScrollElasticity = .none
        mediaScroll.heightAnchor.constraint(equalToConstant: ComposeMediaTile.height + 4).isActive = true
        NSLayoutConstraint.activate([
            mediaRow.leadingAnchor.constraint(equalTo: mediaScroll.contentView.leadingAnchor),
            mediaRow.topAnchor.constraint(equalTo: mediaScroll.contentView.topAnchor, constant: 2),
        ])
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

        let stack = NSStackView(views: [noteLabel, contextLabel, quoteBox, scroll, mediaScroll, cardBox, bar])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 12, left: 16, bottom: 10, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        for v in [noteLabel, quoteBox, scroll, mediaScroll, cardBox, bar] as [NSView] {
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
        let known = mediaByKey[snap.key] ?? []
        media = snap.files.compactMap { f in
            guard let m = known.first(where: { $0.id == f.id }) else { return nil }
            m.alt = f.alt
            return m
        }
        mediaByKey[snap.key] = media
        rebuildMediaRow()
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

    /// The page closes the window. done: the post was sent or handed on
    /// with its bytes, so its media are done here; otherwise the draft
    /// keeps them for when it opens again.
    func closeFromPage(done: Bool) {
        guard isOpen else { return }
        if done { mediaByKey[key] = nil }
        syncTimer?.invalidate()
        syncTimer = nil
        closingFromPage = true
        window?.close()
    }

    private func apply(_ s: ComposeState) {
        postButton.title = s.post.isEmpty ? "Post" : s.post
        // While bytes go to the page, the window stays as the upload set it.
        if uploading { return }
        busy = s.busy
        statusLabel.stringValue = s.status
        statusLabel.textColor = s.invalid ? .systemRed : .secondaryLabelColor
        statusLabel.toolTip = s.status.isEmpty ? nil : s.status
        if busy { spinner.startAnimation(nil) } else { spinner.stopAnimation(nil) }
        postButton.isEnabled = !busy
        textView.isEditable = !busy
        replyPopUp.isEnabled = !busy
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
        var traits = (f ?? baseFont).fontDescriptor.symbolicTraits.intersection([.bold, .italic])
        if on { traits.insert(style.trait) } else { traits.remove(style.trait) }
        return face(traits)
    }

    private static var faces: [UInt32: NSFont] = [:]

    /// The system font at the post's size, bold, italic, both or neither:
    /// only those two traits, and both kept when a face lacks one.
    static func face(_ traits: NSFontDescriptor.SymbolicTraits) -> NSFont {
        let t = traits.intersection([.bold, .italic])
        if let f = faces[t.rawValue] { return f }
        var f = NSFont(descriptor: baseFont.fontDescriptor.withSymbolicTraits(t), size: baseFont.pointSize) ?? baseFont
        if !f.fontDescriptor.symbolicTraits.isSuperset(of: t) {
            f = baseFont
            if t.contains(.bold) { f = NSFontManager.shared.convert(f, toHaveTrait: .boldFontMask) }
            if t.contains(.italic) { f = NSFontManager.shared.convert(f, toHaveTrait: .italicFontMask) }
        }
        faces[t.rawValue] = f
        return f
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
            let f = Self.face(((v as? NSFont) ?? Self.baseFont).fontDescriptor.symbolicTraits)
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
            "files": media.map { ["id": $0.id, "name": $0.name, "type": $0.type, "size": $0.size, "alt": $0.alt] as [String: Any] },
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
        withMedia("post", draft())
    }

    /// A request that needs the media's bytes on the page first (Post, and
    /// a move to the web window or X Pro): they go, then the request.
    private func withMedia(_ op: String, _ d: [String: Any]) {
        guard !uploading else { return }
        syncTimer?.invalidate()
        syncTimer = nil
        busy = true
        postButton.isEnabled = false
        textView.isEditable = false
        replyPopUp.isEnabled = false
        guard !media.isEmpty else { return send(op, d) }
        uploading = true
        spinner.startAnimation(nil)
        statusLabel.stringValue = media.contains { $0.type.hasPrefix("video/") } ? "Preparing the video…" : "Preparing the media…"
        statusLabel.textColor = .secondaryLabelColor
        let key = self.key
        upload(media) { [weak self] problem in
            guard let self else { return }
            self.uploading = false
            guard self.isOpen, self.key == key else { return }
            guard let problem else { return self.send(op, d) }
            self.busy = false
            self.postButton.isEnabled = true
            self.textView.isEditable = true
            self.replyPopUp.isEnabled = true
            self.spinner.stopAnimation(nil)
            self.statusLabel.stringValue = problem
            self.statusLabel.textColor = .systemRed
        }
    }

    private static let partSize = 1_500_000

    /// Each file's bytes to the page in base64 parts, in order (app.js
    /// macFile); nil when all arrived, or what went wrong.
    private func upload(_ items: [ComposeMedia], done: @escaping (String?) -> Void) {
        guard let vc = ViewController.shared else { return done("X Pro’s page isn’t open. Nothing was posted.") }
        var queue: [(ComposeMedia, Data)] = []
        for m in items {
            guard let data = try? m.bytes() else { return done("Sweeter couldn’t read “\(m.name)”. Nothing was posted.") }
            queue.append((m, data))
        }
        func next(_ i: Int, _ part: Int) {
            guard i < queue.count else { return done(nil) }
            let (m, data) = queue[i]
            let parts = max(1, (data.count + Self.partSize - 1) / Self.partSize)
            let lo = part * Self.partSize
            let chunk = data.subdata(in: lo ..< min(data.count, lo + Self.partSize))
            let arg: [String: Any] = ["id": m.id, "name": m.name, "type": m.type, "part": part, "parts": parts, "b64": chunk.base64EncodedString()]
            vc.composeOp("file", arg) { reply in
                guard let r = reply as? String, r == "more" || r == "done" else { return done("X Pro’s page didn’t take the media. Nothing was posted.") }
                if part + 1 < parts { next(i, part + 1) } else { next(i + 1, 0) }
            }
        }
        next(0, 0)
    }

    // MARK: Photos and video

    private func choosePhotos() {
        guard let window else { return }
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = ComposeMedia.types
        panel.message = "Up to four photos, or one video or GIF."
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK else { return }
            self?.add(urls: panel.urls, png: nil)
        }
    }

    /// New media, as far as X allows (the page decides: app.js mediaCheck).
    private func add(urls: [URL], png: Data?) {
        guard isOpen, !busy, !adding else { return NSSound.beep() }
        var items = urls.compactMap { ComposeMedia(url: $0) }
        if let png { items.append(ComposeMedia(png: png)) }
        guard !items.isEmpty else { return }
        syncTimer?.invalidate()
        syncTimer = nil
        var d = draft()
        d["incoming"] = items.map { ["name": $0.name, "type": $0.type, "size": $0.size] as [String: Any] }
        let key = self.key
        guard let vc = ViewController.shared else { return }
        adding = true
        vc.composeOp("add", d) { [weak self] reply in
            guard let self else { return }
            self.adding = false
            guard self.isOpen, self.key == key, let text = reply as? String, let data = text.data(using: .utf8),
                  let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            let take = (o["take"] as? [Int]) ?? []
            for i in take where i >= 0 && i < items.count { self.media.append(items[i]) }
            self.mediaByKey[key] = self.media
            self.rebuildMediaRow()
            // The page's status line says what it didn't take; the sync's state carries it.
            self.sync()
        }
    }

    private func removeMedia(_ id: String) {
        guard !busy else { return }
        media.removeAll { $0.id == id }
        mediaByKey[key] = media
        rebuildMediaRow()
        sync()
    }

    private func rebuildMediaRow() {
        for v in mediaRow.arrangedSubviews {
            mediaRow.removeArrangedSubview(v)
            v.removeFromSuperview()
        }
        for m in media {
            let tile = ComposeMediaTile(media: m)
            tile.onRemove = { [weak self] in self?.removeMedia(m.id) }
            tile.onAlt = { [weak self, weak tile] anchor in
                guard let self, !self.busy else { return }
                ComposeAltController(media: m) { [weak self] in
                    tile?.refresh()
                    self?.sync()
                }.show(from: anchor)
            }
            mediaRow.addArrangedSubview(tile)
        }
        mediaScroll.isHidden = media.isEmpty
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
        case .photo:
            choosePhotos()
        default:
            // Not drawn here yet: the web compose window takes the draft
            // (with its media) and opens the tool.
            var d = draft()
            d["tool"] = tool.rawValue
            withMedia("web", d)
        }
    }

    @objc private func xpro(_ sender: NSMenuItem) {
        guard !busy, let tool = sender.representedObject as? String else { return }
        var d = draft()
        d["tool"] = tool
        withMedia("xpro", d)
    }
}
