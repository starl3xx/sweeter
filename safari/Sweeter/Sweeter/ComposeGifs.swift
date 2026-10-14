//
//  ComposeGifs.swift
//  Sweeter
//
//  GIFs in the Mac compose window: a popover with a search field and a
//  grid, showing what X Pro's own GIF search finds (GIPHY's, through X;
//  the page runs the search, app.js macGifSearch). A pick goes into the
//  post, and X Pro's composer gets the same GIF when it is sent.
//

import Cocoa

/// A GIF from X Pro's GIF search, as the page passes it.
struct ComposeGif: Codable, Equatable {
    let id: String
    let alt: String
    let url: String
    let still: String
    let w: Int
    let h: Int
    var query: String

    var dict: [String: Any] { ["id": id, "alt": alt, "url": url, "still": still, "w": w, "h": h, "query": query] }
}

/// GIPHY's images, and only GIPHY's: no cookies, kept in memory a while.
enum GiphyImages {
    nonisolated private static let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.httpCookieAcceptPolicy = .never
        c.httpShouldSetCookies = false
        c.urlCache = URLCache(memoryCapacity: 40 << 20, diskCapacity: 0)
        c.timeoutIntervalForRequest = 15
        return URLSession(configuration: c)
    }()

    private static let cache = NSCache<NSString, NSImage>()

    static func allowed(_ s: String) -> URL? {
        guard let u = URL(string: s), u.scheme == "https", let host = u.host?.lowercased(),
              host.range(of: "^media[0-9]?\\.giphy\\.com$", options: .regularExpression) != nil else { return nil }
        return u
    }

    static func load(_ s: String, done: @escaping (NSImage?) -> Void) {
        if let img = cache.object(forKey: s as NSString) { return done(img) }
        guard let url = allowed(s) else { return done(nil) }
        session.dataTask(with: url) { data, response, _ in
            let ok = (response as? HTTPURLResponse).map { (200 ..< 300).contains($0.statusCode) } ?? false
            let img = ok ? data.flatMap { NSImage(data: $0) } : nil
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    if let img { cache.setObject(img, forKey: s as NSString) }
                    done(img)
                }
            }
        }.resume()
    }
}

/// One GIF in the grid: its still, cropped to fill.
final class ComposeGifCell: NSCollectionViewItem {
    static let id = NSUserInterfaceItemIdentifier("gif")
    private let picture = CALayer()
    private var showing = ""

    override func loadView() {
        let v = NSView()
        v.wantsLayer = true
        v.layer?.cornerRadius = 6
        v.layer?.masksToBounds = true
        v.layer?.backgroundColor = NSColor.quaternaryLabelColor.cgColor
        picture.contentsGravity = .resizeAspectFill
        v.layer?.addSublayer(picture)
        view = v
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        picture.frame = view.bounds
        CATransaction.commit()
    }

    func show(_ gif: ComposeGif) {
        showing = gif.still
        picture.contents = nil
        view.toolTip = gif.alt.isEmpty ? nil : gif.alt
        view.setAccessibilityLabel(gif.alt.isEmpty ? "GIF" : gif.alt)
        GiphyImages.load(gif.still) { [weak self] img in
            guard let self, self.showing == gif.still, let img else { return }
            self.picture.contents = img.layerContents(forContentsScale: self.view.window?.backingScaleFactor ?? 2)
        }
    }

    override var isSelected: Bool {
        didSet { view.layer?.borderWidth = isSelected ? 2 : 0 }
    }

    override var highlightState: NSCollectionViewItem.HighlightState {
        didSet {
            view.layer?.borderColor = NSColor.controlAccentColor.cgColor
            view.layer?.borderWidth = highlightState == .forSelection || isSelected ? 2 : 0
        }
    }
}

/// The picker: a search field over a grid. It asks the page for each
/// search (trending first) and says when the page has no answer.
final class ComposeGifPicker: NSViewController, NSSearchFieldDelegate, NSCollectionViewDataSource, NSCollectionViewDelegate, NSPopoverDelegate {
    /// Runs one search on the page: the GIFs, or what to say instead.
    var search: ((String, @escaping ([ComposeGif], String) -> Void) -> Void)?
    var onPick: ((ComposeGif) -> Void)?
    var onClose: (() -> Void)?

