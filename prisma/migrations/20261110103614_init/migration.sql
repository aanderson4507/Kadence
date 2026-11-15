-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW', 'NONE');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PlannerViewPreference" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "WeekStart" AS ENUM ('SUNDAY', 'MONDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "TimeFormat" AS ENUM ('TWELVE_HOUR', 'TWENTY_FOUR_HOUR');

-- CreateEnum
CREATE TYPE "LandingPage" AS ENUM ('DASHBOARD', 'PLANNER', 'GOALS');

-- CreateEnum
CREATE TYPE "DashboardMode" AS ENUM ('SIMPLE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "GoalTimeframe" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('ACADEMIC', 'CAREER', 'PERSONAL_DEVELOPMENT');

-- CreateEnum
CREATE TYPE "GoalBreakdownMethod" AS ENUM ('MAJOR_MILESTONES', 'DAILY', 'WEEKLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "CelebrationStyle" AS ENUM ('MESSAGE', 'ANIMATION', 'OFF');

-- CreateEnum
CREATE TYPE "ProgressMetric" AS ENUM ('PERCENT_COMPLETE', 'TASKS_COMPLETED', 'MILESTONES_COMPLETED', 'TIME_SPENT');

-- CreateEnum
CREATE TYPE "UnfinishedTaskBehavior" AS ENUM ('ASK', 'MOVE_TO_NEXT_DAY', 'KEEP_ORIGINAL_DATE', 'MOVE_TO_BACKLOG');

-- CreateEnum
CREATE TYPE "UnfinishedReviewTime" AS ENUM ('END_OF_DAY', 'START_OF_NEXT_DAY', 'WEEKLY_REVIEW', 'NEVER');

-- CreateEnum
CREATE TYPE "DeadlineHandling" AS ENUM ('AUTO_UPDATE', 'KEEP_ORIGINAL', 'ASK');

-- CreateEnum
CREATE TYPE "MissedGoalHandling" AS ENUM ('KEEP', 'RESCHEDULE', 'REVISE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "ProgressVisualization" AS ENUM ('CHARTS', 'PROGRESS_BARS', 'PERCENTAGES');

-- CreateEnum
CREATE TYPE "BackupPreference" AS ENUM ('AUTOMATIC', 'MANUAL', 'OFF');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DAILY_PLANNING', 'UPCOMING_TASK', 'DEADLINE', 'GOAL_PROGRESS', 'WEEKLY_REVIEW', 'MISSED_GOAL');

-- CreateEnum
CREATE TYPE "GoalSize" AS ENUM ('BIG', 'MEDIUM', 'SMALL');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlannerCategory" AS ENUM ('PERSONAL', 'FOCUS', 'WELLBEING', 'WORK');

-- CreateEnum
CREATE TYPE "PlannerTaskType" AS ENUM ('PROJECT', 'TASK', 'HABIT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "school" VARCHAR(150),
    "major" VARCHAR(150),
    "graduation_date" DATE,
    "career_interests" TEXT,
    "career_goals" TEXT,
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'LIGHT',
    "accent_color" VARCHAR(7) NOT NULL DEFAULT '#406b51',
    "planner_view" "PlannerViewPreference" NOT NULL DEFAULT 'DAILY',
    "week_start" "WeekStart" NOT NULL DEFAULT 'SUNDAY',
    "time_format" "TimeFormat" NOT NULL DEFAULT 'TWELVE_HOUR',
    "landing_page" "LandingPage" NOT NULL DEFAULT 'DASHBOARD',
    "dashboard_mode" "DashboardMode" NOT NULL DEFAULT 'SIMPLE',
    "tab_layout" JSONB,
    "remind_daily_planning" BOOLEAN NOT NULL DEFAULT true,
    "remind_upcoming" BOOLEAN NOT NULL DEFAULT true,
    "remind_deadline" BOOLEAN NOT NULL DEFAULT true,
    "remind_goal_progress" BOOLEAN NOT NULL DEFAULT true,
    "remind_weekly_review" BOOLEAN NOT NULL DEFAULT true,
    "remind_missed_goal" BOOLEAN NOT NULL DEFAULT true,
    "quiet_start_minute" INTEGER,
    "quiet_end_minute" INTEGER,
    "goal_timeframe" "GoalTimeframe" NOT NULL DEFAULT 'DAILY',
    "goal_category" "GoalCategory" NOT NULL DEFAULT 'ACADEMIC',
    "goal_breakdown" "GoalBreakdownMethod" NOT NULL DEFAULT 'MAJOR_MILESTONES',
    "goal_priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "celebration" "CelebrationStyle" NOT NULL DEFAULT 'MESSAGE',
    "progress_metric" "ProgressMetric" NOT NULL DEFAULT 'PERCENT_COMPLETE',
    "unfinished_behavior" "UnfinishedTaskBehavior" NOT NULL DEFAULT 'ASK',
    "unfinished_review_time" "UnfinishedReviewTime" NOT NULL DEFAULT 'START_OF_NEXT_DAY',
    "deadline_handling" "DeadlineHandling" NOT NULL DEFAULT 'KEEP_ORIGINAL',
    "auto_reschedule" BOOLEAN NOT NULL DEFAULT false,
    "reschedule_high_only" BOOLEAN NOT NULL DEFAULT false,
    "reschedule_exclude_overdue" BOOLEAN NOT NULL DEFAULT false,
    "daily_limit" INTEGER NOT NULL DEFAULT 3,
    "warn_overload" BOOLEAN NOT NULL DEFAULT true,
    "reprioritize_when_full" BOOLEAN NOT NULL DEFAULT true,
    "review_day" INTEGER NOT NULL DEFAULT 5,
    "review_reminder" BOOLEAN NOT NULL DEFAULT true,
    "review_minute" INTEGER NOT NULL DEFAULT 990,
    "review_summary_items" JSONB NOT NULL DEFAULT '["TASKS_COMPLETED","GOALS_COMPLETED","MILESTONES_REACHED","TIME_SPENT"]',
    "reflection_questions" BOOLEAN NOT NULL DEFAULT true,
    "missed_goal_handling" "MissedGoalHandling" NOT NULL DEFAULT 'KEEP',
    "visualization" "ProgressVisualization" NOT NULL DEFAULT 'CHARTS',
    "study_days_before_exam" INTEGER NOT NULL DEFAULT 3,
    "study_session_hours" INTEGER NOT NULL DEFAULT 1,
    "study_sessions_per_day" INTEGER NOT NULL DEFAULT 1,
    "study_window_start_hour" INTEGER NOT NULL DEFAULT 16,
    "study_window_end_hour" INTEGER NOT NULL DEFAULT 21,
    "backup" "BackupPreference" NOT NULL DEFAULT 'AUTOMATIC',
    "delete_completed" BOOLEAN NOT NULL DEFAULT true,
    "delete_completed_after_days" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "priority_reminder_rules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "priority" "Priority" NOT NULL,
    "reminders_per_day" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',

    CONSTRAINT "priority_reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_windows" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_goal_id" UUID,
    "title" VARCHAR(150) NOT NULL,
    "size" "GoalSize" NOT NULL,
    "category" "GoalCategory",
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NONE',
    "start_date" DATE,
    "target_date" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'General',
    "priority" "Priority" NOT NULL DEFAULT 'NONE',
    "due_date" DATE,
    "original_due_date" DATE,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_date" DATE,
    "is_exam" BOOLEAN NOT NULL DEFAULT false,
    "reminders_per_day" INTEGER,
    "in_backlog" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule_id" UUID,
    "series_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planner_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "linked_event_id" UUID,
    "source_task_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "category" "PlannerCategory" NOT NULL DEFAULT 'WORK',
    "task_type" "PlannerTaskType" NOT NULL DEFAULT 'PROJECT',
    "goal_size" "GoalSize" NOT NULL DEFAULT 'MEDIUM',
    "priority" "Priority" NOT NULL DEFAULT 'NONE',
    "status" "EventStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "event_date" DATE NOT NULL,
    "original_event_date" DATE,
    "start_hour" INTEGER NOT NULL,
    "duration_hours" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "notes" TEXT,
    "reminders_per_day" INTEGER,
    "recurrence_rule_id" UUID,
    "series_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrence_rules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "weekdays" INTEGER,
    "ends_on" DATE,
    "max_occurrences" INTEGER,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "planner_event_id" UUID,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "reflection" TEXT,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "pending_count" INTEGER NOT NULL DEFAULT 0,
    "overdue_count" INTEGER NOT NULL DEFAULT 0,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "weekly_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "priority_reminder_rules_user_id_priority_key" ON "priority_reminder_rules"("user_id", "priority");

-- CreateIndex
CREATE INDEX "availability_windows_user_id_weekday_idx" ON "availability_windows"("user_id", "weekday");

-- CreateIndex
CREATE INDEX "goals_user_id_size_idx" ON "goals"("user_id", "size");

-- CreateIndex
CREATE INDEX "goals_parent_goal_id_idx" ON "goals"("parent_goal_id");

-- CreateIndex
CREATE INDEX "milestones_goal_id_sort_order_idx" ON "milestones"("goal_id", "sort_order");

-- CreateIndex
CREATE INDEX "tasks_user_id_due_date_idx" ON "tasks"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "tasks_user_id_completed_idx" ON "tasks"("user_id", "completed");

-- CreateIndex
CREATE INDEX "tasks_goal_id_idx" ON "tasks"("goal_id");

-- CreateIndex
CREATE INDEX "tasks_series_id_idx" ON "tasks"("series_id");

-- CreateIndex
CREATE INDEX "planner_events_user_id_event_date_idx" ON "planner_events"("user_id", "event_date");

-- CreateIndex
CREATE INDEX "planner_events_user_id_priority_idx" ON "planner_events"("user_id", "priority");

-- CreateIndex
CREATE INDEX "planner_events_source_task_id_idx" ON "planner_events"("source_task_id");

-- CreateIndex
CREATE INDEX "planner_events_series_id_idx" ON "planner_events"("series_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_scheduled_for_idx" ON "notifications"("user_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "notifications_task_id_idx" ON "notifications"("task_id");

-- CreateIndex
CREATE INDEX "notifications_planner_event_id_idx" ON "notifications"("planner_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reviews_user_id_week_start_key" ON "weekly_reviews"("user_id", "week_start");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_reminder_rules" ADD CONSTRAINT "priority_reminder_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_events" ADD CONSTRAINT "planner_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_events" ADD CONSTRAINT "planner_events_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_events" ADD CONSTRAINT "planner_events_linked_event_id_fkey" FOREIGN KEY ("linked_event_id") REFERENCES "planner_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_events" ADD CONSTRAINT "planner_events_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_events" ADD CONSTRAINT "planner_events_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_planner_event_id_fkey" FOREIGN KEY ("planner_event_id") REFERENCES "planner_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CHECK constraints (hand-written; Prisma schema language cannot express these).
-- Keep in sync with docs/data-requirements.md and docs/uml/class-diagram.puml.
-- ---------------------------------------------------------------------------

-- users
ALTER TABLE "users" ADD CONSTRAINT "users_username_not_blank" CHECK (btrim("username") <> '');
ALTER TABLE "users" ADD CONSTRAINT "users_email_format" CHECK ("email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- user_settings
ALTER TABLE "user_settings"
  ADD CONSTRAINT "user_settings_accent_color_hex" CHECK ("accent_color" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "user_settings_quiet_hours_pair" CHECK (("quiet_start_minute" IS NULL) = ("quiet_end_minute" IS NULL)),
  ADD CONSTRAINT "user_settings_quiet_start_range" CHECK ("quiet_start_minute" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "user_settings_quiet_end_range" CHECK ("quiet_end_minute" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "user_settings_daily_limit_range" CHECK ("daily_limit" BETWEEN 0 AND 20),
  ADD CONSTRAINT "user_settings_review_day_range" CHECK ("review_day" BETWEEN 0 AND 6),
  ADD CONSTRAINT "user_settings_review_minute_range" CHECK ("review_minute" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "user_settings_review_summary_is_array" CHECK (jsonb_typeof("review_summary_items") = 'array'),
  ADD CONSTRAINT "user_settings_study_days_range" CHECK ("study_days_before_exam" BETWEEN 1 AND 30),
  ADD CONSTRAINT "user_settings_study_hours_range" CHECK ("study_session_hours" BETWEEN 1 AND 8),
  ADD CONSTRAINT "user_settings_study_per_day_range" CHECK ("study_sessions_per_day" BETWEEN 1 AND 6),
  ADD CONSTRAINT "user_settings_study_window" CHECK (
    "study_window_start_hour" BETWEEN 0 AND 23
    AND "study_window_end_hour" BETWEEN 1 AND 24
    AND "study_window_start_hour" < "study_window_end_hour"
  ),
  ADD CONSTRAINT "user_settings_delete_after_range" CHECK ("delete_completed_after_days" BETWEEN 1 AND 365);

-- priority_reminder_rules
ALTER TABLE "priority_reminder_rules"
  ADD CONSTRAINT "priority_reminder_rules_per_day_range" CHECK ("reminders_per_day" BETWEEN 0 AND 24);

-- availability_windows
ALTER TABLE "availability_windows"
  ADD CONSTRAINT "availability_windows_weekday_range" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "availability_windows_minutes_range" CHECK (
    "start_minute" BETWEEN 0 AND 1439
    AND "end_minute" BETWEEN 1 AND 1440
    AND "start_minute" < "end_minute"
  );

-- goals
ALTER TABLE "goals"
  ADD CONSTRAINT "goals_title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "goals_dates_order" CHECK ("start_date" IS NULL OR "target_date" IS NULL OR "target_date" >= "start_date"),
  ADD CONSTRAINT "goals_completed_at_matches_status" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
  ADD CONSTRAINT "goals_not_own_parent" CHECK ("parent_goal_id" IS NULL OR "parent_goal_id" <> "id");

-- milestones
ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "milestones_sort_order_positive" CHECK ("sort_order" >= 1);

-- tasks
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "tasks_category_not_blank" CHECK (btrim("category") <> ''),
  ADD CONSTRAINT "tasks_completed_date_matches" CHECK ("completed" = ("completed_date" IS NOT NULL)),
  ADD CONSTRAINT "tasks_reminders_per_day_range" CHECK ("reminders_per_day" IS NULL OR "reminders_per_day" BETWEEN 0 AND 24);

-- planner_events
ALTER TABLE "planner_events"
  ADD CONSTRAINT "planner_events_title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "planner_events_start_hour_range" CHECK ("start_hour" BETWEEN 0 AND 23),
  ADD CONSTRAINT "planner_events_duration_range" CHECK ("duration_hours" BETWEEN 1 AND 24),
  ADD CONSTRAINT "planner_events_ends_same_day" CHECK ("start_hour" + "duration_hours" <= 24),
  ADD CONSTRAINT "planner_events_not_linked_to_self" CHECK ("linked_event_id" IS NULL OR "linked_event_id" <> "id"),
  ADD CONSTRAINT "planner_events_reminders_per_day_range" CHECK ("reminders_per_day" IS NULL OR "reminders_per_day" BETWEEN 0 AND 24);

-- recurrence_rules
ALTER TABLE "recurrence_rules"
  ADD CONSTRAINT "recurrence_rules_interval_positive" CHECK ("interval_count" >= 1),
  ADD CONSTRAINT "recurrence_rules_weekdays_range" CHECK ("weekdays" IS NULL OR "weekdays" BETWEEN 1 AND 127),
  ADD CONSTRAINT "recurrence_rules_max_occurrences_positive" CHECK ("max_occurrences" IS NULL OR "max_occurrences" >= 1),
  ADD CONSTRAINT "recurrence_rules_single_end" CHECK ("ends_on" IS NULL OR "max_occurrences" IS NULL);

-- notifications
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_single_target" CHECK ("task_id" IS NULL OR "planner_event_id" IS NULL);

-- weekly_reviews
ALTER TABLE "weekly_reviews"
  ADD CONSTRAINT "weekly_reviews_counts_non_negative" CHECK (
    "completed_count" >= 0 AND "pending_count" >= 0 AND "overdue_count" >= 0
  );
