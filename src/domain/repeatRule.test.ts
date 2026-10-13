import { describe, expect, it } from 'vitest';
import { buildRule, defaultRule, firstDayOfRule, firstOccurrence, readClock, ruleFromString, ruleWithTime, type RepeatRule } from './repeatRule';
import { readRecurrence } from './recurrence';

const today = new Date(2026, 9, 11); // Sunday 11 Oct 2026
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const rule = (patch: Partial<RepeatRule>): RepeatRule => ({ ...defaultRule(today, null), weekdays: [], ...patch });

/* Every string below was sent to Todoist's API and accepted (2026-10-11). */
const cases: Array<[Partial<RepeatRule>, Date, string, string]> = [
  [{ unit: 'day' }, today, 'every day', 'tous les jours'],
  [{ unit: 'day', interval: 3 }, today, 'every 3 days', 'tous les 3 jours'],
  [{ unit: 'week' }, today, 'every week', 'toutes les semaines'],
  [{ unit: 'workday' }, today, 'every workday', 'tous les jours ouvrés'],
  [{ unit: 'workday', interval: 2, time: '09:00' }, today, 'every 2 workdays at 9:00', 'tous les 2 jours ouvrés à 9:00'],
  [{ unit: 'workday', fromCompletion: true }, today, 'every! workday', 'chaque! jour ouvré'],
  [{ unit: 'week', weekdays: [4, 1] }, today, 'every mon, thu', 'tous les lun, jeu'],
  [{ unit: 'week', interval: 2, weekdays: [1, 4] }, today, 'every 2 weeks mon, thu', 'toutes les 2 semaines lun, jeu'],
  [{ unit: 'month' }, day(2026, 10, 15), 'every 15th starting 2026-10-15', 'tous les 15e à partir du 2026-10-15'],
  [{ unit: 'month' }, day(2026, 11, 1), 'every 1st starting 2026-11-01', 'tous les 1er à partir du 2026-11-01'],
  [{ unit: 'month', monthly: 'weekday' }, day(2026, 10, 13), 'every 2nd tue starting 2026-10-13', 'tous les 2e mar à partir du 2026-10-13'],
  [{ unit: 'month', monthly: 'weekday' }, day(2026, 10, 30), 'every last fri starting 2026-10-30', 'chaque dernier ven à partir du 2026-10-30'],
  [{ unit: 'month', monthly: 'lastDay' }, today, 'every last day', 'chaque dernier jour'],
  [{ unit: 'month', interval: 2 }, day(2026, 10, 15), 'every 2 months starting 2026-10-15', 'tous les 2 mois à partir du 2026-10-15'],
  [{ unit: 'year' }, day(2027, 1, 14), 'every 14 jan starting 2027-01-14', 'tous les 14 janv à partir du 2027-01-14'],
  [{ unit: 'year', interval: 2 }, today, 'every 2 years', 'tous les 2 ans'],
  [{ unit: 'day', fromCompletion: true, interval: 3 }, day(2026, 10, 20), 'every! 3 days', 'chaque! 3 jours'],
  [{ unit: 'week', fromCompletion: true }, today, 'every! week', 'chaque! semaine'],
  [{ unit: 'day', time: '20:30' }, today, 'every day at 20:30', 'tous les jours à 20:30'],
  [{ unit: 'week', weekdays: [1], time: '09:15', end: '2026-12-31' }, today, 'every mon at 9:15 ending 2026-12-31', 'tous les lun à 9:15 jusqu’au 2026-12-31'],
  [{ unit: 'day', interval: 3, time: '09:00', end: '2026-12-31' }, day(2026, 10, 20), 'every 3 days at 9:00 starting 2026-10-20 ending 2026-12-31', 'tous les 3 jours à 9:00 à partir du 2026-10-20 jusqu’au 2026-12-31'],
];

describe('buildRule', () => {
  it.each(cases)('%o from %s', (patch, start, en, fr) => {
    expect(buildRule(rule(patch), 'en', start, today).string).toBe(en);
    expect(buildRule(rule(patch), 'fr', start, today).string).toBe(fr);
  });

  it('puts the time before the start, the order Todoist needs', () => {
    const built = buildRule(rule({ unit: 'month', interval: 2, time: '08:00' }), 'en', day(2026, 10, 15), today).string;
    expect(built).toBe('every 2 months at 8:00 starting 2026-10-15');
  });

  it('reports a rule counted from completion', () => {
    expect(buildRule(rule({ unit: 'day', fromCompletion: true }), 'fr', today, today)).toMatchObject({
      string: 'chaque! jour', lang: 'fr', fromCompletion: true,
    });
  });

  it('builds strings the typed-rule reader reads back whole, in both languages', () => {
    for (const [patch, start, en, fr] of cases) {
      for (const [lang, expected] of [['en', en], ['fr', fr]] as const) {
        const built = buildRule(rule(patch), lang, start, today).string;
        expect(readRecurrence(built)?.matched, built).toBe(expected);
      }
    }
  });
});

