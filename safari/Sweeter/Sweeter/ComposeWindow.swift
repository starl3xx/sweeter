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
//  when the post is done (composeHide).
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
    /// A GIF from X Pro's search.
    let gif: ComposeGif?
    struct PollRef: Decodable {
        let choices: [String]
        let days: Int
        let hours: Int
        let minutes: Int
    }

    struct WhenRef: Decodable {
        let y: Int, mo: Int, d: Int, h: Int, mi: Int
    }

    let poll: PollRef?
    let when: WhenRef?

    /// Every post of a thread (the open one too), and which is open.
    struct PostRef: Decodable {
        let text: String
        let bold: [[Int]]
        let italic: [[Int]]
        let files: [FileRef]
        let gif: ComposeGif?
        let poll: PollRef?
    }

    let thread: [PostRef]?
    let at: Int?
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
    /// The window's title (“New post · 2 of 3”), and, in Post's answer
    /// only, the post a check stopped on.
    let title: String?
    let at: Int?
}

// MARK: - A post of the window

/// One post of a thread, as it waits while another is open.
final class ComposePost {
    var text: NSAttributedString
    var media: [ComposeMedia]
    var gif: ComposeGif?
    var poll: ComposePoll?

    init(text: NSAttributedString = NSAttributedString(), media: [ComposeMedia] = [], gif: ComposeGif? = nil, poll: ComposePoll? = nil) {
        self.text = text
        self.media = media
        self.gif = gif
        self.poll = poll
    }

    var filled: Bool { !text.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !media.isEmpty || gif != nil || poll != nil }

    /// What it carries, for its row.
    var carries: String {
        if media.contains(where: { $0.type.hasPrefix("video/") }) { return "Video" }
        if !media.isEmpty { return media.count == 1 ? "1 photo" : "\(media.count) photos" }
        return gif != nil ? "GIF" : poll != nil ? "Poll" : ""
    }
}

/// Another post of the thread, above or below the open one: its number,
/// the start of its text, what it carries, and a remove button.
final class ComposeThreadRow: NSView {
    var onOpen: (() -> Void)?
    var onRemove: (() -> Void)?

