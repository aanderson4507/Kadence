import { useEffect, useState, type KeyboardEvent } from "react";
import "./App.css";
import Breakdown from "./Breakdown";
import Goals from "./Goals";
import PrioritySetter from "./PrioritySetter";
import TodoList, { initialTasks, type Task } from "./TodoList";

type View = {
  label: string;
  icon: string;
};

const initialViews: View[] = [
  { label: "Calendar", icon: "/assets/tab-calendar.svg" },
  { label: "Goals", icon: "/assets/tab-goals-todo.svg" },
  { label: "To do", icon: "/assets/tab-todo-selected.svg" },
  { label: "Breakdown", icon: "/assets/tab-breakdown-todo.svg" },
  { label: "Priority", icon: "/assets/tab-priority-todo.svg" },
];

type UtilityMenu = "notifications" | "settings" | "profile" | null;

function Dashboard() {
  const [views, setViews] = useState(initialViews);
  const [activeView, setActiveView] = useState<string | null>("To do");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<UtilityMenu>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
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

  const visibleViews = views.filter((view) =>
    view.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  function closeView(label: string) {
    const closingIndex = views.findIndex((view) => view.label === label);
    const nextViews = views.filter((view) => view.label !== label);

    setViews(nextViews);
    if (activeView === label) {
      setActiveView(nextViews[Math.min(closingIndex, nextViews.length - 1)]?.label ?? null);
    }
  }

  function toggleMenu(menu: Exclude<UtilityMenu, null>) {
    setOpenMenu((currentMenu) => (currentMenu === menu ? null : menu));
    setSearchOpen(false);
    setSearchQuery("");
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
            <span className="icon-frame icon-frame--date" aria-hidden="true">
              <img src="/assets/sun-todo.svg" alt="" />
            </span>
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
            active={openMenu === "settings"}
            label="Settings"
            onClick={() => toggleMenu("settings")}
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

            {openMenu === "settings" && (
              <>
                <strong>Settings</strong>
                <span>Settings will be available here.</span>
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

      <nav aria-label="Workspace views" className="workspace-tabs">
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

      <div className="dashboard-content" hidden={activeView !== "To do"}>
        <TodoList tasks={tasks} setTasks={setTasks} />
      </div>
      <div className="dashboard-content" hidden={activeView !== "Breakdown"}>
        <Breakdown tasks={tasks} />
      </div>
      <div className="dashboard-content" hidden={activeView !== "Goals"}>
        <Goals
          activeView={activeView}
          onOpenBreakdown={() => setActiveView("Breakdown")}
          onOpenSettings={() => toggleMenu("settings")}
          onSelectView={setActiveView}
        />
      </div>
      <div className="dashboard-content" hidden={activeView !== "Priority"}>
        <PrioritySetter tasks={tasks} setTasks={setTasks} />
      </div>
      <section
        aria-label="Welcome"
        className="welcome-area"
        hidden={
          activeView === "To do" ||
          activeView === "Breakdown" ||
          activeView === "Goals" ||
          activeView === "Priority"
        }
      >
        <div className="welcome-card">
          <h1>Welcome to Kadence!</h1>
          <div className="welcome-instructions">
            <p>To start setting goals, please click on the &quot;Goals&quot; tab</p>
            <p>To view your calendar, please click on the &quot;Visual Planner&quot; tab</p>
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
