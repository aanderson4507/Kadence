# User Stories: Implementation and Traceability (Sprint 2)

Each user story is a GitHub Issue with acceptance criteria. Every story below is database-backed:
its data is saved through Prisma to PostgreSQL and is still there after the app restarts
([sprint2-evidence.md](sprint2-evidence.md)). API routes are listed in
[database-setup.md](database-setup.md#api-reference).

**Primary database-integrated story for grading:** #12, *Change a goal's priority* (sequence
diagram: `docs/uml/sequence-change-goal-priority.puml`). The others are implemented the same way.

| Issue | Story | Acceptance criteria → how they're met | Data | Tests |
|---|---|---|---|---|
| #14 | 2.8 Add and manage tasks in the visual planner | Obvious **Add a new task** button in the planner header; the new task appears in the week/day calendar and the task details panel; edit and delete with confirmation. | `planner_events` | integration: planner events |
| #13 | 2.6 Set how often I'm reminded | Per-task **Reminder frequency** in the Priority setter (and per-event in the planner form); each task has its own level or uses its priority's default; **Settings → Notifications → Reminder frequency by priority** sets those defaults. | `tasks.reminders_per_day`, `planner_events.reminders_per_day`, `priority_reminder_rules` | `notificationService.test.ts`; integration: reminders |
| #12 | 2.4 Change a goal's priority | Priority select on every goal card, in the Breakdown summary and the Goal Priorities list; levels Very High → None; saved, then shown immediately everywhere; kept when switching views and after restart. | `goals.priority` | integration: goals |
| #11 | 2.3 Filter by priority | **Priority** dropdown on the calendar with a checkbox per level, default all; the calendar updates as boxes change and shows how many tasks are hidden. The To-do list also filters by priority (default **All priorities**). | `planner_events.priority` | integration: planner events |
| #10 | 2.9 Change preferences and account info quickly | Settings opens on an overview with account info and top preferences; one **Save changes** saves everything; failures keep your edits and explain why. | `users`, `user_settings` | `settingsService.test.ts`, `settingsRoutes.test.ts`, `settingsApi.test.ts` |
| #9 | 2.2 Exam priority and study sessions | Mark a task as an exam (To-do ⋯ menu, quick add, Priority setter) with a priority; Kadence stores study sessions in the planner in the days before it, around existing events; study preferences in **Settings → Exam study sessions**; Breakdown lists sessions and any that didn't fit. | `tasks.is_exam`, `planner_events.source_task_id`, `user_settings.study_*` | `studySessions.test.ts`, `taskPriority.test.ts`; integration: study sessions |
| #8 | 2.7 Resize tabs | Split view with draggable/keyboard resizers; content resizes; open tabs, widths, split mode and the active tab are saved and restored on the next visit. | `user_settings.tab_layout` | `settingsService.test.ts`; integration: restart |
| #7 | 2.1 Goal breakdown and milestone scheduling | Create a big goal and break it into medium goals in the Add goal dialog (or link a goal to a parent); add milestones with dates in Breakdown, optionally blocking time in the planner; progress rolls up from milestones, linked tasks and child goals. | `goals.parent_goal_id`, `milestones` | integration: goals |
| #6 | 1.5 Simplified main screen | **Simple** mode shows Goals, To do and Visual Planner; Breakdown, Priority and Weekly Review are under **More**; **Advanced** shows everything plus split view; the choice is saved per user. | `user_settings.dashboard_mode` | `settingsService.test.ts`; integration: restart |
| #5 | 1.4 Weekly review | **Weekly review** button on the dashboard (always available) and a view under More; completed vs. pending vs. overdue for the week, completion %, per-day chart, goals and milestones finished, time spent; a reflection saved with a snapshot; a reminder on the chosen review day and time. | `weekly_reviews`, computed from `tasks` | `weeklyReviewService.test.ts`; integration: weekly review |
| #4 | 1.3 Reminders | Reminders before deadlines follow the saved reminder settings and Do Not Disturb hours; the number per day can be set per task; clicking a notification opens and highlights that task (or planner event / weekly review). | `notifications` | `notificationService.test.ts`; integration: reminders |
| #3 | 1.2 Rescheduling and repeatable tasks | Missed tasks are detected on open and every hour; Kadence offers to move them into the next free hour of your **open time slots** (Settings → Unfinished tasks) without overlapping planner events, or to today, or to the backlog; follows the saved "unfinished task" preferences; tasks and planner events can repeat daily/weekly/monthly as separate occurrences. | `availability_windows`, `recurrence_rules`, `tasks.series_id`, `tasks.original_due_date` | `rescheduleService.test.ts`, `recurrence.test.ts`; integration: repeats, reschedule |
| #2 | 1.1 Quick weekly setup | **Quick Setup** button on the dashboard opens a simple form for the week; saving stores every task in one transaction and shows the weekly view. | `planner_events` | integration: Quick Setup batch |
| #1 | 2.5 How goals connect | Breakdown shows the selected goal's progress, its parent and child/grandchild goals (each with progress, click to open), and its linked tasks (click to open in the To-do list). | `goals`, `tasks.goal_id` | integration: goals |
| #22 | 3.1 Dark mode | The theme switch in the header and Settings is saved per user. | `user_settings.theme` | `settingsApi.test.ts` |

## Team checklist (GitHub, not in the repository)

- [ ] Assign each issue above to the member who reviewed/tested it and move it to **Done** on the
      GitHub Project board (Part 6.2).
- [ ] Reference the issue numbers in the Sprint 2 commit/PR (for example "Closes #12").
- [ ] Every member makes at least one meaningful commit under their own GitHub account (Part 6.1).
- [ ] Every member fills in their row in [database-setup.md](database-setup.md#verification-results).
- [ ] Confirm or change the open assumptions in [ai-design-review.md](ai-design-review.md#3-assumptions-that-need-a-team-decision).
