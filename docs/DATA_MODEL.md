# Centry — модель данных

Правила деньги/курс/дата — незыблемы (см. [PROJECT_BRIEF §3, §7](PROJECT_BRIEF.md#3-незыблемые-правила)). Этот документ — их техническое воплощение.

## Разделение ответственности

| Что                          | Где                                          | Почему                    |
| ---------------------------- | -------------------------------------------- | ------------------------- |
| Транзакции, счета, категории | **SQLite** (`expo-sqlite`)                   | источник истины           |
| Настройки                    | **MMKV** (`react-native-mmkv`)               | быстрый key-value         |
| Снимок для виджета           | **MMKV в App Group** `group.by.vazon.centry` | доступен из Swift-виджета |

MMKV хранит только настройки и производные значения, пересчитываемые из SQLite. **Потеря MMKV не теряет данные.**

## Схема SQLite

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                        -- 'schema_version' → '1'
);

CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  currency      TEXT NOT NULL,               -- ISO-4217: BYN, USD, EUR
  kind          TEXT NOT NULL,               -- card | cash | wallet
  icon          TEXT,
  opening_minor INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  archived_at   INTEGER
);

CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL,
  color      TEXT NOT NULL,
  kind       TEXT NOT NULL,                  -- expense | income
  is_system  INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE transactions (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES accounts(id),
  category_id      TEXT REFERENCES categories(id),
  kind             TEXT NOT NULL,            -- expense | income | transfer
  amount_minor     INTEGER NOT NULL,         -- расход отрицательный
  currency         TEXT NOT NULL,
  rate_to_base_e6  INTEGER NOT NULL,         -- курс × 1 000 000, снимок на момент записи
  note             TEXT,
  occurred_at      INTEGER NOT NULL,         -- epoch-секунды UTC
  local_day        TEXT NOT NULL,            -- 'YYYY-MM-DD' по локальной зоне на момент записи
  transfer_pair_id TEXT,
  author_id        TEXT NOT NULL DEFAULT 'me',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER
);

CREATE INDEX idx_tx_day      ON transactions(local_day DESC);
CREATE INDEX idx_tx_account  ON transactions(account_id);
CREATE INDEX idx_tx_category ON transactions(category_id);
```

### Почему именно так

- `amount_minor INTEGER` — деньги целыми (правило 1). Расход отрицательный, доход положительный.
- `rate_to_base_e6 INTEGER` — курс тоже целым, умноженным на миллион. `REAL` для курса — та же плавающая точка через чёрный ход.
- `local_day` рядом с `occurred_at` — иначе трата в 00:30 уезжает во вчера при смене таймзоны, и «потрачено сегодня» врёт.
- `updated_at` / `deleted_at` / `author_id` — задел под синк и совместный режим. **Soft delete везде:** удаление проставляет `deleted_at`, а не удаляет строку.
- `id TEXT` — UUID (генерируем в TS), чтобы схема была готова к слиянию с других устройств без коллизий автоинкремента.

## Ключевые запросы

```sql
-- баланс счёта
SELECT a.opening_minor + COALESCE(SUM(t.amount_minor),0) AS balance_minor
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
WHERE a.id = ? GROUP BY a.id;

-- итоги месяца
SELECT
  SUM(CASE WHEN amount_minor > 0 THEN  amount_minor * rate_to_base_e6 / 1000000 ELSE 0 END) AS income,
  SUM(CASE WHEN amount_minor < 0 THEN -amount_minor * rate_to_base_e6 / 1000000 ELSE 0 END) AS outcome
FROM transactions
WHERE deleted_at IS NULL AND local_day LIKE ? || '%';     -- '2026-08'

-- разбивка по категориям, топ-5
SELECT category_id, SUM(-amount_minor * rate_to_base_e6 / 1000000) AS total
FROM transactions
WHERE deleted_at IS NULL AND amount_minor < 0 AND local_day LIKE ? || '%'
GROUP BY category_id ORDER BY total DESC LIMIT 5;
```

> ⚠️ Округление в SQL (`* rate / 1000000`) — усечение (floor к нулю). Для итогов месяца и агрегатов на экране это допустимо, но **канон округления (half-up) живёт в TS-модуле денег** и применяется к каждой отдельной транзакции при записи и при точных пересчётах. Не полагаться на SQL-деление там, где важен точный half-up на уровне записи.

## MMKV — ключи настроек

```
base_currency        'BYN'          // автоопределяется по региону при первом входе, меняется в настройках (B8)
payday_day           1
theme                'system' | 'light' | 'dark'
input_widget         true
input_siri           true
input_evening_push   true
evening_push_time    '22:00'
hide_amounts         false
schema_version       1

