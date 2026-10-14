//
//  ComposeCalendar.swift
//  Sweeter
//
//  The schedule popover's own calendar and time field, drawn in the
//  theme's colors (AppKit's date pickers take only the Mac's accent):
//  a month of days with today in the solid accent and the chosen day
//  filled with it, and a capsule of hour, minute and AM/PM.
//

import Cocoa

/// A month to pick a day from. Days before minDate or after maxDate are
/// dimmed and can't be chosen; a day of the month before or after opens
/// that month. Arrows move a day or a week, Page Up and Page Down a month.
final class ComposeCalendarView: NSView {
    var onChange: (() -> Void)?
    /// The chosen day (its start).
    private(set) var selected: Date
    private let minDate: Date
    private let maxDate: Date
    /// The first day of the month shown.
    private var month: Date
    private var hover: Date?
    private let cal = Calendar.current
    private let prev = ComposeDockButton(symbol: "chevron.left", label: "Previous Month", tip: "Previous month", side: 24)
    private let next = ComposeDockButton(symbol: "chevron.right", label: "Next Month", tip: "Next month", side: 24)

    private static let cellW: CGFloat = 34
    private static let cellH: CGFloat = 30
    private static let headH: CGFloat = 30
    private static let weekH: CGFloat = 20

    init(selected: Date, min: Date, max: Date) {
        let c = Calendar.current
        minDate = c.startOfDay(for: min)
        maxDate = c.startOfDay(for: max)
        // A day already past (a saved time gone by) opens on today.
        let day = Swift.min(c.startOfDay(for: max), Swift.max(c.startOfDay(for: min), c.startOfDay(for: selected)))
        self.selected = day
        month = c.date(from: c.dateComponents([.year, .month], from: day)) ?? day
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        for (b, sel) in [(prev, #selector(prevMonth)), (next, #selector(nextMonth))] {
            b.target = self
            b.action = sel
            // The keyboard stays on the days (arrows move them, Return sets).
            b.refusesFirstResponder = true
            addSubview(b)
        }
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: Self.cellW * 7),
            heightAnchor.constraint(equalToConstant: Self.headH + Self.weekH + Self.cellH * 6),
            next.trailingAnchor.constraint(equalTo: trailingAnchor),
            next.centerYAnchor.constraint(equalTo: topAnchor, constant: Self.headH / 2 - 2),
            prev.trailingAnchor.constraint(equalTo: next.leadingAnchor, constant: -2),
            prev.centerYAnchor.constraint(equalTo: next.centerYAnchor),
        ])
        setAccessibilityElement(true)
        setAccessibilityRole(.incrementor)
        setAccessibilityLabel("Send date")
        refreshArrows()
    }

    required init?(coder: NSCoder) { nil }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    /// Another day, kept inside min…max, with its month shown.
    func select(_ date: Date) {
        let day = min(maxDate, max(minDate, cal.startOfDay(for: date)))
        let changed = day != selected
        selected = day
        month = cal.date(from: cal.dateComponents([.year, .month], from: day)) ?? day
        refreshArrows()
        needsDisplay = true
        if changed { onChange?() }
    }

    private func refreshArrows() {
        let first = cal.date(from: cal.dateComponents([.year, .month], from: minDate)) ?? minDate
        prev.isEnabled = month > first
        let after = cal.date(byAdding: .month, value: 1, to: month) ?? month
        next.isEnabled = after <= maxDate
        setAccessibilityValue(selected.formatted(date: .complete, time: .omitted))
    }

    @objc private func prevMonth() { shiftMonth(-1) }
    @objc private func nextMonth() { shiftMonth(1) }

    /// The month before or after, with the same day of it where there is one.
    private func shiftMonth(_ n: Int) {
        guard let d = cal.date(byAdding: .month, value: n, to: selected) else { return }
        select(d)
    }

    /// The 42 days shown: the month's weeks, from the locale's first weekday.
    private func days() -> [Date] {
        let lead = (cal.component(.weekday, from: month) - cal.firstWeekday + 7) % 7
        let start = cal.date(byAdding: .day, value: -lead, to: month) ?? month
        return (0 ..< 42).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
    }

    private func rect(_ i: Int) -> NSRect {
        NSRect(x: CGFloat(i % 7) * Self.cellW, y: Self.headH + Self.weekH + CGFloat(i / 7) * Self.cellH, width: Self.cellW, height: Self.cellH)
    }

    private func day(at p: NSPoint) -> Date? {
        let list = days()
        for i in 0 ..< list.count where rect(i).contains(p) { return list[i] }
        return nil
    }

    private func usable(_ d: Date) -> Bool { d >= minDate && d <= maxDate }

    override func draw(_ dirtyRect: NSRect) {
        // The month and year.
        let title = month.formatted(.dateTime.month(.wide).year())
        let tAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13, weight: .semibold), .foregroundColor: SweeterColor.text]
        let ts = (title as NSString).size(withAttributes: tAttrs)
        (title as NSString).draw(at: NSPoint(x: 4, y: (Self.headH - ts.height) / 2 - 2), withAttributes: tAttrs)
        // The weekdays, from the locale's first.
        let symbols = cal.veryShortStandaloneWeekdaySymbols
        let wAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 10.5, weight: .semibold), .foregroundColor: SweeterColor.secondary]
        for i in 0 ..< 7 {
            let s = symbols[(i + cal.firstWeekday - 1) % 7] as NSString
            let sz = s.size(withAttributes: wAttrs)
            s.draw(at: NSPoint(x: CGFloat(i) * Self.cellW + (Self.cellW - sz.width) / 2, y: Self.headH + (Self.weekH - sz.height) / 2), withAttributes: wAttrs)
        }
        // The days.
        let today = cal.startOfDay(for: .now)
        let thisMonth = cal.component(.month, from: month)
        for (i, d) in days().enumerated() {
            let r = rect(i)
            let ok = usable(d)
            let inMonth = cal.component(.month, from: d) == thisMonth
            let isSel = d == selected
            let circle = NSBezierPath(ovalIn: NSRect(x: r.midX - 13, y: r.midY - 13, width: 26, height: 26))
            if isSel {
                SweeterColor.pinkFill.setFill()
                circle.fill()
            } else if ok, hover == d {
                SweeterColor.text.withAlphaComponent(0.07).setFill()
                circle.fill()
            }
            let color: NSColor = isSel ? SweeterColor.onPink : !ok ? SweeterColor.secondary.withAlphaComponent(0.35) : d == today ? SweeterColor.pinkText : inMonth ? SweeterColor.text : SweeterColor.secondary.withAlphaComponent(0.6)
            let weight: NSFont.Weight = isSel || d == today ? .semibold : .regular
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedDigitSystemFont(ofSize: 12.5, weight: weight), .foregroundColor: color]
            let s = String(cal.component(.day, from: d)) as NSString
            let sz = s.size(withAttributes: attrs)
            s.draw(at: NSPoint(x: r.midX - sz.width / 2, y: r.midY - sz.height / 2), withAttributes: attrs)
        }
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for t in trackingAreas { removeTrackingArea(t) }
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseMoved, .mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect], owner: self))
    }

    override func mouseMoved(with event: NSEvent) {
        let d = day(at: convert(event.locationInWindow, from: nil))
        if d != hover {
            hover = d
            needsDisplay = true
        }
    }

    override func mouseExited(with event: NSEvent) {
        hover = nil
        needsDisplay = true
    }

    override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        guard let d = day(at: convert(event.locationInWindow, from: nil)), usable(d) else { return }
        select(d)
    }

    override func keyDown(with event: NSEvent) {
        let step: [UInt16: (Calendar.Component, Int)] = [123: (.day, -1), 124: (.day, 1), 126: (.day, -7), 125: (.day, 7), 116: (.month, -1), 121: (.month, 1)]
        guard let (unit, n) = step[event.keyCode], let d = cal.date(byAdding: unit, value: n, to: selected) else { return super.keyDown(with: event) }
        select(d)
    }

    override func accessibilityPerformIncrement() -> Bool {
        if let d = cal.date(byAdding: .day, value: 1, to: selected) { select(d) }
        return true
    }

    override func accessibilityPerformDecrement() -> Bool {
        if let d = cal.date(byAdding: .day, value: -1, to: selected) { select(d) }
        return true
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        needsDisplay = true
    }
}

