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
7. **Database operation in the app:** open `http://localhost:5173`, log in as `demo` /
   `kadence-demo`, add a To-do task titled `Verify <your-name>`, then tick it complete. Stop and
   restart `npm run dev:api`, reload the page and confirm the task is still there and still complete.
   The same through the API (demo user id from `/api/dev/user`):
   - Create: `POST /api/users/:userId/tasks` with `{"title": "Verify <your-name>"}`.
   - Read: `GET /api/users/:userId/tasks` and confirm the new task is listed.
   - Update: `PATCH /api/users/:userId/tasks/:taskId` with `{"completed": true}`.
   - Confirm the change with another `GET`, or in `npm run db:studio`.
8. **Automated check:** `npm test` runs `server/database.integration.test.ts` against your local
   database in a throwaway account (deleted afterwards). All tests should pass with none skipped.

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

## Protecting credentials (Part 4)

| Item | Where |
|---|---|
| Ignore rules | `.gitignore` ignores `.env`, `.env.*` and `*.env` (but keeps `.env.example`), private keys and certificates (`*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`), credential JSON files and local database dumps. Prisma schema and migrations are **not** ignored. |
| Placeholder template | `.env.example` contains only placeholders (`YOUR_LOCAL_PASSWORD`, `YOUR_NEON_*`). |
| Commit guard | `.githooks/pre-commit` runs `npm run check:secrets`, which blocks staged `.env` files and anything that looks like a database URL with a password, a private key or an API token. `npm install` enables the hook (`core.hooksPath`). |
| Sharing real values | The team lead sends the Neon URL privately (direct message or password manager), never through GitHub, issues, PRs or screenshots. |

Run these before every commit (results are recorded in [sprint2-evidence.md](sprint2-evidence.md)):

```sh
git status                  # .env must not appear
git check-ignore -v .env    # prints the .gitignore rule that ignores it
git ls-files .env           # prints nothing (not tracked)
git diff --cached --name-only
git diff --cached           # check nothing sensitive is staged
```

If `git ls-files .env` ever prints `.env`, run `git rm --cached .env`, commit, and **rotate the
password** (removing a file from the latest commit does not remove it from history).

## API reference

All routes are under `/api` (Vite proxies them to `npm run dev:api`). Bodies are JSON; enum values
are the database names (`VERY_HIGH`, `NOT_STARTED`, ...). Invalid input returns `400 { error }`,
unknown records `404`, conflicts `409`, a wrong password `401`.

| Method and path | Purpose | Story |
|---|---|---|
| `GET /health` | Database connectivity and row counts | — |
| `POST /auth/login`, `POST /auth/register` | Verify a password / create an account | — |
| `GET`, `PATCH /users/:userId/settings` | Profile and every preference, including `dashboardMode` and `tabLayout` | #10, #6, #8, #22 |
| `GET`, `PUT /users/:userId/reminder-rules` | Reminders per day for each priority | #13 |
| `GET`, `PUT /users/:userId/availability` | Open time slots for rescheduling | #3 |
| `GET`, `POST /users/:userId/goals` | List goals (with progress, milestones, tasks) / create, optionally with child goals | #7, #1 |
| `PATCH`, `DELETE /users/:userId/goals/:goalId` | Edit or complete / delete a goal | #7 |
| `PATCH /users/:userId/goals/:goalId/priority` | Change a goal's priority | #12 |
| `POST /users/:userId/goals/:goalId/milestones`, `PATCH`/`DELETE .../milestones/:milestoneId` | Schedule, complete, re-date or remove milestones | #7 |
| `GET`, `POST /users/:userId/tasks` | List / create tasks (optional `repeat`) | #2, #3, #9 |
| `PATCH`, `DELETE /users/:userId/tasks/:taskId` | Edit, complete, mark exam, set reminders / delete (`?scope=series`) | #9, #13 |
| `GET`, `POST /users/:userId/tasks/missed` | List missed tasks / reschedule, move to today or to the backlog | #3 |
| `GET`, `POST /users/:userId/planner-events` | List / create planner events (optional `repeat`) | #14, #11 |
| `POST /users/:userId/planner-events/bulk` | Quick Setup: save a week of tasks in one transaction | #2 |
| `PATCH`, `DELETE /users/:userId/planner-events/:eventId` | Edit / delete (`?scope=series`) | #14 |
| `POST /users/:userId/study-plan/sync` | Recompute and store exam study sessions | #9 |
| `GET /users/:userId/notifications`, `POST .../notifications/sync`, `POST .../notifications/:id/read`, `POST .../notifications/read-all` | Reminders | #4, #13 |
| `GET`, `PUT /users/:userId/weekly-review` | Week summary / save the reflection | #5 |
