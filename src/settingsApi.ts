// Settings data shared by the Settings page and the API (server/services/settingsService.ts).
// The page works with readable labels; the API uses the database enum values. The two
// mapping tables below are the only place that translation happens.

export type ThemePreference = "Light mode" | "Dark mode" | "System default";

export type SettingsValues = {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    school: string;
    major: string;
    /** "YYYY-MM", or "" when not set. */
    graduationDate: string;
    careerInterests: string;
    careerGoals: string;
    /** Preview only: not stored on the server yet (users.avatar_url holds a URL, not an upload). */
    avatar: string | null;
  };
  planner: {
    theme: ThemePreference;
    accent: string;
    view: "Daily" | "Weekly" | "Monthly";
    startWeek: "Sunday" | "Monday" | "Saturday";
    timeFormat: "12-hour clock" | "24-hour clock";
    landingPage: "Dashboard" | "Planner" | "Goals";
  };
  notifications: {
    reminders: Record<ReminderLabel, boolean>;
    /** "HH:MM", or "" when Do Not Disturb is off. */
    quietStart: string;
    quietEnd: string;
  };
  goals: {
    timeframe: "Daily" | "Weekly" | "Monthly" | "Yearly";
    category: "Academic" | "Career" | "Personal development";
    breakdown: "Major milestones" | "Daily" | "Weekly" | "Manual";
    priority: "Low" | "Medium" | "High";
    celebration: "Message" | "Animation" | "Turn off";
    progress: "% complete" | "Tasks completed" | "Milestones completed" | "Time spent";
  };
  unfinished: {
    behavior:
      | "Ask me what to do"
      | "Automatically move to the next day"
      | "Keep on the original date"
      | "Move to a task backlog for later scheduling";
    reviewTime:
      | "End of each day"
      | "Start of the next day"
      | "During my weekly review"
      | "Never remind me";
    deadline:
      | "Automatically update the deadline when rescheduling"
      | "Keep the original deadline visible"
      | "Ask me to set a new deadline";
    autoReschedule: boolean;
    highPriorityOnly: boolean;
    excludeOverdue: boolean;
    dailyLimit: number;
    warnOverload: boolean;
    reprioritizeWhenFull: boolean;
  };
  weekly: {
    reviewDay: Weekday;
    reminder: boolean;
    /** "HH:MM" */
    reminderTime: string;
    summary: SummaryLabel[];
    reflectionQuestions: boolean;
    missedGoal: "Keep" | "Reschedule" | "Revise" | "Archive";
    visualization: "Charts" | "Progress bars" | "Percentages";
  };
  privacy: {
    backup: "Automatic" | "Manual" | "Off";
    deleteCompleted: boolean;
  };
};

export type AccountInfo = { username: string };

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
type Weekday = (typeof WEEKDAYS)[number];

const REMINDER_FIELDS = {
  "Daily planning reminder": "remindDailyPlanning",
  "Upcoming task reminders": "remindUpcoming",
  "Deadline notifications": "remindDeadline",
  "Goal progress reminders": "remindGoalProgress",
  "Weekly review reminder": "remindWeeklyReview",
  "Missed-goal notifications": "remindMissedGoal",
} as const;
export type ReminderLabel = keyof typeof REMINDER_FIELDS;
export const REMINDER_LABELS = Object.keys(REMINDER_FIELDS) as ReminderLabel[];

const SUMMARY_ITEMS = {
  "Tasks completed": "TASKS_COMPLETED",
  "Goals completed": "GOALS_COMPLETED",
  "Milestones reached": "MILESTONES_REACHED",
  "Time spent": "TIME_SPENT",
  "Completion rate": "COMPLETION_RATE",
} as const;
export type SummaryLabel = keyof typeof SUMMARY_ITEMS;
export const SUMMARY_LABELS = Object.keys(SUMMARY_ITEMS) as SummaryLabel[];

