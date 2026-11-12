// Study session scheduling (user story: Kadence schedules study sessions in the days right
// before an exam).
//
// For every open exam with a future due date:
//   - Study days are the `daysBeforeExam` days immediately before the exam (never the exam
//     day itself, never days that have already passed).
//   - Each study day gets up to `sessionsPerDay` sessions of `sessionHours`, inside the study
//     window [windowStartHour, windowEndHour).
//   - Sessions take the earliest free hour that doesn't overlap the student's planner events
//     or sessions already scheduled. Sessions on the same day are separated by a one-hour
//     break when the window has room; otherwise they may run back to back.
//   - Exams are scheduled in priority order (see taskPriority.ts), so when two exams compete
//     for the same evening the more important one gets it.
//   - Anything that can't be placed is reported as a shortfall instead of being silently
//     dropped, so the page can tell the student.

import { addDaysToKey, sortTasksByPriority, type Priority, type RankableTask } from "./taskPriority";

export type StudyPreferences = {
  daysBeforeExam: number;
  sessionHours: number;
  sessionsPerDay: number;
  /** 0-23 */
  windowStartHour: number;
  /** 1-24, greater than windowStartHour */
  windowEndHour: number;
};

export const DEFAULT_STUDY_PREFERENCES: StudyPreferences = {
  daysBeforeExam: 3,
  sessionHours: 1,
  sessionsPerDay: 1,
  windowStartHour: 16,
  windowEndHour: 21,
};

export type ExamTask = RankableTask & { id: string };

/** Time already taken on the student's calendar. */
export type BusyBlock = { date: string; startHour: number; duration: number };

export type StudySession = {
  id: string;
  examId: string;
  examTitle: string;
  examDate: string;
  priority: Priority;
  date: string;
  startHour: number;
  duration: number;
};

export type StudyShortfall = {
  examId: string;
  examTitle: string;
  date: string;
  /** Sessions that couldn't fit on this day. */
  missing: number;
};

export type StudyPlan = {
  sessions: StudySession[];
  shortfalls: StudyShortfall[];
};

export type ScheduleOptions = {
  /** "YYYY-MM-DD" */
  today: string;
  /** Sessions today start no earlier than the next whole hour. */
  currentHour?: number;
};

/** Checks the same limits the database enforces. Returns a message, or null when valid. */
export function validateStudyPreferences(prefs: StudyPreferences): string | null {
  const { daysBeforeExam, sessionHours, sessionsPerDay, windowStartHour, windowEndHour } = prefs;
  const whole = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max;
  if (!whole(daysBeforeExam, 1, 30)) return "Days of study before an exam must be from 1 to 30.";
  if (!whole(sessionHours, 1, 8)) return "Study session length must be from 1 to 8 hours.";
  if (!whole(sessionsPerDay, 1, 6)) return "Study sessions per day must be from 1 to 6.";
  if (!whole(windowStartHour, 0, 23) || !whole(windowEndHour, 1, 24) || windowStartHour >= windowEndHour) {
    return "The study window must end after it starts.";
  }
  if (windowEndHour - windowStartHour < sessionHours) {
    return "The study window is shorter than one study session. Widen the window or shorten sessions.";
  }
  return null;
}

type Interval = { start: number; end: number; study: boolean };

function overlaps(start: number, end: number, interval: Interval) {
  return start < interval.end && interval.start < end;
}

function findSlot(
  taken: Interval[],
  earliest: number,
  windowEnd: number,
  length: number,
  breakAfterStudy: number,
): number | null {
  for (let start = earliest; start + length <= windowEnd; start += 1) {
    const end = start + length;
    const free = taken.every((interval) =>
      interval.study
        ? !overlaps(start - breakAfterStudy, end + breakAfterStudy, interval)
        : !overlaps(start, end, interval),
    );
    if (free) return start;
  }
  return null;
}

export function scheduleStudySessions(
  tasks: ExamTask[],
  prefs: StudyPreferences,
  busy: BusyBlock[],
  { today, currentHour }: ScheduleOptions,
): StudyPlan {
  if (validateStudyPreferences(prefs)) return { sessions: [], shortfalls: [] };

  const exams = sortTasksByPriority(
    tasks.filter((task) => task.isExam && !task.completed && task.dueDate && task.dueDate > today),
    today,
  );

  const takenByDate = new Map<string, Interval[]>();
  const taken = (date: string) => {
    let list = takenByDate.get(date);
    if (!list) {
      list = [];
      takenByDate.set(date, list);
    }
    return list;
  };
  for (const block of busy) {
    taken(block.date).push({ start: block.startHour, end: block.startHour + block.duration, study: false });
  }

  const sessions: StudySession[] = [];
  const shortfalls: StudyShortfall[] = [];

  for (const exam of exams) {
    const examDate = exam.dueDate!;
    for (let offset = prefs.daysBeforeExam; offset >= 1; offset -= 1) {
      const date = addDaysToKey(examDate, -offset);
      if (date < today) continue;

      const earliest =
        date === today && currentHour !== undefined
          ? Math.max(prefs.windowStartHour, Math.floor(currentHour) + 1)
          : prefs.windowStartHour;
      let missing = 0;

      for (let index = 0; index < prefs.sessionsPerDay; index += 1) {
        const dayTaken = taken(date);
        const start =
          findSlot(dayTaken, earliest, prefs.windowEndHour, prefs.sessionHours, 1) ??
          findSlot(dayTaken, earliest, prefs.windowEndHour, prefs.sessionHours, 0);
        if (start === null) {
          missing += 1;
          continue;
        }
        dayTaken.push({ start, end: start + prefs.sessionHours, study: true });
        sessions.push({
          id: `study-${exam.id}-${date}-${index + 1}`,
          examId: exam.id,
          examTitle: exam.title,
          examDate,
          priority: exam.priority,
          date,
          startHour: start,
          duration: prefs.sessionHours,
        });
      }

      if (missing > 0) {
        shortfalls.push({ examId: exam.id, examTitle: exam.title, date, missing });
      }
    }
  }

  sessions.sort((a, b) => (a.date === b.date ? a.startHour - b.startHour : a.date < b.date ? -1 : 1));
  shortfalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { sessions, shortfalls };
}
