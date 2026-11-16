// Typed client for the Kadence API. The screens work with readable labels ("Very High",
// "In progress"); the API uses database enum values (VERY_HIGH, IN_PROGRESS). The tables below
// are the only place that translation happens. Settings has its own client in settingsApi.ts.

import { request } from "./http";
import type { Priority } from "./taskPriority";

export type { Priority };

// --- Label <-> enum tables -------------------------------------------------------------------

function table<Label extends string, Value extends string>(entries: Record<Label, Value>) {
  const reverse = Object.fromEntries(Object.entries(entries).map(([label, value]) => [value, label]));
  return {
    toApi: (label: Label) => entries[label],
    fromApi: (value: string, fallback: Label) => (reverse[value] as Label | undefined) ?? fallback,
    labels: Object.keys(entries) as Label[],
  };
}

export const priorities = table({
  "Very High": "VERY_HIGH",
  High: "HIGH",
  Medium: "MEDIUM",
  Low: "LOW",
  "Very Low": "VERY_LOW",
  None: "NONE",
} satisfies Record<Priority, string>);

export type PlannerCategory = "Personal" | "Focus" | "Wellbeing" | "Work";
export const plannerCategories = table({
  Personal: "PERSONAL",
  Focus: "FOCUS",
  Wellbeing: "WELLBEING",
  Work: "WORK",
} satisfies Record<PlannerCategory, string>);

export type PlannerStatus = "Not started" | "In progress" | "Done";
export const plannerStatuses = table({
  "Not started": "NOT_STARTED",
  "In progress": "IN_PROGRESS",
  Done: "DONE",
} satisfies Record<PlannerStatus, string>);

export type PlannerTaskType = "Project" | "Task" | "Habit";
export const plannerTaskTypes = table({
  Project: "PROJECT",
  Task: "TASK",
  Habit: "HABIT",
} satisfies Record<PlannerTaskType, string>);

export type GoalSizeLabel = "Small" | "Medium" | "Big";
export const goalSizes = table({ Small: "SMALL", Medium: "MEDIUM", Big: "BIG" } satisfies Record<GoalSizeLabel, string>);

export type RepeatFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
/** "Repeat N times in total, every day / week / month." */
export type Repeat = { frequency: RepeatFrequency; count: number } | null;

const toRepeat = (repeat: Repeat | undefined) =>
  repeat ? { frequency: repeat.frequency, maxOccurrences: repeat.count } : undefined;

const base = (userId: string) => `/api/users/${userId}`;

// --- Tasks (To-do list, Priority setter, exams) -----------------------------------------------

export type Task = {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  completed: boolean;
  dueDate?: string;
  completedDate?: string;
  /** Set the first time a task is rescheduled, so the original deadline stays visible. */
  originalDueDate?: string;
  /** Exams get study sessions scheduled in the days before their due date. */
  isExam?: boolean;
  /** null = use the reminder frequency for the task's priority. */
  remindersPerDay: number | null;
  inBacklog: boolean;
  goalId: string | null;
  seriesId: string | null;
};

type ApiTask = {
  id: string;
  title: string;
  category: string;
  priority: string;
  completed: boolean;
  dueDate: string | null;
  completedDate: string | null;
  originalDueDate: string | null;
  isExam: boolean;
  remindersPerDay: number | null;
  inBacklog: boolean;
  goalId: string | null;
  seriesId: string | null;
};

export function fromApiTask(task: ApiTask): Task {
  return {
    id: task.id,
    title: task.title,
    category: task.category,
    priority: priorities.fromApi(task.priority, "None"),
    completed: task.completed,
    dueDate: task.dueDate ?? undefined,
    completedDate: task.completedDate ?? undefined,
    originalDueDate: task.originalDueDate ?? undefined,
    isExam: task.isExam,
    remindersPerDay: task.remindersPerDay,
    inBacklog: task.inBacklog,
    goalId: task.goalId,
    seriesId: task.seriesId,
  };
}

export type TaskInput = {
  title: string;
  priority: Priority;
  category?: string;
  dueDate?: string;
  isExam?: boolean;
  remindersPerDay?: number | null;
  goalId?: string | null;
  repeat?: Repeat;
};

export type TaskChanges = Partial<{
  title: string;
  category: string;
  priority: Priority;
  dueDate: string | null;
  completed: boolean;
  isExam: boolean;
  remindersPerDay: number | null;
  inBacklog: boolean;
  goalId: string | null;
}>;

