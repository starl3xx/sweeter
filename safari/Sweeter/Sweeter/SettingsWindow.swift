//
//  SettingsWindow.swift
//  Sweeter
//
//  Settings as a Mac settings window: a toolbar of panes, each a grouped
//  form, drawn from the rows the page describes (app.js PREF_ROWS) and its
//  filters, mutes and layouts. The page stays the owner of every setting:
//  each change goes to it (Sweeter.native.prefs, app.js prefsDo), and while
//  the window is open the page pushes every change back (prefsChanged), so
//  the menus, the palette and this window always agree.
//

import Cocoa
import Combine
import SwiftUI
import UniformTypeIdentifiers

// MARK: - The page's snapshot

/// A setting's value as the page stores it.
enum JValue: Decodable, Equatable {
    case string(String), number(Double), bool(Bool), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else { self = .null }
    }

    var any: Any {
        switch self {
        case .string(let s): return s
        case .number(let n): return n
        case .bool(let b): return b
        case .null: return NSNull()
        }
    }
}

/// One row of PREF_ROWS: select, check, range, swatches, sep or head.
struct PrefRow: Decodable {
    let k: String
    let key: String?
    let label: String?
    let opts: [[String]]?
    let text: String?
    let note: String?
    let min: Double?
    let max: Double?
    let step: Double?
    let unit: String?
    let btn: [String]?
}

struct Accent: Decodable {
    let id: String
    let name: String
    let color: String
}

struct RuleItem: Codable {
    let k: String
    let not: Bool
}

struct FilterItem: Decodable, Identifiable {
    let id: String
    let name: String
    let desc: String
    let key: String
    let include: String
    let exclude: String
    let match: String
    let rules: [RuleItem]
}

struct MuteItem: Decodable, Identifiable {
    let id: String
    let label: String
    let expiry: String
}

struct LayoutItem: Decodable, Identifiable {
    let name: String
    let date: String
    var id: String { name }
}

struct PrefsSnapshot: Decodable {
    let version: String
    let values: [String: JValue]
    let rows: [String: [PrefRow]]
    let accents: [Accent]
    let hints: [String: String]
    let filters: [FilterItem]
    let criteria: [[String]]
    let mutes: [MuteItem]
    let durations: [[String]]
    let layouts: [LayoutItem]
    let keys: [[String]]
}

// MARK: - Model

/// What the window shows, kept in step with the page.
final class SettingsModel: ObservableObject {
    @Published var snap: PrefsSnapshot?
    @Published var values: [String: JValue] = [:]
    /// Set when the window opens on Mutes (app.js openPrefsTab('mutes')).
    @Published var focusMute = false
    /// Sends one request to the page: (op, arg, reply). The reply is the
    /// page's JSON text, or nil when X Pro's page is not open.
    var send: (String, Any?, @escaping (Any?) -> Void) -> Void = { _, _, done in done(nil) }

    func apply(json: String) {
        guard let data = json.data(using: .utf8), let s = try? JSONDecoder().decode(PrefsSnapshot.self, from: data) else { return }
        snap = s
        values = s.values
    }

    /// A change, shown at once and sent to the page, which saves it and
    /// pushes the result back.
    func set(_ key: String, _ value: JValue) {
        values[key] = value
        send("set", ["key": key, "value": value.any]) { _ in }
    }

    /// A request whose reply is { ok, msg }.
    func run(_ op: String, _ arg: Any?, done: @escaping (Bool, String) -> Void = { _, _ in }) {
        send(op, arg) { reply in
            guard let text = reply as? String, let data = text.data(using: .utf8),
                  let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return done(false, "") }
            done(o["ok"] as? Bool ?? false, o["msg"] as? String ?? "")
        }
    }

    func bool(_ key: String) -> Binding<Bool> {
        Binding(get: { if case .bool(let b) = self.values[key] { return b } else { return false } },
                set: { self.set(key, .bool($0)) })
    }

    func string(_ key: String) -> Binding<String> {
        Binding(get: { if case .string(let s) = self.values[key] { return s } else { return "" } },
                set: { self.set(key, .string($0)) })
    }

    /// Rounded to `step` here, as the page would, so a dragged thumb never
    /// jumps back to the page's rounding.
    func number(_ key: String, fallback: Double, step: Double = 1) -> Binding<Double> {
        Binding(get: { if case .number(let n) = self.values[key] { return n } else { return fallback } },
                set: { v in
                    let rounded = step > 0 ? (v / step).rounded() * step : v
                    if case .number(let n) = self.values[key], n == rounded { return }
                    self.set(key, .number(rounded))
                })
    }

    var hint: [String: String] { snap?.hints ?? [:] }
}

