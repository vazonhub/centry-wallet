# Гайд владельца: настройка EAS / Expo (пункт 23)

EAS нужен для облачных сборок и TestFlight. **На Build 0 не обязателен** — сборку ставим локально через Xcode (`npm run ios`). Этот гайд выполняется, когда переходим к v1.0 (или раньше, если захочешь TestFlight). После него я включу EAS-workflow в CI.

## Предпосылки

- Аккаунт Expo (expo.dev) — если нет, зарегистрируй.
- Node 22 + этот репозиторий склонирован, `npm install` выполнен.

## Шаг 1. Установить и залогиниться

```bash
npm i -g eas-cli      # или пользоваться npx eas-cli
eas login             # логин в аккаунт Expo
```

## Шаг 2. Инициализировать проект

Из корня репозитория:

```bash
eas init
```

Команда создаст EAS-проект и напечатает **`projectId`** и **owner** (твой аккаунт/организация). Запиши оба.

## Шаг 3. Прописать значения

1. Локально — в `.env` (не коммитится):
   ```
   EXPO_OWNER=<owner из eas init>
   EAS_PROJECT_ID=<projectId из eas init>
   ```
2. В EAS (для облачных билдов, т.к. `.env` не в гите): expo.dev → проект → **Environment Variables** → добавить `EXPO_OWNER`, `EAS_PROJECT_ID` (и позже — что понадобится).

## Шаг 4. iOS-подпись

```bash
eas build --platform ios --profile development
```

Первый билд заведёт distribution/provisioning-профили. EAS обнаружит встроенный виджет-таргет по пребилду и заведёт профиль и на `by.vazon.centry.widget`. Дай EAS создать/обновить профили. Убедись, что App Group `group.by.vazon.centry` привязан к обоим App ID (см. [GUIDE_APPSTORE_NAME](GUIDE_APPSTORE_NAME.md), шаг 0).

## Шаг 5. Токен для GitHub Actions

Чтобы CI мог собирать через EAS:

1. expo.dev → Account → **Access Tokens** → создать токен.
2. GitHub → репозиторий `vazonhub/centry-wallet` → Settings → Secrets and variables → **Actions** → New repository secret:
   - `EXPO_TOKEN` = созданный токен;
   - `EAS_PROJECT_ID`, `EXPO_OWNER` = значения из шага 2.

## Шаг 6. `ascAppId` в submit-профиль

Когда будет `ascAppId` (из [GUIDE_APPSTORE_NAME](GUIDE_APPSTORE_NAME.md)) — пришли мне, я впишу в `eas.json`:

```json
"submit": { "testing": { "ios": { "ascAppId": "<число>" } }, "production": { "ios": { "ascAppId": "<число>" } } }
```

## После гайда — что делаю я

Добавляю в `.github/workflows/` два workflow из [CICD](CICD.md) (`eas-testing.yml`, `release.yml`, iOS-only) и включаю пайплайн `develop → testing → master`.

## Что прислать мне

- [ ] `EAS_PROJECT_ID` и `EXPO_OWNER`;
- [ ] подтверждение, что секреты в GitHub добавлены;
- [ ] `ascAppId` (когда будет).
