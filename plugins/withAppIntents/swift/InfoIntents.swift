import AppIntents

// Read-only Siri intents that SPEAK a number back instead of opening the app, so
// they don't hit the custom-URL-scheme restriction. They read the preformatted
// summary the app wrote to App-Group UserDefaults after its last data refresh
// (CentryStore.stat) — money is formatted on the JS side (@utils/money), so Swift
// never does money math. If the app has never written the summary, they prompt to
// open Centry once. English-first (the primary Siri language for Centry).

@available(iOS 16.0, *)
struct TotalMoneyIntent: AppIntent {
  static var title: LocalizedStringResource = "How much money I have"
  static var description = IntentDescription("Tells your total balance across accounts in Centry.")

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    if let total = CentryStore.stat("total") {
      return .result(dialog: "You have \(total).")
    }
    return .result(dialog: "Open Centry once so it can update your balance.")
  }
}

@available(iOS 16.0, *)
struct CanSpendTodayIntent: AppIntent {
  static var title: LocalizedStringResource = "How much I can spend today"
  static var description = IntentDescription("Tells today's spending allowance in Centry.")

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    if let canSpend = CentryStore.stat("canSpend") {
      return .result(dialog: "You can spend \(canSpend) today.")
    }
    return .result(dialog: "Set a budget plan in Centry first.")
  }
}

@available(iOS 16.0, *)
struct SpentTodayIntent: AppIntent {
  static var title: LocalizedStringResource = "How much I spent today"
  static var description = IntentDescription("Tells how much you've spent today in Centry.")

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    if let spent = CentryStore.stat("spentToday") {
      return .result(dialog: "You've spent \(spent) today.")
    }
    return .result(dialog: "Open Centry once so it can update today's spending.")
  }
}
