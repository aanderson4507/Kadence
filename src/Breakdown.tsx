import { useState, type CSSProperties } from "react";
import "./Breakdown.css";

type Milestone = {
  id: string;
  title: string;
  dueDate: string;
  completedDate?: string;
  completed: boolean;
};

type ProgressStyle = CSSProperties & {
  "--progress-angle": string;
};

const initialMilestones: Milestone[] = [
  {
    id: "launch-scope",
    title: "Define launch scope",
    dueDate: "September 12",
    completedDate: "September 12",
    completed: true,
  },
  {
    id: "homepage-copy",
    title: "Write homepage copy",
    dueDate: "September 18",
    completedDate: "September 18",
    completed: true,
  },
  {
    id: "about-page",
    title: "Complete about page draft",
    dueDate: "September 22",
    completedDate: "September 22",
    completed: true,
  },
  {
    id: "content-review",
    title: "Finalize content review",
    dueDate: "September 28",
    completedDate: "September 28",
    completed: true,
  },
  {
    id: "design-system",
    title: "Approve design system",
    dueDate: "October 2",
    completedDate: "October 2",
    completed: true,
  },
  {
    id: "website-build",
    title: "Start website build",
    dueDate: "October 5",
    completedDate: "October 5",
    completed: true,
  },
  {
    id: "qa-checklist",
    title: "Complete QA checklist",
    dueDate: "October 27",
    completed: false,
  },
  {
    id: "launch-assets",
    title: "Prepare launch assets",
    dueDate: "November 1",
    completed: false,
  },
  {
    id: "publish-launch",
    title: "Publish and announce",
    dueDate: "November 15",
    completed: false,
  },
  {
    id: "launch-review",
    title: "Review launch results",
    dueDate: "November 22",
    completed: false,
  },
];

const mediumGoals = [
  {
    title: "Finalize content and copy",
    description: "Complete homepage, about page, and supporting launch copy.",
  },
  {
    title: "Complete design review",
    description: "Approve the design system, templates, and final visual direction.",
  },
  {
    title: "Build and QA the site",
    description: "Complete the website build, QA checklist, and launch preparation.",
  },
];

const smallGoals = [
  {
    title: "Write homepage copy",
    description: "Draft the hero, value proposition, and key feature sections.",
  },
  {
    title: "Complete QA checklist",
    description: "Review accessibility, responsive behavior, and launch readiness.",
  },
  {
    title: "Prepare launch assets",
    description: "Create social posts, email copy, and announcement materials.",
  },
];

function Breakdown() {
  const [milestones, setMilestones] = useState(initialMilestones);
  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const remainingCount = milestones.length - completedCount;
  const progress = Math.round((completedCount / milestones.length) * 100);
  const nextMilestone = milestones.find((milestone) => !milestone.completed);
  // The supplied 60% arc spans 150 degrees; map the remaining progress to the final 30.
  const gaugeAngle =
    progress <= 60 ? progress * 2.5 : 150 + ((progress - 60) * 0.75);
  const nextMilestoneDate = nextMilestone?.dueDate
    .replace("September", "Sep")
    .replace("October", "Oct")
    .replace("November", "Nov");
  const gaugeStyle: ProgressStyle = {
    "--progress-angle": `${gaugeAngle}deg`,
  };

  function toggleMilestone(id: string) {
    setMilestones((currentMilestones) =>
      currentMilestones.map((milestone) =>
        milestone.id === id
          ? { ...milestone, completed: !milestone.completed }
          : milestone,
      ),
    );
  }

  return (
    <main className="breakdown-page">
      <h1 className="breakdown-page__title">Goal breakdown</h1>

      <section aria-labelledby="breakdown-goal-title" className="breakdown-summary">
        <div className="breakdown-summary__heading">
          <div className="breakdown-summary__identity">
            <h2 id="breakdown-goal-title">Launch the new website</h2>
            <p>Plan, design, and implement the webpage.</p>
          </div>
          <span className="breakdown-status">
            {remainingCount === 0 ? "Completed" : "In progress"}
          </span>
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
            <div aria-hidden="true" className="breakdown-gauge__dynamic-arc" />
            <div className="breakdown-gauge__label">
              <strong>{progress}%</strong>
              <span>of goal</span>
            </div>
          </div>

          <div className="breakdown-progress__details">
            <div className="breakdown-progress__copy">
              <h3>{completedCount} of {milestones.length} milestones complete</h3>
              <p>
                The strongest momentum is in content and design review. The
                remaining work is concentrated in build, QA, and launch preparation.
              </p>
            </div>
            <div className="breakdown-progress__stats">
              <div>
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{remainingCount}</strong>
              </div>
              <div>
                <span>Next milestone</span>
                <strong>{nextMilestoneDate ?? "Done"}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="breakdown-lower">
        <section aria-labelledby="milestones-title" className="breakdown-card">
          <div className="breakdown-card__heading">
            <h2 id="milestones-title">Milestones</h2>
            <p>Key steps in your goal that indicate progression.</p>
          </div>
          <div className="breakdown-milestones">
            {milestones.map((milestone) => (
              <div
                className={`breakdown-milestone${milestone.completed ? " breakdown-milestone--completed" : ""}`}
                key={milestone.id}
              >
                <button
                  aria-label={`${milestone.completed ? "Mark" : "Complete"} ${milestone.title}${milestone.completed ? " as incomplete" : ""}`}
                  aria-pressed={milestone.completed}
                  className="breakdown-milestone__toggle"
                  onClick={() => toggleMilestone(milestone.id)}
                  type="button"
                >
                  {milestone.completed && (
                    <img alt="" src="/assets/breakdown-check.svg" />
                  )}
                </button>
                <div className="breakdown-milestone__details">
                  <strong>{milestone.title}</strong>
                  <span>
                    {milestone.completed
                      ? `Completed · ${milestone.completedDate ?? milestone.dueDate}`
                      : `Due ${milestone.dueDate}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside aria-labelledby="connected-goals-title" className="breakdown-card breakdown-connected">
          <div className="breakdown-card__heading">
            <h2 id="connected-goals-title">Connected Goals</h2>
            <p>Medium and small goals connected to the current goal.</p>
          </div>
          <GoalGroup label="Medium goals" goals={mediumGoals} />
          <GoalGroup label="Small goals" goals={smallGoals} />
        </aside>
      </div>
    </main>
  );
}

type GoalGroupProps = {
  label: string;
  goals: { title: string; description: string }[];
};

function GoalGroup({ label, goals }: GoalGroupProps) {
  return (
    <section aria-label={label} className="breakdown-goal-group">
      <h3>{label}</h3>
      <div className="breakdown-goal-group__list">
        {goals.map((goal) => (
          <article className="breakdown-connected-goal" key={goal.title}>
            <h4>{goal.title}</h4>
            <p>{goal.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Breakdown;
