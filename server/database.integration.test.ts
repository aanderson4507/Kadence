import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "./app.ts";
import { createPrismaClient } from "./db.ts";
import { addDays, toDateOnly, todayDateOnly } from "./validation.ts";

// End-to-end persistence tests: real Express routes -> services -> Prisma -> PostgreSQL.
//
// They run against the development database in DATABASE_URL, inside a throwaway account
// (username "itest-<random>") that is deleted afterwards, so they never read or change anyone
// else's rows. When no database is configured or reachable the suite is skipped, so `npm test`
// still works on a machine without PostgreSQL.

async function databaseAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    // dotenv is loaded by server/db.ts; import it to read .env before deciding.
    await import("dotenv/config");
  }
  if (!process.env.DATABASE_URL) return false;
  const probe = createPrismaClient();
  try {
    await probe.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await probe.$disconnect();
  }
}

const available = await databaseAvailable();
const skip = available ? false : "no reachable DATABASE_URL (see docs/database-setup.md)";

type Server = ReturnType<ReturnType<typeof createApp>["listen"]>;

/** Starts the API on a random port with its own Prisma client, like `npm run dev:api`. */
async function startApi() {
  const db = createPrismaClient();
  const server: Server = createApp(db).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    db,
    async call(method: string, path: string, body?: unknown) {
      const response = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as any };
    },
    async stop() {
      server.close();
      await db.$disconnect();
    },
  };
}

const dayKey = (offset: number) => toDateOnly(addDays(todayDateOnly(), offset))!;