function taskBody(changes: TaskChanges | TaskInput) {
  const { priority, ...rest } = changes;
  return {
    ...rest,
    ...(priority !== undefined && { priority: priorities.toApi(priority) }),
    ...("repeat" in changes && { repeat: toRepeat(changes.repeat) }),
  };
}

export async function fetchTasks(userId: string) {
  const tasks = await request<ApiTask[]>(`${base(userId)}/tasks`, "Couldn't load your tasks.");
  return tasks.map(fromApiTask);
}

export async function createTask(userId: string, input: TaskInput) {
  const task = await request<ApiTask & { occurrenceCount: number }>(`${base(userId)}/tasks`, "The task wasn't added.", {
    method: "POST",
    json: taskBody(input),
  });
  return { task: fromApiTask(task), occurrenceCount: task.occurrenceCount };
}

export async function updateTask(userId: string, taskId: string, changes: TaskChanges) {
  const task = await request<ApiTask>(`${base(userId)}/tasks/${taskId}`, "Your change wasn't saved.", {
    method: "PATCH",
    json: taskBody(changes),
  });
  return fromApiTask(task);
}

export async function deleteTask(userId: string, taskId: string, scope: "one" | "series" = "one") {
  return request<{ deleted: number }>(`${base(userId)}/tasks/${taskId}?scope=${scope}`, "The task wasn't deleted.", {
    method: "DELETE",
  });
}

export type MissedAction = "RESCHEDULE" | "MOVE_TO_TODAY" | "BACKLOG";

export async function handleMissedTasks(userId: string, action: MissedAction, taskIds?: string[]) {
  return request<{ action: MissedAction; moved: number; unplaced: string[] }>(
    `${base(userId)}/tasks/missed`,
    "Your missed tasks weren't moved.",
    { method: "POST", json: { action, taskIds } },
  );
}

// --- Goals and milestones -----------------------------------------------------------------------

export type GoalSize = "BIG" | "MEDIUM" | "SMALL";
export type GoalStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type Milestone = {
  id: string;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
};

export type Goal = {
  id: string;
  parentGoalId: string | null;
  title: string;
  size: GoalSize;
  category: string | null;
  description: string | null;
  priority: Priority;
  startDate: string | null;
  targetDate: string | null;
  status: GoalStatus;
  completedAt: string | null;
  /** 0-100, derived on the server from milestones, linked tasks and child goals. */
  progress: number;
  milestones: Milestone[];
  tasks: { id: string; title: string; completed: boolean; dueDate: string | null; priority: Priority }[];
  taskCount: number;
  completedTaskCount: number;
};

type ApiGoal = Omit<Goal, "priority" | "tasks"> & {
  priority: string;
  tasks: (Omit<Goal["tasks"][number], "priority"> & { priority: string })[];
};

function fromApiGoal(goal: ApiGoal): Goal {
  return {
    ...goal,
    priority: priorities.fromApi(goal.priority, "None"),
    tasks: goal.tasks.map((task) => ({ ...task, priority: priorities.fromApi(task.priority, "None") })),
  };
}

export async function fetchGoals(userId: string) {
  const goals = await request<ApiGoal[]>(`${base(userId)}/goals`, "Couldn't load your goals.");
  return goals.map(fromApiGoal);
}

export type GoalInput = {
  title: string;
  size: GoalSize;
  priority: Priority;
  description?: string;
  startDate?: string;
  targetDate?: string;
  parentGoalId?: string | null;
  childGoalTitles?: string[];
};

export async function createGoal(userId: string, input: GoalInput) {
  return request(`${base(userId)}/goals`, "The goal wasn't added.", {
    method: "POST",
    json: { ...input, priority: priorities.toApi(input.priority) },
  });
}

export type GoalChanges = Partial<{
  title: string;
  description: string | null;
  priority: Priority;
  startDate: string | null;
  targetDate: string | null;
  status: GoalStatus;
  parentGoalId: string | null;
}>;

export async function updateGoal(userId: string, goalId: string, changes: GoalChanges) {
  const { priority, ...rest } = changes;
  const goal = await request<ApiGoal>(`${base(userId)}/goals/${goalId}`, "Your goal change wasn't saved.", {
    method: "PATCH",
    json: { ...rest, ...(priority && { priority: priorities.toApi(priority) }) },
  });
  return fromApiGoal(goal);
}