// Курсы валют (B6/B13): универсальная мультивалюта, авто-подтягивание из Fawaz currency-api
rates_cache_json     '{"USD":3270000,"EUR":3560000,...}'  // к базовой валюте, ×1e6, последний фетч
rates_synced_at      1786000000     // epoch-сек последнего успешного обновления
rates_manual_json    '{"USD":3300000}'                     // ручные переопределения, приоритетнее кэша
```

> Курсы в MMKV — это **кэш для подстановки в новые записи** и для конвертации балансов на экранах. Он производный: потеря MMKV не теряет данные (курс каждой прошлой транзакции уже вморожен в её `rate_to_base_e6` в SQLite). Ручное переопределение (`rates_manual_json`) имеет приоритет над авто-кэшем при подстановке в новую транзакцию.

## Снимок для виджета

Пишется в MMKV в App Group **после каждой мутации данных**, затем вызывается `WidgetCenter.reloadAllTimelines()` (через `expo-widgetkit-bridge`).

```json
{
  "perDayMinor": 5634,
  "currency": "BYN",
  "daysLeft": 13,
  "todaySpentMinor": 1820,
  "accounts": [{ "name": "Карта BYN", "balanceMinor": 34020, "currency": "BYN" }],
  "recent": [{ "icon": "🍔", "note": "Обед", "amountMinor": -1200, "currency": "BYN" }],
  "updatedAt": 1786000000
}
```

**Виджет никогда не открывает SQLite.** Иначе логику «можно сегодня» пришлось бы держать и на TypeScript, и на Swift — они разъедутся. Свифт читает готовый снимок из App-Group MMKV/UserDefaults и рендерит.

## Миграции

Версия в `meta.schema_version`. При старте: прочитать версию → прогнать миграции по возрастанию → записать новую. Каждая миграция — отдельный файл `001_init.sql`, `002_*.sql`. **Механизм заводится сразу, на версии 1** (даже если миграция одна — фундамент для будущего).

## Денежный модуль (TS, граница вычислений)

Единственное место, где деньги превращаются в строки и где живёт округление. Ориентировочный API (финализируется на этапе 1):

```ts
// @utils/money
convertToBase(amountMinor: number, rateToBaseE6: number): number  // half-up
formatMoney(minor: number, currency: string, opts?): string        // единственный форматтер
sumMixed(items: {amountMinor:number; rateToBaseE6:number}[]): number
perDay(totalBaseMinor: number, daysLeft: number): number
accountBalance(openingMinor: number, txAmountsMinor: number[]): number
localDay(occurredAtSec: number, tzOffsetMin: number): string       // 'YYYY-MM-DD'
```

### Тесты денежной арифметики

Обязательный минимум (jest, co-located в `__tests__`):

- [ ] конвертация minor → base по `rate_to_base_e6` (несколько курсов);
- [ ] округление half-up на граничных значениях (`.5` вверх, отрицательные суммы);
- [ ] суммирование смешанных валют в базовую;
- [ ] расчёт «можно сегодня» = сумма балансов в базе ÷ дни до зарплаты (в т.ч. `daysLeft = 1`, деление с остатком);
- [ ] баланс счёта = `opening_minor` + сумма транзакций (с soft-deleted исключёнными);
- [ ] **граница дня при смене таймзоны:** трата в 00:30 по локали остаётся в своём `local_day`, не уезжает в UTC-вчера;
- [ ] отсутствие float на всех промежуточных шагах (числа целые);
- [ ] carry-over: профицит/дефицит считается верно на границах периода (первый/последний день, `daysLeft = 1`);
- [ ] универсальная валюта: конвертация работает для произвольной пары через базовую (треугольник A→base→B).

## Курсы валют — источник и модуль (B6 / B13)

- **Сервис:** Fawaz currency-api (бесплатный, без ключа, ~200 валют вкл. BYN и крипту; CDN jsDelivr/Cloudflare). Any→any через базовую валюту.
- **Изоляция:** единственный сетевой модуль — `src/services/rates/`. Наружу уходят **только коды валют**, никогда суммы/транзакции (правило 5).
- **Частота:** авто-обновление раз в день при входе; результат в `rates_cache_json` + `rates_synced_at`. Оффлайн/ошибка сети — тихо используем последний кэш (или ручной курс), приложение работает без сети.
- **Приоритет при подстановке в новую запись:** `rates_manual_json` (ручное) → `rates_cache_json` (авто) → предложить ввести вручную, если валюты нет.
- **Инвариант:** курс, действующий на момент записи, **вмораживается** в `transactions.rate_to_base_e6`. Обновление кэша **никогда** не трогает прошлые записи (правило 2).

## Carry-over — накопленный профицит/дефицит (B10)

Плашка рядом с главной цифрой показывает суммарный «+/−» за текущий период (от прошлой зарплаты до следующей):

- **профицит** (недотратил) → зелёная `+N` → сегодня можно потратить больше;
- **дефицит** (перетратил) → красная `−N` → суммарный перебор.

Считается из транзакций (без изменения схемы), по `local_day` в диапазоне периода. Точная формула дневного лимита финализируется на этапе 3; зафиксированный **интент владельца**: сравнить накопленный лимит за прошедшие дни периода с фактически потраченным (в базовой валюте), разницу показать плашкой. Рекомендуемая простая модель к обсуждению: фиксированный дневной лимит `L = баланс_на_начало_периода_base / дней_в_периоде`; `delta = L × прошедших_дней − потрачено_за_прошедшие_дни`; «можно сегодня» = `L + delta`.
