import Foundation

// Watch-only UI chrome strings (the phone already sends the allowance labels in
// its language via the payload; these cover the watch's own buttons/titles).
// Picks RU/EN from the watch's locale.
enum L {
  private static var ru: Bool {
    (Locale.current.language.languageCode?.identifier ?? "en") == "ru"
  }

  static var reserve: String { ru ? "Резерв" : "Reserve" }
  static var budget: String { ru ? "Бюджет" : "Budget" }
  static var accounts: String { ru ? "Счета" : "Accounts" }
  static var history: String { ru ? "История" : "History" }
  static var stats: String { ru ? "Статистика" : "Stats" }
  static var addExpense: String { ru ? "Трата" : "Expense" }
  static var addIncome: String { ru ? "Доход" : "Income" }
  static var save: String { ru ? "Сохранить" : "Save" }
  static var cancel: String { ru ? "Отмена" : "Cancel" }
  static var amount: String { ru ? "Сумма" : "Amount" }
  static var income: String { ru ? "Пришло" : "Income" }
  static var spent: String { ru ? "Ушло" : "Spent" }
  static var noRecords: String { ru ? "Пока пусто" : "Nothing yet" }
  static var byDay: String { ru ? "По дням" : "By day" }
  static var byTx: String { ru ? "По тратам" : "By expense" }
  static var newBudget: String { ru ? "Новый бюджет" : "New budget" }
  static var last30: String { ru ? "За 30 дней" : "Last 30 days" }
}
