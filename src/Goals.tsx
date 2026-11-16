import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { Goal, GoalChanges, GoalInput, GoalSize } from "./api";
import { errorMessage } from "./http";
import { PRIORITY_LEVELS, PRIORITY_WEIGHTS, type Priority } from "./taskPriority";
import "./Goals.css";

type GoalCategory = "Big goals" | "Medium goals" | "Small goals";
type GoalFilter = "All goals" | GoalCategory;
type ChildGoalDraft = { id: string; title: string };

const categories: { label: GoalCategory; size: GoalSize; description: string; className: string }[] = [
  { label: "Big goals", size: "BIG", description: "The bigger picture", className: "big" },
  { label: "Medium goals", size: "MEDIUM", description: "Make progress this month", className: "medium" },
  { label: "Small goals", size: "SMALL", description: "One step at a time", className: "small" },
];
const TIER_RANK: Record<GoalSize, number> = { BIG: 3, MEDIUM: 2, SMALL: 1 };
const CHILD_TIER: Record<GoalSize, GoalSize | null> = { BIG: "MEDIUM", MEDIUM: "SMALL", SMALL: null };
const tierName: Record<GoalSize, string> = { BIG: "big", MEDIUM: "medium", SMALL: "small" };

type GoalsProps = {
  activeView: string | null;
  goals: Goal[];
  onCreateGoal: (input: GoalInput) => Promise<void>;
  onUpdateGoal: (goalId: string, changes: GoalChanges) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
  onChangePriority: (goalId: string, priority: Priority) => Promise<void>;
  onOpenBreakdown: (goalId?: string) => void;
  onOpenSettings: () => void;
  onSelectView: (view: string | null) => void;
};

