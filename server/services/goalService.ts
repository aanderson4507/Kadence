import {
  GoalCategory,
  GoalSize,
  GoalStatus,
  Priority,
  type Goal,
} from "../generated/prisma/client.ts";
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
} from "../validation.ts";

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
  tasks: { completed: boolean }[];
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
    progress,
    milestones: goal.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      dueDate: toDateOnly(milestone.dueDate),
      completedAt: milestone.completedAt?.toISOString() ?? null,
      sortOrder: milestone.sortOrder,
    })),
    taskCount: goal.tasks.length,
    completedTaskCount: goal.tasks.filter((task) => task.completed).length,
  };
}

const goalWorkInclude = {
  milestones: {
    select: { id: true, title: true, dueDate: true, completedAt: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
  tasks: { select: { completed: true } },
};

export async function listGoals(db: Db, userId: string) {
  const goals = await db.goal.findMany({
    where: { userId },
    include: goalWorkInclude,
    orderBy: { createdAt: "asc" },
  });
  const progress = computeGoalProgress(goals);
  return goals.map((goal) => serializeGoal(goal, progress.get(goal.id) ?? 0));
}

async function requireUser(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new NotFoundError("User not found.");
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
