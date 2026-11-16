# AI Design Review

Kadence's data model, UML diagrams, persistence layer and Sprint 2 feature code were drafted with AI
coding agents (GitHub Copilot Agent Mode and Claude Code) and then reviewed, tested and corrected.
This document records what the AI proposed, what was wrong with it, and what was changed.

Sections 1 and 2 are decisions that were reviewed and corrected. Section 3 lists assumptions the AI
made while implementing the user stories that **still need a team decision**: confirm or change
each one before the Sprint 2 release, and record who reviewed it.

## 1. Data model and UML (Part 1)

| # | AI proposal | Problem found in review | Correction |
|---|---|---|---|
| 1 | Model milestones as child goals (reuse `parentGoalId`). | The Figma Goal Breakdown frame shows a *Milestones* list ("Completed · date") **and** a separate *Connected Goals* panel, and user story 2.1 (#7) requires milestones scheduled onto dates. | Separate `Milestone` entity with `dueDate`, `completedAt`, `sortOrder`. |
| 2 | Merge tasks and planner events into one `Task` table. | Different screens with different fields (hour, duration, status vs. completion, exam flag). | Kept `Task` and `PlannerEvent` separate; revisit later. |
| 3 | Deleting a parent goal: "restrict or cascade". | Cascade would silently delete a student's medium and small goals. | `ON DELETE SET NULL`: children become standalone goals. |
| 4 | Native `TIME` columns for quiet hours, review time, availability. | Prisma maps `TIME` differently per database, hurting portability. | Minutes since midnight (`Int`) with CHECK constraints (0–1440). |
| 5 | `PlannerEvent` copied from the code, without priority. | User story 2.3 (#11) filters the calendar by priority. | Added `priority` and an index on `(user_id, priority)`. |
| 6 | Class diagram attributes like `username : String(50)`. | PlantUML rendered them as methods (parentheses read as a signature); caught by reviewing the PNG. | Those 15 lines use the `{field}` modifier. |
| 7 | `prisma init` scaffolding (agent skill folders, `skills-lock.json`, `prisma7.config.ts`). | Not part of the application. | Not committed; `prisma.config.ts` is the single config. |

## 2. Feature implementation (Part 5)

| # | AI-generated code or proposal | Problem found in review | Correction |
|---|---|---|---|
| 8 | Merged `Dashboard.tsx` / `VisualPlanner.tsx` from several feature branches. | `npm run build` failed on `main`: missing imports (`useRef`, `Fragment`), an undefined `setPlannerEventsForExport`, a duplicated props block in `VisualPlanner`, and `Breakdown` called without its required props. | Both files rewritten against the API; `npm run build` and `npm run typecheck` pass. |
| 9 | Exam study sessions computed only in the browser from in-memory tasks. | Not persisted, so they did not survive a restart, and the seed's stored study sessions (`sourceTaskId`) would have shown up twice. | `POST /study-plan/sync` runs the same tested algorithm (`src/studySessions.ts`) on the server and stores the result as planner events with `sourceTaskId`. It applies only the difference, so unchanged sessions keep their ids, and they can't be edited by hand. |
| 10 | Require a due date before a task can be marked as an exam (server validation). | Broke an existing flow: the To-do list and Priority setter let a student mark an exam first and show "Add a due date to schedule study sessions". | Validation removed; exams without a date simply get no sessions until a date is added. |
| 11 | Optimistic goal-priority update (show first, roll back on error). | Did not match the reviewed sequence diagram (`docs/uml/sequence-change-goal-priority.puml`), which updates the UI after `200 OK`. | Implementation changed to match the diagram; a local round trip is still effectively immediate (acceptance criterion of #12). |
| 12 | Clearing the saved tab layout with `tabLayout: null`. | Prisma rejects plain `null` for a nullable `Json` column at runtime. | The settings parser maps `null` to `Prisma.DbNull`; covered by a unit test. |
| 13 | A settings unit test asserting `dashboardMode` is never exposed by the API. | Encoded the Sprint 1 design; user story 1.5 (#6) requires saving the main-screen mode. | Test updated to the new contract, plus tests that reject malformed layouts and modes. |

## 3. Assumptions that need a team decision

These choices are implemented, tested and documented in code comments, but the user stories don't
specify them. Change the constants named below if the team disagrees.

| # | Assumption | Where | Reviewer / decision |
|---|---|---|---|
| A | Default reminders per day by priority: Very High 4, High 3, Medium 2, Low 1, Very Low 1, None 0 (each student can change them in Settings → Notifications). | `DEFAULT_REMINDERS_PER_DAY`, `server/services/notificationService.ts` | _pending_ |
| B | Task reminders start 7 days before the due date and are spread between 9 AM and 9 PM; planner events get one reminder an hour before they start. | `UPCOMING_WINDOW_DAYS`, `DAY_START_MINUTE`, same file | _pending_ |
| C | Missed tasks are moved into one-hour slots inside the student's open time slots, searching 14 days ahead, at most `dailyLimit` per day. | `SEARCH_DAYS`, `SLOT_HOURS`, `server/services/rescheduleService.ts` | _pending_ |
| D | A repeat creates at most 60 occurrences within one year. | `MAX_OCCURRENCES`, `server/services/recurrence.ts` | _pending_ |
| E | Simple main screen shows Goals, To do and Visual Planner; Breakdown, Priority and Weekly Review sit under "More". | `ALL_VIEWS`, `src/Dashboard.tsx` | _pending_ |
| F | The weekly review counts only tasks due or completed inside the selected week; older overdue work appears in the missed-task prompt instead. | `summarizeWeek`, `server/services/weeklyReviewService.ts` | _pending_ |
| G | Sign-in verifies the bcrypt password hash but no session token is issued; API routes are still scoped by `:userId`. Acceptable for a development build only. | `server/services/authService.ts`, `server/app.ts` | _pending_ |

## How AI output was verified

- Every service has unit tests for its rules, and `server/database.integration.test.ts` exercises
  the real routes, Prisma and PostgreSQL inside a throwaway account. It includes a test that stops
  and restarts the API and reads the data back.
- `npm run typecheck`, `npm test` and `npm run build` are run before each commit. Results are in
  [sprint2-evidence.md](sprint2-evidence.md).
- UML diagrams were compared against `prisma/schema.prisma` and the implemented request flow.
