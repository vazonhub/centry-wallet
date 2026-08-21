# Гайд владельца: политика конфиденциальности и App Privacy (пункт 24)

App Store требует две вещи: (1) публичный URL политики конфиденциальности; (2) заполненный «App Privacy» (nutrition label) в App Store Connect. Нужно к v1.0.

## Позиция Centry

- Все финансовые данные хранятся **локально на устройстве** (SQLite + MMKV), не отправляются на сервер.
- Бэкенда нет, аналитики поведения нет, рекламы в Build 0 нет.
- Единственное сетевое обращение — **анонимное получение курсов валют** (Fawaz currency-api): наружу уходят только коды валют, **никакие суммы, транзакции или личные данные не передаются**.

→ В терминах Apple App Privacy это **«Data Not Collected»** (данные не собираются). Запрос курсов не собирает пользовательские данные, так что декларировать сбор не нужно. Если позже добавим iCloud-синк (v1.1) или рекламу — лейбл придётся пересмотреть.

## Шаг 1. Заполнить App Privacy в App Store Connect

My Apps → Centry → **App Privacy** → Get Started:

- «Do you or your third-party partners collect data from this app?» → **No, we do not collect data**.
- Сохранить, Publish.

(Если Apple переспросит про сторонние SDK — их нет; курсовой API не является аналитикой/трекингом.)

## Шаг 2. Опубликовать политику по URL

Нужен публичный URL. Самый простой путь — **GitHub Pages** этого репозитория или отдельный gist. Впиши URL в App Store Connect → **App Information → Privacy Policy URL** (и в App Privacy при запросе).

### Готовый текст политики (RU + EN) — можно публиковать как есть

> Замени `[дата]` и контактный e-mail. Дальше — черновик, юридически достаточный для приложения без сбора данных; при добавлении iCloud/рекламы обновим.

```markdown
# Политика конфиденциальности Centry

_Дата вступления в силу: [дата]_

Centry — офлайновое приложение для учёта личных финансов. Мы уважаем вашу
приватность и построили приложение так, чтобы ваши данные оставались у вас.

## Какие данные мы собираем

Никакие. Centry не собирает, не передаёт и не хранит на серверах ваши
персональные или финансовые данные. Все записи (счета, транзакции, категории,
настройки) хранятся только локально на вашем устройстве.

## Сетевые обращения

Единственное сетевое обращение приложения — получение актуальных курсов валют
из публичного сервиса курсов. При этом передаются только коды валют
(например, USD, BYN, EUR). Ваши суммы, транзакции и любые персональные данные
при этом не передаются.

## Хранение и удаление

Данные хранятся на устройстве. Вы можете удалить все данные в любой момент
через «Настройки → Данные → Удалить все данные», а также удалив приложение.

## Дети

Приложение не предназначено для сбора данных детей и не собирает данные вообще.

## Изменения

При изменении практик обработки данных (например, добавлении облачной
синхронизации) мы обновим эту политику и дату вступления в силу.

## Контакты

По вопросам приватности: [email].

---

# Centry Privacy Policy

_Effective date: [date]_

Centry is an offline personal finance app. We respect your privacy and built
the app so your data stays with you.

## Data we collect

None. Centry does not collect, transmit, or store your personal or financial
data on any server. All records (accounts, transactions, categories, settings)
are stored only locally on your device.

## Network access

The app's only network request fetches current currency exchange rates from a
public rates service. Only currency codes (e.g. USD, BYN, EUR) are sent. Your
amounts, transactions, and any personal data are never transmitted.

## Storage and deletion

Data is stored on your device. You can delete all data at any time via
"Settings → Data → Delete all data", or by deleting the app.

## Children

The app is not intended to collect children's data and does not collect any
data at all.

## Changes

If our data practices change (e.g. adding cloud sync), we will update this
policy and the effective date.

## Contact

Privacy questions: [email].
```

## Что прислать мне

- [ ] URL опубликованной политики;
- [ ] подтверждение, что App Privacy = «Data Not Collected» опубликован.