    private let field = NSSearchField()
    private let grid = NSCollectionView()
    private let message = NSTextField(labelWithString: "")
    private var items: [ComposeGif] = []
    private var query = ""
    private var timer: Timer?
    private weak var popover: NSPopover?

    override func loadView() {
        field.placeholderString = "Search GIFs"
        field.delegate = self
        field.sendsSearchStringImmediately = false
        field.target = self
        field.action = #selector(searchNow)

        let layout = NSCollectionViewFlowLayout()
        layout.itemSize = NSSize(width: 112, height: 112)
        layout.minimumInteritemSpacing = 6
        layout.minimumLineSpacing = 6
        layout.sectionInset = NSEdgeInsets(top: 2, left: 2, bottom: 2, right: 2)
        grid.collectionViewLayout = layout
        grid.dataSource = self
        grid.delegate = self
        grid.isSelectable = true
        grid.backgroundColors = [.clear]
        grid.register(ComposeGifCell.self, forItemWithIdentifier: ComposeGifCell.id)
        let scroll = NSScrollView()
        scroll.documentView = grid
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false

        message.textColor = .secondaryLabelColor
        message.alignment = .center
        message.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        message.translatesAutoresizingMaskIntoConstraints = false

        let v = NSView()
        field.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(field)
        v.addSubview(scroll)
        v.addSubview(message)
        NSLayoutConstraint.activate([
            v.widthAnchor.constraint(equalToConstant: 372),
            v.heightAnchor.constraint(equalToConstant: 440),
            field.topAnchor.constraint(equalTo: v.topAnchor, constant: 12),
            field.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 12),
            field.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -12),
            scroll.topAnchor.constraint(equalTo: field.bottomAnchor, constant: 10),
            scroll.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 10),
            scroll.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -10),
            scroll.bottomAnchor.constraint(equalTo: v.bottomAnchor, constant: -10),
            message.centerXAnchor.constraint(equalTo: scroll.centerXAnchor),
            message.centerYAnchor.constraint(equalTo: scroll.centerYAnchor),
            message.widthAnchor.constraint(lessThanOrEqualTo: scroll.widthAnchor, constant: -24),
        ])
        view = v
    }

    func show(from item: NSToolbarItem) {
        let p = NSPopover()
        p.behavior = .transient
        p.contentViewController = self
        p.delegate = self
        popover = p
        p.show(relativeTo: item)
        view.window?.makeFirstResponder(field)
        run("")
    }

    private func run(_ q: String) {
        query = q
        if items.isEmpty { say("Loading GIFs…") } else { say("") }
        search?(q) { [weak self] gifs, empty in
            guard let self, self.query == q else { return }
            self.items = gifs.map { var g = $0; g.query = q; return g }
            self.grid.reloadData()
            self.grid.scroll(.zero)
            self.say(gifs.isEmpty ? empty : "")
        }
    }

    private func say(_ s: String) {
        message.stringValue = s
        message.isHidden = s.isEmpty
    }

    func controlTextDidChange(_ obj: Notification) {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated { self?.searchNow() }
        }
    }

    @objc private func searchNow() {
        timer?.invalidate()
        timer = nil
        let q = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if q != query { run(q) }
    }

    // Return picks the first GIF; Escape closes (the popover's own).
    func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
        if selector == #selector(NSResponder.insertNewline(_:)) {
            if let g = items.first, field.stringValue.trimmingCharacters(in: .whitespaces) == query { pick(g) } else { searchNow() }
            return true
        }
        return false
    }

    private func pick(_ g: ComposeGif) {
        onPick?(g)
        popover?.close()
    }

    func collectionView(_ collectionView: NSCollectionView, numberOfItemsInSection section: Int) -> Int {
        items.count
    }

    func collectionView(_ collectionView: NSCollectionView, itemForRepresentedObjectAt indexPath: IndexPath) -> NSCollectionViewItem {
        let cell = collectionView.makeItem(withIdentifier: ComposeGifCell.id, for: indexPath)
        if let c = cell as? ComposeGifCell, indexPath.item < items.count { c.show(items[indexPath.item]) }
        return cell
    }

    func collectionView(_ collectionView: NSCollectionView, didSelectItemsAt indexPaths: Set<IndexPath>) {
        guard let i = indexPaths.first?.item, i < items.count else { return }
        pick(items[i])
    }

    func popoverDidClose(_ notification: Notification) {
        timer?.invalidate()
        onClose?()
    }
}
