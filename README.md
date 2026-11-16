# Kadence

Kadence is a goals and productivity planner for students, built with React, TypeScript and Vite on
the front end and an Express + Prisma API backed by PostgreSQL 17.

## Requirements

- Node.js 20.19+ or 22.12+
- PostgreSQL 17 (local install or Docker), see [docs/database.md](docs/database.md)

## Run it

```sh
npm install            # also generates the Prisma client and enables the secret-check hook
cp .env.example .env   # then set your local PostgreSQL password in DATABASE_URL
npm run db:migrate     # create the database and apply migrations
npm run db:seed        # development data (login: demo / kadence-demo)
npm run dev:api        # API on http://localhost:3001
npm run dev            # app on http://localhost:5173 (Vite proxies /api to the API)
```

Open `http://localhost:5173`, log in as `demo` / `kadence-demo` (or create an account), and you land
on the dashboard. Everything you add or change is saved to PostgreSQL and is still there after
restarting the app. Opening `/dashboard` directly without logging in uses the demo account
(development only).

Team setup and secret handling: [docs/team-setup.md](docs/team-setup.md) and
[docs/database-setup.md](docs/database-setup.md).

## Checks

```sh
npm test               # unit tests + database integration tests (skipped if no database is reachable)
npm run typecheck      # TypeScript for the React app and the server
npm run build          # type check + production build
npm run db:check       # database connection and row counts
```

The integration tests (`server/database.integration.test.ts`) run against your `DATABASE_URL` inside
a throwaway account that is deleted afterwards.

## Features (Sprint 2)

All of these read and write the database; see [docs/user-stories.md](docs/user-stories.md) for the
GitHub Issue and acceptance criteria behind each one.

- **To-do list:** add tasks with a priority, due date and optional repeat; complete, mark as exam,
  move to the backlog, delete; filter by priority or status.
- **Priority setter:** set a task's priority, exam flag and how many reminders a day it gets.
- **Goals:** big, medium and small goals; break a goal into smaller ones; change priority; complete
  or delete; progress is calculated from milestones, linked tasks and child goals.
- **Breakdown:** pick a goal to see its progress, scheduled milestones (add, date, complete,
  optionally block planner time), connected goals, linked tasks and exam study plan.
- **Visual Planner:** week/day calendar; add, edit, repeat and delete tasks; filter by priority;
  **Quick Setup** plans a whole week at once.
- **Exam study sessions:** Kadence stores study blocks in the planner in the days before each exam,
  around your existing events, using your study preferences.
- **Reminders:** notifications before deadlines and planner events, following your reminder settings
  and Do Not Disturb hours; click one to jump to the task.
- **Missed tasks:** detected on open and hourly; reschedule them into your open time slots, move them
  to today or to the backlog, or let Kadence do it automatically per your settings.
- **Weekly review:** completed vs. pending vs. overdue, completion rate, a per-day chart, goals and
  milestones finished, and a saved reflection.
- **Main screen:** Simple (core views, the rest under More) or Advanced (everything plus resizable
  split view). The mode, open tabs and panel widths are saved per user.
- **Settings:** profile and all preferences, reminder frequency by priority, open time slots; theme
  (light/dark) is saved per user.

## Project layout

| Path | Contents |
|---|---|
| `src/` | React screens (`Dashboard.tsx` hosts the views), API client (`api.ts`, `settingsApi.ts`, `http.ts`) |
| `server/` | Express API (`app.ts`), Prisma client (`db.ts`), services with the business rules (`services/`) |
| `prisma/` | Schema, migrations and seed data |
| `docs/` | Database setup, data requirements, AI design review, UML, user stories, Sprint 2 evidence |
| `public/assets` | Figma-exported SVGs |

## Known limitations

- Sign-in verifies the password against the database, but the API doesn't issue sessions yet; routes
  are scoped by user id. Use only with development data.
- Notifications are in-app only (the email/push channel is stored but not sent).
- Profile picture uploads are a preview and are not saved; account deletion is not connected.
