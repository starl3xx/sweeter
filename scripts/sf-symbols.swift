// Writes extension/src/ui/symbols.js: every icon Sweeter draws in the page,
// as SVG paths taken from macOS’s own SF Symbols (the vectors the SF Symbols
// app shows). Run after changing the list: swift scripts/sf-symbols.swift
//
// The outlines come from CoreUI’s vector glyph (a private class) at build
// time only; nothing private ships. All symbols share one point size and
// one 44-unit box, so their relative sizes stay as Apple designed them.
import AppKit

// Page icon name, SF Symbol, weight. Semibold reads well at the small
// sizes the columns use (Regular looked thin, 2026-09-28).
let ICONS: [(String, String, NSFont.Weight)] = [
    ("home", "house", .semibold),
    ("mention", "at", .semibold),
    ("activity", "bolt", .semibold),
    ("search", "magnifyingglass", .semibold),
    ("list", "list.bullet", .semibold),
    ("profile", "person.crop.circle", .semibold),
    ("user", "person", .semibold),
    ("like", "heart", .semibold),
    ("likeOn", "heart.fill", .semibold),
    ("reply", "arrowshape.turn.up.left", .semibold),
    ("repost", "arrow.2.squarepath", .semibold),
    ("repostOn", "arrow.2.squarepath", .heavy),
    ("bookmark", "bookmark", .semibold),
    ("bookmarkOn", "bookmark.fill", .semibold),
    ("more", "ellipsis", .semibold),
    ("follow", "person.badge.plus", .semibold),
    ("quote", "quote.bubble", .semibold),
    ("bell", "bell", .semibold),
    ("news", "newspaper", .semibold),
    ("gear", "gearshape", .semibold),
    ("seal", "checkmark.seal.fill", .semibold),
    ("swap", "rectangle.split.2x1", .semibold),
    ("check", "checkmark", .bold),
    ("play", "play.fill", .semibold),
    ("lock", "lock.fill", .semibold),
    ("link", "link", .semibold),
    ("mute", "speaker.slash", .semibold),
    ("photo", "photo", .semibold),
    ("keyboard", "keyboard", .semibold),
    ("compose", "square.and.pencil", .semibold),
    ("poll", "chart.bar.xaxis", .semibold),
    ("emoji", "face.smiling", .semibold),
    ("schedule", "calendar.badge.clock", .semibold),
    ("pin", "mappin.and.ellipse", .semibold),
    ("calendar", "calendar", .semibold),
    ("globe", "globe", .semibold),
    ("chevron", "chevron.down", .bold),
    ("spark", "sparkles", .semibold),
    ("bold", "bold", .semibold),
    ("italic", "italic", .semibold),
    ("x", "xmark", .semibold),
    ("open", "arrow.up.right.square", .semibold),
    ("filter", "line.3.horizontal.decrease.circle", .semibold),
    ("filterOn", "line.3.horizontal.decrease.circle.fill", .semibold),
    // Release 2: per-column icons, decks, views, alerts and pause.
    ("star", "star", .semibold),
    ("flame", "flame", .semibold),
    ("briefcase", "briefcase", .semibold),
    ("chart", "chart.line.uptrend.xyaxis", .semibold),
    ("leaf", "leaf", .semibold),
    ("game", "gamecontroller", .semibold),
    ("music", "music.note", .semibold),
    ("sports", "sportscourt", .semibold),
    ("coin", "bitcoinsign.circle", .semibold),
    ("people", "person.2", .semibold),
    ("cup", "cup.and.saucer", .semibold),
    ("camera", "camera", .semibold),
    ("flag", "flag", .semibold),
    ("brain", "brain", .semibold),
    ("decks", "square.stack", .semibold),
    ("view", "square.on.square", .semibold),
    ("alert", "bell.badge", .semibold),
    ("pause", "pause.fill", .semibold),
    ("clock", "clock", .semibold),
    ("collapse", "arrow.down.right.and.arrow.up.left", .semibold),
    ("hide", "eye.slash", .semibold),
    ("addcol", "rectangle.stack.badge.plus", .semibold),
    // Release 3+: the column icon picker (Icon & Color…).
    ("group3", "person.3", .semibold),
    ("chat", "bubble.left.and.bubble.right", .semibold),
    ("inbox", "tray", .semibold),
    ("mail", "envelope", .semibold),
    ("megaphone", "megaphone", .semibold),
    ("eye", "eye", .semibold),
    ("live", "dot.radiowaves.left.and.right", .semibold),
    ("verified", "checkmark.seal", .semibold),
    ("thumbsup", "hand.thumbsup", .semibold),
    ("party", "party.popper", .semibold),
    ("chartbar", "chart.bar", .semibold),
    ("pie", "chart.pie", .semibold),
    ("dollar", "dollarsign.circle", .semibold),
    ("bank", "building.columns", .semibold),
    ("cart", "cart", .semibold),
    ("bag", "bag", .semibold),
    ("card", "creditcard", .semibold),
    ("city", "building.2", .semibold),
    ("doc", "doc.text", .semibold),
    ("folder", "folder", .semibold),
    ("target", "scope", .semibold),
    ("trophy", "trophy", .semibold),
    ("crown", "crown", .semibold),
    ("diamond", "diamond", .semibold),
    ("scale", "scalemass", .semibold),
    ("hourglass", "hourglass", .semibold),
    ("code", "chevron.left.forwardslash.chevron.right", .semibold),
    ("terminal", "terminal", .semibold),
    ("cpu", "cpu", .semibold),
    ("laptop", "laptopcomputer", .semibold),
    ("phone", "iphone", .semibold),
    ("server", "server.rack", .semibold),
    ("cloud", "cloud", .semibold),
    ("wifi", "wifi", .semibold),
    ("bulb", "lightbulb", .semibold),
    ("hammer", "hammer", .semibold),
    ("wrench", "wrench.and.screwdriver", .semibold),
    ("cube", "cube", .semibold),
    ("key", "key", .semibold),
    ("shield", "shield", .semibold),
    ("atom", "atom", .semibold),
    ("flask", "flask", .semibold),
    ("bug", "ladybug", .semibold),
    ("infinity", "infinity", .semibold),
    ("book", "book", .semibold),
    ("books", "books.vertical", .semibold),
    ("grad", "graduationcap", .semibold),
    ("film", "film", .semibold),
    ("tv", "tv", .semibold),
    ("video", "video", .semibold),
    ("mic", "mic", .semibold),
    ("headphones", "headphones", .semibold),
    ("guitar", "guitars", .semibold),
    ("brush", "paintbrush.pointed", .semibold),
    ("palette", "paintpalette", .semibold),
    ("theater", "theatermasks", .semibold),
    ("dice", "dice", .semibold),
    ("puzzle", "puzzlepiece", .semibold),
    ("football", "football", .semibold),
    ("basketball", "basketball", .semibold),
    ("baseball", "baseball", .semibold),
    ("soccer", "soccerball", .semibold),
    ("tennis", "tennis.racket", .semibold),
    ("hockey", "hockey.puck", .semibold),
    ("golf", "figure.golf", .semibold),
    ("run", "figure.run", .semibold),
    ("bike", "bicycle", .semibold),
    ("dumbbell", "dumbbell", .semibold),
    ("medal", "medal", .semibold),
    ("mountain", "mountain.2", .semibold),
    ("tent", "tent", .semibold),
    ("tree", "tree", .semibold),
    ("drop", "drop", .semibold),
    ("sun", "sun.max", .semibold),
    ("moon", "moon", .semibold),
    ("snow", "snowflake", .semibold),
    ("rain", "cloud.rain", .semibold),
    ("fork", "fork.knife", .semibold),
    ("wine", "wineglass", .semibold),
    ("cake", "birthday.cake", .semibold),
    ("carrot", "carrot", .semibold),
    ("paw", "pawprint", .semibold),
    ("bird", "bird", .semibold),
    ("fish", "fish", .semibold),
    ("car", "car", .semibold),
    ("plane", "airplane", .semibold),
    ("boat", "sailboat", .semibold),
    ("map", "map", .semibold),
    ("location", "location", .semibold),
    ("gift", "gift", .semibold),
    ("health", "cross.case", .semibold),
    ("pills", "pills", .semibold),
    ("family", "figure.2.and.child.holdinghands", .semibold),
    ("heartcircle", "heart.circle", .semibold),
    ("bolt2", "bolt.circle", .semibold),
    ("sparkle", "sparkle", .semibold),
    ("hash", "number", .semibold),
    ("tag", "tag", .semibold),
    ("paperplane", "paperplane", .semibold),
    // Toasts: a problem, a hint.
    ("warn", "exclamationmark.triangle.fill", .semibold),
    ("info", "info.circle.fill", .semibold),
]
let BOX: CGFloat = 44
let root = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent().deletingLastPathComponent()

