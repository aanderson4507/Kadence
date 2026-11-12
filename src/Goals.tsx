import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { Priority } from "./TodoList";
import "./Goals.css";

type GoalCategory = "Big goals" | "Medium goals" | "Small goals";
type GoalFilter = "All goals" | GoalCategory;
type MediumGoalDraft = { id: string; title: string };

export type Goal = {
  id: string;
  category: GoalCategory;
  title: string;
  progress: number;
  completed: boolean;
  detail: string;
  status?: "New goal";
  spotlight?: boolean;
  targetDate?: string;
  priority?: Priority;
  description?: string;
  parentId?: string;
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
  onDataChange: (goals: Goal[]) => void;
  onOpenBreakdown: () => void;
  onOpenSettings: () => void;
  onSelectView: (view: string | null) => void;
};

function Goals({
  activeView,
  onDataChange,
  onOpenBreakdown,
  onOpenSettings,
  onSelectView,
}: GoalsProps) {
  const [goals, setGoals] = useState(initialGoals);
  const [filter, setFilter] = useState<GoalFilter>("All goals");
  const [filterOpen, setFilterOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("Get an internship");
  const [newGoalCategory, setNewGoalCategory] =
    useState<GoalCategory>("Big goals");
  const [newGoalTargetDate, setNewGoalTargetDate] = useState("Dec 15, 2026");
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>("High");
  const [newGoalDescription, setNewGoalDescription] = useState(
    "Find and secure a summer internship related to computer science.",
  );
  const [mediumGoalDrafts, setMediumGoalDrafts] = useState<MediumGoalDraft[]>(
    [],
  );
  const addGoalDialog = useRef<HTMLDialogElement>(null);

  const displayedCategories =
    filter === "All goals"
      ? categories
      : categories.filter((category) => category.label === filter);
  const activeGoalCount = goals.length;

  useEffect(() => {
    onDataChange(goals);
  }, [goals, onDataChange]);

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

    const goalId = `goal-${crypto.randomUUID()}`;
    const childGoals = mediumGoalDrafts
      .map((draft) => draft.title.trim())
      .filter(Boolean)
      .map((childTitle): Goal => ({
        id: `goal-${crypto.randomUUID()}`,
        category: "Medium goals",
        title: childTitle,
        progress: 0,
        completed: false,
        detail: `Linked to: ${title}`,
        parentId: goalId,
      }));
    const goal: Goal = {
      id: goalId,
      category: newGoalCategory,
      title,
      progress: 0,
      completed: false,
      detail: `New goal · 0 of ${childGoals.length} steps completed`,
      status: "New goal",
      targetDate: newGoalTargetDate,
      priority: newGoalPriority,
      description: newGoalDescription.trim(),
    };
    setGoals((currentGoals) => [...currentGoals, goal, ...childGoals]);
    setFilter("All goals");
    setNewGoalTitle("");
    setNewGoalCategory("Big goals");
    setNewGoalTargetDate("");
    setNewGoalPriority("High");
    setNewGoalDescription("");
    setMediumGoalDrafts([]);
    setAddGoalOpen(false);
  }

  function addMediumGoalDraft() {
    setMediumGoalDrafts((drafts) => [
      ...drafts,
      { id: `medium-goal-${crypto.randomUUID()}`, title: "" },
    ]);
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
                      onPriorityChange={(priority) => {
                        setGoals((currentGoals) =>
                          currentGoals.map((item) =>
                            item.id === goal.id ? { ...item, priority } : item
                          )
                        );
                      }}      
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
                <p>Create a goal and break it into manageable steps.</p>
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
            <div className="goals-dialog__fields">
              <label className="goals-dialog__field">
                Goal name
                <input
                  autoFocus
                  onChange={(event) => setNewGoalTitle(event.target.value)}
                  placeholder="e.g. Learn a new skill"
                  required
                  value={newGoalTitle}
                />
              </label>
              <label className="goals-dialog__field">
                Goal size
                <select
                  onChange={(event) =>
                    setNewGoalCategory(event.target.value as GoalCategory)
                  }
                  value={newGoalCategory}
                >
                  {categories.map(({ label }) => (
                    <option key={label} value={label}>
                      {label.slice(0, -1)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="goals-dialog__field-row">
                <label className="goals-dialog__field">
                  Target date
                  <input
                    onChange={(event) => setNewGoalTargetDate(event.target.value)}
                    placeholder="Dec 15, 2026"
                    value={newGoalTargetDate}
                  />
                </label>
                <label className="goals-dialog__field">
                  Priority
                  <select
                    onChange={(event) =>
                      setNewGoalPriority(event.target.value as Priority)
                    }
                    value={newGoalPriority}
                  >
                    {(["Very High", "High", "Medium", "Low", "Very Low", "None"] as Priority[]).map(
                      (priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <label className="goals-dialog__field">
                Description
                <textarea
                  onChange={(event) => setNewGoalDescription(event.target.value)}
                  rows={3}
                  value={newGoalDescription}
                />
              </label>
            </div>
            <section aria-labelledby="goals-breakdown-title" className="goals-dialog__breakdown">
              <div className="goals-dialog__breakdown-heading">
                <h3 id="goals-breakdown-title">Break this goal down</h3>
                <p>Add smaller goals to help you get there.</p>
              </div>
              {mediumGoalDrafts.map((draft, index) => (
                <div className="goals-dialog__child-goal" key={draft.id}>
                  <label className="goals-dialog__field">
                    Medium goal {index + 1}
                    <input
                      onChange={(event) =>
                        setMediumGoalDrafts((drafts) =>
                          drafts.map((item) =>
                            item.id === draft.id
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Enter a medium goal"
                      value={draft.title}
                    />
                  </label>
                  <button
                    aria-label={`Remove medium goal ${index + 1}`}
                    className="goals-dialog__remove-child"
                    onClick={() =>
                      setMediumGoalDrafts((drafts) =>
                        drafts.filter((item) => item.id !== draft.id),
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="goals-dialog__add-child"
                onClick={addMediumGoalDraft}
                type="button"
              >
                <span aria-hidden="true">＋</span> Add a medium goal
              </button>
            </section>
            <div className="goals-dialog__actions">
              <button
                className="goals-dialog__cancel"
                onClick={() => setAddGoalOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="goals-dialog__submit" type="submit">
                <span aria-hidden="true">＋</span> Add goal
              </button>
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
  onPriorityChange,
}: {
  goal: Goal;
  onComplete: () => void;
  onPriorityChange: (priority: Priority) => void;
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

        <label className="goal-card__priority">
          Priority
          <select
            value={goal.priority ?? "None"}
            onChange={(event) =>
              onPriorityChange(event.target.value as Priority)
            }
          >
            <option value="Very High">Very High</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Very Low">Very Low</option>
            <option value="None">None</option>
          </select>
        </label>

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
