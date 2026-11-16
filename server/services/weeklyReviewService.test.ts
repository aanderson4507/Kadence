import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeWeek, weekStartFor } from "./weeklyReviewService.ts";

// Weekly review (user story 1.4, issue #5).

type ReviewTask = Parameters<typeof summarizeWeek>[0][number];

const task = (overrides: Partial<ReviewTask>): ReviewTask => ({
  id: overrides.title ?? "t",
  goalId: null,
  title: "t",
  category: "General",
  priority: "MEDIUM",
  dueDate: null,
  originalDueDate: null,
  completed: false,
  completedDate: null,
  isExam: false,
  remindersPerDay: null,
  inBacklog: false,
  seriesId: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

describe("weekStartFor", () => {
  it("follows the user's week-start preference", () => {
    const wednesday = new Date("2026-11-18T00:00:00.000Z");
    assert.equal(weekStartFor(wednesday, "MONDAY").toISOString().slice(0, 10), "2026-11-16");
    assert.equal(weekStartFor(wednesday, "SUNDAY").toISOString().slice(0, 10), "2026-11-15");
    assert.equal(weekStartFor(wednesday, "SATURDAY").toISOString().slice(0, 10), "2026-11-14");
  });
});

describe("summarizeWeek", () => {
  const week = ["2026-11-16", "2026-11-22"] as const;

  it("splits the week into completed, pending and overdue work", () => {
    const summary = summarizeWeek(
      [
        task({ title: "done", completed: true, completedDate: "2026-11-17", dueDate: "2026-11-18" }),
        task({ title: "late", dueDate: "2026-11-17" }),
        task({ title: "soon", dueDate: "2026-11-20" }),
        task({ title: "next week", dueDate: "2026-11-24" }),
        task({ title: "parked", dueDate: "2026-11-19", inBacklog: true }),
      ],
      ...week,
      "2026-11-18",
    );
    assert.deepEqual(summary.completed.map((item) => item.title), ["done"]);
    assert.deepEqual(summary.overdue.map((item) => item.title), ["late"]);
    assert.deepEqual(summary.pending.map((item) => item.title), ["soon"]);
    assert.equal(summary.completionRate, 33);
  });

  it("counts completions and due dates per day for the chart", () => {
    const summary = summarizeWeek(
      [task({ title: "a", completed: true, completedDate: "2026-11-16", dueDate: "2026-11-16" })],
      ...week,
      "2026-11-18",
    );
    assert.equal(summary.days.length, 7);
    assert.deepEqual(summary.days[0], { date: "2026-11-16", completed: 1, due: 1 });
    assert.deepEqual(summary.days[6], { date: "2026-11-22", completed: 0, due: 0 });
  });

  it("reports 0% for an empty week instead of dividing by zero", () => {
    assert.equal(summarizeWeek([], ...week, "2026-11-18").completionRate, 0);
  });
});
