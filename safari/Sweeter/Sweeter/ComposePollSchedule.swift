//
//  ComposePollSchedule.swift
//  Sweeter
//
//  A poll and a send time in the Mac compose window. The rules are X
//  Pro's (app.js, text.js): two to four choices of up to 25 characters, a
//  length of 5 minutes to 7 days; a time in this Mac's time zone, after
//  now and at most 18 months ahead. The page checks both again at Post.
//

import Cocoa

// MARK: - A poll

struct ComposePoll: Equatable {
    static let choiceMax = 25
    var choices: [String]
    var days: Int
    var hours: Int
    var minutes: Int

    /// X Pro's first choice: two empty choices and one day.
    static let fresh = ComposePoll(choices: ["", ""], days: 1, hours: 0, minutes: 0)

    init(choices: [String], days: Int, hours: Int, minutes: Int) {
        self.choices = choices
        self.days = days
        self.hours = hours
        self.minutes = minutes
        fit()
    }

    init?(_ o: Any?) {
        guard let o = o as? [String: Any], let c = o["choices"] as? [Any] else { return nil }
        self.init(choices: c.map { String(describing: $0) }, days: o["days"] as? Int ?? 1, hours: o["hours"] as? Int ?? 0, minutes: o["minutes"] as? Int ?? 0)
    }

    /// Inside X Pro's rules (text.js pollLength): 7 days takes no hours or
    /// minutes, and under an hour is 5 minutes at least.
    mutating func fit() {
        choices = Array(choices.prefix(4)).map(Self.clip)
        while choices.count < 2 { choices.append("") }
        days = min(7, max(0, days))
        hours = days == 7 ? 0 : min(23, max(0, hours))
        minutes = days == 7 ? 0 : min(59, max(minutesMin, minutes))
    }

    /// At most 25 UTF-16 units, as the page counts (and X Pro's field),
    /// never cutting a character in two.
    static func clip(_ s: String) -> String {
        var out = ""
        var n = 0
        for ch in s {
            let u = ch.utf16.count
            if n + u > choiceMax { break }
            out.append(ch)
            n += u
        }
        return out
    }

    var hoursMax: Int { days == 7 ? 0 : 23 }
    var minutesMin: Int { days == 0 && hours == 0 ? 5 : 0 }
    var minutesMax: Int { days == 7 ? 0 : 59 }

    var dict: [String: Any] { ["choices": choices, "days": days, "hours": hours, "minutes": minutes] }
}

/// The poll under the text: its choices, Add a Choice, the length, and
/// Remove Poll.
final class ComposePollView: NSBox, NSTextFieldDelegate {
    var onChange: ((ComposePoll?) -> Void)?
    private(set) var poll = ComposePoll.fresh
    private let choiceStack = NSStackView()
    private let addButton = NSButton(title: "Add a Choice", target: nil, action: nil)
    private let days = NSPopUpButton(frame: .zero, pullsDown: false)
    private let hours = NSPopUpButton(frame: .zero, pullsDown: false)
    private let minutes = NSPopUpButton(frame: .zero, pullsDown: false)
    private var fields: [NSTextField] = []

