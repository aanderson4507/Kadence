import { RecurrenceFrequency, type Prisma } from "../generated/prisma/client.ts";
import {
  ValidationError,
  addDays,
  asObject,
  optionalDateOnly,
  parseEnum,
  requireInt,
} from "../validation.ts";

// Repeating tasks and planner events (user story 1.2, issue #3).
// A repeat is stored once as a RecurrenceRule, and every occurrence is its own row sharing a
// seriesId. Occurrences are clones of the original except for the date, so each one can be
// completed, rescheduled or deleted on its own.

/** Hard cap so a typo like "every day for 10 years" can't create thousands of rows. */
export const MAX_OCCURRENCES = 60;
/** Occurrences are generated at most this far ahead of the first date. */
const MAX_SPAN_DAYS = 366;

export type RepeatRule = {
  frequency: RecurrenceFrequency;
  intervalCount: number;
  /** WEEKLY only. Bit 0 = Sunday ... bit 6 = Saturday. */
  weekdays: number | null;
  endsOn: Date | null;
  maxOccurrences: number | null;
};

/**
 * Parses the optional `repeat` field of a create request:
 *   { frequency: "DAILY" | "WEEKLY" | "MONTHLY", intervalCount?: 1-30, weekdays?: 1-127,
 *     endsOn?: "YYYY-MM-DD" } or { ..., maxOccurrences?: 2-60 }
 * Returns null when the item does not repeat.
 */
export function parseRepeat(value: unknown, firstDate: Date | null): RepeatRule | null {
  if (value === undefined || value === null) return null;
  const body = asObject(value);
  const frequency = parseEnum(RecurrenceFrequency, body.frequency, "repeat.frequency");
  const intervalCount =
    body.intervalCount === undefined ? 1 : requireInt(body.intervalCount, "repeat.intervalCount", 1, 30);
  const weekdays =
    body.weekdays === undefined || body.weekdays === null
      ? null
      : requireInt(body.weekdays, "repeat.weekdays", 1, 127);
  if (weekdays !== null && frequency !== RecurrenceFrequency.WEEKLY) {
    throw new ValidationError("repeat.weekdays can only be used with a WEEKLY repeat.");
  }
  const endsOn = optionalDateOnly(body.endsOn, "repeat.endsOn");
  const maxOccurrences =
    body.maxOccurrences === undefined || body.maxOccurrences === null
      ? null
      : requireInt(body.maxOccurrences, "repeat.maxOccurrences", 2, MAX_OCCURRENCES);
  if (endsOn && maxOccurrences) {
    throw new ValidationError("Choose either an end date or a number of repeats, not both.");
  }
  if (!endsOn && !maxOccurrences) {
    throw new ValidationError("A repeat needs an end date or a number of repeats.");
  }
  if (!firstDate) {
    throw new ValidationError("A repeating item needs a date for its first occurrence.");
  }
  if (endsOn && endsOn < firstDate) {
    throw new ValidationError("repeat.endsOn must be on or after the first date.");
  }
  return { frequency, intervalCount, weekdays, endsOn, maxOccurrences };
}

function addMonthsClamped(first: Date, months: number): Date {
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(first.getUTCDate(), lastDay)));
}

/**
 * Every occurrence date on or after `first`. Monthly repeats on the 31st fall on the last day of
 * shorter months. Weekly repeats with `weekdays` visit those days in each active week (so `first`
 * itself is skipped if its weekday isn't selected); without it they repeat on `first`'s weekday.
 */
export function expandOccurrences(first: Date, rule: RepeatRule): Date[] {
  const limit = Math.min(rule.maxOccurrences ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const lastAllowed = rule.endsOn ?? addDays(first, MAX_SPAN_DAYS);
  const hardStop = addDays(first, MAX_SPAN_DAYS);
  const end = lastAllowed < hardStop ? lastAllowed : hardStop;
  const dates: Date[] = [];
  const push = (date: Date) => {
    if (date >= first && date <= end && dates.length < limit) dates.push(date);
  };

  if (rule.frequency === RecurrenceFrequency.DAILY) {
    for (let step = 0; dates.length < limit; step += rule.intervalCount) {
      const date = addDays(first, step);
      if (date > end) break;
      push(date);
    }
  } else if (rule.frequency === RecurrenceFrequency.MONTHLY) {
    for (let step = 0; dates.length < limit; step += rule.intervalCount) {
      const date = addMonthsClamped(first, step);
      if (date > end) break;
      push(date);
    }
  } else {
    const mask = rule.weekdays ?? 1 << first.getUTCDay();
    // Weeks start on Sunday for interval counting.
    const weekStart = addDays(first, -first.getUTCDay());
    for (let week = 0; dates.length < limit; week += rule.intervalCount) {
      const start = addDays(weekStart, week * 7);
      if (start > end) break;
      for (let weekday = 0; weekday < 7; weekday += 1) {
        if (mask & (1 << weekday)) push(addDays(start, weekday));
      }
    }
  }
  return dates;
}

export function recurrenceRuleData(
  userId: string,
  rule: RepeatRule,
): Prisma.RecurrenceRuleUncheckedCreateInput {
  return {
    userId,
    frequency: rule.frequency,
    intervalCount: rule.intervalCount,
    weekdays: rule.weekdays,
    endsOn: rule.endsOn,
    maxOccurrences: rule.maxOccurrences,
  };
}
