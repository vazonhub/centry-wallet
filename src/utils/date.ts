import { localDay } from './money';

/**
 * Impure date helpers (they read the wall clock / device timezone). The pure,
 * testable calendar math lives in `@utils/money` (`localDay`).
 */

/** Current instant in epoch seconds (UTC). */
export const nowSec = (): number => Math.floor(Date.now() / 1000);

/**
 * Device timezone offset in minutes EAST of UTC (Minsk UTC+3 → +180).
 * `Date.getTimezoneOffset()` returns the opposite sign, so we negate it.
 */
export const currentTzOffsetMin = (): number => -new Date().getTimezoneOffset();

/** Today's local day 'YYYY-MM-DD', captured from the device clock/timezone. */
export const todayLocalDay = (): string => localDay(nowSec(), currentTzOffsetMin());

/** 'YYYY-MM' prefix from a 'YYYY-MM-DD' local day, for month queries. */
export const monthPrefix = (localDayStr: string): string => localDayStr.slice(0, 7);

// --- Russian date formatting (display only) --------------------------------

const RU_MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
const RU_WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const RU_WEEKDAYS_FULL = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

/** 'PN' short weekday name (пн, вт, …). */
export function weekdayShort(weekday: number): string {
  return RU_WEEKDAYS_SHORT[((weekday % 7) + 7) % 7] ?? '';
}

/** 'понедельник' full weekday name. */
export function weekdayFull(weekday: number): string {
  return RU_WEEKDAYS_FULL[((weekday % 7) + 7) % 7] ?? '';
}

/** e.g. "29 августа (сб)" — a day rendered as a real date with weekday. */
export function formatDayMonthWeekday(date: Date): string {
  return `${date.getDate()} ${RU_MONTHS_GEN[date.getMonth()]} (${weekdayShort(date.getDay())})`;
}

/** e.g. "20 августа, среда" — today's date for the home info line. */
export function formatTodayHuman(date: Date = new Date()): string {
  return `${date.getDate()} ${RU_MONTHS_GEN[date.getMonth()]}, ${weekdayFull(date.getDay())}`;
}

/**
 * Whole days from today until the next payday (day-of-month `paydayDay`),
 * always ≥ 1. If today is the payday, returns the full span to next month's
 * payday. `paydayDay` is clamped to the length of the target month
 * (e.g. 31 → 28/30). Drives the "можно сегодня" divisor (D10).
 */
export function daysUntilPayday(paydayDay: number, now: Date = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const clampDay = (year: number, month: number): number =>
    Math.min(paydayDay, new Date(year, month + 1, 0).getDate());

  const today = new Date(y, m, now.getDate());
  let target = new Date(y, m, clampDay(y, m));
  if (target.getTime() <= today.getTime()) {
    target = new Date(y, m + 1, clampDay(y, m + 1));
  }
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return Math.max(1, days);
}

/** The most recent payday on or before today (the current period's start). */
export function lastPaydayDate(paydayDay: number, now: Date = new Date()): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  const clampDay = (year: number, month: number): number =>
    Math.min(paydayDay, new Date(year, month + 1, 0).getDate());

  const today = new Date(y, m, now.getDate());
  let start = new Date(y, m, clampDay(y, m));
  if (start.getTime() > today.getTime()) {
    start = new Date(y, m - 1, clampDay(y, m - 1));
  }
  return start;
}

/** 'YYYY-MM-DD' of the current period's start (last payday). */
export function periodStartLocalDay(paydayDay: number, now: Date = new Date()): string {
  const start = lastPaydayDate(paydayDay, now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/** Whole days elapsed since the current period's start (0 on payday itself). */
export function daysElapsedInPeriod(paydayDay: number, now: Date = new Date()): number {
  const start = lastPaydayDate(paydayDay, now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86_400_000));
}

/**
 * Whole days in the current payday→payday period (elapsed + remaining). Divides
 * the expected payout into the daily limit (B21). Always ≥ 1.
 */
export function daysInPeriod(paydayDay: number, now: Date = new Date()): number {
  return Math.max(1, daysElapsedInPeriod(paydayDay, now) + daysUntilPayday(paydayDay, now));
}
