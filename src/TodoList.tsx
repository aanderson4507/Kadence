import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import "./TodoList.css";

export type Priority = "Very High" | "High" | "Medium" | "Low" | "Very Low" | "None";
type TaskStatus = "All tasks" | "Active" | "Completed";

export type Task = {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  completed: boolean;
};

export const initialTasks: Task[] = [
  {
    id: "calc-review",
    title: "Complete Test Review for Calc.",
    category: "Study",
    priority: "High",
    completed: false,
  },
  {
    id: "python-project",
    title: "Finish Part 2 of python project",
    category: "Coding",
    priority: "High",
    completed: true,
  },
  {
    id: "elevator-pitch",
    title: "Practice Elevator Pitch for Next Week",
    category: "Career",
    priority: "High",
    completed: false,
  },
  {
    id: "resume-experience",
    title: "Update experience/projects section on Resume",
    category: "Career",
    priority: "High",
    completed: true,
  },
  {
    id: "apply-jobs",
    title: "Apply to jobs",
    category: "Career",
    priority: "Medium",
    completed: false,
  },
  {
    id: "gym-pr",
    title: "Hit a new PR in gym",
    category: "Fitness",
    priority: "None",
    completed: false,
  },
];

const taskStatuses: TaskStatus[] = ["All tasks", "Active", "Completed"];
const priorities: Priority[] = ["Very High", "High", "Medium", "Low", "Very Low", "None"];

type TodoListProps = {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
};

