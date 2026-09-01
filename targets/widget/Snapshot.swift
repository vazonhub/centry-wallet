import Foundation

// The widget snapshot — the ONLY data the extension reads. Written by the app
// after every mutation to the shared App-Group MMKV (see
// docs/DATA_MODEL.md#снимок-для-виджета). The widget NEVER opens SQLite and
// never recomputes "можно сегодня"; it renders these frozen numbers, so the
// TS and Swift sides can never drift.

struct WidgetAccount: Codable, Hashable {
  let name: String
  let balanceMinor: Int
  let currency: String
}

struct WidgetRecent: Codable, Hashable {
  let icon: String
  let note: String
  let amountMinor: Int
  let currency: String
}

struct CentrySnapshot: Codable, Hashable {
  let perDayMinor: Int
  let currency: String
  let daysLeft: Int
  let todaySpentMinor: Int
  let periodRemainingMinor: Int
  let periodLabel: String
  let allowanceTitle: String
  let spentLabel: String
  let forPeriodLabel: String
  let emptyLabel: String
  let accounts: [WidgetAccount]
  let recent: [WidgetRecent]
  let updatedAt: Int

  /// Localized UI strings are injected by the app, but older snapshots (written
  /// before this field existed) decode without them — default to English so the
  /// widget never shows an empty label.
  enum CodingKeys: String, CodingKey {
    case perDayMinor, currency, daysLeft, todaySpentMinor, periodRemainingMinor, periodLabel
    case allowanceTitle, spentLabel, forPeriodLabel, emptyLabel, accounts, recent, updatedAt
  }

  init(
    perDayMinor: Int, currency: String, daysLeft: Int, todaySpentMinor: Int,
    periodRemainingMinor: Int, periodLabel: String, allowanceTitle: String, spentLabel: String,
    forPeriodLabel: String, emptyLabel: String, accounts: [WidgetAccount], recent: [WidgetRecent],
    updatedAt: Int
  ) {
    self.perDayMinor = perDayMinor
    self.currency = currency
    self.daysLeft = daysLeft
    self.todaySpentMinor = todaySpentMinor
    self.periodRemainingMinor = periodRemainingMinor
    self.periodLabel = periodLabel
    self.allowanceTitle = allowanceTitle
    self.spentLabel = spentLabel
    self.forPeriodLabel = forPeriodLabel
    self.emptyLabel = emptyLabel
    self.accounts = accounts
    self.recent = recent
    self.updatedAt = updatedAt
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    perDayMinor = try c.decode(Int.self, forKey: .perDayMinor)
    currency = try c.decode(String.self, forKey: .currency)
    daysLeft = try c.decode(Int.self, forKey: .daysLeft)
    todaySpentMinor = try c.decode(Int.self, forKey: .todaySpentMinor)
    periodRemainingMinor = try c.decode(Int.self, forKey: .periodRemainingMinor)
    periodLabel = try c.decode(String.self, forKey: .periodLabel)
    allowanceTitle = (try? c.decode(String.self, forKey: .allowanceTitle)) ?? "CAN SPEND TODAY"
    spentLabel = (try? c.decode(String.self, forKey: .spentLabel)) ?? "spent"
    forPeriodLabel = (try? c.decode(String.self, forKey: .forPeriodLabel)) ?? "for the period"
    emptyLabel = (try? c.decode(String.self, forKey: .emptyLabel)) ?? "No records"
    accounts = try c.decode([WidgetAccount].self, forKey: .accounts)
    recent = try c.decode([WidgetRecent].self, forKey: .recent)
    updatedAt = try c.decode(Int.self, forKey: .updatedAt)
  }

  /// Shown before the app has ever written a snapshot (fresh install / preview).
  static let placeholder = CentrySnapshot(
    perDayMinor: 0,
    currency: "BYN",
    daysLeft: 1,
    todaySpentMinor: 0,
    periodRemainingMinor: 0,
    periodLabel: "month",
    allowanceTitle: "CAN SPEND TODAY",
    spentLabel: "spent",
    forPeriodLabel: "for the month",
    emptyLabel: "No records",
    accounts: [],
    recent: [],
    updatedAt: 0
  )

  static func decode(from json: String) -> CentrySnapshot? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(CentrySnapshot.self, from: data)
  }
}
