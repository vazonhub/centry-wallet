import AppIntents

// Registers the Siri phrases for the AddTransaction intents. Must live in the
// app target (not an extension) for the phrases to auto-register — this is why
// these sources are injected into the main target by plugins/withAppIntents,
// not vended from targets/widget. `\(.applicationName)` resolves to "Centry".
// iOS 18 floor: the intents open a deep link via OpenURLIntent (iOS 18+ init).
//
// Phrases are provided in BOTH Russian and English so Siri works in either
// language (the app declares ru + en localizations, app.json
// CFBundleLocalizations). Each phrase must contain `\(.applicationName)`.

@available(iOS 18.0, *)
struct CentryShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddExpenseIntent(),
      phrases: [
        "Добавить трату в \(.applicationName)",
        "Записать расход в \(.applicationName)",
        "\(.applicationName) трата",
        "Add expense to \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "\(.applicationName) expense",
      ],
      shortTitle: "Добавить трату",
      systemImageName: "minus.circle"
    )
    AppShortcut(
      intent: AddIncomeIntent(),
      phrases: [
        "Добавить доход в \(.applicationName)",
        "Записать доход в \(.applicationName)",
        "Add income to \(.applicationName)",
        "Log income in \(.applicationName)",
      ],
      shortTitle: "Добавить доход",
      systemImageName: "plus.circle"
    )
  }
}
