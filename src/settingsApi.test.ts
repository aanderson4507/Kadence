import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_SETTINGS,
  SettingsRequestError,
  fromSettingsResponse,
  loadSettings,
  sameSettings,
  saveSettings,
  toSettingsPayload,
  validateSettings,
  type SettingsValues,
} from "./settingsApi.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function customized(): SettingsValues {
  return {
    ...DEFAULT_SETTINGS,
    profile: {
      ...DEFAULT_SETTINGS.profile,
      firstName: "Alex",
      email: "alex@state.edu",
      graduationDate: "2028-05",
    },
    planner: { ...DEFAULT_SETTINGS.planner, theme: "Dark mode", startWeek: "Monday", accent: "#5477a7" },
    notifications: {
      reminders: { ...DEFAULT_SETTINGS.notifications.reminders, "Deadline notifications": false },
      quietStart: "22:00",
      quietEnd: "07:30",
    },
    goals: { ...DEFAULT_SETTINGS.goals, priority: "High", category: "Personal development" },
    unfinished: { ...DEFAULT_SETTINGS.unfinished, behavior: "Move to a task backlog for later scheduling", dailyLimit: 8 },
    weekly: { ...DEFAULT_SETTINGS.weekly, reviewDay: "Sunday", reminderTime: "09:15", summary: ["Completion rate", "Time spent"] },
    privacy: { backup: "Manual", deleteCompleted: false },
  };
}

/** What the server sends back for a payload: the same fields, as stored. */
function echo(values: SettingsValues) {
  const payload = toSettingsPayload(values);
  return { profile: { username: "demo", ...payload.profile }, preferences: payload.preferences };
}

describe("settings mapping", () => {
  it("sends the API's enum values and minute-based times", () => {
    const preferences: Record<string, unknown> = toSettingsPayload(customized()).preferences;
    assert.equal(preferences.theme, "DARK");
    assert.equal(preferences.weekStart, "MONDAY");
    assert.equal(preferences.remindDeadline, false);
    assert.equal(preferences.quietStartMinute, 22 * 60);
    assert.equal(preferences.quietEndMinute, 7 * 60 + 30);
    assert.equal(preferences.goalCategory, "PERSONAL_DEVELOPMENT");
    assert.equal(preferences.unfinishedBehavior, "MOVE_TO_BACKLOG");
    assert.equal(preferences.reviewDay, 0);
    assert.equal(preferences.reviewMinute, 9 * 60 + 15);
    assert.deepEqual(preferences.reviewSummaryItems, ["TIME_SPENT", "COMPLETION_RATE"]);
  });

  it("sends empty quiet hours as null", () => {
    const { preferences } = toSettingsPayload(DEFAULT_SETTINGS);
    assert.equal(preferences.quietStartMinute, null);
    assert.equal(preferences.quietEndMinute, null);
  });

  it("reads back exactly what it saved", () => {
    const values = customized();
    const reread = fromSettingsResponse(echo(values));
    // Summary items come back in display order.
    assert.deepEqual(reread.weekly.summary, ["Time spent", "Completion rate"]);
    assert.ok(sameSettings(reread, values));
  });

  it("falls back to defaults for values the page can't show", () => {
    const reread = fromSettingsResponse({
      profile: { firstName: null },
      preferences: { theme: "NEON", goalPriority: "VERY_HIGH", reviewDay: 9 },
    });
    assert.equal(reread.profile.firstName, "");
    assert.equal(reread.planner.theme, "Light mode");
    assert.equal(reread.goals.priority, "High");
    assert.equal(reread.weekly.reviewDay, "Friday");
  });

  it("treats a new profile picture as not affecting saved data", () => {
    const withAvatar = { ...DEFAULT_SETTINGS, profile: { ...DEFAULT_SETTINGS.profile, avatar: "data:image/png;base64,AA" } };
    assert.ok(sameSettings(withAvatar, DEFAULT_SETTINGS));
  });
});

describe("validateSettings", () => {
  const valid = customized();

  it("accepts valid settings", () => {
    assert.equal(validateSettings(valid), null);
  });

  it("requires a valid email", () => {
    assert.match(validateSettings({ ...valid, profile: { ...valid.profile, email: "" } })!, /Enter an email/);
    assert.match(validateSettings({ ...valid, profile: { ...valid.profile, email: "alex@" } })!, /valid email/);
  });

  it("requires both Do Not Disturb times or neither", () => {
    const halfQuiet = { ...valid, notifications: { ...valid.notifications, quietEnd: "" } };
    assert.match(validateSettings(halfQuiet)!, /Do Not Disturb/);
  });

  it("keeps the daily task limit within 0-20", () => {
    for (const dailyLimit of [-1, 21, 2.5, Number.NaN]) {
      const values = { ...valid, unfinished: { ...valid.unfinished, dailyLimit } };
      assert.match(validateSettings(values)!, /0 to 20/);
    }
  });
});

describe("saving and loading", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function respondWith(status: number, body: unknown) {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(body === undefined ? "" : JSON.stringify(body), { status });
    }) as typeof fetch;
    return calls;
  }

  it("saves every setting in one PATCH and returns the stored values", async () => {
    const values = { ...customized(), profile: { ...customized().profile, avatar: "data:x" } };
    const calls = respondWith(200, echo(values));
    const stored = await saveSettings(USER_ID, values);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `/api/users/${USER_ID}/settings`);
    assert.equal(calls[0].init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), toSettingsPayload(values));
    assert.ok(sameSettings(stored, values));
    // The unsaved picture preview survives the save.
    assert.equal(stored.profile.avatar, "data:x");
  });

  it("shows the server's reason when it rejects a change", async () => {
    respondWith(409, { error: "That email address is already used by another account." });
    await assert.rejects(saveSettings(USER_ID, customized()), (error: unknown) => {
      assert.ok(error instanceof SettingsRequestError);
      assert.equal(
        error.message,
        "Your changes weren't saved. That email address is already used by another account.",
      );
      return true;
    });
  });

  it("shows a generic retry message for server errors", async () => {
    respondWith(500, { error: "Internal server error." });
    await assert.rejects(saveSettings(USER_ID, customized()), {
      message: "Your changes weren't saved. Please try again in a moment.",
    });
  });

  it("handles an error response with no JSON body", async () => {
    respondWith(502, undefined);
    await assert.rejects(saveSettings(USER_ID, customized()), {
      message: "Your changes weren't saved. Please try again in a moment.",
    });
  });

  it("explains when the server can't be reached", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await assert.rejects(saveSettings(USER_ID, customized()), {
      message: /Your changes weren't saved\. Kadence couldn't reach the server/,
    });
  });

  it("loads the account and its settings", async () => {
    const values = customized();
    globalThis.fetch = (async (url: string) =>
      new Response(
        JSON.stringify(url === "/api/dev/user" ? { id: USER_ID } : echo(values)),
        { status: 200 },
      )) as typeof fetch;

    const loaded = await loadSettings();
    assert.equal(loaded.userId, USER_ID);
    assert.equal(loaded.account.username, "demo");
    assert.ok(sameSettings(loaded.values, values));
  });

  it("reports a failed load", async () => {
    respondWith(404, { error: "Demo user not found. Run npm run db:seed." });
    await assert.rejects(loadSettings(), {
      message: "Couldn't load your saved settings. Demo user not found. Run npm run db:seed.",
    });
  });
});
