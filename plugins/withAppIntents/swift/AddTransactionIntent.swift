import AppIntents
import Foundation

// The Add expense / income App Intents. iOS forbids opening a custom URL scheme
// (centry://) from an OpenURLIntent — the previous approach threw "scheme
// unsupported; launch is prohibited". So instead each intent FOREGROUNDS the app
// (openAppWhenRun) and drops the parsed phrase into the App-Group UserDefaults;
// the JS side (useSiriPrefill) reads it on activation and opens the input sheet
// pre-filled. No shared MMKV (that corrupted the heap, see docs/DECISIONS) — plain
// Foundation UserDefaults links nothing extra.

enum CentryStore {
  static let suite = "group.by.vazon.centry"

  /// Persists an Add prefill for the app to pick up on next activation.
  static func writePendingAdd(kind: String, amount: Double?, note: String?, accountId: String?) {
    var dict: [String: Any] = ["kind": kind]
    if let amount, amount > 0 {
      // Whole number when possible ("12"), else a decimal string the TS side
      // sanitizes to the account currency's precision.
      dict["amount"] = amount == amount.rounded() ? String(Int(amount)) : String(amount)
    }
    if let note = note?.trimmingCharacters(in: .whitespaces), !note.isEmpty {
      dict["note"] = note
    }
    if let accountId, !accountId.isEmpty {
      dict["accountId"] = accountId
    }
    if let data = try? JSONSerialization.data(withJSONObject: dict),
      let json = String(data: data, encoding: .utf8)
    {
      UserDefaults(suiteName: suite)?.set(json, forKey: "pendingAdd")
    }
  }

  /// A preformatted stat string the app wrote after its last data refresh.
  static func stat(_ key: String) -> String? {
    guard let json = UserDefaults(suiteName: suite)?.string(forKey: "stats"),
      let data = json.data(using: .utf8),
      let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return dict[key] as? String
  }
}

@available(iOS 16.0, *)
struct AddExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Add expense"
  static var description = IntentDescription("Quickly log an expense in Centry.")
  static var openAppWhenRun = true

  @Parameter(title: "Amount")
  var amount: Double?

  @Parameter(title: "Note")
  var note: String?

  @Parameter(title: "Account")
  var account: CentryAccountEntity?

  @MainActor
  func perform() async throws -> some IntentResult {
    CentryStore.writePendingAdd(kind: "expense", amount: amount, note: note, accountId: account?.id)
    return .result()
  }
}

@available(iOS 16.0, *)
struct AddIncomeIntent: AppIntent {
  static var title: LocalizedStringResource = "Add income"
  static var description = IntentDescription("Quickly log income in Centry.")
  static var openAppWhenRun = true

  @Parameter(title: "Amount")
  var amount: Double?

  @Parameter(title: "Note")
  var note: String?

  @Parameter(title: "Account")
  var account: CentryAccountEntity?

  @MainActor
  func perform() async throws -> some IntentResult {
    CentryStore.writePendingAdd(kind: "income", amount: amount, note: note, accountId: account?.id)
    return .result()
  }
}
