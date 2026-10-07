//
//  Purchase.swift
//  Sweeter
//
//  Buying Sweeter inside the app: Stripe Checkout in a window of its own,
//  then the license key, which only this Mac can fetch. Nothing here runs
//  while Sweeter is free (Licensing.enforced is false): its menu items
//  aren't shown.
//
//  No accounts. The Mac makes a secret (the nonce) and gives the server
//  only its SHA-256 (the claim), which rides through Checkout as the
//  session's client_reference_id. When Stripe reports the payment, the
//  server signs a key and files it under the claim; the Mac asks for it
//  with the nonce, which nobody else has (license/worker.js).
//

import AppKit
import CryptoKit
import WebKit

@MainActor
final class Purchase: NSObject, NSWindowDelegate {
    static let shared = Purchase()

    private var window: NSWindow?
    private var polling: Task<Void, Never>?
    /// Asking the store for a checkout: a second Unlock waits, so two
    /// sessions (two charges) can't open for one purchase.
    private var starting = false
    /// No cookies, no cache: the store sees a new visitor each time.
    private let session = URLSession(configuration: .ephemeral)

    // MARK: - Buy

    func start() {
        if let w = window { return w.makeKeyAndOrderFront(nil) }
        guard !starting else { return }
        starting = true
        // A checkout from an earlier launch may still be paid for: keep its
        // nonce, so its key can still be claimed.
        let nonce = Licensing.Keychain.get(Licensing.Keychain.pending) ?? Self.newNonce()
        Licensing.Keychain.set(Licensing.Keychain.pending, nonce)
        Task {
            defer { starting = false }
            do {
                let url = try await checkoutURL(claim: Self.claim(nonce))
                show(url)
                poll(nonce, until: Date().addingTimeInterval(30 * 60))
            } catch {
                Log.write("checkout failed: \(error.localizedDescription)")
                alert("Sweeter couldn’t reach its store", "Check your connection and try again.")
            }
        }
    }

    /// At launch: a checkout paid for after Sweeter quit gets its key.
    func resume() {
        guard Licensing.enforced, let nonce = Licensing.Keychain.get(Licensing.Keychain.pending) else { return }
        poll(nonce, until: Date().addingTimeInterval(5))
    }

    private func checkoutURL(claim: String) async throws -> URL {
        var req = URLRequest(url: Licensing.server.appendingPathComponent("checkout"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["claim": claim])
        let (data, response) = try await session.data(for: req)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let o = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let s = o["url"] as? String, let url = URL(string: s), url.host?.hasSuffix("stripe.com") == true
        else { throw URLError(.badServerResponse) }
        return url
    }

    private func show(_ url: URL) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 520, height: 760), configuration: config)
        let w = NSWindow(contentRect: web.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        w.title = "Unlock Sweeter"
        w.contentView = web
        w.isReleasedWhenClosed = false
        w.delegate = self
        w.center()
        w.makeKeyAndOrderFront(nil)
        web.load(URLRequest(url: url))
        window = w
    }

    func windowWillClose(_ notification: Notification) {
        guard (notification.object as? NSWindow) === window else { return }
        window = nil
        // Paid just before closing: keep asking a little longer.
        if let nonce = Licensing.Keychain.get(Licensing.Keychain.pending) {
            poll(nonce, until: Date().addingTimeInterval(60))
        }
    }

    private func poll(_ nonce: String, until: Date) {
        polling?.cancel()
        polling = Task { [weak self] in
            while !Task.isCancelled, Date() < until {
                if let key = await self?.claim(nonce) {
                    self?.received(key)
                    return
                }
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }

    private func claim(_ nonce: String) async -> String? {
        var c = URLComponents(url: Licensing.server.appendingPathComponent("claim"), resolvingAgainstBaseURL: false)
        c?.queryItems = [URLQueryItem(name: "nonce", value: nonce)]
        guard let url = c?.url, let (data, response) = try? await session.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return o["key"] as? String
    }

    private func received(_ key: String) {
        guard Licensing.activate(key) != nil else {
            Log.write("claimed key did not verify")
            return
        }
        Licensing.Keychain.remove(Licensing.Keychain.pending)
        window?.close()
        showKey(key, title: "Thank you! Sweeter is unlocked.",
                text: "This is your license key. It’s saved on this Mac; keep a copy to unlock Sweeter on your other Macs.")
    }

    // MARK: - A key from elsewhere

    func enterKey() {
        let a = NSAlert()
        a.messageText = "Enter License Key"
        a.informativeText = "Paste the key you got when you bought Sweeter."
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        field.placeholderString = "SWEETER-…"
        a.accessoryView = field
        a.addButton(withTitle: "Unlock")
        a.addButton(withTitle: "Cancel")
        a.window.initialFirstResponder = field
        guard a.runModal() == .alertFirstButtonReturn else { return }
        if Licensing.activate(field.stringValue) == nil {
            alert("That key doesn’t unlock this version of Sweeter", "Check that it was pasted whole, from SWEETER- to the end.")
        }
    }

    // MARK: - Helpers

    private func showKey(_ key: String, title: String, text: String) {
        let a = NSAlert()
        a.messageText = title
        a.informativeText = text
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        field.stringValue = key
        field.isEditable = false
        field.isSelectable = true
        a.accessoryView = field
        a.addButton(withTitle: "Copy Key")
        a.addButton(withTitle: "Done")
        if a.runModal() == .alertFirstButtonReturn {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(key, forType: .string)
        }
    }

    private func alert(_ title: String, _ text: String) {
        let a = NSAlert()
        a.messageText = title
        a.informativeText = text
        a.runModal()
    }

    static func newNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// What the server files the key under: SHA-256 of the nonce, in hex.
    static func claim(_ nonce: String) -> String {
        SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
