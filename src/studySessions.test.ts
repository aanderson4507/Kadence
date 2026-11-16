import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STUDY_PREFERENCES,
  scheduleStudySessions,
  validateStudyPreferences,
  type BusyBlock,
  type ExamTask,
  type StudyPreferences,
  type StudySession,
} from "./studySessions.ts";
import { addDaysToKey } from "./taskPriority.ts";

const TODAY = "2026-11-12";
const inDays = (days: number) => addDaysToKey(TODAY, days);

function exam(id: string, dueInDays: number, fields: Partial<ExamTask> = {}): ExamTask {
  return {
    id,
    title: `Exam ${id}`,
    priority: "High",
    completed: false,
    isExam: true,
    dueDate: inDays(dueInDays),
    ...fields,
  };
}

function prefs(overrides: Partial<StudyPreferences> = {}): StudyPreferences {
  return { ...DEFAULT_STUDY_PREFERENCES, ...overrides };
}

function plan(tasks: ExamTask[], preferences = prefs(), busy: BusyBlock[] = [], currentHour?: number) {
  return scheduleStudySessions(tasks, preferences, busy, { today: TODAY, currentHour });
}

const slots = (sessions: StudySession[]) => sessions.map((s) => `${s.date} ${s.startHour}-${s.startHour + s.duration}`);

/** Invariants every generated plan must satisfy. */
function assertConsistent(sessions: StudySession[], preferences: StudyPreferences, busy: BusyBlock[] = []) {
  for (const session of sessions) {
    assert.ok(session.startHour >= preferences.windowStartHour, "starts inside the window");
    assert.ok(session.startHour + session.duration <= preferences.windowEndHour, "ends inside the window");
    assert.equal(session.duration, preferences.sessionHours, "uses the preferred length");
    assert.ok(session.date < session.examDate, "is before the exam");
    assert.ok(session.date >= TODAY, "is not in the past");
    assert.ok(session.date >= addDaysToKey(session.examDate, -preferences.daysBeforeExam), "is in the lead-up days");
  }
  const blocks = [
    ...busy.map((b) => ({ date: b.date, start: b.startHour, end: b.startHour + b.duration })),
    ...sessions.map((s) => ({ date: s.date, start: s.startHour, end: s.startHour + s.duration })),
  ];
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i];
      const b = blocks[j];
      assert.ok(a.date !== b.date || a.end <= b.start || b.end <= a.start, "nothing overlaps");
    }
  }
}