/** UI label -> API enum value, for every single-choice preference. */
const ENUMS = {
  theme: { "Light mode": "LIGHT", "Dark mode": "DARK", "System default": "SYSTEM" },
  view: { Daily: "DAILY", Weekly: "WEEKLY", Monthly: "MONTHLY" },
  startWeek: { Sunday: "SUNDAY", Monday: "MONDAY", Saturday: "SATURDAY" },
  timeFormat: { "12-hour clock": "TWELVE_HOUR", "24-hour clock": "TWENTY_FOUR_HOUR" },
  landingPage: { Dashboard: "DASHBOARD", Planner: "PLANNER", Goals: "GOALS" },
  timeframe: { Daily: "DAILY", Weekly: "WEEKLY", Monthly: "MONTHLY", Yearly: "YEARLY" },
  category: { Academic: "ACADEMIC", Career: "CAREER", "Personal development": "PERSONAL_DEVELOPMENT" },
  breakdown: { "Major milestones": "MAJOR_MILESTONES", Daily: "DAILY", Weekly: "WEEKLY", Manual: "MANUAL" },
  priority: { Low: "LOW", Medium: "MEDIUM", High: "HIGH" },
  celebration: { Message: "MESSAGE", Animation: "ANIMATION", "Turn off": "OFF" },
  progress: {
    "% complete": "PERCENT_COMPLETE",
    "Tasks completed": "TASKS_COMPLETED",
    "Milestones completed": "MILESTONES_COMPLETED",
    "Time spent": "TIME_SPENT",
  },
  behavior: {
    "Ask me what to do": "ASK",
    "Automatically move to the next day": "MOVE_TO_NEXT_DAY",
    "Keep on the original date": "KEEP_ORIGINAL_DATE",
    "Move to a task backlog for later scheduling": "MOVE_TO_BACKLOG",
  },
  reviewTime: {
    "End of each day": "END_OF_DAY",
    "Start of the next day": "START_OF_NEXT_DAY",
    "During my weekly review": "WEEKLY_REVIEW",
    "Never remind me": "NEVER",
  },
  deadline: {
    "Automatically update the deadline when rescheduling": "AUTO_UPDATE",
    "Keep the original deadline visible": "KEEP_ORIGINAL",
    "Ask me to set a new deadline": "ASK",
  },
  missedGoal: { Keep: "KEEP", Reschedule: "RESCHEDULE", Revise: "REVISE", Archive: "ARCHIVE" },
  visualization: { Charts: "CHARTS", "Progress bars": "PROGRESS_BARS", Percentages: "PERCENTAGES" },
  backup: { Automatic: "AUTOMATIC", Manual: "MANUAL", Off: "OFF" },
} as const;

type EnumName = keyof typeof ENUMS;
type EnumLabel<Name extends EnumName> = keyof (typeof ENUMS)[Name] & string;

function toApi<Name extends EnumName>(name: Name, label: EnumLabel<Name>): string {
  return (ENUMS[name] as Record<string, string>)[label];
}

/** Unknown values (e.g. a VERY_HIGH goal priority set elsewhere) fall back to the default. */
function fromApi<Name extends EnumName>(
  name: Name,
  value: unknown,
  fallback: EnumLabel<Name>,
): EnumLabel<Name> {
  const entry = Object.entries(ENUMS[name]).find(([, apiValue]) => apiValue === value);
  return (entry?.[0] as EnumLabel<Name>) ?? fallback;
}

export const DEFAULT_SETTINGS: SettingsValues = {
  profile: {
    firstName: "",
    lastName: "",
    email: "",
    school: "",
    major: "",
    graduationDate: "",
    careerInterests: "",
    careerGoals: "",
    avatar: null,
  },
  planner: {
    theme: "Light mode",
    accent: "#406b51",
    view: "Daily",
    startWeek: "Sunday",
    timeFormat: "12-hour clock",
    landingPage: "Dashboard",
  },
  notifications: {
    reminders: Object.fromEntries(REMINDER_LABELS.map((label) => [label, true])) as Record<
      ReminderLabel,
      boolean
    >,
    quietStart: "",
    quietEnd: "",
  },
  goals: {
    timeframe: "Daily",
    category: "Academic",
    breakdown: "Major milestones",
    priority: "Medium",
    celebration: "Message",
    progress: "% complete",
  },
  unfinished: {
    behavior: "Ask me what to do",
    reviewTime: "Start of the next day",
    deadline: "Keep the original deadline visible",
    autoReschedule: false,
    highPriorityOnly: false,
    excludeOverdue: false,
    dailyLimit: 3,
    warnOverload: true,
    reprioritizeWhenFull: true,
  },
  weekly: {
    reviewDay: "Friday",
    reminder: true,
    reminderTime: "16:30",
    summary: ["Tasks completed", "Goals completed", "Milestones reached", "Time spent"],
    reflectionQuestions: true,
    missedGoal: "Keep",
    visualization: "Charts",
  },
  privacy: {
    backup: "Automatic",
    deleteCompleted: true,
  },
};

