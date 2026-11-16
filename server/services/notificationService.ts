import { NotificationType, type Priority } from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import { NotFoundError, addDays, toDateOnly, todayDateOnly } from "../validation.ts";
import { requireUser } from "./taskService.ts";

// Reminders (user stories 1.3 #4 and 2.6 #13).
//
// Notifications are planned one day at a time from the user's saved data:
//   - Tasks: an unfinished, dated, non-backlog task due within the next 7 days gets N reminders
//     today, where N is the task's own remindersPerDay, or else the reminder rule for its
//     priority (Settings -> Reminder frequency), or else DEFAULT_REMINDERS_PER_DAY. So more
//     important work reminds more often, and any single task can be turned up or down.
//     Due today/tomorrow -> DEADLINE (needs remindDeadline); later -> UPCOMING_TASK (remindUpcoming).
//   - Planner events today: one reminder an hour before they start, or N spread through the morning
//     up to the start when the event has its own remindersPerDay (remindUpcoming).
//   - DAILY_PLANNING at 8:00 (remindDailyPlanning).
//   - WEEKLY_REVIEW on the review day at the review time (remindWeeklyReview and reviewReminder).
// Reminders inside Do Not Disturb hours are dropped. Reminders are spread between 9:00 and 21:00.
// Planning is pure (planNotifications) so the rules are unit-tested without a database.

export const DEFAULT_REMINDERS_PER_DAY: Record<Priority, number> = {
  VERY_HIGH: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  VERY_LOW: 1,
  NONE: 0,
};

const UPCOMING_WINDOW_DAYS = 7;
const DAY_START_MINUTE = 9 * 60;
const DAY_LENGTH_MINUTES = 12 * 60;
const DAILY_PLANNING_MINUTE = 8 * 60;

export type PlanInput = {
  /** Local calendar date being planned, "YYYY-MM-DD". */
  today: string;
  /** 0 = Sunday ... 6 = Saturday, for `today`. */
  weekday: number;
  settings: {
    remindDailyPlanning: boolean;
    remindUpcoming: boolean;
    remindDeadline: boolean;
    remindWeeklyReview: boolean;
    reviewReminder: boolean;
    reviewDay: number;
    reviewMinute: number;
    quietStartMinute: number | null;
    quietEndMinute: number | null;
  };
  rules: Partial<Record<Priority, number>>;
  tasks: {
    id: string;
    priority: Priority;
    dueDate: string | null;
    completed: boolean;
    inBacklog: boolean;
    remindersPerDay: number | null;
  }[];
  events: {
    id: string;
    eventDate: string;
    startHour: number;
    status: string;
    remindersPerDay: number | null;
    sourceTaskId: string | null;
  }[];
};

export type PlannedNotification = {
  type: NotificationType;
  taskId: string | null;
  plannerEventId: string | null;
  /** Minutes after local midnight of `today`. */
  minute: number;
};

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** True when `minute` falls inside Do Not Disturb hours (which may wrap past midnight). */
export function inQuietHours(minute: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** N times evenly spread across [from, from + length): 1 -> from, 2 -> from and the midpoint, ... */
export function spreadMinutes(count: number, from = DAY_START_MINUTE, length = DAY_LENGTH_MINUTES) {
  return Array.from({ length: count }, (_, index) => from + Math.floor((index * length) / count));
}

export function remindersFor(task: { priority: Priority; remindersPerDay: number | null }, rules: PlanInput["rules"]) {
  return task.remindersPerDay ?? rules[task.priority] ?? DEFAULT_REMINDERS_PER_DAY[task.priority];
}

export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { settings, today } = input;
  const planned: PlannedNotification[] = [];

  if (settings.remindDailyPlanning) {
    planned.push({ type: NotificationType.DAILY_PLANNING, taskId: null, plannerEventId: null, minute: DAILY_PLANNING_MINUTE });
  }
  if (settings.remindWeeklyReview && settings.reviewReminder && input.weekday === settings.reviewDay) {
    planned.push({ type: NotificationType.WEEKLY_REVIEW, taskId: null, plannerEventId: null, minute: settings.reviewMinute });
  }

  for (const task of input.tasks) {
    if (task.completed || task.inBacklog || !task.dueDate) continue;
    const days = daysBetween(today, task.dueDate);
    if (days < 0 || days > UPCOMING_WINDOW_DAYS) continue;
    const type = days <= 1 ? NotificationType.DEADLINE : NotificationType.UPCOMING_TASK;
    if (type === NotificationType.DEADLINE ? !settings.remindDeadline : !settings.remindUpcoming) continue;
    for (const minute of spreadMinutes(remindersFor(task, input.rules))) {
      planned.push({ type, taskId: task.id, plannerEventId: null, minute });
    }
  }

  if (settings.remindUpcoming) {
    for (const event of input.events) {
      if (event.eventDate !== today || event.status === "DONE") continue;
      const startMinute = event.startHour * 60;
      let minutes: number[];
      if (event.remindersPerDay === null) {
        minutes = event.startHour >= 1 ? [startMinute - 60] : [];
      } else {
        // Spread from 8:00 (or an hour before an earlier event) up to the start time.
        const from = Math.max(0, Math.min(DAILY_PLANNING_MINUTE, startMinute - 60));
        minutes = spreadMinutes(event.remindersPerDay, from, Math.max(1, startMinute - from));
      }
      for (const minute of minutes) {
        planned.push({ type: NotificationType.UPCOMING_TASK, taskId: null, plannerEventId: event.id, minute });
      }
    }
  }

  return planned.filter(
    (item) => !inQuietHours(item.minute, settings.quietStartMinute, settings.quietEndMinute),
  );
}