/** User story 2.4 (issue #12). */
export async function updateGoalPriority(userId: string, goalId: string, priority: Priority) {
  return request(`${base(userId)}/goals/${goalId}/priority`, "The goal's priority wasn't saved.", {
    method: "PATCH",
    json: { priority: priorities.toApi(priority) },
  });
}

export async function deleteGoal(userId: string, goalId: string) {
  return request(`${base(userId)}/goals/${goalId}`, "The goal wasn't deleted.", { method: "DELETE" });
}

export async function createMilestone(userId: string, goalId: string, input: { title: string; dueDate?: string }) {
  const goal = await request<ApiGoal>(`${base(userId)}/goals/${goalId}/milestones`, "The milestone wasn't added.", {
    method: "POST",
    json: input,
  });
  return fromApiGoal(goal);
}

export async function updateMilestone(
  userId: string,
  goalId: string,
  milestoneId: string,
  changes: Partial<{ title: string; dueDate: string | null; completed: boolean }>,
) {
  const goal = await request<ApiGoal>(
    `${base(userId)}/goals/${goalId}/milestones/${milestoneId}`,
    "Your milestone change wasn't saved.",
    { method: "PATCH", json: changes },
  );
  return fromApiGoal(goal);
}

export async function deleteMilestone(userId: string, goalId: string, milestoneId: string) {
  const goal = await request<ApiGoal>(
    `${base(userId)}/goals/${goalId}/milestones/${milestoneId}`,
    "The milestone wasn't deleted.",
    { method: "DELETE" },
  );
  return fromApiGoal(goal);
}

// --- Visual Planner -------------------------------------------------------------------------

export type PlannerEvent = {
  id: string;
  title: string;
  category: PlannerCategory;
  date: string;
  startHour: number;
  duration: number;
  description: string;
  status: PlannerStatus;
  priority: Priority;
  taskType: PlannerTaskType;
  goalSize: GoalSizeLabel;
  linkedEventId: string | null;
  goalId: string | null;
  notes: string;
  remindersPerDay: number | null;
  seriesId: string | null;
  originalDate: string | null;
  /** Set on study sessions generated from an exam; these can't be edited by hand. */
  sourceTaskId: string | null;
};

type ApiPlannerEvent = {
  id: string;
  title: string;
  category: string;
  taskType: string;
  goalSize: string;
  priority: string;
  status: string;
  eventDate: string;
  originalEventDate: string | null;
  startHour: number;
  durationHours: number;
  description: string | null;
  notes: string | null;
  remindersPerDay: number | null;
  linkedEventId: string | null;
  goalId: string | null;
  seriesId: string | null;
  sourceTaskId: string | null;
};

function fromApiEvent(event: ApiPlannerEvent): PlannerEvent {
  return {
    id: event.id,
    title: event.title,
    category: plannerCategories.fromApi(event.category, "Work"),
    date: event.eventDate,
    startHour: event.startHour,
    duration: event.durationHours,
    description: event.description ?? "",
    status: plannerStatuses.fromApi(event.status, "Not started"),
    priority: priorities.fromApi(event.priority, "None"),
    taskType: plannerTaskTypes.fromApi(event.taskType, "Project"),
    goalSize: goalSizes.fromApi(event.goalSize, "Medium"),
    linkedEventId: event.linkedEventId,
    goalId: event.goalId,
    notes: event.notes ?? "",
    remindersPerDay: event.remindersPerDay,
    seriesId: event.seriesId,
    originalDate: event.originalEventDate,
    sourceTaskId: event.sourceTaskId,
  };
}

export type PlannerEventInput = {
  title: string;
  category: PlannerCategory;
  date: string;
  startHour: number;
  duration: number;
  description: string;
  status: PlannerStatus;
  priority: Priority;
  taskType: PlannerTaskType;
  goalSize: GoalSizeLabel;
  linkedEventId: string | null;
  notes: string;
  remindersPerDay: number | null;
  repeat?: Repeat;
};

