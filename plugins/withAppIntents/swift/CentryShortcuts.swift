import AppIntents

// Registers the Siri phrases for the Centry App Intents. Must live in the app
// target (not an extension) for the phrases to auto-register — this is why these
// sources are injected into the main target by plugins/withAppIntents.
// `\(.applicationName)` resolves to "Centry". English-first (the primary Siri
// language), with Russian phrases kept so it also works in Russian. iOS 16 floor:
// App Intents + openAppWhenRun (no OpenURLIntent, so no iOS 18 requirement).

@available(iOS 16.0, *)
struct CentryShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddExpenseIntent(),
      phrases: [
        "Add expense to \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "\(.applicationName) expense",
        "Добавить трату в \(.applicationName)",
        "Записать расход в \(.applicationName)",
      ],
      shortTitle: "Add expense",
      systemImageName: "minus.circle"
    )
    AppShortcut(
      intent: AddIncomeIntent(),
      phrases: [
        "Add income to \(.applicationName)",
        "Log income in \(.applicationName)",
        "\(.applicationName) income",
        "Добавить доход в \(.applicationName)",
        "Записать доход в \(.applicationName)",
      ],
      shortTitle: "Add income",
      systemImageName: "plus.circle"
    )
    AppShortcut(
      intent: TotalMoneyIntent(),
      phrases: [
        "How much money do I have in \(.applicationName)",
        "What's my balance in \(.applicationName)",
        "Сколько у меня денег в \(.applicationName)",
      ],
      shortTitle: "Total money",
      systemImageName: "creditcard"
    )
    AppShortcut(
      intent: CanSpendTodayIntent(),
      phrases: [
        "How much can I spend today in \(.applicationName)",
        "What can I spend today in \(.applicationName)",
        "Сколько я могу потратить сегодня в \(.applicationName)",
      ],
      shortTitle: "Can spend today",
      systemImageName: "wallet.pass"
    )
    AppShortcut(
      intent: SpentTodayIntent(),
      phrases: [
        "How much did I spend today in \(.applicationName)",
        "What did I spend today in \(.applicationName)",
        "Сколько я потратил сегодня в \(.applicationName)",
      ],
      shortTitle: "Spent today",
      systemImageName: "cart"
    )
  }
}