// --- Persistence ----------------------------------------------------------------------------

/** Local midnight + minutes, as a timestamp. */
function localTime(now: Date, minute: number): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minute);
  return date;
}

const keyOf = (item: { type: string; taskId: string | null; plannerEventId: string | null }, time: Date) =>
  `${item.type}|${item.taskId ?? ""}|${item.plannerEventId ?? ""}|${time.getTime()}`;

const HISTORY_DAYS = 7;

/**
 * Brings today's notifications in line with the plan, marks the ones whose time has come as
 * delivered, and returns the delivered notifications from the last week (newest first).
 * Already-delivered notifications are never removed, so turning a reminder down only affects
 * the rest of the day.
 */
export async function syncNotifications(db: Db, userId: string, now = new Date()) {
  await requireUser(db, userId);
  const today = todayDateOnly(now);
  const todayKey = toDateOnly(today)!;
  const dayStart = localTime(now, 0);
  const dayEnd = localTime(now, 24 * 60);

  const [settings, rules, tasks, events, existing] = await Promise.all([
    db.userSettings.upsert({ where: { userId }, create: { userId }, update: {} }),
    db.priorityReminderRule.findMany({ where: { userId } }),
    db.task.findMany({
      where: { userId, completed: false, dueDate: { gte: today, lte: addDays(today, UPCOMING_WINDOW_DAYS) } },
    }),
    db.plannerEvent.findMany({ where: { userId, eventDate: today } }),
    db.notification.findMany({ where: { userId, scheduledFor: { gte: dayStart, lt: dayEnd } } }),
  ]);

  const planned = planNotifications({
    today: todayKey,
    weekday: now.getDay(),
    settings,
    rules: Object.fromEntries(rules.map((rule) => [rule.priority, rule.remindersPerDay])),
    tasks: tasks.map((task) => ({ ...task, dueDate: toDateOnly(task.dueDate) })),
    events: events.map((event) => ({ ...event, eventDate: toDateOnly(event.eventDate)! })),
  });

  const plannedByKey = new Map(planned.map((item) => [keyOf(item, localTime(now, item.minute)), item]));
  const existingKeys = new Set(existing.map((item) => keyOf(item, item.scheduledFor)));
  const obsolete = existing.filter(
    (item) => !item.deliveredAt && !plannedByKey.has(keyOf(item, item.scheduledFor)),
  );
  const additions = [...plannedByKey.entries()].filter(([key]) => !existingKeys.has(key));

  await db.$transaction([
    db.notification.deleteMany({ where: { id: { in: obsolete.map((item) => item.id) } } }),
    db.notification.createMany({
      data: additions.map(([, item]) => ({
        userId,
        type: item.type,
        taskId: item.taskId,
        plannerEventId: item.plannerEventId,
        scheduledFor: localTime(now, item.minute),
      })),
    }),
    db.notification.updateMany({
      where: { userId, deliveredAt: null, scheduledFor: { lte: now } },
      data: { deliveredAt: now },
    }),
  ]);

  return listNotifications(db, userId, now);
}

export async function listNotifications(db: Db, userId: string, now = new Date()) {
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
  const [delivered, upcomingToday] = await Promise.all([
    db.notification.findMany({
      where: { userId, deliveredAt: { not: null }, scheduledFor: { gte: since, lte: now } },
      include: {
        task: { select: { id: true, title: true, dueDate: true, priority: true } },
        plannerEvent: { select: { id: true, title: true, eventDate: true, startHour: true } },
      },
      orderBy: { scheduledFor: "desc" },
      take: 50,
    }),
    db.notification.count({ where: { userId, deliveredAt: null, scheduledFor: { gt: now } } }),
  ]);
  return {
    notifications: delivered.map((item) => ({
      id: item.id,
      type: item.type,
      scheduledFor: item.scheduledFor.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
      task: item.task
        ? { ...item.task, dueDate: toDateOnly(item.task.dueDate) }
        : null,
      plannerEvent: item.plannerEvent
        ? { ...item.plannerEvent, eventDate: toDateOnly(item.plannerEvent.eventDate) }
        : null,
    })),
    unreadCount: delivered.filter((item) => !item.readAt).length,
    scheduledLaterToday: upcomingToday,
  };
}

export async function markNotificationRead(db: Db, userId: string, notificationId: string) {
  const existing = await db.notification.findFirst({ where: { id: notificationId, userId } });
  if (!existing) throw new NotFoundError("Notification not found.");
  await db.notification.update({
    where: { id: notificationId },
    data: { readAt: existing.readAt ?? new Date() },
  });
  return listNotifications(db, userId);
}

export async function markAllNotificationsRead(db: Db, userId: string) {
  await requireUser(db, userId);
  const now = new Date();
  await db.notification.updateMany({
    where: { userId, readAt: null, deliveredAt: { not: null } },
    data: { readAt: now },
  });
  return listNotifications(db, userId, now);
}
