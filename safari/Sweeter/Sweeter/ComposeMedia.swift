//
//  ComposeMedia.swift
//  Sweeter
//
//  Photos, GIFs and video in the Mac compose window: what was added, its
//  thumbnail tile, and the popover for its description (X's alt text).
//  The bytes stay here until Post: then they go to the page in parts
//  (ComposeWindowController.upload), which hands them to X Pro.
//

import AVFoundation
import Cocoa
import UniformTypeIdentifiers

/// One photo, GIF or video, from a file or the clipboard.
final class ComposeMedia {
    let id = UUID().uuidString
    let name: String
    /// Its MIME type, as X Pro's file input takes it.
    let type: String
    let size: Int
    private let url: URL?
    private let data: Data?
    var alt = ""
    var thumb: NSImage?
    /// Kept while it works: a generator let go of never calls back.
    private var generator: AVAssetImageGenerator?

    /// What X takes (app.js ACCEPT): JPEG, PNG, WebP, GIF, MP4 and MOV.
    static let types: [UTType] = [.jpeg, .png, .webP, .gif, .mpeg4Movie, .quickTimeMovie]

    init?(url: URL) {
        let v = try? url.resourceValues(forKeys: [.contentTypeKey, .fileSizeKey, .isRegularFileKey])
        guard v?.isRegularFile != false, let t = v?.contentType ?? UTType(filenameExtension: url.pathExtension) else { return nil }
        let match = Self.types.first { t.conforms(to: $0) }
        self.url = url
        data = nil
        name = url.lastPathComponent
        type = match?.preferredMIMEType ?? t.preferredMIMEType ?? "application/octet-stream"
        size = v?.fileSize ?? 0
    }

    /// An image pasted from the clipboard, as PNG.
    init(png: Data) {
        url = nil
        data = png
        name = "Pasted image.png"
        type = "image/png"
        size = png.count
    }

    var isPhoto: Bool { type.hasPrefix("image/") }
    var badge: String? { type == "image/gif" ? "GIF" : type.hasPrefix("video/") ? "VIDEO" : nil }

    /// The bytes, read when the post goes (a video is mapped, not copied).
    func bytes() throws -> Data {
        if let data { return data }
        guard let url else { throw CocoaError(.fileNoSuchFile) }
        return try Data(contentsOf: url, options: .mappedIfSafe)
    }

    /// A thumbnail: the image itself, or a video's first frame.
    func loadThumb(_ done: @escaping (NSImage?) -> Void) {
        if let thumb { return done(thumb) }
        if !type.hasPrefix("video/") {
            let img = data.flatMap { NSImage(data: $0) } ?? url.flatMap { NSImage(contentsOf: $0) }
            thumb = img
            return done(img)
        }
        guard let url else { return done(nil) }
        let gen = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: 480, height: 480)
        generator = gen
        gen.generateCGImageAsynchronously(for: .zero) { cg, _, error in
            let img = cg.map { NSImage(cgImage: $0, size: NSSize(width: $0.width, height: $0.height)) }
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    self.generator = nil
                    if let error { Log.write("compose window: no video thumbnail: \(error.localizedDescription)") }
                    self.thumb = img
                    done(img)
                }
            }
        }
    }
}

/// A thumbnail in the media row: the picture, cropped to fill, a GIF or
/// VIDEO badge, ALT for a photo's description, and a remove button. A GIF
/// from X Pro's search shows its still, with no ALT (X Pro gives it its own).
final class ComposeMediaTile: NSView {
    static let height: CGFloat = 88
    let media: ComposeMedia?
    var onRemove: (() -> Void)?
    var onAlt: ((NSView) -> Void)?
    private let picture = CALayer()
    private let remove = NSButton()
    private let altButton = NSButton()
    private let badge = NSTextField(labelWithString: "")
    private var widthConstraint: NSLayoutConstraint?

    convenience init(media: ComposeMedia) {
        self.init(media: media, badge: media.badge, alt: media.isPhoto)
        media.loadThumb { [weak self] img in self?.show(img) }
    }

    convenience init(gif: ComposeGif) {
        self.init(media: nil, badge: "GIF", alt: false)
        toolTip = gif.alt.isEmpty ? nil : gif.alt
        GiphyImages.load(gif.still) { [weak self] img in self?.show(img) }
    }

    private init(media: ComposeMedia?, badge text: String?, alt: Bool) {
        self.media = media
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.masksToBounds = true
        layer?.backgroundColor = NSColor.quaternaryLabelColor.cgColor
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.borderWidth = 1
        picture.contentsGravity = .resizeAspectFill
        picture.masksToBounds = true
        layer?.addSublayer(picture)
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: Self.height).isActive = true
        widthConstraint = widthAnchor.constraint(equalToConstant: Self.height)
        widthConstraint?.isActive = true

        let config = NSImage.SymbolConfiguration(pointSize: 15, weight: .regular).applying(.init(paletteColors: [.white, NSColor.black.withAlphaComponent(0.6)]))
        remove.image = NSImage(systemSymbolName: "xmark.circle.fill", accessibilityDescription: "Remove")?.withSymbolConfiguration(config)
        remove.isBordered = false
        remove.toolTip = "Remove"
        remove.target = self
        remove.action = #selector(removePressed)

        altButton.isBordered = false
        altButton.wantsLayer = true
        altButton.layer?.cornerRadius = 4
        altButton.target = self
        altButton.action = #selector(altPressed)
        altButton.isHidden = !alt