describe("scheduleStudySessions", () => {
  it("schedules one session on each of the days right before the exam", () => {
    const { sessions, shortfalls } = plan([exam("calc", 6)]);
    assert.deepEqual(slots(sessions), [`${inDays(3)} 16-17`, `${inDays(4)} 16-17`, `${inDays(5)} 16-17`]);
    assert.deepEqual(shortfalls, []);
    assert.equal(sessions[0].examTitle, "Exam calc");
  });

  it("follows the session length, count and window preferences", () => {
    const preferences = prefs({ daysBeforeExam: 2, sessionHours: 2, sessionsPerDay: 2, windowStartHour: 9, windowEndHour: 17 });
    const { sessions } = plan([exam("bio", 5)], preferences);
    // Two 2-hour sessions per day with a one-hour break between them.
    assert.deepEqual(slots(sessions), [
      `${inDays(3)} 9-11`, `${inDays(3)} 12-14`,
      `${inDays(4)} 9-11`, `${inDays(4)} 12-14`,
    ]);
    assertConsistent(sessions, preferences);
  });

  it("drops the break between sessions when the window is too tight for one", () => {
    const preferences = prefs({ daysBeforeExam: 1, sessionHours: 2, sessionsPerDay: 2, windowStartHour: 18, windowEndHour: 22 });
    const { sessions, shortfalls } = plan([exam("chem", 2)], preferences);
    assert.deepEqual(slots(sessions), [`${inDays(1)} 18-20`, `${inDays(1)} 20-22`]);
    assert.deepEqual(shortfalls, []);
  });

  it("works around events already on the calendar", () => {
    const busy: BusyBlock[] = [
      { date: inDays(1), startHour: 16, duration: 2 },
      { date: inDays(2), startHour: 15, duration: 6 }, // the whole window
    ];
    const preferences = prefs({ daysBeforeExam: 2 });
    const { sessions, shortfalls } = plan([exam("hist", 3)], preferences, busy);
    assert.deepEqual(slots(sessions), [`${inDays(1)} 18-19`]);
    assert.deepEqual(shortfalls, [{ examId: "hist", examTitle: "Exam hist", date: inDays(2), missing: 1 }]);
    assertConsistent(sessions, preferences, busy);
  });

  it("only uses days that haven't passed when the exam is close", () => {
    const { sessions } = plan([exam("quiz", 2)], prefs({ daysBeforeExam: 5 }));
    assert.deepEqual(slots(sessions), [`${TODAY} 16-17`, `${inDays(1)} 16-17`]);
  });

  it("skips hours that have already gone by today", () => {
    const preferences = prefs({ daysBeforeExam: 1 });
    assert.deepEqual(slots(plan([exam("q", 1)], preferences, [], 17.5).sessions), [`${TODAY} 18-19`]);
    const late = plan([exam("q", 1)], preferences, [], 20.25);
    assert.deepEqual(late.sessions, []);
    assert.deepEqual(late.shortfalls, [{ examId: "q", examTitle: "Exam q", date: TODAY, missing: 1 }]);
  });

  it("gives the higher-priority exam first pick when exams compete", () => {
    const preferences = prefs({ daysBeforeExam: 1, windowStartHour: 18, windowEndHour: 19 });
    const { sessions, shortfalls } = plan(
      [exam("low", 2, { priority: "Low" }), exam("top", 2, { priority: "Very High" })],
      preferences,
    );
    assert.deepEqual(sessions.map((s) => s.examId), ["top"]);
    assert.deepEqual(shortfalls.map((s) => s.examId), ["low"]);
  });

  it("fits several exams in the same week without overlaps", () => {
    const preferences = prefs({ daysBeforeExam: 4, sessionsPerDay: 2, windowStartHour: 15, windowEndHour: 21 });
    const busy: BusyBlock[] = [{ date: inDays(2), startHour: 17, duration: 1 }];
    const { sessions, shortfalls } = plan(
      [exam("a", 5, { priority: "Very High" }), exam("b", 4, { priority: "Medium" }), exam("c", 6)],
      preferences,
      busy,
    );
    assertConsistent(sessions, preferences, busy);
    // Every requested session (3 exams × 4 days × 2) is either placed or reported missing.
    assert.equal(sessions.length + shortfalls.reduce((sum, s) => sum + s.missing, 0), 3 * 4 * 2);
    // Output is in calendar order.
    assert.deepEqual(slots(sessions), [...slots(sessions)].sort((a, b) => a.localeCompare(b, "en", { numeric: true })));
  });

  it("ignores tasks that aren't open, future exams", () => {
    const { sessions } = plan([
      exam("done", 3, { completed: true }),
      exam("past", -1),
      exam("today", 0),
      exam("no-date", 3, { dueDate: undefined }),
      exam("not-exam", 3, { isExam: false }),
    ]);
    assert.deepEqual(sessions, []);
  });

  it("produces the same plan every time for the same input", () => {
    const tasks = [exam("a", 4), exam("b", 4, { priority: "Very High" })];
    const preferences = prefs({ sessionsPerDay: 2 });
    assert.deepEqual(plan(tasks, preferences), plan([...tasks].reverse(), preferences));
  });

  it("schedules nothing for invalid preferences", () => {
    assert.deepEqual(plan([exam("a", 4)], prefs({ windowStartHour: 20, windowEndHour: 18 })), {
      sessions: [],
      shortfalls: [],
    });
  });
});

describe("validateStudyPreferences", () => {
  it("accepts the defaults", () => {
    assert.equal(validateStudyPreferences(DEFAULT_STUDY_PREFERENCES), null);
  });

  it("enforces the database limits", () => {
    const cases: [Partial<StudyPreferences>, RegExp][] = [
      [{ daysBeforeExam: 0 }, /1 to 30/],
      [{ daysBeforeExam: 31 }, /1 to 30/],
      [{ sessionHours: 9 }, /1 to 8/],
      [{ sessionsPerDay: 7 }, /1 to 6/],
      [{ sessionsPerDay: 1.5 }, /1 to 6/],
      [{ windowStartHour: 21, windowEndHour: 21 }, /end after it starts/],
      [{ windowEndHour: 25 }, /end after it starts/],
      [{ windowStartHour: 20, windowEndHour: 21, sessionHours: 2 }, /shorter than one study session/],
    ];
    for (const [overrides, message] of cases) {
      assert.match(validateStudyPreferences(prefs(overrides)) ?? "", message);
    }
  });
});
