import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./App.css";
import "./workspace.css";
import * as api from "./api";
import type {
  AppNotification,
  DashboardMode,
  Goal,
  NotificationFeed,
  PlannerEvent,
  ReminderRule,
  StudyShortfall,
  Task,
  TabLayout,
  WorkspacePreferences,
} from "./api";
import Breakdown from "./Breakdown";
import Goals from "./Goals";
import { errorMessage } from "./http";
import PrioritySetter from "./PrioritySetter";
import { currentUser, initials, signOut, type SessionUser } from "./session";
import Settings from "./Settings";
import { addDaysToKey, todayKey } from "./taskPriority";
import TodoList from "./TodoList";
import VisualPlanner from "./VisualPlanner";
import WeeklyReview from "./WeeklyReview";

type ViewLabel = "Goals" | "To do" | "Breakdown" | "Priority" | "Visual Planner" | "Weekly Review";

type View = {
  label: ViewLabel;
  icon: string;
  /** Advanced views live behind the "More" menu in the simple main screen (issue #6). */
  advanced: boolean;
};

const ALL_VIEWS: View[] = [
  { label: "Goals", icon: "/assets/tab-goals-todo.svg", advanced: false },
  { label: "To do", icon: "/assets/tab-todo-selected.svg", advanced: false },
  { label: "Breakdown", icon: "/assets/tab-breakdown-todo.svg", advanced: true },
  { label: "Priority", icon: "/assets/tab-priority-todo.svg", advanced: true },
  { label: "Visual Planner", icon: "/assets/planner-tab-chart.svg", advanced: false },
  { label: "Weekly Review", icon: "/assets/tab-breakdown.svg", advanced: true },
];
const viewByLabel = new Map(ALL_VIEWS.map((view) => [view.label, view]));
const isViewLabel = (value: unknown): value is ViewLabel => viewByLabel.has(value as ViewLabel);

function defaultLayout(mode: DashboardMode): TabLayout {
  return {
    views: ALL_VIEWS.filter((view) => mode === "ADVANCED" || !view.advanced).map((view) => ({
      view: view.label,
      size: 1,
    })),
    split: false,
    active: "To do",
  };
}

/** The workspace as saved in UserSettings.tabLayout, or the defaults for the mode and landing page. */
function restoreLayout(
  mode: DashboardMode,
  layout: TabLayout | null,
  landingPage: WorkspacePreferences["landingPage"],
) {
  const source = layout ?? defaultLayout(mode);
  const views = source.views
    .map((tab) => tab.view)
    .filter(isViewLabel)
    .map((label) => viewByLabel.get(label)!);
  const landing: ViewLabel | null =
    landingPage === "PLANNER" ? "Visual Planner" : landingPage === "GOALS" ? "Goals" : null;
  const active: ViewLabel | null = layout
    ? isViewLabel(source.active) && views.some((view) => view.label === source.active)
      ? source.active
      : null
    : (landing ?? "To do");
  return {
    views,
    sizes: Object.fromEntries(source.views.map((tab) => [tab.view, tab.size])) as Record<string, number>,
    split: source.split,
    active,
  };
}

type UtilityMenu = "notifications" | "profile" | "more" | null;
type ThemePreference = "Light mode" | "Dark mode" | "System default";
type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };
type Banner = { kind: "success" | "error" | "info"; text: string } | null;
type Focus = { view: ViewLabel; id: string; nonce: number } | null;

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
const NOTIFICATION_POLL_MS = 5 * 60 * 1000;
const MISSED_CHECK_MS = 60 * 60 * 1000;
const LAYOUT_SAVE_DELAY_MS = 600;

