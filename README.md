# Centry

**Личный мультивалютный финансовый трекер для iOS. Офлайн, без сервера, ввод за 4 секунды.**

> Трекер для тех, у кого деньги в разных валютах и частично наличными. Работает офлайн, ввод — четыре секунды, настраивать ничего не надо.

Второе приложение портфеля Vazon (после [Bsuir Time](../bsuir-schedule)). Стек и приёмы унаследованы: **Expo SDK 54 + React Native 0.81 + TypeScript (strict)**, строгий MVC, Liquid Glass дизайн-система, виджеты через WidgetKit + App Intents.

## Статус

🏗 **Бутстрап / Build 0.** Документация-вольт готова, код-скелет — следующим шагом. Build 0 — личная сборка (ставится через Xcode), не публичный релиз.

## Документация (вольт проекта)

Начни с [`CLAUDE.md`](CLAUDE.md) — он ведёт по всему вольту в `docs/`:
[Бриф](docs/PROJECT_BRIEF.md) · [Архитектура](docs/ARCHITECTURE.md) · [Модель данных](docs/DATA_MODEL.md) · [Дизайн-система](docs/DESIGN_SYSTEM.md) · [UX](docs/UX_SPEC.md) · [План Build 0](docs/BUILD0_PLAN.md) · [CI/CD](docs/CICD.md) · [Решения](docs/DECISIONS.md).

Что нужно от владельца для продолжения — [`WHAT_I_NEED_FROM_YOU.md`](WHAT_I_NEED_FROM_YOU.md).

## Getting started (после создания код-скелета)

```bash
npm install
cp .env.example .env    # опционально; для локального Build 0 не нужен
npm run ios             # Mac + Xcode: ставит dev client + Metro (не Expo Go)
```

## Незыблемые правила

Деньги — только целые минорные единицы · курс фиксируется на момент транзакции · ноль сети · ноль настроечных экранов до первой траты · ввод ≤4 сек. Полный список — [`CLAUDE.md`](CLAUDE.md#незыблемые-правила-нарушение--баг-а-не-вкусовщина).

## Платформы

Только **iOS** (Build 0). Android вне скоупа. Минимальная цель iOS — уточняется (15.1+ как в Bsuir; Liquid Glass iOS 26+ с graceful fallback).
