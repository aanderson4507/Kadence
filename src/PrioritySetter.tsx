import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Priority, Task } from "./TodoList";
import { describeUrgency, sortTasksByPriority, todayKey } from "./taskPriority";
import "./PrioritySetter.css";

type PrioritySetterProps = {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
};

const priorityOptions: {
  value: Priority;
  description: string;
}[] = [
  { value: "Very High", description: "Needs your immediate attention." },
  { value: "High", description: "Make time for this soon." },
  { value: "Medium", description: "Keep it moving alongside other work." },
  { value: "Low", description: "Take it on when you have space." },
  { value: "Very Low", description: "It can wait for a quieter moment." },
  { value: "None", description: "Leave this item without a priority." },
];

function PrioritySetter({ tasks, setTasks }: PrioritySetterProps) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [draftPriority, setDraftPriority] = useState<Priority>(
    tasks[0]?.priority ?? "None",
  );
  const [draftExam, setDraftExam] = useState(tasks[0]?.isExam ?? false);
  const [announcement, setAnnouncement] = useState("");
  const today = todayKey();

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  // Listed in priority order, so the most important work is at the top.
  const filteredTasks = sortTasksByPriority(
    tasks.filter((task) => {
      const query = searchQuery.trim().toLowerCase();
      return (
        task.title.toLowerCase().includes(query) ||
        task.category.toLowerCase().includes(query) ||
        (query === "exam" && task.isExam === true)
      );
    }),
    today,
  );
  const hasChanges =
    selectedTask !== undefined &&
    (draftPriority !== selectedTask.priority || draftExam !== Boolean(selectedTask.isExam));

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId("");
      return;
    }

    if (!tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0].id);
      setDraftPriority(tasks[0].priority);
      setDraftExam(Boolean(tasks[0].isExam));
    }
  }, [selectedTaskId, tasks]);

  function selectTask(task: Task) {
    setSelectedTaskId(task.id);
    setDraftPriority(task.priority);
    setDraftExam(Boolean(task.isExam));
    setAnnouncement("");
  }

  function resetPriority() {
    if (!selectedTask) return;
    setDraftPriority(selectedTask.priority);
    setDraftExam(Boolean(selectedTask.isExam));
    setAnnouncement("Priority reset to its current value.");
  }

  function savePriority() {
    if (!selectedTask) return;
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === selectedTask.id
          ? { ...task, priority: draftPriority, isExam: draftExam }
          : task,
      ),
    );
    const examNote =
      draftExam && !selectedTask.isExam
        ? selectedTask.dueDate
          ? " Study sessions were added to your planner."
          : " Add a due date in the To-do list to schedule study sessions."
        : !draftExam && selectedTask.isExam
          ? " Its study sessions were removed."
          : "";
    setAnnouncement(`Priority saved as ${draftPriority}.${examNote}`);
  }

  return (
    <section aria-label="Priority setter" className="priority-setter">
      <header className="priority-setter__heading">
        <h1>Priority setter</h1>
        <p>Choose a task or goal and give it the focus it deserves.</p>
      </header>

      <div className="priority-editor">
        <section
          aria-labelledby="priority-task-heading"
          className="priority-task-selection"
        >
          <div className="priority-panel-heading">
            <h2 id="priority-task-heading">Select a task or goal</h2>
            <p>Choose one item to set its priority.</p>
          </div>

          <label className="priority-search">
            <img alt="" src="/assets/priority-search.svg" />
            <span className="visually-hidden">Search tasks and goals</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks and goals..."
              type="search"
              value={searchQuery}
            />
          </label>

          <div aria-hidden="true" className="priority-list-labels">
            <span>Task / Goal</span>
            <span>Priority</span>
          </div>

          <ul aria-label="Tasks and goals" className="priority-task-list">
            {filteredTasks.map((task) => {
              const isSelected = selectedTask?.id === task.id;
              return (
                <li key={task.id}>
                  <button
                    aria-pressed={isSelected}
                    className={`priority-task${isSelected ? " priority-task--selected" : ""}`}
                    onClick={() => selectTask(task)}
                    type="button"
                  >
                    <span aria-hidden="true" className="priority-task__indicator">
                      {isSelected && (
                        <img alt="" src="/assets/priority-selection.svg" />
                      )}
                    </span>
                    <span className="priority-task__details">
                      <strong>{task.title}</strong>
                      <span>
                        {[task.category, describeUrgency(task, today)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="priority-task__value">{task.priority}</span>
                  </button>
                </li>
              );
            })}
            {filteredTasks.length === 0 && (
              <li>
                <p className="priority-empty" role="status">
                  No tasks or goals match your search.
                </p>
              </li>
            )}
          </ul>

          <footer className="priority-selection-summary">
            <span>{tasks.length} tasks and goals</span>
            <strong>{selectedTask ? "1 selected" : "0 selected"}</strong>
          </footer>
        </section>

        <section
          aria-labelledby="priority-settings-heading"
          className="priority-settings"
        >
          <div className="priority-settings__form">
            <div className="priority-panel-heading">
              <h2 id="priority-settings-heading">Set priority</h2>
              <p>Decide what matters most for the selected item.</p>
            </div>

            {selectedTask ? (
              <>
                <div className="priority-selected-task">
                  <span>Selected task</span>
                  <strong>{selectedTask.title}</strong>
                  <div>
                    <span>{selectedTask.category}</span>
                    <span>Current priority: {selectedTask.priority}</span>
                  </div>
                </div>

                <fieldset className="priority-setter-options">
                  <legend>Priority level</legend>
                  {priorityOptions.map(({ value, description }) => {
                    const isSelected = draftPriority === value;
                    return (
                      <label
                        className={`priority-choice${isSelected ? " priority-choice--selected" : ""}`}
                        key={value}
                      >
                        <input
                          checked={isSelected}
                          className="priority-choice__input"
                          name="priority-level"
                          onChange={() => {
                            setDraftPriority(value);
                            setAnnouncement("");
                          }}
                          type="radio"
                          value={value}
                        />
                        <span aria-hidden="true" className="priority-choice__radio">
                          {isSelected && (
                            <img alt="" src="/assets/priority-radio.svg" />
                          )}
                        </span>
                        <span className="priority-choice__details">
                          <strong>{value}</strong>
                          <span>{description}</span>
                        </span>
                        {isSelected && (
                          <span className="priority-choice__selected">Selected</span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>

                <label
                  className={`priority-exam-option${draftExam ? " priority-exam-option--selected" : ""}`}
                >
                  <input
                    checked={draftExam}
                    onChange={(event) => {
                      setDraftExam(event.target.checked);
                      setAnnouncement("");
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>This is an exam</strong>
                    <span>
                      {draftExam && !selectedTask.dueDate
                        ? "Add a due date in the To-do list so Kadence can schedule study sessions."
                        : "Kadence will set aside study sessions in the days before it. Adjust them in Settings → Exam study sessions."}
                    </span>
                  </span>
                </label>
              </>
            ) : (
              <p className="priority-empty priority-empty--settings">
                Select a task to set its priority.
              </p>
            )}
          </div>

          <div className="priority-actions">
            <button
              className="priority-reset"
              disabled={!hasChanges}
              onClick={resetPriority}
              type="button"
            >
              Reset
            </button>
            <button
              className="priority-save"
              disabled={!hasChanges}
              onClick={savePriority}
              type="button"
            >
              <img alt="" src="/assets/priority-check.svg" />
              <span>Save priority</span>
            </button>
          </div>
          <p aria-live="polite" className="priority-announcement" role="status">
            {announcement}
          </p>
        </section>
      </div>

      <footer className="priority-guidance">
        <span>A little clarity now makes the next step easier.</span>
        <span>Listed most important first: priority, exams, then the nearest deadlines.</span>
      </footer>
    </section>
  );
}

export default PrioritySetter;
