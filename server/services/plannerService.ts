import { randomUUID } from "node:crypto";
import {
  EventStatus,
  GoalSize,
  PlannerCategory,
  PlannerTaskType,
  Priority,
  type PlannerEvent,
  type Prisma,
} from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import {
  NotFoundError,
  ValidationError,
  asObject,
  optionalDateOnly,
  optionalNullableInt,
  optionalText,
  optionalUuid,
  parseEnum,
  requireDateOnly,
  requireInt,
  requireText,
  toDateOnly,
} from "../validation.ts";
import { expandOccurrences, parseRepeat, recurrenceRuleData } from "./recurrence.ts";
import { requireUser } from "./taskService.ts";

// Visual Planner events (user stories 2.8 add tasks to the planner #14, 2.3 filter by priority #11,
// 1.1 quick weekly setup #2). Study sessions generated for exams are planner events too
// (sourceTaskId set); they are managed by studyPlanService and can't be edited here.

export function serializePlannerEvent(event: PlannerEvent) {
  return {
    id: event.id,
    goalId: event.goalId,
    linkedEventId: event.linkedEventId,
    sourceTaskId: event.sourceTaskId,
    title: event.title,
    category: event.category,
    taskType: event.taskType,
    goalSize: event.goalSize,
    priority: event.priority,
    status: event.status,
    eventDate: toDateOnly(event.eventDate)!,
    originalEventDate: toDateOnly(event.originalEventDate),
    startHour: event.startHour,
    durationHours: event.durationHours,
    description: event.description,
    notes: event.notes,
    remindersPerDay: event.remindersPerDay,
    seriesId: event.seriesId,
  };
}

const MAX_BULK_EVENTS = 50;

type EventFields = Omit<Prisma.PlannerEventUncheckedCreateInput, "userId" | "eventDate">;

/** Validates create fields. Every field except title, eventDate and startHour has a default. */
function parseNewEvent(body: Record<string, unknown>, prefix = "") {
  const name = (field: string) => `${prefix}${field}`;
  const eventDate = requireDateOnly(body.eventDate, name("eventDate"));
  const startHour = requireInt(body.startHour, name("startHour"), 0, 23);
  const durationHours =
    body.durationHours === undefined ? 1 : requireInt(body.durationHours, name("durationHours"), 1, 24);
  if (startHour + durationHours > 24) {
    throw new ValidationError(`${name("durationHours")}: the event must end by midnight.`);
  }
  const fields: EventFields = {
    title: requireText(body.title, name("title"), 200),
    category:
      body.category === undefined
        ? PlannerCategory.WORK
        : parseEnum(PlannerCategory, body.category, name("category")),
    taskType:
      body.taskType === undefined
        ? PlannerTaskType.PROJECT
        : parseEnum(PlannerTaskType, body.taskType, name("taskType")),
    goalSize:
      body.goalSize === undefined ? GoalSize.MEDIUM : parseEnum(GoalSize, body.goalSize, name("goalSize")),
    priority:
      body.priority === undefined ? Priority.NONE : parseEnum(Priority, body.priority, name("priority")),
    status:
      body.status === undefined
        ? EventStatus.NOT_STARTED
        : parseEnum(EventStatus, body.status, name("status")),
    startHour,
    durationHours,
    description: optionalText(body.description, name("description"), 2000),
    notes: optionalText(body.notes, name("notes"), 2000),
    remindersPerDay: optionalNullableInt(body.remindersPerDay, name("remindersPerDay"), 0, 24) ?? null,
    goalId: optionalUuid(body.goalId, name("goalId")),
    linkedEventId: optionalUuid(body.linkedEventId, name("linkedEventId")),
  };
  return { eventDate, fields };
}

async function checkReferences(
  db: Db,
  userId: string,
  goalId: string | null | undefined,
  linkedEventId: string | null | undefined,
  selfId?: string,
) {
  if (goalId) {
    const goal = await db.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
    if (!goal) throw new ValidationError("goalId does not match one of your goals.");
  }
  if (linkedEventId) {
    if (linkedEventId === selfId) throw new ValidationError("An event can't be connected to itself.");
    const linked = await db.plannerEvent.findFirst({
      where: { id: linkedEventId, userId },
      select: { id: true },
    });
    if (!linked) throw new ValidationError("linkedEventId does not match one of your planner events.");
  }
}

export async function listPlannerEvents(db: Db, userId: string, from?: unknown, to?: unknown) {
  await requireUser(db, userId);
  const fromDate = optionalDateOnly(from, "from");
  const toDate = optionalDateOnly(to, "to");
  if (fromDate && toDate && toDate < fromDate) throw new ValidationError("to must be on or after from.");
  const events = await db.plannerEvent.findMany({
    where: {
      userId,
      eventDate: fromDate || toDate ? { gte: fromDate ?? undefined, lte: toDate ?? undefined } : undefined,
    },
    orderBy: [{ eventDate: "asc" }, { startHour: "asc" }, { createdAt: "asc" }],
  });
  return events.map(serializePlannerEvent);
}

