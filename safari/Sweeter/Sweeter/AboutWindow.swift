//
//  AboutWindow.swift
//  Sweeter
//
//  Sweeter ▸ About Sweeter: the icon on a soft glow of its own colors, the
//  name and version, Check for Updates and the release notes, and the
//  maker's line.
//

import Cocoa
import SwiftUI

final class AboutWindowController: NSWindowController {
    static let shared = AboutWindowController()

    private init() {
        let info = Bundle.main.infoDictionary ?? [:]
        let view = AboutView(version: info["CFBundleShortVersionString"] as? String ?? "", build: info["CFBundleVersion"] as? String ?? "")
        let host = NSHostingController(rootView: view)
        let window = NSWindow(contentViewController: host)
        window.styleMask = [.titled, .closable, .fullSizeContentView]
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.title = "About Sweeter"
        // One window, reused: closing hides it.
        window.isReleasedWhenClosed = false
        // A fixed panel: Close only.
        window.standardWindowButton(.miniaturizeButton)?.isHidden = true
        window.standardWindowButton(.zoomButton)?.isHidden = true
        super.init(window: window)
    }

    required init?(coder: NSCoder) { nil }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        if window?.isVisible != true { window?.center() }
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
    }
}

struct AboutView: View {
    let version: String
    let build: String
    @Environment(\.colorScheme) private var scheme

    // The icon's sky and the bird's pink (design/sweeter-icon-art.png).
    private let sky = Color(red: 0x7E / 255, green: 0xC0 / 255, blue: 0xFA / 255)
    private let pink = Color(red: 0xEE / 255, green: 0x5A / 255, blue: 0x8E / 255)
    // The same pink as text: darker on light (4.8:1), lighter on dark (7.8:1).
    private let pinkOnLight = Color(red: 0xB8 / 255, green: 0x33 / 255, blue: 0x6A / 255)
    private let pinkOnDark = Color(red: 0xFF / 255, green: 0x8F / 255, blue: 0xB5 / 255)

    var body: some View {
        VStack(spacing: 0) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .interpolation(.high)
                .frame(width: 112, height: 112)
                .shadow(color: pink.opacity(scheme == .dark ? 0.35 : 0.22), radius: 16, y: 8)
                .accessibilityHidden(true)
            Text("Sweeter")
                .font(.system(size: 26, weight: .semibold, design: .rounded))
                .padding(.top, 12)
            Text("Version \(version) (\(build))")
                .font(.callout)
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
                .padding(.top, 2)
            Text("A fast, keyboard-friendly, Tweetbot-inspired face for X Pro on the Mac.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                // Wraps: the window sizes to the view's ideal size, which
                // is one line, cut short, without this.
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            HStack(spacing: 8) {
                Button("Check for Updates…") {
                    ViewController.shared?.showWindow()
                    ViewController.shared?.command("checkUpdates")
                }
                Button("Release Notes") {
                    NSWorkspace.shared.open(URL(string: "https://github.com/starl3xx/sweeter/releases")!)
                }
            }
            .controlSize(.regular)
            .padding(.top, 20)
            HStack(spacing: 4) {
                Text("Made with 🌠 by")
                // The profile in Sweeter, with its Follow button (as the
                // welcome's Follow does).
                Button("@starl3xx") {
                    AboutWindowController.shared.close()
                    ViewController.shared?.showWindow()
                    ViewController.shared?.command("developer")
                }
                .buttonStyle(.plain)
                .fontWeight(.semibold)
                .foregroundStyle(scheme == .dark ? pinkOnDark : pinkOnLight)
                .onHover { inside in (inside ? NSCursor.pointingHand : NSCursor.arrow).set() }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(.top, 26)
        }
        .padding(.horizontal, 32)
        .padding(.top, 40)
        .padding(.bottom, 22)
        .frame(width: 340)
        .background(alignment: .top) {
            // A soft glow of the icon's colors behind it, fading into the
            // window's own background.
            ZStack {
                RadialGradient(colors: [sky.opacity(scheme == .dark ? 0.22 : 0.30), .clear], center: UnitPoint(x: 0.35, y: 0.12), startRadius: 0, endRadius: 210)
                RadialGradient(colors: [pink.opacity(scheme == .dark ? 0.18 : 0.20), .clear], center: UnitPoint(x: 0.68, y: 0.18), startRadius: 0, endRadius: 190)
            }
            .ignoresSafeArea()
        }
    }
}
