import express, { type ErrorRequestHandler, type Request } from "express";
import type { Db } from "./db.ts";
import { createGoal, listGoals, updateGoalPriority } from "./services/goalService.ts";
import { getSettings, updateSettings } from "./services/settingsService.ts";
import { createTask, listTasks, updateTask } from "./services/taskService.ts";
import { requireUuid } from "./validation.ts";

// NOTE: authentication is not implemented yet. Routes are scoped by :userId so the data layer
// can be exercised; replace this with a session-derived user before any non-development use.

function body(req: Request): Record<string, unknown> {
  return typeof req.body === "object" && req.body !== null ? req.body : {};
}

export function createApp(db: Db) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      const [users, goals, tasks, plannerEvents] = await Promise.all([
        db.user.count(),
        db.goal.count(),
        db.task.count(),
        db.plannerEvent.count(),
      ]);
      res.json({ status: "ok", database: "connected", counts: { users, goals, tasks, plannerEvents } });
    } catch (error) {
      console.error(error);
      res.status(503).json({ status: "error", database: "unreachable" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    /** Development helper: returns the seeded demo account so the UI can call the API. */
    app.get("/api/dev/user", async (_req, res) => {
      const user = await db.user.findUnique({
        where: { username: "demo" },
        select: { id: true, username: true, firstName: true, lastName: true },
      });
      if (!user) {
        res.status(404).json({ error: "Demo user not found. Run npm run db:seed." });
        return;
      }
      res.json(user);
    });
  }

  app.get("/api/users/:userId/settings", async (req, res) => {
    res.json(await getSettings(db, requireUuid(req.params.userId, "userId")));
  });

  app.patch("/api/users/:userId/settings", async (req, res) => {
    res.json(await updateSettings(db, requireUuid(req.params.userId, "userId"), body(req)));
  });

  app.get("/api/users/:userId/goals", async (req, res) => {
    res.json(await listGoals(db, requireUuid(req.params.userId, "userId")));
  });

  app.post("/api/users/:userId/goals", async (req, res) => {
    const goal = await createGoal(db, requireUuid(req.params.userId, "userId"), body(req));
    res.status(201).json(goal);
  });

  app.patch("/api/users/:userId/goals/:goalId/priority", async (req, res) => {
    const goal = await updateGoalPriority(
      db,
      requireUuid(req.params.userId, "userId"),
      requireUuid(req.params.goalId, "goalId"),
      body(req).priority,
    );
    res.json(goal);
  });

  app.get("/api/users/:userId/tasks", async (req, res) => {
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
    res.json(await listTasks(db, requireUuid(req.params.userId, "userId"), priority));
  });

  app.post("/api/users/:userId/tasks", async (req, res) => {
    const task = await createTask(db, requireUuid(req.params.userId, "userId"), body(req));
    res.status(201).json(task);
  });

  app.patch("/api/users/:userId/tasks/:taskId", async (req, res) => {
    const task = await updateTask(
      db,
      requireUuid(req.params.userId, "userId"),
      requireUuid(req.params.taskId, "taskId"),
      body(req),
    );
    res.json(task);
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = typeof error?.status === "number" ? error.status : 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status >= 500 ? "Internal server error." : error.message });
  };
  app.use(handleError);

  return app;
}
