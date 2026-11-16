import { useState, type CSSProperties } from "react";
import "./Breakdown.css";
import type { Task } from "./TodoList";
import type { Goal } from "./Goals";
import type { StudyPlan } from "./studySessions";
import { describeUrgency, sortTasksByPriority, todayKey } from "./taskPriority";

type BreakdownProps = {
  tasks: Task[];
  goals: Goal[];
  studyPlan: StudyPlan;
  onOpenPlanner: () => void;
  onOpenStudySettings: () => void;
};

function formatDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

function formatHours(startHour: number, duration: number) {
  const label = (hour: number) => {
    const h = hour % 24;
    return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
  };
  return `${label(startHour)}–${label(startHour + duration)}`;
}

type ProgressStyle = CSSProperties & {
  "--progress-angle": string;
};

type Milestone = {
  id: string;
  title: string;
  completed: boolean;
  date: string;
};

const initialMilestones: Milestone[] = [
  { id: "launch-scope", title: "Define launch scope", completed: true, date: "September 12" },
  { id: "homepage-copy", title: "Write homepage copy", completed: true, date: "September 18" },
  { id: "about-page", title: "Complete about page draft", completed: true, date: "September 22" },
  { id: "content-review", title: "Finalize content review", completed: true, date: "September 28" },
  { id: "design-system", title: "Approve design system", completed: true, date: "October 2" },
  { id: "website-build", title: "Build and QA the site", completed: false, date: "October 27" },
  { id: "launch-prep", title: "Prepare launch materials", completed: false, date: "November 8" },
  { id: "website-launch", title: "Launch the new website", completed: false, date: "November 22" },
];

const connectedGoals = [
  {
    category: "Medium goals",
    title: "Finalize content and copy",
    description: "Complete homepage, about page, and supporting launch copy.",
  },
  {
    category: "Medium goals",
    title: "Complete design review",
    description: "Approve the design system, templates, and final visual direction.",
  },
  {
    category: "Medium goals",
    title: "Build and QA the site",
    description: "Complete the website build, QA checklist, and launch preparation.",
  },
];

function Breakdown({ tasks, goals, studyPlan, onOpenPlanner, onOpenStudySettings }: BreakdownProps) {
  const today = todayKey();
  const upcomingExams = sortTasksByPriority(
    tasks.filter((task) => task.isExam && !task.completed && (!task.dueDate || task.dueDate > today)),
    today,
  );
  const [milestones, setMilestones] = useState(initialMilestones);
  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const progress = Math.round((completedCount / milestones.length) * 100);
  const nextMilestone = milestones.find((milestone) => !milestone.completed);

  function toggleMilestone(id: string) {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.id === id
          ? { ...milestone, completed: !milestone.completed }
          : milestone,
      ),
    );
  }

  return (
    <main className="breakdown-page">
      <header className="breakdown-page__header">
        <h1>Goal breakdown</h1>
      </header>

      <section className="breakdown-summary" aria-labelledby="breakdown-goal-title">
        <div className="breakdown-summary__heading">
          <div className="breakdown-summary__identity">
            <h2 id="breakdown-goal-title">Launch the new website</h2>
            <p>Plan, design, and implement the webpage.</p>
          </div>
          <span className="breakdown-status">In progress</span>
        </div>

        <div className="breakdown-metrics">
          <div>
            <span>Begin date</span>
            <strong>September 12, 2026</strong>
          </div>
          <div>
            <span>Target end date</span>
            <strong>November 22, 2026</strong>
          </div>
          <div>
            <span>Current progress</span>
            <strong>{progress}% complete</strong>
          </div>
        </div>

        <div className="breakdown-progress">
          <div
            aria-label={`${progress}% of goal complete`}
            className="breakdown-gauge"
            data-progress={progress}
            role="img"
          >
            <img alt="" className="breakdown-gauge__track" src="/assets/progress-track.svg" />
            <div
              className="breakdown-gauge__dynamic-arc"
              style={
                {
                  "--progress-angle": `${progress * 1.8}deg`,
                } as ProgressStyle
              }
            />
            <div className="breakdown-gauge__label">
              <strong>{progress}%</strong>
              <span>of goal</span>
            </div>
          </div>

          <div className="breakdown-progress__details">
            <div className="breakdown-progress__copy">
              <h3>{completedCount} of {milestones.length} milestones complete</h3>
              <p>
                The strongest momentum is in content and design review. The remaining work is
                concentrated in build, QA, and launch preparation.
              </p>
            </div>

            <div className="breakdown-progress__stats">
              <div>
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{milestones.length - completedCount}</strong>
              </div>
              <div>
                <span>Next milestone</span>
                <strong>{nextMilestone?.date ?? "Complete"}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="breakdown-lower">
        <section className="breakdown-card" aria-labelledby="milestones-title">
          <div className="breakdown-card__heading">
            <h2 id="milestones-title">Milestones</h2>
            <p>Key steps in your goal that indicate progression.</p>
          </div>
          <div className="breakdown-milestones">
            {milestones.map((milestone) => (
              <article
                className={`breakdown-milestone${milestone.completed ? " breakdown-milestone--completed" : ""}`}
                key={milestone.id}
              >
                <button
                  aria-label={`${milestone.completed ? "Mark" : "Complete"} ${milestone.title}`}
                  aria-pressed={milestone.completed}
                  className="breakdown-milestone__toggle"
                  onClick={() => toggleMilestone(milestone.id)}
                  type="button"
                >
                  {milestone.completed && <img alt="" src="/assets/breakdown-check.svg" />}
                </button>
                <div className="breakdown-milestone__details">
                  <strong>{milestone.title}</strong>
                  <span>{milestone.completed ? "Completed" : "Upcoming"} · {milestone.date}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="breakdown-card breakdown-connected" aria-labelledby="connected-goals-title">
          <div className="breakdown-card__heading">
            <h2 id="connected-goals-title">Connected Goals</h2>
            <p>Medium and small goals connected to the current goal.</p>
          </div>
          <div className="breakdown-goal-group">
            <h3>Medium goals</h3>
            <div className="breakdown-goal-group__list">
              {connectedGoals.map((goal) => (
                <article className="breakdown-connected-goal" key={goal.title}>
                  <h4>{goal.title}</h4>
                  <p>{goal.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="breakdown-card breakdown-study" aria-labelledby="study-plan-title">
          <div className="breakdown-card__heading">
            <h2 id="study-plan-title">Exam study plan</h2>
            <p>Study sessions Kadence set aside before your upcoming exams.</p>
          </div>
          {upcomingExams.length === 0 ? (
            <p className="breakdown-study__empty">
              No upcoming exams. Mark a task as an exam in the To-do list or Priority setter and
              Kadence will schedule study time before it.
            </p>
          ) : (
            <ul className="breakdown-study__exams">
              {upcomingExams.map((exam) => {
                const sessions = studyPlan.sessions.filter((session) => session.examId === exam.id);
                const missing = studyPlan.shortfalls
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
                      <p className="breakdown-study__warning">
                        Add the exam date in the To-do list to schedule study sessions.
                      </p>
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
                        {missing} {missing === 1 ? "session" : "sessions"} didn&apos;t fit around
                        your planner. Widen your study hours or free up time.
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
          <p>Review the priorities assigned to your current goals.</p>

          {goals.length === 0 ? (
            <p>No goals have been added yet.</p>
          ) : (
            <div className="breakdown-goal-list">
              {goals.map((goal) => (
                <div className="breakdown-goal-item" key={goal.id}>
                  <span>{goal.title}</span>
                  <span className="breakdown-goal-priority">
                    {goal.priority ?? "None"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default Breakdown;
