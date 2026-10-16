//
//  ComposeLook.swift
//  Sweeter
//
//  Sweeter's own look inside the Mac compose window: the window and its
//  toolbar stay the Mac's, and what sits in the box takes the theme's
//  colors (in Sweeter's theme, the icon's sky and the bird's pink).
//
//  The shapes have depth, lit from above as the icon is. A raised part
//  (the floating bar, Post, a chip) has a glint inside its hairline at the
//  top, a darker foot, and soft shadows in the theme's ink, never plain
//  gray; a tool under the pointer, or one that is on, sits in a shallow
//  well. The tools and Post sit 9 points into the bar's 27-point curve, so
//  theirs are 18 and follow it. Nothing moves when a number changes.
//

import Cocoa
import SwiftUI

/// The theme as the page shows it (app.js macLook): Light or Dark, and
/// its colors as CSS computes them (rgb(), rgba() or color(srgb …)).
struct ComposeTheme: Decodable, Equatable {
    let dark: Bool
    let bg: String
    let bar: String
    let t1: String
    let t3: String
    let line: String
    let accent: String
    let solid: String
    let onAccent: String
}

/// The window's colors: the theme's own once the page sends it (its
/// background, text and lines, its accent for the soft pills and its solid
/// accent for Post and the chosen chips), and Sweeter's sky and pink until
/// then. Each is read when it is drawn, so a new theme needs only a redraw.
enum SweeterColor {
    struct Resolved {
        let dark: Bool
        let bg, bar, t1, t3, line, accent, solid, onAccent: NSColor

        init?(_ t: ComposeTheme) {
            guard let bg = SweeterColor.css(t.bg), let bar = SweeterColor.css(t.bar), let t1 = SweeterColor.css(t.t1), let t3 = SweeterColor.css(t.t3),
                  let line = SweeterColor.css(t.line), let accent = SweeterColor.css(t.accent), let solid = SweeterColor.css(t.solid), let onAccent = SweeterColor.css(t.onAccent) else { return nil }
            dark = t.dark
            self.bg = bg
            self.bar = bar
            self.t1 = t1
            self.t3 = t3
            self.line = line
            self.accent = accent
            self.solid = solid
            self.onAccent = onAccent
        }
    }

    /// The page's theme; nil until it sends one.
    static var theme: Resolved?

    /// A CSS color as WebKit computes it.
    static func css(_ value: String) -> NSColor? {
        let s = value.trimmingCharacters(in: .whitespaces).lowercased()
        guard let open = s.firstIndex(of: "("), s.hasSuffix(")") else { return nil }
        let fn = String(s[..<open])
        let inner = s[s.index(after: open) ..< s.index(before: s.endIndex)]
        let parts = inner.replacingOccurrences(of: ",", with: " ").replacingOccurrences(of: "/", with: " ").split(separator: " ").map(String.init)
        if fn == "rgb" || fn == "rgba" {
            let n = parts.compactMap(Double.init)
            guard n.count >= 3 else { return nil }
            return NSColor(srgbRed: n[0] / 255, green: n[1] / 255, blue: n[2] / 255, alpha: n.count > 3 ? n[3] : 1)
        }
        if fn == "color", parts.first == "srgb" {
            let n = parts.dropFirst().compactMap(Double.init)
            guard n.count >= 3 else { return nil }
            return NSColor(srgbRed: n[0], green: n[1], blue: n[2], alpha: n.count > 3 ? n[3] : 1)
        }
        return nil
    }

