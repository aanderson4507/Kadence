import {
  BackupPreference,
  CelebrationStyle,
  DeadlineHandling,
  GoalBreakdownMethod,
  GoalCategory,
  GoalTimeframe,
  LandingPage,
  MissedGoalHandling,
  PlannerViewPreference,
  Priority,
  ProgressMetric,
  ProgressVisualization,
  ThemePreference,
  TimeFormat,
  UnfinishedReviewTime,
  UnfinishedTaskBehavior,
  WeekStart,
  type Prisma,
  type UserSettings,
} from "../generated/prisma/client.ts";
import type { Db } from "../db.ts";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  optionalText,
  parseEnum,
} from "../validation.ts";

// User story: "change preferences and account information quickly". One request reads the
// whole Settings page (profile + preferences); one request saves any subset of it.

type Parser = (value: unknown, name: string) => unknown;

const enumField =
  <Values extends string>(allowed: Record<string, Values>): Parser =>
  (value, name) =>
    parseEnum(allowed, value, name);

const booleanField: Parser = (value, name) => {
  if (typeof value !== "boolean") throw new ValidationError(`${name} must be true or false.`);
  return value;
};

const integerField =
  (min: number, max: number): Parser =>
  (value, name) => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new ValidationError(`${name} must be a whole number from ${min} to ${max}.`);
    }
    return value;
  };

const nullableIntegerField =
  (min: number, max: number): Parser =>
  (value, name) =>
    value === null ? null : integerField(min, max)(value, name);

const accentColorField: Parser = (value, name) => {
  if (typeof value !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
    throw new ValidationError(`${name} must be a hex color such as #406b51.`);
  }
  return value;
};

export const REVIEW_SUMMARY_ITEMS = [
  "TASKS_COMPLETED",
  "GOALS_COMPLETED",
  "MILESTONES_REACHED",
  "TIME_SPENT",
  "COMPLETION_RATE",
] as const;

const reviewSummaryField: Parser = (value, name) => {
  if (!Array.isArray(value)) throw new ValidationError(`${name} must be a list.`);
  for (const item of value) {
    if (!REVIEW_SUMMARY_ITEMS.includes(item)) {
      throw new ValidationError(`${name} items must be one of: ${REVIEW_SUMMARY_ITEMS.join(", ")}.`);
    }
  }
  return [...new Set(value)];
};

/** Every preference the Settings page can change, keyed by its UserSettings column. */
const PREFERENCE_PARSERS = {
  // Planner appearance and layout
  theme: enumField(ThemePreference),
  accentColor: accentColorField,
  plannerView: enumField(PlannerViewPreference),
  weekStart: enumField(WeekStart),
  timeFormat: enumField(TimeFormat),
  landingPage: enumField(LandingPage),
  // Notifications and reminders
  remindDailyPlanning: booleanField,
  remindUpcoming: booleanField,
  remindDeadline: booleanField,
  remindGoalProgress: booleanField,
  remindWeeklyReview: booleanField,
  remindMissedGoal: booleanField,
  quietStartMinute: nullableIntegerField(0, 1439),
  quietEndMinute: nullableIntegerField(0, 1439),
  // Goal-setting preferences
  goalTimeframe: enumField(GoalTimeframe),
  goalCategory: enumField(GoalCategory),
  goalBreakdown: enumField(GoalBreakdownMethod),
  goalPriority: enumField(Priority),
  celebration: enumField(CelebrationStyle),
  progressMetric: enumField(ProgressMetric),
  // Unfinished task management
  unfinishedBehavior: enumField(UnfinishedTaskBehavior),
  unfinishedReviewTime: enumField(UnfinishedReviewTime),
  deadlineHandling: enumField(DeadlineHandling),
  autoReschedule: booleanField,
  rescheduleHighOnly: booleanField,
  rescheduleExcludeOverdue: booleanField,
  dailyLimit: integerField(0, 20),
  warnOverload: booleanField,
  reprioritizeWhenFull: booleanField,
  // Weekly progress reviews
  reviewDay: integerField(0, 6),
  reviewReminder: booleanField,
  reviewMinute: integerField(0, 1439),
  reviewSummaryItems: reviewSummaryField,
  reflectionQuestions: booleanField,
  missedGoalHandling: enumField(MissedGoalHandling),
  visualization: enumField(ProgressVisualization),
  // Exam study sessions
  studyDaysBeforeExam: integerField(1, 30),
  studySessionHours: integerField(1, 8),
  studySessionsPerDay: integerField(1, 6),
  studyWindowStartHour: integerField(0, 23),
  studyWindowEndHour: integerField(1, 24),
  // Privacy and account management
  backup: enumField(BackupPreference),
  deleteCompleted: booleanField,
} satisfies Record<string, Parser>;

