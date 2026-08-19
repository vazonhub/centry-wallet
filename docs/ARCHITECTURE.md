# Centry — архитектура репозитория

Стек: **Expo SDK 54 (managed + prebuild) + React Native 0.81 + TypeScript (strict)** — тот же, что в Bsuir Time, чтобы переносить приёмы и стилистику. Отличия от Bsuir отмечены явно.

> Это план структуры. Живой код-скелет (package.json, конфиги, папки) создаётся **следующим шагом** после ревью этого вольта. Здесь — целевая форма и обоснования, чтобы скаффолдинг был механическим.

## Ключевое отличие от Bsuir: офлайн + одна узкая сетевая точка

Bsuir — сетевое приложение (axios → `iis.bsuir.by`). **Centry офлайновый**, кроме одной изолированной точки — курсов валют (правило 5, B6). Поэтому:

- **Нет** слоя `src/services/api/`, нет axios, нет общего HTTP-клиента.
- Источник истины — **локальная SQLite** (`src/db/`), а не удалённый API.
- Слой `services/api` заменяется на `src/db/` (репозитории поверх SQLite).
- **Единственная сеть** — `src/services/rates/`: нативный `fetch` к Fawaz currency-api за курсами (наружу только коды валют). Никакой другой модуль в сеть не ходит; никакие суммы/транзакции наружу не уходят.

## Слои (MVC+, строгое разделение — как в Bsuir)

Data flow однонаправленный: **View → Controller → (DB | Services) → Store → View**.

- `src/db/*` — **SQLite: единственный источник истины.** Соединение, миграции, репозитории. Прямые SQL-запросы живут **только здесь** (аналог правила «axios только в api/» из Bsuir).
- `src/stores/*` — Zustand-сторы (in-memory состояние + зеркало настроек из MMKV).
- `src/controllers/*` — оркестрация: `db`/`services` → нормализация → запись в стор. **Единственное место**, где view встречается с db/services. Здесь же дёргаются сайд-эффекты (обновление снимка виджета после каждой мутации).
- `src/views/*` — экраны. Читают сторы через селекторы, вызывают методы контроллеров. **Никогда не трогают SQL напрямую.**
- `src/components/*` — переиспользуемый UI без бизнес-логики (`<Money>`, glass-обёртки, чипсы).
- `src/services/*` — сайд-эффекты без UI: снимок виджета (App Group), локальные уведомления (вечерний пуш), мост к App Intents, `expo-widgetkit-bridge`.
- `src/theme/*`, `src/utils/*`, `src/hooks/*`, `src/constants/*`, `src/i18n/*` — вспомогательный код.
- `app/*` — файловый роутинг Expo Router 6. Каждый route-файл — тонкий ре-экспорт компонента из `@views/*`.

### Жёсткие правила

- Никаких SQL-запросов из view-компонентов — только через контроллеры → `src/db`.
- **Никаких сетевых запросов вообще** (правило 5).
- Деньги форматируются **только** через `@utils/money` (правило 7, [DATA_MODEL](DATA_MODEL.md)).
- Деньги хранятся и считаются **только целыми минорными** (правило 1).
- Никогда не редактировать файлы в `ios/` руками — вся нативная конфигурация через `app.json` + Expo config-плагины.
- Удаление — только soft delete (`deleted_at`), никогда не `DELETE FROM`.
- Бизнес-логику «можно сегодня» **не дублировать в Swift** — виджет читает готовый снимок.

## Целевая иерархия папок

