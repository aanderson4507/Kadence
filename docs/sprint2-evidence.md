# Sprint 2 Evidence

Recorded on 2026-11-16 against a local PostgreSQL 17 development database (`kadence_dev`, seeded
with `npm run db:seed`). No credentials appear below. Re-run the commands and update this file
before tagging the release, so it matches the submitted code.

## Part 4: credentials are ignored and not tracked

```text
$ git check-ignore -v .env
.gitignore:9:*.env	.env

$ git ls-files .env
(no output: .env is not tracked)

$ git log --all --oneline -- .env
(no output: .env has never been committed on any branch)

$ git ls-files | grep -iE "\.env|\.pem|\.key$|\.sqlite|\.db$"
.env.example
```

`.env.example` is the only environment file in the repository and contains placeholders only.
Because `.env` was never committed, no credential rotation was needed. The pre-commit hook
(`npm run check:secrets`) checks every staged file. **Still to do:** after pushing, open the
repository on GitHub and confirm `.env` is not listed, and add a screenshot to the release.

## Part 5: data persists after the application restarts

User stories and acceptance criteria are tracked in GitHub Issues #1–#14 and #22; the mapping to
code and tests is in [user-stories.md](user-stories.md).

### Automated (repeatable): `server/database.integration.test.ts`

Runs the real Express routes → services → Prisma → PostgreSQL inside a throwaway account that is
deleted afterwards. The last test stops the API and its database connection, starts a fresh one and
reads the data back.

```text
▶ database integration
  ✔ creates an account and signs in with the stored password hash
  ✔ creates, reads, updates and deletes a task
  ✔ rejects invalid input with a 400 and writes nothing
  ✔ creates a repeating task as separate occurrences in one series
  ✔ breaks a goal into steps, schedules milestones and rolls progress up
  ✔ schedules study sessions before an exam and removes them when it's done
  ✔ saves planner events, including Quick Setup batches and repeats
  ✔ reschedules a missed task into an open time slot
  ✔ generates reminders from saved preferences and marks them read
  ✔ saves a weekly review reflection with a snapshot of the counts
  ✔ keeps everything after the API restarts
ℹ tests 11  pass 11  fail 0  skipped 0
```

### Manual run through the app's proxy (`npm run dev` + `npm run dev:api`)

Writes made as the seeded `demo` user through `http://localhost:5173/api`:

```text
GET /api/health -> 200 {"status":"ok","database":"connected","counts":{"users":1,"goals":8,"tasks":13,"plannerEvents":15}}
POST /api/auth/login (demo) -> 200 demo
POST tasks -> 201 Evidence: persistence check HIGH 2026-11-19 remindersPerDay=5
PATCH task completed -> 200 completed=true 2026-11-16
POST tasks with blank title -> 400 title is required.
POST planner-events -> 201 Evidence: study group 2026-11-17 15:00
POST goals (with child) -> 201 Evidence: finish portfolio site
POST milestone -> 201 Evidence: publish site @ 2026-11-26
PATCH goal priority -> 200 VERY_HIGH
PATCH settings dashboardMode -> 200 ADVANCED
```

The API process was then stopped and a new one started. Reads after the restart:

```text
GET /api/health -> 200 {"status":"ok","database":"connected","counts":{"users":1,"goals":10,"tasks":14,"plannerEvents":16}}
GET tasks after restart -> Evidence: persistence check | HIGH | completed=true | remindersPerDay=5
GET planner-events after restart -> Evidence: study group | 2026-11-17 15:00 | HIGH
GET goals after restart -> Evidence: finish portfolio site | VERY_HIGH | milestones: Evidence: publish site | child: Evidence: write case studies
GET settings after restart -> dashboardMode = ADVANCED
POST study-plan/sync -> study sessions: Study: Calculus Exam 2 2026-11-18 16:00; Study: Calculus Exam 2 2026-11-19 16:00; Study: Calculus Exam 2 2026-11-20 16:00
POST notifications/sync -> 200 delivered=6, unread=6, later today=8
GET weekly-review -> 200 2026-11-16..2026-11-22: completed=1, pending=4, overdue=0, rate=20%
```

**Still to do (team):** record a short screen capture of the same flow in the browser (add a task,
restart `npm run dev:api`, reload, task is still there) and attach it to the release or the issue.

## Part 7: automated tests, type checks and build

```text
$ npm test
ℹ tests 116  suites 21  pass 116  fail 0  cancelled 0  skipped 0

$ npm run typecheck        # tsc for the React app and for the server
typecheck: OK (no errors)

$ npm run build            # tsc + vite production build
✓ built in 146ms
```

| Requirement | Tests |
|---|---|
| Successful data operations | `server/database.integration.test.ts` (create/read/update/delete for tasks, goals, milestones, planner events, settings, reminders, weekly review) |
| Invalid input and error handling | "rejects invalid input with a 400 and writes nothing", the bad Quick Setup batch, overlapping time slots, wrong password (401), duplicate account (409); `server/settingsRoutes.test.ts`; `server/services/*.test.ts` validation cases; `src/settingsApi.test.ts` (server and network failures) |
| The database user story | Task persistence and restart test; goal priority (#12); study sessions (#9); reminders (#4, #13); rescheduling (#3) |
| Data-access layer tested apart from the UI | Every `server/services/*.test.ts` and the integration suite call the services/API directly |

### Lint

The project does not have a linter configured yet. Installing one needs a new dev dependency,
which was not approved during this session. To add it:

```sh
npm install --save-dev --save-exact oxlint
npm pkg set scripts.lint="oxlint src server --deny-warnings"
npm run lint
```

oxlint is suggested because it doesn't depend on the TypeScript compiler API, so it works with the
project's TypeScript 7 regardless of typescript-eslint's support for that version. Until it's added, `npm run typecheck` (strict mode with `noUnusedLocals` and
`noUnusedParameters`) is the code-quality gate.
