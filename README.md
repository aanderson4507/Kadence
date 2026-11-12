# Kadence

Kadence is a goals and productivity app built with React, TypeScript, and Vite.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Development

```sh
npm install
npm run dev
```

## Database and API

Kadence stores data in PostgreSQL 17 through Prisma, served by a small Express API in `server/`.
Full setup (local and shared cloud database) is in [docs/database.md](docs/database.md).

```sh
cp .env.example .env   # then set your local PostgreSQL password
npm run db:migrate     # create the database and apply migrations
npm run db:seed        # load development data (demo / kadence-demo)
npm run db:check       # verify the connection
npm run dev:api        # API on http://localhost:3001 (Vite proxies /api)
```

The React screens still use in-memory sample data; connecting them to the API is the next step.

## Tests

```sh
npm test               # runs server/**/*.test.ts and src/**/*.test.ts (no database needed)
```

## Production build

```sh
npm run build
npm run preview
```

The login screen opens at `/`, and the dashboard is available at `/dashboard`.
The app entry point is `src/App.tsx`; the login and dashboard screens live in
`src/Login.tsx` and `src/Dashboard.tsx`. Their styles are in `src/Login.css` and
`src/App.css`, and Figma-exported SVGs are stored in `public/assets`.

Authentication is not connected yet. The demo login accepts any non-empty
username and password, does not send or store credentials, and opens the
dashboard.

The dashboard opens to the to-do list with sample tasks. Tasks can be filtered
by priority (Very High through None), added, completed, and deleted. Changes are
kept in page state and reset when the page is refreshed.

The Breakdown view displays the sample website goal, its connected goals, and
ten milestones. Milestones can be completed or reopened; progress is updated in
the summary and resets when the page is refreshed.

The Priority view lets you search tasks, select one, and save or reset its
priority. Saved priority changes stay in sync with the to-do list until refresh.

The Goals view organizes sample goals into big, medium, and small categories.
Filter categories, add goals, mark goals complete, and open the highlighted
goal's Breakdown view. Goal changes are kept in page state and reset on refresh.

The Visual Planner displays a sample weekly schedule. Navigate between weeks,
select tasks, and switch between week and day views. Add tasks with a due date,
type, goal size, and optional linked task; edit task details, status, schedule,
description, and notes; or delete tasks with confirmation. Planner changes are
kept in page state and reset on refresh.

Open Settings from the workspace gear or the Goals sidebar. It opens to an
Overview with your account details and the preferences changed most often
(theme, accent color, planner view, landing page, default goal priority, and
key reminders), plus links to every other section: profile, planner, reminders,
goals, task carryover, weekly review, and privacy. Settings are loaded from and
saved to the database through `GET`/`PATCH /api/users/:userId/settings`, so the
API (`npm run dev:api`) must be running. Edits on any section are saved together
with one **Save changes** click; invalid input or a failed save shows the reason
and keeps your edits so you can try again. Theme changes apply and save right
away, including from the header sun/moon button. Until authentication exists,
Settings uses the seeded demo account. Profile picture uploads are a preview
only and are not saved yet. Data export downloads the current preferences, tasks, goals,
and planner events as JSON. Account deletion is for review only in this demo.
