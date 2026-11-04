import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import "./Goals.css";

type GoalCategory = "Big goals" | "Medium goals" | "Small goals";
type GoalFilter = "All goals" | GoalCategory;

type Goal = {
  id: string;
  category: GoalCategory;
  title: string;
  progress: number;
  completed: boolean;
  detail: string;
  status?: "New goal";
  spotlight?: boolean;
};

const initialGoals: Goal[] = [
  {
    id: "pass-calculus",
    category: "Big goals",
    title: "Pass Calculus",
    progress: 60,
    completed: false,
    detail: "6 of 10 milestones completed",
  },
  {
    id: "internship",
    category: "Big goals",
    title: "Get an internship",
    progress: 0,
    completed: false,
    detail: "New goal · 0 of 3 steps completed",
    status: "New goal",
    spotlight: true,
  },
  {
    id: "prepare-resume",
    category: "Medium goals",
    title: "Prepare resume",
    progress: 20,
    completed: false,
    detail: "Linked to: Get an internship",
  },
  {
    id: "apply-companies",
    category: "Medium goals",
    title: "Apply to companies",
    progress: 0,
    completed: false,
    detail: "Linked to: Get an internship",
  },
  {
    id: "build-portfolio",
    category: "Medium goals",
    title: "Build portfolio",
    progress: 40,
    completed: false,
    detail: "2 of 5 tasks completed",
  },
  {
    id: "update-linkedin",
    category: "Small goals",
    title: "Update LinkedIn",
    progress: 0,
    completed: true,
    detail: "Linked to: Prepare resume",
  },
  {
    id: "interview-questions",
    category: "Small goals",
    title: "Practice interview questions",
    progress: 35,
    completed: false,
    detail: "Linked to: Get an internship",
  },
  {
    id: "review-postings",
    category: "Small goals",
    title: "Review job postings",
    progress: 0,
    completed: false,
    detail: "Due this week",
  },
];

const categories: {
  label: GoalCategory;
  description: string;
  className: string;
}[] = [
  {
    label: "Big goals",
    description: "The bigger picture",
    className: "big",
  },
  {
    label: "Medium goals",
    description: "Make progress this month",
    className: "medium",
  },
  {
    label: "Small goals",
    description: "One step at a time",
    className: "small",
  },
];

type GoalsProps = {
  activeView: string | null;
  onOpenBreakdown: () => void;
  onOpenSettings: () => void;
  onSelectView: (view: string | null) => void;
};

