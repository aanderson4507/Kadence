import { WeekStart } from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import {
  addDays,
  optionalDateOnly,
  optionalText,
  requireDateOnly,
  toDateOnly,
  todayDateOnly,
} from "../validation.ts";
import { serializeTask, requireUser } from "./taskService.ts";

// User story 1.4 (issue #5): a quick weekly review of what was finished and what is still left.
// Everything is computed live from tasks, goals, milestones and planner events; the WeeklyReview
// table stores the student's reflection plus a snapshot of the counts when they save it.

const WEEK_START_DAY: Record<WeekStart, number> = { SUNDAY: 0, MONDAY: 1, SATURDAY: 6 };

/** First day of the week containing `date`, for the user's week-start preference. */
export function weekStartFor(date: Date, weekStart: WeekStart): Date {
  const offset = (date.getUTCDay() - WEEK_START_DAY[weekStart] + 7) % 7;
  return addDays(date, -offset);
}

type ReviewTask = ReturnType<typeof serializeTask>;

/** Splits the week's tasks into completed / pending / overdue (pure, unit-tested). */
export function summarizeWeek(tasks: ReviewTask[], weekStart: string, weekEnd: string, today: string) {
  const inWeek = (date: string | null) => date !== null && date >= weekStart && date <= weekEnd;
  const completed = tasks.filter((task) => task.completed && inWeek(task.completedDate));
  const open = tasks.filter((task) => !task.completed && !task.inBacklog && inWeek(task.dueDate));
  const overdue = open.filter((task) => task.dueDate! < today);
  const pending = open.filter((task) => task.dueDate! >= today);
  const total = completed.length + pending.length + overdue.length;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = toDateOnly(addDays(new Date(`${weekStart}T00:00:00.000Z`), index))!;
    return {
      date,
      completed: completed.filter((task) => task.completedDate === date).length,
      due: tasks.filter((task) => task.dueDate === date).length,
    };
  });

  return {
    completed,
    pending,
    overdue,
    completionRate: total === 0 ? 0 : Math.round((completed.length / total) * 100),
    days,
  };
}

export async function getWeeklyReview(db: Db, userId: string, week: unknown, now = new Date()) {
  await requireUser(db, userId);
  const settings = await db.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
  const today = todayDateOnly(now);
  const start = weekStartFor(optionalDateOnly(week, "week") ?? today, settings.weekStart);
  const end = addDays(start, 6);
  const endExclusive = addDays(start, 7);
  const [weekStart, weekEnd, todayKey] = [toDateOnly(start)!, toDateOnly(end)!, toDateOnly(today)!];

  const [tasks, goalsCompleted, milestonesReached, doneEvents, saved] = await Promise.all([
    db.task.findMany({
      where: {
        userId,
        OR: [{ completedDate: { gte: start, lte: end } }, { dueDate: { gte: start, lte: end } }],
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    }),
    db.goal.findMany({
      where: { userId, completedAt: { gte: start, lt: endExclusive } },
      select: { id: true, title: true, size: true },
    }),
    db.milestone.findMany({
      where: { goal: { userId }, completedAt: { gte: start, lt: endExclusive } },
      select: { id: true, title: true, goal: { select: { title: true } } },
    }),
    db.plannerEvent.findMany({
      where: { userId, status: "DONE", eventDate: { gte: start, lte: end } },
      select: { durationHours: true },
    }),
    db.weeklyReview.findUnique({ where: { userId_weekStart: { userId, weekStart: start } } }),
  ]);

  const summary = summarizeWeek(tasks.map(serializeTask), weekStart, weekEnd, todayKey);
  return {
    weekStart,
    weekEnd,
    isCurrentWeek: todayKey >= weekStart && todayKey <= weekEnd,
    ...summary,
    goalsCompleted,
    milestonesReached: milestonesReached.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      goalTitle: milestone.goal.title,
    })),
    hoursSpent: doneEvents.reduce((total, event) => total + event.durationHours, 0),
    preferences: {
      summaryItems: settings.reviewSummaryItems,
      reflectionQuestions: settings.reflectionQuestions,
      visualization: settings.visualization,
      reviewDay: settings.reviewDay,
    },
    reflection: saved?.reflection ?? "",
    reviewedAt: saved?.reviewedAt?.toISOString() ?? null,
  };
}

/** Saves the reflection and a snapshot of this week's counts. */
export async function saveWeeklyReview(db: Db, userId: string, body: Record<string, unknown>) {
  const week = requireDateOnly(body.weekStart, "weekStart");
  const reflection = optionalText(body.reflection, "reflection", 5000);
  const review = await getWeeklyReview(db, userId, toDateOnly(week));
  const weekStart = new Date(`${review.weekStart}T00:00:00.000Z`);
  const counts = {
    reflection,
    completedCount: review.completed.length,
    pendingCount: review.pending.length,
    overdueCount: review.overdue.length,
    reviewedAt: new Date(),
  };
  await db.weeklyReview.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    create: { userId, weekStart, ...counts },
    update: counts,
  });
  return getWeeklyReview(db, userId, review.weekStart);
}