// MARK: - Window

/// The Settings window (⌘,, the sidebar's gear, and every "Settings ▸ …"
/// link in the page): one per app, reopened where it was.
final class SettingsWindowController: NSWindowController, NSWindowDelegate {
    static let shared = SettingsWindowController()
    /// The window exists (so a page reload may need to reach it).
    private(set) static var made = false
    let model = SettingsModel()
    private let tabs = NSTabViewController()
    private static let panes: [(id: String, title: String, symbol: String)] = [
        ("general", "General", "gearshape"),
        ("media", "Media", "photo"),
        ("filters", "Filters & Mutes", "line.3.horizontal.decrease.circle"),
        ("layouts", "Layouts", "rectangle.3.group"),
        ("keys", "Keyboard", "keyboard"),
        ("extras", "Extras", "sparkles"),
    ]

    private init() {
        tabs.tabStyle = .toolbar
        let window = NSWindow(contentViewController: tabs)
        super.init(window: window)
        for p in Self.panes {
            let host = NSHostingController(rootView: SettingsPane(pane: p.id, model: model))
            host.sizingOptions = [.preferredContentSize]
            let item = NSTabViewItem(viewController: host)
            item.label = p.title
            item.image = NSImage(systemSymbolName: p.symbol, accessibilityDescription: p.title)
            item.identifier = p.id
            tabs.addTabViewItem(item)
        }
        window.styleMask = [.titled, .closable, .miniaturizable]
        window.toolbarStyle = .preference
        window.setFrameAutosaveName("SweeterSettings")
        window.delegate = self
        Self.made = true
        model.send = { op, arg, done in
            guard let vc = ViewController.shared else { return done(nil) }
            vc.prefs(op, arg, done: done)
        }
    }

    required init?(coder: NSCoder) { nil }

    /// Opens on a pane ("" keeps the last one; "mutes" is Filters & Mutes,
    /// with the mute field ready).
    func show(tab: String) {
        let id = tab == "mutes" ? "filters" : tab
        if let i = Self.panes.firstIndex(where: { $0.id == id }) { tabs.selectedTabViewItemIndex = i }
        model.send("watch", true) { _ in }
        model.send("snapshot", nil) { [weak self] reply in
            guard let self else { return }
            if let text = reply as? String { self.model.apply(json: text) }
            if tab == "mutes" { self.model.focusMute = true }
            NSApp.activate(ignoringOtherApps: true)
            self.showWindow(nil)
            self.window?.makeKeyAndOrderFront(nil)
        }
    }

    /// The page (re)mounted: X Pro finished loading after the window
    /// opened, or Reload X Pro started a new page that knows nothing of it.
    /// An open window asks again for the snapshot and the changes.
    func pageMounted() {
        guard window?.isVisible == true else { return }
        model.send("watch", true) { _ in }
        model.send("snapshot", nil) { [weak self] reply in
            if let text = reply as? String { self?.model.apply(json: text) }
        }
    }

    func windowWillClose(_ notification: Notification) {
        model.send("watch", false) { _ in }
    }
}

// MARK: - Panes

struct SettingsPane: View {
    let pane: String
    @ObservedObject var model: SettingsModel

    var body: some View {
        Group {
            if model.snap == nil {
                Text("Settings are here once X Pro is open in Sweeter.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                switch pane {
                case "filters": FiltersPane(model: model)
                case "layouts": LayoutsPane(model: model)
                case "keys": KeysPane(model: model)
                default: RowsPane(model: model, rows: model.snap?.rows[pane] ?? [])
                }
            }
        }
        .frame(width: 600, height: Self.height[pane] ?? 460)
    }

    static let height: [String: CGFloat] = ["general": 660, "media": 440, "filters": 620, "layouts": 420, "keys": 600, "extras": 260]
}

/// General, Media and Extras: PREF_ROWS as grouped sections (a "sep"
/// starts a new one, a "head" a titled one).
struct RowsPane: View {
    @ObservedObject var model: SettingsModel
    let rows: [PrefRow]

    private var sections: [(title: String?, rows: [PrefRow])] {
        var out: [(title: String?, rows: [PrefRow])] = [(nil, [])]
        for r in rows {
            if r.k == "sep" || r.k == "head" {
                out.append((r.k == "head" ? r.label : nil, []))
            } else {
                out[out.count - 1].rows.append(r)
            }
        }
        return out.filter { !$0.rows.isEmpty }
    }

