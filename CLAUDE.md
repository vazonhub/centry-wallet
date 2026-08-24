# CLAUDE.md

Контекст для Claude Code (и для разработчиков). Загружается автоматически при работе в этой папке. **Проект пишется агентами — этот файл и `docs/` являются источником истины. Не терять суть проекта: сверяйся с ними перед изменениями.**

## О проекте

**Centry** — личный мультивалютный финансовый трекер для **iOS**, полностью офлайновый, без сервера. Стек: **Expo SDK 54 + React Native 0.81 + TypeScript (strict)**. Архитектура и приёмы унаследованы из соседнего проекта Bsuir Time.

Полный бриф — [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md). **Прочитай его перед первой задачей.**

## Вольт проекта (docs/)

| Документ                               | О чём                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------- |
| [PROJECT_BRIEF](docs/PROJECT_BRIEF.md) | канонический продукт: цель, пользователь, незыблемые правила, скоуп        |
| [ARCHITECTURE](docs/ARCHITECTURE.md)   | иерархия папок, слои MVC+, идиомы из Bsuir, набор зависимостей             |
| [DATA_MODEL](docs/DATA_MODEL.md)       | схема SQLite, миграции, ключи MMKV, снимок виджета, денежный модуль, тесты |
| [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) | Liquid Glass токены (светлая/тёмная), типографика, правила блюра           |
| [UX_SPEC](docs/UX_SPEC.md)             | экраны, ядро ввода, онбординг, стартовые данные, пустые состояния          |
| [BUILD0_PLAN](docs/BUILD0_PLAN.md)     | план из 9 этапов + критерии приёмки                                        |
| [CICD](docs/CICD.md)                   | gitflow, CI, EAS (off до v1.0), env-процесс, версионирование               |
| [DECISIONS](docs/DECISIONS.md)         | реестр решений D1–D30 + B1–B17 (включая правки владельца от 2026-08-19/20) |

Гайды владельца (ручные шаги вне кода): [GUIDE_APPSTORE_NAME](docs/GUIDE_APPSTORE_NAME.md) · [GUIDE_EAS_SETUP](docs/GUIDE_EAS_SETUP.md) · [GUIDE_PRIVACY](docs/GUIDE_PRIVACY.md). Что ждём от владельца — [WHAT_I_NEED_FROM_YOU](WHAT_I_NEED_FROM_YOU.md).

> ⚠️ Правила 3 и 5 уточнены решениями владельца (B6, B11): сеть разрешена **только** для анонимных курсов валют; init-визитка **опциональна и пропускаема**. Ниже — актуальные формулировки.

## Незыблемые правила (нарушение — баг, а не вкусовщина)