    private static func hex(_ v: UInt32, _ alpha: CGFloat = 1) -> NSColor {
        NSColor(srgbRed: CGFloat(v >> 16 & 0xFF) / 255, green: CGFloat(v >> 8 & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: alpha)
    }

    /// The theme's color, or Sweeter's own for light and dark.
    private static func pick(_ themed: @escaping (Resolved) -> NSColor, _ light: NSColor, _ dark: NSColor) -> NSColor {
        NSColor(name: nil) { a in
            if let t = theme { return themed(t) }
            return a.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
        }
    }

    /// A color moved toward the text color, so it reads on a soft tint.
    private static func toward(_ c: NSColor, _ f: CGFloat, _ t: Resolved) -> NSColor {
        (c.usingColorSpace(.sRGB) ?? c).blended(withFraction: f, of: t.t1.usingColorSpace(.sRGB) ?? t.t1) ?? c
    }

    /// The box, the text in it, quieter text, and hairlines.
    static var paper: NSColor { pick({ $0.bg }, hex(0xFF_FFFF), hex(0x1E_1E1E)) }
    static var text: NSColor { pick({ $0.t1 }, hex(0x00_0000), hex(0xFF_FFFF)) }
    static var secondary: NSColor { pick({ $0.t3 }, hex(0x6E_6E73), hex(0x98_989D)) }
    static var line: NSColor { pick({ $0.line }, NSColor.black.withAlphaComponent(0.14), NSColor.white.withAlphaComponent(0.16)) }
    /// A card on the paper (a quoted post): the text color, faintly.
    static var card: NSColor { pick({ $0.t1.withAlphaComponent($0.dark ? 0.05 : 0.035) }, NSColor.black.withAlphaComponent(0.035), NSColor.white.withAlphaComponent(0.05)) }
    static var link: NSColor { pick({ $0.accent }, hex(0x0A_66D8), hex(0x4D_A3FF)) }
    /// The solid accent (the bird's pink in Sweeter's theme): Post and a
    /// chosen chip, the text on it, the ring.
    static var pinkFill: NSColor { pick({ $0.solid }, hex(0xC2_3A72), hex(0xD1_4A82)) }
    static var onPink: NSColor { pick({ $0.onAccent }, .white, .white) }
    static var pink: NSColor { pick({ $0.solid }, hex(0xEE_5A8E), hex(0xEE_5A8E)) }
    /// A soft pill in the solid accent: its text and background.
    static var pinkText: NSColor { pick({ toward($0.solid, 0.3, $0) }, hex(0xB8_336A), hex(0xFF_8FB5)) }
    static var pinkTint: NSColor { pick({ $0.solid.withAlphaComponent($0.dark ? 0.22 : 0.12) }, hex(0xEE_5A8E, 0.12), hex(0xEE_5A8E, 0.22)) }
    /// A soft pill in the accent (the icon's sky in Sweeter's theme).
    static var skyTint: NSColor { pick({ $0.accent.withAlphaComponent($0.dark ? 0.20 : 0.16) }, hex(0x7E_C0FA, 0.22), hex(0x7E_C0FA, 0.20)) }
    static var skyText: NSColor { pick({ toward($0.accent, 0.3, $0) }, hex(0x24_5C8F), hex(0x9F_D0FB)) }
    /// A lettered circle's colors.
    static var discSky: NSColor { pick({ $0.accent.withAlphaComponent($0.dark ? 0.28 : 0.20) }, hex(0xD6_EBFE), hex(0x7E_C0FA, 0.28)) }
    static var discSkyText: NSColor { pick({ toward($0.accent, 0.45, $0) }, hex(0x1F_4F7A), hex(0xCF_E7FD)) }
    static var discPink: NSColor { pick({ $0.solid.withAlphaComponent($0.dark ? 0.28 : 0.16) }, hex(0xFD_E0EA), hex(0xEE_5A8E, 0.28)) }
    static var discPinkText: NSColor { pick({ toward($0.solid, 0.45, $0) }, hex(0x8A_1F4B), hex(0xFF_D0E0)) }
}

/// Sweeter's shapes and the light on them (see the top of this file).
enum ComposeShape {
    /// A rectangle with continuous corners (a capsule when the radius is
    /// half its height), as Apple draws them.
    static func path(_ rect: NSRect, radius: CGFloat) -> CGPath {
        let r = max(0, min(radius, rect.width / 2, rect.height / 2))
        if r >= min(rect.width, rect.height) / 2 { return Capsule(style: .continuous).path(in: rect).cgPath }
        return RoundedRectangle(cornerRadius: r, style: .continuous).path(in: rect).cgPath
    }

    static func bezier(_ rect: NSRect, radius: CGFloat) -> NSBezierPath {
        NSBezierPath(cgPath: path(rect, radius: radius))
    }

    /// Dark paper: the theme's, or the Mac's appearance until the page sends one.
    static func dark(_ view: NSView) -> Bool {
        SweeterColor.theme?.dark ?? (view.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua)
    }

    /// The color of a shadow: a deep violet ink, never plain gray.
    static func ink(_ alpha: CGFloat) -> NSColor {
        NSColor(srgbRed: 0.12, green: 0.08, blue: 0.24, alpha: alpha)
    }

    /// The edge of a raised part: a glint along the top that fades down its
    /// sides, and a crisp line along its foot.
    static func edge(_ rect: NSRect, radius: CGFloat, glint: NSColor, foot: NSColor, flipped: Bool, width: CGFloat = 1) {
        let ring = bezier(rect, radius: radius)
        ring.append(bezier(rect.insetBy(dx: width, dy: width), radius: radius - width))
        ring.windingRule = .evenOdd
        NSGraphicsContext.saveGraphicsState()
        ring.addClip()
        let fade = NSGradient(colors: [glint, glint.withAlphaComponent(0), foot.withAlphaComponent(0), foot], atLocations: [0, 0.5, 0.6, 1], colorSpace: .sRGB)
        fade?.draw(in: rect, angle: flipped ? 90 : -90)
        NSGraphicsContext.restoreGraphicsState()
    }

    /// A well pressed into the paper: its fill, and a shadow inside its top
    /// edge. (A shadow's offset is in the screen's terms, so down is down
    /// in a flipped view too.)
    static func carve(_ path: NSBezierPath, fill: NSColor, shade: NSColor, depth: CGFloat) {
        fill.setFill()
        path.fill()
        NSGraphicsContext.saveGraphicsState()
        path.addClip()
        let s = NSShadow()
        s.shadowColor = shade
        s.shadowBlurRadius = depth * 2
        s.shadowOffset = NSSize(width: 0, height: -depth)
        s.set()
        let around = NSBezierPath(rect: path.bounds.insetBy(dx: -24, dy: -24))
        around.append(path)
        around.windingRule = .evenOdd
        NSColor.black.setFill()
        around.fill()
        NSGraphicsContext.restoreGraphicsState()
    }

    /// An SF Symbol in one color. Its shape is drawn as in Light mode: in
    /// Dark mode macOS fills face.smiling's face, so the bar's Emoji tool
    /// was a solid disc.
    static func symbol(_ name: String, size: CGFloat, weight: NSFont.Weight, color: NSColor) -> NSImage? {
        guard let img = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(.init(pointSize: size, weight: weight)) else { return nil }
        // Resolved now, in the drawing's appearance: the image draws later.
        let cg = color.cgColor
        let solid = cg.copy(alpha: 1) ?? cg
        return NSImage(size: img.size, flipped: false) { r in
            guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
            ctx.setAlpha(cg.alpha)
            ctx.beginTransparencyLayer(auxiliaryInfo: nil)
            NSAppearance(named: .aqua)?.performAsCurrentDrawingAppearance { img.draw(in: r) }
            ctx.setFillColor(solid)
            ctx.setBlendMode(.sourceAtop)
            ctx.fill(r)
            ctx.endTransparencyLayer()
            return true
        }
    }

