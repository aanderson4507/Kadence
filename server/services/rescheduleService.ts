import {
  DeadlineHandling,
  NotificationChannel,
  PlannerCategory,
  PlannerTaskType,
  Priority,
  type Prisma,
} from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import {
  ValidationError,
  addDays,
  asObject,
  parseEnum,
  requireInt,
  requireUuid,
  toDateOnly,
  todayDateOnly,
} from "../validation.ts";
import { PRIORITY_LABELS } from "./studyPlanService.ts";
import { DEFAULT_REMINDERS_PER_DAY } from "./notificationService.ts";
import { requireUser, serializeTask } from "./taskService.ts";
import { sortTasksByPriority } from "../../src/taskPriority.ts";

// User story 1.2 (issue #3): Kadence finds tasks the student missed and offers to move them into
// upcoming open time slots ("availability windows" set in Settings), without overlapping anything
// already in the planner. The client checks on open and every hour.

const SEARCH_DAYS = 14;
const SLOT_HOURS = 1;
const HIGH_PRIORITIES: Priority[] = [Priority.VERY_HIGH, Priority.HIGH];

export type Window = { weekday: number; startMinute: number; endMinute: number };
export type Busy = { date: string; startHour: number; durationHours: number };
export type MissedTask = { id: string; title: string; priority: Priority; dueDate: string; isExam: boolean };
export type Assignment = { taskId: string; date: string; startHour: number };

/**
 * Places missed tasks, most important first, into the earliest free one-hour slot inside an
 * availability window, starting today (after the current hour) and looking two weeks ahead.
 * At most `dailyLimit` tasks are moved onto any one day. Pure, so it is unit-tested directly.
 */
