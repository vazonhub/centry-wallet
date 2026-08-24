import type { Account, Category, Transaction } from '@models';
import { buildTransactionsCsv, CSV_COLUMNS, serializeCsv } from '@utils/csv';

const e6 = (rate: number) => Math.round(rate * 1_000_000);

describe('serializeCsv — RFC 4180 escaping', () => {
  it('joins plain fields with commas and rows with CRLF', () => {
    expect(
      serializeCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\r\nc,d');
  });

  it('quotes fields containing comma, quote or newline and doubles inner quotes', () => {
    expect(serializeCsv([['a,b']])).toBe('"a,b"');
    expect(serializeCsv([['say "hi"']])).toBe('"say ""hi"""');
    expect(serializeCsv([['line1\nline2']])).toBe('"line1\nline2"');
  });

  it('leaves plain fields unquoted', () => {
    expect(serializeCsv([['plain', '123']])).toBe('plain,123');
  });
});

// --- Fixtures --------------------------------------------------------------

const account = (over: Partial<Account>): Account => ({
  id: 'acc-1',
  name: 'Основной',
  currency: 'BYN',
  kind: 'card',
  icon: null,
  openingMinor: 0,
  sortOrder: 0,
  isDefault: true,
  createdAt: 0,
  updatedAt: 0,
  archivedAt: null,
  ...over,
});

const category = (over: Partial<Category>): Category => ({
  id: 'cat-1',
  name: 'Еда',
  icon: '🍎',
  color: '#fff',
  kind: 'expense',
  isSystem: true,
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  ...over,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  kind: 'expense',
  amountMinor: -1250,
  currency: 'BYN',
  rateToBaseE6: e6(1),
  note: null,
  occurredAt: 1_000,
  localDay: '2026-08-24',
  transferPairId: null,
  authorId: 'me',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  ...over,
});

const build = (
  transactions: Transaction[],
  over: Partial<Parameters<typeof buildTransactionsCsv>[0]> = {},
) =>
  buildTransactionsCsv({
    transactions,
    accounts: [account({})],
    categories: [category({})],
    baseCurrency: 'BYN',
    tzOffsetMin: 0,
    ...over,
  });

describe('buildTransactionsCsv', () => {
  it('starts with the header row', () => {
    const lines = build([tx({})]).split('\r\n');
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
  });

  it('renders an expense row with signed amount, base amount and rate', () => {
    // 12.50 USD expense at 3.27 → -40.88 BYN (half-up: -4087.5 → -4088 minor)
    const csv = build([
      tx({ amountMinor: -1250, currency: 'USD', rateToBaseE6: e6(3.27), note: 'кофе' }),
    ]);
    const row = csv.split('\r\n')[1];
    expect(row).toBe('2026-08-24,00:16,Расход,Основной,Еда,-12.50,USD,-40.88,BYN,3.27,кофе');
  });

  it('leaves category empty and labels transfers', () => {
    const csv = build([tx({ kind: 'transfer', categoryId: null, amountMinor: -5000 })]);
    const row = csv.split('\r\n')[1];
    expect(row).toContain('Перевод');
    expect(row).toBe('2026-08-24,00:16,Перевод,Основной,,-50.00,BYN,-50.00,BYN,1,');
  });

  it('escapes notes containing commas and quotes', () => {
    const csv = build([tx({ note: 'такси, "быстро"' })]);
    expect(csv.split('\r\n')[1]).toContain('"такси, ""быстро"""');
  });

  it('resolves names from archived/deleted rows and blanks unknown ids', () => {
    const csv = build([tx({ accountId: 'gone', categoryId: 'gone' })]);
    const fields = csv.split('\r\n')[1]!.split(',');
    expect(fields[3]).toBe(''); // account
    expect(fields[4]).toBe(''); // category
  });

  it('orders rows chronologically (oldest first)', () => {
    const csv = build([
      tx({ id: 'b', occurredAt: 200, note: 'later' }),
      tx({ id: 'a', occurredAt: 100, note: 'earlier' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('earlier');
    expect(lines[2]).toContain('later');
  });
});