    /// The solid accent as a raised gem (Post, a chosen chip): lit at the
    /// top, deeper at the foot, and darker while pressed.
    static func gem(_ rect: NSRect, radius: CGFloat, pressed: Bool, flipped: Bool) {
        let base = SweeterColor.pinkFill.usingColorSpace(.sRGB) ?? SweeterColor.pinkFill
        let top = base.blended(withFraction: pressed ? 0.02 : 0.16, of: .white) ?? base
        let foot = base.blended(withFraction: pressed ? 0.2 : 0.1, of: .black) ?? base
        NSGradient(starting: top, ending: foot)?.draw(in: bezier(rect, radius: radius), angle: flipped ? 90 : -90)
        edge(rect, radius: radius, glint: NSColor.white.withAlphaComponent(pressed ? 0.12 : 0.4), foot: NSColor.black.withAlphaComponent(0.18), flipped: flipped)
    }
}

/// A view whose content starts at the top (a scroll view's page).
final class ComposeFlippedView: NSView {
    override var isFlipped: Bool { true }
}

/// A rounded card around what it holds (the quoted post, a link's card),
/// as tall as that plus its margins. An NSBox can't be: it sizes its
/// content view, never the other way round, so a box that holds its height
/// shrank to nothing and its text spilled over the label above it. The
/// content holds its own height too (a stack view hugs loosely, so the card
/// took a tall window's spare room); filled, it is a soft tint on the paper.
final class ComposeOutline: NSView {
    var filled = false {
        didSet { needsDisplay = true }
    }
    var radius: CGFloat = 8 {
        didSet { needsDisplay = true }
    }

    func hold(_ content: NSView, margins: NSSize) {
        content.translatesAutoresizingMaskIntoConstraints = false
        addSubview(content)
        // Every stack in the card holds its height, the ones inside it too
        // (a quote's name row): any one left at the default (250) takes
        // the room when the window is taller than what it holds, and the
        // card grows with it, the row's names floating in the middle.
        func hug(_ v: NSView) {
            if let stack = v as? NSStackView {
                stack.setHuggingPriority(NSLayoutConstraint.Priority(506), for: .vertical)
                stack.arrangedSubviews.forEach(hug)
            }
        }
        hug(content)
        content.setContentHuggingPriority(NSLayoutConstraint.Priority(506), for: .vertical)
        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: leadingAnchor, constant: margins.width),
            content.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -margins.width),
            content.topAnchor.constraint(equalTo: topAnchor, constant: margins.height),
            content.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -margins.height),
        ])
    }

    override func draw(_ dirtyRect: NSRect) {
        let path = ComposeShape.bezier(bounds.insetBy(dx: 0.5, dy: 0.5), radius: radius)
        if filled {
            SweeterColor.card.setFill()
            path.fill()
        }
        path.lineWidth = 1
        (filled ? SweeterColor.line : NSColor.separatorColor).setStroke()
        path.stroke()
    }
}

/// A small round picture (a quoted post's author), or its letter.
final class ComposeMiniAvatar: NSView {
    private let picture = CALayer()
    private let letter = NSTextField(labelWithString: "")

    init(size: CGFloat) {
        super.init(frame: NSRect(x: 0, y: 0, width: size, height: size))
        wantsLayer = true
        picture.contentsGravity = .resizeAspectFill
        picture.masksToBounds = true
        layer?.addSublayer(picture)
        letter.font = .systemFont(ofSize: size * 0.5, weight: .semibold)
        letter.alignment = .center
        letter.translatesAutoresizingMaskIntoConstraints = false
        addSubview(letter)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: size),
            heightAnchor.constraint(equalToConstant: size),
            letter.centerXAnchor.constraint(equalTo: centerXAnchor),
            letter.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        setAccessibilityElement(false)
    }

    required init?(coder: NSCoder) { nil }

    /// A data: URL of the picture, or "" for the handle's letter.
    func show(dataURL: String, handle: String) {
        letter.stringValue = String(handle.drop { $0 == "@" }.prefix(1)).uppercased()
        var image: NSImage?
        if let comma = dataURL.firstIndex(of: ","), dataURL.hasPrefix("data:image/"), let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])) {
            image = NSImage(data: data)
        }
        picture.contents = image?.layerContents(forContentsScale: window?.backingScaleFactor ?? 2)
        letter.isHidden = image != nil
        needsLayout = true
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        picture.frame = bounds
        picture.cornerRadius = bounds.width / 2
        layer?.cornerRadius = bounds.width / 2
        CATransaction.commit()
    }

    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        layer?.backgroundColor = SweeterColor.discSky.cgColor
        letter.textColor = SweeterColor.discSkyText
    }
}

/// A picture that fills its frame, cropped to it, with rounded corners (a
/// link's big card).
final class ComposeFillImage: NSView {
    var image: NSImage? {
        didSet { layer?.contents = image?.layerContents(forContentsScale: window?.backingScaleFactor ?? 2) }
    }

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.contentsGravity = .resizeAspectFill
        layer?.masksToBounds = true
        layer?.cornerRadius = 12
        layer?.cornerCurve = .continuous
        translatesAutoresizingMaskIntoConstraints = false
    }

    required init?(coder: NSCoder) { nil }

    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        layer?.backgroundColor = SweeterColor.card.cgColor
        layer?.borderColor = SweeterColor.line.cgColor
        layer?.borderWidth = 1
    }
}

