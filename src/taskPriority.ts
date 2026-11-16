// Priority order for tasks (user story: mark an exam as high priority).
//
// A task's score is the sum of three parts:
//   1. Its priority level (Very High 50 ... None 0), 10 points per level.
//   2. +10 if it is flagged as an exam, so an exam ranks one level above
//      an otherwise identical task.
//   3. Urgency from its due date: overdue +25, due today +20, tomorrow +16, then 3 fewer
//      points per day until a week out (0). Tasks with no due date get no urgency points.
//
// So a task can climb at most about two levels through urgency: an overdue Medium task
// (30 + 25) outranks a High task due next week (40 + 0), but a Low task due tomorrow
// (20 + 16) still ranks below a High task with no deadline (40).
// Completed tasks always sort last. Ties go to the earlier due date, then the title.

export type Priority = "Very High" | "High" | "Medium" | "Low" | "Very Low" | "None";

export const PRIORITY_LEVELS: Priority[] = ["Very High", "High", "Medium", "Low", "Very Low", "None"];

export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  "Very High": 50,
  High: 40,
  Medium: 30,
  Low: 20,
  "Very Low": 10,
  None: 0,
};

export const EXAM_BONUS = 10;

export type RankableTask = {
  title: string;
  priority: Priority;
  completed: boolean;
  /** "YYYY-MM-DD" */
  dueDate?: string;
  isExam?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses a "YYYY-MM-DD" key as a UTC date so day arithmetic ignores time zones and DST. */
export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToKey(dateKey: string, days: number): string {
  return formatDateKey(new Date(parseDateKey(dateKey).getTime() + days * DAY_MS));
}

/** Today's local calendar date as "YYYY-MM-DD". */
export function todayKey(now = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Whole days from `today` to `dateKey` (negative when it has passed). */
export function daysUntil(dateKey: string, today: string): number {
  return Math.round((parseDateKey(dateKey).getTime() - parseDateKey(today).getTime()) / DAY_MS);
}

export function urgencyPoints(daysUntilDue: number | null): number {
  if (daysUntilDue === null) return 0;
  if (daysUntilDue < 0) return 25;
  if (daysUntilDue === 0) return 20;
  if (daysUntilDue === 1) return 16;
  return Math.max(0, 20 - 3 * daysUntilDue);
}

export function priorityScore(task: RankableTask, today: string): number {
  const days = task.dueDate ? daysUntil(task.dueDate, today) : null;
  return PRIORITY_WEIGHTS[task.priority] + (task.isExam ? EXAM_BONUS : 0) + urgencyPoints(days);
}

/** Returns a new array, most important first. */
export function sortTasksByPriority<Task extends RankableTask>(tasks: Task[], today: string): Task[] {
  return tasks
    .map((task) => ({ task, score: priorityScore(task, today) }))
    .sort((a, b) => {
      if (a.task.completed !== b.task.completed) return a.task.completed ? 1 : -1;
      if (a.score !== b.score) return b.score - a.score;
      const aDue = a.task.dueDate ?? "9999-12-31";
      const bDue = b.task.dueDate ?? "9999-12-31";
      if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      return a.task.title.localeCompare(b.task.title);
    })
    .map(({ task }) => task);
}

/** Plain-language reason shown next to a task, e.g. "Exam · due in 3 days". */
export function describeUrgency(task: RankableTask, today: string): string {
  const parts: string[] = [];
  if (task.isExam) parts.push("Exam");
  if (task.dueDate && !task.completed) {
    const days = daysUntil(task.dueDate, today);
    parts.push(
      days < 0
        ? `overdue by ${-days} ${-days === 1 ? "day" : "days"}`
        : days === 0
          ? "due today"
          : days === 1
            ? "due tomorrow"
            : `due in ${days} days`,
    );
  }
  return parts.join(" · ");
}
