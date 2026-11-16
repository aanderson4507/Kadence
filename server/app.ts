import express, { type ErrorRequestHandler, type Request } from "express";
import type { Db } from "./db.ts";
import { login, register } from "./services/authService.ts";
import {
  createGoal,
  createMilestone,
  deleteGoal,
  deleteMilestone,
  listGoals,
  updateGoal,
  updateGoalPriority,
  updateMilestone,
} from "./services/goalService.ts";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  syncNotifications,
} from "./services/notificationService.ts";
import {
  createPlannerEvent,
  createPlannerEvents,
  deletePlannerEvent,
  listPlannerEvents,
  updatePlannerEvent,
} from "./services/plannerService.ts";
import {
  getAvailability,
  getReminderRules,
  handleMissedTasks,
  listMissedTasks,
  saveAvailability,
  saveReminderRules,
} from "./services/rescheduleService.ts";
import { getSettings, updateSettings } from "./services/settingsService.ts";
import { syncStudyPlan } from "./services/studyPlanService.ts";
import { createTask, deleteTask, listTasks, updateTask } from "./services/taskService.ts";
import { getWeeklyReview, saveWeeklyReview } from "./services/weeklyReviewService.ts";
import { asObject, requireUuid } from "./validation.ts";

// NOTE: /api/auth/login verifies the password, but sessions are not implemented yet: routes are
// scoped by :userId so the data layer can be exercised. Add a session-derived user before any
// non-development use (see the Sprint 2 release notes, "Known limitations").

const body = (req: Request) => asObject(req.body);
const userIdOf = (req: Request) => requireUuid(req.params.userId, "userId");
const query = (req: Request, name: string) =>
  typeof req.query[name] === "string" ? (req.query[name] as string) : undefined;

