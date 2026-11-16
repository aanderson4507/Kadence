import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_REMINDERS_PER_DAY,
  inQuietHours,
  planNotifications,
  remindersFor,
  spreadMinutes,
  type PlanInput,
} from "./notificationService.ts";

// Reminders (user stories 1.3 #4 and 2.6 #13).

const settings: PlanInput["settings"] = {
  remindDailyPlanning: false,
  remindUpcoming: true,
  remindDeadline: true,
  remindWeeklyReview: true,
  reviewReminder: true,
  reviewDay: 5,
  reviewMinute: 990,
  quietStartMinute: null,
  quietEndMinute: null,
};

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return { today: "2026-11-16", weekday: 1, settings, rules: {}, tasks: [], events: [], ...overrides };
}

const task = (overrides: Partial<PlanInput["tasks"][number]> = {}): PlanInput["tasks"][number] => ({
  id: "t1",
  priority: "HIGH",
  dueDate: "2026-11-17",
  completed: false,
  inBacklog: false,
  remindersPerDay: null,
  ...overrides,
});

describe("reminder frequency", () => {
  it("uses the task's own setting, then the priority rule, then the default", () => {
    assert.equal(remindersFor({ priority: "HIGH", remindersPerDay: 6 }, { HIGH: 2 }), 6);
    assert.equal(remindersFor({ priority: "HIGH", remindersPerDay: null }, { HIGH: 2 }), 2);
    assert.equal(remindersFor({ priority: "HIGH", remindersPerDay: null }, {}), DEFAULT_REMINDERS_PER_DAY.HIGH);
    // A task can be silenced even if its priority normally reminds.
    assert.equal(remindersFor({ priority: "VERY_HIGH", remindersPerDay: 0 }, {}), 0);
  });

  it("reminds more important tasks more often by default", () => {
    assert.ok(DEFAULT_REMINDERS_PER_DAY.VERY_HIGH > DEFAULT_REMINDERS_PER_DAY.MEDIUM);
    assert.ok(DEFAULT_REMINDERS_PER_DAY.MEDIUM > DEFAULT_REMINDERS_PER_DAY.NONE);
  });

  it("spreads reminders evenly from 9:00", () => {
    assert.deepEqual(spreadMinutes(1), [540]);
    assert.deepEqual(spreadMinutes(4), [540, 720, 900, 1080]);
    assert.deepEqual(spreadMinutes(0), []);
  });
});

describe("planNotifications", () => {
  it("schedules N deadline reminders today for a task due tomorrow", () => {
    const planned = planNotifications(input({ tasks: [task({ remindersPerDay: 2 })] }));
    assert.deepEqual(
      planned.map((item) => [item.type, item.taskId, item.minute]),
      [
        ["DEADLINE", "t1", 540],
        ["DEADLINE", "t1", 900],
      ],
    );
  });

  it("uses UPCOMING_TASK for later due dates and skips tasks beyond a week", () => {
    const planned = planNotifications(
      input({
        rules: { LOW: 1 },
        tasks: [task({ id: "soon", priority: "LOW", dueDate: "2026-11-20" }), task({ id: "later", dueDate: "2026-11-30" })],
      }),
    );
    assert.deepEqual(planned.map((item) => [item.type, item.taskId]), [["UPCOMING_TASK", "soon"]]);
  });

  it("skips completed, backlog, undated and overdue tasks", () => {
    const planned = planNotifications(
      input({
        tasks: [
          task({ id: "done", completed: true }),
          task({ id: "backlog", inBacklog: true }),
          task({ id: "undated", dueDate: null }),
          task({ id: "overdue", dueDate: "2026-11-10" }),
        ],
      }),
    );
    assert.deepEqual(planned, []);
  });

  it("respects the reminder toggles and Do Not Disturb hours", () => {
    const noDeadlines = planNotifications(
      input({ settings: { ...settings, remindDeadline: false }, tasks: [task()] }),
    );
    assert.deepEqual(noDeadlines, []);

    // Quiet from 8:00 to 12:00 drops the 9:00 reminder but keeps the 15:00 one.
    const quiet = planNotifications(
      input({ settings: { ...settings, quietStartMinute: 480, quietEndMinute: 720 }, tasks: [task({ remindersPerDay: 2 })] }),
    );
    assert.deepEqual(quiet.map((item) => item.minute), [900]);
  });

  it("handles Do Not Disturb hours that wrap past midnight", () => {
    assert.equal(inQuietHours(23 * 60, 22 * 60, 7 * 60), true);
    assert.equal(inQuietHours(6 * 60, 22 * 60, 7 * 60), true);
    assert.equal(inQuietHours(12 * 60, 22 * 60, 7 * 60), false);
  });

  it("reminds about today's planner events an hour before they start", () => {
    const planned = planNotifications(
      input({
        events: [
          { id: "class", eventDate: "2026-11-16", startHour: 14, status: "NOT_STARTED", remindersPerDay: null, sourceTaskId: null },
          { id: "done", eventDate: "2026-11-16", startHour: 15, status: "DONE", remindersPerDay: null, sourceTaskId: null },
          { id: "tomorrow", eventDate: "2026-11-17", startHour: 9, status: "NOT_STARTED", remindersPerDay: null, sourceTaskId: null },
        ],
      }),
    );
    assert.deepEqual(planned.map((item) => [item.plannerEventId, item.minute]), [["class", 13 * 60]]);
  });

  it("adds the weekly review reminder only on the review day", () => {
    const friday = planNotifications(input({ weekday: 5 }));
    assert.deepEqual(friday.map((item) => [item.type, item.minute]), [["WEEKLY_REVIEW", 990]]);
    assert.deepEqual(planNotifications(input({ weekday: 4 })), []);
    assert.deepEqual(
      planNotifications(input({ weekday: 5, settings: { ...settings, reviewReminder: false } })),
      [],
    );
  });
});
