import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import "./App.css";
import Breakdown from "./Breakdown";
import Goals, { type Goal } from "./Goals";
import PrioritySetter from "./PrioritySetter";
import Settings from "./Settings";
import {
  DEFAULT_STUDY_PREFERENCES,
  scheduleStudySessions,
  type StudyPreferences,
} from "./studySessions";
import { todayKey } from "./taskPriority";
import TodoList, { initialTasks, type Task } from "./TodoList";
import VisualPlanner, { type PlannerEvent } from "./VisualPlanner";

type View = {
  label: string;
  icon: string;
};

const initialViews: View[] = [
  { label: "Goals", icon: "/assets/tab-goals-todo.svg" },
  { label: "To do", icon: "/assets/tab-todo-selected.svg" },
  { label: "Breakdown", icon: "/assets/tab-breakdown-todo.svg" },
  { label: "Priority", icon: "/assets/tab-priority-todo.svg" },
  { label: "Visual Planner", icon: "/assets/planner-tab-chart.svg" },
];

type UtilityMenu = "notifications" | "profile" | null;

type ThemePreference = "Light mode" | "Dark mode" | "System default";

type PanelResizeStart = {
  pointerId: number;
  leftLabel: string;
  rightLabel: string;
  startX: number;
  leftSize: number;
  rightSize: number;
  containerWidth: number;
};

const minimumPanelWidth = 320;

