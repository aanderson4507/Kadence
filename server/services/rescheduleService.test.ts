import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planReschedule, type MissedTask, type Window } from "./rescheduleService.ts";

// Rescheduling missed tasks into open time slots (user story 1.2, issue #3).

// 2026-11-16 is a Monday (weekday 1).
const evenings: Window[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 18 * 60, endMinute: 21 * 60 }));
const missed = (id: string, priority: MissedTask["priority"] = "MEDIUM"): MissedTask => ({
  id,
  title: id,
  priority,
  dueDate: "2026-11-13",
  isExam: false,
});
const options = { today: "2026-11-16", currentHour: 9, dailyLimit: 3 };

describe("planReschedule", () => {
  it("moves missed tasks into the earliest open slots, most important first", () => {
    const { assignments, unplaced } = planReschedule([missed("low", "LOW"), missed("high", "HIGH")], evenings, [], options);
    assert.deepEqual(assignments, [
      { taskId: "high", date: "2026-11-16", startHour: 18 },
      { taskId: "low", date: "2026-11-16", startHour: 19 },
    ]);
    assert.deepEqual(unplaced, []);
  });

  it("never overlaps events already in the planner", () => {
    const busy = [{ date: "2026-11-16", startHour: 18, durationHours: 2 }];
    const { assignments } = planReschedule([missed("a")], evenings, busy, options);
    assert.deepEqual(assignments, [{ taskId: "a", date: "2026-11-16", startHour: 20 }]);
  });

  it("skips hours that have already passed today", () => {
    const { assignments } = planReschedule([missed("a")], evenings, [], { ...options, currentHour: 19.5 });
    assert.deepEqual(assignments, [{ taskId: "a", date: "2026-11-16", startHour: 20 }]);
  });

  it("moves at most dailyLimit tasks onto one day", () => {
    const { assignments } = planReschedule(
      [missed("a"), missed("b"), missed("c")],
      evenings,
      [],
      { ...options, dailyLimit: 2 },
    );
    assert.deepEqual(
      assignments.map((item) => item.date),
      ["2026-11-16", "2026-11-16", "2026-11-17"],
    );
  });

  it("only uses days that have a window, and reports tasks that don't fit", () => {
    const saturdayOnly: Window[] = [{ weekday: 6, startMinute: 10 * 60, endMinute: 11 * 60 }];
    const { assignments, unplaced } = planReschedule(
      [missed("a"), missed("b"), missed("c")],
      saturdayOnly,
      [],
      options,
    );
    // One one-hour slot per Saturday, two Saturdays in the two-week search.
    assert.deepEqual(assignments.map((item) => item.date), ["2026-11-21", "2026-11-28"]);
    assert.equal(unplaced.length, 1);
  });
});