function minutesFromTime(value: string): number | null {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(value: unknown): string {
  if (typeof value !== "number") return "";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

/** Converts page values into the PATCH /settings request body (all fields). */
export function toSettingsPayload(values: SettingsValues) {
  const { profile, planner, notifications, goals, unfinished, weekly, privacy } = values;
  return {
    profile: {
      email: profile.email.trim(),
      firstName: profile.firstName,
      lastName: profile.lastName,
      school: profile.school,
      major: profile.major,
      graduationDate: profile.graduationDate,
      careerInterests: profile.careerInterests,
      careerGoals: profile.careerGoals,
    },
    preferences: {
      theme: toApi("theme", planner.theme),
      accentColor: planner.accent,
      plannerView: toApi("view", planner.view),
      weekStart: toApi("startWeek", planner.startWeek),
      timeFormat: toApi("timeFormat", planner.timeFormat),
      landingPage: toApi("landingPage", planner.landingPage),
      ...Object.fromEntries(
        REMINDER_LABELS.map((label) => [REMINDER_FIELDS[label], notifications.reminders[label]]),
      ),
      quietStartMinute: minutesFromTime(notifications.quietStart),
      quietEndMinute: minutesFromTime(notifications.quietEnd),
      goalTimeframe: toApi("timeframe", goals.timeframe),
      goalCategory: toApi("category", goals.category),
      goalBreakdown: toApi("breakdown", goals.breakdown),
      goalPriority: toApi("priority", goals.priority),
      celebration: toApi("celebration", goals.celebration),
      progressMetric: toApi("progress", goals.progress),
      unfinishedBehavior: toApi("behavior", unfinished.behavior),
      unfinishedReviewTime: toApi("reviewTime", unfinished.reviewTime),
      deadlineHandling: toApi("deadline", unfinished.deadline),
      autoReschedule: unfinished.autoReschedule,
      rescheduleHighOnly: unfinished.highPriorityOnly,
      rescheduleExcludeOverdue: unfinished.excludeOverdue,
      dailyLimit: unfinished.dailyLimit,
      warnOverload: unfinished.warnOverload,
      reprioritizeWhenFull: unfinished.reprioritizeWhenFull,
      reviewDay: WEEKDAYS.indexOf(weekly.reviewDay),
      reviewReminder: weekly.reminder,
      reviewMinute: minutesFromTime(weekly.reminderTime) ?? 0,
      // Always in display order, so the same selection always produces the same payload.
      reviewSummaryItems: SUMMARY_LABELS.filter((label) => weekly.summary.includes(label)).map(
        (label) => SUMMARY_ITEMS[label],
      ),
      reflectionQuestions: weekly.reflectionQuestions,
      missedGoalHandling: toApi("missedGoal", weekly.missedGoal),
      visualization: toApi("visualization", weekly.visualization),
      backup: toApi("backup", privacy.backup),
      deleteCompleted: privacy.deleteCompleted,
    },
  };
}

type ApiSettings = {
  profile: Record<string, unknown>;
  preferences: Record<string, unknown>;
};

/** Converts a GET/PATCH /settings response into page values. */
export function fromSettingsResponse(response: ApiSettings, avatar: string | null = null): SettingsValues {
  const { profile: p, preferences: s } = response;
  const d = DEFAULT_SETTINGS;
  const summaryValues = Array.isArray(s.reviewSummaryItems) ? s.reviewSummaryItems : [];
  return {
    profile: {
      firstName: text(p.firstName),
      lastName: text(p.lastName),
      email: text(p.email),
      school: text(p.school),
      major: text(p.major),
      graduationDate: text(p.graduationDate),
      careerInterests: text(p.careerInterests),
      careerGoals: text(p.careerGoals),
      avatar,
    },
    planner: {
      theme: fromApi("theme", s.theme, d.planner.theme),
      accent: typeof s.accentColor === "string" ? s.accentColor : d.planner.accent,
      view: fromApi("view", s.plannerView, d.planner.view),
      startWeek: fromApi("startWeek", s.weekStart, d.planner.startWeek),
      timeFormat: fromApi("timeFormat", s.timeFormat, d.planner.timeFormat),
      landingPage: fromApi("landingPage", s.landingPage, d.planner.landingPage),
    },
    notifications: {
      reminders: Object.fromEntries(
        REMINDER_LABELS.map((label) => [label, bool(s[REMINDER_FIELDS[label]], true)]),
      ) as Record<ReminderLabel, boolean>,
      quietStart: timeFromMinutes(s.quietStartMinute),
      quietEnd: timeFromMinutes(s.quietEndMinute),
    },
    goals: {
      timeframe: fromApi("timeframe", s.goalTimeframe, d.goals.timeframe),
      category: fromApi("category", s.goalCategory, d.goals.category),
      breakdown: fromApi("breakdown", s.goalBreakdown, d.goals.breakdown),
      priority:
        s.goalPriority === "VERY_HIGH"
          ? "High"
          : s.goalPriority === "VERY_LOW"
            ? "Low"
            : fromApi("priority", s.goalPriority, d.goals.priority),
      celebration: fromApi("celebration", s.celebration, d.goals.celebration),
      progress: fromApi("progress", s.progressMetric, d.goals.progress),
    },
    unfinished: {
      behavior: fromApi("behavior", s.unfinishedBehavior, d.unfinished.behavior),
      reviewTime: fromApi("reviewTime", s.unfinishedReviewTime, d.unfinished.reviewTime),
      deadline: fromApi("deadline", s.deadlineHandling, d.unfinished.deadline),
      autoReschedule: bool(s.autoReschedule, d.unfinished.autoReschedule),
      highPriorityOnly: bool(s.rescheduleHighOnly, d.unfinished.highPriorityOnly),
      excludeOverdue: bool(s.rescheduleExcludeOverdue, d.unfinished.excludeOverdue),
      dailyLimit: typeof s.dailyLimit === "number" ? s.dailyLimit : d.unfinished.dailyLimit,
      warnOverload: bool(s.warnOverload, d.unfinished.warnOverload),
      reprioritizeWhenFull: bool(s.reprioritizeWhenFull, d.unfinished.reprioritizeWhenFull),
    },
    weekly: {
      reviewDay: WEEKDAYS[typeof s.reviewDay === "number" ? s.reviewDay : 5] ?? d.weekly.reviewDay,
      reminder: bool(s.reviewReminder, d.weekly.reminder),
      reminderTime: timeFromMinutes(s.reviewMinute) || d.weekly.reminderTime,
      // Keep the page's display order regardless of the order stored.
      summary: SUMMARY_LABELS.filter((label) => summaryValues.includes(SUMMARY_ITEMS[label])),
      reflectionQuestions: bool(s.reflectionQuestions, d.weekly.reflectionQuestions),
      missedGoal: fromApi("missedGoal", s.missedGoalHandling, d.weekly.missedGoal),
      visualization: fromApi("visualization", s.visualization, d.weekly.visualization),
    },
    privacy: {
      backup: fromApi("backup", s.backup, d.privacy.backup),
      deleteCompleted: bool(s.deleteCompleted, d.privacy.deleteCompleted),
    },
  };
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Checks the problems a user can fix before saving. Returns a message, or null when valid. */
export function validateSettings(values: SettingsValues): string | null {
  const email = values.profile.email.trim();
  if (!email) return "Enter an email address before saving.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address, like name@university.edu.";
  const { quietStart, quietEnd } = values.notifications;
  if (Boolean(quietStart) !== Boolean(quietEnd)) {
    return "Choose both a start and end time for Do Not Disturb hours, or clear both.";
  }
  const { dailyLimit } = values.unfinished;
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 20) {
    return "Daily task limit must be a whole number from 0 to 20.";
  }
  return null;
}

/** True when two values would save the same data (the avatar preview is not saved). */
export function sameSettings(a: SettingsValues, b: SettingsValues) {
  return JSON.stringify(toSettingsPayload(a)) === JSON.stringify(toSettingsPayload(b));
}

export class SettingsRequestError extends Error {}

const REQUEST_TIMEOUT_MS = 10_000;

async function request(path: string, failureMessage: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new SettingsRequestError(
      `${failureMessage} Kadence couldn't reach the server. Check your connection and try again.`,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const serverMessage =
      typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : null;
    // 4xx messages explain what to fix; 5xx messages are generic and not useful to show.
    throw new SettingsRequestError(
      response.status < 500 && serverMessage
        ? `${failureMessage} ${serverMessage}`
        : `${failureMessage} Please try again in a moment.`,
    );
  }
  return body;
}

/**
 * Loads the signed-in user's settings. Authentication is not implemented yet, so this uses
 * the development demo account (see GET /api/dev/user in server/app.ts).
 */
export async function loadSettings(): Promise<{
  userId: string;
  account: AccountInfo;
  values: SettingsValues;
}> {
  const failure = "Couldn't load your saved settings.";
  const user = (await request("/api/dev/user", failure)) as { id: string };
  const response = (await request(`/api/users/${user.id}/settings`, failure)) as ApiSettings;
  return {
    userId: user.id,
    account: { username: text(response.profile.username) },
    values: fromSettingsResponse(response),
  };
}

/** Saves every setting in one request and returns the values the server stored. */
export async function saveSettings(
  userId: string,
  values: SettingsValues,
): Promise<SettingsValues> {
  const response = (await request(`/api/users/${userId}/settings`, "Your changes weren't saved.", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toSettingsPayload(values)),
  })) as ApiSettings;
  return fromSettingsResponse(response, values.profile.avatar);
}

/** Saves only the theme, used when the theme is switched from the workspace header. */
export async function saveThemePreference(userId: string, theme: ThemePreference) {
  await request(`/api/users/${userId}/settings`, "Your theme wasn't saved.", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences: { theme: toApi("theme", theme) } }),
  });
}