type PreferenceKey = keyof typeof PREFERENCE_PARSERS;
const PREFERENCE_KEYS = Object.keys(PREFERENCE_PARSERS) as PreferenceKey[];

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const profileSelect = {
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  school: true,
  major: true,
  graduationDate: true,
  careerInterests: true,
  careerGoals: true,
} as const;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

const textField =
  (maxLength?: number): Parser =>
  (value, name) =>
    optionalText(value, name, maxLength);

const emailField: Parser = (value, name) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${name} is required.`);
  }
  const email = value.trim();
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError(`${name} must be a valid email address.`);
  }
  return email;
};

/** "YYYY-MM" (or empty) stored as the first day of that month. */
const graduationMonthField: Parser = (value, name) => {
  if (value === undefined || value === null || value === "") return null;
  const match = typeof value === "string" ? MONTH_PATTERN.exec(value) : null;
  if (!match) throw new ValidationError(`${name} must be a month in YYYY-MM format.`);
  return new Date(`${match[1]}-${match[2]}-01T00:00:00.000Z`);
};

const PROFILE_PARSERS = {
  email: emailField,
  firstName: textField(100),
  lastName: textField(100),
  school: textField(150),
  major: textField(150),
  graduationDate: graduationMonthField,
  careerInterests: textField(),
  careerGoals: textField(),
} satisfies Record<string, Parser>;

/** Validates only the keys present, rejecting unknown ones so client typos surface as errors. */
function parseSection<Key extends string>(
  value: unknown,
  section: string,
  parsers: Record<Key, Parser>,
): Partial<Record<Key, unknown>> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`${section} must be an object.`);
  }
  const parsed: Partial<Record<Key, unknown>> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!(key in parsers)) throw new ValidationError(`Unknown setting: ${section}.${key}.`);
    parsed[key as Key] = parsers[key as Key](raw, `${section}.${key}`);
  }
  return parsed;
}

export function parseSettingsUpdate(body: Record<string, unknown>) {
  for (const key of Object.keys(body)) {
    if (key !== "profile" && key !== "preferences") {
      throw new ValidationError(`Unknown setting: ${key}.`);
    }
  }
  const profile = parseSection(body.profile, "profile", PROFILE_PARSERS);
  const preferences = parseSection(body.preferences, "preferences", PREFERENCE_PARSERS);

  const hasStart = "quietStartMinute" in preferences;
  const hasEnd = "quietEndMinute" in preferences;
  if (hasStart !== hasEnd) {
    throw new ValidationError("Send quietStartMinute and quietEndMinute together.");
  }
  if (hasStart && (preferences.quietStartMinute === null) !== (preferences.quietEndMinute === null)) {
    throw new ValidationError("Set both Do Not Disturb times, or clear both.");
  }

  const hasWindowStart = "studyWindowStartHour" in preferences;
  if (hasWindowStart !== "studyWindowEndHour" in preferences) {
    throw new ValidationError("Send studyWindowStartHour and studyWindowEndHour together.");
  }
  if (
    hasWindowStart &&
    (preferences.studyWindowStartHour as number) >= (preferences.studyWindowEndHour as number)
  ) {
    throw new ValidationError("The study window must end after it starts.");
  }

  return {
    profile: profile as Prisma.UserUpdateInput,
    preferences: preferences as Omit<Prisma.UserSettingsUncheckedCreateInput, "userId">,
  };
}

function serializeSettings(user: ProfileRow, settings: UserSettings) {
  return {
    profile: {
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      school: user.school,
      major: user.major,
      graduationDate: user.graduationDate?.toISOString().slice(0, 7) ?? null,
      careerInterests: user.careerInterests,
      careerGoals: user.careerGoals,
    },
    preferences: Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, settings[key]])),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function isUniqueEmailViolation(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  if (code !== "P2002") return false;
  const target = meta?.target;
  return target === undefined || JSON.stringify(target).includes("email");
}

export async function getSettings(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new NotFoundError("User not found.");
  // Every column has a default, so a user without a settings row gets one on first read.
  const settings = await db.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return serializeSettings(user, settings);
}

/** Saves any subset of profile and preferences atomically; nothing is written if any field is invalid. */
export async function updateSettings(db: Db, userId: string, body: Record<string, unknown>) {
  const { profile, preferences } = parseSettingsUpdate(body);

  const existing = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) throw new NotFoundError("User not found.");

  try {
    const [user, settings] = await db.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: profile, select: profileSelect });
      const settings = await tx.userSettings.upsert({
        where: { userId },
        create: { userId, ...preferences },
        update: preferences,
      });
      return [user, settings] as const;
    });
    return serializeSettings(user, settings);
  } catch (error) {
    if (isUniqueEmailViolation(error)) {
      throw new ConflictError("That email address is already used by another account.");
    }
    throw error;
  }
}
