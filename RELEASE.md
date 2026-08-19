# RELEASE.md — чеклист релиза (iOS)

Полная модель веток и env — в [`docs/CICD.md`](docs/CICD.md). **Только iOS** (Android вне скоупа). Пайплайн EAS/release включается на **v1.0** — на Build 0 сборка ставится локально через Xcode (`npm run ios`), этот чеклист пока не применяется.

## 0. Одноразовая настройка виджет-таргета (только владелец, перед первым EAS-релизом)

Виджет Centry встроен в основное iOS-приложение (config-плагин `withWidget`), поэтому при EAS-сборке схемы `Centry` он **автоматически попадает в архив** — отдельная EAS-сборка не нужна.

Один раз перед первым релизом с виджетом:

1. **Зарегистрировать App IDs** в Apple Developer (Certificates, IDs & Profiles) с capability **App Groups**:
   - `by.vazon.centry` (основное приложение);
   - `by.vazon.centry.widget` (виджет).
2. **App Group** `group.by.vazon.centry` — добавить к обоим App ID.
3. **Провижининг:** `eas credentials -p ios` (или первый `eas build`) обнаруживает встроенный таргет по пребилду и заводит distribution-профили на каждый bundle id.
4. **App Store Connect:** зарезервировать имя **Centry: деньги и валюты** (D17), создать запись приложения, получить `ascAppId` → вписать в `eas.json` (`submit.*.ios.ascAppId`).

Версия виджета берёт `MARKETING_VERSION` из версии приложения и `CURRENT_PROJECT_VERSION` из `ios.buildNumber` на этапе prebuild.

**Версионирование — `local`** (`eas.json` `appVersionSource: local`, без `autoIncrement`): build-номер живёт в `app.json` (`ios.buildNumber`) и коммитится. Обязательно: виджет — встроенный таргет, и его `CFBundleVersion` обязан совпадать с основным приложением, иначе Apple отклоняет архив («CFBundleVersion of an app extension must match the parent app»). Remote autoIncrement это ломает.

## 1. Подготовка версии (в develop)

```bash
git checkout develop && git pull
npm run bump:patch      # или bump:minor / bump:major — двигает версию и ios.buildNumber
git commit -am "chore: bump version to vX.Y.Z"
git push
```

Пересобираешь ту же версию (hotfix того же `vX.Y.Z`)? Подними только build-номер: `npm run bump:build`.

## 2. PR в testing

- PR `develop → testing`, заголовок **`Release vX.Y.Z`** (версия обязана совпасть с package.json — CI проверит).
- После merge пайплайн соберёт и отправит iOS → TestFlight.

## 3. Тестирование

- iOS: TestFlight. Нашёлся баг → фикс в `develop` → `npm run bump:build` → новый PR `develop → testing` с **той же** marketing-версией.

## 4. PR в master

- PR `testing → master`, заголовок тот же. CI сверит версию и что тега `vX.Y.Z` ещё нет.

## 5. После merge (автоматически)

Workflow «Release»: создаёт тег `vX.Y.Z` и публикует GitHub Release с changelog + ссылкой на App Store. (В отличие от Bsuir — **без APK/Google Play**, Android нет.)

## 6. Публикация в App Store (руками)

App Store Connect: выбери протестированный TestFlight-билд → release notes → Submit for Review.
