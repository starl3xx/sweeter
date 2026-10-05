import Foundation

/// A link's preview card for the compose window, read from the linked page
/// itself: its own preview tags (og: and twitter:) from the start of the
/// page, and its image as a data: URL (X's page allows no other image host).
/// No cookies, no cache, and only public web hosts: never X's own hosts
/// (Sweeter sends X nothing of its own) and never the local network.
enum LinkCard {
    nonisolated private static let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.httpCookieAcceptPolicy = .never
        c.httpShouldSetCookies = false
        c.urlCache = nil
        c.timeoutIntervalForRequest = 10
        c.timeoutIntervalForResource = 20
        return URLSession(configuration: c)
    }()

    /// The URL, when Sweeter may load it: http(s) to a named public host.
    nonisolated static func allowed(_ s: String) -> URL? {
        guard s.count <= 2000, let url = URL(string: s), let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http", url.user == nil, url.password == nil,
              let host = url.host?.lowercased(), host.contains(".") else { return nil }
        // An address rather than a name (IPv4 or IPv6) could be on the local network.
        if host.range(of: "^[0-9.]+$", options: .regularExpression) != nil || host.contains(":") { return nil }
        for local in ["local", "localhost", "internal", "lan", "home.arpa"] where host.hasSuffix("." + local) { return nil }
        for x in ["x.com", "twitter.com", "t.co"] where host == x || host.hasSuffix("." + x) { return nil }
        return url
    }

    /// The card: url, host, title, site and image (a data: URL or "").
    nonisolated static func fetch(_ url: URL) async -> [String: String]? {
        var req = URLRequest(url: url)
        req.setValue("text/html,application/xhtml+xml", forHTTPHeaderField: "Accept")
        guard let (data, http) = await read(req, limit: 400_000, untilHeadEnds: true),
              (http.value(forHTTPHeaderField: "Content-Type") ?? "").lowercased().contains("html") else { return nil }
        let base = http.url ?? url
        let tags = metaTags(String(decoding: data, as: UTF8.self))
        let title = tags["og:title"] ?? tags["twitter:title"] ?? tags["<title>"] ?? ""
        var image = ""
        if let ref = tags["og:image:secure_url"] ?? tags["og:image"] ?? tags["og:image:url"] ?? tags["twitter:image"] ?? tags["twitter:image:src"],
           let iu = URL(string: ref.trimmingCharacters(in: .whitespaces), relativeTo: base)?.absoluteURL,
           let ok = allowed(iu.absoluteString) {
            image = await dataURL(ok) ?? ""
        }
        if title.isEmpty && image.isEmpty { return nil }
        return [
            "url": base.absoluteString,
            "host": base.host ?? "",
            "title": String(title.prefix(300)),
            "site": String((tags["og:site_name"] ?? "").prefix(100)),
            "image": image,
        ]
    }

    /// An image, as a data: URL: JPEG, PNG, WebP or GIF, 1.5 MB at most.
    nonisolated private static func dataURL(_ url: URL) async -> String? {
        var req = URLRequest(url: url)
        req.setValue("image/*", forHTTPHeaderField: "Accept")
        guard let (data, http) = await read(req, limit: 1_500_000, untilHeadEnds: false),
              let type = http.value(forHTTPHeaderField: "Content-Type")?.split(separator: ";").first.map({ $0.trimmingCharacters(in: .whitespaces).lowercased() }),
              ["image/jpeg", "image/png", "image/webp", "image/gif"].contains(type) else { return nil }
        return "data:" + type + ";base64," + data.base64EncodedString()
    }

    /// A 2xx response's body, up to `limit` bytes. Over the limit, an HTML
    /// page keeps its start and an image is refused. A redirect is followed
    /// only to a host `allowed` accepts.
    nonisolated private static func read(_ req: URLRequest, limit: Int, untilHeadEnds: Bool) async -> (Data, HTTPURLResponse)? {
        guard let (bytes, response) = try? await session.bytes(for: req, delegate: Redirects.shared),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
        if let n = http.value(forHTTPHeaderField: "Content-Length").flatMap(Int.init), n > limit, !untilHeadEnds { return nil }
        var data = Data()
        let headEnd = Data("</head>".utf8)
        do {
            for try await b in bytes {
                data.append(b)
                if data.count > limit { return untilHeadEnds ? (data, http) : nil }
                if untilHeadEnds, data.count % 16_384 == 0, data.range(of: headEnd) != nil { break }
            }
        } catch {
            return nil
        }
        return (data, http)
    }

    /// The page's <meta property|name content> values, first one wins, keyed
    /// by their lowercased name, plus its <title> as "<title>".
    nonisolated static func metaTags(_ html: String) -> [String: String] {
        var out: [String: String] = [:]
        let ns = html as NSString
        let meta = try! NSRegularExpression(pattern: "<meta\\s[^>]*>", options: [.caseInsensitive])
        let attr = try! NSRegularExpression(pattern: "([a-zA-Z:_-]+)\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>\"']+)")
        for m in meta.matches(in: html, range: NSRange(location: 0, length: ns.length)) {
            let tag = ns.substring(with: m.range) as NSString
            var a: [String: String] = [:]
            for p in attr.matches(in: tag as String, range: NSRange(location: 0, length: tag.length)) {
                var v = tag.substring(with: p.range(at: 2))
                if v.hasPrefix("\"") || v.hasPrefix("'") { v = String(v.dropFirst().dropLast()) }
                a[tag.substring(with: p.range(at: 1)).lowercased()] = v
            }
            guard let key = (a["property"] ?? a["name"])?.lowercased(), let content = a["content"], out[key] == nil else { continue }
            let v = decode(content).trimmingCharacters(in: .whitespacesAndNewlines)
            if !v.isEmpty { out[key] = v }
        }
        let title = try! NSRegularExpression(pattern: "<title[^>]*>([^<]*)</title>", options: [.caseInsensitive])
        if let t = title.firstMatch(in: html, range: NSRange(location: 0, length: ns.length)) {
            let v = decode(ns.substring(with: t.range(at: 1))).trimmingCharacters(in: .whitespacesAndNewlines)
            if !v.isEmpty { out["<title>"] = v }
        }
        return out
    }

    /// HTML character references in an attribute or a title.
    nonisolated static func decode(_ s: String) -> String {
        guard s.contains("&") else { return s }
        var out = s
        for (k, v) in [("&quot;", "\""), ("&#39;", "'"), ("&#x27;", "'"), ("&apos;", "'"), ("&lt;", "<"), ("&gt;", ">"), ("&nbsp;", " ")] { out = out.replacingOccurrences(of: k, with: v) }
        let num = try! NSRegularExpression(pattern: "&#(x?)([0-9a-fA-F]{1,6});")
        for m in num.matches(in: out, range: NSRange(location: 0, length: (out as NSString).length)).reversed() {
            let ns = out as NSString
            let hex = ns.substring(with: m.range(at: 1)) == "x"
            if let n = UInt32(ns.substring(with: m.range(at: 2)), radix: hex ? 16 : 10), let u = Unicode.Scalar(n) {
                out = ns.replacingCharacters(in: m.range, with: String(Character(u)))
            }
        }
        return out.replacingOccurrences(of: "&amp;", with: "&")
    }

    /// Follows a redirect only to a host `allowed` accepts.
    private final class Redirects: NSObject, URLSessionTaskDelegate {
        nonisolated static let shared = Redirects()
        nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(request.url.flatMap { LinkCard.allowed($0.absoluteString) } != nil ? request : nil)
        }
    }
}