function Dashboard({
  themePreference,
  onThemeChange,
}: {
  themePreference: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const isDarkMode =
    themePreference === "Dark mode" ||
    (themePreference === "System default" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [views, setViews] = useState(initialViews);
  const [activeView, setActiveView] = useState<string | null>("To do");
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [panelSizes, setPanelSizes] = useState<Record<string, number>>({});
  const panelResizeStart = useRef<PanelResizeStart | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<UtilityMenu>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [quickSetupRequest, setQuickSetupRequest] = useState(0);

  function openQuickSetup() {
    setViews((current) => current.some((view) => view.label === "Visual Planner")
      ? current : [...current, initialViews.find((view) => view.label === "Visual Planner")!]);
    setSettingsOpen(false);
    setOpenMenu(null);
    setSearchOpen(false);
    setSearchQuery("");
    setActiveView("Visual Planner");
    setQuickSetupRequest((current) => current + 1);
  }
  const [showWeeklyReviewReminder, setShowWeeklyReviewReminder] =
  useState(false);

useEffect(() => {
  const today = new Date();

  // Sunday is the weekly review reminder day.
  if (today.getDay() !== 0) return;

  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);

  // Calculate Monday of the current week.
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const weekKey = [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, "0"),
    String(weekStart.getDate()).padStart(2, "0"),
  ].join("-");

  const storageKey = `kadence-weekly-review-${weekKey}`;

  // Show the reminder only once during the current week.
  if (localStorage.getItem(storageKey) !== "shown") {
    localStorage.setItem(storageKey, "shown");
    setShowWeeklyReviewReminder(true);
    setOpenMenu("notifications");
  }
}, []);

  const upcomingReminders = tasks.filter((task) => {
  if (task.completed || !task.dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.dueDate}T00:00:00`);

  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysUntilDue >= 0 && daysUntilDue <= 7;
});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goalsForExport, setGoalsForExport] = useState<Goal[]>([]);
  const [plannerEvents, setPlannerEvents] = useState<PlannerEvent[]>([]);
  const [studyPreferences, setStudyPreferences] =
    useState<StudyPreferences>(DEFAULT_STUDY_PREFERENCES);

  // Study sessions are recalculated whenever exams, study settings or the planner change,
  // so they always fit around the student's own events.
  const studyPlan = useMemo(() => {
    const now = new Date();
    return scheduleStudySessions(tasks, studyPreferences, plannerEvents, {
      today: todayKey(now),
      currentHour: now.getHours() + now.getMinutes() / 60,
    });
  }, [tasks, studyPreferences, plannerEvents]);

  const visibleViews = views.filter((view) =>
    view.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const isPanelLayout = splitViewOpen && views.length > 1;
  const selectedView = views.find((view) => view.label === activeView) ?? views[0];
  const panelViews = isPanelLayout ? views : selectedView ? [selectedView] : [];
  const panelGridColumns = panelViews
    .flatMap((view, index) => [
      `minmax(${isPanelLayout ? `${minimumPanelWidth}px` : "0"}, ${panelSizes[view.label] ?? 1}fr)`,
      ...(index < panelViews.length - 1 ? ["12px"] : []),
    ])
    .join(" ");
  const panelGridWidth = isPanelLayout
    ? `max(100%, calc(${minimumPanelWidth * panelViews.length + 12 * (panelViews.length - 1)}px + 15vw))`
    : "100%";

  function getMinimumPanelSize(totalSize: number, containerWidth: number) {
    return Math.min(
      totalSize / 2,
      (minimumPanelWidth / Math.max(containerWidth, minimumPanelWidth * 2)) * totalSize,
    );
  }

  function resizePanels(
    event: ReactPointerEvent<HTMLButtonElement>,
    leftView: View,
    rightView: View,
  ) {
    if (event.type === "pointerdown") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panelResizeStart.current = {
        pointerId: event.pointerId,
        leftLabel: leftView.label,
        rightLabel: rightView.label,
        startX: event.clientX,
        leftSize: panelSizes[leftView.label] ?? 1,
        rightSize: panelSizes[rightView.label] ?? 1,
        containerWidth: event.currentTarget.parentElement?.clientWidth ?? window.innerWidth,
      };
      return;
    }

    const resizeStart = panelResizeStart.current;
    if (!resizeStart || resizeStart.pointerId !== event.pointerId) return;

    if (event.type === "pointerup" || event.type === "pointercancel") {
      panelResizeStart.current = null;
      return;
    }

    const totalSize = resizeStart.leftSize + resizeStart.rightSize;
    const minimumSize = getMinimumPanelSize(totalSize, resizeStart.containerWidth);
    const leftSize = Math.min(
      totalSize - minimumSize,
      Math.max(
        minimumSize,
        resizeStart.leftSize +
          ((event.clientX - resizeStart.startX) / resizeStart.containerWidth) * totalSize,
      ),
    );

    setPanelSizes((currentSizes) => ({
      ...currentSizes,
      [resizeStart.leftLabel]: leftSize,
      [resizeStart.rightLabel]: totalSize - leftSize,
    }));
  }

  function handlePanelResizeKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    leftView: View,
    rightView: View,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();

    const leftSize = panelSizes[leftView.label] ?? 1;
    const rightSize = panelSizes[rightView.label] ?? 1;
    const totalSize = leftSize + rightSize;
    const step = totalSize * 0.05;
    const containerWidth =
      event.currentTarget.parentElement?.clientWidth ?? window.innerWidth;
    const minimumSize = getMinimumPanelSize(totalSize, containerWidth);
    const nextLeftSize = Math.min(
      totalSize - minimumSize,
      Math.max(minimumSize, leftSize + (event.key === "ArrowRight" ? step : -step)),
    );

    setPanelSizes((currentSizes) => ({
      ...currentSizes,
      [leftView.label]: nextLeftSize,
      [rightView.label]: totalSize - nextLeftSize,
    }));
  }

  function renderView(view: View) {
    switch (view.label) {
      case "To do":
        return <TodoList tasks={tasks} setTasks={setTasks} />;
      case "Breakdown":
        return <Breakdown tasks={tasks} />;
      case "Goals":
        return (
          <Goals
            activeView={activeView}
            onDataChange={setGoalsForExport}
            onOpenBreakdown={() => setActiveView("Breakdown")}
            onOpenSettings={() => {
              setSettingsOpen(true);
              setOpenMenu(null);
            }}
            onSelectView={setActiveView}
          />
        );
      case "Priority":
        return <PrioritySetter tasks={tasks} setTasks={setTasks} />;
      case "Visual Planner":
        return <VisualPlanner onDataChange={setPlannerEventsForExport} quickSetupRequest={quickSetupRequest} />;
      default:
        return null;
    }
  }

  function closeView(label: string) {
    const closingIndex = views.findIndex((view) => view.label === label);
    const nextViews = views.filter((view) => view.label !== label);

    setViews(nextViews);
    if (nextViews.length < 2) setSplitViewOpen(false);
    if (activeView === label) {
      setActiveView(nextViews[Math.min(closingIndex, nextViews.length - 1)]?.label ?? null);
    }
  }

  function toggleMenu(menu: Exclude<UtilityMenu, null>) {
    setSettingsOpen(false);
    setOpenMenu((currentMenu) => (currentMenu === menu ? null : menu));
    setSearchOpen(false);
    setSearchQuery("");
  }

  function toggleSettings() {
    setSettingsOpen((isOpen) => !isOpen);
    setOpenMenu(null);
    setSearchOpen(false);
    setSearchQuery("");
  }

  function exportKadenceData(preferences: object) {
    const serializedData = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        preferences,
        tasks,
        goals: goalsForExport,
        plannerEvents,
        studySessions: studyPlan.sessions,
      },
      null,
      2,
    );
    if (serializedData === undefined) {
      throw new Error("Unable to serialize Kadence data for export.");
    }

    const data = new Blob([serializedData], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "kadence-data-export.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      setSearchQuery("");
    }
  }

  function restoreViews() {
    setViews(initialViews);
    setActiveView("To do");
    setSplitViewOpen(false);
    setPanelSizes({});
    setSearchQuery("");
  }

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <a className="workspace-brand" href="/" aria-label="Kadence home">
          <span className="brand-mark" aria-hidden="true">
            <img src="/assets/brand-sprout.svg" alt="" />
          </span>
          <span className="brand-name">Kadence</span>
          <span className="brand-divider" aria-hidden="true" />
        </a>

        <div className="workspace-utilities">
          <div className="current-date">
            <button
              aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
              aria-pressed={isDarkMode}
              className="theme-toggle"
              onClick={() =>
                onThemeChange(isDarkMode ? "Light mode" : "Dark mode")
              }
              type="button"
            >
              <img
                alt=""
                height="16"
                src={isDarkMode ? "/assets/moon-dark.svg" : "/assets/sun-todo.svg"}
                width="16"
              />
            </button>
            <span>Thursday, October 8</span>
          </div>

          <div className="utility-control">
            {searchOpen ? (
              <div className="search-control">
                <label className="search-field">
                  <span className="visually-hidden">Search views</span>
                  <input
                    autoFocus
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search views"
                    value={searchQuery}
                  />
                </label>
                <button
                  aria-label="Close search"
                  className="icon-button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  type="button"
                >
                  <img src="/assets/close-todo.svg" alt="" />
                </button>
              </div>
            ) : (
              <button
                aria-label="Search views"
                className="icon-button"
                onClick={() => {
                  setSearchOpen(true);
                  setOpenMenu(null);
                }}
                type="button"
              >
                <img src="/assets/search.svg" alt="" />
              </button>
            )}
          </div>

          <UtilityButton
            active={openMenu === "notifications"}
            label="Notifications"
            onClick={() => toggleMenu("notifications")}
            src="/assets/notifications.svg"
            badgeCount={
              upcomingReminders.length + (showWeeklyReviewReminder ? 1 : 0)
            }
          />
          <UtilityButton
            active={settingsOpen}
            label="Settings"
            onClick={toggleSettings}
            src="/assets/settings.svg"
          />
          <div className="utility-control">
            <button
              aria-expanded={openMenu === "profile"}
              aria-label="Open profile menu"
              className="profile-button"
              onClick={() => toggleMenu("profile")}
              type="button"
            >
              AL
            </button>
          </div>
        </div>

        {openMenu && (
          <div className="utility-popover" role="status">
            {openMenu === "notifications" && (
              <>
                <strong>Notifications</strong>

                {showWeeklyReviewReminder && (
                  <div className="notification-item">
                    <strong>Weekly Review</strong>

                    <span>
                      It's time to review your progress and see what you accomplished this week!
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveView("Breakdown");
                        setOpenMenu(null);
                      }}
                    >
                      Open Weekly Review
                    </button>
                  </div>
                )}

                {upcomingReminders.length === 0 ? (
                  <span>No upcoming assignment reminders.</span>
                ) : (
                  <div className="notification-list">
                    {upcomingReminders.map((task) => (
                      <div className="notification-item" key={task.id}>
                        <strong>{task.title}</strong>

                        <span>
                          Due{" "}
                          {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {openMenu === "profile" && (
              <>
                <strong>Profile</strong>
                <span>Account options will be available here.</span>
              </>
            )}
          </div>
        )}
      </header>

      <button className="dashboard-quick-setup" type="button" onClick={openQuickSetup}>
        <span aria-hidden="true">＋ </span>Quick Setup
      </button>

      <nav aria-label="Workspace views" className="workspace-tabs" hidden={settingsOpen}>
        {visibleViews.map((view) => (
          <div
            className={`view-tab${activeView === view.label ? " view-tab--active" : ""}`}
            key={view.label}
          >
            <button
              aria-current={activeView === view.label ? "page" : undefined}
              className="view-tab__select"
              onClick={() => {
                setActiveView(view.label);
                setSettingsOpen(false);
                setOpenMenu(null);
              }}
              type="button"
            >
              <span className="icon-frame" aria-hidden="true">
                <img src={view.icon} alt="" />
              </span>
              <span>{view.label}</span>
            </button>
            <button
              aria-label={`Close ${view.label} view`}
              className="view-tab__close"
              onClick={() => closeView(view.label)}
              type="button"
            >
              <img src="/assets/close-todo.svg" alt="" />
            </button>
          </div>
        ))}
        {views.length > 1 && (
          <button
            aria-pressed={isPanelLayout}
            className="workspace-layout-toggle"
            onClick={() => setSplitViewOpen((isOpen) => !isOpen)}
            type="button"
          >
            {isPanelLayout ? "Tabbed view" : "Split view"}
          </button>
        )}
        {visibleViews.length === 0 && searchQuery && (
          <p className="tab-empty-message" role="status">
            No views match “{searchQuery}”.
          </p>
        )}
        {views.length === 0 && (
          <button className="restore-views" onClick={restoreViews} type="button">
            Restore views
          </button>
        )}
      </nav>

      <div
        className={`workspace-panels${isPanelLayout ? " workspace-panels--resizable" : ""}`}
        hidden={settingsOpen || panelViews.length === 0}
      >
        <div
          className="workspace-panel-grid"
          style={{ gridTemplateColumns: panelGridColumns, width: panelGridWidth }}
        >
          {initialViews.map((view) => {
            const isOpen = views.some((openView) => openView.label === view.label);
            const isDisplayed =
              isOpen && (isPanelLayout || panelViews[0]?.label === view.label);
            const panelIndex = panelViews.findIndex((panelView) => panelView.label === view.label);
            const nextView =
              isPanelLayout && isOpen ? panelViews[panelIndex + 1] : undefined;
            const leftSize = panelSizes[view.label] ?? 1;
            const rightSize = nextView ? panelSizes[nextView.label] ?? 1 : 0;

            return (
              <Fragment key={view.label}>
                <div
                  aria-current={activeView === view.label ? "page" : undefined}
                  aria-label={`${view.label} panel`}
                  className={`dashboard-content${isPanelLayout ? " dashboard-content--split" : ""}`}
                  hidden={!isDisplayed}
                >
                  {renderView(view)}
                </div>
                {nextView && (
                  <button
                    aria-label={`Resize ${view.label} and ${nextView.label} panels`}
                    aria-orientation="vertical"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round((leftSize / (leftSize + rightSize)) * 100)}
                    className="workspace-panel-resizer"
                    onKeyDown={(event) => handlePanelResizeKeyDown(event, view, nextView)}
                    onPointerCancel={(event) => resizePanels(event, view, nextView)}
                    onPointerDown={(event) => resizePanels(event, view, nextView)}
                    onPointerMove={(event) => resizePanels(event, view, nextView)}
                    onPointerUp={(event) => resizePanels(event, view, nextView)}
                    role="separator"
                    type="button"
                  />
                )}
              </Fragment>
            );
          })}
        </div>

      </div>
      <div className="dashboard-content" hidden={!settingsOpen}>
        <Settings
          isDarkMode={isDarkMode}
          onExport={exportKadenceData}
          onStudyPreferencesChange={setStudyPreferences}
          onThemeChange={onThemeChange}
          themePreference={themePreference}
        />
      </div>
      <section
        aria-label="Welcome"
        className="welcome-area"
        hidden={settingsOpen ||
          activeView === "To do" ||
          activeView === "Breakdown" ||
          activeView === "Goals" ||
          activeView === "Priority" ||
          activeView === "Visual Planner"
        }
      >
        <div className="welcome-card">
          <h1>Welcome to Kadence!</h1>
          <div className="welcome-instructions">
            <p>To start setting goals, please click on the &quot;Goals&quot; tab</p>
            <p>To view your schedule, please click on the &quot;Visual Planner&quot; tab</p>
            <p>
              To set or change the priority of your goals, please click on the
              &quot;Priority&quot; tab
            </p>
            <p>To view your To-do List, please click on the &quot;To-Do&quot; tab</p>
            <p>
              To see an overview of all your tasks and goals, please click on the
              &quot;Breakdown&quot; tab
            </p>
            <p>To go to the settings page, please click on the gear icon.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

type UtilityButtonProps = {
  active: boolean;
  label: string;
  onClick: () => void;
  src: string;
  badgeCount?: number;
};

function UtilityButton({ active, label, onClick, src, badgeCount }: UtilityButtonProps) {
  return (
    <div className="utility-control">
      <button
        aria-expanded={active}
        aria-label={label}
        className="icon-button"
        onClick={onClick}
        type="button"
      >
        <img src={src} alt="" />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="notification-badge">
            {badgeCount}
          </span>
        )}
      </button>
    </div>
  );
}

export default Dashboard;