function TodoList({ tasks, setTasks }: TodoListProps) {
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("All tasks");
  const [priorityFilter, setPriorityFilter] = useState<Priority>("High");
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [activePriorityIndex, setActivePriorityIndex] = useState(
    priorities.indexOf("High"),
  );
  const [showCompleted, setShowCompleted] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [openTaskMenu, setOpenTaskMenu] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const quickAddInput = useRef<HTMLInputElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const priorityTriggerRef = useRef<HTMLButtonElement>(null);

  const priorityTasks = tasks.filter((task) => task.priority === priorityFilter);
  const activeCount = priorityTasks.filter((task) => !task.completed).length;
  const completedCount = priorityTasks.length - activeCount;
  const visibleTasks = priorityTasks.filter((task) => {
    if (taskStatus === "Active" && task.completed) return false;
    if (taskStatus === "Completed" && !task.completed) return false;
    if (!showCompleted && task.completed) return false;
    return true;
  });
  const remainingLabel =
    priorityFilter === "None"
      ? "tasks with no priority"
      : `${priorityFilter.toLowerCase()}-priority tasks`;

  useEffect(() => {
    if (!priorityMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!priorityMenuRef.current?.contains(event.target as Node)) {
        setPriorityMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [priorityMenuOpen]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    const task: Task = {
      id: crypto.randomUUID(),
      title,
      category: "General",
      priority: priorityFilter,
      completed: false,
    };
    setTasks((currentTasks) => [...currentTasks, task]);
    setTaskStatus("All tasks");
    setShowCompleted(true);
    setNewTaskTitle("");
    setAnnouncement(`Added task: ${title}`);
  }

  function toggleTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === taskId ? { ...item, completed: !item.completed } : item,
      ),
    );
    setAnnouncement(
      `${task.completed ? "Reopened" : "Completed"} task: ${task.title}`,
    );
  }

  function deleteTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    setTasks((currentTasks) => currentTasks.filter((item) => item.id !== taskId));
    setOpenTaskMenu(null);
    setAnnouncement(`Deleted task: ${task.title}`);
  }

  function selectPriority(priority: Priority) {
    setPriorityFilter(priority);
    setTaskStatus("All tasks");
    setPriorityMenuOpen(false);
    setAnnouncement(`Showing ${priority.toLowerCase()}-priority tasks`);
  }

  function handlePriorityMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setPriorityMenuOpen(false);
      priorityTriggerRef.current?.focus();
      return;
    }

    let nextIndex = activePriorityIndex;
    if (event.key === "ArrowDown") nextIndex = (activePriorityIndex + 1) % priorities.length;
    else if (event.key === "ArrowUp") {
      nextIndex = (activePriorityIndex - 1 + priorities.length) % priorities.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = priorities.length - 1;
    else return;

    event.preventDefault();
    setActivePriorityIndex(nextIndex);
    priorityMenuRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      [nextIndex]?.focus();
  }

  return (
    <section aria-label="To-do list workspace" className="todo-workspace">
      <header className="todo-page-heading">
        <div>
          <h1>To-do list</h1>
          <p>Make space for your most important tasks.</p>
        </div>
        <button
          className="todo-add-button"
          onClick={() => quickAddInput.current?.focus()}
          type="button"
        >
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
                  setActivePriorityIndex(priorities.indexOf(priorityFilter));
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
                    const selectedIndex = priorities.indexOf(priorityFilter);
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
                <img
                  alt=""
                  className="priority-select-chevron"
                  src="/assets/priority-dropdown-chevron.svg"
                />
              </button>
              {priorityMenuOpen && (
                <div
                  aria-label="Priority options"
                  className="priority-options"
                  id="priority-options"
                  onKeyDown={handlePriorityMenuKeyDown}
                  role="listbox"
                >
                  {priorities.map((priority, index) => (
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
                status === "All tasks"
                  ? priorityTasks.length
                  : status === "Active"
                    ? activeCount
                    : completedCount;

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
            <span
              aria-hidden="true"
              className="todo-progress-track"
              role="presentation"
            >
              <span
                className="todo-progress-fill"
                style={{
                  width:
                    priorityTasks.length === 0
                      ? "0%"
                      : `${(completedCount / priorityTasks.length) * 100}%`,
                }}
              />
            </span>
          </div>
        </div>

        <div aria-hidden="true" className="todo-column-labels">
          <span>Task</span>
          <span>Priority</span>
          <span />
        </div>

        <ul aria-label="Tasks" className="todo-task-list">
          {visibleTasks.map((task) => (
            <li
              className={`todo-task${task.completed ? " todo-task--completed" : ""}`}
              key={task.id}
            >
              <button
                aria-checked={task.completed}
                aria-label={`${task.completed ? "Mark incomplete" : "Complete"} ${task.title}`}
                className="todo-task-checkbox"
                onClick={() => toggleTask(task.id)}
                role="checkbox"
                type="button"
              >
                {task.completed && <img src="/assets/task-check.svg" alt="" />}
              </button>

              <div className="todo-task-details">
                <span className="todo-task-title">{task.title}</span>
                <span className="todo-task-category">{task.category}</span>
              </div>

              <div className="todo-task-priority">
                <span className="todo-priority-badge">
                  <img
                    src={
                      task.completed
                        ? "/assets/priority-flag-muted.svg"
                        : "/assets/priority-flag-badge.svg"
                    }
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
                  onClick={() =>
                    setOpenTaskMenu((current) =>
                      current === task.id ? null : task.id,
                    )
                  }
                  type="button"
                >
                  <img src="/assets/task-more.svg" alt="" />
                </button>
                {openTaskMenu === task.id && (
                  <div className="todo-task-menu">
                    <button onClick={() => deleteTask(task.id)} type="button">
                      Delete task
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {visibleTasks.length === 0 && (
            <li className="todo-empty-state">
              {priorityTasks.length === 0
                ? "No tasks in this priority yet. Add one below."
                : taskStatus === "Completed"
                ? "No completed tasks in this priority."
                : taskStatus === "Active"
                  ? "All tasks in this priority are complete."
                  : "No tasks to show."}
            </li>
          )}
        </ul>

        <form className="todo-quick-add" onSubmit={addTask}>
          <img src="/assets/add-muted.svg" alt="" />
          <input
            aria-label="Add a task"
            onChange={(event) => setNewTaskTitle(event.target.value)}
            placeholder={
              priorityFilter === "None"
                ? "Add a task with no priority..."
                : `Add a ${priorityFilter.toLowerCase()}-priority task...`
            }
            ref={quickAddInput}
            value={newTaskTitle}
          />
          <button aria-label="Add task" type="submit">
            ↵
          </button>
        </form>

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