/// The box's own background: the theme's, as a sheet of paper in the
/// window.
final class ComposeBackdrop: NSView {
    /// ⌘S anywhere in the window.
    var onSave: (() -> Void)?

    override var wantsUpdateLayer: Bool { true }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        if event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command, event.charactersIgnoringModifiers?.lowercased() == "s", let onSave {
            onSave()
            return true
        }
        return super.performKeyEquivalent(with: event)
    }

    override func updateLayer() {
        layer?.backgroundColor = SweeterColor.paper.cgColor
    }
}

/// A capsule button: a soft pill lying on the paper (who can reply, a send
/// time), a chip standing on it (a poll length), or a small dark tag (ALT).
final class ComposePill: NSButton {
    enum Tone {
        case sky, pink, chip, chipOn, danger, dark
    }

    var tone: Tone = .chip {
        didSet { needsDisplay = true }
    }

    /// An SF Symbol before the title, and one after it (a chevron).
    var symbol: String? {
        didSet { invalidateIntrinsicContentSize(); needsDisplay = true }
    }

    var trailingSymbol: String? {
        didSet { invalidateIntrinsicContentSize(); needsDisplay = true }
    }

    var pillHeight: CGFloat = 26 {
        didSet { invalidateIntrinsicContentSize() }
    }

    var pillFont = NSFont.systemFont(ofSize: 12, weight: .medium) {
        didSet { invalidateIntrinsicContentSize(); needsDisplay = true }
    }

    override var title: String {
        didSet { invalidateIntrinsicContentSize(); needsDisplay = true }
    }

    convenience init(_ title: String, tone: Tone, symbol: String? = nil, target: AnyObject? = nil, action: Selector? = nil) {
        self.init(frame: .zero)
        isBordered = false
        setButtonType(.momentaryPushIn)
        self.title = title
        self.tone = tone
        self.symbol = symbol
        self.target = target
        self.action = action
        // Its layer carries a chip's shadow.
        wantsLayer = true
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .horizontal)
        // Never taller than its capsule: a button hugs its height loosely (below
        // the window keeping its size, 500), so a fit stretched the reply pill
        // into an oval instead of shrinking the compose window.
        setContentHuggingPriority(.required, for: .vertical)
    }

    private var gap: CGFloat { 5 }
    private var symbolSide: CGFloat { (pillFont.pointSize - 1).rounded() }

    private func titleSize() -> NSSize {
        title.isEmpty ? .zero : (title as NSString).size(withAttributes: [.font: pillFont])
    }

    private var innerWidth: CGFloat {
        var w = ceil(titleSize().width)
        if symbol != nil { w += symbolSide + (title.isEmpty ? 0 : gap) }
        if trailingSymbol != nil { w += symbolSide - 2 + gap }
        return w
    }

    override var intrinsicContentSize: NSSize {
        NSSize(width: innerWidth + pillHeight * 0.85, height: pillHeight)
    }

    private func colors() -> (bg: NSColor, fg: NSColor) {
        switch tone {
        case .sky: return (SweeterColor.skyTint, SweeterColor.skyText)
        case .pink: return (SweeterColor.pinkTint, SweeterColor.pinkText)
        case .chip: return (SweeterColor.paper, SweeterColor.text)
        case .chipOn: return (SweeterColor.pinkFill, SweeterColor.onPink)
        case .danger: return (NSColor.systemRed.withAlphaComponent(0.10), .systemRed)
        case .dark: return (NSColor.black.withAlphaComponent(0.72), .white)
        }
    }

    override func layout() {
        super.layout()
        layer?.shadowPath = ComposeShape.path(bounds.insetBy(dx: 0.5, dy: 0.5), radius: bounds.height / 2)
    }

    /// A chip stands on the paper (a chosen one in the accent's glow); a
    /// soft pill lies on it.
    private func lift(dark: Bool, down: Bool) {
        let raised = tone == .chip || tone == .chipOn
        guard let layer else { return }
        layer.shadowOpacity = raised ? 1 : 0
        guard raised else { return }
        layer.shadowColor = (tone == .chipOn ? SweeterColor.pinkFill.withAlphaComponent(0.32) : ComposeShape.ink(dark ? 0.5 : 0.1)).cgColor
        layer.shadowRadius = down ? 1 : 3
        layer.shadowOffset = NSSize(width: 0, height: down ? -0.5 : -1.5)
    }

    override func draw(_ dirtyRect: NSRect) {
        let (bg, fg) = colors()
        let r = bounds.insetBy(dx: 0.5, dy: 0.5)
        let radius = r.height / 2
        let path = ComposeShape.bezier(r, radius: radius)
        let dark = ComposeShape.dark(self)
        let down = isHighlighted && isEnabled
        lift(dark: dark, down: down)
        switch tone {
        case .chip:
            (down ? bg.blended(withFraction: 0.06, of: SweeterColor.text) ?? bg : bg).setFill()
            path.fill()
            ComposeShape.edge(r, radius: radius, glint: NSColor.white.withAlphaComponent(dark ? 0.1 : 0.9), foot: ComposeShape.ink(dark ? 0.6 : 0.12), flipped: isFlipped)
            SweeterColor.line.setStroke()
            path.lineWidth = 0.5
            path.stroke()
        case .chipOn:
            ComposeShape.gem(r, radius: radius, pressed: down, flipped: isFlipped)
        case .dark:
            (down ? bg.blended(withFraction: 0.15, of: .black) ?? bg : bg).setFill()
            path.fill()
        case .sky, .pink, .danger:
            (down ? bg.blended(withFraction: 0.15, of: .labelColor) ?? bg : bg).setFill()
            path.fill()
            ComposeShape.edge(r, radius: radius, glint: NSColor.white.withAlphaComponent(dark ? 0.08 : 0.55), foot: fg.withAlphaComponent(dark ? 0.2 : 0.16), flipped: isFlipped, width: 0.75)
        }
        let alpha: CGFloat = isEnabled ? 1 : 0.45
        var x = (bounds.width - innerWidth) / 2
        let side = symbolSide
        func drawSymbol(_ name: String, side: CGFloat) {
            guard let img = ComposeShape.symbol(name, size: side, weight: .semibold, color: fg.withAlphaComponent(alpha)) else { return }
            let s = img.size
            let rect = NSRect(x: x, y: (bounds.height - s.height) / 2, width: s.width, height: s.height)
            img.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
            x += s.width
        }
        if let symbol {
            drawSymbol(symbol, side: side * 0.85)
            x = max(x, (bounds.width - innerWidth) / 2 + side)
            if !title.isEmpty { x += gap }
        }
        if !title.isEmpty {
            let attrs: [NSAttributedString.Key: Any] = [.font: pillFont, .foregroundColor: fg.withAlphaComponent(alpha)]
            let t = titleSize()
            (title as NSString).draw(at: NSPoint(x: x, y: (bounds.height - t.height) / 2), withAttributes: attrs)
            x += ceil(t.width)
        }
        if let trailingSymbol {
            x += gap
            drawSymbol(trailingSymbol, side: (side - 2) * 0.8)
        }
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        needsDisplay = true
    }

    // Keyboard focus rings the capsule.
    override var focusRingMaskBounds: NSRect { bounds }

    override func drawFocusRingMask() {
        let r = bounds.insetBy(dx: 0.5, dy: 0.5)
        ComposeShape.bezier(r, radius: r.height / 2).fill()
    }
}