function formatToday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function describeNotification(notification: AppNotification, today: string) {
  const { task, plannerEvent } = notification;
  switch (notification.type) {
    case "DAILY_PLANNING":
      return { title: "Plan your day", detail: "Take a minute to look over today's tasks and planner." };
    case "WEEKLY_REVIEW":
      return { title: "Weekly review", detail: "It's time to review what you finished this week." };
    case "DEADLINE":
    case "UPCOMING_TASK":
      if (task) {
        const due = task.dueDate ?? "";
        const when =
          due === today
            ? "is due today"
            : due < today
              ? "was due earlier"
              : due === addDaysToKey(today, 1)
                ? "is due tomorrow"
                : `is due ${new Date(`${due}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
        return { title: task.title, detail: `${notification.type === "DEADLINE" ? "Deadline: " : ""}${task.title} ${when}.` };
      }
      if (plannerEvent) {
        const hour = plannerEvent.startHour;
        return {
          title: plannerEvent.title,
          detail: `Starts at ${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"} today.`,
        };
      }
      return { title: "Reminder", detail: "Something on your list needs attention." };
    default:
      return { title: "Reminder", detail: "Something on your list needs attention." };
  }
}

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

  // --- Data loaded from the API ---------------------------------------------------------------
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plannerEvents, setPlannerEvents] = useState<PlannerEvent[]>([]);
  const [shortfalls, setShortfalls] = useState<StudyShortfall[]>([]);
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
  const [preferences, setPreferences] = useState<WorkspacePreferences | null>(null);
  const [feed, setFeed] = useState<NotificationFeed>({ notifications: [], unreadCount: 0, scheduledLaterToday: 0 });
  const [banner, setBanner] = useState<Banner>(null);
  const userId = user?.id ?? null;

  // --- Workspace layout -----------------------------------------------------------------------
  const [mode, setMode] = useState<DashboardMode>("SIMPLE");
  const [views, setViews] = useState<View[]>(() => defaultLayout("SIMPLE").views.map((tab) => viewByLabel.get(tab.view as ViewLabel)!));
  const [activeView, setActiveView] = useState<ViewLabel | null>("To do");
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [panelSizes, setPanelSizes] = useState<Record<string, number>>({});
  const layoutLoaded = useRef(false);
  const panelResizeStart = useRef<PanelResizeStart | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<UtilityMenu>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickSetupRequest, setQuickSetupRequest] = useState(0);
  const [focus, setFocus] = useState<Focus>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [missedDismissed, setMissedDismissed] = useState(false);
  const [handlingMissed, setHandlingMissed] = useState(false);
  const autoHandled = useRef(new Set<string>());
  const [now, setNow] = useState(() => new Date());
  const today = todayKey(now);

  // --- Loading --------------------------------------------------------------------------------

  /** Recomputes everything derived from tasks and the planner: study sessions, goal progress, reminders. */
  const refreshDerived = useCallback(async (id: string) => {
    const [plan, nextGoals, nextFeed] = await Promise.all([
      api.syncStudyPlan(id),
      api.fetchGoals(id),
      api.syncNotifications(id),
    ]);
    setPlannerEvents(plan.events);
    setShortfalls(plan.shortfalls);
    setGoals(nextGoals);
    setFeed(nextFeed);
  }, []);

  const load = useCallback(async () => {
    setLoadState({ kind: "loading" });
    try {
      const signedIn = await currentUser("Couldn't open your workspace.");
      const [nextTasks, nextPreferences, rules] = await Promise.all([
        api.fetchTasks(signedIn.id),
        api.fetchWorkspacePreferences(signedIn.id),
        api.fetchReminderRules(signedIn.id),
      ]);
      setUser(signedIn);
      setTasks(nextTasks);
      setPreferences(nextPreferences);
      setReminderRules(rules);
      const layout = restoreLayout(
        nextPreferences.dashboardMode,
        nextPreferences.tabLayout,
        nextPreferences.landingPage,
      );
      setMode(nextPreferences.dashboardMode);
      setViews(layout.views);
      setPanelSizes(layout.sizes);
      setSplitViewOpen(layout.split);
      setActiveView(layout.active);
      layoutLoaded.current = true;
      await refreshDerived(signedIn.id);
      setLoadState({ kind: "ready" });
    } catch (error) {
      setLoadState({
        kind: "error",
        message: `${errorMessage(error)} Make sure the API is running (npm run dev:api) and the database is seeded.`,
      });
    }
  }, [refreshDerived]);

  useEffect(() => {
    void load();
  }, [load]);

  // Saves the open tabs, their widths and split mode so the workspace reopens the same way (#8).
  useEffect(() => {
    if (!userId || !layoutLoaded.current) return;
    const layout: TabLayout = {
      views: views.map((view) => ({ view: view.label, size: Math.round((panelSizes[view.label] ?? 1) * 1000) / 1000 })),
      split: splitViewOpen,
      active: activeView,
    };
    const timer = window.setTimeout(() => {
      api.saveWorkspacePreferences(userId, { tabLayout: layout }).catch((error) =>
        setBanner({ kind: "error", text: errorMessage(error) }),
      );
    }, LAYOUT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [userId, views, panelSizes, splitViewOpen, activeView]);

  // Reminders arrive on time while the app is open (issue #4).
  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => {
      setNow(new Date());
      api.syncNotifications(userId).then(setFeed).catch(() => undefined);
    }, NOTIFICATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [userId]);

  // Missed tasks are detected on open and every hour (issue #3).
  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => {
      setNow(new Date());
      api.fetchTasks(userId).then(setTasks).catch(() => undefined);
    }, MISSED_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [userId]);

  // --- Mutations (each saves to the database, then updates the screen) ------------------------

  async function afterChange(id: string) {
    try {
      await refreshDerived(id);
    } catch (error) {
      setBanner({ kind: "error", text: errorMessage(error) });
    }
  }

  function requireUserId() {
    if (!userId) throw new Error("Your workspace is still loading.");
    return userId;
  }

  const taskActions = {
    async create(input: api.TaskInput) {
      const id = requireUserId();
      const { task, occurrenceCount } = await api.createTask(id, input);
      if (occurrenceCount > 1) setTasks(await api.fetchTasks(id));
      else setTasks((current) => [...current, task]);
      void afterChange(id);
      return { task, occurrenceCount };
    },
    async update(taskId: string, changes: api.TaskChanges) {
      const id = requireUserId();
      const task = await api.updateTask(id, taskId, changes);
      setTasks((current) => current.map((item) => (item.id === taskId ? task : item)));
      void afterChange(id);
      return task;
    },
    async remove(taskId: string, scope: "one" | "series" = "one") {
      const id = requireUserId();
      await api.deleteTask(id, taskId, scope);
      if (scope === "series") setTasks(await api.fetchTasks(id));
      else setTasks((current) => current.filter((item) => item.id !== taskId));
      void afterChange(id);
    },
  };

  const goalActions = {
    async create(input: api.GoalInput) {
      const id = requireUserId();
      await api.createGoal(id, input);
      setGoals(await api.fetchGoals(id));
    },
    async update(goalId: string, changes: api.GoalChanges) {
      const id = requireUserId();
      await api.updateGoal(id, goalId, changes);
      setGoals(await api.fetchGoals(id));
    },
    /** Matches docs/uml/sequence-change-goal-priority.puml: save, then update every goal view. */
    async changePriority(goalId: string, priority: api.Priority) {
      const id = requireUserId();
      await api.updateGoalPriority(id, goalId, priority);
      setGoals((current) => current.map((goal) => (goal.id === goalId ? { ...goal, priority } : goal)));
    },
    async remove(goalId: string) {
      const id = requireUserId();
      await api.deleteGoal(id, goalId);
      if (selectedGoalId === goalId) setSelectedGoalId(null);
      setGoals(await api.fetchGoals(id));
    },
    async addMilestone(goalId: string, input: { title: string; dueDate?: string }) {
      const id = requireUserId();
      await api.createMilestone(id, goalId, input);
      setGoals(await api.fetchGoals(id));
    },
    async updateMilestone(goalId: string, milestoneId: string, changes: Parameters<typeof api.updateMilestone>[3]) {
      const id = requireUserId();
      await api.updateMilestone(id, goalId, milestoneId, changes);
      setGoals(await api.fetchGoals(id));
    },
    async removeMilestone(goalId: string, milestoneId: string) {
      const id = requireUserId();
      await api.deleteMilestone(id, goalId, milestoneId);
      setGoals(await api.fetchGoals(id));
    },
  };

  const plannerActions = {
    async create(input: api.PlannerEventInput) {
      const id = requireUserId();
      const created = await api.createPlannerEvent(id, input);
      setPlannerEvents((current) => [...current, ...created]);
      void afterChange(id);
      return created;
    },
    async createMany(inputs: Partial<api.PlannerEventInput>[]) {
      const id = requireUserId();
      const created = await api.createPlannerEvents(id, inputs);
      setPlannerEvents((current) => [...current, ...created]);
      void afterChange(id);
      return created;
    },
    async update(eventId: string, changes: Partial<api.PlannerEventInput>) {
      const id = requireUserId();
      const event = await api.updatePlannerEvent(id, eventId, changes);
      setPlannerEvents((current) => current.map((item) => (item.id === eventId ? event : item)));
      void afterChange(id);
      return event;
    },
    async remove(eventId: string, scope: "one" | "series" = "one") {
      const id = requireUserId();
      await api.deletePlannerEvent(id, eventId, scope);
      const seriesId = plannerEvents.find((event) => event.id === eventId)?.seriesId;
      const removedDate = plannerEvents.find((event) => event.id === eventId)?.date ?? "";
      setPlannerEvents((current) =>
        current.filter((item) =>
          scope === "series" && seriesId ? !(item.seriesId === seriesId && item.date >= removedDate) : item.id !== eventId,
        ),
      );
      void afterChange(id);
    },
  };

  // --- Missed tasks (issue #3) ----------------------------------------------------------------

  const missedTasks = useMemo(
    () => tasks.filter((task) => !task.completed && !task.inBacklog && task.dueDate !== undefined && task.dueDate < today),
    [tasks, today],
  );

  const handleMissed = useCallback(
    async (action: api.MissedAction, automatic = false) => {
      if (!userId || missedTasks.length === 0) return;
      setHandlingMissed(true);
      try {
        const result = await api.handleMissedTasks(userId, action, missedTasks.map((task) => task.id));
        setTasks(await api.fetchTasks(userId));
        await refreshDerived(userId);
        const verb =
          action === "RESCHEDULE" ? "rescheduled into open time slots" : action === "BACKLOG" ? "moved to your backlog" : "moved to today";
        const unplaced = result.unplaced.length > 0 ? ` ${result.unplaced.length} didn't fit: widen your open time slots in Settings.` : "";
        setBanner({
          kind: result.unplaced.length > 0 ? "info" : "success",
          text: `${automatic ? "Automatically " : ""}${result.moved} missed ${result.moved === 1 ? "task" : "tasks"} ${verb}.${unplaced}`,
        });
        setMissedDismissed(true);
      } catch (error) {
        setBanner({ kind: "error", text: errorMessage(error) });
      } finally {
        setHandlingMissed(false);
      }
    },
    [userId, missedTasks, refreshDerived],
  );

  // Follow the saved "unfinished task" preferences: automatic handling, or ask (the banner).
  useEffect(() => {
    if (loadState.kind !== "ready" || !preferences || missedTasks.length === 0) return;
    const fresh = missedTasks.filter((task) => !autoHandled.current.has(task.id));
    if (fresh.length === 0) return;
    const automatic: api.MissedAction | null = preferences.autoReschedule
      ? "RESCHEDULE"
      : preferences.unfinishedBehavior === "MOVE_TO_NEXT_DAY"
        ? "MOVE_TO_TODAY"
        : preferences.unfinishedBehavior === "MOVE_TO_BACKLOG"
          ? "BACKLOG"
          : null;
    if (!automatic) return;
    fresh.forEach((task) => autoHandled.current.add(task.id));
    void handleMissed(automatic, true);
  }, [loadState.kind, preferences, missedTasks, handleMissed]);

  const showMissedPrompt =
    !missedDismissed &&
    missedTasks.length > 0 &&
    preferences !== null &&
    preferences.unfinishedBehavior === "ASK" &&
    !preferences.autoReschedule &&
    preferences.unfinishedReviewTime !== "NEVER" &&
    (preferences.unfinishedReviewTime !== "END_OF_DAY" || now.getHours() >= 17);

  // --- Navigation -----------------------------------------------------------------------------

  function openView(label: ViewLabel) {
    setViews((current) => (current.some((view) => view.label === label) ? current : [...current, viewByLabel.get(label)!]));
    setActiveView(label);
    setSettingsOpen(false);
    setOpenMenu(null);
  }

  function openTask(taskId: string) {
    openView("To do");
    setFocus({ view: "To do", id: taskId, nonce: Date.now() });
  }

  function openPlannerEvent(eventId: string) {
    openView("Visual Planner");
    setFocus({ view: "Visual Planner", id: eventId, nonce: Date.now() });
  }

  function openBreakdown(goalId?: string) {
    if (goalId) setSelectedGoalId(goalId);
    openView("Breakdown");
  }

  function openQuickSetup() {
    openView("Visual Planner");
    setSearchOpen(false);
    setSearchQuery("");
    setQuickSetupRequest((current) => current + 1);
  }

  async function openNotification(notification: AppNotification) {
    if (userId && !notification.readAt) {
      api.markNotificationRead(userId, notification.id).then(setFeed).catch(() => undefined);
    }
    setOpenMenu(null);
    if (notification.task) openTask(notification.task.id);
    else if (notification.plannerEvent) openPlannerEvent(notification.plannerEvent.id);
    else if (notification.type === "WEEKLY_REVIEW") openView("Weekly Review");
    else openView("Visual Planner");
  }

  async function changeMode(nextMode: DashboardMode) {
    if (!userId || nextMode === mode) return;
    setMode(nextMode);
    if (nextMode === "SIMPLE") {
      // Keep the core views and any advanced view the student is looking at; turn split view off.
      setViews((current) => current.filter((view) => !view.advanced || view.label === activeView));
      setSplitViewOpen(false);
    } else {
      setViews((current) => [...current, ...ALL_VIEWS.filter((view) => !current.some((open) => open.label === view.label))]);
    }
    setOpenMenu(null);
    try {
      await api.saveWorkspacePreferences(userId, { dashboardMode: nextMode });
      setPreferences((current) => (current ? { ...current, dashboardMode: nextMode } : current));
    } catch (error) {
      setBanner({ kind: "error", text: errorMessage(error) });
    }
  }

  // --- Panels ---------------------------------------------------------------------------------

  const visibleViews = views.filter((view) => view.label.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const moreViews = ALL_VIEWS.filter((view) => view.advanced);
  const isPanelLayout = mode === "ADVANCED" && splitViewOpen && views.length > 1;
  const selectedView = views.find((view) => view.label === activeView) ?? null;
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
    return Math.min(totalSize / 2, (minimumPanelWidth / Math.max(containerWidth, minimumPanelWidth * 2)) * totalSize);
  }

  function resizePanels(event: ReactPointerEvent<HTMLButtonElement>, leftView: View, rightView: View) {
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
      Math.max(minimumSize, resizeStart.leftSize + ((event.clientX - resizeStart.startX) / resizeStart.containerWidth) * totalSize),
    );
    setPanelSizes((currentSizes) => ({
      ...currentSizes,
      [resizeStart.leftLabel]: leftSize,
      [resizeStart.rightLabel]: totalSize - leftSize,
    }));
  }

  function handlePanelResizeKeyDown(event: KeyboardEvent<HTMLButtonElement>, leftView: View, rightView: View) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const leftSize = panelSizes[leftView.label] ?? 1;
    const rightSize = panelSizes[rightView.label] ?? 1;
    const totalSize = leftSize + rightSize;
    const step = totalSize * 0.05;
    const containerWidth = event.currentTarget.parentElement?.clientWidth ?? window.innerWidth;
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

  function closeView(label: ViewLabel) {
    const closingIndex = views.findIndex((view) => view.label === label);
    const nextViews = views.filter((view) => view.label !== label);
    setViews(nextViews);
    if (nextViews.length < 2) setSplitViewOpen(false);
    if (activeView === label) {
      setActiveView(nextViews[Math.min(closingIndex, nextViews.length - 1)]?.label ?? null);
    }
  }

  function restoreViews() {
    const layout = defaultLayout(mode);
    setViews(layout.views.map((tab) => viewByLabel.get(tab.view as ViewLabel)!));
    setActiveView("To do");
    setSplitViewOpen(false);
    setPanelSizes({});
    setSearchQuery("");
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

  function exportKadenceData(preferencesToExport: object) {
    const serializedData = JSON.stringify(
      { exportedAt: new Date().toISOString(), preferences: preferencesToExport, tasks, goals, plannerEvents },
      null,
      2,
    );
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

  function renderView(view: View) {
    switch (view.label) {
      case "To do":
        return (
          <TodoList
            focusTaskId={focus?.view === "To do" ? focus : null}
            onCreate={taskActions.create}
            onDelete={taskActions.remove}
            onUpdate={taskActions.update}
            tasks={tasks}
          />
        );
      case "Breakdown":
        return (
          <Breakdown
            goals={goals}
            onAddMilestone={goalActions.addMilestone}
            onBlockMilestoneTime={plannerActions.create}
            onChangePriority={goalActions.changePriority}
            onDeleteMilestone={goalActions.removeMilestone}
            onOpenPlanner={() => openView("Visual Planner")}
            onOpenStudySettings={() => {
              setSettingsOpen(true);
              setOpenMenu(null);
            }}
            onOpenTask={openTask}
            onSelectGoal={setSelectedGoalId}
            onUpdateGoal={goalActions.update}
            onUpdateMilestone={goalActions.updateMilestone}
            plannerEvents={plannerEvents}
            selectedGoalId={selectedGoalId}
            shortfalls={shortfalls}
            tasks={tasks}
          />
        );
      case "Goals":
        return (
          <Goals
            activeView={activeView}
            goals={goals}
            onChangePriority={goalActions.changePriority}
            onCreateGoal={goalActions.create}
            onDeleteGoal={goalActions.remove}
            onOpenBreakdown={openBreakdown}
            onOpenSettings={() => {
              setSettingsOpen(true);
              setOpenMenu(null);
            }}
            onSelectView={(label) => (label === null ? setActiveView(null) : openView(label === "Calendar" ? "Visual Planner" : (label as ViewLabel)))}
            onUpdateGoal={goalActions.update}
          />
        );
      case "Priority":
        return <PrioritySetter onUpdate={taskActions.update} reminderRules={reminderRules} tasks={tasks} />;
      case "Visual Planner":
        return (
          <VisualPlanner
            events={plannerEvents}
            focusEventId={focus?.view === "Visual Planner" ? focus : null}
            onCreate={plannerActions.create}
            onCreateMany={plannerActions.createMany}
            onDelete={plannerActions.remove}
            onUpdate={plannerActions.update}
            quickSetupRequest={quickSetupRequest}
            tasks={tasks}
          />
        );
      case "Weekly Review":
        return userId ? (
          <WeeklyReview
            dataVersion={tasks}
            onOpenTask={openTask}
            userId={userId}
          />
        ) : null;
      default:
        return null;
    }
  }

  if (loadState.kind !== "ready") {
    return (
      <main className="app-shell">
        <section aria-live="polite" className="workspace-status-screen">
          <span className="brand-mark" aria-hidden="true">
            <img src="/assets/brand-sprout.svg" alt="" />
          </span>
          {loadState.kind === "loading" ? (
            <p>Loading your workspace…</p>
          ) : (
            <>
              <p role="alert">{loadState.message}</p>
              <button className="workspace-status-screen__retry" onClick={() => void load()} type="button">
                Try again
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <a className="workspace-brand" href="/dashboard" aria-label="Kadence home">
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
              onClick={() => onThemeChange(isDarkMode ? "Light mode" : "Dark mode")}
              type="button"
            >
              <img alt="" height="16" src={isDarkMode ? "/assets/moon-dark.svg" : "/assets/sun-todo.svg"} width="16" />
            </button>
            <span>{formatToday(now)}</span>
          </div>

          <div aria-label="Main screen" className="mode-toggle" role="group">
            {(["SIMPLE", "ADVANCED"] as DashboardMode[]).map((option) => (
              <button
                aria-pressed={mode === option}
                className={mode === option ? "is-selected" : ""}
                key={option}
                onClick={() => void changeMode(option)}
                title={option === "SIMPLE" ? "Show only the essentials" : "Show every view and split view"}
                type="button"
              >
                {option === "SIMPLE" ? "Simple" : "Advanced"}
              </button>
            ))}
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
            badgeCount={feed.unreadCount}
            label="Notifications"
            onClick={() => toggleMenu("notifications")}
            src="/assets/notifications.svg"
          />
          <UtilityButton active={settingsOpen} label="Settings" onClick={toggleSettings} src="/assets/settings.svg" />
          <div className="utility-control">
            <button
              aria-expanded={openMenu === "profile"}
              aria-label="Open profile menu"
              className="profile-button"
              onClick={() => toggleMenu("profile")}
              type="button"
            >
              {initials(user)}
            </button>
          </div>
        </div>

        {(openMenu === "notifications" || openMenu === "profile") && (
          <div className="utility-popover" role="dialog" aria-label={openMenu === "notifications" ? "Notifications" : "Profile"}>
            {openMenu === "notifications" && (
              <>
                <div className="notification-heading">
                  <strong>Notifications</strong>
                  {feed.unreadCount > 0 && (
                    <button
                      onClick={() => {
                        if (userId) api.markAllNotificationsRead(userId).then(setFeed).catch(() => undefined);
                      }}
                      type="button"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {feed.notifications.length === 0 ? (
                  <span>
                    No reminders yet.
                    {feed.scheduledLaterToday > 0 && ` ${feed.scheduledLaterToday} scheduled for later today.`}
                  </span>
                ) : (
                  <ul className="notification-list">
                    {feed.notifications.map((notification) => {
                      const text = describeNotification(notification, today);
                      return (
                        <li key={notification.id}>
                          <button
                            className={`notification-item${notification.readAt ? "" : " notification-item--unread"}`}
                            onClick={() => void openNotification(notification)}
                            type="button"
                          >
                            <strong>{text.title}</strong>
                            <span>{text.detail}</span>
                            <small>
                              {new Date(notification.scheduledFor).toLocaleString("en-US", {
                                weekday: "short",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </small>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button className="notification-review-link" onClick={() => openView("Weekly Review")} type="button">
                  Open weekly review
                </button>
              </>
            )}
            {openMenu === "profile" && (
              <>
                <strong>
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username}
                </strong>
                <span>Signed in as {user?.username}</span>
                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    setOpenMenu(null);
                  }}
                  type="button"
                >
                  Account settings
                </button>
                <button
                  onClick={() => {
                    signOut();
                    window.location.assign("/");
                  }}
                  type="button"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        )}
      </header>

      <div className="dashboard-actions">
        <button className="dashboard-quick-setup" type="button" onClick={openQuickSetup}>
          <span aria-hidden="true">＋ </span>Quick Setup
        </button>
        <button className="dashboard-review-shortcut" onClick={() => openView("Weekly Review")} type="button">
          Weekly review
        </button>
      </div>

      {banner && (
        <div className={`workspace-banner workspace-banner--${banner.kind}`} role={banner.kind === "error" ? "alert" : "status"}>
          <span>{banner.text}</span>
          <button aria-label="Dismiss message" onClick={() => setBanner(null)} type="button">
            ×
          </button>
        </div>
      )}

      {showMissedPrompt && (
        <section aria-label="Missed tasks" className="workspace-banner workspace-banner--missed">
          <span>
            You have {missedTasks.length} missed {missedTasks.length === 1 ? "task" : "tasks"}
            {missedTasks.length <= 3 && `: ${missedTasks.map((task) => task.title).join(", ")}`}. What should Kadence do?
          </span>
          <div>
            <button disabled={handlingMissed} onClick={() => void handleMissed("RESCHEDULE")} type="button">
              Find open time slots
            </button>
            <button disabled={handlingMissed} onClick={() => void handleMissed("MOVE_TO_TODAY")} type="button">
              Move to today
            </button>
            <button disabled={handlingMissed} onClick={() => void handleMissed("BACKLOG")} type="button">
              Move to backlog
            </button>
            <button disabled={handlingMissed} onClick={() => setMissedDismissed(true)} type="button">
              Not now
            </button>
          </div>
        </section>
      )}

      <nav aria-label="Workspace views" className="workspace-tabs" hidden={settingsOpen}>
        {visibleViews.map((view) => (
          <div className={`view-tab${activeView === view.label ? " view-tab--active" : ""}`} key={view.label}>
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
        {mode === "SIMPLE" && (
          <div className="more-views">
            <button
              aria-expanded={openMenu === "more"}
              aria-haspopup="menu"
              className="workspace-layout-toggle"
              onClick={() => toggleMenu("more")}
              type="button"
            >
              More ▾
            </button>
            {openMenu === "more" && (
              <div className="more-views__menu" role="menu">
                {moreViews.map((view) => (
                  <button key={view.label} onClick={() => openView(view.label)} role="menuitem" type="button">
                    {view.label}
                  </button>
                ))}
                <button onClick={() => void changeMode("ADVANCED")} role="menuitem" type="button">
                  Show everything (Advanced)
                </button>
              </div>
            )}
          </div>
        )}
        {mode === "ADVANCED" && views.length > 1 && (
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
        <div className="workspace-panel-grid" style={{ gridTemplateColumns: panelGridColumns, width: panelGridWidth }}>
          {ALL_VIEWS.map((view) => {
            const isOpen = views.some((openView) => openView.label === view.label);
            const isDisplayed = isOpen && (isPanelLayout || panelViews[0]?.label === view.label);
            const panelIndex = panelViews.findIndex((panelView) => panelView.label === view.label);
            const nextView = isPanelLayout && isOpen ? panelViews[panelIndex + 1] : undefined;
            const leftSize = panelSizes[view.label] ?? 1;
            const rightSize = nextView ? (panelSizes[nextView.label] ?? 1) : 0;
            const panelOrder = isPanelLayout ? panelIndex * 2 : 0;

            return (
              <Fragment key={view.label}>
                <div
                  aria-current={activeView === view.label ? "page" : undefined}
                  aria-label={`${view.label} panel`}
                  className={`dashboard-content${isPanelLayout ? " dashboard-content--split" : ""}`}
                  hidden={!isDisplayed}
                  style={{ order: panelOrder }}
                >
                  {isOpen && renderView(view)}
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
                    style={{ order: panelOrder + 1 }}
                    type="button"
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="dashboard-content" hidden={!settingsOpen}>
        {userId && (
          <Settings
            isDarkMode={isDarkMode}
            onExport={exportKadenceData}
            onSaved={() => {
              void (async () => {
                try {
                  setPreferences(await api.fetchWorkspacePreferences(userId));
                  setReminderRules(await api.fetchReminderRules(userId));
                  setMissedDismissed(false);
                  await refreshDerived(userId);
                } catch (error) {
                  setBanner({ kind: "error", text: errorMessage(error) });
                }
              })();
            }}
            onThemeChange={onThemeChange}
            themePreference={themePreference}
            userId={userId}
          />
        )}
      </div>
      <section aria-label="Welcome" className="welcome-area" hidden={settingsOpen || activeView !== null}>
        <div className="welcome-card">
          <h1>Welcome{user?.firstName ? `, ${user.firstName}` : ""}!</h1>
          <div className="welcome-instructions">
            <p>Start with the &quot;To do&quot; tab for today&apos;s tasks, or &quot;Goals&quot; for the bigger picture.</p>
            <p>Use &quot;Visual Planner&quot; or Quick Setup to plan your week.</p>
            <p>
              Breakdown, Priority and Weekly Review are under &quot;More&quot;. Switch to Advanced to keep them all open
              side by side.
            </p>
            <p>Open Settings with the gear icon.</p>
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
      <button aria-expanded={active} aria-label={label} className="icon-button" onClick={onClick} type="button">
        <img src={src} alt="" />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="notification-badge" aria-label={`${badgeCount} unread`}>
            {badgeCount}
          </span>
        )}
      </button>
    </div>
  );
}

export default Dashboard;
