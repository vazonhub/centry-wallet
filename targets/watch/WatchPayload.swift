import Foundation

// Mirrors src/services/watch/payload.ts (WatchPayload). Sent by the phone over
// WatchConnectivity as a JSON string; the watch decodes and renders it. All money
// is INTEGER minor units (rule 1).

struct WatchAccount: Codable, Hashable, Identifiable {
  let name: String
  let balanceMinor: Int
  let currency: String
  var id: String { name + currency }
}

struct WatchRecent: Codable, Hashable, Identifiable {
  let note: String
  let amountMinor: Int
  let currency: String
  let isIncome: Bool
  let isTransfer: Bool
  var id: String { "\(note)\(amountMinor)\(currency)" }
}

struct WatchDayStat: Codable, Hashable, Identifiable {
  let day: String
  let spentMinor: Int
  var id: String { day }
}

struct WatchPayload: Codable, Hashable {
  let language: String
  let currency: String
  let allowanceTitle: String
  let spentLabel: String
  let remainingTodayMinor: Int
  let perDayMinor: Int
  let todaySpentMinor: Int
  let periodRemainingMinor: Int
  let periodLabel: String
  let accounts: [WatchAccount]
  let recent: [WatchRecent]
  let statsByDay: [WatchDayStat]
  let statsByTx: [Int]
  let windowIncomeMinor: Int
  let windowSpentMinor: Int
  let budgetAmountMinor: Int
  let budgetCurrency: String
  let updatedAt: Int

  static let placeholder = WatchPayload(
    language: "en",
    currency: "BYN",
    allowanceTitle: "CAN SPEND TODAY",
    spentLabel: "spent",
    remainingTodayMinor: 0,
    perDayMinor: 0,
    todaySpentMinor: 0,
    periodRemainingMinor: 0,
    periodLabel: "month",
    accounts: [],
    recent: [],
    statsByDay: [],
    statsByTx: [],
    windowIncomeMinor: 0,
    windowSpentMinor: 0,
    budgetAmountMinor: 0,
    budgetCurrency: "BYN",
    updatedAt: 0
  )

  static func decode(from json: String) -> WatchPayload? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WatchPayload.self, from: data)
  }
}

// Money formatting — mirrors the widget's Money.format (minor units, thin-space
// thousands, 2 decimals, explicit minus).
enum WatchMoney {
  static func format(_ minor: Int, showPlus: Bool = false) -> String {
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
    let sign = negative ? "−" : (showPlus ? "+" : "")
    return "\(sign)\(wholeStr).\(String(format: "%02d", frac))"
  }
}