/// “Add Another Post” under the post: a dashed row where the thread
/// grows, in the theme's quiet text color, and its accent while pointed at.
final class ComposeAddRow: NSButton {
    private var hovering = false {
        didSet { needsDisplay = true }
    }

    convenience init(_ title: String) {
        self.init(frame: .zero)
        isBordered = false
        setButtonType(.momentaryPushIn)
        self.title = title
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: 36).isActive = true
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for t in trackingAreas { removeTrackingArea(t) }
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect], owner: self))
    }

    override func mouseEntered(with event: NSEvent) { hovering = true }
    override func mouseExited(with event: NSEvent) { hovering = false }

    override func draw(_ dirtyRect: NSRect) {
        let lit = (hovering || isHighlighted) && isEnabled
        let r = bounds.insetBy(dx: 0.75, dy: 0.75)
        let path = NSBezierPath(roundedRect: r, xRadius: 12, yRadius: 12)
        if lit {
            SweeterColor.pinkTint.setFill()
            path.fill()
        }
        let color = lit ? SweeterColor.pinkText : SweeterColor.secondary
        path.lineWidth = 1.5
        path.setLineDash([5, 4], count: 2, phase: 0)
        (lit ? color : color.withAlphaComponent(0.45)).setStroke()
        path.stroke()
        let alpha: CGFloat = isEnabled ? 1 : 0.45
        var x: CGFloat = 14
        let config = NSImage.SymbolConfiguration(pointSize: 12, weight: .semibold).applying(.init(paletteColors: [color.withAlphaComponent(alpha)]))
        if let img = NSImage(systemSymbolName: "plus", accessibilityDescription: nil)?.withSymbolConfiguration(config) {
            img.draw(in: NSRect(x: x, y: (bounds.height - img.size.height) / 2, width: img.size.width, height: img.size.height), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
            x += img.size.width + 8
        }
        let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13, weight: .medium), .foregroundColor: color.withAlphaComponent(alpha)]
        let t = (title as NSString).size(withAttributes: attrs)
        (title as NSString).draw(at: NSPoint(x: x, y: (bounds.height - t.height) / 2), withAttributes: attrs)
    }

    override var focusRingMaskBounds: NSRect { bounds }

    override func drawFocusRingMask() {
        NSBezierPath(roundedRect: bounds.insetBy(dx: 0.75, dy: 0.75), xRadius: 12, yRadius: 12).fill()
    }
}