/** "2 of 5 steps completed" counts milestones, linked tasks and child goals, like the progress. */
function describeGoal(goal: Goal, goals: Goal[]) {
  const parent = goals.find((item) => item.id === goal.parentGoalId);
  const children = goals.filter((item) => item.parentGoalId === goal.id);
  const steps = goal.milestones.length + goal.taskCount + children.length;
  const done =
    goal.milestones.filter((milestone) => milestone.completedAt).length +
    goal.completedTaskCount +
    children.filter((child) => child.status === "COMPLETED").length;
  const parts: string[] = [];
  if (parent) parts.push(`Linked to: ${parent.title}`);
  parts.push(steps === 0 ? "No steps yet" : `${done} of ${steps} steps completed`);
  if (goal.targetDate && goal.status !== "COMPLETED") {
    parts.push(`Target ${new Date(`${goal.targetDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
  }
  return parts.join(" · ");
}

function Goals({
  activeView,
  goals,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onChangePriority,
  onOpenBreakdown,
  onOpenSettings,
  onSelectView,
}: GoalsProps) {
  const [filter, setFilter] = useState<GoalFilter>("All goals");
  const [filterOpen, setFilterOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalSize, setNewGoalSize] = useState<GoalSize>("BIG");
  const [newGoalStartDate, setNewGoalStartDate] = useState("");
  const [newGoalTargetDate, setNewGoalTargetDate] = useState("");
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>("High");
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [newGoalParentId, setNewGoalParentId] = useState("");
  const [childGoalDrafts, setChildGoalDrafts] = useState<ChildGoalDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [boardError, setBoardError] = useState("");
  const [busyGoalId, setBusyGoalId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const addGoalDialog = useRef<HTMLDialogElement>(null);

  const displayedCategories = filter === "All goals" ? categories : categories.filter((category) => category.label === filter);
  const activeGoals = goals.filter((goal) => goal.status === "ACTIVE");
  const bigGoals = goals.filter((goal) => goal.size === "BIG" && goal.status !== "ARCHIVED");
  const overallProgress =
    bigGoals.length === 0 ? 0 : Math.round(bigGoals.reduce((total, goal) => total + goal.progress, 0) / bigGoals.length);
  const spotlight = [...activeGoals]
    .filter((goal) => goal.size === "BIG")
    .sort((a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority] || a.progress - b.progress)[0];
  const spotlightSteps = spotlight ? goals.filter((goal) => goal.parentGoalId === spotlight.id).length : 0;
  const parentOptions = goals.filter((goal) => TIER_RANK[goal.size] > TIER_RANK[newGoalSize] && goal.status !== "ARCHIVED");
  const childTier = CHILD_TIER[newGoalSize];
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date());

  useEffect(() => {
    const dialog = addGoalDialog.current;
    if (addGoalOpen && dialog && !dialog.open) dialog.showModal();
    else if (!addGoalOpen && dialog?.open) dialog.close();
  }, [addGoalOpen]);

  async function runGoalAction(goalId: string, action: () => Promise<void>) {
    setBusyGoalId(goalId);
    setBoardError("");
    try {
      await action();
    } catch (error) {
      setBoardError(errorMessage(error));
    } finally {
      setBusyGoalId(null);
    }
  }

  function resetForm() {
    setNewGoalTitle("");
    setNewGoalSize("BIG");
    setNewGoalStartDate("");
    setNewGoalTargetDate("");
    setNewGoalPriority("High");
    setNewGoalDescription("");
    setNewGoalParentId("");
    setChildGoalDrafts([]);
    setFormError("");
  }

  async function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newGoalTitle.trim();
    if (!title) {
      setFormError("Give the goal a name.");
      return;
    }
    if (newGoalStartDate && newGoalTargetDate && newGoalTargetDate < newGoalStartDate) {
      setFormError("The target date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await onCreateGoal({
        title,
        size: newGoalSize,
        priority: newGoalPriority,
        description: newGoalDescription.trim() || undefined,
        startDate: newGoalStartDate || undefined,
        targetDate: newGoalTargetDate || undefined,
        parentGoalId: newGoalParentId || null,
        childGoalTitles: childTier ? childGoalDrafts.map((draft) => draft.title.trim()).filter(Boolean) : [],
      });
      setFilter("All goals");
      resetForm();
      setAddGoalOpen(false);
    } catch (error) {
      // Everything typed stays in the dialog so it can be fixed and saved again.
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function closeDialogOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget && !saving) setAddGoalOpen(false);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!saving) setAddGoalOpen(false);
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
          <button className="goals-sidebar__item" onClick={() => onSelectView("Calendar")} type="button">
            <img alt="" className="goals-sidebar__image-icon" src="/assets/tab-calendar.svg" />
            <span>Calendar</span>
          </button>
          <button className="goals-sidebar__item" onClick={onOpenSettings} type="button">
            <img alt="" className="goals-sidebar__image-icon" src="/assets/settings.svg" />
            <span>Settings</span>
          </button>
        </nav>

        <section aria-label="Your progress" className="goals-sidebar__progress">
          <h2>Your progress</h2>
          <div className="goals-sidebar__count">
            <strong>{activeGoals.length}</strong>
            <span>active goals</span>
          </div>
          <div
            aria-label={`${overallProgress}% average progress on big goals`}
            className="goals-sidebar__progress-track"
            role="progressbar"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={overallProgress}
          >
            <span style={{ width: `${overallProgress}%` }} />
          </div>
          <p>{overallProgress}% average progress on big goals</p>
        </section>

        <aside aria-label={`${month} intention`} className="goals-intention">
          <h2>
            <span aria-hidden="true">✧</span> {month} intention
          </h2>
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
                  {(["All goals", ...categories.map(({ label }) => label)] as GoalFilter[]).map((option) => (
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
                  ))}
                </div>
              )}
            </div>
            <button
              className="goals-add-button"
              onClick={() => {
                resetForm();
                setAddGoalOpen(true);
              }}
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
        {boardError && (
          <p className="goals-error" role="alert">
            {boardError}
          </p>
        )}

        <div className={`goals-board${filter === "All goals" ? "" : " goals-board--filtered"}`}>
          {displayedCategories.map((category) => {
            const categoryGoals = goals.filter((goal) => goal.size === category.size && goal.status !== "ARCHIVED");
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
                  <span className="goals-column__count">{String(categoryGoals.length).padStart(2, "0")}</span>
                </header>

                <div className="goals-column__list">
                  {categoryGoals.length === 0 && <p className="goals-column__empty">No {category.label.toLowerCase()} yet.</p>}
                  {categoryGoals.map((goal) => (
                    <GoalCard
                      busy={busyGoalId === goal.id}
                      confirmingDelete={confirmDeleteId === goal.id}
                      detail={describeGoal(goal, goals)}
                      goal={goal}
                      key={goal.id}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                      onComplete={() =>
                        void runGoalAction(goal.id, () =>
                          onUpdateGoal(goal.id, { status: goal.status === "COMPLETED" ? "ACTIVE" : "COMPLETED" }),
                        )
                      }
                      onDelete={() => {
                        setConfirmDeleteId(null);
                        void runGoalAction(goal.id, () => onDeleteGoal(goal.id));
                      }}
                      onOpenBreakdown={() => onOpenBreakdown(goal.id)}
                      onPriorityChange={(priority) => void runGoalAction(goal.id, () => onChangePriority(goal.id, priority))}
                      onRequestDelete={() => setConfirmDeleteId(goal.id)}
                    />
                  ))}
                  {category.size === "BIG" && spotlight && (
                    <aside aria-label="Goal spotlight" className="goal-spotlight">
                      <p>↗ Goal spotlight</p>
                      <strong>{spotlight.title}</strong>
                      <span>
                        {spotlightSteps} linked {spotlightSteps === 1 ? "step" : "steps"} · {spotlight.progress}% complete
                      </span>
                      <button onClick={() => onOpenBreakdown(spotlight.id)} type="button">
                        View breakdown
                      </button>
                    </aside>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="goals-footer">
          <div className="goals-footer__legend">
            <span>
              <i className="goals-footer__dot goals-footer__dot--linked" />
              Linked to a goal
            </span>
            <span>
              <i className="goals-footer__dot goals-footer__dot--individual" />
              Individual goals
            </span>
          </div>
          <span>
            {categories.length} goal categories · {activeGoals.length} active goals
          </span>
        </footer>
      </section>

      {addGoalOpen && (
        <dialog
          aria-labelledby="add-goal-title"
          className="goals-dialog"
          onCancel={(event) => {
            event.preventDefault();
            if (!saving) setAddGoalOpen(false);
          }}
          onClick={closeDialogOnBackdrop}
          onKeyDown={handleDialogKeyDown}
          ref={addGoalDialog}
        >
          <form className="goals-dialog__form" onSubmit={(event) => void addGoal(event)}>
            <div className="goals-dialog__heading">
              <div>
                <h2 id="add-goal-title">Add a goal</h2>
                <p>Create a goal and break it into manageable steps.</p>
              </div>
              <button aria-label="Close dialog" className="goals-dialog__close" onClick={() => setAddGoalOpen(false)} type="button">
                ×
              </button>
            </div>
            {formError && (
              <p className="goals-error" role="alert">
                {formError}
              </p>
            )}
            <div className="goals-dialog__fields">
              <label className="goals-dialog__field">
                Goal name
                <input
                  autoFocus
                  maxLength={150}
                  onChange={(event) => setNewGoalTitle(event.target.value)}
                  placeholder="e.g. Get an internship"
                  required
                  value={newGoalTitle}
                />
              </label>
              <div className="goals-dialog__field-row">
                <label className="goals-dialog__field">
                  Goal size
                  <select
                    onChange={(event) => {
                      setNewGoalSize(event.target.value as GoalSize);
                      setNewGoalParentId("");
                    }}
                    value={newGoalSize}
                  >
                    {categories.map(({ label, size }) => (
                      <option key={size} value={size}>
                        {label.slice(0, -1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="goals-dialog__field">
                  Priority
                  <select onChange={(event) => setNewGoalPriority(event.target.value as Priority)} value={newGoalPriority}>
                    {PRIORITY_LEVELS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="goals-dialog__field-row">
                <label className="goals-dialog__field">
                  Start date
                  <input onChange={(event) => setNewGoalStartDate(event.target.value)} type="date" value={newGoalStartDate} />
                </label>
                <label className="goals-dialog__field">
                  Target date
                  <input
                    min={newGoalStartDate || undefined}
                    onChange={(event) => setNewGoalTargetDate(event.target.value)}
                    type="date"
                    value={newGoalTargetDate}
                  />
                </label>
              </div>
              {newGoalSize !== "BIG" && (
                <label className="goals-dialog__field">
                  Part of a bigger goal
                  <select onChange={(event) => setNewGoalParentId(event.target.value)} value={newGoalParentId}>
                    <option value="">No, it stands on its own</option>
                    {parentOptions.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title} ({tierName[goal.size]})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="goals-dialog__field">
                Description
                <textarea onChange={(event) => setNewGoalDescription(event.target.value)} rows={3} value={newGoalDescription} />
              </label>
            </div>
            {childTier && (
              <section aria-labelledby="goals-breakdown-title" className="goals-dialog__breakdown">
                <div className="goals-dialog__breakdown-heading">
                  <h3 id="goals-breakdown-title">Break this goal down</h3>
                  <p>Add smaller {tierName[childTier]} goals to help you get there. Schedule milestones later in Breakdown.</p>
                </div>
                {childGoalDrafts.map((draft, index) => (
                  <div className="goals-dialog__child-goal" key={draft.id}>
                    <label className="goals-dialog__field">
                      {tierName[childTier][0].toUpperCase() + tierName[childTier].slice(1)} goal {index + 1}
                      <input
                        maxLength={150}
                        onChange={(event) =>
                          setChildGoalDrafts((drafts) =>
                            drafts.map((item) => (item.id === draft.id ? { ...item, title: event.target.value } : item)),
                          )
                        }
                        placeholder={`Enter a ${tierName[childTier]} goal`}
                        value={draft.title}
                      />
                    </label>
                    <button
                      aria-label={`Remove ${tierName[childTier]} goal ${index + 1}`}
                      className="goals-dialog__remove-child"
                      onClick={() => setChildGoalDrafts((drafts) => drafts.filter((item) => item.id !== draft.id))}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  className="goals-dialog__add-child"
                  onClick={() => setChildGoalDrafts((drafts) => [...drafts, { id: crypto.randomUUID(), title: "" }])}
                  type="button"
                >
                  <span aria-hidden="true">＋</span> Add a {tierName[childTier]} goal
                </button>
              </section>
            )}
            <div className="goals-dialog__actions">
              <button className="goals-dialog__cancel" disabled={saving} onClick={() => setAddGoalOpen(false)} type="button">
                Cancel
              </button>
              <button aria-busy={saving} className="goals-dialog__submit" disabled={saving} type="submit">
                <span aria-hidden="true">＋</span> {saving ? "Saving…" : "Add goal"}
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
  detail,
  busy,
  confirmingDelete,
  onComplete,
  onPriorityChange,
  onOpenBreakdown,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  goal: Goal;
  detail: string;
  busy: boolean;
  confirmingDelete: boolean;
  onComplete: () => void;
  onPriorityChange: (priority: Priority) => void;
  onOpenBreakdown: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const completed = goal.status === "COMPLETED";
  const progress = completed ? 100 : goal.progress;

  return (
    <article aria-busy={busy} className={`goal-card${goal.parentGoalId ? " goal-card--linked" : ""}`}>
      <button
        aria-label={`${completed ? "Mark" : "Complete"} ${goal.title}${completed ? " as incomplete" : ""}`}
        aria-pressed={completed}
        className="goal-card__complete"
        disabled={busy}
        onClick={onComplete}
        type="button"
      >
        <img alt="" src={completed ? "/assets/goal-checkbox-complete.svg" : "/assets/goal-checkbox.svg"} />
        {completed && <span aria-hidden="true">✓</span>}
      </button>
      <div className="goal-card__body">
        <h3>{goal.title}</h3>

        <label className="goal-card__priority">
          Priority
          <select
            disabled={busy}
            onChange={(event) => onPriorityChange(event.target.value as Priority)}
            value={goal.priority}
          >
            {PRIORITY_LEVELS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <p>{detail}</p>

        <div
          aria-label={`${progress}% complete`}
          className="goal-card__progress"
          role="progressbar"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
        >
          <span aria-hidden="true" className="goal-card__progress-track">
            <span className="goal-card__progress-fill" style={{ width: `${progress}%` }} />
          </span>
          <span className="goal-card__progress-label">{progress}%</span>
        </div>
        <div className="goal-card__actions">
          <button onClick={onOpenBreakdown} type="button">
            Breakdown
          </button>
          {confirmingDelete ? (
            <>
              <span role="alert">Delete? Its steps are kept.</span>
              <button className="goal-card__danger" onClick={onDelete} type="button">
                Delete
              </button>
              <button onClick={onCancelDelete} type="button">
                Keep
              </button>
            </>
          ) : (
            <button aria-label={`Delete ${goal.title}`} onClick={onRequestDelete} type="button">
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default Goals;
