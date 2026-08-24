import AppIntents
import Foundation

// The one AddTransactionIntent, split into an expense and an income phrase so
// Siri can disambiguate (docs/UX_SPEC.md#ядро-ввода). Both parse the phrase and
// OPEN A DEEP LINK — `centry://add?kind=…&amount=…&note=…` — via OpenURLIntent.
// The JS side (src/utils/deepLink + useWidgetDeepLink) turns that URL back into
// the input-sheet prefill; the real write funnels through the TS controller when
// the user taps save (no money math in Swift).
//
// Why a URL and not a shared store: an earlier design dropped the prefill into an
// App-Group MMKV, which forced linking a second MMKVCore consumer
// (MMKVAppExtension) into the main target — the app already links MMKVCore via
// react-native-mmkv, so two consumers in one process corrupted the heap and
// crashed at launch. The URL carries everything, so nothing extra is linked.
// OpenURLIntent requires iOS 17, hence the availability floor for Siri.

@available(iOS 17.0, *)
enum CentryDeepLink {
  /// Builds `centry://add?kind=…[&amount=…][&note=…]`, percent-encoding via
  /// URLComponents. Falls back to a bare add link if composition ever fails.
  static func add(kind: String, amount: Double?, note: String?) -> URL {
    var components = URLComponents()
    components.scheme = "centry"
    components.host = "add"
    var items = [URLQueryItem(name: "kind", value: kind)]
    if let amount, amount > 0 {
      // Whole number when possible ("12"), else a decimal string the TS side
      // sanitizes to the account currency's precision.
      let value = amount == amount.rounded() ? String(Int(amount)) : String(amount)
      items.append(URLQueryItem(name: "amount", value: value))
    }
    if let note = note?.trimmingCharacters(in: .whitespaces), !note.isEmpty {
      items.append(URLQueryItem(name: "note", value: note))
    }
    components.queryItems = items
    return components.url ?? URL(string: "centry://add")!
  }
}

@available(iOS 17.0, *)
struct AddExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Добавить трату"
  static var description = IntentDescription("Быстро записать расход в Centry.")

  @Parameter(title: "Сумма")
  var amount: Double?

  @Parameter(title: "Заметка")
  var note: String?

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(CentryDeepLink.add(kind: "expense", amount: amount, note: note)))
  }
}

@available(iOS 17.0, *)
struct AddIncomeIntent: AppIntent {
  static var title: LocalizedStringResource = "Добавить доход"
  static var description = IntentDescription("Быстро записать доход в Centry.")

  @Parameter(title: "Сумма")
  var amount: Double?

  @Parameter(title: "Заметка")
  var note: String?

  @MainActor
  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(CentryDeepLink.add(kind: "income", amount: amount, note: note)))
  }
}