    init(number: Int, post: ComposePost) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.backgroundColor = NSColor.quaternaryLabelColor.withAlphaComponent(0.12).cgColor
        let n = NSTextField(labelWithString: String(number))
        n.font = .monospacedDigitSystemFont(ofSize: NSFont.smallSystemFontSize, weight: .semibold)
        n.textColor = .secondaryLabelColor
        let words = post.text.string.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        let t = NSTextField(labelWithString: words.isEmpty ? "Empty post" : String(words.prefix(200)))
        t.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        t.textColor = words.isEmpty ? .tertiaryLabelColor : .labelColor
        t.lineBreakMode = .byTruncatingTail
        t.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        let c = NSTextField(labelWithString: post.carries)
        c.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        c.textColor = .tertiaryLabelColor
        c.isHidden = post.carries.isEmpty
        let x = NSButton(image: NSImage(systemSymbolName: "xmark", accessibilityDescription: "Remove post \(number)") ?? NSImage(), target: nil, action: nil)
        x.isBordered = false
        x.contentTintColor = .tertiaryLabelColor
        x.toolTip = "Remove post \(number)"
        x.target = self
        x.action = #selector(removePressed)
        let row = NSStackView(views: [n, t, c, x])
        row.spacing = 8
        row.edgeInsets = NSEdgeInsets(top: 4, left: 8, bottom: 4, right: 6)
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.topAnchor.constraint(equalTo: topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        toolTip = "Edit post \(number)"
        setAccessibilityRole(.button)
        setAccessibilityLabel("Post \(number): " + (words.isEmpty ? "empty" : words))
        addGestureRecognizer(NSClickGestureRecognizer(target: self, action: #selector(openPressed)))
    }

    required init?(coder: NSCoder) { nil }

    @objc private func openPressed() { onOpen?() }
    @objc private func removePressed() { onRemove?() }
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

    /// Promises being read: a receiver let go of never finishes.
    private var receiving: [NSFilePromiseReceiver] = []

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
        receiving += promises
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
        group.notify(queue: .main) { [weak self] in
            MainActor.assumeIsolated {
                self?.receiving.removeAll { r in promises.contains { $0 === r } }
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
    /// Each upload's run: a close or another draft ends the one under way.
    private var uploadRun = 0
    /// The page closed the window: it needs no word back.
    private var closingFromPage = false
    private var asked = ""
    private var syncTimer: Timer?

    /// The open post's media, and every draft's this session (its bytes
    /// stay here until Post).
    private var media: [ComposeMedia] = []
    private var mediaByKey: [String: [ComposeMedia]] = [:]
    private var gif: ComposeGif?
    private var poll: ComposePoll?
    private var when: ComposeWhen?
    /// Every post of the window; the open one (at) is live in the text
    /// view and the media, GIF and poll above, and stash() copies it back.
    private var thread: [ComposePost] = [ComposePost()]
    private var at = 0
    private static let threadMax = 25
    private let prevRows = NSStackView()
    private let nextRows = NSStackView()
    private let pollView = ComposePollView()
    private let whenLabel = NSTextField(labelWithString: "")
    private let whenRow = NSStackView()
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

        pollView.onChange = { [weak self] p in
            guard let self else { return }
            self.poll = p
            if p == nil { self.pollView.isHidden = true }
            self.sync()
        }
        let clock = NSImageView(image: NSImage(systemSymbolName: "calendar.badge.clock", accessibilityDescription: "Scheduled") ?? NSImage())
        clock.contentTintColor = .controlAccentColor
        whenLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        whenLabel.lineBreakMode = .byTruncatingTail
        whenLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        let change = NSButton(title: "Change…", target: self, action: #selector(changeWhen(_:)))
        let clearWhen = NSButton(title: "Clear", target: self, action: #selector(clearWhen))
        for b in [change, clearWhen] {
            b.controlSize = .small
            b.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        }
        for v in [clock, whenLabel, change, clearWhen] as [NSView] { whenRow.addArrangedSubview(v) }
        whenRow.spacing = 6

        for rows in [prevRows, nextRows] {
            rows.orientation = .vertical
            rows.alignment = .leading
            rows.spacing = 4
        }
        let stack = NSStackView(views: [noteLabel, contextLabel, quoteBox, prevRows, scroll, mediaScroll, pollView, nextRows, cardBox, whenRow, bar])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 12, left: 16, bottom: 10, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        for v in [noteLabel, quoteBox, prevRows, scroll, mediaScroll, pollView, nextRows, cardBox, whenRow, bar] as [NSView] {
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
        endUpload()
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
        let known = mediaByKey[snap.key] ?? []
        let post = { (text: String, bold: [[Int]], italic: [[Int]], files: [ComposeSnapshot.FileRef], gif: ComposeGif?, poll: ComposeSnapshot.PollRef?) -> ComposePost in
            ComposePost(
                text: Self.styled(text, bold: bold, italic: italic),
                media: files.compactMap { f in
                    guard let m = known.first(where: { $0.id == f.id }) else { return nil }
                    m.alt = f.alt
                    return m
                },
                gif: gif,
                poll: poll.map { ComposePoll(choices: $0.choices, days: $0.days, hours: $0.hours, minutes: $0.minutes) }
            )
        }
        if let list = snap.thread, !list.isEmpty {
            thread = list.prefix(Self.threadMax).map { post($0.text, $0.bold, $0.italic, $0.files, $0.gif, $0.poll) }
            at = max(0, min(thread.count - 1, snap.at ?? 0))
        } else {
            thread = [post(snap.text, snap.bold, snap.italic, snap.files, snap.gif, snap.poll)]
            at = 0
        }
        mediaByKey[snap.key] = thread.flatMap(\.media)
        load(at)
        when = snap.when.flatMap { ComposeWhen(["y": $0.y, "mo": $0.mo, "d": $0.d, "h": $0.h, "mi": $0.mi]) }
        showWhen()
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
        if let t = s.title, !t.isEmpty { window?.title = t }
        if let a = s.at, a != at, a >= 0, a < thread.count, !uploading {
            stash()
            load(a)
        }
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

    private func setText(_ text: NSAttributedString) {
        textView.textStorage?.setAttributedString(text)
        textView.typingAttributes = [.font: Self.baseFont, .foregroundColor: NSColor.textColor]
        textView.undoManager?.removeAllActions()
        textView.needsDisplay = true
    }

    /// A post's text with its bold and italic, as the text view keeps it.
    static func styled(_ text: String, bold: [[Int]], italic: [[Int]]) -> NSAttributedString {
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
        return s
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
    private static func styles(_ storage: NSAttributedString) -> (bold: [[Int]], italic: [[Int]]) {
        var bold: [[Int]] = [], italic: [[Int]] = []
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
        stash()
        let s = Self.styles(textView.textStorage ?? NSAttributedString())
        return [
            "thread": thread.map { Self.dict($0) },
            "at": at,
            "key": key,
            "text": textView.string,
            "bold": s.bold,
            "italic": s.italic,
            "files": media.map { ["id": $0.id, "name": $0.name, "type": $0.type, "size": $0.size, "alt": $0.alt] as [String: Any] },
            "gif": gif?.dict ?? NSNull(),
            "poll": poll?.dict ?? NSNull(),
            "when": when?.dict ?? NSNull(),
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

    private static func dict(_ p: ComposePost) -> [String: Any] {
        let s = styles(p.text)
        return [
            "text": p.text.string,
            "bold": s.bold,
            "italic": s.italic,
            "files": p.media.map { ["id": $0.id, "name": $0.name, "type": $0.type, "size": $0.size, "alt": $0.alt] as [String: Any] },
            "gif": p.gif?.dict ?? NSNull(),
            "poll": p.poll?.dict ?? NSNull(),
        ]
    }

    // MARK: A thread

    /// The open post back into the thread.
    private func stash() {
        guard at < thread.count, let storage = textView.textStorage else { return }
        let p = thread[at]
        p.text = NSAttributedString(attributedString: storage)
        p.media = media
        p.gif = gif
        p.poll = poll
    }

    /// Post i into the text view, the media row and the poll.
    private func load(_ i: Int) {
        at = max(0, min(thread.count - 1, i))
        let p = thread[at]
        setText(p.text)
        media = p.media
        gif = p.gif
        poll = p.poll
        rebuildMediaRow()
        if let poll { pollView.show(poll) }
        pollView.isHidden = poll == nil
        rebuildRows()
        window?.makeFirstResponder(textView)
        textView.setSelectedRange(NSRange(location: (textView.string as NSString).length, length: 0))
    }

    private func rebuildRows() {
        for rows in [prevRows, nextRows] {
            for v in rows.arrangedSubviews {
                rows.removeArrangedSubview(v)
                v.removeFromSuperview()
            }
        }
        let many = thread.count > 1
        if many {
            for (i, p) in thread.enumerated() where i != at {
                let row = ComposeThreadRow(number: i + 1, post: p)
                row.onOpen = { [weak self] in self?.open(i) }
                row.onRemove = { [weak self] in self?.removePost(i) }
                let rows = i < at ? prevRows : nextRows
                rows.addArrangedSubview(row)
                row.widthAnchor.constraint(equalTo: rows.widthAnchor).isActive = true
            }
        }
        prevRows.isHidden = prevRows.arrangedSubviews.isEmpty
        nextRows.isHidden = nextRows.arrangedSubviews.isEmpty
    }

    private func open(_ i: Int) {
        guard !busy, i != at, i < thread.count else { return }
        stash()
        load(i)
        sync()
    }

    /// Add Post: a new empty post after the open one, as X Pro's own.
    private func addPost() {
        stash()
        guard thread[at].filled else { return say("Write this post first.") }
        guard thread.count < Self.threadMax else { return say("A thread can have up to \(Self.threadMax) posts.") }
        thread.insert(ComposePost(), at: at + 1)
        load(at + 1)
        sync()
    }

    private func removePost(_ i: Int) {
        guard !busy, i < thread.count else { return }
        stash()
        thread.remove(at: i)
        if thread.isEmpty { thread = [ComposePost()] }
        load(i < at || (i == at && i > 0) ? at - 1 : at)
        sync()
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
        let all = thread.flatMap(\.media)
        guard !all.isEmpty else { return send(op, d) }
        uploading = true
        uploadRun += 1
        let run = uploadRun
        spinner.startAnimation(nil)
        statusLabel.stringValue = all.contains { $0.type.hasPrefix("video/") } ? "Preparing the video…" : "Preparing the media…"
        statusLabel.textColor = .secondaryLabelColor
        let key = self.key
        upload(all, run: run) { [weak self] problem in
            guard let self, self.uploadRun == run else { return }
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

    private func endUpload() {
        guard uploading else { return }
        uploadRun += 1
        uploading = false
        busy = false
        spinner.stopAnimation(nil)
    }

    /// Each file's bytes to the page in base64 parts, in order (app.js
    /// macFile); nil when all arrived, or what went wrong.
    private func upload(_ items: [ComposeMedia], run: Int, done: @escaping (String?) -> Void) {
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
            vc.composeOp("file", arg) { [weak self] reply in
                // Closed, or another draft opened: this upload is over.
                guard let self, self.uploadRun == run else { return }
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
        d["incoming"] = items.map { ["id": $0.id, "name": $0.name, "type": $0.type, "size": $0.size] as [String: Any] }
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
            self.stash()
            self.mediaByKey[key] = self.thread.flatMap(\.media)
            self.rebuildMediaRow()
            // The page's status line says what it didn't take; the sync's state carries it.
            self.sync()
        }
    }

    private func removeMedia(_ id: String) {
        guard !busy else { return }
        media.removeAll { $0.id == id }
        stash()
        mediaByKey[key] = thread.flatMap(\.media)
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
        if let gif {
            let tile = ComposeMediaTile(gif: gif)
            tile.onRemove = { [weak self] in
                guard let self, !self.busy else { return }
                self.gif = nil
                self.rebuildMediaRow()
                self.sync()
            }
            mediaRow.addArrangedSubview(tile)
        }
        mediaScroll.isHidden = media.isEmpty && gif == nil
    }

    // MARK: A poll and a send time

    private func addPoll() {
        if let _ = poll { return pollView.focusFirstChoice() }
        if kind == "quote" && at == 0 { return say("A quote post can’t have a poll.") }
        if !media.isEmpty || gif != nil { return say("A post can have a poll or media, not both.") }
        if when != nil { return say("X Pro can’t schedule a post with a poll. Clear the time first.") }
        poll = .fresh
        pollView.show(.fresh)
        pollView.isHidden = false
        pollView.focusFirstChoice()
        sync()
    }

    private func schedule(from item: NSToolbarItem?, or view: NSView?) {
        if poll != nil { return say("X Pro can’t schedule a post with a poll. Remove the poll first.") }
        // X Pro's own first choice: an hour from now.
        let picker = ComposeSchedulePicker(start: when?.date ?? Date.now.addingTimeInterval(3600), had: when != nil)
        let key = self.key
        picker.onSet = { [weak self] w in
            guard let self, self.isOpen, self.key == key, !self.busy else { return }
            self.when = w
            self.showWhen()
            self.sync()
        }
        if let item { picker.show(from: item) } else if let view { picker.show(from: view) }
    }

    private func showWhen() {
        whenLabel.stringValue = when.map { "Will send on " + $0.label } ?? ""
        whenRow.isHidden = when == nil
    }

    @objc private func changeWhen(_ sender: NSButton) {
        guard !busy else { return }
        schedule(from: nil, or: sender)
    }

    @objc private func clearWhen() {
        guard !busy else { return }
        when = nil
        showWhen()
        sync()
    }

    // MARK: GIFs

    /// A note in the status line, until the page's next state.
    private func say(_ s: String) {
        statusLabel.stringValue = s
        statusLabel.textColor = .systemRed
        statusLabel.toolTip = s
    }

    private func chooseGif(from item: NSToolbarItem) {
        guard media.isEmpty else { return say("A post can have photos or a video, or one GIF.") }
        guard poll == nil else { return say("A post can have a poll or media, not both.") }
        let picker = ComposeGifPicker()
        let key = self.key
        picker.search = { q, done in
            ViewController.shared?.composeOp("gifs", ["q": q]) { reply in
                guard let text = reply as? String, let data = text.data(using: .utf8),
                      let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any], o["stale"] == nil else { return }
                let list = (o["items"] as? [[String: Any]]) ?? []
                let gifs = list.compactMap { g -> ComposeGif? in
                    guard let id = g["id"] as? String, let url = g["url"] as? String, let still = g["still"] as? String else { return nil }
                    return ComposeGif(id: id, alt: g["alt"] as? String ?? "", url: url, still: still, w: g["w"] as? Int ?? 0, h: g["h"] as? Int ?? 0, query: q)
                }
                done(gifs, o["empty"] as? String ?? "No GIFs found.")
            }
        }
        picker.onPick = { [weak self] g in
            guard let self, self.isOpen, self.key == key, !self.busy, self.media.isEmpty else { return }
            self.gif = g
            self.rebuildMediaRow()
            self.sync()
        }
        picker.onClose = {
            ViewController.shared?.composeOp("gifsClose", nil) { _ in }
        }
        picker.show(from: item)
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
        endUpload()
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
        case .gif:
            chooseGif(from: sender)
        case .poll:
            addPoll()
        case .schedule:
            schedule(from: sender, or: nil)
        case .thread:
            addPost()
        }
    }

    @objc private func xpro(_ sender: NSMenuItem) {
        guard !busy, let tool = sender.representedObject as? String else { return }
        var d = draft()
        d["tool"] = tool
        withMedia("xpro", d)
    }
}
