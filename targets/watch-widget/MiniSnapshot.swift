import Foundation

// The subset of the watch payload the complication needs. JSONDecoder ignores the
// extra keys, so the same JSON the watch app cached decodes straight into this.
// Read from the watch-side App Group shared with the watch app.
struct MiniSnapshot: Decodable {
  let currency: String
  let allowanceTitle: String
  let spentLabel: String
  let remainingTodayMinor: Int
  let todaySpentMinor: Int

  static let placeholder = MiniSnapshot(
    currency: "BYN",
    allowanceTitle: "CAN SPEND TODAY",
    spentLabel: "spent",
    remainingTodayMinor: 0,
    todaySpentMinor: 0
  )

  static func load() -> MiniSnapshot {
    guard
      let json = UserDefaults(suiteName: "group.by.vazon.centry.watch")?
        .string(forKey: "payload"),
      let data = json.data(using: .utf8),
      let decoded = try? JSONDecoder().decode(MiniSnapshot.self, from: data)
    else { return .placeholder }
    return decoded
  }
}

// Minor-unit money formatting (mirrors the widget's Money.format).
enum CMoney {
  static func format(_ minor: Int) -> String {
    let negative = minor < 0
    let absValue = abs(minor)
    let whole = absValue / 100
    let frac = absValue % 100
    var wholeStr = String(whole)
    if wholeStr.count > 3 {
      var grouped = ""
      var count = 0
      for ch in wholeStr.reversed() {
        if count > 0 && count % 3 == 0 { grouped.append("\u{2009}") }
        grouped.append(ch)
        count += 1
      }
      wholeStr = String(grouped.reversed())
    }
    return "\(negative ? "−" : "")\(wholeStr).\(String(format: "%02d", frac))"
  }
}
