import { parseAddDeepLink } from '@utils/deepLink';

describe('parseAddDeepLink — add/input detection', () => {
  it('recognises the host form (centry://add)', () => {
    expect(parseAddDeepLink({ hostname: 'add' }).isAdd).toBe(true);
    expect(parseAddDeepLink({ hostname: 'input' }).isAdd).toBe(true);
  });

  it('recognises the path form (centry:///add)', () => {
    expect(parseAddDeepLink({ hostname: null, path: '/add' }).isAdd).toBe(true);
    expect(parseAddDeepLink({ path: 'input' }).isAdd).toBe(true);
  });

  it('rejects unrelated links', () => {
    expect(parseAddDeepLink({ hostname: 'oauth', path: '/callback' }).isAdd).toBe(false);
    expect(parseAddDeepLink({}).isAdd).toBe(false);
  });
});

describe('parseAddDeepLink — Siri prefill extraction', () => {
  it('extracts a valid kind, amount and note', () => {
    const p = parseAddDeepLink({
      hostname: 'add',
      queryParams: { kind: 'expense', amount: '12.50', note: 'кофе' },
    });
    expect(p).toEqual({ isAdd: true, kind: 'expense', amount: '12.50', note: 'кофе' });
  });

  it('accepts every transaction kind', () => {
    for (const kind of ['expense', 'income', 'transfer'] as const) {
      expect(parseAddDeepLink({ hostname: 'add', queryParams: { kind } }).kind).toBe(kind);
    }
  });

  it('drops an invalid kind but keeps the link valid', () => {
    const p = parseAddDeepLink({ hostname: 'add', queryParams: { kind: 'bogus' } });
    expect(p.isAdd).toBe(true);
    expect(p.kind).toBeUndefined();
  });

  it('ignores empty/whitespace params', () => {
    const p = parseAddDeepLink({
      hostname: 'add',
      queryParams: { amount: '  ', note: '' },
    });
    expect(p.amount).toBeUndefined();
    expect(p.note).toBeUndefined();
  });

  it('takes the first value of an array param', () => {
    const p = parseAddDeepLink({ hostname: 'add', queryParams: { amount: ['9', '10'] } });
    expect(p.amount).toBe('9');
  });

  it('a bare add link has no prefill fields', () => {
    expect(parseAddDeepLink({ hostname: 'add' })).toEqual({ isAdd: true });
  });
});