    var body: some View {
        Form {
            ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                Section {
                    ForEach(Array(section.rows.enumerated()), id: \.offset) { _, row in
                        PrefRowView(model: model, row: row)
                    }
                } header: {
                    if let title = section.title { Text(title) }
                }
            }
        }
        .formStyle(.grouped)
    }
}

/// A title, and the row's note under it as macOS draws a subtitle.
@ViewBuilder func titled(_ title: String, _ note: String?) -> some View {
    Text(title)
    if let note, !note.isEmpty { Text(note) }
}

struct PrefRowView: View {
    @ObservedObject var model: SettingsModel
    let row: PrefRow

    var body: some View {
        let key = row.key ?? ""
        switch row.k {
        case "select":
            Picker(selection: model.string(key)) {
                ForEach(row.opts ?? [], id: \.self) { o in Text(o.count > 1 ? o[1] : o[0]).tag(o[0]) }
            } label: {
                titled(row.label ?? "", row.note)
            }
        case "check":
            Toggle(isOn: model.bool(key)) {
                titled(row.text ?? row.label ?? "", row.note)
            }
            .toggleStyle(.switch)
            if let btn = row.btn, btn.count == 2 {
                Button(btn[0]) { model.run("run", btn[1]) }
            }
        case "range":
            let lo = row.min ?? 0, hi = row.max ?? 100, step = row.step ?? 1
            LabeledContent {
                HStack {
                    // Ticks only where they can be told apart (font size's
                    // 11); the page rounds column width to its 5 px anyway.
                    if (hi - lo) / step <= 12 {
                        Slider(value: model.number(key, fallback: lo, step: step), in: lo...hi, step: step)
                    } else {
                        Slider(value: model.number(key, fallback: lo, step: step), in: lo...hi)
                    }
                    Text("\(Int(model.number(key, fallback: lo).wrappedValue)) \(row.unit ?? "")")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .frame(width: 56, alignment: .trailing)
                }
                .frame(width: 260)
            } label: {
                Text(row.label ?? "")
            }
        case "swatches":
            LabeledContent {
                Swatches(model: model, key: key)
            } label: {
                titled(row.label ?? "", row.note)
            }
        default:
            EmptyView()
        }
    }
}

/// Accent colors as round swatches, like System Settings ▸ Appearance.
struct Swatches: View {
    @ObservedObject var model: SettingsModel
    let key: String

