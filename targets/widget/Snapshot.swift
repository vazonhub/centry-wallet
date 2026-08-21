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
  let accounts: [WidgetAccount]
  let recent: [WidgetRecent]
  let updatedAt: Int

  /// Shown before the app has ever written a snapshot (fresh install / preview).
  static let placeholder = CentrySnapshot(
    perDayMinor: 0,
    currency: "BYN",
    daysLeft: 1,
    todaySpentMinor: 0,
    accounts: [],
    recent: [],
    updatedAt: 0
  )

  static func decode(from json: String) -> CentrySnapshot? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(CentrySnapshot.self, from: data)
  }
}
