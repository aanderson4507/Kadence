import type { CSSProperties } from "react";
import "./Breakdown.css";
import type { Task } from "./TodoList";

type BreakdownProps = {
  tasks: Task[];
};

type ProgressStyle = CSSProperties & {
  "--progress-angle": string;
};

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);

  return start;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Breakdown({ tasks }: BreakdownProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = getWeekStart(today);
  const weekEnd = addDays(weekStart, 7);

  // Tasks completed this week or scheduled for this week.
  const completedTasks = tasks.filter((task) => {
    if (!task.completed) return false;

    const completedThisWeek =
      task.completedDate &&
      parseDate(task.completedDate) >= weekStart &&
      parseDate(task.completedDate) < weekEnd;

    const dueThisWeek =
      task.dueDate &&
      parseDate(task.dueDate) >= weekStart &&
      parseDate(task.dueDate) < weekEnd;

    return completedThisWeek || dueThisWeek;
  });

  // Incomplete tasks whose deadlines have passed.
  const overdueTasks = tasks.filter(
    (task) =>
      !task.completed &&
      task.dueDate &&
      parseDate(task.dueDate) < today,
  );

  // Incomplete tasks due between today and the end of this week.
  const pendingTasks = tasks.filter(
    (task) =>
      !task.completed &&
      task.dueDate &&
      parseDate(task.dueDate) >= today &&
      parseDate(task.dueDate) < weekEnd,
  );

  const totalTasks =
    completedTasks.length + pendingTasks.length + overdueTasks.length;

  const completedCount = completedTasks.length;
  const pendingCount = pendingTasks.length;
  const overdueCount = overdueTasks.length;

  const progress =
    totalTasks === 0
      ? 0
      : Math.round((completedCount / totalTasks) * 100);

  const gaugeAngle = (progress / 100) * 180;

  const gaugeStyle: ProgressStyle = {
    "--progress-angle": `${gaugeAngle}deg`,
  };

  return (
    <main className="breakdown-page">
      <h1 className="breakdown-page__title">Weekly Review</h1>

      <section className="breakdown-summary">
        <div className="breakdown-summary__heading">
          <div className="breakdown-summary__identity">
            <h2>Your Weekly Progress</h2>
            <p>
              Review your accomplishments and see what still needs attention.
            </p>
          </div>

          <span className="breakdown-status">
            {totalTasks === 0
              ? "No activity"
              : progress === 100
                ? "Completed"
                : "In progress"}
          </span>
        </div>

        <div className="breakdown-metrics">
          <div>
            <span>Week begins</span>
            <strong>{formatDate(weekStart)}</strong>
          </div>

          <div>
            <span>Week ends</span>
            <strong>{formatDate(addDays(weekEnd, -1))}</strong>
          </div>

          <div>
            <span>Total tasks</span>
            <strong>{totalTasks}</strong>
          </div>
        </div>

        <div className="breakdown-progress">
          <div
            aria-label={`${progress}% of weekly tasks completed`}
            className="breakdown-gauge"
            data-progress={progress}
            role="img"
            style={gaugeStyle}
          >
            <img
              alt=""
              className="breakdown-gauge__track"
              src="/assets/progress-track.svg"
            />

            <img
              alt=""
              className="breakdown-gauge__arc"
              src="/assets/progress-arc.svg"
            />

            <div className="breakdown-gauge__dynamic-arc" />

            <div className="breakdown-gauge__label">
              <strong>{progress}%</strong>
              <span>completed</span>
            </div>
          </div>

          <div className="breakdown-progress__details">
            <div className="breakdown-progress__copy">
              <h3>
                {completedCount} of {totalTasks} tasks completed
              </h3>

              <p>
                {totalTasks === 0
                  ? "Add tasks with due dates to start tracking your weekly progress."
                  : "Keep track of your progress and prioritize the tasks that still need attention."}
              </p>
            </div>

            <div className="breakdown-progress__stats">
              <div>
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </div>

              <div>
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </div>

              <div>
                <span>Overdue</span>
                <strong>{overdueCount}</strong>
              </div>
            </div>

            <div className="weekly-review-progress">
              <div className="weekly-review-progress__labels">
                <span>Weekly completion</span>
                <strong>{progress}%</strong>
              </div>

              <div
                aria-label={`${progress}% completed`}
                className="weekly-review-progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="weekly-review-progress__fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="weekly-review-grid">
        <TaskGroup
          title="Completed Tasks"
          count={completedCount}
          tasks={completedTasks}
          type="completed"
        />

        <TaskGroup
          title="Pending Tasks"
          count={pendingCount}
          tasks={pendingTasks}
          type="pending"
        />

        <TaskGroup
          title="Overdue Tasks"
          count={overdueCount}
          tasks={overdueTasks}
          type="overdue"
        />
      </div>
    </main>
  );
}

type TaskGroupProps = {
  title: string;
  count: number;
  tasks: Task[];
  type: "completed" | "pending" | "overdue";
};

function TaskGroup({ title, count, tasks, type }: TaskGroupProps) {
  return (
    <section className="breakdown-card weekly-review-column">
      <div className="breakdown-card__heading">
        <h2>{title}</h2>
        <p>{count} {count === 1 ? "task" : "tasks"}</p>
      </div>

      <div className="weekly-review-task-list">
        {tasks.length === 0 ? (
          <p className="weekly-review-empty">
            {type === "completed"
              ? "No completed tasks this week yet."
              : type === "pending"
                ? "No pending tasks for the rest of this week."
                : "No overdue tasks. You're all caught up!"}
          </p>
        ) : (
          tasks.map((task) => (
            <article className="weekly-review-task" key={task.id}>
              <div>
                <strong>{task.title}</strong>

                <span>
                  {type === "completed"
                    ? `Completed ${task.completedDate ? formatDate(parseDate(task.completedDate)) : "· Due this week"}`
                    : `Due ${task.dueDate ? formatDate(parseDate(task.dueDate)) : ""}`}
                </span>
              </div>

              <span className={`weekly-review-tag weekly-review-tag--${type}`}>
                {type === "completed"
                  ? "Done"
                  : type === "pending"
                    ? "Pending"
                    : "Overdue"}
              </span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default Breakdown;