    var body: some View {
        let current = model.string(key).wrappedValue
        HStack(spacing: 7) {
            ForEach(model.snap?.accents ?? [], id: \.id) { a in
                let on = a.id == current || (current.isEmpty && a.id == "blue")
                Button {
                    model.set(key, .string(a.id))
                } label: {
                    Circle()
                        .fill(a.id == "system" ? AnyShapeStyle(AngularGradient(colors: [.red, .orange, .yellow, .green, .blue, .purple, .pink, .red], center: .center)) : AnyShapeStyle(Color(hex: a.color)))
                        .frame(width: 16, height: 16)
                        .overlay(Circle().strokeBorder(Color.primary.opacity(0.18)))
                        .overlay(Circle().fill(.white).frame(width: 6, height: 6).opacity(on ? 1 : 0))
                }
                .buttonStyle(.plain)
                .help(a.name)
                .accessibilityLabel(a.name)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

extension Color {
    /// "#RRGGBB" (anything else is gray).
    init(hex: String) {
        let v = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0x888888
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

// MARK: Filters & Mutes

/// A filter being written or edited (FilterEditor).
struct FilterDraft: Identifiable {
    let id = UUID()
    var filterID = ""
    var name = ""
    var include = ""
    var exclude = ""
    var match = "all"
    var rules: [String: String] = [:] // criterion -> "yes" | "no"

    init() {}

    init(_ f: FilterItem) {
        filterID = f.id
        name = f.name
        include = f.include
        exclude = f.exclude
        match = f.match
        for r in f.rules { rules[r.k] = r.not ? "no" : "yes" }
    }

    var request: [String: Any] {
        ["id": filterID, "name": name, "include": include, "exclude": exclude, "match": match,
         "rules": rules.compactMap { k, v in v.isEmpty ? nil : ["k": k, "not": v == "no"] as [String: Any] }]
    }
}

struct FiltersPane: View {
    @ObservedObject var model: SettingsModel
    @State private var draft: FilterDraft?
    @State private var muteText = ""
    @State private var muteFor = "forever"
    @State private var muteNote = ""
    @FocusState private var muteFocused: Bool

    var body: some View {
        let filters = model.snap?.filters ?? []
        let mutes = model.snap?.mutes ?? []
        Form {
            Section {
                ForEach(filters) { f in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(f.name)
                            Text(f.desc).font(.callout).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if !f.key.isEmpty { Text(f.key).foregroundStyle(.secondary).monospacedDigit() }
                        Button("Edit…") { draft = FilterDraft(f) }
                        Button { model.run("filter-delete", f.id) } label: { Image(systemName: "minus.circle") }
                            .buttonStyle(.borderless)
                            .help("Delete “\(f.name)”")
                            .accessibilityLabel("Delete \(f.name)")
                    }
                }
                if filters.isEmpty { Text("No custom filters yet.").foregroundStyle(.secondary) }
                Button("New Filter…") { draft = FilterDraft() }
            } header: {
                Text("Filters")
            } footer: {
                Text(model.hint["filters"] ?? "").font(.footnote).foregroundStyle(.secondary)
            }

            Section {
                Toggle(isOn: model.bool("muteNotes")) {
                    titled("Mutes hide notifications too", model.hint["muteNotes"])
                }
                .toggleStyle(.switch)
                HStack {
                    TextField("Mute", text: $muteText, prompt: Text("airdrop, /^gm\\b/i, @someone"))
                        .labelsHidden()
                        .textFieldStyle(.roundedBorder)
                        .focused($muteFocused)
                        .onSubmit(addMute)
                    Picker("For", selection: $muteFor) {
                        ForEach(model.snap?.durations ?? [], id: \.self) { d in Text(d.count > 1 ? d[1] : d[0]).tag(d[0]) }
                    }
                    .labelsHidden()
                    .fixedSize()
                    Button("Mute", action: addMute)
                        .disabled(muteText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                if !muteNote.isEmpty { Text(muteNote).font(.callout).foregroundStyle(.secondary) }
                ForEach(mutes) { m in
                    HStack {
                        Text(m.label).font(.body.monospaced()).lineLimit(1).truncationMode(.tail)
                        Spacer()
                        Text(m.expiry).foregroundStyle(.secondary)
                        Button { model.run("mute-delete", m.id) } label: { Image(systemName: "minus.circle") }
                            .buttonStyle(.borderless)
                            .help("Remove")
                            .accessibilityLabel("Remove \(m.label)")
                    }
                }
                if mutes.isEmpty { Text("No mute filters yet.").foregroundStyle(.secondary) }
            } header: {
                Text("Mutes")
            } footer: {
                Text(model.hint["mutes"] ?? "").font(.footnote).foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .sheet(item: $draft) { d in
            FilterEditor(model: model, draft: d) { draft = nil }
        }
        .onChange(of: model.focusMute) { _, on in
            if on {
                muteFocused = true
                model.focusMute = false
            }
        }
        .onAppear {
            if model.focusMute {
                muteFocused = true
                model.focusMute = false
            }
        }
    }

    private func addMute() {
        let text = muteText
        model.run("mute-add", ["text": text, "dur": muteFor]) { ok, msg in
            muteNote = msg
            if ok { muteText = "" }
        }
    }
}

struct FilterEditor: View {
    @ObservedObject var model: SettingsModel
    @State var draft: FilterDraft
    let close: () -> Void
    @State private var problem = ""

    var body: some View {
        VStack(spacing: 0) {
            Form {
                Section {
                    TextField("Name", text: $draft.name, prompt: Text("Links from mutuals"))
                    TextField(text: $draft.include, prompt: Text("macstories.net OR sixcolors.com")) {
                        titled("Only posts with", "Words, names or link domains. Separate choices with OR or commas. Empty means any post.")
                    }
                    TextField("Hide posts with", text: $draft.exclude, prompt: Text("tiktok"))
                }
                Section("Rules") {
                    ForEach(model.snap?.criteria ?? [], id: \.self) { c in
                        Picker(c.count > 1 ? c[1] : c[0], selection: Binding(get: { draft.rules[c[0]] ?? "" }, set: { draft.rules[c[0]] = $0 })) {
                            Text("Doesn’t matter").tag("")
                            Text("Yes").tag("yes")
                            Text("No").tag("no")
                        }
                    }
                    Picker("Match", selection: $draft.match) {
                        Text("All rules").tag("all")
                        Text("Any rule").tag("any")
                    }
                }
            }
            .formStyle(.grouped)
            HStack {
                if !problem.isEmpty { Text(problem).foregroundStyle(.secondary) }
                Spacer()
                Button("Cancel", role: .cancel, action: close).keyboardShortcut(.cancelAction)
                Button("Save") {
                    model.run("filter-save", draft.request) { ok, msg in
                        if ok { close() } else { problem = msg }
                    }
                }
                .keyboardShortcut(.defaultAction)
            }
            .padding()
        }
        .frame(width: 460, height: 600)
    }
}

// MARK: Layouts

struct LayoutsPane: View {
    @ObservedObject var model: SettingsModel
    @State private var asking = false
    @State private var name = ""
    @State private var note = ""

    var body: some View {
        let layouts = model.snap?.layouts ?? []
        Form {
            Section {
                ForEach(layouts) { l in
                    HStack {
                        Text(l.name)
                        Spacer()
                        Text(l.date).foregroundStyle(.secondary)
                        Button("Restore") { model.run("layout-restore", l.name) }
                        Button { model.run("layout-delete", l.name) } label: { Image(systemName: "minus.circle") }
                            .buttonStyle(.borderless)
                            .help("Delete “\(l.name)”")
                            .accessibilityLabel("Delete \(l.name)")
                    }
                }
                if layouts.isEmpty { Text("No saved layouts yet.").foregroundStyle(.secondary) }
            } footer: {
                Text(model.hint["layouts"] ?? "").font(.footnote).foregroundStyle(.secondary)
            }
            Section {
                HStack {
                    Button("Save Current Layout…") {
                        name = ""
                        asking = true
                    }
                    Button("Export…", action: export)
                    Button("Import…", action: importFile)
                }
                if !note.isEmpty { Text(note).font(.callout).foregroundStyle(.secondary) }
            }
        }
        .formStyle(.grouped)
        .alert("Name this layout", isPresented: $asking) {
            TextField("Name", text: $name)
            Button("Save") { model.run("layout-save", name) { _, msg in note = msg } }
            Button("Cancel", role: .cancel) {}
        }
    }

    /// The page writes the file's text; a save panel on this window puts it
    /// where the reader chooses.
    private func export() {
        model.send("layout-export", nil) { reply in
            guard let text = reply as? String, let data = text.data(using: .utf8),
                  let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let body = o["text"] as? String else { return }
            let panel = NSSavePanel()
            panel.nameFieldStringValue = o["name"] as? String ?? "Sweeter layout.json"
            panel.allowedContentTypes = [.json]
            let save = { (r: NSApplication.ModalResponse) in
                guard r == .OK, let url = panel.url else { return }
                do { try body.write(to: url, atomically: true, encoding: .utf8) } catch { note = error.localizedDescription }
            }
            if let w = SettingsWindowController.shared.window { panel.beginSheetModal(for: w, completionHandler: save) } else { save(panel.runModal()) }
        }
    }

    private func importFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        let open = { (r: NSApplication.ModalResponse) in
            guard r == .OK, let url = panel.url, let text = try? String(contentsOf: url, encoding: .utf8) else { return }
            model.run("layout-import", text) { _, msg in note = msg }
        }
        if let w = SettingsWindowController.shared.window { panel.beginSheetModal(for: w, completionHandler: open) } else { open(panel.runModal()) }
    }
}

// MARK: Keyboard

struct KeysPane: View {
    @ObservedObject var model: SettingsModel

    var body: some View {
        Form {
            Section {
                ForEach(Array((model.snap?.keys ?? []).enumerated()), id: \.offset) { _, k in
                    LabeledContent {
                        KeyCaps(text: k.first ?? "")
                    } label: {
                        Text(k.count > 1 ? k[1] : "")
                    }
                }
            }
        }
        .formStyle(.grouped)
    }
}

/// "⌘ ↑  ⌘ ↓" as key caps: two spaces between shortcuts, one between keys;
/// "to" and "then" stay words.
struct KeyCaps: View {
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            ForEach(Array(text.components(separatedBy: "  ").enumerated()), id: \.offset) { _, group in
                HStack(spacing: 3) {
                    ForEach(Array(group.split(separator: " ").map(String.init).enumerated()), id: \.offset) { _, key in
                        if key == "to" || key == "then" {
                            Text(key).foregroundStyle(.secondary)
                        } else {
                            Text(key)
                                .font(.system(.callout, design: .rounded).weight(.medium))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(RoundedRectangle(cornerRadius: 4).fill(Color.secondary.opacity(0.12)))
                                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color.secondary.opacity(0.3)))
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}