/** Creates one event, or every occurrence of a repeating one (returns them all). */
export async function createPlannerEvent(db: Db, userId: string, body: Record<string, unknown>) {
  await requireUser(db, userId);
  const { eventDate, fields } = parseNewEvent(body);
  await checkReferences(db, userId, fields.goalId, fields.linkedEventId);

  const repeat = parseRepeat(body.repeat, eventDate);
  if (!repeat) {
    const event = await db.plannerEvent.create({ data: { ...fields, userId, eventDate } });
    return [serializePlannerEvent(event)];
  }
  const dates = expandOccurrences(eventDate, repeat);
  if (dates.length === 0) {
    throw new ValidationError("That repeat doesn't produce any dates. Check the days and end date.");
  }
  const seriesId = randomUUID();
  const events = await db.$transaction(async (tx) => {
    const rule = await tx.recurrenceRule.create({ data: recurrenceRuleData(userId, repeat) });
    await tx.plannerEvent.createMany({
      data: dates.map((date) => ({ ...fields, userId, eventDate: date, recurrenceRuleId: rule.id, seriesId })),
    });
    return tx.plannerEvent.findMany({ where: { seriesId }, orderBy: { eventDate: "asc" } });
  });
  return events.map(serializePlannerEvent);
}

/** Quick Setup: saves a whole week's tasks in one transaction, or none if any row is invalid. */
export async function createPlannerEvents(db: Db, userId: string, body: Record<string, unknown>) {
  await requireUser(db, userId);
  if (!Array.isArray(body.events) || body.events.length === 0) {
    throw new ValidationError("events must be a non-empty list.");
  }
  if (body.events.length > MAX_BULK_EVENTS) {
    throw new ValidationError(`Add at most ${MAX_BULK_EVENTS} events at once.`);
  }
  const parsed = body.events.map((raw, index) => {
    const item = asObject(raw);
    if (item.repeat !== undefined || item.linkedEventId !== undefined) {
      throw new ValidationError(`events[${index}]: repeats and connections can't be set in Quick Setup.`);
    }
    return parseNewEvent(item, `events[${index}].`);
  });
  for (const { fields } of parsed) await checkReferences(db, userId, fields.goalId, null);

  const created = await db.$transaction(
    parsed.map(({ eventDate, fields }) => db.plannerEvent.create({ data: { ...fields, userId, eventDate } })),
  );
  return created.map(serializePlannerEvent);
}

async function requireEditableEvent(db: Db, userId: string, eventId: string) {
  const existing = await db.plannerEvent.findFirst({ where: { id: eventId, userId } });
  if (!existing) throw new NotFoundError("Planner event not found.");
  if (existing.sourceTaskId) {
    throw new ValidationError(
      "Study sessions are scheduled automatically from your exams. Change them in Settings → Exam study sessions.",
    );
  }
  return existing;
}

export async function updatePlannerEvent(
  db: Db,
  userId: string,
  eventId: string,
  body: Record<string, unknown>,
) {
  const existing = await requireEditableEvent(db, userId, eventId);
  const data: Prisma.PlannerEventUncheckedUpdateInput = {};

  if (body.title !== undefined) data.title = requireText(body.title, "title", 200);
  if (body.category !== undefined) data.category = parseEnum(PlannerCategory, body.category, "category");
  if (body.taskType !== undefined) data.taskType = parseEnum(PlannerTaskType, body.taskType, "taskType");
  if (body.goalSize !== undefined) data.goalSize = parseEnum(GoalSize, body.goalSize, "goalSize");
  if (body.priority !== undefined) data.priority = parseEnum(Priority, body.priority, "priority");
  if (body.status !== undefined) data.status = parseEnum(EventStatus, body.status, "status");
  if (body.eventDate !== undefined) data.eventDate = requireDateOnly(body.eventDate, "eventDate");
  if (body.description !== undefined) data.description = optionalText(body.description, "description", 2000);
  if (body.notes !== undefined) data.notes = optionalText(body.notes, "notes", 2000);
  const reminders = optionalNullableInt(body.remindersPerDay, "remindersPerDay", 0, 24);
  if (reminders !== undefined) data.remindersPerDay = reminders;
  if (body.goalId !== undefined) data.goalId = optionalUuid(body.goalId, "goalId");
  if (body.linkedEventId !== undefined) data.linkedEventId = optionalUuid(body.linkedEventId, "linkedEventId");

  const startHour = body.startHour === undefined ? existing.startHour : requireInt(body.startHour, "startHour", 0, 23);
  const durationHours =
    body.durationHours === undefined
      ? existing.durationHours
      : requireInt(body.durationHours, "durationHours", 1, 24);
  if (startHour + durationHours > 24) throw new ValidationError("The event must end by midnight.");
  if (body.startHour !== undefined) data.startHour = startHour;
  if (body.durationHours !== undefined) data.durationHours = durationHours;

  if (Object.keys(data).length === 0) throw new ValidationError("Provide at least one field to change.");
  await checkReferences(
    db,
    userId,
    data.goalId as string | null | undefined,
    data.linkedEventId as string | null | undefined,
    eventId,
  );

  // Remember the first date an event was moved away from, like originalDueDate on tasks.
  if (data.eventDate && !existing.originalEventDate && +(data.eventDate as Date) !== +existing.eventDate) {
    data.originalEventDate = existing.eventDate;
  }
  const event = await db.plannerEvent.update({ where: { id: eventId }, data });
  return serializePlannerEvent(event);
}

/** scope "series" deletes every occurrence of a repeating event from this one onward. */
export async function deletePlannerEvent(db: Db, userId: string, eventId: string, scope: unknown) {
  const existing = await requireEditableEvent(db, userId, eventId);
  if (scope !== undefined && scope !== "one" && scope !== "series") {
    throw new ValidationError('scope must be "one" or "series".');
  }
  if (scope === "series" && existing.seriesId) {
    const { count } = await db.plannerEvent.deleteMany({
      where: { userId, seriesId: existing.seriesId, eventDate: { gte: existing.eventDate } },
    });
    return { deleted: count };
  }
  await db.plannerEvent.delete({ where: { id: eventId } });
  return { deleted: 1 };
}