/// The person's picture (the page sends a small copy; Sweeter never loads
/// X's images itself), or the first letter of the handle, in a white ring
/// with a soft shadow of the solid accent.
final class ComposeAvatar: NSView {
    private let picture = CALayer()
    private let letter = NSTextField(labelWithString: "")
    private var image: NSImage?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.shadowOpacity = 1
        layer?.shadowRadius = 9
        layer?.shadowOffset = NSSize(width: 0, height: -3)
        picture.contentsGravity = .resizeAspectFill
        picture.masksToBounds = true
        layer?.addSublayer(picture)
        letter.font = .systemFont(ofSize: 18, weight: .semibold)
        letter.alignment = .center
        letter.translatesAutoresizingMaskIntoConstraints = false
        addSubview(letter)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 44),
            heightAnchor.constraint(equalToConstant: 44),
            letter.centerXAnchor.constraint(equalTo: centerXAnchor),
            letter.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        setAccessibilityElement(false)
    }

    required init?(coder: NSCoder) { nil }

    /// A data: URL of the picture, or nothing (the letter shows).
    func show(dataURL: String?, handle: String) {
        letter.stringValue = String(handle.drop { $0 == "@" }.prefix(1)).uppercased()
        if let s = dataURL, let comma = s.firstIndex(of: ","), s.hasPrefix("data:image/"), let data = Data(base64Encoded: String(s[s.index(after: comma)...])), let img = NSImage(data: data) {
            image = img
        } else if dataURL != nil {
            image = nil
        }
        picture.contents = image?.layerContents(forContentsScale: window?.backingScaleFactor ?? 2)
        letter.isHidden = image != nil
        needsLayout = true
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        picture.frame = bounds.insetBy(dx: 2.5, dy: 2.5)
        picture.cornerRadius = picture.frame.width / 2
        layer?.cornerRadius = bounds.width / 2
        layer?.shadowPath = CGPath(ellipseIn: bounds, transform: nil)
        CATransaction.commit()
    }

    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        let dark = effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        layer?.backgroundColor = SweeterColor.paper.cgColor
        // A hairline round the white ring, so it has an edge on white paper.
        layer?.borderWidth = 0.5
        layer?.borderColor = SweeterColor.line.cgColor
        layer?.shadowColor = SweeterColor.pink.withAlphaComponent(dark ? 0.35 : 0.28).cgColor
        picture.backgroundColor = SweeterColor.discSky.cgColor
        letter.textColor = SweeterColor.discSkyText
    }
}

/// A round tool in the floating bar: its symbol in the text color, in a
/// well while pointed at, and in a well of the solid accent's tint while
/// on (a poll, a send time).
final class ComposeDockButton: NSButton {
    var on = false {
        didSet { needsDisplay = true }
    }

    private var hovering = false {
        didSet { needsDisplay = true }
    }

    private var symbolName = ""
    private var pointSize: CGFloat = 15

    convenience init(symbol: String, label: String, tip: String, side: CGFloat = 36) {
        self.init(frame: .zero)
        pointSize = max(8, (side * 0.42).rounded())
        isBordered = false
        setButtonType(.momentaryPushIn)
        title = ""
        symbolName = symbol
        toolTip = tip
        setAccessibilityLabel(label)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: side),
            heightAnchor.constraint(equalToConstant: side),
        ])
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for t in trackingAreas { removeTrackingArea(t) }
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect], owner: self))
    }

    override func mouseEntered(with event: NSEvent) { hovering = true }
    override func mouseExited(with event: NSEvent) { hovering = false }

    override func draw(_ dirtyRect: NSRect) {
        let well = NSBezierPath(ovalIn: bounds.insetBy(dx: 1, dy: 1))
        let dark = ComposeShape.dark(self)
        let down = isHighlighted && isEnabled
        // A tool that is on, or under the pointer, sits in a well.
        if on {
            ComposeShape.carve(well, fill: SweeterColor.pinkTint, shade: SweeterColor.pinkFill.withAlphaComponent(down ? 0.5 : 0.34), depth: down ? 2 : 1.5)
        } else if (hovering || isHighlighted) && isEnabled {
            ComposeShape.carve(well, fill: SweeterColor.text.withAlphaComponent(dark ? 0.06 : 0.04), shade: ComposeShape.ink(dark ? 0.8 : (down ? 0.28 : 0.18)), depth: down ? 2 : 1.25)
        }
        // Idle tools at 72% of the text color, on ones in full; a third while disabled.
        let color = (on ? SweeterColor.pinkText : SweeterColor.text).withAlphaComponent((on ? 1 : 0.72) * (isEnabled ? 1 : 0.35))
        guard let img = ComposeShape.symbol(symbolName, size: pointSize, weight: .medium, color: color) else { return }
        let r = NSRect(x: (bounds.width - img.size.width) / 2, y: (bounds.height - img.size.height) / 2, width: img.size.width, height: img.size.height)
        img.draw(in: r, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    }

    override var focusRingMaskBounds: NSRect { bounds }

    override func drawFocusRingMask() {
        NSBezierPath(ovalIn: bounds.insetBy(dx: 1, dy: 1)).fill()
    }
}

/// A raised button on the theme's solid accent (Post, Set): a gem, with
/// its title in the color the theme puts on that accent (dark on
/// Catppuccin's and Dracula's light ones). It sinks while held and dims
/// while disabled.
final class ComposeAccentButton: NSButton {
    /// How tall: Post in the bar is 36, so its curve follows the bar's.
    var pillHeight: CGFloat = 28 {
        didSet { invalidateIntrinsicContentSize() }
    }

    var pillFont = NSFont.systemFont(ofSize: 13, weight: .semibold) {
        didSet { invalidateIntrinsicContentSize(); needsDisplay = true }
    }

