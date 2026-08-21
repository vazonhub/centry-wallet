// Mock the native module so importing the service is side-effect free under jest.
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

import { ADD_DEEP_LINK, buildReminderContent, parseHhMm } from '../index';

describe('parseHhMm', () => {
  it('parses a well-formed time', () => {
    expect(parseHhMm('22:00')).toEqual({ hour: 22, minute: 0 });
    expect(parseHhMm('09:05')).toEqual({ hour: 9, minute: 5 });
    expect(parseHhMm('7:30')).toEqual({ hour: 7, minute: 30 });
  });

  it('clamps out-of-range components', () => {
    expect(parseHhMm('26:99')).toEqual({ hour: 23, minute: 59 });
  });

  it('falls back to 22:00 on malformed input', () => {
    expect(parseHhMm('')).toEqual({ hour: 22, minute: 0 });
    expect(parseHhMm('nope')).toEqual({ hour: 22, minute: 0 });
    expect(parseHhMm('22-00')).toEqual({ hour: 22, minute: 0 });
  });
});

describe('buildReminderContent', () => {
  it('carries the add deep link and stays silent (no financial data)', () => {
    const c = buildReminderContent();
    expect(c.data).toEqual({ url: ADD_DEEP_LINK });
    expect(c.sound).toBe(false);
    expect(typeof c.title).toBe('string');
    expect(typeof c.body).toBe('string');
  });
});
