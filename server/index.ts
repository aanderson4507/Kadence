import { createApp } from "./app.ts";
import { createPrismaClient } from "./db.ts";

const port = Number(process.env.API_PORT ?? 3001);
const db = createPrismaClient();
const server = createApp(db).listen(port, () => {
  console.log(`Kadence API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