    init() {
        super.init(frame: .zero)
        boxType = .custom
        cornerRadius = 8
        borderColor = .separatorColor
        borderWidth = 1
        fillColor = .clear
        titlePosition = .noTitle
        contentViewMargins = NSSize(width: 10, height: 8)

        choiceStack.orientation = .vertical
        choiceStack.alignment = .leading
        choiceStack.spacing = 6
        addButton.target = self
        addButton.action = #selector(addChoice)
        addButton.controlSize = .small
        addButton.bezelStyle = .push

        for (p, sel) in [(days, #selector(daysChanged)), (hours, #selector(lengthChanged)), (minutes, #selector(lengthChanged))] {
            p.controlSize = .small
            p.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
            p.target = self
            p.action = sel
        }
        let label = { (s: String) -> NSTextField in
            let t = NSTextField(labelWithString: s)
            t.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
            t.textColor = .secondaryLabelColor
            return t
        }
        let lengthTitle = label("Poll length:")
        let length = NSStackView(views: [lengthTitle, days, label("days"), hours, label("hours"), minutes, label("minutes")])
        length.spacing = 4
        let remove = NSButton(title: "Remove Poll", target: self, action: #selector(removePoll))
        remove.controlSize = .small
        remove.bezelStyle = .push
        let foot = NSStackView(views: [addButton, NSView(), remove])

        let stack = NSStackView(views: [choiceStack, length, foot])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        foot.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        choiceStack.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        contentView = stack
        show(.fresh)
    }

    required init?(coder: NSCoder) { nil }

    func show(_ p: ComposePoll) {
        poll = p
        for f in fields { f.removeFromSuperview() }
        fields = poll.choices.enumerated().map { i, c in
            let f = NSTextField(string: c)
            f.placeholderString = "Choice \(i + 1)" + (i > 1 ? " (optional)" : "")
            f.delegate = self
            f.tag = i
            f.translatesAutoresizingMaskIntoConstraints = false
            return f
        }
        for f in fields {
            choiceStack.addArrangedSubview(f)
            f.widthAnchor.constraint(equalTo: choiceStack.widthAnchor).isActive = true
        }
        addButton.isHidden = poll.choices.count >= 4
        fillLength()
    }

    private func fillLength() {
        let fill = { (p: NSPopUpButton, lo: Int, hi: Int, v: Int) in
            p.removeAllItems()
            p.addItems(withTitles: (lo ... max(lo, hi)).map(String.init))
            p.selectItem(withTitle: String(v))
        }
        fill(days, 0, 7, poll.days)
        fill(hours, 0, poll.hoursMax, poll.hours)
        fill(minutes, poll.minutesMin, poll.minutesMax, poll.minutes)
    }

    func focusFirstChoice() {
        window?.makeFirstResponder(fields.first)
    }

    func controlTextDidChange(_ obj: Notification) {
        guard let f = obj.object as? NSTextField, f.tag < poll.choices.count else { return }
        if f.stringValue.utf16.count > ComposePoll.choiceMax { f.stringValue = ComposePoll.clip(f.stringValue) }
        poll.choices[f.tag] = f.stringValue
        onChange?(poll)
    }

    @objc private func addChoice() {
        guard poll.choices.count < 4 else { return }
        poll.choices.append("")
        show(poll)
        window?.makeFirstResponder(fields.last)
        onChange?(poll)
    }

    @objc private func daysChanged() {
        poll.days = Int(days.titleOfSelectedItem ?? "") ?? poll.days
        poll.fit()
        fillLength()
        onChange?(poll)
    }

    @objc private func lengthChanged() {
        poll.hours = Int(hours.titleOfSelectedItem ?? "") ?? poll.hours
        poll.minutes = Int(minutes.titleOfSelectedItem ?? "") ?? poll.minutes
        poll.fit()
        fillLength()
        onChange?(poll)
    }

    @objc private func removePoll() {
        onChange?(nil)
    }
}

// MARK: - A send time

/// A time to the minute, in this Mac's time zone (text.js whenDate).
struct ComposeWhen: Equatable {
    var y: Int, mo: Int, d: Int, h: Int, mi: Int

    init(_ date: Date) {
        let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        y = c.year ?? 2000
        mo = c.month ?? 1
        d = c.day ?? 1
        h = c.hour ?? 0
        mi = c.minute ?? 0
    }

    init?(_ o: Any?) {
        guard let o = o as? [String: Any], let y = o["y"] as? Int, let mo = o["mo"] as? Int, let d = o["d"] as? Int, let h = o["h"] as? Int, let mi = o["mi"] as? Int else { return nil }
        self.y = y
        self.mo = mo
        self.d = d
        self.h = h
        self.mi = mi
        guard date != nil else { return nil }
    }

    var date: Date? {
        Calendar.current.date(from: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi))
    }

    var dict: [String: Any] { ["y": y, "mo": mo, "d": d, "h": h, "mi": mi] }

    /// “Wed, Oct 14 at 9:00 AM”, with the year when it isn't this one.
    var label: String {
        guard let t = date else { return "" }
        let sameYear = Calendar.current.component(.year, from: t) == Calendar.current.component(.year, from: .now)
        let day = t.formatted(sameYear ? .dateTime.weekday(.abbreviated).month(.abbreviated).day() : .dateTime.weekday(.abbreviated).month(.abbreviated).day().year())
        return day + " at " + t.formatted(date: .omitted, time: .shortened)
    }
}

/// The schedule popover: a calendar, a time, what it means, and Set.
final class ComposeSchedulePicker: NSViewController, NSPopoverDelegate {
    var onSet: ((ComposeWhen?) -> Void)?
    private let calendar = NSDatePicker()
    private let time = NSDatePicker()
    private let summary = NSTextField(labelWithString: "")
    private let setButton = NSButton(title: "Set", target: nil, action: nil)
    private let start: Date
    private let had: Bool
    private weak var popover: NSPopover?

