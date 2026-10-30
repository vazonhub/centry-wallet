import Foundation

// Language chosen on the phone (drives the watch's own chrome so it matches the
// phone app's RU/EN toggle). Set by WatchModel from each payload; before the first
// sync it falls back to the watch's own locale. English-first fallback.
enum WatchLang {
  static var isRu: Bool = (Locale.current.language.languageCode?.identifier == "ru")

  /// Update from a payload's `language` ("ru" / "en").
  static func apply(_ language: String) { isRu = (language == "ru") }
}

// Watch-only UI chrome strings (the phone already sends the allowance labels in
// its language via the payload; these cover the watch's own titles/labels).
// Follows the phone app's language via WatchLang.
enum L {
  private static var ru: Bool { WatchLang.isRu }

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
  static var byTx: String { ru ? "По транзакциям" : "By transaction" }
  static var newBudget: String { ru ? "Новый бюджет" : "New budget" }
  static var last30: String { ru ? "За 30 дней" : "Last 30 days" }
}
