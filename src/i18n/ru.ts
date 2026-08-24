/**
 * Russian strings — the source of truth for the translation keys. `en.ts` is
 * typed as `typeof ru`, so a missing English key is a compile error.
 *
 * UI copy stays in these files (docs/CLAUDE.md: UI strings localised). Money is
 * still formatted only by `@utils/money`; dates by `@utils/date`.
 */
export const ru = {
  common: {
    cancel: 'Отмена',
    delete: 'Удалить',
    save: 'Сохранить',
    done: 'Готово',
    add: 'Добавить',
    ok: 'Понятно',
    back: 'Назад',
  },
  tabs: {
    history: 'История',
    home: 'Главная',
    settings: 'Настройки',
  },
  settings: {
    title: 'Настройки',
    theme: 'ТЕМА',
    themeSystem: 'Системная',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    language: 'ЯЗЫК',
    languageRu: 'Русский',
    languageEn: 'English',
    navAccounts: 'Счета',
    navMoney: 'Деньги',
    navCategories: 'Категории',
    navInput: 'Ввод',
    navData: 'Данные',
    navAbout: 'О приложении',
  },
  money: {
    title: 'Деньги',
    baseCurrency: 'БАЗОВАЯ ВАЛЮТА',
    budgetPlan: 'ПЛАН БЮДЖЕТА',
    hint: '«Можно сегодня» = план ÷ дни периода (календарная неделя или месяц). Это отдельный бюджет — приходы и расходы его не меняют.',
  },
  data: {
    title: 'Данные',
    exportSection: 'ЭКСПОРТ',
    exportCsv: 'Экспорт в CSV',
    share: 'Поделиться',
    exportHint:
      'Выгружает все записи в CSV-файл (открывается в Excel или Google Таблицах) и показывает меню «Поделиться». Импорт добавим позже.',
    dataSection: 'ДАННЫЕ',
    refreshWidget: 'Обновить виджет',
    refresh: 'Обновить',
    refreshed: 'Обновлено ✓',
    refreshHint:
      'Виджет обновляется сам после каждой записи. Нажмите, если iOS ещё не перерисовал его.',
    deleteAll: 'Удалить все данные',
    deleteAllTitle: 'Удалить все данные?',
    deleteAllBody: 'Счета, категории и записи будут стёрты. Отменить нельзя.',
    deleteAllConfirm: 'Удалить всё',
    exportEmptyTitle: 'Нечего экспортировать',
    exportEmptyBody: 'Пока нет ни одной записи.',
    exportUnavailableTitle: 'Экспорт недоступен',
    exportUnavailableBody: 'Поделиться файлом на этом устройстве нельзя.',
    exportFailedTitle: 'Не удалось экспортировать',
    exportFailedBody: 'Попробуйте ещё раз.',
  },
  about: {
    title: 'О приложении',
    links: 'ССЫЛКИ',
    appInfo: 'О ПРИЛОЖЕНИИ',
    version: 'Версия',
    footnote:
      'Centry — офлайновый трекер. Данные не покидают телефон. Единственный сетевой запрос — анонимные курсы валют (наружу уходят только коды валют).',
  },
  inputSettings: {
    title: 'Ввод',
    siriSection: 'SIRI И КОМАНДЫ',
    siriToggle: 'Добавлять голосом',
    siriHint:
      '«Привет, Siri, добавить трату в Centry» — откроется ввод, заполненный из фразы. Работает на устройстве (iOS 18+). Выключено — Siri открывает пустой ввод.',
    reminderSection: 'НАПОМИНАНИЕ',
    reminderToggle: 'Вечернее напоминание',
    reminderTimeLabel: 'Время',
    reminderHint: 'Локальное напоминание записать траты за день. Ничего не отправляется в сеть.',
    reminderTitle: 'Время напоминания',
  },
};

export type Translations = typeof ru;