export function createApp(db: Db) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

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

  // --- Accounts ------------------------------------------------------------------------------
  app.post("/api/auth/login", async (req, res) => {
    res.json(await login(db, body(req)));
  });
  app.post("/api/auth/register", async (req, res) => {
    res.status(201).json(await register(db, body(req)));
  });

  if (process.env.NODE_ENV !== "production") {
    /** Development helper: returns the seeded demo account so the UI works without signing in. */
    app.get("/api/dev/user", async (_req, res) => {
      const user = await db.user.findUnique({
        where: { username: "demo" },
        select: { id: true, username: true, firstName: true, lastName: true, email: true },
      });
      if (!user) {
        res.status(404).json({ error: "Demo user not found. Run npm run db:seed." });
        return;
      }
      res.json(user);
    });
  }

  // --- Settings (#10), main-screen mode (#6), tab layout (#8) ---------------------------------
  app.get("/api/users/:userId/settings", async (req, res) => {
    res.json(await getSettings(db, userIdOf(req)));
  });
  app.patch("/api/users/:userId/settings", async (req, res) => {
    res.json(await updateSettings(db, userIdOf(req), body(req)));
  });
  app.get("/api/users/:userId/reminder-rules", async (req, res) => {
    res.json(await getReminderRules(db, userIdOf(req)));
  });
  app.put("/api/users/:userId/reminder-rules", async (req, res) => {
    res.json(await saveReminderRules(db, userIdOf(req), body(req)));
  });
  app.get("/api/users/:userId/availability", async (req, res) => {
    res.json(await getAvailability(db, userIdOf(req)));
  });
  app.put("/api/users/:userId/availability", async (req, res) => {
    res.json(await saveAvailability(db, userIdOf(req), body(req)));
  });

  // --- Goals and milestones (#7, #12, #1) -----------------------------------------------------
  app.get("/api/users/:userId/goals", async (req, res) => {
    res.json(await listGoals(db, userIdOf(req)));
  });
  app.post("/api/users/:userId/goals", async (req, res) => {
    res.status(201).json(await createGoal(db, userIdOf(req), body(req)));
  });
  app.patch("/api/users/:userId/goals/:goalId", async (req, res) => {
    res.json(await updateGoal(db, userIdOf(req), requireUuid(req.params.goalId, "goalId"), body(req)));
  });
  app.patch("/api/users/:userId/goals/:goalId/priority", async (req, res) => {
    const goalId = requireUuid(req.params.goalId, "goalId");
    res.json(await updateGoalPriority(db, userIdOf(req), goalId, body(req).priority));
  });
  app.delete("/api/users/:userId/goals/:goalId", async (req, res) => {
    res.json(await deleteGoal(db, userIdOf(req), requireUuid(req.params.goalId, "goalId")));
  });
  app.post("/api/users/:userId/goals/:goalId/milestones", async (req, res) => {
    const goalId = requireUuid(req.params.goalId, "goalId");
    res.status(201).json(await createMilestone(db, userIdOf(req), goalId, body(req)));
  });
  app.patch("/api/users/:userId/goals/:goalId/milestones/:milestoneId", async (req, res) => {
    res.json(
      await updateMilestone(
        db,
        userIdOf(req),
        requireUuid(req.params.goalId, "goalId"),
        requireUuid(req.params.milestoneId, "milestoneId"),
        body(req),
      ),
    );
  });
  app.delete("/api/users/:userId/goals/:goalId/milestones/:milestoneId", async (req, res) => {
    res.json(
      await deleteMilestone(
        db,
        userIdOf(req),
        requireUuid(req.params.goalId, "goalId"),
        requireUuid(req.params.milestoneId, "milestoneId"),
      ),
    );
  });

  // --- Tasks (#2, #3, #9, #13) ----------------------------------------------------------------
  app.get("/api/users/:userId/tasks", async (req, res) => {
    res.json(await listTasks(db, userIdOf(req), query(req, "priority")));
  });
  app.post("/api/users/:userId/tasks", async (req, res) => {
    res.status(201).json(await createTask(db, userIdOf(req), body(req)));
  });
  app.get("/api/users/:userId/tasks/missed", async (req, res) => {
    res.json(await listMissedTasks(db, userIdOf(req)));
  });
  app.post("/api/users/:userId/tasks/missed", async (req, res) => {
    res.json(await handleMissedTasks(db, userIdOf(req), body(req)));
  });
  app.patch("/api/users/:userId/tasks/:taskId", async (req, res) => {
    res.json(await updateTask(db, userIdOf(req), requireUuid(req.params.taskId, "taskId"), body(req)));
  });
  app.delete("/api/users/:userId/tasks/:taskId", async (req, res) => {
    res.json(
      await deleteTask(db, userIdOf(req), requireUuid(req.params.taskId, "taskId"), query(req, "scope")),
    );
  });

  // --- Visual Planner (#14, #11, #2) and exam study sessions (#9) -----------------------------
  app.get("/api/users/:userId/planner-events", async (req, res) => {
    res.json(await listPlannerEvents(db, userIdOf(req), query(req, "from"), query(req, "to")));
  });
  app.post("/api/users/:userId/planner-events", async (req, res) => {
    res.status(201).json(await createPlannerEvent(db, userIdOf(req), body(req)));
  });
  app.post("/api/users/:userId/planner-events/bulk", async (req, res) => {
    res.status(201).json(await createPlannerEvents(db, userIdOf(req), body(req)));
  });
  app.patch("/api/users/:userId/planner-events/:eventId", async (req, res) => {
    res.json(
      await updatePlannerEvent(db, userIdOf(req), requireUuid(req.params.eventId, "eventId"), body(req)),
    );
  });
  app.delete("/api/users/:userId/planner-events/:eventId", async (req, res) => {
    res.json(
      await deletePlannerEvent(
        db,
        userIdOf(req),
        requireUuid(req.params.eventId, "eventId"),
        query(req, "scope"),
      ),
    );
  });
  app.post("/api/users/:userId/study-plan/sync", async (req, res) => {
    res.json(await syncStudyPlan(db, userIdOf(req)));
  });

  // --- Notifications (#4, #13) and weekly review (#5) -----------------------------------------
  app.get("/api/users/:userId/notifications", async (req, res) => {
    res.json(await listNotifications(db, userIdOf(req)));
  });
  app.post("/api/users/:userId/notifications/sync", async (req, res) => {
    res.json(await syncNotifications(db, userIdOf(req)));
  });
  app.post("/api/users/:userId/notifications/read-all", async (req, res) => {
    res.json(await markAllNotificationsRead(db, userIdOf(req)));
  });
  app.post("/api/users/:userId/notifications/:notificationId/read", async (req, res) => {
    const notificationId = requireUuid(req.params.notificationId, "notificationId");
    res.json(await markNotificationRead(db, userIdOf(req), notificationId));
  });
  app.get("/api/users/:userId/weekly-review", async (req, res) => {
    res.json(await getWeeklyReview(db, userIdOf(req), query(req, "week")));
  });
  app.put("/api/users/:userId/weekly-review", async (req, res) => {
    res.json(await saveWeeklyReview(db, userIdOf(req), body(req)));
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    // Malformed JSON bodies arrive here from express.json() with status 400.
    const status = typeof error?.status === "number" ? error.status : 500;
    if (status >= 500) console.error(error);
    const message =
      status >= 500
        ? "Internal server error."
        : error?.type === "entity.parse.failed"
          ? "The request body is not valid JSON."
          : error.message;
    res.status(status).json({ error: message });
  };
  app.use(handleError);

  return app;
}