function Goals({
  activeView,
  onOpenBreakdown,
  onOpenSettings,
  onSelectView,
}: GoalsProps) {
  const [goals, setGoals] = useState(initialGoals);
  const [filter, setFilter] = useState<GoalFilter>("All goals");
  const [filterOpen, setFilterOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalCategory, setNewGoalCategory] =
    useState<GoalCategory>("Big goals");
  const addGoalDialog = useRef<HTMLDialogElement>(null);

  const displayedCategories =
    filter === "All goals"
      ? categories
      : categories.filter((category) => category.label === filter);
  const activeGoalCount = goals.length;

  useEffect(() => {
    const dialog = addGoalDialog.current;
    if (addGoalOpen && dialog && !dialog.open) dialog.showModal();
    else if (!addGoalOpen && dialog?.open) dialog.close();
  }, [addGoalOpen]);

  function toggleGoal(goalId: string) {
    setGoals((currentGoals) =>
      currentGoals.map((goal) => {
        if (goal.id !== goalId) return goal;
        return { ...goal, completed: !goal.completed };
      }),
    );
  }

  function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newGoalTitle.trim();
    if (!title) return;

    const goal: Goal = {
      id: `goal-${crypto.randomUUID()}`,
      category: newGoalCategory,
      title,
      progress: 0,
      completed: false,
      detail: "New goal · 0 of 0 steps completed",
      status: "New goal",
    };
    setGoals((currentGoals) => [...currentGoals, goal]);
    setFilter("All goals");
    setNewGoalTitle("");
    setNewGoalCategory("Big goals");
    setAddGoalOpen(false);
  }

  function closeDialogOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) setAddGoalOpen(false);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setAddGoalOpen(false);
    }
  }

  return (
    <section aria-label="Goals workspace" className="goals-workspace">
      <aside aria-label="Workspace navigation" className="goals-sidebar">
        <p className="goals-sidebar__eyebrow">Workspace</p>
        <nav aria-label="Goals workspace" className="goals-sidebar__nav">
          <button
            aria-current={activeView === null ? "page" : undefined}
            className={`goals-sidebar__item${activeView === null ? " goals-sidebar__item--active" : ""}`}
            onClick={() => onSelectView(null)}
            type="button"
          >
            <span aria-hidden="true" className="goals-sidebar__icon">⌂</span>
            <span>Home</span>
          </button>
          <button
            aria-current={activeView === "Goals" ? "page" : undefined}
            className={`goals-sidebar__item${activeView === "Goals" ? " goals-sidebar__item--active" : ""}`}
            onClick={() => onSelectView("Goals")}
            type="button"
          >
            <img alt="" className="goals-sidebar__image-icon" src="/assets/tab-goals-todo.svg" />
            <span>Goals</span>
          </button>
          <button
            className="goals-sidebar__item"
            onClick={() => onSelectView("Calendar")}
            type="button"
          >
            <img alt="" className="goals-sidebar__image-icon" src="/assets/tab-calendar.svg" />
            <span>Calendar</span>
          </button>
          <button
            className="goals-sidebar__item"
            onClick={onOpenSettings}
            type="button"
          >
            <img alt="" className="goals-sidebar__image-icon" src="/assets/settings.svg" />
            <span>Settings</span>
          </button>
        </nav>

        <section aria-label="Your progress" className="goals-sidebar__progress">
          <h2>Your progress</h2>
          <div className="goals-sidebar__count">
            <strong>{activeGoalCount}</strong>
            <span>active goals</span>
          </div>
          <div
            aria-label="62% progress this month"
            className="goals-sidebar__progress-track"
            role="progressbar"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={62}
          >
            <span />
          </div>
          <p>62% progress this month</p>
        </section>

        <aside aria-label="October intention" className="goals-intention">
          <h2><span aria-hidden="true">✧</span> October intention</h2>
          <p>Make space for what matters.</p>
          <p>Small steps add up.</p>
        </aside>
      </aside>

      <section aria-label="My goals" className="goals-main">
        <header className="goals-main__header">
          <div>
            <h1>My goals</h1>
            <p>A little progress, every day.</p>
          </div>
          <div className="goals-main__actions">
            <div className="goals-filter">
              <button
                aria-expanded={filterOpen}
                aria-haspopup="listbox"
                className="goals-filter__trigger"
                onClick={() => setFilterOpen((open) => !open)}
                type="button"
              >
                <span aria-hidden="true">▾</span> {filter}
              </button>
              {filterOpen && (
                <div aria-label="Filter goals" className="goals-filter__menu" role="listbox">
                  {(["All goals", ...categories.map(({ label }) => label)] as GoalFilter[]).map(
                    (option) => (
                      <button
                        aria-selected={filter === option}
                        className={filter === option ? "goals-filter__option goals-filter__option--selected" : "goals-filter__option"}
                        key={option}
                        onClick={() => {
                          setFilter(option);
                          setFilterOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        {option}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
            <button
              className="goals-add-button"
              onClick={() => setAddGoalOpen(true)}
              type="button"
            >
              <span aria-hidden="true">＋</span> Add goal
            </button>
          </div>
        </header>

        <div className="goals-banner">
          <span aria-hidden="true">✦</span>
          <p>Keep your big goals in view, and build momentum one step at a time.</p>
        </div>

        <div className={`goals-board${filter === "All goals" ? "" : " goals-board--filtered"}`}>
          {displayedCategories.map((category) => {
            const categoryGoals = goals.filter((goal) => goal.category === category.label);
            return (
              <section
                aria-labelledby={`goals-category-${category.className}`}
                className={`goals-column goals-column--${category.className}`}
                key={category.label}
              >
                <header className="goals-column__heading">
                  <div>
                    <h2 id={`goals-category-${category.className}`}>{category.label}</h2>
                    <p>{category.description}</p>
                  </div>
                  <span className="goals-column__count">
                    {String(categoryGoals.length).padStart(2, "0")}
                  </span>
                </header>

                <div className="goals-column__list">
                  {categoryGoals.map((goal) => (
                    <GoalCard
                      goal={goal}
                      key={goal.id}
                      onComplete={() => toggleGoal(goal.id)}
                    />
                  ))}
                  {categoryGoals.some((goal) => goal.spotlight) && (
                    <GoalSpotlight onOpenBreakdown={onOpenBreakdown} />
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="goals-footer">
          <div className="goals-footer__legend">
            <span><i className="goals-footer__dot goals-footer__dot--linked" />Linked to a goal</span>
            <span><i className="goals-footer__dot goals-footer__dot--individual" />Individual tasks</span>
          </div>
          <span>{categories.length} goal categories · {activeGoalCount} active goals</span>
        </footer>
      </section>

      {addGoalOpen && (
        <dialog
          aria-labelledby="add-goal-title"
          className="goals-dialog"
          onClick={closeDialogOnBackdrop}
          onKeyDown={handleDialogKeyDown}
          onCancel={(event) => {
            event.preventDefault();
            setAddGoalOpen(false);
          }}
          ref={addGoalDialog}
        >
          <form className="goals-dialog__form" onSubmit={addGoal}>
            <div className="goals-dialog__heading">
              <div>
                <h2 id="add-goal-title">Add a goal</h2>
                <p>Choose a category and give your goal a name.</p>
              </div>
              <button
                aria-label="Close dialog"
                className="goals-dialog__close"
                onClick={() => setAddGoalOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <label>
              Goal name
              <input
                autoFocus
                onChange={(event) => setNewGoalTitle(event.target.value)}
                placeholder="e.g. Learn a new skill"
                required
                value={newGoalTitle}
              />
            </label>
            <label>
              Goal category
              <select
                onChange={(event) =>
                  setNewGoalCategory(event.target.value as GoalCategory)
                }
                value={newGoalCategory}
              >
                {categories.map(({ label }) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </label>
            <div className="goals-dialog__actions">
              <button
                className="goals-dialog__cancel"
                onClick={() => setAddGoalOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="goals-add-button" type="submit">Add goal</button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}

function GoalCard({
  goal,
  onComplete,
}: {
  goal: Goal;
  onComplete: () => void;
}) {
  const progress = goal.completed ? 100 : goal.progress;
  const progressAsset = `/assets/goal-progress-${progress}.svg`;

  return (
    <article className="goal-card">
      <button
        aria-label={`${goal.completed ? "Mark" : "Complete"} ${goal.title}${goal.completed ? " as incomplete" : ""}`}
        aria-pressed={goal.completed}
        className="goal-card__complete"
        onClick={onComplete}
        type="button"
      >
        <img
          alt=""
          src={
            goal.completed
                ? "/assets/goal-checkbox-complete.svg"
                : "/assets/goal-checkbox.svg"
            }
        />
        {goal.completed && <span aria-hidden="true">✓</span>}
      </button>
      <div className="goal-card__body">
        <h3>{goal.title}</h3>
        <p>{goal.detail}</p>
        <div
            aria-label={`${progress}% complete`}
          className="goal-card__progress"
          role="progressbar"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
        >
          <img alt="" src="/assets/goal-progress-track.svg" />
          {progress > 0 && (
            <img
              alt=""
              className="goal-card__progress-fill"
              src={progressAsset}
            />
          )}
          <span>{progress}%</span>
        </div>
        {goal.status && !goal.completed && (
          <span className="goal-card__status">{goal.status}</span>
        )}
      </div>

    </article>
  );
}

function GoalSpotlight({ onOpenBreakdown }: { onOpenBreakdown: () => void }) {
  return (
    <aside aria-label="Goal spotlight" className="goal-spotlight">
      <p>↗ Goal spotlight</p>
      <strong>Get an internship</strong>
      <span>3 linked steps across your goal board</span>
      <button onClick={onOpenBreakdown} type="button">
        View breakdown
      </button>
    </aside>
  );
}

export default Goals;
