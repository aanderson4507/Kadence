import {
  GoalCategory,
  GoalSize,
  GoalStatus,
  Priority,
  type Goal,
  type Prisma,
} from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import {
  NotFoundError,
  ValidationError,
  optionalBoolean,
  optionalDateOnly,
  optionalText,
  optionalUuid,
  parseEnum,
  requireText,
  toDateOnly,
} from "../validation.ts";
import { requireUser } from "./taskService.ts";

/** A parent goal must be a strictly larger tier than its children. */
const TIER_RANK: Record<GoalSize, number> = { BIG: 3, MEDIUM: 2, SMALL: 1 };
const CHILD_TIER: Record<GoalSize, GoalSize | null> = {
  BIG: "MEDIUM",
  MEDIUM: "SMALL",
  SMALL: null,
};

type GoalWithWork = Goal & {
  milestones: {
    id: string;
    title: string;
    dueDate: Date | null;
    completedAt: Date | null;
    sortOrder: number;
  }[];
  tasks: {
    id: string;
    title: string;
    completed: boolean;
    dueDate: Date | null;
    priority: Priority;
  }[];
};

/**
 * Goal progress is derived, never stored. Each milestone, linked task and child goal is one
 * unit of work; a child goal contributes its own progress fraction, so progress on small
 * goals rolls up into the medium and big goals above them.
 */
export function computeGoalProgress(goals: GoalWithWork[]): Map<string, number> {
  const childrenByParent = new Map<string, GoalWithWork[]>();
  for (const goal of goals) {
    if (!goal.parentGoalId) continue;
    const siblings = childrenByParent.get(goal.parentGoalId) ?? [];
    siblings.push(goal);
    childrenByParent.set(goal.parentGoalId, siblings);
  }

  const fractions = new Map<string, number>();
  const visiting = new Set<string>();

  function progressOf(goal: GoalWithWork): number {
    const known = fractions.get(goal.id);
    if (known !== undefined) return known;
    if (goal.status === GoalStatus.COMPLETED) {
      fractions.set(goal.id, 1);
      return 1;
    }
    if (visiting.has(goal.id)) return 0; // defensive: cycles are rejected on write
    visiting.add(goal.id);

    let total = 0;
    let done = 0;
    for (const milestone of goal.milestones) {
      total += 1;
      if (milestone.completedAt) done += 1;
    }
    for (const task of goal.tasks) {
      total += 1;
      if (task.completed) done += 1;
    }
    for (const child of childrenByParent.get(goal.id) ?? []) {
      total += 1;
      done += progressOf(child);
    }

    visiting.delete(goal.id);
    const fraction = total === 0 ? 0 : done / total;
    fractions.set(goal.id, fraction);
    return fraction;
  }

  return new Map(goals.map((goal) => [goal.id, Math.round(progressOf(goal) * 100)]));
}

function serializeGoal(goal: GoalWithWork, progress: number) {
  return {
    id: goal.id,
    parentGoalId: goal.parentGoalId,
    title: goal.title,
    size: goal.size,
    category: goal.category,
    description: goal.description,
    priority: goal.priority,
    startDate: toDateOnly(goal.startDate),
    targetDate: toDateOnly(goal.targetDate),
    status: goal.status,
    completedAt: goal.completedAt?.toISOString() ?? null,
    progress,
    milestones: goal.milestones.map(serializeMilestone),
    tasks: goal.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed,
      dueDate: toDateOnly(task.dueDate),
      priority: task.priority,
    })),
    taskCount: goal.tasks.length,
    completedTaskCount: goal.tasks.filter((task) => task.completed).length,
  };
}

function serializeMilestone(milestone: GoalWithWork["milestones"][number]) {
  return {
    id: milestone.id,
    title: milestone.title,
    dueDate: toDateOnly(milestone.dueDate),
    completedAt: milestone.completedAt?.toISOString() ?? null,
    sortOrder: milestone.sortOrder,
  };
}

