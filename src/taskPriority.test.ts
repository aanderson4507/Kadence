import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToKey,
  daysUntil,
  describeUrgency,
  priorityScore,
  sortTasksByPriority,
  urgencyPoints,
  type RankableTask,
} from "./taskPriority.ts";

const TODAY = "2026-11-12";
const inDays = (days: number) => addDaysToKey(TODAY, days);

function task(title: string, fields: Partial<RankableTask> = {}): RankableTask {
  return { title, priority: "None", completed: false, ...fields };
}

const order = (tasks: RankableTask[]) => sortTasksByPriority(tasks, TODAY).map((item) => item.title);

describe("date helpers", () => {
  it("counts whole days across month and year boundaries", () => {
    assert.equal(daysUntil("2026-12-01", "2026-11-30"), 1);
    assert.equal(daysUntil("2027-01-01", "2026-12-31"), 1);
    assert.equal(daysUntil("2026-11-10", TODAY), -2);
    assert.equal(addDaysToKey("2026-03-07", 2), "2026-03-09"); // across a US DST change
  });
});

describe("urgencyPoints", () => {
  it("is highest when overdue and fades to nothing a week out", () => {
    const points = [-3, 0, 1, 2, 3, 6, 7, 30].map(urgencyPoints);
    assert.deepEqual(points, [25, 20, 16, 14, 11, 2, 0, 0]);
    assert.equal(urgencyPoints(null), 0);
  });
});

describe("priorityScore", () => {
  it("adds level, exam bonus and urgency", () => {
    assert.equal(priorityScore(task("x", { priority: "High" }), TODAY), 40);
    assert.equal(priorityScore(task("x", { priority: "High", isExam: true }), TODAY), 50);
    assert.equal(priorityScore(task("x", { priority: "High", isExam: true, dueDate: inDays(1) }), TODAY), 66);
  });
});

describe("sortTasksByPriority", () => {
  it("orders by priority level when nothing else differs", () => {
    assert.deepEqual(
      order([
        task("none"),
        task("low", { priority: "Low" }),
        task("very high", { priority: "Very High" }),
        task("medium", { priority: "Medium" }),
        task("very low", { priority: "Very Low" }),
        task("high", { priority: "High" }),
      ]),
      ["very high", "high", "medium", "low", "very low", "none"],
    );
  });

  it("ranks an exam above an otherwise identical task", () => {
    assert.deepEqual(
      order([
        task("essay", { priority: "High", dueDate: inDays(4) }),
        task("exam", { priority: "High", dueDate: inDays(4), isExam: true }),
      ]),
      ["exam", "essay"],
    );
  });

  it("ranks a High exam level with a Very High task", () => {
    // Exam bonus is worth exactly one level; the due date breaks the tie.
    assert.deepEqual(
      order([
        task("very high, later", { priority: "Very High", dueDate: inDays(10) }),
        task("high exam, sooner", { priority: "High", isExam: true, dueDate: inDays(8) }),
      ]),
      ["high exam, sooner", "very high, later"],
    );
  });

  it("puts sooner deadlines first within the same priority", () => {
    assert.deepEqual(
      order([
        task("next week", { priority: "Medium", dueDate: inDays(7) }),
        task("no date", { priority: "Medium" }),
        task("tomorrow", { priority: "Medium", dueDate: inDays(1) }),
        task("overdue", { priority: "Medium", dueDate: inDays(-2) }),
      ]),
      ["overdue", "tomorrow", "next week", "no date"],
    );
  });

  it("lets urgency lift a task about two levels, but not more", () => {
    assert.deepEqual(
      order([
        task("high, next week", { priority: "High", dueDate: inDays(7) }),
        task("medium, overdue", { priority: "Medium", dueDate: inDays(-1) }),
      ]),
      ["medium, overdue", "high, next week"],
    );
    assert.deepEqual(
      order([
        task("low, tomorrow", { priority: "Low", dueDate: inDays(1) }),
        task("high, no date", { priority: "High" }),
      ]),
      ["high, no date", "low, tomorrow"],
    );
    assert.deepEqual(
      order([
        task("none, overdue", { priority: "None", dueDate: inDays(-5) }),
        task("medium, no date", { priority: "Medium" }),
      ]),
      ["medium, no date", "none, overdue"],
    );
  });

  it("always puts completed tasks last", () => {
    assert.deepEqual(
      order([
        task("done very high exam", { priority: "Very High", isExam: true, completed: true }),
        task("open none"),
      ]),
      ["open none", "done very high exam"],
    );
  });

  it("is stable for exact ties by sorting on title", () => {
    assert.deepEqual(order([task("b"), task("a"), task("c")]), ["a", "b", "c"]);
  });

  it("does not modify the input array", () => {
    const tasks = [task("low", { priority: "Low" }), task("high", { priority: "High" })];
    sortTasksByPriority(tasks, TODAY);
    assert.deepEqual(tasks.map((item) => item.title), ["low", "high"]);
  });
});

describe("describeUrgency", () => {
  it("explains why a task ranks where it does", () => {
    assert.equal(describeUrgency(task("x", { isExam: true, dueDate: inDays(3) }), TODAY), "Exam · due in 3 days");
    assert.equal(describeUrgency(task("x", { dueDate: inDays(-1) }), TODAY), "overdue by 1 day");
    assert.equal(describeUrgency(task("x", { dueDate: TODAY }), TODAY), "due today");
    assert.equal(describeUrgency(task("x"), TODAY), "");
  });
});
