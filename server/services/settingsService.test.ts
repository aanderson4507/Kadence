import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "../db.ts";
import { ConflictError, NotFoundError, ValidationError } from "../validation.ts";
import { getSettings, updateSettings } from "./settingsService.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

/** Column defaults from prisma/schema.prisma (UserSettings). */
function defaultSettingsRow(userId: string) {
  return {
    userId,
    theme: "LIGHT",
    accentColor: "#406b51",
    plannerView: "DAILY",
    weekStart: "SUNDAY",
    timeFormat: "TWELVE_HOUR",
    landingPage: "DASHBOARD",
    dashboardMode: "SIMPLE",
    tabLayout: null,
    remindDailyPlanning: true,
    remindUpcoming: true,
    remindDeadline: true,
    remindGoalProgress: true,
    remindWeeklyReview: true,
    remindMissedGoal: true,
    quietStartMinute: null,
    quietEndMinute: null,
    goalTimeframe: "DAILY",
    goalCategory: "ACADEMIC",
    goalBreakdown: "MAJOR_MILESTONES",
    goalPriority: "MEDIUM",
    celebration: "MESSAGE",
    progressMetric: "PERCENT_COMPLETE",
    unfinishedBehavior: "ASK",
    unfinishedReviewTime: "START_OF_NEXT_DAY",
    deadlineHandling: "KEEP_ORIGINAL",
    autoReschedule: false,
    rescheduleHighOnly: false,
    rescheduleExcludeOverdue: false,
    dailyLimit: 3,
    warnOverload: true,
    reprioritizeWhenFull: true,
    reviewDay: 5,
    reviewReminder: true,
    reviewMinute: 990,
    reviewSummaryItems: ["TASKS_COMPLETED", "GOALS_COMPLETED", "MILESTONES_REACHED", "TIME_SPENT"],
    reflectionQuestions: true,
    missedGoalHandling: "KEEP",
    visualization: "CHARTS",
    studyDaysBeforeExam: 3,
    studySessionHours: 1,
    studySessionsPerDay: 1,
    studyWindowStartHour: 16,
    studyWindowEndHour: 21,
    backup: "AUTOMATIC",
    deleteCompleted: true,
    deleteCompletedAfterDays: 30,
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
  };
}

type Row = Record<string, unknown>;

/**
 * In-memory stand-in for the Prisma client calls the settings service makes. `$transaction`
 * works on a copy and only commits if the callback succeeds, like a real transaction.
 */
function createFakeDb(options: { withSettings?: boolean; failUserUpdate?: unknown } = {}) {
  const state = {
    users: new Map<string, Row>([
      [
        USER_ID,
        {
          id: USER_ID,
          username: "demo",
          email: "demo@kadence.dev",
          firstName: "Alex",
          lastName: "Lee",
          school: "State University",
          major: "Computer Science",
          graduationDate: new Date("2028-05-01T00:00:00.000Z"),
          careerInterests: null,
          careerGoals: null,
        },
      ],
    ]),
    settings: new Map<string, Row>(
      options.withSettings === false ? [] : [[USER_ID, defaultSettingsRow(USER_ID)]],
    ),
    writes: 0,
  };

  function client(users: Map<string, Row>, settings: Map<string, Row>) {
    return {
      user: {
        async findUnique({ where }: { where: { id: string } }) {
          return users.get(where.id) ?? null;
        },
        async update({ where, data }: { where: { id: string }; data: Row }) {
          if (options.failUserUpdate) throw options.failUserUpdate;
          const user = { ...users.get(where.id)!, ...data };
          users.set(where.id, user);
          return user;
        },
      },
      userSettings: {
        async upsert({ where, create, update }: { where: { userId: string }; create: Row; update: Row }) {
          const existing = settings.get(where.userId);
          const row = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : { ...defaultSettingsRow(where.userId), ...create };
          settings.set(where.userId, row);
          return row;
        },
      },
    };
  }

  const db = {
    ...client(state.users, state.settings),
    async $transaction<T>(callback: (tx: ReturnType<typeof client>) => Promise<T>) {
      const users = new Map(state.users);
      const settings = new Map(state.settings);
      const result = await callback(client(users, settings));
      for (const [id, row] of users) state.users.set(id, row);
      for (const [id, row] of settings) state.settings.set(id, row);
      state.writes += 1;
      return result;
    },
  };
  return { db: db as unknown as Db, state };
}

describe("getSettings", () => {
  it("returns the profile and every preference", async () => {
    const { db } = createFakeDb();
    const result = await getSettings(db, USER_ID);
    assert.equal(result.profile.email, "demo@kadence.dev");
    assert.equal(result.profile.graduationDate, "2028-05");
    assert.equal(result.preferences.theme, "LIGHT");
    assert.equal(result.preferences.reviewMinute, 990);
    // Columns the Settings page doesn't edit are not exposed.
    assert.equal("studySessionHours" in result.preferences, false);
  });

  it("creates the settings row with defaults the first time", async () => {
    const { db, state } = createFakeDb({ withSettings: false });
    const result = await getSettings(db, USER_ID);
    assert.equal(result.preferences.dailyLimit, 3);
    assert.ok(state.settings.has(USER_ID));
  });

  it("rejects an unknown user", async () => {
    const { db } = createFakeDb();
    await assert.rejects(
      getSettings(db, "22222222-2222-4222-8222-222222222222"),
      NotFoundError,
    );
  });
});

