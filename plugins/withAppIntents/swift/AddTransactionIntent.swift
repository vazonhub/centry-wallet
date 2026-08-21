import AppIntents
import Foundation

// The one AddTransactionIntent, split into an expense and an income phrase so
// Siri can disambiguate (docs/UX_SPEC.md#ядро-ввода). Both just parse the
// phrase and hand a prefill to the app via CentryIntentStore, then open the
// app — the input sheet fills in and the user confirms. App Intents require
// iOS 16; on the 15.1 floor these simply don't register.

@available(iOS 16.0, *)
struct AddExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Добавить трату"
  static var description = IntentDescription("Быстро записать расход в Centry.")
  // Bring the app forward so the pre-seeded input sheet appears.
  static var openAppWhenRun = true

  @Parameter(title: "Сумма")
  var amount: Double?

  @Parameter(title: "Заметка")
  var note: String?

  @MainActor
  func perform() async throws -> some IntentResult {
    CentryIntentStore.setPending(kind: "expense", amount: amount, note: note)
    return .result()
  }
}

@available(iOS 16.0, *)
struct AddIncomeIntent: AppIntent {
  static var title: LocalizedStringResource = "Добавить доход"
  static var description = IntentDescription("Быстро записать доход в Centry.")
  static var openAppWhenRun = true

  @Parameter(title: "Сумма")
  var amount: Double?

  @Parameter(title: "Заметка")
  var note: String?

  @MainActor
  func perform() async throws -> some IntentResult {
    CentryIntentStore.setPending(kind: "income", amount: amount, note: note)
    return .result()
  }
}
