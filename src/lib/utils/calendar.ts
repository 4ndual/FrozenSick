import type { CalendarConfig, FantasyDate } from '$lib/types/schema.ts';

export function daysPerYear(calendar: CalendarConfig): number {
  return calendar.months.reduce((sum, m) => sum + m.days, 0);
}

export function dateToDay(date: FantasyDate, calendar: CalendarConfig): number {
  const yearDays = (date.year - calendar.epoch) * daysPerYear(calendar);
  let monthDays = 0;
  for (let i = 0; i < date.month - 1; i++) {
    monthDays += calendar.months[i]?.days ?? 0;
  }
  return yearDays + monthDays + date.day - 1;
}

export function dateToTimestamp(date: FantasyDate, calendar: CalendarConfig): number {
  return dateToDay(date, calendar) * 86400 * 1000;
}

export function timestampToDate(ts: number, calendar: CalendarConfig): FantasyDate {
  const yearLen = daysPerYear(calendar);
  let totalDays = Math.floor(ts / (86400 * 1000));

  let year = calendar.epoch + Math.floor(totalDays / yearLen);
  let rem = ((totalDays % yearLen) + yearLen) % yearLen;

  let month = 1;
  for (const m of calendar.months) {
    if (rem < m.days) break;
    rem -= m.days;
    month++;
  }
  return { year, month, day: rem + 1 };
}

export function formatDate(date: FantasyDate, calendar: CalendarConfig): string {
  const month = calendar.months[date.month - 1];
  return `${date.day} ${month?.name ?? '?'}, ${date.year} ${calendar.yearSuffix}`;
}

export function formatDateShort(date: FantasyDate, calendar: CalendarConfig): string {
  const month = calendar.months[date.month - 1];
  return `${date.day} ${month?.name.slice(0, 3) ?? '?'} ${date.year}`;
}

export function compareDate(a: FantasyDate, b: FantasyDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function clampDay(day: number, month: number, calendar: CalendarConfig): number {
  const max = calendar.months[month - 1]?.days ?? 30;
  return Math.max(1, Math.min(day, max));
}

export function epochDate(calendar: CalendarConfig): FantasyDate {
  return { year: calendar.epoch, month: 1, day: 1 };
}

export function isValidDate(date: FantasyDate, calendar: CalendarConfig): boolean {
  if (date.month < 1 || date.month > calendar.months.length) return false;
  const monthDays = calendar.months[date.month - 1]?.days ?? 0;
  return date.day >= 1 && date.day <= monthDays;
}
