import AppIntents
import Foundation
import WidgetKit

// Interactive-widget quick-add (iOS 17+). The widget extension can't safely open
// the app's SQLite, so tapping a preset APPENDS a whole-major amount to an
// App-Group queue; the app drains it onto the default account on next activation
// (see src/hooks/useQuickAddDrain.ts). No shared MMKV — plain Foundation
// UserDefaults, matching the Siri channel.

enum QuickAddStore {
  static let suite = "group.by.vazon.centry"
  static let key = "quickAddQueue"

  static func enqueue(kind: String, amountMajor: Int) {
    let defaults = UserDefaults(suiteName: suite)
    var arr: [[String: Any]] = []
    if let raw = defaults?.string(forKey: key),
      let data = raw.data(using: .utf8),
      let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    {
      arr = parsed
    }
    arr.append(["kind": kind, "amountMajor": amountMajor])
    if let data = try? JSONSerialization.data(withJSONObject: arr),
      let json = String(data: data, encoding: .utf8)
    {
      defaults?.set(json, forKey: key)
    }
  }
}

@available(iOS 17.0, *)
struct QuickAddExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Quick expense"

  @Parameter(title: "Amount")
  var amount: Int

  init() {}
  init(amount: Int) { self.amount = amount }

  func perform() async throws -> some IntentResult {
    QuickAddStore.enqueue(kind: "expense", amountMajor: amount)
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}