func outline(_ symbol: String, _ weight: NSFont.Weight) -> CGPath? {
    guard let img = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?.withSymbolConfiguration(.init(pointSize: 16, weight: weight)),
          let rep = img.representations.first,
          let glyph = rep.value(forKey: "vectorGlyph") as? NSObject else { return nil }
    let sel = NSSelectorFromString("CGPath")
    guard glyph.responds(to: sel), let r = glyph.perform(sel) else { return nil }
    let whole = r.takeUnretainedValue() as! CGPath
    // A symbol with eraser layers is drawn in layers, in order, and the flat
    // path is wrong for it, so rebuild it. An eraser with opacity 0 only
    // cuts (the gap around a badge, the mark inside it); an eraser with
    // opacity 1 cuts and then draws itself (an atom’s orbits, a globe’s
    // meridians, a chart’s axes), which in one color is the same as adding
    // it. Some symbols (snowflake) give an empty flat path: rebuilt too.
    guard let layers = glyph.value(forKey: "monochromeLayers") as? [NSObject],
          whole.isEmpty || layers.contains(where: { ($0.value(forKey: "isEraserLayer") as? Bool) == true }) else { return whole }
    var result: CGPath = CGMutablePath()
    for layer in layers {
        guard let pr = layer.perform(NSSelectorFromString("shape")) else { continue }
        let p = pr.takeUnretainedValue() as! CGPath
        let cutsOnly = (layer.value(forKey: "isEraserLayer") as? Bool) == true && ((layer.value(forKey: "opacity") as? Double) ?? 1) == 0
        result = cutsOnly ? result.subtracting(p) : result.union(p)
    }
    return result
}

