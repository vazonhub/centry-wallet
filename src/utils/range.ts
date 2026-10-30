/**
 * Pure date-range math over local-day strings ('YYYY-MM-DD'). Those strings sort
 * lexicographically, so a range is just an inclusive `{ start, end }` pair of the
 * same `local_day` column every repo query filters on (rule 8 — days are frozen
 * at write time). No wall-clock reads here; callers pass the anchor day. The
 * impure helpers (that read the device clock/timezone) live in `@utils/date`.
 */

export interface DateRange {
  /** Inclusive first local day, 'YYYY-MM-DD'. */
  start: string;
  /** Inclusive last local day, 'YYYY-MM-DD'. */
  end: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' from a Date's LOCAL calendar fields. */
export function formatLocalDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A 'YYYY-MM-DD' local day parsed to a local Date at midnight. */
export function parseLocalDay(day: string): Date {
  const [y, m, d] = day.split('-').map((n) => parseInt(n, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** `day` shifted by whole days; crosses month/year boundaries correctly. */
export function addDays(day: string, delta: number): string {
  const d = parseLocalDay(day);
  d.setDate(d.getDate() + delta);
  return formatLocalDay(d);
}

/**
 * First→last calendar day of a month, from a 'YYYY-MM' or 'YYYY-MM-DD' string.
 * The end is the real last day (28/29/30/31).
 */
export function monthRange(month: string): DateRange {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const year = y ?? 1970;
  const mon = (m ?? 1) - 1;
  const last = new Date(year, mon + 1, 0).getDate(); // day 0 of next month = last of this
  return { start: `${year}-${pad(mon + 1)}-01`, end: `${year}-${pad(mon + 1)}-${pad(last)}` };
}

/** The Monday→Sunday week containing `day`. */
export function weekRange(day: string): DateRange {
  const dow = parseLocalDay(day).getDay(); // 0=Sun … 6=Sat
  const backToMonday = (dow + 6) % 7; // days since the week's Monday
  const start = addDays(day, -backToMonday);
  return { start, end: addDays(start, 6) };
}
