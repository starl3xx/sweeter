//
//  ComposeLook.swift
//  Sweeter
//
//  Sweeter's own look inside the Mac compose window: the window and its
//  toolbar stay the Mac's, and what sits in the box takes the theme's
//  colors (in Sweeter's theme, the icon's sky and the bird's pink) and
//  rounder shapes: pills, chips, lettered circles and a counter ring.
//

import Cocoa

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

/// The box's own background: the theme's, as a sheet of paper in the
/// window.
final class ComposeBackdrop: NSView {
    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        layer?.backgroundColor = SweeterColor.paper.cgColor
    }
}

/// A capsule button: a pill (who can reply, a send time), a chip (a poll
/// length), or a small dark tag (ALT).
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
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .horizontal)
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

    private func colors() -> (bg: NSColor, fg: NSColor, line: NSColor?) {
        switch tone {
        case .sky: return (SweeterColor.skyTint, SweeterColor.skyText, nil)
        case .pink: return (SweeterColor.pinkTint, SweeterColor.pinkText, nil)
        case .chip: return (SweeterColor.paper, SweeterColor.text, SweeterColor.line)
        case .chipOn: return (SweeterColor.pinkFill, SweeterColor.onPink, nil)
        case .danger: return (NSColor.systemRed.withAlphaComponent(0.10), .systemRed, nil)
        case .dark: return (NSColor.black.withAlphaComponent(0.72), .white, nil)
        }
    }

    override func draw(_ dirtyRect: NSRect) {
        let (bg, fg, line) = colors()
        let r = bounds.insetBy(dx: 0.5, dy: 0.5)
        let path = NSBezierPath(roundedRect: r, xRadius: r.height / 2, yRadius: r.height / 2)
        var fill = bg
        if isHighlighted { fill = bg.blended(withFraction: 0.15, of: tone == .dark || tone == .chipOn ? .black : .labelColor) ?? bg }
        fill.setFill()
        path.fill()
        if let line {
            line.setStroke()
            path.lineWidth = 1
            path.stroke()
        }
        let alpha: CGFloat = isEnabled ? 1 : 0.45
        var x = (bounds.width - innerWidth) / 2
        let side = symbolSide
        func drawSymbol(_ name: String, side: CGFloat) {
            let config = NSImage.SymbolConfiguration(pointSize: side, weight: .semibold).applying(.init(paletteColors: [fg.withAlphaComponent(alpha)]))
            guard let img = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(config) else { return }
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
        NSBezierPath(roundedRect: r, xRadius: r.height / 2, yRadius: r.height / 2).fill()
    }
}

/// A push button on the theme's solid accent (Post, Set): its title in
/// the color the theme puts on that accent (dark on Catppuccin's and
/// Dracula's light ones), dimmed while disabled.
final class ComposeAccentButton: NSButton {
    private var painting = false

    override var title: String {
        didSet { repaint() }
    }

    override var isEnabled: Bool {
        didSet { repaint() }
    }

    func repaint() {
        guard !painting else { return }
        painting = true
        defer { painting = false }
        bezelColor = SweeterColor.pinkFill
        let p = NSMutableParagraphStyle()
        p.alignment = .center
        attributedTitle = NSAttributedString(string: title, attributes: [
            .font: font ?? .systemFont(ofSize: NSFont.systemFontSize),
            .foregroundColor: SweeterColor.onPink.withAlphaComponent(isEnabled ? 1 : 0.55),
            .paragraphStyle: p,
        ])
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        repaint()
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

/// A rounded row on the paper: a poll choice, or another post of a thread.
class ComposeCapsule: NSView {
    var radius: CGFloat = 18 {
        didSet { needsDisplay = true }
    }

    /// Its field is being edited: the hairline turns pink.
    var focused = false {
        didSet { needsDisplay = true }
    }

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.shadowOpacity = 1
        layer?.shadowRadius = 3
        layer?.shadowOffset = NSSize(width: 0, height: -1)
    }

    required init?(coder: NSCoder) { nil }

    override var wantsUpdateLayer: Bool { true }

    override func updateLayer() {
        guard let layer else { return }
        layer.cornerRadius = radius
        layer.backgroundColor = SweeterColor.paper.cgColor
        layer.borderColor = (focused ? SweeterColor.pinkText : SweeterColor.line).cgColor
        layer.borderWidth = focused ? 1.5 : 1
        layer.shadowColor = NSColor.black.withAlphaComponent(effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? 0 : 0.05).cgColor
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

    /// The page's count (“116 / 280”, “1,204 · long post”) as a share of 280.
    func show(_ count: String, level: String) {
        let digits = count.prefix { $0.isNumber || $0 == "," || $0 == "." }
        let n = Double(digits.filter(\.isNumber)) ?? 0
        used = CGFloat(n / 280)
        self.level = level
        isHidden = count.isEmpty
    }
}