/// A time as a capsule of parts (hour, minute, and AM/PM where the
/// locale uses it). Click a part, then type it, use ↑ and ↓, or scroll;
/// ← and → (or Tab) move between parts; the small arrows step the part,
/// minutes by 5.
final class ComposeTimeField: NSView {
    var onChange: (() -> Void)?
    private(set) var hour: Int
    private(set) var minute: Int
    private let twelve: Bool
    private enum Part: Int { case hour, minute, ampm }
    private var part: Part = .hour
    private var typed = ""
    private var focused = false {
        didSet { needsDisplay = true }
    }

    private let up = ComposeDockButton(symbol: "chevron.up", label: "Later", tip: "Later", side: 15)
    private let down = ComposeDockButton(symbol: "chevron.down", label: "Earlier", tip: "Earlier", side: 15)
    private static let font = NSFont.monospacedDigitSystemFont(ofSize: 14, weight: .medium)

    init(hour: Int, minute: Int) {
        self.hour = hour
        self.minute = minute
        twelve = (DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: .current) ?? "").contains("a")
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        up.target = self
        up.action = #selector(stepUp)
        down.target = self
        down.action = #selector(stepDown)
        // A click on the arrows leaves the keyboard in the field, so they
        // step the part chosen there (hour, minute, or AM/PM).
        up.refusesFirstResponder = true
        down.refusesFirstResponder = true
        let arrows = NSStackView(views: [up, down])
        arrows.orientation = .vertical
        arrows.spacing = 0
        arrows.translatesAutoresizingMaskIntoConstraints = false
        addSubview(arrows)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 32),
            widthAnchor.constraint(equalToConstant: twelve ? 132 : 104),
            arrows.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -7),
            arrows.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        setAccessibilityElement(true)
        setAccessibilityRole(.incrementor)
        setAccessibilityLabel("Send time")
        refreshValue()
    }

    required init?(coder: NSCoder) { nil }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    override func becomeFirstResponder() -> Bool {
        focused = true
        return true
    }

    override func resignFirstResponder() -> Bool {
        focused = false
        typed = ""
        return true
    }

    func set(hour h: Int, minute m: Int) {
        hour = (h % 24 + 24) % 24
        minute = (m % 60 + 60) % 60
        typed = ""
        refreshValue()
        needsDisplay = true
    }

    private func changed() {
        refreshValue()
        needsDisplay = true
        onChange?()
    }

    private func refreshValue() {
        let d = Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: .now) ?? .now
        setAccessibilityValue(d.formatted(date: .omitted, time: .shortened))
    }

    /// Each part's text and the rect it's drawn in.
    private func parts() -> [(Part, String, NSRect)] {
        let h = twelve ? String(hour % 12 == 0 ? 12 : hour % 12) : String(format: "%02d", hour)
        var list: [(Part, String)] = [(.hour, h), (.minute, String(format: "%02d", minute))]
        if twelve { list.append((.ampm, hour < 12 ? Calendar.current.amSymbol : Calendar.current.pmSymbol)) }
        var x: CGFloat = 12
        var out: [(Part, String, NSRect)] = []
        let attrs: [NSAttributedString.Key: Any] = [.font: Self.font]
        for (i, (p, s)) in list.enumerated() {
            let w = ceil((s as NSString).size(withAttributes: attrs).width)
            let pad: CGFloat = 4
            out.append((p, s, NSRect(x: x - pad, y: 6, width: w + pad * 2, height: bounds.height - 12)))
            x += w + (i == 0 ? 10 : 8)
        }
        return out
    }

    override func draw(_ dirtyRect: NSRect) {
        let r = bounds.insetBy(dx: 0.5, dy: 0.5)
        let capsule = NSBezierPath(roundedRect: r, xRadius: r.height / 2, yRadius: r.height / 2)
        SweeterColor.paper.setFill()
        capsule.fill()
        capsule.lineWidth = focused ? 1.5 : 1
        (focused ? SweeterColor.pinkText : SweeterColor.line).setStroke()
        capsule.stroke()
        let list = parts()
        for (i, (p, s, rect)) in list.enumerated() {
            let on = focused && p == part
            if on {
                SweeterColor.pinkTint.setFill()
                NSBezierPath(roundedRect: rect, xRadius: 5, yRadius: 5).fill()
            }
            let attrs: [NSAttributedString.Key: Any] = [.font: Self.font, .foregroundColor: on ? SweeterColor.pinkText : SweeterColor.text]
            let sz = (s as NSString).size(withAttributes: attrs)
            (s as NSString).draw(at: NSPoint(x: rect.midX - sz.width / 2, y: rect.midY - sz.height / 2), withAttributes: attrs)
            // The colon between hour and minute.
            if i == 0 {
                let c: [NSAttributedString.Key: Any] = [.font: Self.font, .foregroundColor: SweeterColor.secondary]
                let cs = (":" as NSString).size(withAttributes: c)
                (":" as NSString).draw(at: NSPoint(x: rect.maxX + 1, y: rect.midY - cs.height / 2), withAttributes: c)
            }
        }
    }

    private func part(at p: NSPoint) -> Part? {
        parts().first { $0.2.insetBy(dx: -3, dy: -6).contains(p) }?.0
    }

    override func mouseDown(with event: NSEvent) {
        if let p = part(at: convert(event.locationInWindow, from: nil)) { part = p }
        typed = ""
        window?.makeFirstResponder(self)
        needsDisplay = true
    }

    /// A trackpad's scroll, gathered into steps: one per 12 points, none
    /// from the coasting after the fingers lift.
    private var scrolled: CGFloat = 0

    override func scrollWheel(with event: NSEvent) {
        guard event.momentumPhase.isEmpty else { return }
        if event.phase == .began { scrolled = 0 }
        // The part under the pointer is the one being scrolled, and shows so.
        if let p = part(at: convert(event.locationInWindow, from: nil)), p != part {
            part = p
            typed = ""
            needsDisplay = true
        }
        guard event.hasPreciseScrollingDeltas else {
            if event.scrollingDeltaY != 0 { step(part, event.scrollingDeltaY > 0 ? 1 : -1) }
            return
        }
        scrolled += event.scrollingDeltaY
        while abs(scrolled) >= 12 {
            let n = scrolled > 0 ? 1 : -1
            scrolled -= CGFloat(n) * 12
            step(part, n)
        }
    }

    private func step(_ p: Part, _ n: Int) {
        typed = ""
        switch p {
        case .hour: hour = (hour + n + 24) % 24
        case .minute:
            // Minutes carry into the hour (2:59 and one more is 3:00).
            let t = (hour * 60 + minute + n + 1440) % 1440
            hour = t / 60
            minute = t % 60
        // Up (or a scroll up) is PM, down is AM: a direction, never a flip,
        // so a trackpad's many scroll events land where the gesture points.
        case .ampm:
            if (n > 0) != (hour >= 12) { hour = (hour + 12) % 24 }
        }
        changed()
    }

    /// The small arrows: the part being edited, minutes to the next 5.
    @objc private func stepUp() { arrowStep(1) }
    @objc private func stepDown() { arrowStep(-1) }

    private func arrowStep(_ n: Int) {
        let p = focused ? part : .minute
        if p == .minute {
            // To the next 5 minutes, carrying into the hour (2:58 is then 3:00).
            let now = hour * 60 + minute
            let next = n > 0 ? (now / 5 + 1) * 5 : ((now + 4) / 5 - 1) * 5
            let t = (next + 1440) % 1440
            hour = t / 60
            minute = t % 60
            typed = ""
            changed()
        } else {
            step(p, n)
        }
    }

    override func keyDown(with event: NSEvent) {
        let order: [Part] = twelve ? [.hour, .minute, .ampm] : [.hour, .minute]
        let i = order.firstIndex(of: part) ?? 0
        switch event.keyCode {
        case 126:
            step(part, 1)
            return
        case 125:
            step(part, -1)
            return
        case 123, 124:
            part = order[event.keyCode == 123 ? max(0, i - 1) : min(order.count - 1, i + 1)]
            typed = ""
            needsDisplay = true
            return
        case 48:
            // Tab moves through the parts, then out of the field.
            let back = event.modifierFlags.contains(.shift)
            let j = i + (back ? -1 : 1)
            if j >= 0, j < order.count {
                part = order[j]
                typed = ""
                needsDisplay = true
            } else if back {
                window?.selectPreviousKeyView(self)
            } else {
                window?.selectNextKeyView(self)
            }
            return
        default:
            break
        }
        guard let ch = event.charactersIgnoringModifiers?.lowercased().first else { return super.keyDown(with: event) }
        if twelve, ch == "a" || ch == "p" {
            let pm = ch == "p"
            if pm != (hour >= 12) { hour = (hour + 12) % 24 }
            return changed()
        }
        guard let digit = ch.wholeNumberValue, part != .ampm else { return super.keyDown(with: event) }
        typed += String(digit)
        let v = Int(typed) ?? 0
        if part == .hour {
            if twelve {
                let h12 = v == 0 ? 12 : min(12, v)
                hour = (h12 % 12) + (hour >= 12 ? 12 : 0)
                if typed.count == 2 || v > 1 { part = .minute; typed = "" }
            } else {
                hour = min(23, v)
                if typed.count == 2 || v > 2 { part = .minute; typed = "" }
            }
        } else {
            minute = min(59, v)
            if typed.count == 2 || v > 5 {
                typed = ""
                if twelve { part = .ampm }
            }
        }
        changed()
    }

    override func accessibilityPerformIncrement() -> Bool {
        arrowStep(1)
        return true
    }

    override func accessibilityPerformDecrement() -> Bool {
        arrowStep(-1)
        return true
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        needsDisplay = true
    }
}
