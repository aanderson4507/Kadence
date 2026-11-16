# Database Setup and Team Verification

This covers Part 3 (team database configuration). Install steps, troubleshooting and secret handling
are in [team-setup.md](team-setup.md); the schema is in [database.md](database.md).

## Team database approach

| Item | Decision |
|---|---|
| Engine | PostgreSQL 17 + Prisma 7 |
| Daily development | **Each member runs their own local PostgreSQL** (`kadence_dev`). Local databases are allowed to differ in data, never in structure. |
| Shared structure | Everyone applies the same committed `prisma/migrations/` and `prisma/seed.ts`. |
| Shared cloud database | One Neon project, used only to apply merged migrations with `npm run db:deploy`. Each member gets an individual Neon role from the team lead; no shared admin login. |
| Configuration | `.env.example` (committed, placeholders only) is copied to a local `.env` (git-ignored). Real values are sent privately by the team lead, never through GitHub, issues or screenshots. |

Because the team develops on local databases, the verification below follows the "local databases"
route: every member runs the same operations against the committed schema and setup instructions.

## Verification procedure (each member)

1. **Clone or update:** `git clone <repo-url>` or `git pull origin main`.
2. **Install:** `npm ci` (use `nvm use` first if you use nvm; Node 22).
3. **Configure:** copy `.env.example` to `.env` and set your own local PostgreSQL password.
4. **Migrate and seed:** `npm run db:migrate`, `npm run db:seed`, then `npm run db:status`
   (must report "Database schema is up to date").
5. **Connection test:** `npm run db:check` (prints server version and row counts).
6. **Start the app:** `npm run dev:api` and `npm run dev`, then open `http://localhost:5173/api/health`.
7. **Database operation** (with the API running, using the seeded demo user from `/api/dev/user`):
   - Create: `POST /api/users/:userId/tasks` with a task titled `Verify <your-name>`.
   - Read: `GET /api/users/:userId/tasks` and confirm the new task is listed.
   - Update: `PATCH /api/users/:userId/tasks/:taskId` with `{"completed": true}` (the API accepts
     only `completed` and/or `priority`).
   - Confirm the change with another `GET`, or in `npm run db:studio`.

Do not paste `.env`, connection strings or terminal output that shows a password into this file.

## Verification results

Fill in your row after completing the procedure. Result is Pass or Fail (with a short note).

| Member | Date | Clone / install | `db:status` | `db:check` | App starts | Create / read / update task | Result |
|---|---|---|---|---|---|---|---|
| Austin Anderson | 2026-11-15 | Pass (`npm ci`) | Pass (schema up to date) | Pass (PostgreSQL 17.12, 1 user / 8 goals / 12 tasks seeded) | Pass (`/api/health` returned `connected`) | Pass (created "Verify Austin", read it back, marked it completed, confirmed) | **Pass** |
| _Teammate 2_ | _pending_ | | | | | | |
| _Teammate 3_ | _pending_ | | | | | | |
| _Teammate 4_ | _pending_ | | | | | | |

### Shared Neon database (optional check, lead only)

If the team also verifies the shared database: Member A creates a test task, Member B retrieves it,
Member C updates it, and Member D confirms the update. Record each step below, then delete the test
record.

| Step | Member | Action | Result |
|---|---|---|---|
| 1 | _pending_ | Create test record | |
| 2 | _pending_ | Retrieve record | |
| 3 | _pending_ | Update record | |
| 4 | _pending_ | Confirm updated data | |
