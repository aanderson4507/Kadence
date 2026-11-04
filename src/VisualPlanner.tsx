import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
} from "react";
import "./VisualPlanner.css";

type PlannerCategory = "Personal" | "Focus" | "Wellbeing" | "Work";
type PlannerStatus = "Not started" | "In progress" | "Completed";
type PlannerView = "Week" | "Day";

type PlannerEvent = {
  id: string;
  title: string;
  category: PlannerCategory;
  date: string;
  startHour: number;
  duration: number;
  description: string;
  status: PlannerStatus;
};

type PlannerDraft = Omit<PlannerEvent, "id">;

const plannerCategories: PlannerCategory[] = [
  "Personal",
  "Focus",
  "Wellbeing",
  "Work",
];
const plannerStatuses: PlannerStatus[] = [
  "Not started",
  "In progress",
  "Completed",
];
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

function VisualPlanner() {
  const [events, setEvents] = useState(initialEvents);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [view, setView] = useState<PlannerView>("Week");
  const [focusedDate, setFocusedDate] = useState("2023-08-23");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    "project-planning",
  );
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlannerDraft>(() => createEmptyDraft());
  const taskDialog = useRef<HTMLDialogElement>(null);

  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? null;
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

  useEffect(() => {
    const dialog = taskDialog.current;
    if (dialogOpen && dialog && !dialog.open) dialog.showModal();
    else if (!dialogOpen && dialog?.open) dialog.close();
  }, [dialogOpen]);

  function openNewEventDialog() {
    setEditingEventId(null);
    const defaultDate =
      view === "Day" || visibleDateKeys.has(focusedDate)
        ? focusedDate
        : toDateKey(weekStart);
    setDraft(createEmptyDraft(defaultDate));
    setDialogOpen(true);
  }

  function openEditEventDialog() {
    if (!selectedEvent) return;
    setEditingEventId(selectedEvent.id);
    setDraft({
      title: selectedEvent.title,
      category: selectedEvent.category,
      date: selectedEvent.date,
      startHour: selectedEvent.startHour,
      duration: selectedEvent.duration,
      description: selectedEvent.description,
      status: selectedEvent.status,
    });
    setDialogOpen(true);
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
    setDialogOpen(false);
  }

  function closeDialogOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) setDialogOpen(false);
  }

  return (
    <section aria-label="Visual planner" className="visual-planner">
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
          onClick={openNewEventDialog}
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
                {selectedEvent.status === "Completed"
                  ? "Nice work getting this done."
                  : "Make space for focused work"}
              </li>
            </ul>
            <button
              aria-label={`Edit ${selectedEvent.title}`}
              className="planner-edit-button"
              onClick={openEditEventDialog}
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

      {dialogOpen && (
        <dialog
          aria-labelledby="planner-dialog-title"
          className="planner-dialog"
          onClick={closeDialogOnBackdrop}
          onCancel={(event) => {
            event.preventDefault();
            setDialogOpen(false);
          }}
          ref={taskDialog}
        >
          <form className="planner-dialog__form" onSubmit={saveEvent}>
            <div className="planner-dialog__heading">
              <div>
                <h2 id="planner-dialog-title">
                  {editingEventId ? "Edit task" : "Add a new task"}
                </h2>
                <p>Give this time a purpose that matters to you.</p>
              </div>
              <button
                aria-label="Close dialog"
                className="planner-dialog__close"
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <label className="planner-dialog__field">
              Task name
              <input
                autoFocus
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Plan the week"
                required
                value={draft.title}
              />
            </label>
            <div className="planner-dialog__row">
              <label className="planner-dialog__field">
                Category
                <select
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      category: event.target.value as PlannerCategory,
                    }))
                  }
                  value={draft.category}
                >
                  {plannerCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="planner-dialog__field">
                Status
                <select
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      status: event.target.value as PlannerStatus,
                    }))
                  }
                  value={draft.status}
                >
                  {plannerStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="planner-dialog__row">
              <label className="planner-dialog__field">
                Date
                <input
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      date: event.target.value,
                    }))
                  }
                  required
                  type="date"
                  value={draft.date}
                />
              </label>
              <label className="planner-dialog__field">
                Start time
                <select
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      startHour: Number(event.target.value),
                    }))
                  }
                  value={draft.startHour}
                >
                  {timeSlots.map((slot) => (
                    <option key={slot.hour} value={slot.hour}>
                      {formatTime(slot.hour)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="planner-dialog__row">
              <label className="planner-dialog__field">
                Duration
                <select
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      duration: Number(event.target.value),
                    }))
                  }
                  value={draft.duration}
                >
                  {[1, 2, 3, 4].map((duration) => (
                    <option key={duration} value={duration}>
                      {formatDuration(duration)}
                    </option>
                  ))}
                </select>
              </label>
              <span aria-hidden="true" />
            </div>
            <label className="planner-dialog__field">
              Description
              <textarea
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    description: event.target.value,
                  }))
                }
                placeholder="Add a few details..."
                rows={3}
                value={draft.description}
              />
            </label>
            <div className="planner-dialog__actions">
              <button
                className="planner-dialog__cancel"
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="planner-dialog__save" type="submit">
                {editingEventId ? "Save changes" : "Add task"}
              </button>
            </div>
          </form>
        </dialog>
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
  };
}

function categoryClass(category: PlannerCategory) {
  return category.toLowerCase();
}

export default VisualPlanner;
