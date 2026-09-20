import { describe, expect, test } from 'vitest';
import { atNy, getSessionInfo, HOUR, isTradingDate, nextOpen, previousClose, regularClose, sessionEquivalentHours, STANDARD_WINDOW_EQUIV_HOURS } from '@engine/calendar';

const time = (s: string): number => Date.parse(s);
describe('New York calendar and official anchors', () => {
  test('Tuesday night and Wednesday before 04:00 are overnight', () => {
    for (const ts of [atNy('2026-09-22','22:00'), atNy('2026-09-23','03:59')]) {
      expect(getSessionInfo(ts)).toMatchObject({ state: 'overnight', isDark: true, anchorCloseTs: time('2026-09-22T20:00:00Z'), nextOpenTs: time('2026-09-23T13:30:00Z') });
    }
  });
  test('Friday extended takes precedence until 20:00; anchor does not move', () => {
    expect(getSessionInfo(atNy('2026-09-18','19:59'))).toMatchObject({state:'extended',isDark:false,anchorCloseTs:atNy('2026-09-18','16:00')});
    expect(getSessionInfo(atNy('2026-09-18','20:00'))).toMatchObject({state:'weekend',isDark:true,anchorCloseTs:atNy('2026-09-18','16:00')});
    expect(getSessionInfo(atNy('2026-09-21','03:59')).state).toBe('weekend');
    expect(getSessionInfo(atNy('2026-09-21','04:00')).state).toBe('extended');
  });
  test('standard weekend spans official Friday close to Monday bell', () => {
    expect(getSessionInfo(time('2026-09-20T12:00:00Z'))).toMatchObject({state:'weekend',anchorCloseTs:time('2026-09-18T20:00:00Z'),nextOpenTs:time('2026-09-21T13:30:00Z'),windowDurationMs:65.5*HOUR});
  });
  test('Labor Day extends the closure to Tuesday', () => {
    expect(getSessionInfo(atNy('2026-09-07','12:00'))).toMatchObject({state:'holiday',anchorCloseTs:atNy('2026-09-04','16:00'),nextOpenTs:atNy('2026-09-08','09:30')});
  });
  test('half-day closes at 13:00 and extended runs until 20:00', () => {
    expect(regularClose(new Date(atNy('2026-11-27','12:00'))).getTime()).toBe(atNy('2026-11-27','13:00'));
    expect(getSessionInfo(atNy('2026-11-27','13:00'))).toMatchObject({state:'extended',isDark:false,anchorCloseTs:atNy('2026-11-27','13:00')});
    expect(getSessionInfo(atNy('2026-11-27','19:59')).state).toBe('extended');
    expect(getSessionInfo(atNy('2026-11-27','20:00')).state).toBe('weekend');
    expect(previousClose(atNy('2026-11-28','12:00'))).toBe(atNy('2026-11-27','13:00'));
  });
  test('Thanksgiving Wednesday has a full session, Thursday is shut', () => {
    expect(previousClose(atNy('2026-11-26','12:00'))).toBe(atNy('2026-11-25','16:00'));
    expect(nextOpen(atNy('2026-11-26','12:00'))).toBe(atNy('2026-11-27','09:30'));
  });
  test.each([
    ['2026-03-08T12:00:00Z','2026-03-06T21:00:00Z','2026-03-09T13:30:00Z',64.5],
    ['2026-11-01T12:00:00Z','2026-10-30T20:00:00Z','2026-11-02T14:30:00Z',66.5],
  ])('DST weekend %s uses wall-clock bells', (ts, close, open, hours) => {
    expect(getSessionInfo(time(ts))).toMatchObject({state:'weekend',anchorCloseTs:time(close),nextOpenTs:time(open),windowDurationMs:Number(hours)*HOUR});
  });
  test('mid-session is regular with most recent official close', () => {
    expect(getSessionInfo(atNy('2026-09-22','12:00'))).toMatchObject({state:'regular',isDark:false,anchorCloseTs:atNy('2026-09-21','16:00'),nextOpenTs:atNy('2026-09-23','09:30')});
  });
  test('2027 holiday and half-day coverage', () => {
    expect(isTradingDate('2027-06-18')).toBe(false);
    expect(isTradingDate('2027-12-24')).toBe(false);
    expect(isTradingDate('2027-12-31')).toBe(true);
    expect(regularClose(new Date(atNy('2027-11-26','12:00'))).getTime()).toBe(atNy('2027-11-26','13:00'));
  });
  test('session-equivalent hours: hand-integrated overnight and equal-length weekend', () => {
    const night = sessionEquivalentHours(atNy('2026-09-22','16:00'), atNy('2026-09-23','09:30'));
    const weekend = sessionEquivalentHours(atNy('2026-09-19','00:00'), atNy('2026-09-19','17:30'));
    expect(night).toBeCloseTo(4*.45+8*.25+5.5*.45,12);
    expect(night).toBeCloseTo(STANDARD_WINDOW_EQUIV_HOURS,12);
    expect(weekend).toBeCloseTo(17.5*.12,12);
    expect(weekend).toBeLessThan(night);
  });
});
