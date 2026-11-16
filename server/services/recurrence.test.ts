import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "../validation.ts";
import { MAX_OCCURRENCES, expandOccurrences, parseRepeat } from "./recurrence.ts";

// Repeatable tasks (user story 1.2, issue #3).

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);
const keys = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

describe("parseRepeat", () => {
  it("returns null when the item doesn't repeat", () => {
    assert.equal(parseRepeat(undefined, d("2026-11-16")), null);
  });

  it("needs a first date and exactly one way to end", () => {
    assert.throws(() => parseRepeat({ frequency: "DAILY", maxOccurrences: 3 }, null), /needs a date/);
    assert.throws(() => parseRepeat({ frequency: "DAILY" }, d("2026-11-16")), /end date or a number/);
    assert.throws(
      () => parseRepeat({ frequency: "DAILY", maxOccurrences: 3, endsOn: "2026-12-01" }, d("2026-11-16")),
      /not both/,
    );
  });

  it("rejects invalid values", () => {
    assert.throws(() => parseRepeat({ frequency: "HOURLY", maxOccurrences: 3 }, d("2026-11-16")), ValidationError);
    assert.throws(
      () => parseRepeat({ frequency: "DAILY", weekdays: 2, maxOccurrences: 3 }, d("2026-11-16")),
      /only be used with a WEEKLY/,
    );
    assert.throws(
      () => parseRepeat({ frequency: "DAILY", endsOn: "2026-11-01" }, d("2026-11-16")),
      /on or after the first date/,
    );
    assert.throws(
      () => parseRepeat({ frequency: "DAILY", maxOccurrences: MAX_OCCURRENCES + 1 }, d("2026-11-16")),
      ValidationError,
    );
  });
});

describe("expandOccurrences", () => {
  it("repeats daily with an interval until the count is reached", () => {
    const rule = parseRepeat({ frequency: "DAILY", intervalCount: 2, maxOccurrences: 3 }, d("2026-11-16"))!;
    assert.deepEqual(keys(expandOccurrences(d("2026-11-16"), rule)), ["2026-11-16", "2026-11-18", "2026-11-20"]);
  });

  it("repeats weekly on chosen weekdays until the end date", () => {
    // Monday (bit 1) and Wednesday (bit 3), from Monday Nov 16 through Nov 25.
    const rule = parseRepeat(
      { frequency: "WEEKLY", weekdays: (1 << 1) | (1 << 3), endsOn: "2026-11-25" },
      d("2026-11-16"),
    )!;
    assert.deepEqual(keys(expandOccurrences(d("2026-11-16"), rule)), [
      "2026-11-16",
      "2026-11-18",
      "2026-11-23",
      "2026-11-25",
    ]);
  });

  it("repeats weekly on the first date's weekday by default", () => {
    const rule = parseRepeat({ frequency: "WEEKLY", maxOccurrences: 3 }, d("2026-11-19"))!;
    assert.deepEqual(keys(expandOccurrences(d("2026-11-19"), rule)), ["2026-11-19", "2026-11-26", "2026-12-03"]);
  });

  it("keeps monthly repeats on the 31st inside shorter months", () => {
    const rule = parseRepeat({ frequency: "MONTHLY", maxOccurrences: 3 }, d("2027-01-31"))!;
    assert.deepEqual(keys(expandOccurrences(d("2027-01-31"), rule)), ["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("never creates more than the cap, even with a far end date", () => {
    const rule = parseRepeat({ frequency: "DAILY", endsOn: "2030-01-01" }, d("2026-11-16"))!;
    assert.equal(expandOccurrences(d("2026-11-16"), rule).length, MAX_OCCURRENCES);
  });
});
