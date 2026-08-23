# Centry — CI/CD, окружение и версионирование

Модель наследуется из Bsuir Time. Отличия: **только iOS** (Android вне скоупа), **EAS/release-часть выключена до v1.0** (нет Apple-аккаунта и EAS-проекта на этапе Build 0). Ветки и документация заводятся сразу — чтобы на v1.0 включение было переключателем, а не переписыванием.

## Git flow

```
feature/*  fix/*   →   develop   →   testing   →   master
```

- **`develop`** — дефолтная ветка, вся разработка. Фича-ветки `feature/*`, `fix/*` ответвляются от неё, PR обратно в неё.
- **`testing`** — PR `develop → testing` с заголовком `Release vX.Y.Z` (CI сверяет версию с package.json). После merge (**с v1.0**) — автоматический EAS build + submit в TestFlight.
- **`master`** — только релизы. PR `testing → master` с тем же заголовком. После merge (**с v1.0**) — git-тег + GitHub Release.

> На Build 0 разработка может идти прямо в `develop`/`master` без TestFlight — сборка ставится локально через Xcode (`npm run ios`). Ветки `testing`/`master` и их пайплайны активируются на v1.0.

## CI — активна сейчас (`.github/workflows/ci.yml`)

На каждый push/PR в `develop|testing|master`: **prettier → eslint (`--max-warnings 0`) → tsc → jest (`--ci`)**. Плюс job `version-check` на PR в `testing`/`master` (заголовок PR = версия package.json; для `master` — тег ещё не существует).

Целевой `ci.yml` (адаптирован из Bsuir, без изменений по сути):

```yaml
name: CI
on:
  push:
    branches: [develop, testing, master]
  pull_request:
    types: [opened, edited, synchronize, reopened]
    branches: [develop, testing, master]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
jobs:
  checks:
    name: Format / Lint / Types / Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint -- --max-warnings 0
      - run: npm run typecheck
      - run: npm test -- --ci
  version-check:
    name: Version matches PR title
    if: github.event_name == 'pull_request' && contains(fromJSON('["testing", "master"]'), github.base_ref)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - name: Compare PR title version with package.json
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}
        run: |
          PKG_VERSION=$(node -p "require('./package.json').version")
          TITLE_VERSION=$(printf '%s' "$PR_TITLE" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 | sed 's/^v//' || true)
          [ -n "$TITLE_VERSION" ] || { echo "::error::В заголовке PR нет версии vX.Y.Z"; exit 1; }
          [ "$TITLE_VERSION" = "$PKG_VERSION" ] || { echo "::error::Версия PR (v$TITLE_VERSION) ≠ package.json (v$PKG_VERSION)"; exit 1; }
          echo "OK: v$PKG_VERSION"
```

Также заводим (как в Bsuir): `.github/dependabot.yml` (npm + github-actions, weekly, **major `expo` игнорить** — двигается руками со всей семьёй expo-*), `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/`.

## EAS / release — готово, но выключено до v1.0

Файлы `eas.json`, `.github/workflows/eas-testing.yml`, `.github/workflows/release.yml` кладём в репозиторий (форма — из Bsuir), но:

- **iOS-only** (никакого Android APK / Google Play — в отличие от Bsuir).
- Активируются, когда появятся: Apple Developer аккаунт, `ascAppId` (после резервации имени в App Store Connect, D17), EAS-проект (`eas init` → `EAS_PROJECT_ID`, `EXPO_OWNER`), секрет `EXPO_TOKEN` в GitHub.

Целевой `eas.json` (iOS):

```json
{
  "cli": { "version": ">= 16.28.0", "appVersionSource": "local" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "testing": { "environment": "production", "ios": { "image": "macos-tahoe-26.5-xcode-26.6" } },
    "production": { "environment": "production", "ios": { "image": "macos-tahoe-26.5-xcode-26.6" } }
  },
  "submit": {
    "testing": { "ios": { "ascAppId": "<ЗАПОЛНИТЬ на v1.0>" } },
    "production": { "ios": { "ascAppId": "<ЗАПОЛНИТЬ на v1.0>" } }
  }
}
```

