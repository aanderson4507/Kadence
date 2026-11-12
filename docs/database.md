# Kadence Database

This covers Part 1 Step 1.2 (data model files) and Part 2 (database selection and configuration).
The entity analysis behind the model is in [data-requirements.md](data-requirements.md); UML diagrams
are in [uml/](uml/).

## Selected database: PostgreSQL 17 + Prisma ORM 7

| Need from the data requirements | Why PostgreSQL fits |
|---|---|
| Strongly relational data: users own goals, goals nest (Big → Medium → Small), tasks and planner events link to goals, notifications link to tasks/events | Real foreign keys with `ON DELETE CASCADE` / `SET NULL`, so account deletion and goal deletion behave exactly as the Settings page promises |
| Many fixed value sets (6 priority levels, goal size, event status, every Settings choice) | Native enum types reject invalid values at the database |
| Rules the UI depends on (`start_hour + duration_hours <= 24`, daily limit 0–20, completed ⇔ completion date) | CHECK constraints enforce them for every client, not just the React forms |
| Date-only values (due dates, target dates) separate from timestamps | Native `DATE` type, no time-zone drift |
| Weekly Review and goal progress are aggregations | SQL aggregation and indexes on `(user_id, due_date)` / `(user_id, event_date)` |
| A shared, free cloud dev database for the team | Neon and Supabase both offer free PostgreSQL 17; local and cloud run the same engine |

**Why Prisma:** TypeScript-first (the app is React + TypeScript), one declarative schema file that
generates typed models and SQL migrations, and it supports PostgreSQL, MySQL and SQLite, which keeps
the model portable. Prisma 7 talks to PostgreSQL through the `pg` driver adapter.

**Alternatives considered:** SQLite (no install, but weaker enum/constraint support and the shared
cloud option, Turso, fits Prisma less smoothly); Firestore (document model is a poor fit for the
goal hierarchy and cross-entity links, and constraints would move entirely into security rules).

## Files

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | ORM model: 11 entities, 27 enums, keys, relations, indexes |
| `prisma/migrations/` | SQL migrations. `*_init` also adds the CHECK constraints Prisma cannot express |
| `prisma/seed.ts` | Development data: demo user, goal tree, milestones, tasks, planner week, recurrence, study sessions, notifications |
| `prisma.config.ts` | Prisma CLI config (schema path, migrations, seed command, `DATABASE_URL`) |
| `server/db.ts` | Creates the Prisma client with the PostgreSQL adapter |
| `server/services/` | Data-access and business rules (goal tiers, progress roll-up, completion dates) |
| `server/app.ts`, `server/index.ts` | Express API (`/api/health`, goals, tasks) |
| `server/checkConnection.ts` | `npm run db:check` connection test |
| `.env.example` | Template for the git-ignored `.env` |

## Local setup (every teammate)

1. **Install PostgreSQL 17.** Windows: `winget install PostgreSQL.PostgreSQL.17` (or the installer from
   postgresql.org); macOS: `brew install postgresql@17`; or Docker:
   `docker run --name kadence-db -e POSTGRES_PASSWORD=<password> -p 5432:5432 -d postgres:17`.
2. **Create the `.env`:** copy `.env.example` to `.env` and put your local password in `DATABASE_URL`.
   The database itself (`kadence_dev`) is created by the first migration.
3. **Install and migrate:**
   ```sh
   npm install          # also runs prisma generate
   npm run db:migrate   # creates kadence_dev if needed and applies all migrations
   npm run db:seed      # loads development data
   npm run db:check     # prints the server version and row counts
   ```
4. **Run the app:** `npm run dev:api` (API on port 3001) and `npm run dev` (Vite proxies `/api`).
   Check `http://localhost:5173/api/health`.

Useful: `npm run db:studio` opens Prisma Studio to browse data; `npm run db:reset` drops, re-migrates
and re-seeds your local database.

Demo login for seeded data: username `demo`, password `kadence-demo` (development only).

## Shared cloud development database (Neon free tier)

One teammate creates the project; nobody needs a payment method.

