import { DateTimeManager } from '@shared/common';

const DEFAULT_LOCALE = 'tr-TR';
const DEFAULT_TIME_ZONE = DateTimeManager.toIana('Europe_Istanbul');

type DateInput = Date | string | number;

export function formatLongDate(
  input: DateInput,
  locale = DEFAULT_LOCALE
): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(DateTimeManager.create(input));
}

export function formatShortDate(
  input: DateInput,
  locale = DEFAULT_LOCALE
): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(DateTimeManager.create(input));
}

export function formatWeekdayDate(
  input: DateInput,
  locale = DEFAULT_LOCALE
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(DateTimeManager.create(input));
}

export function formatTime(input: DateInput, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(DateTimeManager.create(input));
}

export function dateAtTime(baseDate: Date, time: string): Date {
  return DateTimeManager.fromLocalDateTime(
    DateTimeManager.toDateString(baseDate),
    time
  );
}