describe("database integration", { skip }, () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let userId = "";
  const username = `itest-${randomUUID().slice(0, 8)}`;
  const password = "integration-pass";

  before(async () => {
    if (!available) return;
    api = await startApi();
  });

  after(async () => {
    if (!available) return;
    // Deleting the user cascades to every row the tests created.
    if (userId) await api.db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await api.stop();
  });

  it("creates an account and signs in with the stored password hash", async () => {
    const created = await api.call("POST", "/auth/register", {
      username,
      email: `${username}@example.test`,
      password,
      firstName: "Integration",
    });
    assert.equal(created.status, 201);
    userId = created.body.id;

    const wrong = await api.call("POST", "/auth/login", { username, password: "nope-nope" });
    assert.equal(wrong.status, 401);
    const signedIn = await api.call("POST", "/auth/login", { username, password });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.id, userId);
    assert.equal("passwordHash" in signedIn.body, false);

    const duplicate = await api.call("POST", "/auth/register", {
      username,
      email: "other@example.test",
      password,
    });
    assert.equal(duplicate.status, 409);
  });

  it("creates, reads, updates and deletes a task", async () => {
    const created = await api.call("POST", `/users/${userId}/tasks`, {
      title: "Write lab report",
      priority: "HIGH",
      dueDate: dayKey(2),
      remindersPerDay: 5,
    });
    assert.equal(created.status, 201);
    const taskId = created.body.id;

    const listed = await api.call("GET", `/users/${userId}/tasks`);
    assert.ok(listed.body.some((task: { id: string }) => task.id === taskId));

    const updated = await api.call("PATCH", `/users/${userId}/tasks/${taskId}`, {
      completed: true,
      priority: "VERY_HIGH",
    });
    assert.equal(updated.body.completed, true);
    assert.equal(updated.body.completedDate, dayKey(0));
    assert.equal(updated.body.priority, "VERY_HIGH");

    const deleted = await api.call("DELETE", `/users/${userId}/tasks/${taskId}`);
    assert.equal(deleted.body.deleted, 1);
    const missing = await api.call("PATCH", `/users/${userId}/tasks/${taskId}`, { completed: false });
    assert.equal(missing.status, 404);
  });

  it("rejects invalid input with a 400 and writes nothing", async () => {
    const before = await api.db.task.count({ where: { userId } });
    const blank = await api.call("POST", `/users/${userId}/tasks`, { title: "   " });
    assert.equal(blank.status, 400);
    assert.match(blank.body.error, /title is required/);
    const badDate = await api.call("POST", `/users/${userId}/tasks`, { title: "x", dueDate: "2026-02-30" });
    assert.equal(badDate.status, 400);
    const badPriority = await api.call("POST", `/users/${userId}/tasks`, { title: "x", priority: "URGENT" });
    assert.equal(badPriority.status, 400);
    const badEvent = await api.call("POST", `/users/${userId}/planner-events`, {
      title: "Too long",
      eventDate: dayKey(1),
      startHour: 22,
      durationHours: 3,
    });
    assert.equal(badEvent.status, 400);
    assert.equal(await api.db.task.count({ where: { userId } }), before);
  });

  it("creates a repeating task as separate occurrences in one series", async () => {
    const created = await api.call("POST", `/users/${userId}/tasks`, {
      title: "Gym",
      dueDate: dayKey(1),
      repeat: { frequency: "DAILY", maxOccurrences: 3 },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.occurrenceCount, 3);
    const series = await api.db.task.findMany({ where: { seriesId: created.body.seriesId }, orderBy: { dueDate: "asc" } });
    assert.deepEqual(series.map((task) => toDateOnly(task.dueDate)), [dayKey(1), dayKey(2), dayKey(3)]);
    assert.ok(series.every((task) => task.title === "Gym" && task.recurrenceRuleId));

    const removed = await api.call("DELETE", `/users/${userId}/tasks/${created.body.id}?scope=series`);
    assert.equal(removed.body.deleted, 3);
  });

  it("breaks a goal into steps, schedules milestones and rolls progress up", async () => {
    const big = await api.call("POST", `/users/${userId}/goals`, {
      title: "Get an internship",
      size: "BIG",
      priority: "HIGH",
      childGoalTitles: ["Prepare resume", "Apply to companies"],
    });
    assert.equal(big.status, 201);
    const goals = await api.call("GET", `/users/${userId}/goals`);
    const children = goals.body.filter((goal: { parentGoalId: string }) => goal.parentGoalId === big.body.id);
    assert.equal(children.length, 2);
    assert.ok(children.every((goal: { size: string }) => goal.size === "MEDIUM"));

    const withMilestone = await api.call("POST", `/users/${userId}/goals/${children[0].id}/milestones`, {
      title: "Draft resume",
      dueDate: dayKey(3),
    });
    assert.equal(withMilestone.status, 201);
    const milestone = withMilestone.body.milestones[0];
    assert.equal(milestone.dueDate, dayKey(3));

    const done = await api.call(
      "PATCH",
      `/users/${userId}/goals/${children[0].id}/milestones/${milestone.id}`,
      { completed: true },
    );
    assert.equal(done.body.progress, 100);
    const parent = (await api.call("GET", `/users/${userId}/goals`)).body.find(
      (goal: { id: string }) => goal.id === big.body.id,
    );
    // One of two child goals is complete -> the big goal is half way.
    assert.equal(parent.progress, 50);

    const priority = await api.call("PATCH", `/users/${userId}/goals/${big.body.id}/priority`, { priority: "LOW" });
    assert.equal(priority.body.priority, "LOW");
    const tierError = await api.call("POST", `/users/${userId}/goals`, {
      title: "Bad",
      size: "BIG",
      parentGoalId: children[0].id,
    });
    assert.equal(tierError.status, 400);

    const completed = await api.call("PATCH", `/users/${userId}/goals/${big.body.id}`, { status: "COMPLETED" });
    assert.equal(completed.body.status, "COMPLETED");
    assert.ok(completed.body.completedAt);
  });

  it("schedules study sessions before an exam and removes them when it's done", async () => {
    await api.call("PATCH", `/users/${userId}/settings`, {
      preferences: { studyDaysBeforeExam: 2, studySessionsPerDay: 1, studyWindowStartHour: 16, studyWindowEndHour: 21 },
    });
    const exam = await api.call("POST", `/users/${userId}/tasks`, {
      title: "Physics midterm",
      priority: "VERY_HIGH",
      isExam: true,
      dueDate: dayKey(5),
    });
    const synced = await api.call("POST", `/users/${userId}/study-plan/sync`);
    const sessions = synced.body.events.filter((event: { sourceTaskId: string }) => event.sourceTaskId === exam.body.id);
    assert.deepEqual(
      sessions.map((event: { eventDate: string }) => event.eventDate),
      [dayKey(3), dayKey(4)],
    );
    assert.ok(sessions.every((event: { startHour: number }) => event.startHour >= 16 && event.startHour < 21));

    // A study session can't be edited by hand.
    const edit = await api.call("PATCH", `/users/${userId}/planner-events/${sessions[0].id}`, { title: "x" });
    assert.equal(edit.status, 400);

    await api.call("PATCH", `/users/${userId}/tasks/${exam.body.id}`, { completed: true });
    const after = await api.call("POST", `/users/${userId}/study-plan/sync`);
    assert.equal(
      after.body.events.filter((event: { sourceTaskId: string }) => event.sourceTaskId === exam.body.id).length,
      0,
    );
  });

  it("saves planner events, including Quick Setup batches and repeats", async () => {
    const one = await api.call("POST", `/users/${userId}/planner-events`, {
      title: "CS lecture",
      category: "FOCUS",
      priority: "HIGH",
      eventDate: dayKey(1),
      startHour: 10,
      durationHours: 2,
      repeat: { frequency: "WEEKLY", maxOccurrences: 2 },
    });
    assert.equal(one.status, 201);
    assert.equal(one.body.length, 2);

    const quick = await api.call("POST", `/users/${userId}/planner-events/bulk`, {
      events: [
        { title: "Read ch. 4", eventDate: dayKey(1), startHour: 9, taskType: "TASK" },
        { title: "Problem set", eventDate: dayKey(2), startHour: 13, durationHours: 2, taskType: "TASK" },
      ],
    });
    assert.equal(quick.status, 201);
    assert.equal(quick.body.length, 2);

    // A bad row rejects the whole batch.
    const before = await api.db.plannerEvent.count({ where: { userId } });
    const bad = await api.call("POST", `/users/${userId}/planner-events/bulk`, {
      events: [{ title: "ok", eventDate: dayKey(1), startHour: 9 }, { title: "", eventDate: dayKey(1), startHour: 9 }],
    });
    assert.equal(bad.status, 400);
    assert.equal(await api.db.plannerEvent.count({ where: { userId } }), before);

    const moved = await api.call("PATCH", `/users/${userId}/planner-events/${one.body[0].id}`, {
      eventDate: dayKey(2),
      status: "IN_PROGRESS",
    });
    assert.equal(moved.body.originalEventDate, dayKey(1));
    const deleted = await api.call("DELETE", `/users/${userId}/planner-events/${one.body[0].id}?scope=series`);
    assert.equal(deleted.body.deleted, 2);
  });

  it("reschedules a missed task into an open time slot", async () => {
    const windows = await api.call("PUT", `/users/${userId}/availability`, {
      windows: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 0, endMinute: 1440 })),
    });
    assert.equal(windows.body.length, 7);
    const overlap = await api.call("PUT", `/users/${userId}/availability`, {
      windows: [
        { weekday: 1, startMinute: 600, endMinute: 720 },
        { weekday: 1, startMinute: 660, endMinute: 780 },
      ],
    });
    assert.equal(overlap.status, 400);

    const missedTask = await api.call("POST", `/users/${userId}/tasks`, {
      title: "Missed reading",
      priority: "HIGH",
      dueDate: dayKey(-2),
    });
    const listed = await api.call("GET", `/users/${userId}/tasks/missed`);
    assert.ok(listed.body.some((task: { id: string }) => task.id === missedTask.body.id));

    const result = await api.call("POST", `/users/${userId}/tasks/missed`, {
      action: "RESCHEDULE",
      taskIds: [missedTask.body.id],
    });
    assert.equal(result.body.moved, 1);
    const task = await api.db.task.findUniqueOrThrow({ where: { id: missedTask.body.id } });
    assert.ok(toDateOnly(task.dueDate)! >= dayKey(0));
    assert.equal(toDateOnly(task.originalDueDate), dayKey(-2));
  });

  it("generates reminders from saved preferences and marks them read", async () => {
    await api.call("PUT", `/users/${userId}/reminder-rules`, {
      rules: [{ priority: "MEDIUM", remindersPerDay: 3 }],
    });
    const rules = await api.call("GET", `/users/${userId}/reminder-rules`);
    assert.equal(rules.body.find((rule: { priority: string }) => rule.priority === "MEDIUM").remindersPerDay, 3);

    await api.call("POST", `/users/${userId}/tasks`, { title: "Essay due", priority: "MEDIUM", dueDate: dayKey(1) });
    const synced = await api.call("POST", `/users/${userId}/notifications/sync`);
    assert.equal(synced.status, 200);
    const stored = await api.db.notification.findMany({ where: { userId, task: { title: "Essay due" } } });
    assert.equal(stored.length, 3);

    // Syncing again doesn't duplicate anything.
    await api.call("POST", `/users/${userId}/notifications/sync`);
    assert.equal(await api.db.notification.count({ where: { userId, task: { title: "Essay due" } } }), 3);

    const allRead = await api.call("POST", `/users/${userId}/notifications/read-all`);
    assert.equal(allRead.body.unreadCount, 0);
  });

  it("saves a weekly review reflection with a snapshot of the counts", async () => {
    const review = await api.call("GET", `/users/${userId}/weekly-review`);
    assert.equal(review.status, 200);
    const saved = await api.call("PUT", `/users/${userId}/weekly-review`, {
      weekStart: review.body.weekStart,
      reflection: "Steady week.",
    });
    assert.equal(saved.body.reflection, "Steady week.");
    const row = await api.db.weeklyReview.findFirstOrThrow({ where: { userId } });
    assert.equal(row.completedCount, saved.body.completed.length);
  });

  it("keeps everything after the API restarts", async () => {
    await api.call("PATCH", `/users/${userId}/settings`, {
      preferences: { dashboardMode: "ADVANCED", tabLayout: { views: [{ view: "Goals", size: 1 }], split: false, active: "Goals" } },
    });
    const task = await api.call("POST", `/users/${userId}/tasks`, { title: "Survives restart", priority: "LOW" });

    // Stop the server and its database connection, then start a fresh one.
    await api.stop();
    api = await startApi();

    const tasks = await api.call("GET", `/users/${userId}/tasks`);
    assert.ok(tasks.body.some((item: { id: string; title: string }) => item.id === task.body.id && item.title === "Survives restart"));
    const settings = await api.call("GET", `/users/${userId}/settings`);
    assert.equal(settings.body.preferences.dashboardMode, "ADVANCED");
    assert.equal(settings.body.preferences.tabLayout.active, "Goals");
    const goals = await api.call("GET", `/users/${userId}/goals`);
    assert.ok(goals.body.some((goal: { title: string }) => goal.title === "Get an internship"));
  });
});

