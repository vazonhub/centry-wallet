import { currentTzOffsetMin, monthPrefix, nowSec, todayLocalDay } from '@utils/date';

describe('date helpers', () => {
  it('monthPrefix takes YYYY-MM from a local day', () => {
    expect(monthPrefix('2026-08-20')).toBe('2026-08');
    expect(monthPrefix('2026-01-01')).toBe('2026-01');
  });

  it('nowSec is an integer count of seconds', () => {
    const s = nowSec();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThan(1_700_000_000); // sanity: after 2023
  });

  it('todayLocalDay is a well-formed YYYY-MM-DD string', () => {
    expect(todayLocalDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('currentTzOffsetMin is a finite integer', () => {
    const off = currentTzOffsetMin();
    expect(Number.isInteger(off)).toBe(true);
    expect(Math.abs(off)).toBeLessThanOrEqual(14 * 60);
  });
});
