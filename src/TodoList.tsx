import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import "./TodoList.css";
import type { Repeat, RepeatFrequency, Task, TaskChanges, TaskInput } from "./api";
import { errorMessage } from "./http";
import { PRIORITY_LEVELS, describeUrgency, sortTasksByPriority, todayKey, type Priority } from "./taskPriority";

export type { Priority, Task };
type TaskStatus = "All tasks" | "Active" | "Completed";
type PriorityFilter = Priority | "All priorities";

const taskStatuses: TaskStatus[] = ["All tasks", "Active", "Completed"];
const filterOptions: PriorityFilter[] = ["All priorities", ...PRIORITY_LEVELS];
const repeatOptions: { value: RepeatFrequency | ""; label: string; unit: string }[] = [
  { value: "", label: "Doesn't repeat", unit: "" },
  { value: "DAILY", label: "Every day", unit: "days" },
  { value: "WEEKLY", label: "Every week", unit: "weeks" },
  { value: "MONTHLY", label: "Every month", unit: "months" },
];

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString();
}

type TodoListProps = {
  tasks: Task[];
  onCreate: (input: TaskInput) => Promise<{ task: Task; occurrenceCount: number }>;
  onUpdate: (taskId: string, changes: TaskChanges) => Promise<Task>;
  onDelete: (taskId: string, scope?: "one" | "series") => Promise<void>;
  /** Set when a notification or the Breakdown page opens a task. */
  focusTaskId: { id: string; nonce: number } | null;
};