1. Sign up at neon.tech (free plan), create project **kadence-dev**, PostgreSQL 17, database
   `kadence_dev`.
2. Copy the pooled connection string (`...?sslmode=require`) and share it privately with the team
   (not in git, not in chat channels that are public).
3. Only **approved** migrations go to the shared database:
   ```sh
   # with DATABASE_URL temporarily pointing at Neon
   npm run db:deploy    # applies committed migrations only; never generates new ones
   npm run db:seed      # optional: shared demo data
   ```
4. Day-to-day development stays on each person's local database.

Workflow rule: create migrations locally with `npm run db:migrate -- --name <change>`, commit the
generated folder under `prisma/migrations/`, get it reviewed in the PR, then run `db:deploy` against
the shared database after merge.

## Constraints enforced in the database

Enforced by Prisma-generated SQL: primary keys, foreign keys with delete behavior, unique
`username`/`email`, unique `(user_id, priority)` reminder rules, unique `(user_id, week_start)`
weekly reviews, enum types, NOT NULL and defaults.

Added by hand at the end of the init migration (Prisma cannot model CHECK constraints):

- titles not blank; `daily_limit` 0–20; `reminders_per_day` 0–24
- `start_hour` 0–23, `duration_hours` 1–24, `start_hour + duration_hours <= 24`
- `completed` ⇔ `completed_date` set (tasks); `status = 'COMPLETED'` ⇔ `completed_at` set (goals)
- `target_date >= start_date`; quiet hours both set or both null; availability `start < end`
- notification links to at most one of task / planner event; a planner event cannot link to itself
- recurrence ends by date or count, not both

Enforced in `server/services/goalService.ts` (needs other rows to check): a parent goal must be a
larger tier than its child.

## AI-generated design decisions reviewed and corrected by the team

The data model was drafted with an AI coding agent and then reviewed. These suggestions were
changed:

1. **Milestones modeled as child goals → separate `Milestone` entity.** The first AI analysis
   recommended reusing the goal hierarchy (`parentGoalId`) for milestones. Reviewing the Figma Goal
   Breakdown frame showed a *Milestones* list (with "Completed · date" / "Due date") **and** a separate
   *Connected Goals* panel, and the user story requires "milestones can be scheduled onto specific
   dates". Milestones became their own entity with `dueDate`, `completedAt` and `sortOrder`.
2. **Merge Tasks and Planner events into one table → kept separate.** The AI recommended a single
   `Task` table because the planner's "Due Date" field and priority sync overlap. The team decided to
   keep `Task` and `PlannerEvent` separate for now (different screens, different fields such as
   hour/duration/status) and revisit after the API is wired to the UI.
3. **Deleting a parent goal: cascade → `SET NULL`.** The AI draft left this as "restrict or cascade".
   Cascading would silently delete a student's medium and small goals when a big goal is removed, and
   the Goals board already shows unlinked goals ("Individual tasks"). Children now become standalone.
4. **Native `TIME` columns → minutes since midnight (`Int`).** The draft used `TIME` for quiet hours,
   review time and availability windows. Prisma maps `TIME` differently per database, so integers keep
   the model portable across PostgreSQL, MySQL and SQLite; CHECK constraints bound them to 0–1440.
5. **Missing planner priority added.** The draft copied the code's `PlannerEvent`, which has no
   priority, but the "filter the calendar by priority" story requires one. `priority` and an index on
   `(user_id, priority)` were added.
6. **Class diagram attributes rendered as methods.** In the first render of the AI-written
   `class-diagram.puml`, every attribute whose type had a length, such as `username : String(50)`,
   was drawn in the methods compartment, because PlantUML reads parentheses as a method signature.
   Reviewing the PNG caught it; those 15 lines now use the `{field}` modifier.
7. **Generated scaffolding removed.** `prisma init` added AI-agent "skills" folders (`.claude/`,
   `.agents/`, `.windsurf/`), `skills-lock.json`, a `.vscode/settings.json` and a `prisma7.config.ts`.
   These are not part of the application and are not committed; `prisma.config.ts` is the single
   config.