describe('ruleFromString', () => {
  it('reads back what buildRule wrote', () => {
    for (const [patch, start] of cases) {
      for (const lang of ['en', 'fr'] as const) {
        const built = buildRule(rule(patch), lang, start, today).string;
        const read = ruleFromString(built);
        const want = rule(patch);
        expect(read, built).not.toBeNull();
        expect(read!.unit, built).toBe(want.unit);
        expect(read!.interval, built).toBe(want.fromCompletion ? want.interval : want.interval);
        expect(read!.fromCompletion, built).toBe(want.fromCompletion);
        expect(read!.time, built).toBe(want.time);
        expect(read!.end, built).toBe(want.end);
        expect([...read!.weekdays].sort(), built).toEqual([...want.weekdays].sort());
        if (want.unit === 'month' && want.interval === 1) expect(read!.monthly, built).toBe(want.monthly);
      }
    }
  });

  it('reads the forms Todoist writes back and the usual typed ones', () => {
    expect(ruleFromString('every monday')).toMatchObject({ unit: 'week', weekdays: [1] });
    expect(ruleFromString('every other fri')).toMatchObject({ unit: 'week', interval: 2, weekdays: [5] });
    expect(ruleFromString('every 2 months @ 08:00')).toMatchObject({ unit: 'month', interval: 2, time: '08:00' });
    expect(ruleFromString('Every day at 8pm')).toMatchObject({ unit: 'day', time: '20:00' });
    expect(ruleFromString('quotidien')).toMatchObject({ unit: 'day' });
    expect(ruleFromString('chaque année')).toMatchObject({ unit: 'year' });
  });

  it('gives up on what it cannot read rather than guessing', () => {
    expect(ruleFromString('every first workday')).toBeNull();
    expect(ruleFromString('buy milk')).toBeNull();
  });
});

describe('readClock', () => {
  it('reads the usual ways of writing a time', () => {
    expect(readClock('20:30')).toBe('20:30');
    expect(readClock('20h30')).toBe('20:30');
    expect(readClock('20h')).toBe('20:00');
    expect(readClock('8pm')).toBe('20:00');
    expect(readClock('8:15 am')).toBe('08:15');
    expect(readClock('12am')).toBe('00:00');
    expect(readClock('9')).toBe('09:00');
  });

  it('refuses what is not a time', () => {
    expect(readClock('25:00')).toBeNull();
    expect(readClock('9:75')).toBeNull();
    expect(readClock('13pm')).toBeNull();
    expect(readClock('tomorrow')).toBeNull();
  });
});

describe('ruleWithTime', () => {
  it('adds, replaces and removes the time, before any end', () => {
    expect(ruleWithTime('every mon', 'en', '09:15')).toBe('every mon at 9:15');
    expect(ruleWithTime('every mon at 9:15', 'en', '20:00')).toBe('every mon at 20:00');
    expect(ruleWithTime('every mon at 9:15 ending 2026-12-31', 'en', null)).toBe('every mon ending 2026-12-31');
    expect(ruleWithTime('tous les lun jusqu’au 2026-12-31', 'fr', '9:00')).toBe('tous les lun à 9:00 jusqu’au 2026-12-31');
    expect(ruleWithTime('Tous les jours à 20h', 'fr', '07:30')).toBe('Tous les jours à 7:30');
  });
});

describe('firstOccurrence', () => {
  const evening = new Date(2026, 9, 11, 21, 20); // Sunday 11 Oct, 21:20
  const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);

  it('is the start for a daily rule, the next day once its time has passed', () => {
    expect(iso(firstOccurrence(rule({ unit: 'day' }), today, evening))).toBe('2026-10-11');
    expect(iso(firstOccurrence(rule({ unit: 'day', time: '12:00' }), today, evening))).toBe('2026-10-12');
    expect(iso(firstOccurrence(rule({ unit: 'day', time: '22:00' }), today, evening))).toBe('2026-10-11');
  });

  it('finds the first matching weekday or workday', () => {
    expect(iso(firstOccurrence(rule({ unit: 'week', weekdays: [1, 4] }), today, evening))).toBe('2026-10-12');
    expect(iso(firstOccurrence(rule({ unit: 'workday' }), today, evening))).toBe('2026-10-12');
    expect(iso(firstOccurrence(rule({ unit: 'week' }), today, evening))).toBe('2026-10-11');
  });

  it('keeps the anchored day of a monthly or yearly rule, and gives up when unsure', () => {
    expect(iso(firstOccurrence(rule({ unit: 'month' }), day(2026, 10, 15), evening))).toBe('2026-10-15');
    expect(iso(firstOccurrence(rule({ unit: 'year' }), day(2027, 1, 14), evening))).toBe('2027-1-14');
    expect(firstOccurrence(rule({ unit: 'month', monthly: 'lastDay' }), today, evening)).toBeNull();
    expect(firstOccurrence(rule({ unit: 'month', time: '09:00' }), today, evening)).toBeNull();
  });
});

describe('firstDayOfRule', () => {
  const evening = new Date(2026, 9, 11, 21, 20);
  it('counts from a start written in the rule', () => {
    expect(firstDayOfRule('every day starting 2026-10-12', null, evening)).toBe('2026-10-12');
    expect(firstDayOfRule('every day at 9:30 starting 2026-10-12', null, evening)).toBe('2026-10-12T09:30:00');
    expect(firstDayOfRule('tous les jours à partir du 2026-10-14', null, evening)).toBe('2026-10-14');
  });
  it('counts from the given day, then today', () => {
    expect(firstDayOfRule('every mon', null, evening)).toBe('2026-10-12');
    expect(firstDayOfRule('every 15th', '2026-10-15', evening)).toBe('2026-10-15');
    expect(firstDayOfRule('every 15th', null, evening)).toBeNull();
  });
});
