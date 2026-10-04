//
//  Intents.swift
//  Sweeter
//
//  Sweeter's actions for Shortcuts, Spotlight and Siri: New Post, Next
//  Unread, Open Column and Show Sweeter. Each runs in the app and drives
//  the page as the menus do (ViewController.command), once Sweeter is drawn.
//

import AppIntents
import Cocoa

/// The page is ready for commands (it can take a few seconds after launch).
@MainActor private func sweeterReady() async -> ViewController? {
    for _ in 0..<80 {
        if let vc = ViewController.shared, vc.mounted { return vc }
        try? await Task.sleep(nanoseconds: 250_000_000)
    }
    return nil
}

/// Why an intent could not run.
enum SweeterIntentError: Error, CustomLocalizedStringResourceConvertible {
    case notReady, noColumn

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .notReady: return "Sweeter is still opening X Pro. Try again in a moment."
        case .noColumn: return "That column isn’t in the deck on screen."
        }
    }
}

/// A column of the deck on screen, by its title (as the Go menu lists it).
struct ColumnEntity: AppEntity {
    let id: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Column"
    static let defaultQuery = ColumnQuery()

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(id)") }
}

struct ColumnQuery: EnumerableEntityQuery {
    @MainActor static func titles() -> [String] {
        ViewController.shared?.pageState["columns"] as? [String] ?? []
    }

    @MainActor func allEntities() async throws -> [ColumnEntity] {
        Self.titles().map { ColumnEntity(id: $0) }
    }

    @MainActor func entities(for identifiers: [String]) async throws -> [ColumnEntity] {
        Self.titles().filter(identifiers.contains).map { ColumnEntity(id: $0) }
    }
}

struct NewPostIntent: AppIntent {
    static let title: LocalizedStringResource = "New Post"
    static let description = IntentDescription("Opens Sweeter’s composer for a new post.", searchKeywords: ["write", "compose", "tweet"])
    static let openAppWhenRun = true

    @MainActor func perform() async throws -> some IntentResult {
        guard let vc = await sweeterReady() else { throw SweeterIntentError.notReady }
        vc.showWindow()
        vc.compose()
        return .result()
    }
}

struct NextUnreadIntent: AppIntent {
    static let title: LocalizedStringResource = "Next Unread"
    static let description = IntentDescription("Goes to the next column with unread posts.", searchKeywords: ["unread", "new posts"])
    static let openAppWhenRun = true

    @MainActor func perform() async throws -> some IntentResult {
        guard let vc = await sweeterReady() else { throw SweeterIntentError.notReady }
        vc.showWindow()
        vc.command("nextUnread")
        return .result()
    }
}

struct OpenColumnIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Column"
    static let description = IntentDescription("Shows one of the columns of the deck on screen.")
    static let openAppWhenRun = true

    @Parameter(title: "Column") var column: ColumnEntity

    static var parameterSummary: some ParameterSummary { Summary("Open \(\.$column)") }

    @MainActor func perform() async throws -> some IntentResult {
        guard let vc = await sweeterReady() else { throw SweeterIntentError.notReady }
        guard let i = ColumnQuery.titles().firstIndex(of: column.id) else { throw SweeterIntentError.noColumn }
        vc.showWindow()
        vc.command("column:\(i + 1)")
        return .result()
    }
}

struct ShowSweeterIntent: AppIntent {
    static let title: LocalizedStringResource = "Show Sweeter"
    static let description = IntentDescription("Brings Sweeter’s window to the front.")
    static let openAppWhenRun = true

    @MainActor func perform() async throws -> some IntentResult {
        ViewController.shared?.showWindow()
        return .result()
    }
}

struct SweeterShortcuts: AppShortcutsProvider {
    static let shortcutTileColor: ShortcutTileColor = .blue

    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: NewPostIntent(), phrases: [
            "New post in \(.applicationName)",
            "Write a post in \(.applicationName)",
        ], shortTitle: "New Post", systemImageName: "square.and.pencil")
        AppShortcut(intent: NextUnreadIntent(), phrases: [
            "Next unread in \(.applicationName)",
            "Show unread posts in \(.applicationName)",
        ], shortTitle: "Next Unread", systemImageName: "arrow.down.circle")
        AppShortcut(intent: OpenColumnIntent(), phrases: [
            "Open a column in \(.applicationName)",
            "Open \(\.$column) in \(.applicationName)",
        ], shortTitle: "Open Column", systemImageName: "rectangle.split.3x1")
        AppShortcut(intent: ShowSweeterIntent(), phrases: [
            "Show \(.applicationName)",
        ], shortTitle: "Show Sweeter", systemImageName: "bird")
    }
}