`appVersionSource: "local"` + `scripts/bump-build.js` — build-номер живёт в `app.json` и коммитится. Для Centry критично так же, как в Bsuir: **виджет — встроенный iOS-таргет, и его `CFBundleVersion` обязан совпадать с основным приложением**, иначе Apple отклоняет архив. Remote autoIncrement это ломает. `bump-build.js` двигает только `ios.buildNumber` (Android нет).

## Env-процесс

Идиома Bsuir: **owner-специфичные и секретные значения не коммитятся** — приходят из `.env` через `app.config.ts` (динамический overlay над `app.json`). Каждая переменная опциональна; связанная фича молча выключается при пустом значении, так что форк собирается без `.env`.

`EXPO_PUBLIC_*` инлайнятся в JS-бандл Metro на этапе билда; не-public (`EXPO_OWNER`, `EAS_PROJECT_ID`) читаются `app.config.ts` при eval конфига. Для облачных билдов те же значения кладутся в EAS Environment Variables (т.к. `.env` не в гите).

Целевой `.env.example` для Centry (**минимальный — сети нет**):

```bash
# EAS (cloud builds, нужно только с v1.0). `eas init` печатает оба.
EXPO_OWNER=
EAS_PROJECT_ID=
```

### Про «баннеры»

В Bsuir слова «banner» относятся исключительно к **рекламным баннерам Unity Ads** — там **нет** dev/staging/prod-индикатора окружения. В Centry рекламы в Build 0 нет вообще, окружения одно (offline). Если позже захотим визуальный индикатор сборки (dev/prod) — заводим отдельно, например по `__DEV__` или новой `EXPO_PUBLIC_ENV`. Сейчас баннеров/индикаторов не делаем.

## `app.json` — целевые значения (iOS)

- `name: "Centry"`, `slug: "centry-wallet"`, `scheme: "centry"`, `orientation: portrait`, `newArchEnabled: true`, `userInterfaceStyle: automatic`.
- **iOS:** `bundleIdentifier: "by.vazon.centry"`, `buildNumber: "1"`, `infoPlist.ITSAppUsesNonExemptEncryption: false`, `CFBundleLocalizations: [ru, en]`. **Entitlements:** App Group `group.by.vazon.centry`.
- **Плагины (порядок load-bearing):** `expo-router`, `./plugins/withWidget`, `expo-notifications`, `expo-splash-screen`, `expo-build-properties` (iOS `deploymentTarget` — уточнить, iOS 15.1+ как в Bsuir или выше ради iOS 26 Liquid Glass с graceful fallback), `react-native-mmkv` (App Group), + `./plugins/withAppIntents` по мере готовности.
- **`extra.eas.build.experimental.ios.appExtensions`** — для виджета `CentryWidget` → `by.vazon.centry.widget`, App Group `group.by.vazon.centry` (заполняется когда виджет собирается через EAS).
- Android-секции **нет** (вне скоупа).

## Версионирование

`npm run bump:patch|minor|major` двигают marketing-версию (package.json) и `ios.buildNumber` (`scripts/bump-build.js`). Build 0 — линия `0.x`. Первая публичная — `1.0.0`.

## Changelog

Ведём [`CHANGELOG.md`](../CHANGELOG.md) (формат Keep a Changelog). По ходу работы дописывайте изменения в раздел **`## [Unreleased]`** (подзаголовки `### Добавлено / Изменено / Исправлено`).

При бампе версии цепочка `bump:*` вызывает `scripts/changelog-release.js`, который **переносит** содержимое Unreleased в новую секцию `## [<version>] - <YYYY-MM-DD>` и оставляет пустой Unreleased. Скрипт идемпотентен (повторный `bump:build` без смены версии ничего не трогает) и не создаёт пустых секций. Порядок в `bump:patch`: `npm version` → `bump:build` → `changelog:release` (версия к моменту переноса уже в package.json).
