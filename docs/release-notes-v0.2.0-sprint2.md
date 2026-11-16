# Kadence v0.2.0-sprint2

Sprint 2 connects every Kadence screen to a PostgreSQL database through Prisma. Tasks, goals,
milestones, planner events, study sessions, reminders, weekly reviews and preferences are saved
and are still there after the app restarts.

## Completed user stories

All 14 backlog stories plus dark mode are implemented and database-backed. Details and acceptance
criteria: [docs/user-stories.md](user-stories.md).

| Issue | Story |
|---|---|
| #14 | Add and manage tasks in the visual planner |
| #13 | Set how often I'm reminded (per task and per priority) |
| #12 | Change a goal's priority (primary database story, with sequence diagram) |
| #11 | Filter the calendar and to-do list by priority |
| #10 | Change preferences and account info quickly |
| #9 | Mark exams and get study sessions before them |
| #8 | Resize tabs (layout saved per user) |
| #7 | Break a goal into steps and schedule milestones |
| #6 | Simple main screen with advanced views behind a menu (saved per user) |
| #5 | Weekly review with progress visuals and a saved reflection |
| #4 | Reminders that open the related task |
| #3 | Reschedule missed tasks into open time slots; repeatable tasks |
| #2 | Quick weekly setup |
| #1 | See how goals and tasks connect |
| #22 | Dark mode saved per user |

## ORM and data model

- Prisma 7 schema (`prisma/schema.prisma`): 11 entities, enums, keys, relations and indexes;
  CHECK constraints in the init migration.
- UML class and sequence diagrams in `docs/uml/` (PlantUML source plus PNG/SVG).
- AI-generated design decisions and their corrections: `docs/ai-design-review.md`.

## Database integration

- PostgreSQL 17 locally for each member; a shared Neon database for approved migrations.
- Express API with validation and error handling in `server/`; every route is listed in
  `docs/database-setup.md`.
- Credentials: `.env` is ignored and has never been committed; `.env.example` holds placeholders; a
  pre-commit hook blocks secrets.

## Testing

- `npm test`: **116 tests, 116 passing** (unit tests plus 11 database integration tests, including
  a restart test).
- `npm run typecheck` and `npm run build`: pass.
- Evidence: `docs/sprint2-evidence.md`.

## Known limitations

- Sign-in checks the password against the database, but the API has no sessions yet; routes are
  scoped by user id. Development data only.
- No linter is configured yet (see `docs/sprint2-evidence.md`); TypeScript strict mode is the
  current quality gate.
- Notifications are in-app only. Email/push channels are stored but not sent.
- Profile picture uploads are a preview only; account deletion is not connected.
- Assumptions still awaiting team sign-off are listed in `docs/ai-design-review.md` §3.

## Run it

```sh
npm install
cp .env.example .env      # set your local PostgreSQL password
npm run db:migrate && npm run db:seed
npm run dev:api           # terminal 1
npm run dev               # terminal 2, then open http://localhost:5173 (demo / kadence-demo)
```