describe("updateSettings", () => {
  it("persists profile and preference changes so the next read returns them", async () => {
    const { db } = createFakeDb();
    await updateSettings(db, USER_ID, {
      profile: { firstName: "  Sam ", graduationDate: "2027-12", careerGoals: "" },
      preferences: {
        theme: "DARK",
        accentColor: "#5477a7",
        dailyLimit: 5,
        quietStartMinute: 1320,
        quietEndMinute: 420,
        reviewSummaryItems: ["TIME_SPENT", "TIME_SPENT", "COMPLETION_RATE"],
      },
    });

    const reread = await getSettings(db, USER_ID);
    assert.equal(reread.profile.firstName, "Sam");
    assert.equal(reread.profile.graduationDate, "2027-12");
    assert.equal(reread.profile.careerGoals, null);
    assert.equal(reread.preferences.theme, "DARK");
    assert.equal(reread.preferences.accentColor, "#5477a7");
    assert.equal(reread.preferences.dailyLimit, 5);
    assert.equal(reread.preferences.quietStartMinute, 1320);
    assert.deepEqual(reread.preferences.reviewSummaryItems, ["TIME_SPENT", "COMPLETION_RATE"]);
    // Untouched preferences keep their values.
    assert.equal(reread.preferences.plannerView, "DAILY");
  });

  it("saves a single preference without needing the rest", async () => {
    const { db } = createFakeDb();
    const result = await updateSettings(db, USER_ID, { preferences: { theme: "SYSTEM" } });
    assert.equal(result.preferences.theme, "SYSTEM");
    assert.equal(result.profile.email, "demo@kadence.dev");
  });

  const invalidUpdates: [string, Record<string, unknown>, RegExp][] = [
    ["an unknown enum value", { preferences: { theme: "NEON" } }, /preferences\.theme must be one of/],
    ["an out-of-range number", { preferences: { dailyLimit: 21 } }, /0 to 20/],
    ["a fractional number", { preferences: { reviewDay: 2.5 } }, /whole number/],
    ["a non-boolean toggle", { preferences: { remindDeadline: "yes" } }, /true or false/],
    ["a bad accent color", { preferences: { accentColor: "green" } }, /hex color/],
    ["an unknown preference", { preferences: { fontSize: 14 } }, /Unknown setting: preferences\.fontSize/],
    ["an unknown section", { account: {} }, /Unknown setting: account/],
    ["a blank email", { profile: { email: "  " } }, /email is required/],
    ["a malformed email", { profile: { email: "alex@" } }, /valid email/],
    ["a bad graduation month", { profile: { graduationDate: "2027-13" } }, /YYYY-MM/],
    ["a too-long name", { profile: { firstName: "x".repeat(101) } }, /100 characters/],
    ["half of the quiet hours", { preferences: { quietStartMinute: 60 } }, /together/],
    [
      "one quiet hour cleared",
      { preferences: { quietStartMinute: 60, quietEndMinute: null } },
      /both Do Not Disturb times/,
    ],
    ["summary items that aren't a list", { preferences: { reviewSummaryItems: "TIME_SPENT" } }, /list/],
    ["an unknown summary item", { preferences: { reviewSummaryItems: ["STREAK"] } }, /items must be one of/],
  ];

  for (const [description, body, message] of invalidUpdates) {
    it(`rejects ${description} without writing anything`, async () => {
      const { db, state } = createFakeDb();
      await assert.rejects(updateSettings(db, USER_ID, body), (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.match(error.message, message);
        return true;
      });
      assert.equal(state.writes, 0);
    });
  }

  it("rejects an update where one field is invalid, keeping the valid ones unsaved too", async () => {
    const { db } = createFakeDb();
    await assert.rejects(
      updateSettings(db, USER_ID, { preferences: { theme: "DARK", dailyLimit: -1 } }),
      ValidationError,
    );
    const reread = await getSettings(db, USER_ID);
    assert.equal(reread.preferences.theme, "LIGHT");
  });

  it("reports an email already used by another account as a conflict", async () => {
    const duplicate = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["email"] },
    });
    const { db } = createFakeDb({ failUserUpdate: duplicate });
    await assert.rejects(
      updateSettings(db, USER_ID, { profile: { email: "taken@kadence.dev" } }),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.equal(error.status, 409);
        return true;
      },
    );
  });

  it("rolls back preference changes when the profile write fails", async () => {
    const { db, state } = createFakeDb({ failUserUpdate: new Error("connection lost") });
    await assert.rejects(
      updateSettings(db, USER_ID, { preferences: { theme: "DARK" } }),
      /connection lost/,
    );
    assert.equal(state.settings.get(USER_ID)!.theme, "LIGHT");
  });

  it("rejects an unknown user", async () => {
    const { db } = createFakeDb();
    await assert.rejects(
      updateSettings(db, "22222222-2222-4222-8222-222222222222", { preferences: { theme: "DARK" } }),
      NotFoundError,
    );
  });
});
