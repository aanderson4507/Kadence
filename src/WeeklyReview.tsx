import { useCallback, useEffect, useState } from "react";
import "./WeeklyReview.css";
import { fetchWeeklyReview, saveWeeklyReflection, type Task, type WeeklyReview as Review } from "./api";
import { errorMessage } from "./http";
import { addDaysToKey } from "./taskPriority";

// User story 1.4 (issue #5): what I finished and what is still left this week. Every number is
// computed by the server from saved tasks, goals, milestones and planner time.

type WeeklyReviewProps = {
  userId: string;
  /** Changes whenever tasks change, so the review refreshes after edits elsewhere. */
  dataVersion: unknown;
  onOpenTask: (taskId: string) => void;
};

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", options);
}

function WeeklyReview({ userId, dataVersion, onOpenTask }: WeeklyReviewProps) {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const [review, setReview] = useState<Review | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchWeeklyReview(userId, week);
      setReview(next);
      setReflection(next.reflection);
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [userId, week]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  async function saveReflection() {
    if (!review) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const saved = await saveWeeklyReflection(userId, review.weekStart, reflection.trim());
      setReview(saved);
      setSaveStatus({ kind: "success", text: "Reflection saved." });
    } catch (error) {
      setSaveStatus({ kind: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  if (!review) {
    return (
      <section aria-label="Weekly review" className="weekly-review">
        <h1>Weekly review</h1>
        {loadError ? (
          <div role="alert">
            <p>{loadError}</p>
            <button className="weekly-review__button" onClick={() => void load()} type="button">
              Try again
            </button>
          </div>
        ) : (
          <p>Loading your week…</p>
        )}
      </section>
    );
  }

  const items = new Set(review.preferences.summaryItems);
  const total = review.completed.length + review.pending.length + review.overdue.length;
  const maxPerDay = Math.max(1, ...review.days.map((day) => Math.max(day.completed, day.due)));
  const stats = [
    { key: "TASKS_COMPLETED", label: "Tasks completed", value: `${review.completed.length}`, note: `of ${total} this week` },
    { key: "COMPLETION_RATE", label: "Completion rate", value: `${review.completionRate}%`, note: "completed vs. due" },
    { key: "GOALS_COMPLETED", label: "Goals completed", value: `${review.goalsCompleted.length}`, note: review.goalsCompleted.map((goal) => goal.title).join(", ") || "none yet" },
    { key: "MILESTONES_REACHED", label: "Milestones reached", value: `${review.milestonesReached.length}`, note: review.milestonesReached.map((item) => item.title).join(", ") || "none yet" },
    { key: "TIME_SPENT", label: "Time spent", value: `${review.hoursSpent}h`, note: "planner blocks marked done" },
  ].filter((stat) => items.has(stat.key) || stat.key === "TASKS_COMPLETED");

  return (
    <section aria-label="Weekly review" className="weekly-review">
      <header className="weekly-review__header">
        <div>
          <h1>Weekly review</h1>
          <p>
            {formatDate(review.weekStart, { month: "long", day: "numeric" })} – {formatDate(review.weekEnd, { month: "long", day: "numeric" })}
            {review.isCurrentWeek ? " · this week" : ""}
          </p>
        </div>
        <div className="weekly-review__nav">
          <button aria-label="Previous week" onClick={() => setWeek(addDaysToKey(review.weekStart, -7))} type="button">
            ‹
          </button>
          <button disabled={review.isCurrentWeek} onClick={() => setWeek(undefined)} type="button">
            This week
          </button>
          <button aria-label="Next week" onClick={() => setWeek(addDaysToKey(review.weekStart, 7))} type="button">
            ›
          </button>
        </div>
      </header>

      {loadError && (
        <p className="weekly-review__error" role="alert">
          {loadError}
        </p>
      )}

      <div className="weekly-review__stats">
        {stats.map((stat) => (
          <div className="weekly-review__stat" key={stat.key}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
          </div>
        ))}
      </div>

      <div
        aria-label={`${review.completionRate}% of this week's tasks completed`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={review.completionRate}
        className="weekly-review__progress"
        role="progressbar"
      >
        <span style={{ width: `${review.completionRate}%` }} />
      </div>

      {review.preferences.visualization === "CHARTS" && (
        <figure className="weekly-review__chart">
          <figcaption>Tasks completed each day</figcaption>
          <div className="weekly-review__bars" aria-hidden="true">
            {review.days.map((day) => (
              <div
                className="weekly-review__bar"
                key={day.date}
                title={`${formatDate(day.date, { weekday: "long" })}: ${day.completed} completed, ${day.due} due`}
              >
                <span className="weekly-review__bar-track" style={{ height: `${(day.due / maxPerDay) * 100}%` }} />
                <span className="weekly-review__bar-fill" style={{ height: `${(day.completed / maxPerDay) * 100}%` }} />
                <small>{day.completed > 0 ? day.completed : ""}</small>
                <span className="weekly-review__bar-label">{formatDate(day.date, { weekday: "short" })}</span>
              </div>
            ))}
          </div>
          <p className="weekly-review__chart-note">Bars show tasks completed; the faint column behind each bar shows tasks due that day.</p>
          <table className="visually-hidden">
            <caption>Tasks completed and due each day</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Completed</th>
                <th scope="col">Due</th>
              </tr>
            </thead>
            <tbody>
              {review.days.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{formatDate(day.date, { weekday: "long" })}</th>
                  <td>{day.completed}</td>
                  <td>{day.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}

      <div className="weekly-review__lists">
        <TaskGroup emptyText="Nothing finished yet this week." onOpenTask={onOpenTask} tasks={review.completed} title="Completed" />
        <TaskGroup emptyText="Nothing else is due this week." onOpenTask={onOpenTask} tasks={review.pending} title="Still to do" />
        <TaskGroup emptyText="Nothing overdue. Nice." onOpenTask={onOpenTask} tasks={review.overdue} title="Overdue" tone="warning" />
      </div>

      {review.preferences.reflectionQuestions && (
        <section className="weekly-review__reflection" aria-labelledby="weekly-reflection-title">
          <h2 id="weekly-reflection-title">Reflect on your week</h2>
          <label>
            <span>What went well, and what will you change next week?</span>
            <textarea
              maxLength={5000}
              onChange={(event) => {
                setReflection(event.target.value);
                setSaveStatus(null);
              }}
              rows={4}
              value={reflection}
            />
          </label>
          <div className="weekly-review__reflection-actions">
            <p
              className={saveStatus?.kind === "error" ? "weekly-review__error" : undefined}
              role={saveStatus?.kind === "error" ? "alert" : "status"}
            >
              {saveStatus?.text ??
                (review.reviewedAt ? `Last reviewed ${new Date(review.reviewedAt).toLocaleString()}` : "Not reviewed yet.")}
            </p>
            <button
              aria-busy={saving}
              className="weekly-review__button"
              disabled={saving || reflection.trim() === review.reflection}
              onClick={() => void saveReflection()}
              type="button"
            >
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

function TaskGroup({
  title,
  tasks,
  emptyText,
  tone,
  onOpenTask,
}: {
  title: string;
  tasks: Task[];
  emptyText: string;
  tone?: "warning";
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <section className={`weekly-review__group${tone ? ` weekly-review__group--${tone}` : ""}`}>
      <h2>
        {title} <span>{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <button onClick={() => onOpenTask(task.id)} type="button">
                <strong>{task.title}</strong>
                <span>
                  {task.priority}
                  {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}
                  {task.completedDate ? ` · done ${formatDate(task.completedDate)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default WeeklyReview;
