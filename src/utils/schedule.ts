import { formatDayMonthWeekday, weekdayFull } from './date';

/**
 * Payout schedule (B21, generalized 2026-08-20). The "можно сегодня" number is
 * the expected payout for the current period spread over the days in that
 * period, where a "period" runs from one payday to the next. Four shapes:
 *
 * - weekly     — every week on a weekday
 * - biweekly   — every 2 weeks on a weekday (phased by `anchor`)
 * - semimonthly— twice a month on two days-of-month
 * - monthly    — once a month on a day-of-month
 *
 * Each payday belongs to a "slot" that carries its own expected amount, so a
 * twice-monthly salary+advance can differ. Slot id: the day-of-month string for
 * monthly/semimonthly, or 'w' for the single weekly/biweekly slot.
 */
export type PayoutFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

/** A payout's expected amount in ITS OWN currency (converted to base at use). */
export interface PayoutSlotValue {
  minor: number;
  currency: string;
}

export interface PayoutSchedule {
  frequency: PayoutFrequency;
  /** 0–6 (0=Sunday) for weekly/biweekly. */
  weekday: number;
  /** 'YYYY-MM-DD' reference payday that phases the biweekly cycle. */
  anchor: string | null;
  /** Day(s) of month (1–31): 1 for monthly, 2 for semimonthly. */
  days: number[];
  /** slotId → expected payout (amount in the slot's own currency). */
  amounts: Record<string, PayoutSlotValue>;
}

export const WEEKLY_SLOT = 'w';
const MS_DAY = 86_400_000;

export function defaultSchedule(): PayoutSchedule {
  return { frequency: 'monthly', weekday: 5, anchor: null, days: [1], amounts: {} };
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLocalDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function toLocalDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((midnight(b).getTime() - midnight(a).getTime()) / MS_DAY);
}

function clampDayOfMonth(year: number, month: number, day: number): number {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

interface PaydayEvent {
  date: Date;
  slotId: string;
}

/** Sorted payday events in a window around `now` (enough to bracket today). */
function paydayEventsAround(schedule: PayoutSchedule, now: Date): PaydayEvent[] {
  const today = midnight(now);
  const events: PaydayEvent[] = [];

  if (schedule.frequency === 'monthly' || schedule.frequency === 'semimonthly') {
    const days = [...new Set(schedule.days)].sort((a, b) => a - b);
    for (let mo = -2; mo <= 2; mo++) {
      const base = new Date(today.getFullYear(), today.getMonth() + mo, 1);
      const y = base.getFullYear();
      const m = base.getMonth();
      for (const day of days) {
        events.push({ date: new Date(y, m, clampDayOfMonth(y, m, day)), slotId: String(day) });
      }
    }
  } else {
    const step = schedule.frequency === 'weekly' ? 7 : 14;
    let ref: Date;
    if (schedule.frequency === 'biweekly' && schedule.anchor) {
      ref = parseLocalDay(schedule.anchor);
    } else {
      // Most recent occurrence of `weekday` on or before today.
      ref = new Date(today);
      const diff = (((ref.getDay() - schedule.weekday) % 7) + 7) % 7;
      ref.setDate(ref.getDate() - diff);
    }
    const kCenter = Math.round(daysBetween(ref, today) / step);
    for (let k = kCenter - 4; k <= kCenter + 4; k++) {
      const dt = new Date(ref);
      dt.setDate(dt.getDate() + k * step);
      events.push({ date: midnight(dt), slotId: WEEKLY_SLOT });
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

export interface CurrentPeriod {
  /** Most recent payday on or before today — the period start. */
  start: Date;
  /** Next payday strictly after today — the period end. */
  end: Date;
  /** Slot id of the payday that started this period. */
  startSlotId: string;
}

export function currentPeriod(schedule: PayoutSchedule, now: Date = new Date()): CurrentPeriod {
  const events = paydayEventsAround(schedule, now);
  const today = midnight(now);
  let start: PaydayEvent | undefined;
  let end: Date | undefined;
  for (const e of events) {
    if (e.date.getTime() <= today.getTime()) start = e;
    else if (!end) end = e.date;
  }
  // Fallbacks (should not happen given the window); keep the math safe.
  const startEv = start ?? events[0] ?? { date: today, slotId: WEEKLY_SLOT };
  const endDate = end ?? new Date(startEv.date.getTime() + 30 * MS_DAY);
  return { start: startEv.date, end: endDate, startSlotId: startEv.slotId };
}

/** Whole days in the current period (≥ 1). */
export function daysInPeriod(schedule: PayoutSchedule, now: Date = new Date()): number {
  const { start, end } = currentPeriod(schedule, now);
  return Math.max(1, daysBetween(start, end));
}

/** Whole days until the next payday (≥ 1). */
export function daysUntilPayday(schedule: PayoutSchedule, now: Date = new Date()): number {
  const { end } = currentPeriod(schedule, now);
  return Math.max(1, daysBetween(now, end));
}

/** Whole days elapsed since the period start (0 on payday itself). */
export function daysElapsedInPeriod(schedule: PayoutSchedule, now: Date = new Date()): number {
  const { start } = currentPeriod(schedule, now);
  return Math.max(0, daysBetween(start, now));
}

/** 'YYYY-MM-DD' of the current period's start. */
export function periodStartLocalDay(schedule: PayoutSchedule, now: Date = new Date()): string {
  return toLocalDayString(currentPeriod(schedule, now).start);
}

/**
 * Expected payout for the current period — the start slot's value in its own
 * currency, or null if unset. Convert to base (via rates) at the call site.
 */
export function expectedForPeriod(
  schedule: PayoutSchedule,
  now: Date = new Date(),
): PayoutSlotValue | null {
  const value = schedule.amounts[currentPeriod(schedule, now).startSlotId];
  return value && value.minor > 0 ? value : null;
}

/** The upcoming payday date (period end) — for "ближайшая дата" display. */
export function nextPaydayDate(schedule: PayoutSchedule, now: Date = new Date()): Date {
  return currentPeriod(schedule, now).end;
}

export interface ScheduleSlot {
  id: string;
  label: string;
}

/** Slots a regular payout can be recorded against (for the input-modal picker). */
export function scheduleSlots(schedule: PayoutSchedule): ScheduleSlot[] {
  if (schedule.frequency === 'weekly' || schedule.frequency === 'biweekly') {
    return [{ id: WEEKLY_SLOT, label: weekdayFull(schedule.weekday) }];
  }
  return [...new Set(schedule.days)]
    .sort((a, b) => a - b)
    .map((d) => ({ id: String(d), label: `${d} число` }));
}

/** Human summary for settings, e.g. "1 раз в месяц · 29 августа (сб)". */
export function describeSchedule(schedule: PayoutSchedule, now: Date = new Date()): string {
  const next = formatDayMonthWeekday(nextPaydayDate(schedule, now));
  switch (schedule.frequency) {
    case 'weekly':
      return `Каждую неделю · ${weekdayFull(schedule.weekday)} · ближайшая ${next}`;
    case 'biweekly':
      return `Раз в 2 недели · ${weekdayFull(schedule.weekday)} · ближайшая ${next}`;
    case 'semimonthly':
      return `2 раза в месяц · ${[...schedule.days].sort((a, b) => a - b).join(' и ')} число · ближайшая ${next}`;
    default:
      return `Раз в месяц · ${schedule.days[0]} число · ближайшая ${next}`;
  }
}
