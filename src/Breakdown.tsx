import { useState, type CSSProperties, type FormEvent } from "react";
import "./Breakdown.css";
import type { Goal, GoalChanges, Milestone, PlannerEvent, PlannerEventInput, StudyShortfall, Task } from "./api";
import { errorMessage } from "./http";
import { PRIORITY_LEVELS, describeUrgency, sortTasksByPriority, todayKey, type Priority } from "./taskPriority";

type BreakdownProps = {
  goals: Goal[];
  tasks: Task[];
  plannerEvents: PlannerEvent[];
  shortfalls: StudyShortfall[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  onChangePriority: (goalId: string, priority: Priority) => Promise<void>;
  onUpdateGoal: (goalId: string, changes: GoalChanges) => Promise<void>;
  onAddMilestone: (goalId: string, input: { title: string; dueDate?: string }) => Promise<void>;
  onUpdateMilestone: (
    goalId: string,
    milestoneId: string,
    changes: Partial<{ title: string; dueDate: string | null; completed: boolean }>,
  ) => Promise<void>;
  onDeleteMilestone: (goalId: string, milestoneId: string) => Promise<void>;
  onBlockMilestoneTime: (input: PlannerEventInput) => Promise<unknown>;
  onOpenTask: (taskId: string) => void;
  onOpenPlanner: () => void;
  onOpenStudySettings: () => void;
};

type ProgressStyle = CSSProperties & { "--progress-angle": string };

const tierLabel = { BIG: "Big goal", MEDIUM: "Medium goal", SMALL: "Small goal" } as const;
const sizeForPlanner = { BIG: "Big", MEDIUM: "Medium", SMALL: "Small" } as const;

function formatDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

function formatLongDate(dateKey: string | null) {
  if (!dateKey) return "Not set";
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatHours(startHour: number, duration: number) {
  const label = (hour: number) => {
    const h = hour % 24;
    return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
  };
  return `${label(startHour)}–${label(startHour + duration)}`;
}

function milestoneStatus(milestone: Milestone, today: string) {
  if (milestone.completedAt) return "Completed";
  if (milestone.dueDate && milestone.dueDate < today) return "Overdue";
  return "Upcoming";
}

function Breakdown({
  goals,
  tasks,
  plannerEvents,
  shortfalls,
  selectedGoalId,
  onSelectGoal,
  onChangePriority,
  onUpdateGoal,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onBlockMilestoneTime,
  onOpenTask,
  onOpenPlanner,
  onOpenStudySettings,
}: BreakdownProps) {
  const today = todayKey();
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [blockHour, setBlockHour] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const goal =
    goals.find((item) => item.id === selectedGoalId) ??
    goals.find((item) => item.size === "BIG" && item.status === "ACTIVE") ??
    goals[0] ??
    null;
  const parent = goal ? goals.find((item) => item.id === goal.parentGoalId) ?? null : null;
  const children = goal ? goals.filter((item) => item.parentGoalId === goal.id) : [];
  const grandchildren = goals.filter((item) => children.some((child) => child.id === item.parentGoalId));
  const milestones = goal?.milestones ?? [];
  const completedMilestones = milestones.filter((milestone) => milestone.completedAt).length;
  const nextMilestone = milestones
    .filter((milestone) => !milestone.completedAt)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0];
  const progress = goal ? (goal.status === "COMPLETED" ? 100 : goal.progress) : 0;

  const upcomingExams = sortTasksByPriority(
    tasks.filter((task) => task.isExam && !task.completed && (!task.dueDate || task.dueDate > today)),
    today,
  );

  async function run(action: () => Promise<unknown>, success?: string) {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await action();
      if (success) setStatus(success);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setSaving(false);
    }
  }

  async function addMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal) return;
    const title = milestoneTitle.trim();
    if (!title) {
      setError("Give the milestone a name.");
      return;
    }
    if (blockHour !== "" && !milestoneDate) {
      setError("Pick a date to block planner time for this milestone.");
      return;
    }
    await run(async () => {
      await onAddMilestone(goal.id, { title, dueDate: milestoneDate || undefined });
      if (blockHour !== "" && milestoneDate) {
        await onBlockMilestoneTime({
          title,
          category: "Focus",
          date: milestoneDate,
          startHour: Number(blockHour),
          duration: 1,
          description: `Milestone for ${goal.title}.`,
          status: "Not started",
          priority: goal.priority,
          taskType: "Task",
          goalSize: sizeForPlanner[goal.size],
          linkedEventId: null,
          notes: "",
          remindersPerDay: null,
        });
      }
      setMilestoneTitle("");
      setMilestoneDate("");
      setBlockHour("");
    }, blockHour !== "" ? `Added "${title}" and blocked time in your planner.` : `Added "${title}".`);
  }

  if (!goal) {
    return (
      <main className="breakdown-page">
        <header className="breakdown-page__header">
          <h1>Goal breakdown</h1>
        </header>
        <p className="breakdown-study__empty">No goals yet. Add a goal in the Goals view to break it down here.</p>
      </main>
    );
  }

  const goalOptions = (["BIG", "MEDIUM", "SMALL"] as const).map((size) => ({
    size,
    goals: goals.filter((item) => item.size === size),
  }));

  return (
    <main className="breakdown-page">
      <header className="breakdown-page__header">
        <h1>Goal breakdown</h1>
        <label className="breakdown-goal-picker">
          <span>Goal</span>
          <select onChange={(event) => onSelectGoal(event.target.value)} value={goal.id}>
            {goalOptions.map((group) =>
              group.goals.length === 0 ? null : (
                <optgroup key={group.size} label={`${tierLabel[group.size]}s`}>
                  {group.goals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
        </label>
      </header>

      {error && (
        <p className="breakdown-study__warning" role="alert">
          {error}
        </p>
      )}
      <p aria-live="polite" className="visually-hidden" role="status">
        {status}
      </p>

      <section className="breakdown-summary" aria-labelledby="breakdown-goal-title">
        <div className="breakdown-summary__heading">
          <div className="breakdown-summary__identity">
            <h2 id="breakdown-goal-title">{goal.title}</h2>
            <p>{goal.description || `${tierLabel[goal.size]}${parent ? ` · part of ${parent.title}` : ""}`}</p>
          </div>
          <div className="breakdown-summary__controls">
            <label className="breakdown-priority-control">
              <span>Priority</span>
              <select
                disabled={saving}
                onChange={(event) => void run(() => onChangePriority(goal.id, event.target.value as Priority), "Priority saved.")}
                value={goal.priority}
              >
                {PRIORITY_LEVELS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <span className="breakdown-status">
              {goal.status === "COMPLETED" ? "Completed" : progress === 0 ? "Not started" : "In progress"}
            </span>
          </div>
        </div>

        <div className="breakdown-metrics">
          <div>
            <span>Begin date</span>
            <strong>{formatLongDate(goal.startDate)}</strong>
          </div>
          <div>
            <span>Target end date</span>
            <strong>{formatLongDate(goal.targetDate)}</strong>
          </div>
          <div>
            <span>Current progress</span>
            <strong>{progress}% complete</strong>
          </div>
        </div>

        <div className="breakdown-progress">
          <div aria-label={`${progress}% of goal complete`} className="breakdown-gauge" data-progress={progress} role="img">
            <img alt="" className="breakdown-gauge__track" src="/assets/progress-track.svg" />
            <div className="breakdown-gauge__dynamic-arc" style={{ "--progress-angle": `${progress * 1.8}deg` } as ProgressStyle} />
            <div className="breakdown-gauge__label">
              <strong>{progress}%</strong>
              <span>of goal</span>
            </div>
          </div>

          <div className="breakdown-progress__details">
            <div className="breakdown-progress__copy">
              <h3>
                {completedMilestones} of {milestones.length} milestones complete
              </h3>
              <p>
                Progress counts this goal&apos;s milestones, the tasks linked to it and its smaller goals, so finishing
                small steps moves the big goal forward.
              </p>
            </div>

            <div className="breakdown-progress__stats">
              <div>
                <span>Completed</span>
                <strong>{completedMilestones}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{milestones.length - completedMilestones}</strong>
              </div>
              <div>
                <span>Next milestone</span>
                <strong>{nextMilestone ? (nextMilestone.dueDate ? formatDay(nextMilestone.dueDate) : "No date") : "—"}</strong>
              </div>
            </div>
            <button
              className="breakdown-complete-goal"
              disabled={saving}
              onClick={() =>
                void run(
                  () => onUpdateGoal(goal.id, { status: goal.status === "COMPLETED" ? "ACTIVE" : "COMPLETED" }),
                  goal.status === "COMPLETED" ? "Goal reopened." : "Goal completed. Nice work!",
                )
              }
              type="button"
            >
              {goal.status === "COMPLETED" ? "Reopen goal" : progress === 100 ? "Mark goal complete ✓" : "Mark goal complete"}
            </button>
          </div>
        </div>
      </section>

      <div className="breakdown-lower">
        <section className="breakdown-card" aria-labelledby="milestones-title">
          <div className="breakdown-card__heading">
            <h2 id="milestones-title">Milestones</h2>
            <p>Key steps in your goal, scheduled onto the days you&apos;ll do them.</p>
          </div>
          <div className="breakdown-milestones">
            {milestones.length === 0 && <p className="breakdown-study__empty">No milestones yet. Add the first step below.</p>}
            {milestones.map((milestone) => {
              const state = milestoneStatus(milestone, today);
              return (
                <article
                  className={`breakdown-milestone${milestone.completedAt ? " breakdown-milestone--completed" : ""}`}
                  key={milestone.id}
                >
                  <button
                    aria-label={`${milestone.completedAt ? "Mark incomplete" : "Complete"} ${milestone.title}`}
                    aria-pressed={Boolean(milestone.completedAt)}
                    className="breakdown-milestone__toggle"
                    disabled={saving}
                    onClick={() =>
                      void run(() => onUpdateMilestone(goal.id, milestone.id, { completed: !milestone.completedAt }))
                    }
                    type="button"
                  >
                    {milestone.completedAt && <img alt="" src="/assets/breakdown-check.svg" />}
                  </button>
                  <div className="breakdown-milestone__details">
                    <strong>{milestone.title}</strong>
                    <span className={state === "Overdue" ? "breakdown-milestone__overdue" : undefined}>
                      {state} ·{" "}
                      <label>
                        <span className="visually-hidden">Date for {milestone.title}</span>
                        <input
                          className="breakdown-milestone__date"
                          disabled={saving}
                          onChange={(event) =>
                            void run(() =>
                              onUpdateMilestone(goal.id, milestone.id, { dueDate: event.target.value || null }),
                            )
                          }
                          type="date"
                          value={milestone.dueDate ?? ""}
                        />
                      </label>
                    </span>
                  </div>
                  <button
                    aria-label={`Delete ${milestone.title}`}
                    className="breakdown-milestone__delete"
                    disabled={saving}
                    onClick={() => void run(() => onDeleteMilestone(goal.id, milestone.id), `Deleted "${milestone.title}".`)}
                    type="button"
                  >
                    ×
                  </button>
                </article>
              );
            })}
          </div>
          <form className="breakdown-add-milestone" onSubmit={(event) => void addMilestone(event)}>
            <label>
              <span>New milestone</span>
              <input
                maxLength={150}
                onChange={(event) => setMilestoneTitle(event.target.value)}
                placeholder="e.g. Finish resume draft"
                value={milestoneTitle}
              />
            </label>
            <label>
              <span>Date</span>
              <input onChange={(event) => setMilestoneDate(event.target.value)} type="date" value={milestoneDate} />
            </label>
            <label>
              <span>Block time in planner</span>
              <select onChange={(event) => setBlockHour(event.target.value)} value={blockHour}>
                <option value="">Don&apos;t block time</option>
                {Array.from({ length: 16 }, (_, index) => index + 7).map((hour) => (
                  <option key={hour} value={hour}>
                    {hour % 12 || 12}:00 {hour < 12 ? "AM" : "PM"}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={saving} type="submit">
              {saving ? "Saving…" : "Add milestone"}
            </button>
          </form>
        </section>

        <section className="breakdown-card breakdown-connected" aria-labelledby="connected-goals-title">
          <div className="breakdown-card__heading">
            <h2 id="connected-goals-title">Connected Goals</h2>
            <p>Goals above and below this one. Select one to see its breakdown.</p>
          </div>
          {!parent && children.length === 0 && (
            <p className="breakdown-study__empty">
              This goal isn&apos;t connected to others yet. Add smaller goals under it from the Goals view.
            </p>
          )}
          {parent && (
            <ConnectedGroup goals={[parent]} onSelect={onSelectGoal} title={`Part of (${tierLabel[parent.size].toLowerCase()})`} />
          )}
          {children.length > 0 && (
            <ConnectedGroup goals={children} onSelect={onSelectGoal} title={`${tierLabel[children[0].size]}s`} />
          )}
          {grandchildren.length > 0 && (
            <ConnectedGroup goals={grandchildren} onSelect={onSelectGoal} title={`${tierLabel[grandchildren[0].size]}s`} />
          )}
        </section>

        <section className="breakdown-card" aria-labelledby="goal-tasks-title">
          <div className="breakdown-card__heading">
            <h2 id="goal-tasks-title">Tasks in this goal</h2>
            <p>Individual tasks linked to {goal.title}. Open one to work on it.</p>
          </div>
          {goal.tasks.length === 0 ? (
            <p className="breakdown-study__empty">No tasks are linked to this goal yet.</p>
          ) : (
            <ul className="breakdown-goal-list">
              {goal.tasks.map((task) => (
                <li className="breakdown-goal-item" key={task.id}>
                  <span>
                    {task.completed ? "✓ " : ""}
                    {task.title}
                    {task.dueDate && ` · due ${formatDay(task.dueDate)}`}
                  </span>
                  <button className="breakdown-goal-priority" onClick={() => onOpenTask(task.id)} type="button">
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="breakdown-card breakdown-study" aria-labelledby="study-plan-title">
          <div className="breakdown-card__heading">
            <h2 id="study-plan-title">Exam study plan</h2>
            <p>Study sessions Kadence set aside before your upcoming exams.</p>
          </div>
          {upcomingExams.length === 0 ? (
            <p className="breakdown-study__empty">
              No upcoming exams. Mark a task as an exam in the To-do list or Priority setter and Kadence will schedule
              study time before it.
            </p>
          ) : (
            <ul className="breakdown-study__exams">
              {upcomingExams.map((exam) => {
                const sessions = plannerEvents
                  .filter((event) => event.sourceTaskId === exam.id && event.date >= today)
                  .sort((a, b) => (a.date === b.date ? a.startHour - b.startHour : a.date < b.date ? -1 : 1));
                const missing = shortfalls
                  .filter((shortfall) => shortfall.examId === exam.id)
                  .reduce((total, shortfall) => total + shortfall.missing, 0);
                return (
                  <li key={exam.id}>
                    <div className="breakdown-study__exam-heading">
                      <strong>{exam.title}</strong>
                      <span>
                        {exam.priority} priority
                        {exam.dueDate ? ` · ${describeUrgency({ ...exam, isExam: false }, today)}` : ""}
                      </span>
                    </div>
                    {!exam.dueDate ? (
                      <p className="breakdown-study__warning">Add the exam date in the To-do list to schedule study sessions.</p>
                    ) : sessions.length === 0 && missing === 0 ? (
                      <p className="breakdown-study__empty">No study days left before this exam.</p>
                    ) : (
                      <ol>
                        {sessions.map((session) => (
                          <li key={session.id}>
                            <span>{formatDay(session.date)}</span>
                            <span>{formatHours(session.startHour, session.duration)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {missing > 0 && (
                      <p className="breakdown-study__warning" role="status">
                        {missing} {missing === 1 ? "session" : "sessions"} didn&apos;t fit around your planner. Widen your
                        study hours or free up time.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="breakdown-study__actions">
            <button onClick={onOpenPlanner} type="button">
              View in planner
            </button>
            <button onClick={onOpenStudySettings} type="button">
              Study settings
            </button>
          </div>
        </section>

        <section className="breakdown-card">
          <h2>Goal Priorities</h2>
          <p>Change any goal&apos;s priority here; it updates everywhere right away.</p>
          {goals.length === 0 ? (
            <p>No goals have been added yet.</p>
          ) : (
            <div className="breakdown-goal-list">
              {goals.map((item) => (
                <label className="breakdown-goal-item" key={item.id}>
                  <span>{item.title}</span>
                  <select
                    aria-label={`Priority for ${item.title}`}
                    className="breakdown-goal-priority"
                    disabled={saving}
                    onChange={(event) =>
                      void run(() => onChangePriority(item.id, event.target.value as Priority), `Priority for ${item.title} saved.`)
                    }
                    value={item.priority}
                  >
                    {PRIORITY_LEVELS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ConnectedGroup({ title, goals, onSelect }: { title: string; goals: Goal[]; onSelect: (goalId: string) => void }) {
  return (
    <div className="breakdown-goal-group">
      <h3>{title}</h3>
      <div className="breakdown-goal-group__list">
        {goals.map((goal) => (
          <button className="breakdown-connected-goal" key={goal.id} onClick={() => onSelect(goal.id)} type="button">
            <h4>{goal.title}</h4>
            <p>
              {goal.status === "COMPLETED" ? "Completed" : `${goal.progress}% complete`}
              {goal.description ? ` · ${goal.description}` : ""}
            </p>
            <span aria-hidden="true" className="breakdown-connected-goal__track">
              <span style={{ width: `${goal.status === "COMPLETED" ? 100 : goal.progress}%` }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Breakdown;
