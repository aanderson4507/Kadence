import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import "./VisualPlanner.css";

type PlannerCategory = "Personal" | "Focus" | "Wellbeing" | "Work";
type PlannerStatus = "Not started" | "In progress" | "Done";
type PlannerView = "Week" | "Day";
type PlannerScreen = "planner" | "add" | "edit";
type GoalSize = "Small" | "Medium" | "Big";
type PlannerTaskType = "Project" | "Task" | "Habit";

type PlannerEvent = {
  id: string;
  title: string;
  category: PlannerCategory;
  date: string;
  startHour: number;
  duration: number;
  description: string;
  status: PlannerStatus;
  taskType?: PlannerTaskType;
  goalSize?: GoalSize;
  linkedEventId?: string | null;
  notes?: string;
};

type PlannerDraft = Omit<
  PlannerEvent,
  "id" | "taskType" | "goalSize" | "linkedEventId" | "notes"
> & {
  taskType: PlannerTaskType;
  goalSize: GoalSize;
  linkedEventId: string | null;
  notes: string;
};

const plannerCategories: PlannerCategory[] = [
  "Personal",
  "Focus",
  "Wellbeing",
  "Work",
];
const plannerStatuses: PlannerStatus[] = [
  "Not started",
  "In progress",
  "Done",
];
const taskTypes: PlannerTaskType[] = ["Project", "Task", "Habit"];
const goalSizes: GoalSize[] = ["Small", "Medium", "Big"];
const timeSlots = [
  { label: "12 AM", hour: 0 },
  { label: "6 AM", hour: 6 },
  { label: "12 PM", hour: 12 },
  { label: "6 PM", hour: 18 },
];
const weekdayNames = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];
const initialWeekStart = new Date(2023, 7, 21);
const initialEvents: PlannerEvent[] = [
  {
    id: "reading-time",
    title: "Reading time",
    category: "Personal",
    date: "2023-08-21",
    startHour: 0,
    duration: 1,
    description: "Make time to read and ease into the week.",
    status: "Not started",
  },
  {
    id: "project-planning",
    title: "Project planning",
    category: "Work",
    date: "2023-08-23",
    startHour: 0,
    duration: 2,
    description: "Outline priorities and next steps for the week.",
    status: "Not started",
  },
  {
    id: "journaling",
    title: "Journaling",
    category: "Personal",
    date: "2023-08-24",
    startHour: 0,
    duration: 1,
    description: "Take a quiet moment to reflect and write.",
    status: "Not started",
  },
  {
    id: "slow-moments",
    title: "Slow moments",
    category: "Personal",
    date: "2023-08-27",
    startHour: 0,
    duration: 1,
    description: "Leave room for a slower start to the day.",
    status: "Not started",
  },
  {
    id: "deep-work",
    title: "Deep work",
    category: "Focus",
    date: "2023-08-22",
    startHour: 6,
    duration: 2,
    description: "Protect a block of focused work time.",
    status: "Not started",
  },
  {
    id: "finish-review",
    title: "Finish & review",
    category: "Focus",
    date: "2023-08-25",
    startHour: 6,
    duration: 2,
    description: "Complete the work in progress and review it.",
    status: "Not started",
  },
  {
    id: "get-outside",
    title: "Get outside",
    category: "Wellbeing",
    date: "2023-08-21",
    startHour: 12,
    duration: 1,
    description: "Step outside for some fresh air.",
    status: "Not started",
  },
  {
    id: "lunch-walk",
    title: "Lunch & a walk",
    category: "Wellbeing",
    date: "2023-08-23",
    startHour: 12,
    duration: 1,
    description: "Take a lunch break and go for a walk.",
    status: "Not started",
  },
  {
    id: "fresh-air-break",
    title: "Fresh air break",
    category: "Wellbeing",
    date: "2023-08-26",
    startHour: 12,
    duration: 1,
    description: "Take a short outdoor break.",
    status: "Not started",
  },
  {
    id: "capture-ideas",
    title: "Capture ideas",
    category: "Focus",
    date: "2023-08-22",
    startHour: 18,
    duration: 1,
    description: "Write down new ideas before wrapping up.",
    status: "Not started",
  },
  {
    id: "weekly-reset",
    title: "Weekly reset",
    category: "Wellbeing",
    date: "2023-08-27",
    startHour: 18,
    duration: 1,
    description: "Reset your space and prepare for the week ahead.",
    status: "Not started",
  },
];

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonday(date: Date) {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatWeekRange(start: Date) {
  const end = addDays(start, 7);
  const startMonth = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    start,
  );
  const endMonth = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    end,
  );
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`;
  }
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function formatHour(hour: number) {
  const normalizedHour = hour % 24;
  const period = normalizedHour < 12 ? "AM" : "PM";
  const clockHour = normalizedHour % 12 || 12;
  return { clockHour, period };
}

function formatTime(hour: number) {
  const { clockHour, period } = formatHour(hour);
  return `${clockHour}:00 ${period}`;
}

function formatTimeRange(startHour: number, duration: number) {
  const start = formatHour(startHour);
  const end = formatHour(startHour + duration);
  const startLabel = `${start.clockHour}:00`;
  const endLabel = `${end.clockHour}:00`;
  if (start.period === end.period) {
    return `${startLabel}–${endLabel} ${end.period}`;
  }
  return `${startLabel} ${start.period}–${endLabel} ${end.period}`;
}

function formatEventDate(event: PlannerEvent) {
  const date = dateFromKey(event.date);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    date,
  );
  return `${weekday}, ${formatShortDate(date)}  ·  ${formatTimeRange(event.startHour, event.duration)}`;
}

function formatDuration(duration: number) {
  return `${duration} ${duration === 1 ? "hour" : "hours"}`;
}

function VisualPlanner({
  onDataChange,
}: {
  onDataChange: (events: unknown[]) => void;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [view, setView] = useState<PlannerView>("Week");
  const [focusedDate, setFocusedDate] = useState("2023-08-23");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    "project-planning",
  );
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [screen, setScreen] = useState<PlannerScreen>("planner");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlannerDraft>(() => createEmptyDraft());
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? null;

  useEffect(() => {
    onDataChange(events);
  }, [events, onDataChange]);
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const visibleDays =
    view === "Day" ? [dateFromKey(focusedDate)] : weekDays;
  const visibleDateKeys = new Set(visibleDays.map(toDateKey));
  const visibleEvents = events.filter((event) =>
    visibleDateKeys.has(event.date),
  );
  const sortedEvents = [...visibleEvents].sort(
    (first, second) => first.startHour - second.startHour,
  );
  const dayViewDate = view === "Day" ? dateFromKey(focusedDate) : null;

  function openNewEventPage() {
    setEditingEventId(null);
    setDeleteConfirmationOpen(false);
    const defaultDate =
      view === "Day" || visibleDateKeys.has(focusedDate)
        ? focusedDate
        : toDateKey(weekStart);
    setDraft({
      ...createEmptyDraft(defaultDate),
      linkedEventId:
        events.find((plannerEvent) => plannerEvent.id === "project-planning")?.id ??
        events[0]?.id ??
        null,
    });
    setScreen("add");
  }

  function openEditEventPage() {
    if (!selectedEvent) return;
    setEditingEventId(selectedEvent.id);
    setDeleteConfirmationOpen(false);
    setDraft({
      title: selectedEvent.title,
      category: selectedEvent.category,
      date: selectedEvent.date,
      startHour: selectedEvent.startHour,
      duration: selectedEvent.duration,
      description: selectedEvent.description,
      status: selectedEvent.status,
      taskType: selectedEvent.taskType ?? "Project",
      goalSize: selectedEvent.goalSize ?? "Medium",
      linkedEventId: selectedEvent.linkedEventId ?? null,
      notes: selectedEvent.notes ?? "",
    });
    setScreen("edit");
  }

  function movePeriod(direction: -1 | 1) {
    if (view === "Day") {
      setFocusedDate(toDateKey(addDays(dateFromKey(focusedDate), direction)));
      setSelectedEventId(null);
      return;
    }
    const nextWeek = addDays(weekStart, direction * 7);
    setWeekStart(nextWeek);
    setFocusedDate(toDateKey(nextWeek));
    setSelectedEventId(null);
  }

  function selectEvent(event: PlannerEvent) {
    setSelectedEventId(event.id);
    setFocusedDate(event.date);
  }

  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const savedEvent: PlannerEvent = {
      ...draft,
      title,
      description: draft.description.trim(),
      notes: draft.notes.trim(),
      linkedEventId: draft.linkedEventId,
      id: editingEventId ?? `planner-event-${crypto.randomUUID()}`,
    };

    setEvents((currentEvents) =>
      editingEventId
        ? currentEvents.map((currentEvent) =>
            currentEvent.id === editingEventId ? savedEvent : currentEvent,
          )
        : [...currentEvents, savedEvent],
    );
    setSelectedEventId(savedEvent.id);
    setFocusedDate(savedEvent.date);
    setWeekStart(getMonday(dateFromKey(savedEvent.date)));
    setView("Week");
    setScreen("planner");
    setEditingEventId(null);
    setDeleteConfirmationOpen(false);
  }

  function cancelTaskForm() {
    setScreen("planner");
    setEditingEventId(null);
    setDeleteConfirmationOpen(false);
  }

  function deleteSelectedEvent() {
    if (!editingEventId) return;
    setEvents((currentEvents) =>
      currentEvents.filter((event) => event.id !== editingEventId),
    );
    setSelectedEventId(null);
    setScreen("planner");
    setEditingEventId(null);
    setDeleteConfirmationOpen(false);
  }

  function updateDraft<Key extends keyof PlannerDraft>(
    key: Key,
    value: PlannerDraft[Key],
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  return (
    <section
      aria-label="Visual planner"
      className={`visual-planner${screen !== "planner" ? " visual-planner--form" : ""}${screen === "edit" ? " visual-planner--edit" : ""}`}
    >
      {screen === "planner" ? (
        <>
      <header className="planner-header">
        <div className="planner-header__intro">
          <div className="planner-header__title">
            <img alt="" src="/assets/planner-calendar.svg" />
            <h1>Weekly planner</h1>
          </div>
          <p>A little structure. A little room to breathe.</p>
        </div>
        <button
          className="planner-add-button"
          onClick={openNewEventPage}
          type="button"
        >
          <img alt="" src="/assets/planner-add.svg" />
          <span>Add a new task</span>
        </button>
      </header>

      <section aria-label="Information about Task" className="planner-task-info">
        <div className="planner-task-info__heading">
          <h2>
            <img alt="" src="/assets/planner-info.svg" />
            Information about Task
          </h2>
          <p>Select a task in your week to see its details</p>
        </div>
        {selectedEvent ? (
          <div className="planner-task-info__content">
            <div className="planner-task-info__summary">
              <span
                className={`planner-category-dot planner-category-dot--${categoryClass(selectedEvent.category)}`}
              />
              <span
                className={`planner-task-info__category planner-task-info__category--${categoryClass(selectedEvent.category)}`}
              >
                {selectedEvent.category}
              </span>
              <h3>{selectedEvent.title}</h3>
            </div>
            <ul className="planner-task-info__details">
              <li>{selectedEvent.description || "No description added."}</li>
              <li>{formatEventDate(selectedEvent)}</li>
              <li>
                {selectedEvent.status} ·{" "}
                {selectedEvent.status === "Done"
                  ? "Nice work getting this done."
                  : "Make space for focused work"}
              </li>
            </ul>
            <button
              aria-label={`Edit ${selectedEvent.title}`}
              className="planner-edit-button"
              onClick={openEditEventPage}
              type="button"
            >
              <img alt="" src="/assets/planner-edit.svg" />
            </button>
          </div>
        ) : (
          <p className="planner-task-info__empty">
            Choose a task in your week to see its details.
          </p>
        )}
      </section>

      <section aria-label="Weekly calendar" className="planner-calendar">
        <div className="planner-calendar__toolbar">
          <div className="planner-week-navigation">
            <button
              aria-label={view === "Week" ? "Previous week" : "Previous day"}
              className="planner-nav-button"
              onClick={() => movePeriod(-1)}
              type="button"
            >
              <img alt="" src="/assets/planner-chevron-left.svg" />
            </button>
            <h2>
              {dayViewDate
                ? formatShortDate(dayViewDate)
                : formatWeekRange(weekStart)}
            </h2>
            <button
              aria-label={view === "Week" ? "Next week" : "Next day"}
              className="planner-nav-button"
              onClick={() => movePeriod(1)}
              type="button"
            >
              <img alt="" src="/assets/planner-chevron-right.svg" />
            </button>
          </div>
          <div className="planner-calendar__tools">
            <span>
              {visibleEvents.length}{" "}
              {visibleEvents.length === 1 ? "task" : "tasks"} this{" "}
              {view.toLowerCase()}
            </span>
            <div className="planner-view-picker">
              <button
                aria-expanded={viewMenuOpen}
                aria-haspopup="listbox"
                className="planner-view-picker__trigger"
                onClick={() => setViewMenuOpen((isOpen) => !isOpen)}
                type="button"
              >
                <img alt="" src="/assets/planner-columns.svg" />
                <span>{view}</span>
                <img
                  alt=""
                  className="planner-view-picker__chevron"
                  src="/assets/planner-chevron-down.svg"
                />
              </button>
              {viewMenuOpen && (
                <div
                  aria-label="Calendar view"
                  className="planner-view-picker__menu"
                  role="listbox"
                >
                  {(["Week", "Day"] as PlannerView[]).map((option) => (
                    <button
                      aria-selected={view === option}
                      className="planner-view-picker__option"
                      key={option}
                      onClick={() => {
                        setView(option);
                        setViewMenuOpen(false);
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
          </div>
        </div>

        <div aria-label={`${view} schedule`} className="planner-calendar__scroll">
          <div
            className="planner-calendar__grid"
            style={{ "--planner-day-count": visibleDays.length } as CSSProperties}
          >
            <div className="planner-days-heading">
              <div className="planner-time-heading">Time</div>
              {visibleDays.map((date) => {
                const dateKey = toDateKey(date);
                return (
                  <button
                    aria-current={focusedDate === dateKey ? "date" : undefined}
                    className={`planner-day-heading${focusedDate === dateKey ? " planner-day-heading--active" : ""}`}
                    key={dateKey}
                    onClick={() => {
                      setFocusedDate(dateKey);
                      if (selectedEvent?.date !== dateKey) {
                        setSelectedEventId(null);
                      }
                    }}
                    type="button"
                  >
                    <span>{weekdayNames[date.getDay()]}</span>
                    <strong>{date.getDate()}</strong>
                  </button>
                );
              })}
            </div>

            <div className="planner-schedule">
              <div aria-hidden="true" className="planner-time-column">
                {timeSlots.map((slot) => (
                  <span key={slot.label}>{slot.label}</span>
                ))}
              </div>
              {visibleDays.map((date) => {
                const dateKey = toDateKey(date);
                const dayEvents = sortedEvents.filter(
                  (event) => event.date === dateKey,
                );
                return (
                  <div
                    aria-label={`${date.toLocaleDateString("en-US", { weekday: "long" })}, ${formatShortDate(date)}`}
                    className="planner-day-column"
                    key={dateKey}
                  >
                    {dayEvents.map((event) => (
                      <button
                        aria-pressed={selectedEventId === event.id}
                        className={`planner-event planner-event--${categoryClass(event.category)}${selectedEventId === event.id ? " planner-event--selected" : ""}`}
                        key={event.id}
                        onClick={() => selectEvent(event)}
                        style={{ "--planner-event-row": event.startHour / 6 } as CSSProperties}
                        type="button"
                      >
                        <span className="planner-event__accent" />
                        <span className="planner-event__title">{event.title}</span>
                        <span className="planner-event__duration">
                          {formatDuration(event.duration)}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="planner-legend">
          <div className="planner-legend__categories">
            {plannerCategories.map((category) => (
              <span
                className="planner-legend__category"
                key={category}
              >
                <i className={`planner-category-dot planner-category-dot--${categoryClass(category)}`} />
                {category}
              </span>
            ))}
          </div>
          <span>Your week, at a glance.</span>
        </footer>
      </section>
        </>
      ) : screen === "add" ? (
        <div className="planner-create-page">
          <button
            className="planner-back-link"
            onClick={cancelTaskForm}
            type="button"
          >
            <span aria-hidden="true">←</span> Weekly planner
          </button>
          <div className="planner-create-page__body">
            <form
              aria-labelledby="planner-create-title"
              className="planner-create-card"
              onSubmit={saveEvent}
            >
              <header className="planner-create-card__heading">
                <div className="planner-create-card__identity">
                  <span aria-hidden="true">+</span>
                  <h1 id="planner-create-title">Add Task</h1>
                </div>
                <p>A little structure. A little room to breathe.</p>
              </header>
              <div className="planner-create-card__fields">
                <label className="planner-create-field planner-create-field--row">
                  <span>Name</span>
                  <input
                    autoFocus
                    onChange={(event) => updateDraft("title", event.target.value)}
                    placeholder="AI project"
                    required
                    value={draft.title}
                  />
                </label>
                <label className="planner-create-field planner-create-field--row">
                  <span>Due Date</span>
                  <input
                    onChange={(event) => updateDraft("date", event.target.value)}
                    required
                    type="date"
                    value={draft.date}
                  />
                </label>
                <label className="planner-create-field planner-create-field--row">
                  <span>Task Type</span>
                  <select
                    onChange={(event) =>
                      updateDraft("taskType", event.target.value as PlannerTaskType)
                    }
                    value={draft.taskType}
                  >
                    {taskTypes.map((taskType) => (
                      <option key={taskType} value={taskType}>
                        {taskType}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="planner-create-field planner-create-field--stacked">
                  <legend>Goal Size</legend>
                  <div className="planner-segmented-control">
                    {goalSizes.map((goalSize) => (
                      <button
                        aria-pressed={draft.goalSize === goalSize}
                        className={draft.goalSize === goalSize ? "is-selected" : ""}
                        key={goalSize}
                        onClick={() => updateDraft("goalSize", goalSize)}
                        type="button"
                      >
                        {goalSize}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="planner-create-field planner-create-field--stacked">
                  <legend>Connection</legend>
                  <div className="planner-segmented-control">
                    <button
                      aria-pressed={draft.linkedEventId !== null}
                      className={draft.linkedEventId !== null ? "is-selected" : ""}
                      onClick={() =>
                        updateDraft(
                          "linkedEventId",
                          draft.linkedEventId ?? selectedEvent?.id ?? events[0]?.id ?? null,
                        )
                      }
                      type="button"
                    >
                      Connect to:
                    </button>
                    <button
                      aria-pressed={draft.linkedEventId === null}
                      className={draft.linkedEventId === null ? "is-selected" : ""}
                      onClick={() => updateDraft("linkedEventId", null)}
                      type="button"
                    >
                      No connection
                    </button>
                  </div>
                </fieldset>
                {draft.linkedEventId !== null && (
                  <label className="planner-create-field planner-create-field--row">
                    <span>Linked Task</span>
                    <select
                      onChange={(event) =>
                        updateDraft("linkedEventId", event.target.value || null)
                      }
                      value={draft.linkedEventId ?? ""}
                    >
                      {events.map((plannerEvent) => (
                        <option key={plannerEvent.id} value={plannerEvent.id}>
                          {plannerEvent.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <footer className="planner-create-card__actions">
                <button
                  className="planner-create-card__cancel"
                  onClick={cancelTaskForm}
                  type="button"
                >
                  Cancel
                </button>
                <button className="planner-create-card__submit" type="submit">
                  <img alt="" src="/assets/planner-add.svg" /> Add task
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : (
        <form className="planner-edit-page" onSubmit={saveEvent}>
          <header className="planner-edit-page__header">
            <div>
              <h1>
                <img alt="" src="/assets/planner-edit.svg" /> Edit Task
              </h1>
              <p>Make changes and save when you&apos;re ready.</p>
            </div>
            <div className="planner-edit-page__top-actions">
              <button
                className="planner-edit-page__cancel"
                onClick={cancelTaskForm}
                type="button"
              >
                × Cancel
              </button>
              <button className="planner-edit-page__save" type="submit">
                ✓ Save changes
              </button>
            </div>
          </header>
          <div className="planner-edit-page__details">
            <section className="planner-edit-page__left">
              <label className="planner-edit-field">
                <span>Task Title</span>
                <input
                  autoFocus
                  onChange={(event) => updateDraft("title", event.target.value)}
                  required
                  value={draft.title}
                />
              </label>
              <div className="planner-edit-field">
                <label htmlFor="planner-edit-category">Category</label>
                <select
                  id="planner-edit-category"
                  onChange={(event) =>
                    updateDraft("category", event.target.value as PlannerCategory)
                  }
                  value={draft.category}
                >
                  {plannerCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <div className="planner-category-chips">
                  {plannerCategories.map((category) => (
                    <button
                      aria-pressed={draft.category === category}
                      className={`planner-category-chip planner-category-chip--${categoryClass(category)}${draft.category === category ? " is-selected" : ""}`}
                      key={category}
                      onClick={() => updateDraft("category", category)}
                      type="button"
                    >
                      <i className={`planner-category-dot planner-category-dot--${categoryClass(category)}`} />
                      {category}
                      {draft.category === category && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <fieldset className="planner-edit-field">
                <legend>Status</legend>
                <div className="planner-status-chips">
                  {plannerStatuses.map((status) => (
                    <button
                      aria-pressed={draft.status === status}
                      className={draft.status === status ? "is-selected" : ""}
                      key={status}
                      onClick={() => updateDraft("status", status)}
                      type="button"
                    >
                      <span aria-hidden="true">
                        {status === "Done" ? "✓" : status === "In progress" ? "◌" : "○"}
                      </span>
                      {status}
                    </button>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="planner-edit-page__right">
              <label className="planner-edit-field">
                <span>Date</span>
                <input
                  onChange={(event) => updateDraft("date", event.target.value)}
                  required
                  type="date"
                  value={draft.date}
                />
              </label>
              <div className="planner-edit-field">
                <span>Time</span>
                <div className="planner-edit-time">
                  <label>
                    <span className="visually-hidden">Start time</span>
                    <select
                      onChange={(event) => {
                        const startHour = Number(event.target.value);
                        updateDraft("startHour", startHour);
                        if (startHour + draft.duration > 24) {
                          updateDraft("duration", 24 - startHour);
                        }
                      }}
                      value={draft.startHour}
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <option key={hour} value={hour}>{formatTime(hour)}</option>
                      ))}
                    </select>
                  </label>
                  <span>to</span>
                  <label>
                    <span className="visually-hidden">End time</span>
                    <select
                      onChange={(event) =>
                        updateDraft(
                          "duration",
                          Number(event.target.value) - draft.startHour,
                        )
                      }
                      value={draft.startHour + draft.duration}
                    >
                      {Array.from(
                        { length: 24 - draft.startHour },
                        (_, index) => draft.startHour + index + 1,
                      ).map((endHour) => (
                        <option key={endHour} value={endHour}>
                          {endHour === 24 ? "12:00 AM" : formatTime(endHour)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <small>Duration: {formatDuration(draft.duration)}</small>
              </div>
              <div className="planner-edit-field">
                <span>Week context</span>
                <div className="planner-week-context">
                  {Array.from({ length: 7 }, (_, index) => {
                    const date = addDays(getMonday(dateFromKey(draft.date)), index);
                    const isSelected = toDateKey(date) === draft.date;
                    return (
                      <div className="planner-week-context__day" key={toDateKey(date)}>
                        <span>
                          {new Intl.DateTimeFormat("en-US", { weekday: "short" })
                            .format(date)
                            .replace(".", "")}
                        </span>
                        <span className={isSelected ? "is-selected" : ""}>
                          {date.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <div className="planner-edit-page__notes">
            <label className="planner-edit-field">
              <span>Description</span>
              <textarea
                onChange={(event) => updateDraft("description", event.target.value)}
                value={draft.description}
              />
            </label>
            <label className="planner-edit-field">
              <span>Additional Notes</span>
              <textarea
                onChange={(event) => updateDraft("notes", event.target.value)}
                value={draft.notes}
              />
            </label>
          </div>

          <footer className="planner-edit-page__footer">
            <span className={`planner-category-chip planner-category-chip--${categoryClass(draft.category)}`}>
              <i className={`planner-category-dot planner-category-dot--${categoryClass(draft.category)}`} />
              {draft.category} · {draft.title || "Untitled task"}
            </span>
            <div>
              <button
                className="planner-edit-page__cancel"
                onClick={cancelTaskForm}
                type="button"
              >
                × Cancel
              </button>
              <button className="planner-edit-page__save" type="submit">
                ✓ Save changes
              </button>
            </div>
          </footer>

          <section aria-label="Danger zone" className="planner-danger-zone">
            <h2>Danger zone</h2>
            {deleteConfirmationOpen ? (
              <div className="planner-danger-zone__confirm" role="alert">
                <p>Delete this task? This can&apos;t be undone.</p>
                <button
                  className="planner-danger-zone__cancel"
                  onClick={() => setDeleteConfirmationOpen(false)}
                  type="button"
                >
                  Keep task
                </button>
                <button
                  className="planner-danger-zone__delete"
                  onClick={deleteSelectedEvent}
                  type="button"
                >
                  Delete task
                </button>
              </div>
            ) : (
              <button
                className="planner-danger-zone__button"
                onClick={() => setDeleteConfirmationOpen(true)}
                type="button"
              >
                <span aria-hidden="true">⌫</span> Delete this task
              </button>
            )}
          </section>
        </form>
      )}
    </section>
  );
}

function createEmptyDraft(date = toDateKey(initialWeekStart)): PlannerDraft {
  return {
    title: "",
    category: "Work",
    date,
    startHour: 12,
    duration: 1,
    description: "",
    status: "Not started",
    taskType: "Project",
    goalSize: "Medium",
    linkedEventId: "project-planning",
    notes: "",
  };
}

function categoryClass(category: PlannerCategory) {
  return category.toLowerCase();
}

export default VisualPlanner;
