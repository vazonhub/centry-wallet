import { addDays, formatLocalDay, monthRange, parseLocalDay, weekRange } from '@utils/range';

describe('range helpers', () => {
  it('formatLocalDay round-trips through parseLocalDay', () => {
    expect(formatLocalDay(parseLocalDay('2026-08-04'))).toBe('2026-08-04');
    expect(formatLocalDay(parseLocalDay('2026-01-01'))).toBe('2026-01-01');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-08-10', 5)).toBe('2026-08-15');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-01', -7)).toBe('2026-02-22'); // 2026 is not a leap year
  });

  it('monthRange returns the first and real last day of the month', () => {
    expect(monthRange('2026-08')).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(monthRange('2026-04-17')).toEqual({ start: '2026-04-01', end: '2026-04-30' });
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' }); // leap
  });

  it('weekRange spans Monday..Sunday around any day of the week', () => {
    // 2026-08-05 is a Wednesday.
    expect(weekRange('2026-08-05')).toEqual({ start: '2026-08-03', end: '2026-08-09' });
    // A Monday maps to itself as the start.
    expect(weekRange('2026-08-03')).toEqual({ start: '2026-08-03', end: '2026-08-09' });
    // A Sunday is the last day of its own week, not the first of the next.
    expect(weekRange('2026-08-09')).toEqual({ start: '2026-08-03', end: '2026-08-09' });
    // Week spanning a month boundary.
    expect(weekRange('2026-09-01')).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });
});