    /// A time X Pro takes: at least 2 minutes ahead (sending takes a
    /// moment), at most 18 months ahead.
    static let lead: TimeInterval = 120

    init(start: Date, had: Bool) {
        self.start = start
        self.had = had
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { nil }

    override func loadView() {
        let now = Date.now
        let max = Calendar.current.date(byAdding: .month, value: 18, to: now) ?? now
        calendar.datePickerStyle = .clockAndCalendar
        calendar.datePickerElements = .yearMonthDay
        calendar.isBezeled = false
        calendar.drawsBackground = false
        calendar.minDate = Calendar.current.startOfDay(for: now)
        calendar.maxDate = max
        calendar.dateValue = start
        calendar.target = self
        calendar.action = #selector(changed)
        time.datePickerStyle = .textFieldAndStepper
        time.datePickerElements = .hourMinute
        time.dateValue = start
        time.target = self
        time.action = #selector(changed)

        let title = NSTextField(labelWithString: "Schedule")
        title.font = .boldSystemFont(ofSize: NSFont.systemFontSize)
        let timeLabel = NSTextField(labelWithString: "Time:")
        let timeRow = NSStackView(views: [timeLabel, time])
        summary.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        summary.textColor = .secondaryLabelColor
        summary.lineBreakMode = .byWordWrapping
        summary.maximumNumberOfLines = 2

        setButton.target = self
        setButton.action = #selector(set)
        setButton.keyEquivalent = "\r"
        let clear = NSButton(title: had ? "Clear" : "Cancel", target: self, action: #selector(clearIt))
        let buttons = NSStackView(views: [clear, NSView(), setButton])

        let stack = NSStackView(views: [title, calendar, timeRow, summary, buttons])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        buttons.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -24).isActive = true
        summary.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -24).isActive = true
        view = stack
        changed()
    }

    func show(from item: NSToolbarItem) {
        let p = NSPopover()
        p.behavior = .transient
        p.contentViewController = self
        p.delegate = self
        popover = p
        p.show(relativeTo: item)
    }

    func show(from view: NSView) {
        let p = NSPopover()
        p.behavior = .transient
        p.contentViewController = self
        p.delegate = self
        popover = p
        p.show(relativeTo: view.bounds, of: view, preferredEdge: .maxY)
    }

    /// The calendar's day and the time field's hour and minute.
    private var chosen: Date? {
        let cal = Calendar.current
        var c = cal.dateComponents([.year, .month, .day], from: calendar.dateValue)
        let t = cal.dateComponents([.hour, .minute], from: time.dateValue)
        c.hour = t.hour
        c.minute = t.minute
        return cal.date(from: c)
    }

    @objc private func changed() {
        guard let t = chosen else { return }
        let max = Calendar.current.date(byAdding: .month, value: 18, to: .now) ?? .now
        let zone = TimeZone.current.localizedName(for: TimeZone.current.isDaylightSavingTime(for: t) ? .daylightSaving : .standard, locale: .current) ?? TimeZone.current.identifier
        if t.timeIntervalSinceNow < Self.lead {
            summary.stringValue = "Pick a time at least 2 minutes from now."
            summary.textColor = .systemRed
            setButton.isEnabled = false
        } else if t > max {
            summary.stringValue = "X Pro schedules up to 18 months ahead."
            summary.textColor = .systemRed
            setButton.isEnabled = false
        } else {
            summary.stringValue = "Sends " + ComposeWhen(t).label + ", " + zone + "."
            summary.textColor = .secondaryLabelColor
            setButton.isEnabled = true
        }
    }

    @objc private func set() {
        guard let t = chosen, setButton.isEnabled else { return }
        onSet?(ComposeWhen(t))
        popover?.close()
    }

    @objc private func clearIt() {
        if had { onSet?(nil) }
        popover?.close()
    }
}
