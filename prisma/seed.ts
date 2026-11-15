// Development seed data (npm run db:seed). Never run against a database with real user data.
// Re-running is safe: the demo account is deleted (cascading to all of its rows) and recreated.
// Dates are relative to today so the Weekly Review, overdue and upcoming views have content.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../server/db.ts";
import { todayDateOnly } from "../server/validation.ts";

const db = createPrismaClient();
const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "kadence-demo";

const today = todayDateOnly();
/** Date-only value `offset` days from today. */
function day(offset: number): Date {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}
/** Timestamp `offset` days from now at the given local hour. */
function at(offset: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
}
// Monday of the current week, as an offset from today (the planner week starts on Monday).
const mondayOffset = -((today.getUTCDay() + 6) % 7);

async function main() {
  await db.user.deleteMany({ where: { username: DEMO_USERNAME } });

  const user = await db.user.create({
    data: {
      username: DEMO_USERNAME,
      email: "demo@kadence.dev",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName: "Alex",
      lastName: "Lee",
      school: "State University",
      major: "Computer Science",
      graduationDate: new Date("2028-05-01T00:00:00.000Z"),
      careerInterests: "software engineering, data science",
      careerGoals: "Land a summer software engineering internship.",
      settings: { create: { theme: "LIGHT", weekStart: "MONDAY", reviewDay: 0 } },
      priorityRules: {
        create: [
          { priority: "VERY_HIGH", remindersPerDay: 4 },
          { priority: "HIGH", remindersPerDay: 3 },
          { priority: "MEDIUM", remindersPerDay: 2 },
          { priority: "LOW", remindersPerDay: 1 },
          { priority: "VERY_LOW", remindersPerDay: 1 },
          { priority: "NONE", remindersPerDay: 0 },
        ],
      },
      availabilityWindows: {
        create: [
          ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 18 * 60, endMinute: 21 * 60 })),
          { weekday: 6, startMinute: 10 * 60, endMinute: 14 * 60 },
        ],
      },
    },
  });
  const userId = user.id;

  // --- Goals (Goal Page and Goal Breakdown frames) -------------------------------------
  const internship = await db.goal.create({
    data: {
      userId,
      title: "Get an internship",
      size: "BIG",
      category: "CAREER",
      priority: "HIGH",
      description: "Find and secure a summer internship related to computer science.",
      startDate: day(-14),
      targetDate: day(60),
    },
  });
  const prepareResume = await db.goal.create({
    data: { userId, parentGoalId: internship.id, title: "Prepare resume", size: "MEDIUM", category: "CAREER", priority: "HIGH" },
  });
  const applyCompanies = await db.goal.create({
    data: { userId, parentGoalId: internship.id, title: "Apply to companies", size: "MEDIUM", category: "CAREER", priority: "MEDIUM", targetDate: day(30) },
  });
  await db.goal.create({
    data: {
      userId,
      parentGoalId: prepareResume.id,
      title: "Update LinkedIn",
      size: "SMALL",
      category: "CAREER",
      status: "COMPLETED",
      completedAt: at(-3, 20),
    },
  });
  const interviewPractice = await db.goal.create({
    data: { userId, parentGoalId: internship.id, title: "Practice interview questions", size: "SMALL", category: "CAREER", priority: "MEDIUM" },
  });

  const calculus = await db.goal.create({
    data: {
      userId,
      title: "Pass Calculus",
      size: "BIG",
      category: "ACADEMIC",
      priority: "VERY_HIGH",
      description: "Finish the semester with a B or better.",
      startDate: day(-60),
      targetDate: day(40),
      milestones: {
        create: [
          "Limits quiz",
          "Derivatives problem set",
          "Exam 1",
          "Chain rule worksheet",
          "Related rates project",
          "Optimization quiz",
          "Integration rules review",
          "Exam 2",
          "Final project",
          "Final exam",
        ].map((title, index) => ({
          title,
          sortOrder: index + 1,
          dueDate: day(-50 + index * 9),
          completedAt: index < 6 ? at(-50 + index * 9, 18) : null,
        })),
      },
    },
  });

  const portfolio = await db.goal.create({
    data: { userId, title: "Build portfolio", size: "MEDIUM", category: "PERSONAL_DEVELOPMENT", priority: "MEDIUM", targetDate: day(21) },
  });
  await db.goal.create({
    data: { userId, title: "Review job postings", size: "SMALL", category: "CAREER", priority: "LOW", targetDate: day(mondayOffset + 6) /* "Due this week" */ },
  });

  // --- Tasks (To-Do list, Priority setter, Weekly Review) -------------------------------
  const calcExam = await db.task.create({
    data: {
      userId,
      goalId: calculus.id,
      title: "Calculus Exam 2",
      category: "Study",
      priority: "VERY_HIGH",
      dueDate: day(6),
      isExam: true,
      remindersPerDay: 4,
    },
  });
  await db.task.createMany({
    data: [
      { userId, goalId: calculus.id, title: "Complete Test Review for Calc.", category: "Study", priority: "HIGH", dueDate: day(2) },
      { userId, title: "Finish Part 2 of python project", category: "Coding", priority: "HIGH", dueDate: day(-1), completed: true, completedDate: day(-1) },
      { userId, goalId: interviewPractice.id, title: "Practice Elevator Pitch for Next Week", category: "Career", priority: "HIGH", dueDate: day(5) },
      { userId, goalId: prepareResume.id, title: "Update experience/projects section on Resume", category: "Career", priority: "HIGH", completed: true, completedDate: day(-2) },
      { userId, goalId: applyCompanies.id, title: "Apply to jobs", category: "Career", priority: "MEDIUM", dueDate: day(-1), originalDueDate: day(-3) },
      { userId, title: "Hit a new PR in gym", category: "Fitness", priority: "NONE" },
      { userId, goalId: portfolio.id, title: "Pick a portfolio template", category: "Coding", priority: "MEDIUM", completed: true, completedDate: day(-6) },
      { userId, goalId: portfolio.id, title: "Write a project case study", category: "Coding", priority: "MEDIUM", completed: true, completedDate: day(-4) },
      { userId, goalId: portfolio.id, title: "Add a contact page", category: "Coding", priority: "LOW", dueDate: day(3) },
      { userId, goalId: portfolio.id, title: "Deploy portfolio", category: "Coding", priority: "MEDIUM", dueDate: day(10) },
      { userId, goalId: portfolio.id, title: "Ask a friend for feedback", category: "Coding", priority: "LOW", inBacklog: true },
    ],
  });

  // --- Planner events (Visual Planner frame), current week ------------------------------
  const weekday = (index: number) => day(mondayOffset + index);
  const projectPlanning = await db.plannerEvent.create({
    data: {
      userId,
      title: "Project planning",
      category: "WORK",
      priority: "HIGH",
      eventDate: weekday(2),
      startHour: 0,
      durationHours: 2,
      description: "Outline priorities and next steps for the week.",
      notes: "Make space for focused work",
    },
  });
  await db.plannerEvent.createMany({
    data: [
      { userId, title: "Reading time", category: "PERSONAL", eventDate: weekday(0), startHour: 0, durationHours: 1, description: "Make time to read and ease into the week." },
      { userId, title: "Journaling", category: "PERSONAL", eventDate: weekday(3), startHour: 0, durationHours: 1, description: "Take a quiet moment to reflect and write." },
      { userId, title: "Slow moments", category: "PERSONAL", eventDate: weekday(6), startHour: 0, durationHours: 1, description: "Leave room for a slower start to the day." },
      { userId, goalId: portfolio.id, title: "Deep work", category: "FOCUS", priority: "MEDIUM", status: "IN_PROGRESS", eventDate: weekday(1), startHour: 6, durationHours: 2, description: "Protect a block of focused work time." },
      { userId, linkedEventId: projectPlanning.id, title: "Finish & review", category: "FOCUS", priority: "MEDIUM", eventDate: weekday(4), startHour: 6, durationHours: 2, description: "Complete the work in progress and review it." },
      { userId, title: "Get outside", category: "WELLBEING", status: "DONE", eventDate: weekday(0), startHour: 12, durationHours: 1, description: "Step outside for some fresh air." },
      { userId, title: "Lunch & a walk", category: "WELLBEING", eventDate: weekday(2), startHour: 12, durationHours: 1, description: "Take a lunch break and go for a walk." },
      { userId, title: "Fresh air break", category: "WELLBEING", eventDate: weekday(5), startHour: 12, durationHours: 1, description: "Take a short outdoor break." },
      { userId, title: "Capture ideas", category: "FOCUS", eventDate: weekday(1), startHour: 18, durationHours: 1, description: "Write down new ideas before wrapping up." },
    ],
  });

  // Repeating habit: "Weekly reset" every Sunday, stored as three occurrences sharing a series.
  const weeklyRule = await db.recurrenceRule.create({
    data: { userId, frequency: "WEEKLY", intervalCount: 1, weekdays: 1 /* Sunday */ },
  });
  const seriesId = randomUUID();
  await db.plannerEvent.createMany({
    data: [0, 7, 14].map((offset) => ({
      userId,
      title: "Weekly reset",
      category: "WELLBEING" as const,
      taskType: "HABIT" as const,
      eventDate: weekday(6 + offset),
      startHour: 18,
      durationHours: 1,
      description: "Reset your space and prepare for the week ahead.",
      recurrenceRuleId: weeklyRule.id,
      seriesId,
    })),
  });

  // Study sessions generated for the exam (two days before, one per day, inside the study window).
  await db.plannerEvent.createMany({
    data: [2, 1].map((daysBefore) => ({
      userId,
      sourceTaskId: calcExam.id,
      goalId: calculus.id,
      title: "Study: Calculus Exam 2",
      category: "FOCUS" as const,
      taskType: "TASK" as const,
      priority: "VERY_HIGH" as const,
      eventDate: day(6 - daysBefore),
      startHour: 16,
      durationHours: 1,
    })),
  });

  // --- Notifications and a past weekly review --------------------------------------------
  await db.notification.createMany({
    data: [
      { userId, taskId: calcExam.id, type: "DEADLINE", scheduledFor: at(5, 9) },
      { userId, type: "WEEKLY_REVIEW", scheduledFor: at(-today.getUTCDay() + 7, 16) },
    ],
  });
  await db.weeklyReview.create({
    data: {
      userId,
      weekStart: day(mondayOffset - 7),
      reflection: "Good momentum on the portfolio; job applications slipped.",
      completedCount: 6,
      pendingCount: 2,
      overdueCount: 1,
      reviewedAt: at(mondayOffset - 1, 17),
    },
  });

  const counts = {
    goals: await db.goal.count({ where: { userId } }),
    milestones: await db.milestone.count({ where: { goal: { userId } } }),
    tasks: await db.task.count({ where: { userId } }),
    plannerEvents: await db.plannerEvent.count({ where: { userId } }),
  };
  console.log(`Seeded demo user "${DEMO_USERNAME}" (password "${DEMO_PASSWORD}"):`, counts);
}

try {
  await main();
} finally {
  await db.$disconnect();
}
