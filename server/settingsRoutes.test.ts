import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "./app.ts";
import type { Db } from "./db.ts";

// Exercises the real Express routes and error handler, with the database stubbed out.

const USER_ID = "11111111-1111-4111-8111-111111111111";

const profile = {
  username: "demo",
  email: "demo@kadence.dev",
  firstName: "Alex",
  lastName: "Lee",
  school: null,
  major: null,
  graduationDate: null,
  careerInterests: null,
  careerGoals: null,
};
let settingsRow: Record<string, unknown> = {
  theme: "LIGHT",
  dailyLimit: 3,
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
};
let failWrites = false;

const tx = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => (where.id === USER_ID ? profile : null),
    update: async () => {
      if (failWrites) throw new Error("database is down");
      return profile;
    },
  },
  userSettings: {
    upsert: async ({ update }: { update: Record<string, unknown> }) => {
      settingsRow = { ...settingsRow, ...update };
      return settingsRow;
    },
  },
};
const db = { ...tx, $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) };

let baseUrl = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;

before(async () => {
  server = createApp(db as unknown as Db).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

function patch(userId: string, body: unknown) {
  return fetch(`${baseUrl}/api/users/${userId}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("settings routes", () => {
  it("GET returns the user's settings", async () => {
    const response = await fetch(`${baseUrl}/api/users/${USER_ID}/settings`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { profile: Record<string, unknown>; preferences: Record<string, unknown> };
    assert.equal(body.profile.username, "demo");
    assert.equal(body.preferences.theme, "LIGHT");
  });

  it("PATCH saves and returns the stored settings", async () => {
    const response = await patch(USER_ID, { preferences: { theme: "DARK", dailyLimit: 7 } });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { profile: Record<string, unknown>; preferences: Record<string, unknown> };
    assert.equal(body.preferences.theme, "DARK");
    assert.equal(body.preferences.dailyLimit, 7);
  });

  it("PATCH answers 400 with a readable message for invalid input", async () => {
    const response = await patch(USER_ID, { preferences: { dailyLimit: 99 } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "preferences.dailyLimit must be a whole number from 0 to 20.",
    });
  });

  it("answers 400 for a malformed user id", async () => {
    const response = await fetch(`${baseUrl}/api/users/not-a-uuid/settings`);
    assert.equal(response.status, 400);
  });

  it("answers 404 for an unknown user", async () => {
    const response = await patch("22222222-2222-4222-8222-222222222222", { preferences: {} });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "User not found." });
  });

  it("answers 500 without leaking internals when the database fails", async () => {
    failWrites = true;
    const originalError = console.error;
    console.error = () => {}; // the server logs the expected failure
    try {
      const response = await patch(USER_ID, { preferences: { theme: "DARK" } });
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: "Internal server error." });
    } finally {
      failWrites = false;
      console.error = originalError;
    }
  });
});