1. **Деньги — только целые минорные единицы** (`INTEGER`). Никаких `float`/`double`/`REAL` в деньгах, нигде.
2. **Курс фиксируется на момент транзакции** (`rate_to_base_e6`), хранится с ней. История не переписывается.
3. **Настройка следует за использованием.** Дефолты (счёт, категории) создаются автоматически — приложением можно пользоваться сразу. Init-визитка на первом запуске **опциональна и всегда пропускаема** (см. [UX_SPEC](docs/UX_SPEC.md#онбординг--опциональная-пропускаемая-init-визитка-b11)).
4. **Ввод ≤4 секунды и ≤3 тапа.**
5. **Личные и финансовые данные не покидают телефон.** Единственный разрешённый сетевой запрос — **анонимное получение курсов валют** (наружу уходят только коды валют, никогда суммы/транзакции). Нет бэкенда, нет аналитики поведения, нет запросов за шрифтами. Сеть физически живёт **только** в `src/services/rates/`.
6. **Цвет означает ровно одно:** зелёный — приход, красный — удаление/перерасход. Больше ничего.
7. **Все числа — моноширинным табличным шрифтом** (`tabular-nums`). Деньги форматирует **только** `@utils/money`.
8. **Группировка по дням — по `local_day`**, зафиксированному при записи (не из UTC).
9. **≤5 заблюренных вью на экран.** Списки — без блюра.
10. **Схема готова к синку/совместному режиму** (`updated_at`, `deleted_at`, `author_id`). Удаление — только soft delete.

## Архитектура — MVC+ (строгое разделение)

Data flow: **View → Controller → (DB | Services) → Store → View**.

- `src/db/*` — SQLite, единственный источник истины. **SQL только здесь** (аналог «axios только в api/» из Bsuir). Сети нет — слоя `services/api` не существует.
- `src/stores/*` — Zustand (state + зеркало настроек MMKV).
- `src/controllers/*` — оркестрация db/services → стор. Единственный мост view ↔ данные. Здесь дёргается обновление снимка виджета после каждой мутации.
- `src/views/*` — экраны (читают сторы селекторами, зовут контроллеры, **не трогают SQL**).
- `src/components/*` — переиспользуемый UI без бизнес-логики.
- `src/services/*` — сайд-эффекты без UI: снимок виджета (App Group), локальные уведомления, App Intents, **`rates/`** — единственный сетевой модуль (анонимный fetch курсов из Fawaz currency-api).
- `app/*` — Expo Router 6, route-файлы = тонкие ре-экспорты из `@views/*`.
- `src/theme|utils|hooks|constants|i18n|storage/*` — вспомогательное.

Подробнее и почему так — [ARCHITECTURE](docs/ARCHITECTURE.md).

### Жёсткие правила слоёв

- Никаких SQL-запросов из view — только через контроллеры → `src/db`.
- **Единственная сеть — анонимный fetch курсов в `src/services/rates/`.** Больше ни один модуль в сеть не ходит; наружу не уходят суммы, транзакции, никакие личные данные.
- Деньги форматируются только через `@utils/money`; хранятся/считаются только целыми минорными.
- Не редактировать `ios/` руками — вся нативка через `app.json` + config-плагины (`plugins/withX.js`), Swift-исходники в `targets/`.
- Удаление — только `deleted_at`, никогда `DELETE FROM`.
- Логику «можно сегодня» **не дублировать в Swift** — виджет читает готовый снимок из App Group.

## Import aliases

`@/`, `@db/`, `@models/`, `@views/`, `@controllers/`, `@stores/`, `@components/`, `@services/`, `@theme`, `@utils/`, `@hooks/`, `@constants/`, `@i18n`, `@storage/`.

Источник истины — `tsconfig.json` + `babel.config.js` (`module-resolver`). **Менять оба синхронно.**

## Commands

- `npm run ios` — Metro + iOS-симулятор (нужен dev client, не Expo Go — из-за нативного таб-бара).
- `npm run typecheck` · `npm run lint` / `lint:fix` · `npm run format` / `format:check`.
- `npm test` — jest (`jest-expo`). Денежная арифметика — обязательные тесты (`src/utils/__tests__`).
- `npm run bump:patch|minor|major` — версия (двигает и `ios.buildNumber` через `scripts/bump-build.js`).
- `npm run prebuild` — регенерация `ios/` после правки плагинов/нативных зависимостей.

Pre-commit (husky + lint-staged) гоняет prettier + `eslint --fix` на staged-файлах.

## Git flow и CI/CD

`feature/* → develop → testing → master`. Сейчас активна только CI-проверка (format/lint/types/tests); EAS/release-часть готова, но **включается на v1.0** (нужны Apple-аккаунт + EAS-проект). Только iOS. Детали — [CICD](docs/CICD.md), релиз-чеклист — [RELEASE.md](RELEASE.md).

## Статус

**Стадия: этапы 1–9 написаны (2026-08-21); приложение запускается на симуляторе, вечерний пуш работает, виджет ждёт девайса, Siri отключён (краш, см. этап 8).** 69 тестов зелёные, `npm run typecheck`/`lint` чисты, `expo prebuild --clean` + `pod install` проходят, EAS ad-hoc ставится (`ascAppId 6803400593`).

> Сборочные блокеры виджета устранены (2026-08-21): `import MMKVAppExtension` + `pod 'MMKVAppExtension', :modular_headers => true` в `targets/widget/pods.rb` (под — статичный Obj-C++ без modulemap, без него Swift не видит модуль); `ios.appleTeamId` проведён через `.env` (`APPLE_TEAM_ID`) → `app.config.ts`.

Этап 1: конфиги (Expo SDK 54, aliases, eslint/prettier/jest), `src/db` (SQLite + миграции + репозитории), `src/models`, денежный модуль `@utils/money` (BigInt, half-up away-from-zero), токены `@theme` (Liquid Glass; canvas light `#faf3e4` / dark `#000e49`, B20), `@storage` (MMKV), сид 8+3 категорий и счёта «Основной».

Этап 2 (ядро ввода): сторы `settings`/`data`/`ui` (Zustand + MMKV), **единственный сетевой модуль** `src/services/rates/` (Fawaz, только коды валют, таймаут, оффлайн-фолбэк), контроллеры `data`/`transactions` (единые funnel'ы `addTransaction`/`addTransfer`/`createAccount`), шит ввода `@views/input`: расход/доход/**перевод** (B12, кросс-валютный с редактируемым итогом) + **создание счёта на лету** (D7). Bootstrap не блокируется сетью (иначе был белый экран).

Этап 3 (главная): «можно сегодня» с порогами B9, **carry-over плашка** (B10), чипсы счетов, лента с **группировкой по дням** и итогом дня, **день зарплаты по тапу на цифру** (rule 3), FAB «+».

Навигация: **нативный таб-бар из 3 вкладок** `История · Главная · Настройки` (Главная по центру/дефолтная, B19), «+» — плавающая кнопка на Главной. Каждая вкладка — свой Stack-layout.

Этап 5 (История): переключение месяцев, итоги пришло/ушло/разница, живой поиск по заметке, фильтры (Все/Расходы/Доходы/по счетам), топ-5 «на что ушло» полосами (D19), лента на `@shopify/flash-list` с группировкой по дням, **шит деталей** (D20): курс/сумма в базе, смена категории и заметки, удаление.

Этап 6 (Настройки): счета+балансы и добавление счёта, базовая валюта, день зарплаты, **переключение темы** (`resolvedScheme` в сторе, паттерн Bsuir — `usePalette` читает его, не `useColorScheme`), тумблеры ввода, «удалить все данные» (единственный hard-delete, `wipeAllData`+реseed), «о приложении».

Этап 7 (виджеты): **код готов (2026-08-20), ждёт сборки на устройстве.** TS-снимок «можно сегодня» (`src/services/widget/`, единый расчёт `computeAllowance` — не дублируется в Swift) пишется в App-Group MMKV (`centry.widget`) после каждой мутации (хук в `DataController.loadAll`) + `reloadAllTimelines()`. Нативный таргет — через **`@bacons/apple-targets`** (не самописный плагин): `targets/widget/` (Swift S/M-виджеты, читают снимок из App-Group MMKV через `MMKVAppExtension`) + `expo-target.config.js` + `pods.rb`. Deep link `centry://add` → шит ввода. `expo prebuild` проверен: таргет `by.vazon.centry.widget` генерируется. Подпись таргета — через `APPLE_TEAM_ID` в `.env` (см. блок «Сборочные блокеры» выше).

Этап 8 (Siri + вечерний пуш): **вечерний пуш готов и работает на симуляторе; Siri / App Intents переделан на безопасный канал (2026-08-24, ветка `feature/siri-app-intents`) — ждёт проверки на устройстве.** Пуш — единственный локальный (не сетевой) сервис `src/services/notifications/` (ежедневный `SchedulableTriggerInputTypes.DAILY` в `eveningPushTime`, идемпотентный `syncEveningReminder`, хук в `bootstrap` + тумблер/таймер в «Настройки → Ввод»), тап → `centry://add` → шит ввода (`useNotificationResponse`).

> ✅ **Siri / App Intents — deep-link канал (2026-08-24, заменил MMKV-канал).** Причина прошлого краха: плагин линковал `MMKVAppExtension` вторым потребителем `MMKVCore` в main-таргет (`react-native-mmkv` уже линкует `MMKVCore`) → порча кучи на старте (`nanov2_guard_corruption_detected`). **Новый канал не использует общий стор вообще:** Swift-интенты (`AddExpenseIntent`/`AddIncomeIntent`, iOS 17+) открывают `centry://add?kind=…&amount=…&note=…` через `OpenURLIntent`; JS парсит query (`@utils/deepLink.parseAddDeepLink`) в существующем `useWidgetDeepLink` и открывает шит с prefill. Ничего лишнего не линкуется — краш исключён по построению. Плагин `plugins/withAppIntents/` теперь только инжектит Swift-сорсы (без пода MMKV, **не возвращать под!**), включён в `app.json`. Мёртвый MMKV-канал удалён (`src/services/intents/`, `usePendingIntent`, `INTENT_*` в `mmkv.ts`, `CentryIntentStore.swift`). Floor iOS 17 — из-за `OpenURLIntent` (владелец подтвердил 2026-08-24). JS-часть покрыта тестами (`deepLink.test.ts`); Swift/plugin проверяются только сборкой на устройстве.

Этап 9 (полировка): пустые состояния подтверждены на всех экранах (лента Главной, список Истории, list-экраны настроек деградируют через «＋ Добавить»); убрана мёртвая строка «Синхронизация».

**CSV-экспорт реализован (2026-08-24, ветка `feature/csv-export`):** «Настройки → Данные → Экспорт в CSV» собирает все не-удалённые транзакции в RFC-4180 CSV (BOM для кириллицы в Excel) и открывает системный шит шэринга. Слои: чистый `@utils/csv` (сериализация + сборка строк, юнит-тесты) → `@utils/money.formatMoneyPlain` (десятичная строка с точкой, форматирование денег по-прежнему только тут, правило 7) → `TransactionsRepo.listAllTransactions` → контроллер `export.controller` → сервис `src/services/export/` (запись в cache-dir через `expo-file-system` + `expo-sharing`). **Экспорт инициируется пользователем — правило 5 (ноль автоматической сети) не нарушается:** файл пишется локально, наружу уходит только если пользователь сам выберет получателя в шите. Новые нативные зависимости (`expo-file-system`, `expo-sharing`) требуют `npm run prebuild` + пересборки dev-client.

**Настройки → Данные / О приложении переработаны (2026-08-24, ветка `feature/data-about-screens`):** Данные — секции «Экспорт» (CSV + пояснение) и «Данные» (**«Обновить виджет»** — принудительный `DataController.refreshWidget` → `refreshWidgetSnapshot`; «Удалить все данные»). О приложении — секция «Ссылки» (Telegram `t.me/multibelbet`, GitHub `vazonhub/centry-wallet` через `Linking.openURL` + Ionicons) и версия внизу. Экраны разбиты на секции с заголовками (паттерн Bsuir).

**Планы (в следующих версиях):** импорт CSV (обратно к экспорту); ссылка на политику конфиденциальности в «О приложении» (текст готов — [`docs/GUIDE_PRIVACY.md`](docs/GUIDE_PRIVACY.md), нужен опубликованный URL).

Осталось (владелец): **сборка на устройстве** — `APPLE_TEAM_ID` в `.env` → `npm run prebuild` → Xcode → Run; проверить виджет, вечерний пуш и **Siri** на девайсе (нужен, скорее всего, платный Apple Developer). Siri: сказать «Hey Siri, добавить трату в Centry» (iOS 17+) → приложение открывает шит ввода, заполненный из фразы. Что нужно от владельца — [`WHAT_I_NEED_FROM_YOU.md`](WHAT_I_NEED_FROM_YOU.md).

## Code style (как в Bsuir)

- TS strict + `noUncheckedIndexedAccess` — проверять `arr[i]` на `undefined`.
- Импорты: внешние либы → `@`-алиасы → локальные. `import type` для типов.
- Компоненты функциональные, без `React.FC`; пропсы — отдельный `interface Props`.
- Стили через `StyleSheet.create` в фабрике `makeStyles(Palette)`. Цвета/радиусы/отступы — только токены из `@theme`, без магических чисел.
- Комментарии в коде — по-английски. Документация вольта и UI-строки — по-русски.