func num(_ v: CGFloat) -> String {
    var s = String(format: "%.2f", Double(v))
    while s.hasSuffix("0") { s.removeLast() }
    if s.hasSuffix(".") { s.removeLast() }
    return s == "-0" ? "0" : s
}

// Centered in the box. CoreUI’s glyph space has y pointing down, as SVG does.
// A symbol wider than the box (person.3, bicycle) is scaled down to fit:
// the SVG clips at the box edge.
func svgPath(_ p: CGPath) -> String {
    let b = p.boundingBoxOfPath
    let s = min(1, BOX / max(b.width, b.height))
    let pt = { (q: CGPoint) in num((q.x - b.midX) * s + BOX / 2) + " " + num((q.y - b.midY) * s + BOX / 2) }
    var d = ""
    p.applyWithBlock { e in
        let el = e.pointee
        switch el.type {
        case .moveToPoint: d += "M" + pt(el.points[0])
        case .addLineToPoint: d += "L" + pt(el.points[0])
        case .addQuadCurveToPoint: d += "Q" + pt(el.points[0]) + " " + pt(el.points[1])
        case .addCurveToPoint: d += "C" + pt(el.points[0]) + " " + pt(el.points[1]) + " " + pt(el.points[2])
        case .closeSubpath: d += "Z"
        @unknown default: break
        }
    }
    return d
}

var lines: [String] = []
var failed: [String] = []
for (name, symbol, weight) in ICONS {
    guard let p = outline(symbol, weight), !p.isEmpty else {
        failed.append(symbol)
        continue
    }
    let b = p.boundingBoxOfPath
    if b.width > BOX || b.height > BOX { print("note: \(symbol) is \(Int(b.width))×\(Int(b.height)), scaled to fit the \(Int(BOX))-unit box") }
    lines.append("    \(name): '\(svgPath(p))', // \(symbol)")
}
if !failed.isEmpty {
    print("No such symbol: " + failed.joined(separator: ", "))
    exit(1)
}

let js = """
// Generated by scripts/sf-symbols.swift from macOS’s SF Symbols. Do not edit;
// change the list there and run it again. SF Symbols may be used only in
// apps for Apple platforms (Apple’s SF Symbols license).
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});
  Sweeter.SYMBOLS = {
\(lines.joined(separator: "\n"))
  };
  Sweeter.SYMBOL_BOX = \(Int(BOX));
})(typeof globalThis !== 'undefined' ? globalThis : this);

"""
let out = root.appendingPathComponent("extension/src/ui/symbols.js")
try! js.write(to: out, atomically: true, encoding: .utf8)
print("Wrote \(ICONS.count) symbols to extension/src/ui/symbols.js")
