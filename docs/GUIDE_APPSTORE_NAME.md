# Гайд владельца: резервация имени в App Store Connect (пункт 22, D17)

> ✅ **Сделано (2026-08-20).** Имя выбрано — просто **`Centry`** (без дескриптора, решение B16). Запись создана, `ascAppId = 6803400593`, App Group `group.by.vazon.centry` привязан к `by.vazon.centry` и `by.vazon.centry.widget` (B17). `ascAppId` вписан в `eas.json`. Гайд ниже оставлен для истории/воспроизведения.

Цель — застолбить имя **Centry** до v1.0. Делается один раз. Нужен активный Apple Developer Program (у тебя есть).

> Имя приложения в App Store ≤ 30 символов. «Centry» = 6 символов — ок.

## Шаг 0. Зарегистрировать App ID и App Group (Certificates, IDs & Profiles)

developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**:

1. **+** → App IDs → App → Continue.
   - Description: `Centry`.
   - Bundle ID: **Explicit** → `by.vazon.centry`.
   - Capabilities: включить **App Groups**.
   - Register.
2. Повторить для виджета: Bundle ID `by.vazon.centry.widget`, тоже с **App Groups**.
3. Identifiers → тип **App Groups** → **+** → создать `group.by.vazon.centry`.
4. Вернуться в оба App ID (`by.vazon.centry` и `.widget`) → App Groups → Edit → отметить `group.by.vazon.centry` → Save.

## Шаг 1. Создать запись приложения (App Store Connect)

appstoreconnect.apple.com → **My Apps** → **+** → **New App**:

- Platforms: **iOS**.
- Name: **`Centry`**.
- Primary Language: **Russian**.
- Bundle ID: выбрать `by.vazon.centry` (появится из шага 0).
- SKU: любой уникальный, например `centry-ios-001`.
- User Access: Full.
- **Create.**

## Шаг 2. Забрать `ascAppId`

Открой созданное приложение → **App Information** (или General) → «Apple ID» — это число (например `6712345678`). Это `ascAppId`.

→ Пришли его мне: впишу в `eas.json` (`submit.*.ios.ascAppId`) на v1.0. Пока можно просто сохранить.

## Шаг 3. (важно) Удержание имени

Создание записи резервирует имя. Но Apple может освободить имя, если долго нет активности. **Чтобы держать имя надёжно — загрузи хотя бы один build в TestFlight** (это делаем на этапе включения EAS, см. [GUIDE_EAS_SETUP](GUIDE_EAS_SETUP.md)). До этого имя зарезервировано, но не «железно».

## Что прислать мне после гайда

- [x] `ascAppId` — **6803400593** (вписан в `eas.json`);
- [x] App Group `group.by.vazon.centry` привязан к обоим App ID (`by.vazon.centry`, `by.vazon.centry.widget`).
