//
//  AboutWindow.swift
//  Sweeter
//
//  Sweeter ▸ About Sweeter: the icon (the hero animation, settling into it)
//  on a soft glow of its own colors, the name and version, Check for
//  Updates and the release notes, and the maker's line.
//

import AVFoundation
import Cocoa
import SwiftUI

final class AboutWindowController: NSWindowController {
    static let shared = AboutWindowController()
    private let hero: HeroIcon

    private init() {
        let hero = HeroIcon(frame: NSRect(x: 0, y: 0, width: 112, height: 112))
        self.hero = hero
        let info = Bundle.main.infoDictionary ?? [:]
        let view = AboutView(version: info["CFBundleShortVersionString"] as? String ?? "", build: info["CFBundleVersion"] as? String ?? "", hero: hero)
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
        NotificationCenter.default.addObserver(forName: NSWindow.willCloseNotification, object: window, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.hero.showIcon() }
        }
    }

    required init?(coder: NSCoder) { nil }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        if window?.isVisible != true { window?.center() }
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        // Every time the window shows, from the first frame.
        hero.play()
    }
}

/// The About window's icon: the hero animation (Resources/sweeter-hero.mov,
/// made by `scripts/bird.sh hero`): the loading screen's bird flaps on
/// nothing, then from 2.6 s the icon's squircle opens behind it, and its last
/// frame is the icon itself, pixel for pixel, which then stays. HEVC with
/// alpha, played transparent in an AVPlayerLayer. A click plays it again.
/// Under Reduce Motion, without the file, or if it fails: the icon alone.
///
/// The pink drop shadow is the squircle's own (a shadow path with no fill),
/// so it never sits under a bird with no tile: off while the bird flaps,
/// fading in from 2.65 s over 0.5 s with the squircle (as on
/// starl3xx.fun/sweeter), timed by the video itself.
final class HeroIcon: NSView {
    private let shadowLayer = CALayer()
    private let iconLayer = CALayer()
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var boundary: Any?
    private var observers: [NSObjectProtocol] = []
    private var status: NSKeyValueObservation?
    private var shadowOn = true
    /// The icon's pink (design/sweeter-icon-art.png) at the window's shadow strength.
    var shadowOpacity: Float = 0.22 {
        didSet { if shadowOn { shadowLayer.shadowOpacity = shadowOpacity } }
    }

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.backgroundColor = .clear
        layer?.isOpaque = false
        clipsToBounds = false
        shadowLayer.frame = bounds
        shadowLayer.shadowPath = Self.squircle(in: bounds.width)
        shadowLayer.shadowColor = CGColor(red: 0xEE / 255, green: 0x5A / 255, blue: 0x8E / 255, alpha: 1)
        shadowLayer.shadowRadius = 16
        shadowLayer.shadowOffset = CGSize(width: 0, height: -8)
        shadowLayer.shadowOpacity = shadowOpacity
        layer?.addSublayer(shadowLayer)
        iconLayer.frame = bounds
        iconLayer.contents = NSApp.applicationIconImage
        iconLayer.contentsGravity = .resizeAspect
        layer?.addSublayer(iconLayer)
    }

    required init?(coder: NSCoder) { nil }

    override var intrinsicContentSize: NSSize { NSSize(width: 112, height: 112) }
    override var mouseDownCanMoveWindow: Bool { false }
    override func mouseDown(with event: NSEvent) { play() }

    /// The icon's squircle (design/sweeter-icon.swift: a superellipse, n = 5,
    /// 824 px across on the 1024 px canvas, centered) at this size.
    static func squircle(in size: CGFloat) -> CGPath {
        let path = CGMutablePath()
        let r = size * 412 / 1024
        let c = size / 2
        for i in 0..<720 {
            let a = 2 * CGFloat.pi * CGFloat(i) / 720
            let x = c + r * copysign(pow(abs(cos(a)), 2 / 5), cos(a))
            let y = c + r * copysign(pow(abs(sin(a)), 2 / 5), sin(a))
            if i == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
        }
        path.closeSubpath()
        return path
    }

    /// From the first frame, each time the window shows and on a click.
    func play() {
        guard !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,
              let url = Bundle.main.url(forResource: "sweeter-hero", withExtension: "mov") else {
            showIcon()
            return
        }
        stop()
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.actionAtItemEnd = .pause
        let pl = AVPlayerLayer(player: player)
        pl.frame = bounds
        pl.videoGravity = .resizeAspect
        pl.backgroundColor = .clear
        pl.isOpaque = false
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        layer?.addSublayer(pl)
        iconLayer.isHidden = true
        setShadow(false, animated: false)
        CATransaction.commit()
        boundary = player.addBoundaryTimeObserver(forTimes: [NSValue(time: CMTime(seconds: 2.65, preferredTimescale: 600))], queue: .main) { [weak self] in
            MainActor.assumeIsolated { self?.setShadow(true, animated: true) }
        }
        for name in [AVPlayerItem.didPlayToEndTimeNotification, AVPlayerItem.failedToPlayToEndTimeNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: item, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.showIcon() }
            })
        }
        status = item.observe(\.status) { [weak self] item, _ in
            guard item.status == .failed else { return }
            DispatchQueue.main.async { MainActor.assumeIsolated { self?.showIcon() } }
        }
        self.player = player
        playerLayer = pl
        player.play()
    }

    /// The icon alone, with its shadow: the video's end, its fallback, and
    /// what the window keeps once closed.
    func showIcon() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        iconLayer.isHidden = false
        stop()
        setShadow(true, animated: false)
        CATransaction.commit()
    }

    private func stop() {
        if let b = boundary { player?.removeTimeObserver(b) }
        boundary = nil
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers = []
        status = nil
        player?.pause()
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        player = nil
    }

    private func setShadow(_ on: Bool, animated: Bool) {
        shadowOn = on
        CATransaction.begin()
        CATransaction.setDisableActions(!animated)
        CATransaction.setAnimationDuration(animated ? 0.5 : 0)
        shadowLayer.shadowOpacity = on ? shadowOpacity : 0
        CATransaction.commit()
    }
}

/// The hero in SwiftUI; the controller owns it, to play it on each show.
struct HeroIconView: NSViewRepresentable {
    let hero: HeroIcon
    let shadowOpacity: Float
    func makeNSView(context: Context) -> HeroIcon { hero }
    func updateNSView(_ view: HeroIcon, context: Context) { view.shadowOpacity = shadowOpacity }
}

struct AboutView: View {
    let version: String
    let build: String
    let hero: HeroIcon
    @Environment(\.colorScheme) private var scheme

    // The icon's sky and the bird's pink (design/sweeter-icon-art.png).
    private let sky = Color(red: 0x7E / 255, green: 0xC0 / 255, blue: 0xFA / 255)
    private let pink = Color(red: 0xEE / 255, green: 0x5A / 255, blue: 0x8E / 255)
    // The same pink as text: darker on light (4.8:1), lighter on dark (7.8:1).
    private let pinkOnLight = Color(red: 0xB8 / 255, green: 0x33 / 255, blue: 0x6A / 255)
    private let pinkOnDark = Color(red: 0xFF / 255, green: 0x8F / 255, blue: 0xB5 / 255)

    var body: some View {
        VStack(spacing: 0) {
            HeroIconView(hero: hero, shadowOpacity: scheme == .dark ? 0.35 : 0.22)
                .frame(width: 112, height: 112)
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