    convenience init(_ title: String) {
        self.init(frame: .zero)
        isBordered = false
        setButtonType(.momentaryPushIn)
        self.title = title
        wantsLayer = true
        layer?.shadowOpacity = 1
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .vertical)
    }

    override var title: String {
        didSet { invalidateIntrinsicContentSize(); needsDisplay = true }
    }

    override var isEnabled: Bool {
        didSet { needsDisplay = true }
    }

    override var isHighlighted: Bool {
        didSet { needsDisplay = true }
    }

    /// Draws again in the theme's colors.
    func repaint() {
        needsDisplay = true
    }

    override var intrinsicContentSize: NSSize {
        let w = ceil((title as NSString).size(withAttributes: [.font: pillFont]).width)
        return NSSize(width: max(pillHeight * 1.8, w + pillHeight * 0.9), height: pillHeight)
    }

    override func layout() {
        super.layout()
        layer?.shadowPath = ComposeShape.path(bounds, radius: bounds.height / 2)
    }

    override func draw(_ dirtyRect: NSRect) {
        let down = isHighlighted && isEnabled
        layer?.shadowColor = SweeterColor.pinkFill.withAlphaComponent(isEnabled ? (down ? 0.25 : 0.4) : 0.12).cgColor
        layer?.shadowRadius = down ? 1.5 : 5
        layer?.shadowOffset = NSSize(width: 0, height: down ? -1 : -2.5)
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        ctx.saveGState()
        if !isEnabled { ctx.setAlpha(0.55) }
        ComposeShape.gem(bounds, radius: bounds.height / 2, pressed: down, flipped: isFlipped)
        let p = NSMutableParagraphStyle()
        p.alignment = .center
        p.lineBreakMode = .byTruncatingTail
        let attrs: [NSAttributedString.Key: Any] = [.font: pillFont, .foregroundColor: SweeterColor.onPink, .paragraphStyle: p]
        let line = ceil((title as NSString).size(withAttributes: attrs).height)
        let inset = pillHeight * 0.4
        let rect = NSRect(x: inset, y: ((bounds.height - line) / 2).rounded(), width: max(0, bounds.width - inset * 2), height: line)
        (title as NSString).draw(with: rect, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: attrs)
        ctx.restoreGState()
    }

    override var focusRingMaskBounds: NSRect { bounds }

    override func drawFocusRingMask() {
        ComposeShape.bezier(bounds, radius: bounds.height / 2).fill()
    }
}

/// A small round label: a poll choice's letter, a thread post's number.
final class ComposeDisc: NSView {
    enum Tone { case sky, pink }

    private let label = NSTextField(labelWithString: "")
    private let tone: Tone

    init(_ text: String, tone: Tone, side: CGFloat = 24) {
        self.tone = tone
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = side / 2
        label.stringValue = text
        label.font = .systemFont(ofSize: (side * 0.48).rounded(), weight: .bold)
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: side),
            heightAnchor.constraint(equalToConstant: side),
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        setAccessibilityElement(false)
    }

    required init?(coder: NSCoder) { nil }

    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        layer?.backgroundColor = (tone == .sky ? SweeterColor.discSky : SweeterColor.discPink).cgColor
        label.textColor = tone == .sky ? SweeterColor.discSkyText : SweeterColor.discPinkText
    }
}

/// A rounded row on the paper: a poll choice, another post of a thread, or
/// the floating bar. It has depth, lit from above: brighter at the top, a
/// glint inside its hairline, a darker foot, and two shadows in ink (a
/// tight one where it meets the paper, a soft one as it floats).
class ComposeCapsule: NSView {
    var radius: CGFloat = 18 {
        didSet { needsDisplay = true; needsLayout = true }
    }

    /// Its field is being edited: the hairline turns pink.
    var focused = false {
        didSet { needsDisplay = true }
    }

    /// How far it floats: its soft shadow's strength and size.
    var lift: (alpha: CGFloat, blur: CGFloat, drop: CGFloat) = (0.05, 3, 1) {
        didSet { needsDisplay = true }
    }

    /// The tight shadow, the light across it, and its edge (a ring inside
    /// the hairline: the glint, then the foot). The layer's own border is
    /// drawn over all three.
    private let contact = CALayer()
    private let sheen = CAGradientLayer()
    private let rim = CAGradientLayer()
    private let rimShape = CAShapeLayer()

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.shadowOpacity = 1
        contact.shadowOpacity = 1
        sheen.masksToBounds = true
        rimShape.fillRule = .evenOdd
        rim.mask = rimShape
        // Top to bottom: a layer's y runs up unless its view is flipped.
        for g in [sheen, rim] {
            g.startPoint = CGPoint(x: 0.5, y: 1)
            g.endPoint = CGPoint(x: 0.5, y: 0)
        }
        rim.locations = [0, 0.5, 0.6, 1]
        for l in [contact, sheen, rim] { layer?.addSublayer(l) }
    }

    required init?(coder: NSCoder) { nil }

    private func rounded(_ inset: CGFloat) -> CGPath {
        let r = bounds.insetBy(dx: inset, dy: inset)
        let c = max(0, min(radius - inset, r.width / 2, r.height / 2))
        return CGPath(roundedRect: r, cornerWidth: c, cornerHeight: c, transform: nil)
    }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer?.shadowPath = rounded(0)
        for l in [contact, sheen, rim, rimShape] { l.frame = bounds }
        contact.shadowPath = rounded(0)
        let ring = CGMutablePath()
        ring.addPath(rounded(1))
        ring.addPath(rounded(2))
        rimShape.path = ring
        CATransaction.commit()
    }

    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        guard let layer else { return }
        let dark = ComposeShape.dark(self)
        let r = min(radius, bounds.height / 2)
        layer.cornerRadius = r
        layer.backgroundColor = SweeterColor.paper.cgColor
        layer.borderColor = (focused ? SweeterColor.pinkText : SweeterColor.line).cgColor
        layer.borderWidth = focused ? 1.5 : 1
        layer.shadowColor = ComposeShape.ink(dark ? min(0.9, lift.alpha * 2.5) : lift.alpha).cgColor
        layer.shadowRadius = lift.blur
        layer.shadowOffset = NSSize(width: 0, height: -lift.drop)
        contact.cornerRadius = r
        contact.backgroundColor = SweeterColor.paper.cgColor
        contact.shadowColor = (dark ? NSColor.black.withAlphaComponent(0.6) : ComposeShape.ink(0.1)).cgColor
        contact.shadowRadius = 1.5
        contact.shadowOffset = NSSize(width: 0, height: -1)
        sheen.cornerRadius = r
        let white = NSColor.white
        sheen.colors = dark ? [white.withAlphaComponent(0.06).cgColor, white.withAlphaComponent(0).cgColor] : [white.withAlphaComponent(0).cgColor, ComposeShape.ink(0.04).cgColor]
        let glint = white.withAlphaComponent(dark ? 0.12 : 0.9)
        let foot = dark ? NSColor.black.withAlphaComponent(0.35) : ComposeShape.ink(0.07)
        rim.colors = [glint.cgColor, glint.withAlphaComponent(0).cgColor, foot.withAlphaComponent(0).cgColor, foot.cgColor]
    }
}

