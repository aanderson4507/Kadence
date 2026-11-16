import {
  PlannerCategory,
  PlannerTaskType,
  type Priority as PriorityEnum,
} from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import { scheduleStudySessions, type StudyShortfall } from "../../src/studySessions.ts";
import type { Priority as PriorityLabel } from "../../src/taskPriority.ts";
import { toDateOnly, todayDateOnly } from "../validation.ts";
import { serializePlannerEvent } from "./plannerService.ts";
import { requireUser } from "./taskService.ts";

// User story 2.2 (issue #9): mark an exam as high priority and Kadence sets aside study time in
// the days before it. The scheduling rules live in src/studySessions.ts (shared with the tests);
// this service feeds it the user's saved exams, study preferences and planner, and stores the
// result as planner events with sourceTaskId = the exam, so the sessions persist and show up in
// the planner like any other block of time.

export const PRIORITY_LABELS: Record<PriorityEnum, PriorityLabel> = {
  VERY_HIGH: "Very High",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  VERY_LOW: "Very Low",
  NONE: "None",
};

const LABEL_TO_PRIORITY = Object.fromEntries(
  Object.entries(PRIORITY_LABELS).map(([value, label]) => [label, value]),
) as Record<PriorityLabel, PriorityEnum>;

const sessionKey = (taskId: string, date: string, startHour: number, duration: number) =>
  `${taskId}|${date}|${startHour}|${duration}`;

/**
 * Recomputes the study sessions from today onward and stores the difference: sessions that no
 * longer fit (exam completed, date moved, planner changed, preferences changed) are removed,
 * new ones are added and unchanged ones keep their ids. Sessions on past days are history and
 * are left alone, as are today's sessions once they exist.
 */
export async function syncStudyPlan(db: Db, userId: string, now = new Date()) {
  await requireUser(db, userId);
  const today = todayDateOnly(now);
  const todayKey = toDateOnly(today)!;

  const [settings, exams, ownEvents, existing] = await Promise.all([
    db.userSettings.upsert({ where: { userId }, create: { userId }, update: {} }),
    db.task.findMany({ where: { userId, isExam: true, completed: false, dueDate: { gt: today } } }),
    db.plannerEvent.findMany({
      where: { userId, sourceTaskId: null, eventDate: { gte: today } },
      select: { eventDate: true, startHour: true, durationHours: true },
    }),
    db.plannerEvent.findMany({ where: { userId, sourceTaskId: { not: null }, eventDate: { gte: today } } }),
  ]);

  const plan = scheduleStudySessions(
    exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      priority: PRIORITY_LABELS[exam.priority],
      completed: exam.completed,
      dueDate: toDateOnly(exam.dueDate) ?? undefined,
      isExam: true,
    })),
    {
      daysBeforeExam: settings.studyDaysBeforeExam,
      sessionHours: settings.studySessionHours,
      sessionsPerDay: settings.studySessionsPerDay,
      windowStartHour: settings.studyWindowStartHour,
      windowEndHour: settings.studyWindowEndHour,
    },
    ownEvents.map((event) => ({
      date: toDateOnly(event.eventDate)!,
      startHour: event.startHour,
      duration: event.durationHours,
    })),
    { today: todayKey, currentHour: now.getHours() + now.getMinutes() / 60 },
  );

  // Today's sessions are fixed once created, so one that already started isn't moved or dropped.
  const examsWithSessionToday = new Set(
    existing
      .filter((event) => toDateOnly(event.eventDate) === todayKey)
      .map((event) => event.sourceTaskId!),
  );
  const desired = plan.sessions.filter(
    (session) => !(session.date === todayKey && examsWithSessionToday.has(session.examId)),
  );
  const shortfalls: StudyShortfall[] = plan.shortfalls.filter(
    (shortfall) => !(shortfall.date === todayKey && examsWithSessionToday.has(shortfall.examId)),
  );

  const desiredKeys = new Set(
    desired.map((session) => sessionKey(session.examId, session.date, session.startHour, session.duration)),
  );
  const stale = existing.filter((event) => {
    const date = toDateOnly(event.eventDate)!;
    if (date === todayKey && exams.some((exam) => exam.id === event.sourceTaskId)) return false;
    return !desiredKeys.has(sessionKey(event.sourceTaskId!, date, event.startHour, event.durationHours));
  });
  const existingKeys = new Set(
    existing.map((event) =>
      sessionKey(event.sourceTaskId!, toDateOnly(event.eventDate)!, event.startHour, event.durationHours),
    ),
  );
  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const additions = desired.filter(
    (session) => !existingKeys.has(sessionKey(session.examId, session.date, session.startHour, session.duration)),
  );

  if (stale.length > 0 || additions.length > 0) {
    await db.$transaction([
      db.plannerEvent.deleteMany({ where: { id: { in: stale.map((event) => event.id) } } }),
      db.plannerEvent.createMany({
        data: additions.map((session) => ({
          userId,
          sourceTaskId: session.examId,
          goalId: examById.get(session.examId)?.goalId ?? null,
          title: `Study: ${session.examTitle}`.slice(0, 200),
          category: PlannerCategory.FOCUS,
          taskType: PlannerTaskType.TASK,
          priority: LABEL_TO_PRIORITY[session.priority],
          eventDate: new Date(`${session.date}T00:00:00.000Z`),
          startHour: session.startHour,
          durationHours: session.duration,
          description: `Study session before ${session.examTitle} on ${session.examDate}.`,
        })),
      }),
    ]);
  }

  const events = await db.plannerEvent.findMany({
    where: { userId },
    orderBy: [{ eventDate: "asc" }, { startHour: "asc" }, { createdAt: "asc" }],
  });
  return {
    events: events.map(serializePlannerEvent),
    shortfalls,
    added: additions.length,
    removed: stale.length,
  };
}