function eventBody(input: Partial<PlannerEventInput>) {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.category !== undefined) body.category = plannerCategories.toApi(input.category);
  if (input.date !== undefined) body.eventDate = input.date;
  if (input.startHour !== undefined) body.startHour = input.startHour;
  if (input.duration !== undefined) body.durationHours = input.duration;
  if (input.description !== undefined) body.description = input.description;
  if (input.status !== undefined) body.status = plannerStatuses.toApi(input.status);
  if (input.priority !== undefined) body.priority = priorities.toApi(input.priority);
  if (input.taskType !== undefined) body.taskType = plannerTaskTypes.toApi(input.taskType);
  if (input.goalSize !== undefined) body.goalSize = goalSizes.toApi(input.goalSize);
  if (input.linkedEventId !== undefined) body.linkedEventId = input.linkedEventId;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.remindersPerDay !== undefined) body.remindersPerDay = input.remindersPerDay;
  if (input.repeat) body.repeat = toRepeat(input.repeat);
  return body;
}

export async function fetchPlannerEvents(userId: string) {
  const events = await request<ApiPlannerEvent[]>(`${base(userId)}/planner-events`, "Couldn't load your planner.");
  return events.map(fromApiEvent);
}

/** Returns every occurrence created (one unless the event repeats). */
export async function createPlannerEvent(userId: string, input: PlannerEventInput) {
  const events = await request<ApiPlannerEvent[]>(`${base(userId)}/planner-events`, "The task wasn't added.", {
    method: "POST",
    json: eventBody(input),
  });
  return events.map(fromApiEvent);
}

/** Quick Setup (user story 1.1, issue #2): saves the whole week at once. */
export async function createPlannerEvents(userId: string, inputs: Partial<PlannerEventInput>[]) {
  const events = await request<ApiPlannerEvent[]>(
    `${base(userId)}/planner-events/bulk`,
    "Your week wasn't saved.",
    { method: "POST", json: { events: inputs.map(eventBody) } },
  );
  return events.map(fromApiEvent);
}

export async function updatePlannerEvent(userId: string, eventId: string, changes: Partial<PlannerEventInput>) {
  const event = await request<ApiPlannerEvent>(
    `${base(userId)}/planner-events/${eventId}`,
    "Your changes weren't saved.",
    { method: "PATCH", json: eventBody(changes) },
  );
  return fromApiEvent(event);
}

export async function deletePlannerEvent(userId: string, eventId: string, scope: "one" | "series" = "one") {
  return request<{ deleted: number }>(
    `${base(userId)}/planner-events/${eventId}?scope=${scope}`,
    "The task wasn't deleted.",
    { method: "DELETE" },
  );
}

export type StudyShortfall = { examId: string; examTitle: string; date: string; missing: number };

/** Recomputes exam study sessions on the server and returns the whole planner (issue #9). */
export async function syncStudyPlan(userId: string) {
  const result = await request<{ events: ApiPlannerEvent[]; shortfalls: StudyShortfall[] }>(
    `${base(userId)}/study-plan/sync`,
    "Couldn't update your study sessions.",
    { method: "POST" },
  );
  return { events: result.events.map(fromApiEvent), shortfalls: result.shortfalls };
}

// --- Notifications ----------------------------------------------------------------------------

export type NotificationType =
  | "DAILY_PLANNING"
  | "UPCOMING_TASK"
  | "DEADLINE"
  | "GOAL_PROGRESS"
  | "WEEKLY_REVIEW"
  | "MISSED_GOAL";

export type AppNotification = {
  id: string;
  type: NotificationType;
  scheduledFor: string;
  readAt: string | null;
  task: { id: string; title: string; dueDate: string | null; priority: string } | null;
  plannerEvent: { id: string; title: string; eventDate: string | null; startHour: number } | null;
};

export type NotificationFeed = {
  notifications: AppNotification[];
  unreadCount: number;
  scheduledLaterToday: number;
};

