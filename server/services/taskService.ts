import { Priority, type Task } from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import {
  NotFoundError,
  ValidationError,
  optionalDateOnly,
  optionalText,
  optionalUuid,
  parseEnum,
  requireText,
  toDateOnly,
  todayDateOnly,
} from "../validation.ts";

function serializeTask(task: Task) {
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
  };
}

export async function listTasks(db: Db, userId: string, priorityFilter?: unknown) {
  const priority =
    priorityFilter === undefined ? undefined : parseEnum(Priority, priorityFilter, "priority");
  const tasks = await db.task.findMany({
    where: { userId, priority },
    orderBy: [{ completed: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  return tasks.map(serializeTask);
}

export async function createTask(db: Db, userId: string, body: Record<string, unknown>) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new NotFoundError("User not found.");

  const goalId = optionalUuid(body.goalId, "goalId");
  if (goalId) {
    const goal = await db.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
    if (!goal) throw new ValidationError("goalId does not match one of your goals.");
  }

  const task = await db.task.create({
    data: {
      userId,
      goalId,
      title: requireText(body.title, "title", 200),
      category: optionalText(body.category, "category", 50) ?? "General",
      priority:
        body.priority === undefined ? Priority.NONE : parseEnum(Priority, body.priority, "priority"),
      dueDate: optionalDateOnly(body.dueDate, "dueDate"),
      isExam: body.isExam === true,
    },
  });
  return serializeTask(task);
}

/** Completes/reopens a task and/or changes its priority. completedDate follows completed. */
export async function updateTask(
  db: Db,
  userId: string,
  taskId: string,
  body: Record<string, unknown>,
) {
  const existing = await db.task.findFirst({ where: { id: taskId, userId }, select: { id: true } });
  if (!existing) throw new NotFoundError("Task not found.");

  const data: { completed?: boolean; completedDate?: Date | null; priority?: Priority } = {};
  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      throw new ValidationError("completed must be true or false.");
    }
    data.completed = body.completed;
    data.completedDate = body.completed ? todayDateOnly() : null;
  }
  if (body.priority !== undefined) {
    data.priority = parseEnum(Priority, body.priority, "priority");
  }
  if (Object.keys(data).length === 0) {
    throw new ValidationError("Provide completed and/or priority.");
  }

  const task = await db.task.update({ where: { id: taskId }, data });
  return serializeTask(task);
}
