import { bigramScore, matchesSearch } from '../search';

describe('bigramScore', () => {
  it('is 1 when all query bigrams appear in the text', () => {
    expect(bigramScore('обед', 'обед в кафе')).toBe(1);
  });
  it('is 0 for a disjoint string', () => {
    expect(bigramScore('такси', 'обед')).toBe(0);
  });
});

describe('matchesSearch', () => {
  const item = { note: 'Обед в кафе', category: 'Еда', amountMinor: -12_50 };

  it('empty query matches everything', () => {
    expect(matchesSearch('', item)).toBe(true);
  });

  it('matches by note substring', () => {
    expect(matchesSearch('кафе', item)).toBe(true);
  });

  it('matches by category name', () => {
    expect(matchesSearch('еда', item)).toBe(true);
  });

  it('matches by amount in major units', () => {
    expect(matchesSearch('12', item)).toBe(true);
    expect(matchesSearch('12.5', item)).toBe(true);
    expect(matchesSearch('12,50', item)).toBe(true);
  });

  it('tolerates a small typo via bigrams', () => {
    // 'обеед' shares most bigrams with 'обед в кафе'
    expect(matchesSearch('обеед', item)).toBe(true);
  });

  it('rejects an unrelated query', () => {
    expect(matchesSearch('такси', item)).toBe(false);
  });
});