export async function syncNotifications(userId: string) {
  return request<NotificationFeed>(`${base(userId)}/notifications/sync`, "Couldn't check your reminders.", {
    method: "POST",
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return request<NotificationFeed>(
    `${base(userId)}/notifications/${notificationId}/read`,
    "Couldn't update the notification.",
    { method: "POST" },
  );
}

export async function markAllNotificationsRead(userId: string) {
  return request<NotificationFeed>(`${base(userId)}/notifications/read-all`, "Couldn't update notifications.", {
    method: "POST",
  });
}

// --- Weekly review ----------------------------------------------------------------------------

export type WeeklyReview = {
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  completed: Task[];
  pending: Task[];
  overdue: Task[];
  completionRate: number;
  days: { date: string; completed: number; due: number }[];
  goalsCompleted: { id: string; title: string; size: GoalSize }[];
  milestonesReached: { id: string; title: string; goalTitle: string }[];
  hoursSpent: number;
  preferences: {
    summaryItems: string[];
    reflectionQuestions: boolean;
    visualization: "CHARTS" | "PROGRESS_BARS" | "PERCENTAGES";
    reviewDay: number;
  };
  reflection: string;
  reviewedAt: string | null;
};

type ApiWeeklyReview = Omit<WeeklyReview, "completed" | "pending" | "overdue"> & {
  completed: ApiTask[];
  pending: ApiTask[];
  overdue: ApiTask[];
};

function fromApiReview(review: ApiWeeklyReview): WeeklyReview {
  return {
    ...review,
    completed: review.completed.map(fromApiTask),
    pending: review.pending.map(fromApiTask),
    overdue: review.overdue.map(fromApiTask),
  };
}

export async function fetchWeeklyReview(userId: string, week?: string) {
  const review = await request<ApiWeeklyReview>(
    `${base(userId)}/weekly-review${week ? `?week=${week}` : ""}`,
    "Couldn't load your weekly review.",
  );
  return fromApiReview(review);
}

export async function saveWeeklyReflection(userId: string, weekStart: string, reflection: string) {
  const review = await request<ApiWeeklyReview>(`${base(userId)}/weekly-review`, "Your reflection wasn't saved.", {
    method: "PUT",
    json: { weekStart, reflection },
  });
  return fromApiReview(review);
}

// --- Reminder frequency and open time slots (Settings) ----------------------------------------

export type ReminderRule = { priority: Priority; remindersPerDay: number; channel: "IN_APP" | "EMAIL" | "PUSH" };

export async function fetchReminderRules(userId: string) {
  const rules = await request<(Omit<ReminderRule, "priority"> & { priority: string })[]>(
    `${base(userId)}/reminder-rules`,
    "Couldn't load your reminder frequency.",
  );
  return rules.map((rule) => ({ ...rule, priority: priorities.fromApi(rule.priority, "None") }));
}

export async function saveReminderRules(userId: string, rules: ReminderRule[]) {
  const saved = await request<(Omit<ReminderRule, "priority"> & { priority: string })[]>(
    `${base(userId)}/reminder-rules`,
    "Your reminder frequency wasn't saved.",
    { method: "PUT", json: { rules: rules.map((rule) => ({ ...rule, priority: priorities.toApi(rule.priority) })) } },
  );
  return saved.map((rule) => ({ ...rule, priority: priorities.fromApi(rule.priority, "None") }));
}

export type AvailabilityWindow = { weekday: number; startMinute: number; endMinute: number };

export async function fetchAvailability(userId: string) {
  return request<AvailabilityWindow[]>(`${base(userId)}/availability`, "Couldn't load your open time slots.");
}

export async function saveAvailability(userId: string, windows: AvailabilityWindow[]) {
  return request<AvailabilityWindow[]>(`${base(userId)}/availability`, "Your open time slots weren't saved.", {
    method: "PUT",
    json: { windows },
  });
}

// --- Workspace preferences (main-screen mode #6, tab layout #8, unfinished tasks #3) ----------

export type DashboardMode = "SIMPLE" | "ADVANCED";
export type TabLayout = { views: { view: string; size: number }[]; split: boolean; active: string | null };

export type WorkspacePreferences = {
  dashboardMode: DashboardMode;
  tabLayout: TabLayout | null;
  unfinishedBehavior: "ASK" | "MOVE_TO_NEXT_DAY" | "KEEP_ORIGINAL_DATE" | "MOVE_TO_BACKLOG";
  unfinishedReviewTime: "END_OF_DAY" | "START_OF_NEXT_DAY" | "WEEKLY_REVIEW" | "NEVER";
  autoReschedule: boolean;
  weekStart: "SUNDAY" | "MONDAY" | "SATURDAY";
  landingPage: "DASHBOARD" | "PLANNER" | "GOALS";
};

export async function fetchWorkspacePreferences(userId: string): Promise<WorkspacePreferences> {
  const settings = await request<{ preferences: WorkspacePreferences }>(
    `${base(userId)}/settings`,
    "Couldn't load your preferences.",
  );
  return settings.preferences;
}

export async function saveWorkspacePreferences(
  userId: string,
  changes: Partial<Pick<WorkspacePreferences, "dashboardMode" | "tabLayout">>,
) {
  await request(`${base(userId)}/settings`, "Your layout wasn't saved.", {
    method: "PATCH",
    json: { preferences: changes },
  });
}
