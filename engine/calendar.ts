import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { SessionInfo, SessionState } from './types';
import { clamp } from './stats';

export const NYSE_TZ = 'America/New_York';
// NYSE/ICE published calendar, retrieved 2026-09-20. User-specified extended
// sessions run to 20:00, including half-days; these are model session rules.
export const MARKET_HOLIDAYS_2026_2027 = [
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25',
  '2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31',
  '2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24',
];
export const HALF_DAYS_2026_2027 = ['2026-11-27','2026-12-24','2027-11-26'];
// History needs 400 trading days before the checkpoint, hence 2024/25 too.
const historicalHolidays = [
  '2024-01-01','2024-01-15','2024-02-19','2024-03-29','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-11-28','2024-12-25',
  '2025-01-01','2025-01-09','2025-01-20','2025-02-17','2025-04-18','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-11-27','2025-12-25',
];
const holidays = new Set([...historicalHolidays, ...MARKET_HOLIDAYS_2026_2027]);
const halfDays = new Set(['2024-07-03','2024-11-29','2024-12-24','2025-07-03','2025-11-28','2025-12-24', ...HALF_DAYS_2026_2027]);
export const HOUR = 3_600_000;
export const nyDate = (ts: number | Date): string => formatInTimeZone(ts, NYSE_TZ, 'yyyy-MM-dd');
export function shiftDate(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function atNy(key: string, time: string): number { return fromZonedTime(`${key}T${time}:00`, NYSE_TZ).getTime(); }
export function isTradingDate(key: string): boolean {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(key);
}
export function isTradingDay(date: Date): boolean { return isTradingDate(nyDate(date)); }
export function regularOpen(date: Date): Date { return new Date(atNy(nyDate(date), '09:30')); }
export function regularClose(date: Date): Date { const key = nyDate(date); return new Date(atNy(key, halfDays.has(key) ? '13:00' : '16:00')); }
export function previousClose(ts: number): number {
  let key = nyDate(ts);
  for (let i = 0; i < 370; i++, key = shiftDate(key, -1)) {
    const close = atNy(key, halfDays.has(key) ? '13:00' : '16:00');
    if (isTradingDate(key) && close <= ts) return close;
  }
  throw new Error('No previous trading close found');
}
/** Strictly next opening bell; at the bell itself the regular session starts. */
export function nextOpen(ts: number): number {
  let key = nyDate(ts);
  for (let i = 0; i < 370; i++, key = shiftDate(key, 1)) {
    const open = atNy(key, '09:30');
    if (isTradingDate(key) && open > ts) return open;
  }
  throw new Error('No next trading open found');
}
export function getSessionInfo(ts: number): SessionInfo {
  if (!Number.isFinite(ts)) throw new Error('Invalid session timestamp');
  const key = nyDate(ts), trading = isTradingDate(key);
  const open = atNy(key, '09:30'), close = atNy(key, halfDays.has(key) ? '13:00' : '16:00');
  const anchorCloseTs = previousClose(ts), nextOpenTs = nextOpen(ts);
  let state: SessionState;
  if (trading && ts >= open && ts < close) state = 'regular';
  else if (trading && ((ts >= atNy(key, '04:00') && ts < open) || (ts >= close && ts < atNy(key, '20:00')))) state = 'extended';
  else {
    // Determine the closure from bells rather than Friday/Monday arithmetic.
    const firstAfterClose = shiftDate(nyDate(anchorCloseTs), 1);
    if (firstAfterClose === nyDate(nextOpenTs)) state = 'overnight';
    else {
      let cursor = firstAfterClose, includesHoliday = false;
      while (cursor < nyDate(nextOpenTs)) { includesHoliday ||= holidays.has(cursor); cursor = shiftDate(cursor, 1); }
      state = includesHoliday ? 'holiday' : 'weekend';
    }
  }
  const isDark = state !== 'regular' && state !== 'extended';
  const windowDurationMs = nextOpenTs - anchorCloseTs;
  return { state, isDark, anchorCloseTs, nextOpenTs, windowDurationMs,
    windowProgress: clamp((ts - anchorCloseTs) / windowDurationMs) };
}
/** Would-be weekday sessions carry the same weight on full-day holidays. */
export function sessionWeight(ts: number): number {
  const key = nyDate(ts), weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return 0.12;
  const hours = Number(formatInTimeZone(ts, NYSE_TZ, 'H')) + Number(formatInTimeZone(ts, NYSE_TZ, 'm')) / 60;
  if (hours >= 9.5 && hours < 16) return 1;
  return hours >= 4 && hours < 20 ? 0.45 : 0.25;
}
export function sessionEquivalentHours(fromTs: number, toTs: number): number {
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs < fromTs) throw new Error('Invalid time interval');
  let sum = 0;
  for (let t = fromTs; t < toTs;) {
    const end = Math.min(toTs, (Math.floor(t / (HOUR / 4)) + 1) * HOUR / 4);
    sum += sessionWeight(t) * (end - t) / HOUR; t = end;
  }
  return sum;
}
// 16:00–20:00 (4*.45), 20:00–04:00 (8*.25), 04:00–09:30 (5.5*.45).
export const STANDARD_WINDOW_EQUIV_HOURS = 6.275;