/// The count as a ring: how much of 280 is used, pink, then orange for a
/// long post and red past what X takes.
final class ComposeCountRing: NSView {
    var used: CGFloat = 0 {
        didSet { needsDisplay = true }
    }

    var level = "" {
        didSet { needsDisplay = true }
    }

    override var intrinsicContentSize: NSSize { NSSize(width: 18, height: 18) }

    override func draw(_ dirtyRect: NSRect) {
        let c = NSPoint(x: bounds.midX, y: bounds.midY)
        let r = min(bounds.width, bounds.height) / 2 - 2
        let color: NSColor = level == "over" ? .systemRed : level == "long" ? .systemOrange : SweeterColor.pink
        let track = NSBezierPath()
        track.appendArc(withCenter: c, radius: r, startAngle: 0, endAngle: 360)
        track.lineWidth = 2.4
        color.withAlphaComponent(0.2).setStroke()
        track.stroke()
        let f = level.isEmpty ? max(0, min(1, used)) : 1
        guard f > 0 else { return }
        let arc = NSBezierPath()
        arc.appendArc(withCenter: c, radius: r, startAngle: 90, endAngle: 90 - 360 * f, clockwise: true)
        arc.lineWidth = 2.4
        arc.lineCapStyle = .round
        color.setStroke()
        arc.stroke()
    }

    /// The number in the page's count (“116 / 280”, “1,204 · long post”),
    /// as the page wrote it: some locales group thousands with a space.
    static func number(_ count: String) -> String {
        let end = count.range(of: " / ")?.lowerBound ?? count.range(of: " · ")?.lowerBound ?? count.endIndex
        return String(count[..<end])
    }

    /// The page's count as a share of 280.
    func show(_ count: String, level: String) {
        let n = Double(Self.number(count).filter(\.isNumber)) ?? 0
        used = CGFloat(n / 280)
        self.level = level
        isHidden = count.isEmpty
    }
}

/// The count beside Post: the ring, then “116 / 280”, in a slot as wide as
/// “280 / 280”, so the bar keeps its size while you type. Past 280 it
/// shows the length alone, in orange (red past what X takes), and its
/// tooltip says “long post”.
final class ComposeCount: NSView {
    private let ring = ComposeCountRing()
    private let label = NSTextField(labelWithString: "")
    private static let font = NSFont.monospacedDigitSystemFont(ofSize: NSFont.smallSystemFontSize, weight: .regular)
    private static let slot = ceil(("280 / 280" as NSString).size(withAttributes: [.font: font]).width) + 2

    override init(frame: NSRect) {
        super.init(frame: frame)
        label.font = Self.font
        label.setAccessibilityElement(false)
        label.widthAnchor.constraint(equalToConstant: Self.slot).isActive = true
        let row = NSStackView(views: [ring, label])
        row.spacing = 6
        row.alignment = .centerY
        row.translatesAutoresizingMaskIntoConstraints = false
        ring.setContentHuggingPriority(.required, for: .horizontal)
        addSubview(row)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.topAnchor.constraint(equalTo: topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        setAccessibilityElement(true)
        setAccessibilityRole(.staticText)
        show("0 / 280", level: "")
    }

    required init?(coder: NSCoder) { nil }

    /// The page's count (“116 / 280”, “1,204 · long post”) and its level.
    func show(_ count: String, level: String) {
        ring.show(count, level: level)
        label.stringValue = level.isEmpty ? count : ComposeCountRing.number(count)
        label.textColor = level == "over" ? .systemRed : level == "long" ? .systemOrange : SweeterColor.secondary
        isHidden = count.isEmpty
        toolTip = count
        setAccessibilityLabel(count)
    }
}

/// An engraved line in the bar, between the tools and the count: a line of
/// shadow and a lit one beside it, fading out at both ends.
final class ComposeGroove: NSView {
    override var intrinsicContentSize: NSSize { NSSize(width: 2, height: 24) }

    override func draw(_ dirtyRect: NSRect) {
        let dark = ComposeShape.dark(self)
        for (x, color) in [(0, ComposeShape.ink(dark ? 0.9 : 0.16)), (1, NSColor.white.withAlphaComponent(dark ? 0.08 : 1))] as [(CGFloat, NSColor)] {
            let fade = NSGradient(colors: [color.withAlphaComponent(0), color, color.withAlphaComponent(0)], atLocations: [0, 0.5, 1], colorSpace: .sRGB)
            fade?.draw(in: NSRect(x: x, y: 0, width: 1, height: bounds.height), angle: 90)
        }
    }
}