```
centry-wallet/
├── index.ts                      # entry: import 'expo-router/entry' (без Android widget handler — Android вне скоупа)
├── app.config.ts                 # динамический overlay: version из package.json, EAS projectId/owner из .env
├── app.json                      # статическая Expo-конфигурация (iOS, плагины, App Group)
├── babel.config.js               # module-resolver aliases + reanimated (last)
├── tsconfig.json                 # strict + noUncheckedIndexedAccess + path aliases (зеркало babel)
│
├── app/                          # Expo Router — тонкие ре-экспорты
│   ├── _layout.tsx               # RootLayout: провайдеры, bootstrap, тема, StatusBar
│   └── (tabs)/
│       ├── _layout.tsx           # NativeTabs: Главная · История · [+] · Настройки
│       ├── (home)/index.tsx
│       ├── (history)/index.tsx
│       └── (settings)/           # index + подэкраны (счета, деньги, ввод, вид, данные, о приложении)
│
├── src/
│   ├── db/                       # SQLite — источник истины (замена services/api из Bsuir)
│   │   ├── connection.ts         # expo-sqlite, PRAGMA WAL + foreign_keys
│   │   ├── migrations/           # 001_init.sql, 002_*.sql + runner (meta.schema_version)
│   │   ├── accounts.repo.ts
│   │   ├── categories.repo.ts
│   │   ├── transactions.repo.ts
│   │   └── index.ts
│   ├── models/                   # доменные типы: Account, Category, Transaction, enums (kind, currency)
│   ├── stores/                   # Zustand: settings.store.ts (зеркало MMKV), ui/input state
│   ├── controllers/              # addTransaction, createAccount, editTransaction, deleteTransaction … + snapshot side-effects
│   ├── views/                    # экраны, сгруппированы по фиче: home/ history/ input/ accounts/ settings/
│   ├── components/               # Money/Num, GlassCard, GlassButton, AccountChip, CategoryPicker, EmptyState …
│   ├── hooks/                    # usePalette, useAppBootstrap, useNow, useSettings …
│   ├── theme/                    # colors, spacing, radius, typography + index (barrel)
│   ├── utils/                    # money (+ __tests__), date/localDay, uuid, haptics, a11y
│   ├── services/                 # widget/ (snapshot в App Group), notifications/ (вечерний пуш), intents/, rates/ (ЕДИНСТВЕННАЯ сеть — курсы)
│   ├── constants/                # seedCategories, currencies (ISO-4217), thresholds для «можно сегодня»
│   ├── i18n/                     # index (init) + ru.ts (+ en.ts заглушка на v1.0)
│   └── storage/                  # mmkv.ts (инстанс + App-Group инстанс)
│
├── plugins/                      # Expo config-плагины (with*.js)
│   ├── withWidget.js             # iOS WidgetKit extension (bundle by.vazon.centry.widget), App Group
│   ├── withAppIntents.js         # App Intents / Siri Shortcuts wiring (по мере надобности)
│   └── withModularHeaders.js     # если понадобится для Swift-подов
├── targets/                      # нативные исходники (source of truth, копируются в ios/ на prebuild)
│   └── widget/                   # SwiftUI: CentryWidget.swift + expo-target.config.js
├── scripts/                      # bump-build.js (только ios.buildNumber — Android вне скоупа)
├── assets/                       # icon, splash
├── docs/                         # этот вольт
└── .github/                      # CI (см. CICD.md)
```

Отличия от Bsuir по составу: **нет** `services/auditory-api/` (Cloudflare Worker), `modules/watch-bridge`, `targets/watch*`, `targets/unity-banner`, `src/widgets/` (RN Android widget). Всё это — сетевые/Android/watch/ads вещи, которых в Centry нет.

## Naming conventions (как в Bsuir)

Сторы `*.store.ts`, контроллеры `*.controller.ts`, репозитории `*.repo.ts`, миграции `NNN_name.sql`, Expo-плагины `withX.js`, route-группы `(name)`, тесты co-located `__tests__/*.test.ts`, компоненты/вью `PascalCase.tsx`, хуки `useX.ts`, утилы `camelCase.ts`.

## Идиомы, перенесённые из Bsuir Time

Проверенные приёмы, которые берём один-в-один (адаптируя под офлайн-домен):