export function planReschedule(
  tasks: MissedTask[],
  windows: Window[],
  busy: Busy[],
  options: { today: string; currentHour: number; dailyLimit: number },
): { assignments: Assignment[]; unplaced: string[] } {
  const ordered = sortTasksByPriority(
    tasks.map((task) => ({ ...task, priority: PRIORITY_LABELS[task.priority], completed: false })),
    options.today,
  );
  const takenByDate = new Map<string, Set<number>>();
  const taken = (date: string) => {
    let hours = takenByDate.get(date);
    if (!hours) takenByDate.set(date, (hours = new Set()));
    return hours;
  };
  for (const block of busy) {
    for (let hour = block.startHour; hour < block.startHour + block.durationHours; hour += 1) {
      taken(block.date).add(hour);
    }
  }

  const movedPerDay = new Map<string, number>();
  const assignments: Assignment[] = [];
  const unplaced: string[] = [];
  const firstDay = new Date(`${options.today}T00:00:00.000Z`);

  for (const task of ordered) {
    let placed = false;
    for (let offset = 0; offset < SEARCH_DAYS && !placed; offset += 1) {
      const day = addDays(firstDay, offset);
      const date = toDateOnly(day)!;
      if ((movedPerDay.get(date) ?? 0) >= options.dailyLimit) continue;
      const dayWindows = windows
        .filter((window) => window.weekday === day.getUTCDay())
        .sort((a, b) => a.startMinute - b.startMinute);
      for (const window of dayWindows) {
        const windowStart = Math.ceil(window.startMinute / 60);
        // Today, only slots after the current hour count.
        const earliest =
          offset === 0 ? Math.max(windowStart, Math.floor(options.currentHour) + 1) : windowStart;
        const latestStart = Math.floor(window.endMinute / 60) - SLOT_HOURS;
        for (let hour = earliest; hour <= latestStart; hour += 1) {
          if (taken(date).has(hour)) continue;
          taken(date).add(hour);
          movedPerDay.set(date, (movedPerDay.get(date) ?? 0) + 1);
          assignments.push({ taskId: task.id, date, startHour: hour });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
    if (!placed) unplaced.push(task.id);
  }
  return { assignments, unplaced };
}

const MISSED_ACTIONS = ["RESCHEDULE", "MOVE_TO_TODAY", "BACKLOG"] as const;

/** Unfinished, dated tasks whose date has passed (not already in the backlog). */
async function findMissedTasks(db: Db, userId: string, today: Date, taskIds: string[] | null) {
  return db.task.findMany({
    where: {
      userId,
      completed: false,
      inBacklog: false,
      dueDate: { lt: today },
      ...(taskIds ? { id: { in: taskIds } } : {}),
    },
  });
}

/**
 * Handles missed tasks with one of three actions:
 *   RESCHEDULE    - place each into an open slot (planReschedule) and add a planner block for it
 *   MOVE_TO_TODAY - set the due date to today ("Automatically move to the next day")
 *   BACKLOG       - move to the backlog for later scheduling
 * The first time a task moves, its old date is kept in originalDueDate unless the user chose
 * "Automatically update the deadline" in Settings. "Only reschedule high-priority tasks" is honored.
 */
export async function handleMissedTasks(db: Db, userId: string, body: Record<string, unknown>, now = new Date()) {
  await requireUser(db, userId);
  const action = body.action as (typeof MISSED_ACTIONS)[number];
  if (!MISSED_ACTIONS.includes(action)) {
    throw new ValidationError(`action must be one of: ${MISSED_ACTIONS.join(", ")}.`);
  }
  let taskIds: string[] | null = null;
  if (body.taskIds !== undefined) {
    if (!Array.isArray(body.taskIds)) throw new ValidationError("taskIds must be a list.");
    taskIds = body.taskIds.map((id, index) => requireUuid(id, `taskIds[${index}]`));
  }

  const today = todayDateOnly(now);
  const settings = await db.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
  let missed = await findMissedTasks(db, userId, today, taskIds);
  if (action === "RESCHEDULE" && settings.rescheduleHighOnly) {
    missed = missed.filter((task) => HIGH_PRIORITIES.includes(task.priority));
  }
  const keepOriginal = settings.deadlineHandling !== DeadlineHandling.AUTO_UPDATE;
  const moveData = (task: (typeof missed)[number], date: Date): Prisma.TaskUpdateInput => ({
    dueDate: date,
    ...(keepOriginal && !task.originalDueDate ? { originalDueDate: task.dueDate } : {}),
  });

  if (action === "BACKLOG") {
    await db.task.updateMany({ where: { id: { in: missed.map((task) => task.id) } }, data: { inBacklog: true } });
    return { action, moved: missed.length, unplaced: [], events: [] };
  }
  if (action === "MOVE_TO_TODAY") {
    await db.$transaction(missed.map((task) => db.task.update({ where: { id: task.id }, data: moveData(task, today) })));
    return { action, moved: missed.length, unplaced: [], events: [] };
  }

  const [windows, busy] = await Promise.all([
    db.availabilityWindow.findMany({ where: { userId } }),
    db.plannerEvent.findMany({
      where: { userId, eventDate: { gte: today, lte: addDays(today, SEARCH_DAYS) } },
      select: { eventDate: true, startHour: true, durationHours: true },
    }),
  ]);
  if (windows.length === 0) {
    throw new ValidationError("Add your open time slots in Settings → Unfinished task management first.");
  }
  const { assignments, unplaced } = planReschedule(
    missed.map((task) => ({ ...task, dueDate: toDateOnly(task.dueDate)! })),
    windows,
    busy.map((event) => ({ ...event, date: toDateOnly(event.eventDate)! })),
    { today: toDateOnly(today)!, currentHour: now.getHours() + now.getMinutes() / 60, dailyLimit: Math.max(1, settings.dailyLimit) },
  );
  const byId = new Map(missed.map((task) => [task.id, task]));
  const events = await db.$transaction(
    assignments.flatMap((assignment) => {
      const task = byId.get(assignment.taskId)!;
      const date = new Date(`${assignment.date}T00:00:00.000Z`);
      return [
        db.task.update({ where: { id: task.id }, data: moveData(task, date) }),
        db.plannerEvent.create({
          data: {
            userId,
            goalId: task.goalId,
            title: task.title,
            category: PlannerCategory.WORK,
            taskType: PlannerTaskType.TASK,
            priority: task.priority,
            eventDate: date,
            startHour: assignment.startHour,
            durationHours: SLOT_HOURS,
            description: `Rescheduled from ${toDateOnly(task.dueDate)} (missed).`,
          },
        }),
      ];
    }),
  );
  return {
    action,
    moved: assignments.length,
    unplaced: unplaced.map((id) => byId.get(id)!.title),
    events: events.length,
  };
}

export async function listMissedTasks(db: Db, userId: string, now = new Date()) {
  await requireUser(db, userId);
  const missed = await findMissedTasks(db, userId, todayDateOnly(now), null);
  return missed.map(serializeTask);
}

// --- Availability windows (open time slots) --------------------------------------------------

export async function getAvailability(db: Db, userId: string) {
  await requireUser(db, userId);
  const windows = await db.availabilityWindow.findMany({
    where: { userId },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });
  return windows.map(({ id, weekday, startMinute, endMinute }) => ({ id, weekday, startMinute, endMinute }));
}

/** Replaces all of a user's windows. Rejects overlapping windows on the same day. */
export async function saveAvailability(db: Db, userId: string, body: Record<string, unknown>) {
  await requireUser(db, userId);
  if (!Array.isArray(body.windows)) throw new ValidationError("windows must be a list.");
  if (body.windows.length > 50) throw new ValidationError("Add at most 50 open time slots.");
  const windows = body.windows.map((raw, index) => {
    const item = asObject(raw);
    const weekday = requireInt(item.weekday, `windows[${index}].weekday`, 0, 6);
    const startMinute = requireInt(item.startMinute, `windows[${index}].startMinute`, 0, 1439);
    const endMinute = requireInt(item.endMinute, `windows[${index}].endMinute`, 1, 1440);
    if (endMinute <= startMinute) {
      throw new ValidationError(`windows[${index}]: the end time must be after the start time.`);
    }
    if (endMinute - startMinute < 60) {
      throw new ValidationError(`windows[${index}]: an open time slot must be at least an hour long.`);
    }
    return { weekday, startMinute, endMinute };
  });
  const sorted = [...windows].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  for (let index = 1; index < sorted.length; index += 1) {
    const [previous, current] = [sorted[index - 1], sorted[index]];
    if (previous.weekday === current.weekday && current.startMinute < previous.endMinute) {
      throw new ValidationError("Two open time slots on the same day overlap. Merge or adjust them.");
    }
  }
  await db.$transaction([
    db.availabilityWindow.deleteMany({ where: { userId } }),
    db.availabilityWindow.createMany({ data: sorted.map((window) => ({ ...window, userId })) }),
  ]);
  return getAvailability(db, userId);
}

// --- Reminder frequency by priority (user story 2.6, issue #13) ------------------------------

const PRIORITY_ORDER = Object.keys(DEFAULT_REMINDERS_PER_DAY) as Priority[];

export async function getReminderRules(db: Db, userId: string) {
  await requireUser(db, userId);
  const rules = await db.priorityReminderRule.findMany({ where: { userId } });
  const byPriority = new Map(rules.map((rule) => [rule.priority, rule]));
  return PRIORITY_ORDER.map((priority) => ({
    priority,
    remindersPerDay: byPriority.get(priority)?.remindersPerDay ?? DEFAULT_REMINDERS_PER_DAY[priority],
    channel: byPriority.get(priority)?.channel ?? NotificationChannel.IN_APP,
  }));
}

export async function saveReminderRules(db: Db, userId: string, body: Record<string, unknown>) {
  await requireUser(db, userId);
  if (!Array.isArray(body.rules)) throw new ValidationError("rules must be a list.");
  const rules = body.rules.map((raw, index) => {
    const item = asObject(raw);
    return {
      priority: parseEnum(Priority, item.priority, `rules[${index}].priority`),
      remindersPerDay: requireInt(item.remindersPerDay, `rules[${index}].remindersPerDay`, 0, 24),
      channel:
        item.channel === undefined
          ? NotificationChannel.IN_APP
          : parseEnum(NotificationChannel, item.channel, `rules[${index}].channel`),
    };
  });
  if (new Set(rules.map((rule) => rule.priority)).size !== rules.length) {
    throw new ValidationError("Each priority can only have one reminder rule.");
  }
  await db.$transaction(
    rules.map((rule) =>
      db.priorityReminderRule.upsert({
        where: { userId_priority: { userId, priority: rule.priority } },
        create: { userId, ...rule },
        update: { remindersPerDay: rule.remindersPerDay, channel: rule.channel },
      }),
    ),
  );
  return getReminderRules(db, userId);
}