const goalWorkInclude = {
  milestones: {
    select: { id: true, title: true, dueDate: true, completedAt: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
  tasks: {
    select: { id: true, title: true, completed: true, dueDate: true, priority: true },
    orderBy: [{ completed: "asc" as const }, { dueDate: { sort: "asc" as const, nulls: "last" as const } }],
  },
};

export async function listGoals(db: Db, userId: string) {
  await requireUser(db, userId);
  const goals = await db.goal.findMany({
    where: { userId },
    include: goalWorkInclude,
    orderBy: { createdAt: "asc" },
  });
  const progress = computeGoalProgress(goals);
  return goals.map((goal) => serializeGoal(goal, progress.get(goal.id) ?? 0));
}

/**
 * Creates a goal and, optionally, one tier of child goals ("Break this goal down").
 * Rejects a parent that is not a strictly larger tier.
 */
export async function createGoal(db: Db, userId: string, body: Record<string, unknown>) {
  await requireUser(db, userId);

  const title = requireText(body.title, "title", 150);
  const size = parseEnum(GoalSize, body.size, "size");
  const priority =
    body.priority === undefined ? Priority.NONE : parseEnum(Priority, body.priority, "priority");
  const category =
    body.category === undefined || body.category === null
      ? null
      : parseEnum(GoalCategory, body.category, "category");
  const startDate = optionalDateOnly(body.startDate, "startDate");
  const targetDate = optionalDateOnly(body.targetDate, "targetDate");
  if (startDate && targetDate && targetDate < startDate) {
    throw new ValidationError("targetDate must be on or after startDate.");
  }

  const parentGoalId = optionalUuid(body.parentGoalId, "parentGoalId");
  if (parentGoalId) {
    const parent = await db.goal.findFirst({
      where: { id: parentGoalId, userId },
      select: { size: true },
    });
    if (!parent) throw new ValidationError("parentGoalId does not match one of your goals.");
    if (TIER_RANK[parent.size] <= TIER_RANK[size]) {
      throw new ValidationError(
        `A ${size} goal cannot sit under a ${parent.size} goal; the parent must be a larger tier.`,
      );
    }
  }

  const childTitles = Array.isArray(body.childGoalTitles)
    ? body.childGoalTitles.map((value, index) =>
        requireText(value, `childGoalTitles[${index}]`, 150),
      )
    : [];
  const childSize = CHILD_TIER[size];
  if (childTitles.length > 0 && !childSize) {
    throw new ValidationError("Small goals cannot be broken down into smaller goals.");
  }

  const goal = await db.goal.create({
    data: {
      userId,
      parentGoalId,
      title,
      size,
      category,
      description: optionalText(body.description, "description"),
      priority,
      startDate,
      targetDate,
      childGoals: childSize
        ? { create: childTitles.map((childTitle) => ({ userId, title: childTitle, size: childSize })) }
        : undefined,
    },
    include: goalWorkInclude,
  });
  return serializeGoal(goal, 0);
}

/** User story: "change a goal's priority so that my goal list reflects what is most important". */
export async function updateGoalPriority(
  db: Db,
  userId: string,
  goalId: string,
  priorityValue: unknown,
) {
  const priority = parseEnum(Priority, priorityValue, "priority");

  const existing = await db.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!existing) throw new NotFoundError("Goal not found.");

  const goal = await db.goal.update({
    where: { id: goalId },
    data: { priority },
    select: { id: true, title: true, priority: true, updatedAt: true },
  });
  return { ...goal, updatedAt: goal.updatedAt.toISOString() };
}

async function requireOwnGoal(db: Db, userId: string, goalId: string) {
  const goal = await db.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw new NotFoundError("Goal not found.");
  return goal;
}

/** Returns one goal with its progress computed against the user's whole goal tree. */
async function goalWithProgress(db: Db, userId: string, goalId: string) {
  const goals = await listGoals(db, userId);
  const goal = goals.find((item) => item.id === goalId);
  if (!goal) throw new NotFoundError("Goal not found.");
  return goal;
}

/** True if `candidateId` is `goalId` or one of its descendants (would create a cycle). */
async function isSelfOrDescendant(db: Db, userId: string, goalId: string, candidateId: string) {
  const goals = await db.goal.findMany({ where: { userId }, select: { id: true, parentGoalId: true } });
  const parentOf = new Map(goals.map((goal) => [goal.id, goal.parentGoalId]));
  for (let current: string | null | undefined = candidateId; current; current = parentOf.get(current)) {
    if (current === goalId) return true;
  }
  return false;
}

/**
 * Edits a goal. status COMPLETED stamps completedAt (the database requires the two to agree);
 * moving back to ACTIVE clears it. Changing parentGoalId re-checks the tier rule and cycles.
 */
export async function updateGoal(db: Db, userId: string, goalId: string, body: Record<string, unknown>) {
  const existing = await requireOwnGoal(db, userId, goalId);
  const data: Prisma.GoalUncheckedUpdateInput = {};

  if (body.title !== undefined) data.title = requireText(body.title, "title", 150);
  if (body.description !== undefined) data.description = optionalText(body.description, "description");
  if (body.priority !== undefined) data.priority = parseEnum(Priority, body.priority, "priority");
  if (body.category !== undefined) {
    data.category = body.category === null ? null : parseEnum(GoalCategory, body.category, "category");
  }
  if (body.startDate !== undefined) data.startDate = optionalDateOnly(body.startDate, "startDate");
  if (body.targetDate !== undefined) data.targetDate = optionalDateOnly(body.targetDate, "targetDate");
  if (body.status !== undefined) {
    const status = parseEnum(GoalStatus, body.status, "status");
    data.status = status;
    if (status === GoalStatus.COMPLETED) {
      data.completedAt = existing.completedAt ?? new Date();
    } else {
      data.completedAt = null;
    }
  }
  if (body.parentGoalId !== undefined) {
    const parentGoalId = optionalUuid(body.parentGoalId, "parentGoalId");
    if (parentGoalId) {
      const parent = await db.goal.findFirst({ where: { id: parentGoalId, userId }, select: { size: true } });
      if (!parent) throw new ValidationError("parentGoalId does not match one of your goals.");
      if (TIER_RANK[parent.size] <= TIER_RANK[existing.size]) {
        throw new ValidationError("The parent goal must be a larger tier than this goal.");
      }
      if (await isSelfOrDescendant(db, userId, goalId, parentGoalId)) {
        throw new ValidationError("A goal can't be placed under itself or one of its own steps.");
      }
    }
    data.parentGoalId = parentGoalId;
  }
  if (Object.keys(data).length === 0) throw new ValidationError("Provide at least one field to change.");

  const startDate = data.startDate === undefined ? existing.startDate : (data.startDate as Date | null);
  const targetDate = data.targetDate === undefined ? existing.targetDate : (data.targetDate as Date | null);
  if (startDate && targetDate && targetDate < startDate) {
    throw new ValidationError("targetDate must be on or after startDate.");
  }

  await db.goal.update({ where: { id: goalId }, data });
  return goalWithProgress(db, userId, goalId);
}

/** Deletes a goal. Its child goals and tasks are kept and become unlinked (SET NULL). */
export async function deleteGoal(db: Db, userId: string, goalId: string) {
  await requireOwnGoal(db, userId, goalId);
  await db.goal.delete({ where: { id: goalId } });
  return { deleted: 1 };
}

// --- Milestones (user story 2.1: schedule a goal's steps onto specific dates, issue #7) -------

export async function createMilestone(
  db: Db,
  userId: string,
  goalId: string,
  body: Record<string, unknown>,
) {
  await requireOwnGoal(db, userId, goalId);
  const title = requireText(body.title, "title", 150);
  const dueDate = optionalDateOnly(body.dueDate, "dueDate");
  const last = await db.milestone.findFirst({
    where: { goalId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.milestone.create({
    data: { goalId, title, dueDate, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  return goalWithProgress(db, userId, goalId);
}

async function requireOwnMilestone(db: Db, userId: string, goalId: string, milestoneId: string) {
  const milestone = await db.milestone.findFirst({
    where: { id: milestoneId, goalId, goal: { userId } },
  });
  if (!milestone) throw new NotFoundError("Milestone not found.");
  return milestone;
}

export async function updateMilestone(
  db: Db,
  userId: string,
  goalId: string,
  milestoneId: string,
  body: Record<string, unknown>,
) {
  const existing = await requireOwnMilestone(db, userId, goalId, milestoneId);
  const data: Prisma.MilestoneUncheckedUpdateInput = {};
  if (body.title !== undefined) data.title = requireText(body.title, "title", 150);
  if (body.dueDate !== undefined) data.dueDate = optionalDateOnly(body.dueDate, "dueDate");
  const completed = optionalBoolean(body.completed, "completed");
  if (completed !== undefined) {
    data.completedAt = completed ? (existing.completedAt ?? new Date()) : null;
  }
  if (Object.keys(data).length === 0) {
    throw new ValidationError("Provide at least one of: title, dueDate, completed.");
  }
  await db.milestone.update({ where: { id: milestoneId }, data });
  return goalWithProgress(db, userId, goalId);
}

export async function deleteMilestone(db: Db, userId: string, goalId: string, milestoneId: string) {
  await requireOwnMilestone(db, userId, goalId, milestoneId);
  await db.milestone.delete({ where: { id: milestoneId } });
  return goalWithProgress(db, userId, goalId);
}
