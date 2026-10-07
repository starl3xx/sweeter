//
//  Licensing.swift
//  Sweeter
//
//  The plumbing for a paid Sweeter: a 7-day trial from the first launch,
//  then the Sweeter view only with a license (X Pro itself always works).
//  Sweeter is free today: `Licensing.enforced` is false, and while it is,
//  nothing here reads or writes anything, and every launch is unlocked.
//
//  No accounts. A license is a key signed by Sweeter's license server
//  (Ed25519); the Mac checks it offline with the public key below, and the
//  key names no person: a random id, the edition, and the day it was made.
//  The trial's clock lives in the Keychain, which outlasts a reinstall.
//

import CryptoKit
import Foundation
import Security

enum Licensing {
    /// The switch for the paid version. While false, Sweeter is free and
    /// unchanged: no trial, no Keychain, no license server.
    static let enforced = false

    static let trialDays = 7

    /// The edition a license must cover: licenses for v1 unlock 1.x (and the
    /// 0.x builds before it).
    static var edition: Int {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        return max(1, Int(v.split(separator: ".").first ?? "") ?? 1)
    }

    /// Sweeter's license server (a Cloudflare Worker, license/worker.js).
    static let server = URL(string: "https://starl3xx.fun/sweeter/license")!

    /// Verifies license keys. Its private half signs them on the server and
    /// is kept out of this repository.
    static let publicKey = "7zHyoEEdU9TN7O9iN0e6S7HcENd3M0noeqIcL1WhcMY="

    /// The Apple team that signs Sweeter's own builds.
    static let teamID = "7M7J9Z6UDW"

    // MARK: - Licenses

    struct License: Equatable {
        let id: String
        let edition: Int
        let issued: Date
    }

    /// "SWEETER-" + base64url(payload JSON) + "." + base64url(signature),
    /// the signature over the payload's bytes. The payload:
    /// {"v":1,"id":"…","p":"sweeter","e":1,"t":<unix seconds>}.
    static func verify(_ key: String, publicKey: String = publicKey) -> License? {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("SWEETER-") else { return nil }
        let parts = trimmed.dropFirst("SWEETER-".count).split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 2,
              let payload = base64url(String(parts[0])),
              let signature = base64url(String(parts[1])),
              let raw = Data(base64Encoded: publicKey),
              let pk = try? Curve25519.Signing.PublicKey(rawRepresentation: raw),
              pk.isValidSignature(signature, for: payload),
              let o = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
              o["v"] as? Int == 1, o["p"] as? String == "sweeter",
              let id = o["id"] as? String, !id.isEmpty,
              let e = o["e"] as? Int,
              let t = o["t"] as? Double
        else { return nil }
        return License(id: id, edition: e, issued: Date(timeIntervalSince1970: t))
    }

    static func base64url(_ s: String) -> Data? {
        var b = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b.count % 4 != 0 { b += "=" }
        return Data(base64Encoded: b)
    }

    // MARK: - What this Mac may show

    enum Entitlement: Equatable {
        /// Sweeter is free (not enforced).
        case free
        case trial(ends: Date)
        case licensed(License)
        case expired

        var unlocked: Bool {
            if case .expired = self { return false }
            return true
        }
    }

    static func entitlement(now: Date = Date()) -> Entitlement {
        guard enforced else { return .free }
        // A build Sweeter's team didn't sign (a fork, or a copy changed
        // after signing) gets no trial and takes no license.
        guard officialBuild() else { return .expired }
        if let key = Keychain.get(Keychain.license), let l = verify(key), l.edition >= edition {
            return .licensed(l)
        }
        return trial(now: now)
    }

    /// The trial: 7 days from the first launch of a paid build on this Mac
    /// (for this user). The clock also keeps the latest time it saw, so
    /// setting the Mac's date back doesn't buy more days.
    static func trial(now: Date) -> Entitlement {
        let day: TimeInterval = 86400
        var start = now
        var seen = now
        if let s = Keychain.get(Keychain.trial), let d = s.data(using: .utf8),
           let o = try? JSONSerialization.jsonObject(with: d) as? [String: Double],
           let a = o["start"], let b = o["seen"] {
            start = Date(timeIntervalSince1970: a)
            seen = Date(timeIntervalSince1970: b)
            if now.addingTimeInterval(day) < seen { return .expired }
        }
        seen = max(seen, now)
        let o = ["start": start.timeIntervalSince1970, "seen": seen.timeIntervalSince1970]
        if let d = try? JSONSerialization.data(withJSONObject: o), let s = String(data: d, encoding: .utf8) {
            Keychain.set(Keychain.trial, s)
        }
        let ends = start.addingTimeInterval(TimeInterval(trialDays) * day)
        return now < ends ? .trial(ends: ends) : .expired
    }

    /// Checks a key and keeps it. Nil when the key isn't one of Sweeter's,
    /// or is for an earlier edition.
    @discardableResult
    static func activate(_ key: String) -> License? {
        guard let l = verify(key), l.edition >= edition else { return nil }
        Keychain.set(Keychain.license, key.trimmingCharacters(in: .whitespacesAndNewlines))
        NotificationCenter.default.post(name: .sweeterLicense, object: nil)
        return l
    }

    /// Whether this copy is signed by Sweeter's team (Developer ID). Debug
    /// builds pass, so development works; paid releases must be signed and
    /// notarized for this to hold.
    static func officialBuild() -> Bool {
        #if DEBUG
        return true
        #else
        var code: SecCode?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code else { return false }
        var req: SecRequirement?
        let text = "anchor apple generic and certificate leaf[subject.OU] = \"\(teamID)\"" as CFString
        guard SecRequirementCreateWithString(text, [], &req) == errSecSuccess, let req else { return false }
        return SecCodeCheckValidity(code, [], req) == errSecSuccess
        #endif
    }

    /// Web Inspector for Sweeter's page: always in debug builds, and in
    /// release builds only while Sweeter is free (it would let anyone paste
    /// Sweeter's scripts into a locked window).
    static var inspectable: Bool {
        #if DEBUG
        return true
        #else
        return !enforced
        #endif
    }

    // MARK: - Keychain

    enum Keychain {
        static let license = "license"
        static let trial = "trial"
        static let pending = "pending-checkout"
        private static let service = "fun.starl3xx.Sweeter"

        static func get(_ account: String) -> String? {
            var out: AnyObject?
            let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: account, kSecReturnData as String: true,
                                    kSecMatchLimit as String: kSecMatchLimitOne]
            guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
            return String(data: d, encoding: .utf8)
        }

        static func set(_ account: String, _ value: String) {
            let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: account]
            let d = Data(value.utf8)
            if SecItemUpdate(q as CFDictionary, [kSecValueData as String: d] as CFDictionary) == errSecItemNotFound {
                var add = q
                add[kSecValueData as String] = d
                add[kSecAttrLabel as String] = "Sweeter (\(account))"
                SecItemAdd(add as CFDictionary, nil)
            }
        }

        static func remove(_ account: String) {
            let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: account]
            SecItemDelete(q as CFDictionary)
        }
    }
}

extension Notification.Name {
    /// A license was activated: the window unlocks Sweeter's view.
    static let sweeterLicense = Notification.Name("SweeterLicense")
}
