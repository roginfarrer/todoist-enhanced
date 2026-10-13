/**
 * A repeat rule built from buttons rather than typed (#202).
 *
 * The date picker's Repeat panel asks "every how many what, on which days,
 * from when, until when" and this turns the answers into the `due.string`
 * Todoist will resolve. Like recurrence.ts, nothing here works out a date: the
 * string is the whole contract, and Todoist is the one that reads it.
 *
 * Every form written below was sent to Todoist's API and read back before it
 * was used, in English and in French (2026-10-11). What that showed, and what
 * the builder follows as a result:
 *
 *   - The order is fixed: rule, then time, then start, then end. "every 2
 *     months starting 2026-10-15 at 8:00" lands on the wrong day; "every 2
 *     months at 8:00 starting 2026-10-15" lands on the 15th.
 *   - A French day of the month is written as an ordinal, "tous les 15e":
 *     "tous les 15 à 8:00" is refused outright.
 *   - "every 2 months on the 15th" is refused; "every 2 months starting
 *     <a 15th>" is how the day of the month is given past an interval of one.
 *   - Todoist drops "starting" from the string it keeps: the start becomes
 *     the first occurrence, which is all it was for.
 *   - French counted from completion is "chaque!": Todoist rewrites
 *     "tous les!" to it anyway.
 *
 * The rule is written in the interface's language, so a French user finds a
 * French rule in Todoist afterwards, the same one they would have typed.
 */

import type { RecurrenceLang, RecurrenceReading } from './recurrence';

export type RepeatUnit = 'day' | 'workday' | 'week' | 'month' | 'year';

/** Which day of the month a monthly rule keeps, read from its first day. */
export type MonthlyAnchor = 'day' | 'weekday' | 'lastDay';

export interface RepeatRule {
  unit: RepeatUnit;
  /** Every how many units: 1 for "every week", 2 for "every 2 weeks". */
  interval: number;
  /** For a weekly rule, the days it falls on, as `Date.getDay()` counts them. Empty: the start's own day. */
  weekdays: number[];
  /** For a monthly rule: the 15th, the 2nd Tuesday, or the last day. */
  monthly: MonthlyAnchor;
  /** `every!`: the next one is counted from the day the task is completed. */
  fromCompletion: boolean;
  /** "20:30", or null for a rule without a time. */
  time: string | null;
  /** The last day it can fall on, as an API date, or null for no end. */
  end: string | null;
}

const EN_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const FR_DAYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FR_MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