function TodoList({ tasks, onCreate, onUpdate, onDelete, focusTaskId }: TodoListProps) {
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("All tasks");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All priorities");
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [activePriorityIndex, setActivePriorityIndex] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("Medium");
  const [newTaskIsExam, setNewTaskIsExam] = useState(false);
  const [newTaskRepeat, setNewTaskRepeat] = useState<RepeatFrequency | "">("");
  const [newTaskRepeatCount, setNewTaskRepeatCount] = useState(4);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState("");
  const [listError, setListError] = useState("");
  const [openTaskMenu, setOpenTaskMenu] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const quickAddInput = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const priorityTriggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const today = todayKey();
  const priorityTasks = sortTasksByPriority(
    priorityFilter === "All priorities" ? tasks : tasks.filter((task) => task.priority === priorityFilter),
    today,
  );
  const activeCount = priorityTasks.filter((task) => !task.completed).length;
  const completedCount = priorityTasks.length - activeCount;
  const visibleTasks = priorityTasks.filter((task) => {
    if (taskStatus === "Active" && task.completed) return false;
    if (taskStatus === "Completed" && !task.completed) return false;
    if (!showCompleted && task.completed) return false;
    return true;
  });
  const remainingLabel =
    priorityFilter === "All priorities"
      ? "tasks"
      : priorityFilter === "None"
        ? "tasks with no priority"
        : `${priorityFilter.toLowerCase()}-priority tasks`;
  const quickAddPriority = priorityFilter === "All priorities" ? newTaskPriority : priorityFilter;

  useEffect(() => {
    if (!priorityMenuOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!priorityMenuRef.current?.contains(event.target as Node)) setPriorityMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [priorityMenuOpen]);

  // Opening a task from a notification shows it, whatever filters were set (issue #4).
  useEffect(() => {
    if (!focusTaskId) return;
    setPriorityFilter("All priorities");
    setTaskStatus("All tasks");
    setShowCompleted(true);
    setHighlightedTaskId(focusTaskId.id);
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-task-id="${focusTaskId.id}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    const timer = window.setTimeout(() => setHighlightedTaskId(null), 4000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusTaskId]);

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) {
      setQuickAddError("Give the task a name.");
      return;
    }
    if (newTaskIsExam && !newTaskDueDate) {
      setQuickAddError("Add the exam date so Kadence can schedule study sessions before it.");
      return;
    }
    if (newTaskRepeat && !newTaskDueDate) {
      setQuickAddError("Add a due date for the first time this task happens.");
      return;
    }
    const repeat: Repeat = newTaskRepeat ? { frequency: newTaskRepeat, count: newTaskRepeatCount } : null;

    setSaving(true);
    setQuickAddError("");
    try {
      const { occurrenceCount } = await onCreate({
        title,
        priority: quickAddPriority,
        dueDate: newTaskDueDate || undefined,
        isExam: newTaskIsExam,
        category: newTaskIsExam ? "Exam" : undefined,
        repeat,
      });
      setTaskStatus("All tasks");
      setShowCompleted(true);
      setNewTaskTitle("");
      setNewTaskDueDate("");
      setNewTaskIsExam(false);
      setNewTaskRepeat("");
      setAnnouncement(
        newTaskIsExam
          ? `Added exam: ${title}. Study sessions were added to your planner.`
          : occurrenceCount > 1
            ? `Added ${title}, repeating ${occurrenceCount} times.`
            : `Added task: ${title}`,
      );
      quickAddInput.current?.focus();
    } catch (error) {
      // The typed task stays in the box so nothing is lost.
      setQuickAddError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function runTaskAction(task: Task, action: () => Promise<unknown>, success: string) {
    setBusyTaskId(task.id);
    setListError("");
    setOpenTaskMenu(null);
    try {
      await action();
      setAnnouncement(success);
    } catch (error) {
      setListError(errorMessage(error));
    } finally {
      setBusyTaskId(null);
    }
  }

  function toggleTask(task: Task) {
    void runTaskAction(
      task,
      () => onUpdate(task.id, { completed: !task.completed }),
      `${task.completed ? "Reopened" : "Completed"} task: ${task.title}`,
    );
  }

  function toggleExam(task: Task) {
    void runTaskAction(
      task,
      () => onUpdate(task.id, { isExam: !task.isExam }),
      task.isExam
        ? `${task.title} is no longer marked as an exam.`
        : task.dueDate
          ? `${task.title} marked as an exam. Study sessions were added to your planner.`
          : `${task.title} marked as an exam. Add a due date to schedule study sessions.`,
    );
  }

  function toggleBacklog(task: Task) {
    void runTaskAction(
      task,
      () => onUpdate(task.id, { inBacklog: !task.inBacklog }),
      task.inBacklog ? `${task.title} moved out of the backlog.` : `${task.title} moved to the backlog.`,
    );
  }

  function deleteTask(task: Task, scope: "one" | "series") {
    void runTaskAction(
      task,
      () => onDelete(task.id, scope),
      scope === "series" ? `Deleted every upcoming ${task.title}` : `Deleted task: ${task.title}`,
    );
  }

  function selectPriority(priority: PriorityFilter) {
    setPriorityFilter(priority);
    setTaskStatus("All tasks");
    setPriorityMenuOpen(false);
    setAnnouncement(
      priority === "All priorities" ? "Showing every task" : `Showing ${priority.toLowerCase()}-priority tasks`,
    );
  }

  function handlePriorityMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setPriorityMenuOpen(false);
      priorityTriggerRef.current?.focus();
      return;
    }
    let nextIndex = activePriorityIndex;
    if (event.key === "ArrowDown") nextIndex = (activePriorityIndex + 1) % filterOptions.length;
    else if (event.key === "ArrowUp") nextIndex = (activePriorityIndex - 1 + filterOptions.length) % filterOptions.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = filterOptions.length - 1;
    else return;
    event.preventDefault();
    setActivePriorityIndex(nextIndex);
    priorityMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[nextIndex]?.focus();
  }

  return (
    <section aria-label="To-do list workspace" className="todo-workspace">
      <header className="todo-page-heading">
        <div>
          <h1>To-do list</h1>
          <p>Make space for your most important tasks.</p>
        </div>
        <button className="todo-add-button" onClick={() => quickAddInput.current?.focus()} type="button">
          <img src="/assets/add.svg" alt="" />
          <span>Add task</span>
        </button>
      </header>

      <section aria-labelledby="todo-list-title" className="todo-card">
        <header className="todo-card-heading">
          <div className="todo-list-identity">
            <h2 id="todo-list-title">Priority to-do list</h2>
            <p>
              {priorityTasks.length} {remainingLabel} · {activeCount} remaining
            </p>
          </div>

          <div className="priority-filter">
            <span>Priority</span>
            <div className="priority-select-wrap" ref={priorityMenuRef}>
              <button
                aria-controls="priority-options"
                aria-expanded={priorityMenuOpen}
                aria-haspopup="listbox"
                className={`priority-select-trigger${priorityMenuOpen ? " priority-select-trigger--open" : ""}`}
                onClick={() => {
                  setActivePriorityIndex(filterOptions.indexOf(priorityFilter));
                  setPriorityMenuOpen((open) => !open);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && priorityMenuOpen) {
                    event.preventDefault();
                    setPriorityMenuOpen(false);
                    return;
                  }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setPriorityMenuOpen(true);
                    const selectedIndex = filterOptions.indexOf(priorityFilter);
                    setActivePriorityIndex(selectedIndex);
                    requestAnimationFrame(() => {
                      priorityMenuRef.current
                        ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
                        [selectedIndex]?.focus();
                    });
                  }
                }}
                ref={priorityTriggerRef}
                type="button"
              >
                <span className="priority-select-value">
                  <img alt="" src="/assets/priority-dropdown-flag.svg" />
                  <span>{priorityFilter}</span>
                </span>
                <img alt="" className="priority-select-chevron" src="/assets/priority-dropdown-chevron.svg" />
              </button>
              {priorityMenuOpen && (
                <div
                  aria-label="Priority options"
                  className="priority-options"
                  id="priority-options"
                  onKeyDown={handlePriorityMenuKeyDown}
                  role="listbox"
                >
                  {filterOptions.map((priority, index) => (
                    <button
                      aria-selected={priorityFilter === priority}
                      className={`priority-option${priorityFilter === priority ? " priority-option--selected" : ""}`}
                      key={priority}
                      onClick={() => selectPriority(priority)}
                      onFocus={() => setActivePriorityIndex(index)}
                      role="option"
                      tabIndex={activePriorityIndex === index ? 0 : -1}
                      type="button"
                    >
                      <img
                        alt=""
                        src={
                          priorityFilter === priority
                            ? "/assets/priority-dropdown-flag.svg"
                            : "/assets/priority-dropdown-option-flag.svg"
                        }
                      />
                      <span>{priority}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="todo-list-filters">
          <div aria-label="Filter tasks by status" className="todo-status-tabs" role="group">
            {taskStatuses.map((status) => {
              const count =
                status === "All tasks" ? priorityTasks.length : status === "Active" ? activeCount : completedCount;
              return (
                <button
                  aria-pressed={taskStatus === status}
                  className={`todo-status-tab${taskStatus === status ? " todo-status-tab--active" : ""}`}
                  key={status}
                  onClick={() => setTaskStatus(status)}
                  type="button"
                >
                  <span>{status}</span>
                  <span className="todo-status-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div
            aria-label={`${completedCount} of ${priorityTasks.length} tasks complete`}
            className="todo-progress-summary"
            role="progressbar"
            aria-valuemax={Math.max(priorityTasks.length, 1)}
            aria-valuemin={0}
            aria-valuenow={completedCount}
          >
            <span>
              {completedCount} of {priorityTasks.length} complete
            </span>
            <span aria-hidden="true" className="todo-progress-track" role="presentation">
              <span
                className="todo-progress-fill"
                style={{
                  width: priorityTasks.length === 0 ? "0%" : `${(completedCount / priorityTasks.length) * 100}%`,
                }}
              />
            </span>
          </div>
        </div>

        {listError && (
          <p className="todo-quick-add-error" role="alert">
            {listError}
          </p>
        )}

        <div aria-hidden="true" className="todo-column-labels">
          <span>Task</span>
          <span>Priority</span>
          <span />
        </div>

        <ul aria-label="Tasks" className="todo-task-list" ref={listRef}>
          {visibleTasks.map((task) => (
            <li
              aria-busy={busyTaskId === task.id}
              className={`todo-task${task.completed ? " todo-task--completed" : ""}${highlightedTaskId === task.id ? " todo-task--focused" : ""}`}
              data-task-id={task.id}
              key={task.id}
            >
              <button
                aria-checked={task.completed}
                aria-label={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`}
                className="todo-task-checkbox"
                disabled={busyTaskId === task.id}
                onClick={() => toggleTask(task)}
                role="checkbox"
                type="button"
              >
                {task.completed && <img src="/assets/task-check.svg" alt="" />}
              </button>

              <div className="todo-task-details">
                <span className="todo-task-title">{task.title}</span>
                <span className="todo-task-category">
                  {task.isExam && <span className="todo-exam-badge">Exam</span>}
                  {task.inBacklog && <span className="todo-exam-badge todo-badge--muted">Backlog</span>}
                  {task.seriesId && <span className="todo-exam-badge todo-badge--muted">Repeats</span>}
                  {task.category}
                </span>
                {task.dueDate && (
                  <span className="todo-task-due-date">
                    Due {formatDate(task.dueDate)}
                    {!task.completed && describeUrgency({ ...task, isExam: false }, today) &&
                      ` · ${describeUrgency({ ...task, isExam: false }, today)}`}
                    {task.originalDueDate && ` · rescheduled from ${formatDate(task.originalDueDate)}`}
                  </span>
                )}
                {task.isExam && !task.dueDate && !task.completed && (
                  <span className="todo-task-due-date todo-task-due-date--warning">
                    Add a due date to schedule study sessions
                  </span>
                )}
              </div>

              <div className="todo-task-priority">
                <span className="todo-priority-badge">
                  <img
                    src={task.completed ? "/assets/priority-flag-muted.svg" : "/assets/priority-flag-badge.svg"}
                    alt=""
                  />
                  <span>{task.priority}</span>
                </span>
              </div>

              <div className="todo-task-actions">
                <button
                  aria-expanded={openTaskMenu === task.id}
                  aria-label={`Actions for ${task.title}`}
                  className="todo-task-menu-button"
                  onClick={() => setOpenTaskMenu((current) => (current === task.id ? null : task.id))}
                  type="button"
                >
                  <img src="/assets/task-more.svg" alt="" />
                </button>
                {openTaskMenu === task.id && (
                  <div className="todo-task-menu">
                    <button className="todo-task-menu__neutral" onClick={() => toggleExam(task)} type="button">
                      {task.isExam ? "Unmark as exam" : "Mark as exam"}
                    </button>
                    {!task.completed && (
                      <button className="todo-task-menu__neutral" onClick={() => toggleBacklog(task)} type="button">
                        {task.inBacklog ? "Move out of backlog" : "Move to backlog"}
                      </button>
                    )}
                    <button onClick={() => deleteTask(task, "one")} type="button">
                      Delete task
                    </button>
                    {task.seriesId && (
                      <button onClick={() => deleteTask(task, "series")} type="button">
                        Delete all unfinished repeats
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
          {visibleTasks.length === 0 && (
            <li className="todo-empty-state">
              {priorityTasks.length === 0
                ? priorityFilter === "All priorities"
                  ? "No tasks yet. Add one below."
                  : "No tasks in this priority yet. Add one below."
                : taskStatus === "Completed"
                  ? "No completed tasks here."
                  : taskStatus === "Active"
                    ? "Everything here is complete."
                    : "No tasks to show."}
            </li>
          )}
        </ul>

        <form className="todo-quick-add" onSubmit={(event) => void addTask(event)}>
          <img src="/assets/add-muted.svg" alt="" />
          <input
            aria-label="Add a task"
            maxLength={200}
            onChange={(event) => {
              setNewTaskTitle(event.target.value);
              setQuickAddError("");
            }}
            placeholder={
              quickAddPriority === "None"
                ? "Add a task with no priority..."
                : `Add a ${quickAddPriority.toLowerCase()}-priority task...`
            }
            ref={quickAddInput}
            value={newTaskTitle}
          />
          <input
            aria-label={newTaskIsExam ? "Exam date" : "Task due date"}
            onChange={(event) => {
              setNewTaskDueDate(event.target.value);
              setQuickAddError("");
            }}
            type="date"
            value={newTaskDueDate}
          />
          {priorityFilter === "All priorities" && (
            <select
              aria-label="New task priority"
              className="todo-quick-add__select"
              onChange={(event) => setNewTaskPriority(event.target.value as Priority)}
              value={newTaskPriority}
            >
              {PRIORITY_LEVELS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          )}
          <button
            aria-pressed={newTaskIsExam}
            className={`todo-exam-toggle${newTaskIsExam ? " todo-exam-toggle--on" : ""}`}
            onClick={() => {
              setNewTaskIsExam((isExam) => !isExam);
              setQuickAddError("");
            }}
            title="Mark as an exam to schedule study sessions before it"
            type="button"
          >
            Exam
          </button>
          <button aria-label="Add task" disabled={saving} type="submit">
            {saving ? "…" : "↵"}
          </button>
        </form>
        <div className="todo-repeat-row">
          <label>
            <span>Repeat</span>
            <select
              onChange={(event) => setNewTaskRepeat(event.target.value as RepeatFrequency | "")}
              value={newTaskRepeat}
            >
              {repeatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {newTaskRepeat && (
            <label>
              <span>for</span>
              <input
                max={60}
                min={2}
                onChange={(event) => setNewTaskRepeatCount(Math.max(2, Math.min(60, Number(event.target.value) || 2)))}
                type="number"
                value={newTaskRepeatCount}
              />
              <span>{repeatOptions.find((option) => option.value === newTaskRepeat)?.unit}</span>
            </label>
          )}
        </div>
        {quickAddError && (
          <p className="todo-quick-add-error" role="alert">
            {quickAddError}
          </p>
        )}

        <footer className="todo-card-footer">
          <p>
            {activeCount} {activeCount === 1 ? "task" : "tasks"} left to complete
          </p>
          <label className="completed-visibility">
            <span>Show completed</span>
            <button
              aria-checked={showCompleted}
              aria-label="Show completed tasks"
              className={`completed-visibility-toggle${showCompleted ? " completed-visibility-toggle--on" : ""}`}
              onClick={() => setShowCompleted((visible) => !visible)}
              role="switch"
              type="button"
            >
              <span />
            </button>
          </label>
        </footer>
      </section>
      <p aria-live="polite" className="visually-hidden" role="status">
        {announcement}
      </p>
    </section>
  );
}

export default TodoList;
