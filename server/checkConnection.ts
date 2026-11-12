// npm run db:check — verifies the DATABASE_URL in .env is reachable and the schema is applied.
import { createPrismaClient } from "./db.ts";

const db = createPrismaClient();

try {
  const [{ version }] = await db.$queryRaw<{ version: string }[]>`SELECT version()`;
  const [users, goals, milestones, tasks, plannerEvents] = await Promise.all([
    db.user.count(),
    db.goal.count(),
    db.milestone.count(),
    db.task.count(),
    db.plannerEvent.count(),
  ]);
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  console.log(`Connected to ${host}`);
  console.log(version);
  console.table({ users, goals, milestones, tasks, plannerEvents });
} catch (error) {
  console.error("Database check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