const pad = (n: number): string => String(n).padStart(2, '0');
const isoDay = (day: Date): string => `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

const enOrdinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};
const frOrdinal = (n: number): string => (n === 1 ? '1er' : `${n}e`);

/** Which of its weekday in the month a day is: 1 to 4, or 5 when it is the fifth, which is always the last. */
export const weekOfMonth = (day: Date): number => Math.ceil(day.getDate() / 7);

/** Whether a monthly rule can keep this anchor at this interval. Past one month, only the day of the month can be carried. */
export const anchorAllowed = (anchor: MonthlyAnchor, interval: number): boolean =>
  anchor === 'day' || interval === 1;

/** Weekdays in the order a week is read, starting on the user's first day. */
export function weekdayOrder(weekStartsOn: number): number[] {
  return Array.from({ length: 7 }, (_, at) => (weekStartsOn + at) % 7);
}

/**
 * The rule as Todoist should receive it.
 *
 * `start` is the day the picker is on: the task's date, or the one just
 * chosen. A rule pinned to days of its own (weekdays, the 15th, 14 Jan)
 * finds them from there; one that only counts ("every 3 days") counts from
 * there. It is only written when it is after today, since today is where
 * Todoist starts anyway.
 */
export function buildRule(
  rule: RepeatRule, lang: RecurrenceLang, start: Date, today: Date = new Date(),
): RecurrenceReading {
  const fr = lang === 'fr';
  const n = Math.max(1, Math.round(rule.interval));
  const days = fr ? FR_DAYS : EN_DAYS;
  const parts: string[] = [];

  if (rule.fromCompletion) {
    const unit = fr
      ? ({ day: ['jour', 'jours'], workday: ['jour ouvré', 'jours ouvrés'], week: ['semaine', 'semaines'], month: ['mois', 'mois'], year: ['an', 'ans'] } as const)[rule.unit]
      : ({ day: ['day', 'days'], workday: ['workday', 'workdays'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] } as const)[rule.unit];
    parts.push(`${fr ? 'chaque!' : 'every!'} ${n > 1 ? `${n} ${unit[1]}` : unit[0]}`);
  } else {
    parts.push(core(rule, n, fr, days, start));
  }

  if (rule.time) parts.push(`${fr ? 'à' : 'at'} ${shortTime(rule.time)}`);
  /* From completion there is no start to keep: the next one is counted from
     whenever this one is done. */
  if (!rule.fromCompletion && isoDay(start) > isoDay(today)) {
    parts.push(`${fr ? 'à partir du' : 'starting'} ${isoDay(start)}`);
  }
  if (rule.end) parts.push(`${fr ? 'jusqu’au' : 'ending'} ${rule.end}`);

  const string = parts.join(' ');
  return { matched: string, index: 0, string, lang, fromCompletion: rule.fromCompletion };
}

function core(rule: RepeatRule, n: number, fr: boolean, days: string[], start: Date): string {
  switch (rule.unit) {
    case 'day':
      return fr
        ? (n > 1 ? `tous les ${n} jours` : 'tous les jours')
        : (n > 1 ? `every ${n} days` : 'every day');
    case 'workday':
      return fr
        ? (n > 1 ? `tous les ${n} jours ouvrés` : 'tous les jours ouvrés')
        : (n > 1 ? `every ${n} workdays` : 'every workday');
    case 'week': {
      const list = sortWeekdays(rule.weekdays).map((d) => days[d]).join(', ');
      if (!list) {
        return fr
          ? (n > 1 ? `toutes les ${n} semaines` : 'toutes les semaines')
          : (n > 1 ? `every ${n} weeks` : 'every week');
      }
      if (n === 1) return fr ? `tous les ${list}` : `every ${list}`;
      return fr ? `toutes les ${n} semaines ${list}` : `every ${n} weeks ${list}`;
    }
    case 'month': {
      if (n > 1) return fr ? `tous les ${n} mois` : `every ${n} months`;
      const anchor = rule.monthly;
      if (anchor === 'lastDay') return fr ? 'chaque dernier jour' : 'every last day';
      if (anchor === 'weekday') {
        const nth = weekOfMonth(start);
        const day = days[start.getDay()];
        if (nth > 4) return fr ? `chaque dernier ${day}` : `every last ${day}`;
        return fr ? `tous les ${frOrdinal(nth)} ${day}` : `every ${enOrdinal(nth)} ${day}`;
      }
      return fr ? `tous les ${frOrdinal(start.getDate())}` : `every ${enOrdinal(start.getDate())}`;
    }
    case 'year': {
      if (n > 1) return fr ? `tous les ${n} ans` : `every ${n} years`;
      const month = (fr ? FR_MONTHS : EN_MONTHS)[start.getMonth()];
      return fr ? `tous les ${start.getDate()} ${month}` : `every ${start.getDate()} ${month}`;
    }
  }
}

/* Monday first, Sunday last, whatever the user's week: the order Todoist
   writes them back in, so the string does not change on its way back. */
const sortWeekdays = (weekdays: number[]): number[] =>
  [...new Set(weekdays)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

/** "09:05" → "9:05": the form every probe was made with. */
const shortTime = (time: string): string => {
  const [h, m] = time.split(':');
  return `${Number(h)}:${m}`;
};

const fold = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, '\'');

const TIME = /\s+(?:at|@|a|vers)\s*(\d{1,2})(?:[:h.](\d{2})|h)?\s*(am|pm)?(?=\s|$)/;
const END = /\s+(?:ending|until|till|jusqu'?au)\s+(\d{4}-\d{2}-\d{2})/;
const START = /\s+(?:starting|from|a partir du|a partir de)\s+(\d{4}-\d{2}-\d{2})/;

const dayIndex = (word: string): number => {
  const w = word.slice(0, 3);
  const en = EN_DAYS.indexOf(w);
  return en >= 0 ? en : FR_DAYS.indexOf(w);
};

/**
 * What the panel should open on for a rule the task already has.
 *
 * Reads the forms buildRule writes and the ones Todoist writes back ("every 2
 * weeks mon, thu", "every monday"). Anything else is null: the panel then
 * opens on its defaults and says that saving replaces the current rule. The
 * day a monthly or yearly rule falls on is not read from here: it is the
 * day the task is on, which the panel already starts from.
 */
export function ruleFromString(raw: string): RepeatRule | null {
  let text = ` ${fold(raw).trim()}`;
  const rule: RepeatRule = {
    unit: 'week', interval: 1, weekdays: [], monthly: 'day', fromCompletion: false, time: null, end: null,
  };

  const end = text.match(END);
  if (end) { rule.end = end[1]; text = text.replace(END, ''); }
  text = text.replace(START, '');
  const time = text.match(TIME);
  if (time) {
    let hour = Number(time[1]);
    if (time[3] === 'pm' && hour < 12) hour += 12;
    if (time[3] === 'am' && hour === 12) hour = 0;
    if (hour > 23) return null;
    rule.time = `${pad(hour)}:${time[2] ?? '00'}`;
    text = text.replace(TIME, '');
  }

  const opener = text.trim().match(/^(?:every|each|tous les|toutes les|tous le|chaque)(!)?\s+(.+)$/);
  const shorthand: Record<string, RepeatUnit> = {
    daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year', annually: 'year',
    quotidien: 'day', quotidienne: 'day', hebdomadaire: 'week', mensuel: 'month', mensuelle: 'month',
    annuel: 'year', annuelle: 'year',
  };
  if (!opener) {
    const unit = shorthand[text.trim()];
    if (!unit) return null;
    return { ...rule, unit };
  }
  rule.fromCompletion = opener[1] === '!';
  const body = opener[2].trim();

  /* Before the counted units below: "jours ouvrés" starts with "jours". */
  const workdays = body.match(/^(?:(\d{1,3})\s+)?(?:workdays?|weekdays?|working days?|jours? ouvres?|jours? ouvrables?|jours? de (?:la )?semaine)$/);
  if (workdays) return { ...rule, unit: 'workday', interval: workdays[1] ? Number(workdays[1]) : 1 };

  const counted = body.match(/^(?:(\d{1,3})\s+|other\s+|deux\s+)?(days?|jours?|weeks?|semaines?|months?|mois|years?|ans?|annees?)(?:\s+(.+))?$/);
  if (counted) {
    const unitWord = counted[2];
    const unit: RepeatUnit = /^(day|jour)/.test(unitWord) ? 'day'
      : /^(week|semaine)/.test(unitWord) ? 'week'
        : /^(month|mois)/.test(unitWord) ? 'month' : 'year';
    const interval = counted[1] ? Number(counted[1]) : /^(other|deux)\s/.test(body) ? 2 : 1;
    const weekdays = counted[3] ? readWeekdays(counted[3]) : [];
    if (weekdays === null || (weekdays.length > 0 && unit !== 'week')) return null;
    return { ...rule, unit, interval, weekdays };
  }

  if (/^(?:last|derniers?)\s+(?:day|jours?)$/.test(body)) return { ...rule, unit: 'month', monthly: 'lastDay' };

  const nth = body.match(/^(?:\d(?:st|nd|rd|th|er|e)|first|second|third|fourth|last|premier|dernier)\s+([a-z]+)$/);
  if (nth && dayIndex(nth[1]) >= 0) return { ...rule, unit: 'month', monthly: 'weekday' };

  if (/^\d{1,2}(?:st|nd|rd|th|ers?|e)?$/.test(body)) return { ...rule, unit: 'month', monthly: 'day' };

  if (/^\d{1,2}(?:er)?\s+[a-z]+$|^[a-z]+\s+\d{1,2}$/.test(body)) return { ...rule, unit: 'year' };

  const other = body.match(/^(?:other|deux)\s+([a-z]+)$/);
  if (other && dayIndex(other[1]) >= 0) return { ...rule, interval: 2, weekdays: [dayIndex(other[1])] };

  const weekdays = readWeekdays(body);
  if (weekdays && weekdays.length > 0) return { ...rule, weekdays };
  return null;
}

function readWeekdays(text: string): number[] | null {
  const words = text.split(/\s*(?:,|\band\b|\bet\b|&)\s*/).filter(Boolean);
  const days = words.map(dayIndex);
  return days.every((d) => d >= 0) ? days : null;
}

/**
 * The same rule with another time, or without one.
 *
 * For the Time button on a task that repeats: its time lives in the rule
 * ("every mon at 9:15"), so changing it rewrites the rule rather than the
 * date. The time goes where Todoist wants it, after the rule and before any
 * start or end.
 */
export function ruleWithTime(raw: string, lang: RecurrenceLang, time: string | null): string {
  const folded = fold(raw);
  const bound = folded.search(/\s+(?:starting|from|ending|until|till|a partir|jusqu)/);
  const cut = bound >= 0 ? bound : raw.length;
  const head = raw.slice(0, cut);
  const tail = raw.slice(cut);
  /* Removed from the original text, so a rule typed in capitals or with
     accents keeps them. */
  const match = fold(head).match(TIME);
  const bare = match ? head.slice(0, match.index) + head.slice(match.index! + match[0].length) : head;
  const at = time ? ` ${lang === 'fr' ? 'à' : 'at'} ${shortTime(time)}` : '';
  return `${bare.trimEnd()}${at}${tail}`;
}

/**
 * A time typed in the Time panel, as "HH:MM": "20:30", "20h30", "20h", "8pm",
 * "8:15 am", a bare "9". Null for anything else, so the panel can say so
 * instead of guessing.
 */
export function readClock(raw: string): string | null {
  const match = raw.trim().toLowerCase().match(/^(\d{1,2})(?:\s*[:h.]\s*(\d{2})|\s*h)?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    if (match[3] === 'pm' && hour < 12) hour += 12;
    if (match[3] === 'am' && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

/** The time an API date string carries, as "HH:MM", or null for a day alone. */
export const timeOf = (value: string): string | null =>
  value.includes('T') ? value.slice(value.indexOf('T') + 1, value.indexOf('T') + 6) : null;

/** The day a rule should count from: the picker's day, or today when it has none. */
export const startOf = (value: string, today: Date = new Date()): Date =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), today.getDate());

/** A rule with nothing chosen yet: every week, on the start's own day. */
export const defaultRule = (start: Date, time: string | null): RepeatRule => ({
  unit: 'week', interval: 1, weekdays: [start.getDay()], monthly: 'day',
  fromCompletion: false, time, end: null,
});

/**
 * The first day a rule built here will land on, so the composer's chip can
 * say "Today" with the repeat mark, as Todoist does, instead of the rule's
 * words (#202).
 *
 * Narrow on purpose, like nextOccurrence.ts: Todoist resolves the rule, this
 * only predicts it for the shapes where the answer is plain, and says null
 * otherwise so the chip falls back to the rule itself. A time already past
 * today moves a daily or weekly rule to its next day, which is what Todoist
 * did when it was asked; a monthly or yearly one is left to Todoist.
 */
export function firstOccurrence(rule: RepeatRule, start: Date, now: Date = new Date()): Date | null {
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const passed = (d: Date) => rule.time !== null && isoDay(d) === isoDay(today) && rule.time <= clock;
  const next = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

  const fits = (d: Date): boolean => {
    if (rule.fromCompletion || rule.unit === 'day') return true;
    if (rule.unit === 'workday') return d.getDay() !== 0 && d.getDay() !== 6;
    if (rule.unit === 'week') return rule.weekdays.length === 0 || rule.weekdays.includes(d.getDay());
    return false;
  };

  if (rule.fromCompletion || rule.unit === 'day' || rule.unit === 'workday' || rule.unit === 'week') {
    /* A week with no weekdays repeats on the start's own day. */
    let at = day;
    for (let step = 0; step < 14; step += 1) {
      if (fits(at) && !passed(at)) return at;
      at = next(at);
    }
    return null;
  }
  /* The 15th, the 2nd Tuesday, 14 January: anchored on the start itself. */
  if ((rule.unit === 'month' && rule.monthly !== 'lastDay') || rule.unit === 'year') {
    return passed(day) ? null : day;
  }
  return null;
}

/**
 * The first day of a rule given as a string, with its time, as an API date:
 * for a rule typed in the composer's name, or one just rewritten by Time
 * (#202). A start written in the rule ("starting 2026-10-12") is where it
 * counts from; otherwise `from`, the day the picker was on, and failing that
 * today. A monthly or yearly rule is anchored on that day, so it is only
 * predicted when the day is known. Null when it is not plain.
 */
export function firstDayOfRule(raw: string, from: string | null = null, now: Date = new Date()): string | null {
  const read = ruleFromString(raw);
  if (!read || read.end && read.unit !== 'day' && read.unit !== 'workday' && read.unit !== 'week') return null;
  const written = fold(raw).match(START)?.[1] ?? null;
  const anchor = written ?? from;
  if ((read.unit === 'month' || read.unit === 'year') && !anchor) return null;
  const start = anchor ? new Date(`${anchor.slice(0, 10)}T00:00:00`) : now;
  const day = firstOccurrence(read, start, now);
  return day ? `${isoDay(day)}${read.time ? `T${read.time}:00` : ''}` : null;
}
