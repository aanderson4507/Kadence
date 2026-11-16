import { randomUUID } from "node:crypto";
import { Priority, type Prisma, type Task } from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import {
  NotFoundError,
  ValidationError,
  optionalBoolean,
  optionalDateOnly,
  optionalNullableInt,
  optionalText,
  optionalUuid,
  parseEnum,
  requireText,
  toDateOnly,
  todayDateOnly,
} from "../validation.ts";
import { expandOccurrences, parseRepeat, recurrenceRuleData } from "./recurrence.ts";

// Tasks back the To-do list, Priority setter, exam study plan, reminders, weekly review and
// missed-task rescheduling.

export function serializeTask(task: Task) {
  return {
    id: task.id,
    goalId: task.goalId,
    title: task.title,
    category: task.category,
    priority: task.priority,
    dueDate: toDateOnly(task.dueDate),
    originalDueDate: toDateOnly(task.originalDueDate),
    completed: task.completed,
    completedDate: toDateOnly(task.completedDate),
    isExam: task.isExam,
    remindersPerDay: task.remindersPerDay,
    inBacklog: task.inBacklog,
    seriesId: task.seriesId,
    createdAt: task.createdAt.toISOString(),
  };
}

export async function requireUser(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new NotFoundError("User not found.");
}

async function requireOwnGoal(db: Db, userId: string, goalId: string | null) {
  if (!goalId) return;
  const goal = await db.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!goal) throw new ValidationError("goalId does not match one of your goals.");
}

export async function listTasks(db: Db, userId: string, priorityFilter?: unknown) {
  await requireUser(db, userId);
  const priority =
    priorityFilter === undefined ? undefined : parseEnum(Priority, priorityFilter, "priority");
  const tasks = await db.task.findMany({
    where: { userId, priority },
    orderBy: [{ completed: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  return tasks.map(serializeTask);
}

/**
 * Creates a task. With `repeat`, creates every occurrence (same fields, different due date)
 * linked by one RecurrenceRule and seriesId, and returns the first one plus `occurrenceCount`.
 */
export async function createTask(db: Db, userId: string, body: Record<string, unknown>) {
  await requireUser(db, userId);

  const goalId = optionalUuid(body.goalId, "goalId");
  await requireOwnGoal(db, userId, goalId);

  const title = requireText(body.title, "title", 200);
  const isExam = optionalBoolean(body.isExam, "isExam") ?? false;
  // An exam without a date is allowed; it gets study sessions once a date is added.
  const dueDate = optionalDateOnly(body.dueDate, "dueDate");
  const base = {
    userId,
    goalId,
    title,
    category: optionalText(body.category, "category", 50) ?? (isExam ? "Exam" : "General"),
    priority:
      body.priority === undefined ? Priority.NONE : parseEnum(Priority, body.priority, "priority"),
    isExam,
    remindersPerDay: optionalNullableInt(body.remindersPerDay, "remindersPerDay", 0, 24) ?? null,
    inBacklog: optionalBoolean(body.inBacklog, "inBacklog") ?? false,
  } satisfies Omit<Prisma.TaskUncheckedCreateInput, "dueDate">;

  const repeat = parseRepeat(body.repeat, dueDate);
  if (!repeat) {
    const task = await db.task.create({ data: { ...base, dueDate } });
    return { ...serializeTask(task), occurrenceCount: 1 };
  }

  const dates = expandOccurrences(dueDate!, repeat);
  if (dates.length === 0) {
    throw new ValidationError("That repeat doesn't produce any dates. Check the days and end date.");
  }
  const seriesId = randomUUID();
  const first = await db.$transaction(async (tx) => {
    const rule = await tx.recurrenceRule.create({ data: recurrenceRuleData(userId, repeat) });
    await tx.task.createMany({
      data: dates.map((date) => ({ ...base, dueDate: date, recurrenceRuleId: rule.id, seriesId })),
    });
    return tx.task.findFirstOrThrow({ where: { seriesId }, orderBy: { dueDate: "asc" } });
  });
  return { ...serializeTask(first), occurrenceCount: dates.length };
}

/**
 * Edits any subset of a task's fields. Setting completed also sets/clears completedDate, which the
 * database requires to move together.
 */
export async function updateTask(
  db: Db,
  userId: string,
  taskId: string,
  body: Record<string, unknown>,
) {
  const existing = await db.task.findFirst({ where: { id: taskId, userId } });
  if (!existing) throw new NotFoundError("Task not found.");

  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (body.title !== undefined) data.title = requireText(body.title, "title", 200);
  if (body.category !== undefined) {
    data.category = optionalText(body.category, "category", 50) ?? "General";
  }
  if (body.priority !== undefined) data.priority = parseEnum(Priority, body.priority, "priority");
  if (body.dueDate !== undefined) data.dueDate = optionalDateOnly(body.dueDate, "dueDate");
  const completed = optionalBoolean(body.completed, "completed");
  if (completed !== undefined) {
    data.completed = completed;
    data.completedDate = completed ? todayDateOnly() : null;
  }
  const isExam = optionalBoolean(body.isExam, "isExam");
  if (isExam !== undefined) data.isExam = isExam;
  const reminders = optionalNullableInt(body.remindersPerDay, "remindersPerDay", 0, 24);
  if (reminders !== undefined) data.remindersPerDay = reminders;
  const inBacklog = optionalBoolean(body.inBacklog, "inBacklog");
  if (inBacklog !== undefined) data.inBacklog = inBacklog;
  if (body.goalId !== undefined) {
    const goalId = optionalUuid(body.goalId, "goalId");
    await requireOwnGoal(db, userId, goalId);
    data.goalId = goalId;
  }

  if (Object.keys(data).length === 0) {
    throw new ValidationError(
      "Provide at least one of: title, category, priority, dueDate, completed, isExam, remindersPerDay, inBacklog, goalId.",
    );
  }
  const task = await db.task.update({ where: { id: taskId }, data });
  return serializeTask(task);
}

/**
 * Deletes a task. scope "series" also deletes the unfinished occurrences of a repeating task
 * (completed ones are kept so the weekly review history stays accurate).
 */
export async function deleteTask(db: Db, userId: string, taskId: string, scope: unknown) {
  const existing = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, seriesId: true },
  });
  if (!existing) throw new NotFoundError("Task not found.");
  if (scope !== undefined && scope !== "one" && scope !== "series") {
    throw new ValidationError('scope must be "one" or "series".');
  }

  if (scope === "series" && existing.seriesId) {
    const { count } = await db.task.deleteMany({
      where: { userId, OR: [{ id: taskId }, { seriesId: existing.seriesId, completed: false }] },
    });
    return { deleted: count };
  }
  await db.task.delete({ where: { id: taskId } });
  return { deleted: 1 };
}
