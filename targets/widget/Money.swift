import Foundation

// Money formatting for the widget. Amounts arrive as INTEGER minor units (rule
// 1) — never floats. Mirrors @utils/money on the TS side closely enough for a
// glanceable widget (grouped thousands, 2 decimals, explicit sign).

enum Money {
  /// Formats minor units as e.g. "1 234.50". `showPlus` prefixes non-negative
  /// values with "+". Uses a thin space as the thousands separator.
  static func format(_ minor: Int, showPlus: Bool = false, hideCode: Bool = true,
                     currency: String = "") -> String {
    let negative = minor < 0
    let absValue = abs(minor)
    let whole = absValue / 100
    let frac = absValue % 100

    var wholeStr = String(whole)
    // Group thousands with a thin space (matches tabular, non-locale display).
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

    let sign = negative ? "−" : (showPlus ? "+" : "")
    let number = "\(sign)\(wholeStr).\(String(format: "%02d", frac))"
    return hideCode || currency.isEmpty ? number : "\(number) \(currency)"
  }
}