        badge.font = .boldSystemFont(ofSize: 9)
        badge.textColor = .white
        badge.drawsBackground = true
        badge.backgroundColor = NSColor.black.withAlphaComponent(0.6)
        badge.stringValue = text.map { " \($0) " } ?? ""
        badge.isHidden = text == nil

        for v in [remove, altButton, badge] as [NSView] {
            v.translatesAutoresizingMaskIntoConstraints = false
            addSubview(v)
        }
        NSLayoutConstraint.activate([
            remove.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            remove.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            altButton.topAnchor.constraint(equalTo: topAnchor, constant: 5),
            altButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 5),
            altButton.heightAnchor.constraint(equalToConstant: 18),
            badge.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -5),
            badge.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 5),
        ])
        refresh()
    }

    required init?(coder: NSCoder) { nil }

    private func show(_ img: NSImage?) {
        guard let img else { return }
        picture.contents = img.layerContents(forContentsScale: window?.backingScaleFactor ?? 2)
        // As wide as the picture's shape allows, within reason.
        let ratio = img.size.height > 0 ? img.size.width / img.size.height : 1
        widthConstraint?.constant = min(200, max(60, (Self.height * ratio).rounded()))
    }

    /// The description button: “ALT”, with a check once there is one.
    func refresh() {
        let alt = media?.alt ?? ""
        let set = !alt.isEmpty
        altButton.attributedTitle = NSAttributedString(string: set ? "✓ ALT" : "ALT", attributes: [.font: NSFont.boldSystemFont(ofSize: 10), .foregroundColor: NSColor.white])
        altButton.layer?.backgroundColor = (set ? NSColor.controlAccentColor : NSColor.black.withAlphaComponent(0.6)).cgColor
        altButton.toolTip = set ? alt : "Add a description"
        altButton.setAccessibilityLabel(set ? "Edit the description" : "Add a description")
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        picture.frame = bounds
        CATransaction.commit()
    }

    @objc private func removePressed() { onRemove?() }
    @objc private func altPressed() { onAlt?(altButton) }
}

/// A photo's description, in a popover by its ALT button: up to 1,000
/// characters, as X takes. ⌘Return or Done closes it.
final class ComposeAltController: NSViewController, NSTextViewDelegate, NSPopoverDelegate {
    static let max = 1000
    private let media: ComposeMedia
    private let done: () -> Void
    private let text = NSTextView(usingTextLayoutManager: false)
    private let count = NSTextField(labelWithString: "")
    private weak var popover: NSPopover?

    init(media: ComposeMedia, done: @escaping () -> Void) {
        self.media = media
        self.done = done
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { nil }

    override func loadView() {
        let title = NSTextField(labelWithString: "Description")
        title.font = .boldSystemFont(ofSize: NSFont.systemFontSize)
        let help = NSTextField(wrappingLabelWithString: "Describe this image for people who can’t see it.")
        help.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        help.textColor = .secondaryLabelColor

        text.isRichText = false
        text.font = .systemFont(ofSize: NSFont.systemFontSize)
        text.allowsUndo = true
        text.isContinuousSpellCheckingEnabled = true
        text.delegate = self
        text.string = media.alt
        text.textContainerInset = NSSize(width: 2, height: 4)
        text.isVerticallyResizable = true
        text.autoresizingMask = [.width]
        text.textContainer?.widthTracksTextView = true
        let scroll = NSScrollView()
        scroll.documentView = text
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.heightAnchor.constraint(equalToConstant: 96).isActive = true

        count.font = .monospacedDigitSystemFont(ofSize: NSFont.smallSystemFontSize, weight: .regular)
        count.textColor = .secondaryLabelColor
        let doneButton = NSButton(title: "Done", target: self, action: #selector(finish))
        doneButton.keyEquivalent = "\r"
        doneButton.keyEquivalentModifierMask = [.command]
        doneButton.bezelColor = .controlAccentColor
        let foot = NSStackView(views: [count, NSView(), doneButton])

        let stack = NSStackView(views: [title, help, scroll, foot])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6
        stack.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        for v in [help, scroll, foot] as [NSView] {
            v.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -24).isActive = true
        }
        stack.widthAnchor.constraint(equalToConstant: 320).isActive = true
        view = stack
        updateCount()
    }

    func show(from anchor: NSView) {
        let p = NSPopover()
        p.behavior = .transient
        p.contentViewController = self
        p.delegate = self
        popover = p
        p.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .maxY)
        view.window?.makeFirstResponder(text)
    }

    private func updateCount() {
        count.stringValue = "\((text.string as NSString).length.formatted()) / 1,000"
    }

    func textView(_ textView: NSTextView, shouldChangeTextIn range: NSRange, replacementString: String?) -> Bool {
        let now = (textView.string as NSString).length
        let incoming = (replacementString as NSString?)?.length ?? 0
        return now - range.length + incoming <= Self.max || incoming == 0
    }

    func textDidChange(_ notification: Notification) {
        updateCount()
    }

    @objc private func finish() {
        popover?.close()
    }

    func popoverDidClose(_ notification: Notification) {
        let t = text.string.trimmingCharacters(in: .whitespacesAndNewlines)
        media.alt = t.isEmpty ? "" : String(text.string.prefix(Self.max))
        done()
    }
}
