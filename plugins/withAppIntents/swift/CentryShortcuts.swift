import AppIntents

// Registers the Siri phrases for the AddTransaction intents. Must live in the
// app target (not an extension) for the phrases to auto-register — this is why
// these sources are injected into the main target by plugins/withAppIntents,
// not vended from targets/widget. `\(.applicationName)` resolves to "Centry".

@available(iOS 16.0, *)
struct CentryShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddExpenseIntent(),
      phrases: [
        "Добавить трату в \(.applicationName)",
        "Записать расход в \(.applicationName)",
        "\(.applicationName) трата",
      ],
      shortTitle: "Добавить трату",
      systemImageName: "minus.circle"
    )
    AppShortcut(
      intent: AddIncomeIntent(),
      phrases: [
        "Добавить доход в \(.applicationName)",
        "Записать доход в \(.applicationName)",
      ],
      shortTitle: "Добавить доход",
      systemImageName: "plus.circle"
    )
  }
}