- **Palette-factory стилизация:** `const styles = useMemo(() => makeStyles(Palette), [Palette])`, `makeStyles = (Palette) => StyleSheet.create({…})`. Полностью реактивная тема без контекста/провайдера.
- **resolved-scheme в сторе** вместо `useColorScheme()` — JS-палитра и нативный `Appearance` переключаются атомарно, без мигания (см. [DESIGN_SYSTEM](DESIGN_SYSTEM.md#реализация-тем-паттерн-bsuir)).
- **`waitForHydration()`** — промис поверх `persist.onFinishHydration`, чтобы bootstrap ждал регидрацию стора.
- **Factory-селекторы** рядом со стором (`selectAccountBalance(id)`), с общими стабильными пустыми константами для референсной стабильности.
- **`useNow(intervalMs)`** — тикающие часы, рефрешатся на `AppState → active` (для «дни до зарплаты», «потрачено сегодня»).
- **`useAppBootstrap()`** — единый хук жизненного цикла: миграции БД → регидрация → первичная загрузка → дебаунс-рефреш на foreground.
- **Alias-барели + двойной источник истины** aliases: `tsconfig.json` + `babel.config.js` (менять синхронно).
- **Config-plugin native pattern:** Swift-исходники в `targets/` (source of truth, т.к. `ios/` в gitignore), проводка pbxproj — руками в `plugins/withX.js`; идемпотентная защита `if (proj.pbxTargetByName(...)) return`. Порядок плагинов — load-bearing.
- **Env-optional config** через `app.config.ts` (см. [CICD](CICD.md#env-процесс)).
- **Co-located jest-тесты** (`jest-expo`), coverage с `src/utils/**` (деньги — обязательны).
- **Семантические haptics** (`hapticLight/Medium/Success`) и spread-хелперы a11y (`buildLabel`, `buttonA11y`).

## Целевой набор зависимостей (Build 0)

Финализируется на этапе скаффолдинга; здесь — обоснованный состав. **Убрано всё сетевое/ads/watch/cloud/Android.**

**Оставить из Bsuir:** `expo`, `expo-router`, `expo-dev-client`, `expo-constants`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `expo-font`, `expo-haptics`, `expo-blur`, `expo-linear-gradient`, `expo-build-properties`, `expo-notifications` (вечерний пуш), `expo-linking`, `react`, `react-native`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `react-native-safe-area-context`, `react-native-screens`, `@gorhom/bottom-sheet` (шиты ввода/деталей), `@shopify/flash-list` (история 500+ строк), `zustand`, `i18next`, `react-i18next`, `date-fns`, `@react-native-community/datetimepicker` (дата под «…»), `@react-native-segmented-control/segmented-control` (расход/доход/перевод).

**Добавить:** `expo-sqlite` (источник истины), `react-native-mmkv` (настройки + снимок виджета, App Group), `expo-widgetkit-bridge` (`WidgetCenter.reloadAllTimelines()`).

**Курсы валют:** без axios — нативный `fetch` в `src/services/rates/` к Fawaz currency-api (одна конечная точка, без ключа). Общего HTTP-клиента не заводим.

**Убрать (было в Bsuir):** `axios` (общего HTTP-клиента нет; курсы — через `fetch`), `@react-native-async-storage/async-storage` (замена — MMKV), Unity Ads, `@react-native-google-signin`, `expo-icloud-kv`, `react-native-iap`, `react-native-android-widget`, `react-native-shared-group-preferences`, `expo-background-fetch`/`expo-task-manager` (фоновые задачи не нужны в Build 0), `expo-alternate-app-icons` (mono-тема — future rewarded), `expo-store-review` (оценка — v1.0).

**Dev (как в Bsuir):** eslint (flat config) + prettier + `@typescript-eslint`, `eslint-plugin-react/-hooks/-native`, `husky` + `lint-staged`, `jest` + `jest-expo`, `typescript`, `babel-plugin-module-resolver`, `patch-package` (если понадобится).

## Конфиги (наследуются из Bsuir, правки под Centry)

Берутся без изменений (стилистика портфеля): `.prettierrc`, `.prettierignore`, `.npmrc` (`legacy-peer-deps=true`), `tsconfig.json` (правка: alias `@db` вместо `@services/api`; убрать `@navigation` если не используется; `exclude` без `services/auditory-api`), `babel.config.js` (те же aliases, синхронно с tsconfig), `jest.config.js` (`collectCoverageFrom: src/utils/**` — деньги), `jest.setup.js` (мок MMKV вместо AsyncStorage), `eslint.config.js` (без allow-list сетевых/ads-модулей), `.gitignore` (тот же; `/ios`, `/android`, `.env` игнорятся).

`package.json`: `name: "centry"`, `version: "0.1.0"`, repo `vazonhub/centry-wallet`, скрипты как в Bsuir минус android/watch/eas-android (Android вне скоупа), `ios` scheme `Centry`.

`app.json` / `app.config.ts` / `eas.json` / CI — в [CICD](CICD.md).
