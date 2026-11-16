import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./Settings.css";
import {
  DEFAULT_SETTINGS,
  REMINDER_LABELS,
  SUMMARY_LABELS,
  WEEKDAYS,
  loadSettings,
  sameSettings,
  saveSettings,
  saveThemePreference,
  validateSettings,
  type AccountInfo,
  type ReminderLabel,
  type SettingsValues,
  type ThemePreference,
} from "./settingsApi";
import { validateStudyPreferences, type StudyPreferences } from "./studySessions";

type SettingsSection =
  | "overview"
  | "profile"
  | "planner"
  | "notifications"
  | "goals"
  | "unfinished"
  | "weekly"
  | "study"
  | "privacy";

function withTheme(values: SettingsValues, theme: ThemePreference): SettingsValues {
  return { ...values, planner: { ...values.planner, theme } };
}

const sectionItems: {
  id: SettingsSection;
  label: string;
  icon: string;
  title: string;
  description: string;
  summary: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "⌂",
    title: "Settings overview",
    description: "Your account at a glance and the preferences you change most. Save once to apply everything.",
    summary: "Account and top preferences",
  },
  {
    id: "profile",
    label: "Personal and career profile",
    icon: "◎",
    title: "Personal and career profile",
    description: "Update the details that shape your planner, career goals, and weekly reviews.",
    summary: "Name, email, school, and career goals",
  },
  {
    id: "planner",
    label: "Planner appearance and layout",
    icon: "▦",
    title: "Planner appearance and layout",
    description: "Customize the look, layout, and defaults for your daily planner experience.",
    summary: "Theme, colors, views, and time format",
  },
  {
    id: "notifications",
    label: "Notifications and reminders",
    icon: "☷",
    title: "Notifications and reminders",
    description: "Control when Kadence sends planning reminders, task alerts, and progress updates.",
    summary: "Reminders and Do Not Disturb hours",
  },
  {
    id: "goals",
    label: "Goal-setting preferences",
    icon: "□",
    title: "Goal-setting preferences",
    description: "Choose the defaults and tracking behaviors that help you set, structure, and celebrate goals.",
    summary: "Defaults for new goals and progress tracking",
  },
  {
    id: "unfinished",
    label: "Unfinished task management",
    icon: "◉",
    title: "Unfinished task management",
    description: "Choose how Kadence handles incomplete tasks, reminders, deadlines, and daily carryover.",
    summary: "Carryover, rescheduling, and daily limits",
  },
  {
    id: "weekly",
    label: "Weekly progress reviews",
    icon: "⚑",
    title: "Weekly progress reviews",
    description: "Pick your review day, reminder, and what your weekly summary shows.",
    summary: "Review day, reminder, and summary content",
  },
  {
    id: "study",
    label: "Exam study sessions",
    icon: "✎",
    title: "Exam study sessions",
    description: "Choose how Kadence sets aside study time in the days before tasks you mark as exams.",
    summary: "Study days, session length, and study hours",
  },
  {
    id: "privacy",
    label: "Privacy and account management",
    icon: "⚙",
    title: "Privacy and account management",
    description: "Manage data exports, backups, completed task cleanup, and account access.",
    summary: "Export, backups, and account deletion",
  },
];

const accentOptions = [
  { value: "#406b51", label: "Green", icon: "/assets/settings-accent-green.svg" },
  { value: "#5477a7", label: "Blue", icon: "/assets/settings-accent-blue.svg" },
  { value: "#8270a6", label: "Purple", icon: "/assets/settings-accent-purple.svg" },
  { value: "#b66d80", label: "Rose", icon: "/assets/settings-accent-rose.svg" },
  { value: "#c18b52", label: "Amber", icon: "/assets/settings-accent-amber.svg" },
];

type Status = { kind: "info" | "success" | "error"; text: string } | null;
type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

type SettingsProps = {
  isDarkMode: boolean;
  onThemeChange: (theme: ThemePreference) => void;
  onExport: (preferences: object) => void;
  /** Called with the saved (not draft) study preferences whenever they load or change. */
  onStudyPreferencesChange: (preferences: StudyPreferences) => void;
  themePreference: ThemePreference;
};

function Settings({
  isDarkMode,
  onExport,
  onStudyPreferencesChange,
  onThemeChange,
  themePreference,
}: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("overview");
  const [savedSettings, setSavedSettings] = useState(() =>
    withTheme(DEFAULT_SETTINGS, themePreference),
  );
  const [draft, setDraft] = useState(() => withTheme(DEFAULT_SETTINGS, themePreference));
  const [userId, setUserId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [deleteReviewOpen, setDeleteReviewOpen] = useState(false);
  /** The theme the server has stored, so header theme switches are saved only when they differ. */
  const serverTheme = useRef<ThemePreference | null>(null);

  const activeSectionInfo = sectionItems.find((item) => item.id === activeSection)!;
  const hasUnsavedChanges = !sameSettings(draft, savedSettings);
  const canSave = userId !== null && hasUnsavedChanges && !saving;

  async function fetchSettings() {
    setLoadState({ kind: "loading" });
    try {
      const loaded = await loadSettings();
      serverTheme.current = loaded.values.planner.theme;
      setUserId(loaded.userId);
      setAccount(loaded.account);
      setSavedSettings(loaded.values);
      setDraft(loaded.values);
      setLoadState({ kind: "ready" });
      onThemeChange(loaded.values.planner.theme);
    } catch (error) {
      setLoadState({ kind: "error", message: errorMessage(error) });
    }
  }

  useEffect(() => {
    // Load once when the workspace opens; Retry calls fetchSettings again.
    void fetchSettings();
  }, []);

  const savedStudy = savedSettings.study;
  useEffect(() => {
    onStudyPreferencesChange(savedStudy);
  }, [savedStudy, onStudyPreferencesChange]);

  // The theme applies and saves right away, whether it is changed here or from the header.
  useEffect(() => {
    setSavedSettings((current) => withTheme(current, themePreference));
    setDraft((current) => withTheme(current, themePreference));
    if (!userId || serverTheme.current === null || serverTheme.current === themePreference) return;

    const previousTheme = serverTheme.current;
    serverTheme.current = themePreference;
    saveThemePreference(userId, themePreference).catch((error) => {
      serverTheme.current = previousTheme;
      setStatus({ kind: "error", text: errorMessage(error) });
    });
  }, [themePreference, userId]);

  function updateSetting<
    Section extends keyof SettingsValues,
    Property extends keyof SettingsValues[Section],
  >(section: Section, property: Property, value: SettingsValues[Section][Property]) {
    setDraft((current) => ({
      ...current,
      [section]: { ...current[section], [property]: value },
    }));
    setStatus(null);
  }

  async function handleSave() {
    if (!userId || saving) return;
    const problem = validateSettings(draft);
    if (problem) {
      setStatus({ kind: "error", text: problem });
      return;
    }

    const submitted = draft;
    setSaving(true);
    setStatus({ kind: "info", text: "Saving your changes…" });
    try {
      const stored = await saveSettings(userId, submitted);
      setSavedSettings(stored);
      // Keep anything typed while the save was in flight.
      setDraft((current) => (current === submitted ? stored : current));
      setStatus({ kind: "success", text: "Changes saved." });
    } catch (error) {
      // The draft is kept so nothing is lost; Save stays available to try again.
      setStatus({ kind: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  function discardSettings() {
    setDraft(savedSettings);
    setStatus({ kind: "info", text: "Unsaved changes discarded." });
  }

  function downloadSettingsData() {
    onExport(savedSettings);
    setStatus({ kind: "success", text: "Your data export is ready." });
  }

  function updateProfilePicture(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        updateSetting("profile", "avatar", reader.result);
      }
    });
    reader.readAsDataURL(file);
  }

  function openSection(section: SettingsSection) {
    setActiveSection(section);
    if (status?.kind !== "error") setStatus(null);
  }

  function renderSaveRow() {
    const message =
      status?.text ??
      (loadState.kind === "loading"
        ? "Loading your saved settings…"
        : userId === null
          ? "Saving is unavailable until your settings load."
          : hasUnsavedChanges
            ? "You have unsaved changes."
            : "All changes saved.");
    const isError = status?.kind === "error";
    return (
      <footer className="settings-save-row">
        <p
          aria-live={isError ? "assertive" : "polite"}
          className={`settings-save-message${isError ? " is-error" : ""}${status?.kind === "success" ? " is-success" : ""}`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
        <div>
          <button
            className="settings-button settings-button--secondary"
            disabled={!hasUnsavedChanges || saving}
            onClick={discardSettings}
            type="button"
          >
            Discard
          </button>
          <button
            aria-busy={saving}
            className="settings-button settings-button--primary"
            disabled={!canSave}
            onClick={() => void handleSave()}
            type="button"
          >
            {saving ? "Saving…" : isError && hasUnsavedChanges ? "Try again" : "Save changes"}
          </button>
        </div>
      </footer>
    );
  }

  return (
    <main
      className="settings-page"
      data-theme={isDarkMode ? "dark" : "light"}
      style={{ "--settings-accent": draft.planner.accent } as CSSProperties}
    >
      <aside aria-label="Settings sections" className="settings-sidebar">
        <h1>Settings</h1>
        <nav>
          {sectionItems.map((item) => (
            <button
              aria-current={activeSection === item.id ? "page" : undefined}
              className={`settings-sidebar__item${activeSection === item.id ? " is-active" : ""}`}
              key={item.id}
              onClick={() => openSection(item.id)}
              type="button"
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section aria-labelledby="settings-page-title" className="settings-main">
        <header className="settings-page-header">
          <h2 id="settings-page-title">{activeSectionInfo.title}</h2>
          <p>{activeSectionInfo.description}</p>
        </header>

        {loadState.kind === "error" && (
          <div className="settings-banner settings-banner--error" role="alert">
            <p>
              {loadState.message} You're seeing default settings, and changes can't be saved
              until they load.
            </p>
            <button
              className="settings-button settings-button--secondary"
              onClick={() => void fetchSettings()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        <div className="settings-card" aria-busy={loadState.kind === "loading"}>
          {activeSection === "overview" && (
            <OverviewSettings
              account={account}
              loading={loadState.kind === "loading"}
              value={draft}
              onEditProfile={() => openSection("profile")}
              onOpenSection={openSection}
              onPlannerChange={(property, value) => updateSetting("planner", property, value)}
              onReminderChange={(name, enabled) =>
                updateSetting("notifications", "reminders", {
                  ...draft.notifications.reminders,
                  [name]: enabled,
                })
              }
              onGoalPriorityChange={(value) => updateSetting("goals", "priority", value)}
              onThemeChange={onThemeChange}
            />
          )}
          {activeSection === "profile" && (
            <ProfileSettings
              value={draft.profile}
              onChange={(property, value) => updateSetting("profile", property, value)}
              onPictureChange={updateProfilePicture}
            />
          )}
          {activeSection === "planner" && (
            <PlannerSettings
              value={draft.planner}
              onChange={(property, value) => updateSetting("planner", property, value)}
              onThemeChange={onThemeChange}
            />
          )}
          {activeSection === "notifications" && (
            <NotificationSettings
              value={draft.notifications}
              onChange={(property, value) =>
                updateSetting("notifications", property, value)
              }
            />
          )}
          {activeSection === "goals" && (
            <GoalSettings
              value={draft.goals}
              onChange={(property, value) => updateSetting("goals", property, value)}
            />
          )}
          {activeSection === "unfinished" && (
            <UnfinishedTaskSettings
              value={draft.unfinished}
              onChange={(property, value) =>
                updateSetting("unfinished", property, value)
              }
            />
          )}
          {activeSection === "weekly" && (
            <WeeklySettings
              value={draft.weekly}
              onChange={(property, value) => updateSetting("weekly", property, value)}
            />
          )}
          {activeSection === "study" && (
            <StudySettings
              value={draft.study}
              onChange={(property, value) => updateSetting("study", property, value)}
            />
          )}
          {activeSection === "privacy" && (
            <PrivacySettings
              value={draft.privacy}
              onChange={(property, value) => updateSetting("privacy", property, value)}
              onExport={downloadSettingsData}
              onReviewDelete={() => setDeleteReviewOpen(true)}
            />
          )}
          {renderSaveRow()}
        </div>
      </section>

      {deleteReviewOpen && (
        <div className="settings-modal-backdrop">
          <section
            aria-labelledby="settings-delete-title"
            aria-modal="true"
            className="settings-delete-modal"
            role="dialog"
          >
            <h2 id="settings-delete-title">Review account deletion</h2>
            <p>
              Deleting an account permanently removes its planner, goals, and
              backups. Account deletion is not connected in this demo.
            </p>
            <div>
              <button
                className="settings-button settings-button--secondary"
                onClick={() => setDeleteReviewOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="settings-button settings-button--danger"
                onClick={() => {
                  setDeleteReviewOpen(false);
                  setStatus({ kind: "info", text: "Account deletion is not available in this demo." });
                }}
                type="button"
              >
                Close review
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function initialsFor(profile: SettingsValues["profile"], account: AccountInfo | null) {
  const initials = `${profile.firstName.trim()[0] ?? ""}${profile.lastName.trim()[0] ?? ""}`;
  return (initials || account?.username[0] || "?").toUpperCase();
}

function formatGraduation(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

type PlannerValues = SettingsValues["planner"];
type PlannerProperty = keyof PlannerValues;

/** The screen Settings opens to: account summary plus the preferences students change most. */
function OverviewSettings({
  account,
  loading,
  value,
  onEditProfile,
  onOpenSection,
  onPlannerChange,
  onReminderChange,
  onGoalPriorityChange,
  onThemeChange,
}: {
  account: AccountInfo | null;
  loading: boolean;
  value: SettingsValues;
  onEditProfile: () => void;
  onOpenSection: (section: SettingsSection) => void;
  onPlannerChange: <Property extends PlannerProperty>(
    property: Property,
    nextValue: PlannerValues[Property],
  ) => void;
  onReminderChange: (name: ReminderLabel, enabled: boolean) => void;
  onGoalPriorityChange: (value: SettingsValues["goals"]["priority"]) => void;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const { profile, planner, notifications, goals } = value;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const studies = [profile.major, profile.school].filter(Boolean).join(" · ");
  const graduation = formatGraduation(profile.graduationDate);

  return (
    <div className="settings-overview">
      <section aria-labelledby="settings-account-title" className="settings-account-card">
        <div className="settings-avatar" aria-hidden="true">
          {profile.avatar ? <img alt="" src={profile.avatar} /> : initialsFor(profile, account)}
        </div>
        <div className="settings-account-card__details">
          <h3 id="settings-account-title">
            {loading ? "Loading your account…" : fullName || "Add your name"}
          </h3>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{profile.email || "Not set"}</dd>
            </div>
            {account?.username && (
              <div>
                <dt>Username</dt>
                <dd>{account.username}</dd>
              </div>
            )}
            <div>
              <dt>Studies</dt>
              <dd>{studies || "Not set"}</dd>
            </div>
            {graduation && (
              <div>
                <dt>Graduating</dt>
                <dd>{graduation}</dd>
              </div>
            )}
          </dl>
        </div>
        <button
          className="settings-button settings-button--secondary"
          onClick={onEditProfile}
          type="button"
        >
          Edit profile
        </button>
      </section>

      <SettingsPanel
        title="Top preferences"
        description="Change these here and press Save changes. The theme applies and saves right away."
      >
        <SegmentedSetting
          label="Theme"
          options={["Light mode", "Dark mode", "System default"]}
          onChange={(next) => {
            onPlannerChange("theme", next);
            onThemeChange(next);
          }}
          value={planner.theme}
        />
        <AccentSetting value={planner.accent} onChange={(next) => onPlannerChange("accent", next)} />
        <div className="settings-form-grid">
          <SegmentedSetting
            label="Planner view"
            options={["Daily", "Weekly", "Monthly"]}
            onChange={(next) => onPlannerChange("view", next)}
            value={planner.view}
          />
          <SegmentedSetting
            label="Default landing page"
            options={["Dashboard", "Planner", "Goals"]}
            onChange={(next) => onPlannerChange("landingPage", next)}
            value={planner.landingPage}
          />
        </div>
        <SegmentedSetting
          label="Default goal priority"
          options={["Low", "Medium", "High"]}
          onChange={onGoalPriorityChange}
          value={goals.priority}
        />
        <div className="settings-field">
          <span className="settings-field__label">Key reminders</span>
          <div className="settings-overview-toggles">
            {(["Daily planning reminder", "Deadline notifications", "Weekly review reminder"] as const).map(
              (name) => (
                <ToggleSetting
                  checked={notifications.reminders[name]}
                  key={name}
                  label={name}
                  onChange={(next) => onReminderChange(name, next)}
                />
              ),
            )}
          </div>
        </div>
      </SettingsPanel>

      <nav aria-label="All settings" className="settings-overview-links">
        <h3>All settings</h3>
        <ul>
          {sectionItems
            .filter((item) => item.id !== "overview")
            .map((item) => (
              <li key={item.id}>
                <button onClick={() => onOpenSection(item.id)} type="button">
                  <span aria-hidden="true">{item.icon}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.summary}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}

type ProfileValues = SettingsValues["profile"];
type ProfileProperty = keyof ProfileValues;

function ProfileSettings({
  value,
  onChange,
  onPictureChange,
}: {
  value: ProfileValues;
  onChange: <Property extends ProfileProperty>(
    property: Property,
    nextValue: ProfileValues[Property],
  ) => void;
  onPictureChange: (file: File | undefined) => void;
}) {
  const initials = initialsFor(value, null);
  return (
    <SettingsPanel
      title="Profile details"
      description="These details are used across your planner and can be updated at any time."
    >
      <div className="settings-profile-picture">
        <div className="settings-avatar" aria-label="Profile picture preview">
          {value.avatar ? <img alt="" src={value.avatar} /> : initials}
        </div>
        <label className="settings-picture-upload">
          <span>{value.avatar ? "Change profile picture" : "Add profile picture"}</span>
          <span>Upload</span>
          <input
            accept="image/*"
            aria-label="Upload profile picture"
            onChange={(event) => onPictureChange(event.target.files?.[0])}
            type="file"
          />
        </label>
        <small>Recommended 320 × 320 or larger. Picture uploads are a preview for now and aren't saved yet.</small>
      </div>
      <div className="settings-form-grid">
        <TextSetting label="First name" onChange={(next) => onChange("firstName", next)} placeholder="Enter first name" value={value.firstName} />
        <TextSetting label="Last name" onChange={(next) => onChange("lastName", next)} placeholder="Enter last name" value={value.lastName} />
        <TextSetting label="Email address" onChange={(next) => onChange("email", next)} placeholder="name@university.edu" type="email" value={value.email} />
        <TextSetting label="College/university" onChange={(next) => onChange("school", next)} placeholder="Enter college or university" value={value.school} />
        <TextSetting label="Major or field of study" onChange={(next) => onChange("major", next)} placeholder="Enter major or field" value={value.major} />
        <TextSetting label="Expected graduation date" onChange={(next) => onChange("graduationDate", next)} placeholder="YYYY-MM" type="month" value={value.graduationDate} />
        <TextSetting label="Career interests" onChange={(next) => onChange("careerInterests", next)} placeholder="e.g. cybersecurity, software engineering, data science" value={value.careerInterests} />
        <TextSetting label="Current career goal(s)" onChange={(next) => onChange("careerGoals", next)} placeholder="Enter current career goals" value={value.careerGoals} />
      </div>
    </SettingsPanel>
  );
}

function AccentSetting({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="settings-field">
      <span className="settings-field__label">Accent color</span>
      <div className="settings-color-picker">
        <span className="settings-color-picker__preview" style={{ backgroundColor: value }} />
        <span>Choose a color theme</span>
        <div>
          {accentOptions.map((option) => (
            <button
              aria-label={`${option.label} accent${value === option.value ? ", selected" : ""}`}
              aria-pressed={value === option.value}
              className={value === option.value ? "is-selected" : ""}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <img alt="" src={option.icon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlannerSettings({
  value,
  onChange,
  onThemeChange,
}: {
  value: PlannerValues;
  onChange: <Property extends PlannerProperty>(
    property: Property,
    nextValue: PlannerValues[Property],
  ) => void;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  return (
    <SettingsPanel title="Appearance and layout" description="Choose the visual theme, planner scope, and defaults that work best for your workflow.">
      <SegmentedSetting
        label="Theme"
        options={["Light mode", "Dark mode", "System default"]}
        onChange={(next) => {
          onChange("theme", next);
          onThemeChange(next);
        }}
        value={value.theme}
      />
      <AccentSetting value={value.accent} onChange={(next) => onChange("accent", next)} />
      <SegmentedSetting label="Planner view" options={["Daily", "Weekly", "Monthly"]} onChange={(next) => onChange("view", next)} value={value.view} />
      <SelectSetting label="Start of the week" onChange={(next) => onChange("startWeek", next as PlannerValues["startWeek"])} options={["Sunday", "Monday", "Saturday"]} value={value.startWeek} />
      <SegmentedSetting label="Time format" options={["12-hour clock", "24-hour clock"]} onChange={(next) => onChange("timeFormat", next)} value={value.timeFormat} />
      <div className="settings-field">
        <span className="settings-field__label">Default landing page</span>
        <div className="settings-inline-options">
          {(["Dashboard", "Planner", "Goals"] as const).map((page) => (
            <label key={page}>
              <input checked={value.landingPage === page} onChange={() => onChange("landingPage", page)} type="radio" />
              {page}
            </label>
          ))}
        </div>
      </div>
    </SettingsPanel>
  );
}

type NotificationValues = SettingsValues["notifications"];
type NotificationProperty = keyof NotificationValues;

function NotificationSettings({
  value,
  onChange,
}: {
  value: NotificationValues;
  onChange: <Property extends NotificationProperty>(
    property: Property,
    nextValue: NotificationValues[Property],
  ) => void;
}) {
  function setReminder(name: ReminderLabel, enabled: boolean) {
    onChange("reminders", { ...value.reminders, [name]: enabled });
  }
  return (
    <SettingsPanel title="Reminder and notification defaults" description="Turn each reminder on or off, then set quiet hours for when you prefer fewer interruptions.">
      <div className="settings-reminders">
        {REMINDER_LABELS.map((name) => (
          <div className="settings-reminder-row" key={name}>
            <strong>{name}</strong>
            <SegmentedSetting
              compact
              label={name}
              onChange={(next) => setReminder(name, next === "On")}
              options={["On", "Off"]}
              value={value.reminders[name] ? "On" : "Off"}
            />
          </div>
        ))}
      </div>
      <div className="settings-form-grid settings-form-grid--quiet">
        <SelectSetting label="Do Not Disturb hours · Start time" onChange={(next) => onChange("quietStart", next)} options={timeOptions} value={value.quietStart} />
        <SelectSetting label="Do Not Disturb hours · End time" onChange={(next) => onChange("quietEnd", next)} options={timeOptions} value={value.quietEnd} />
      </div>
    </SettingsPanel>
  );
}

type GoalValues = SettingsValues["goals"];
type GoalProperty = keyof GoalValues;

function GoalSettings({
  value,
  onChange,
}: {
  value: GoalValues;
  onChange: <Property extends GoalProperty>(
    property: Property,
    nextValue: GoalValues[Property],
  ) => void;
}) {
  return (
    <SettingsPanel title="Goal defaults and tracking" description="Set your preferred defaults for new goals and how you track progress.">
      <SegmentedSetting label="Default goal timeframe" onChange={(next) => onChange("timeframe", next)} options={["Daily", "Weekly", "Monthly", "Yearly"]} value={value.timeframe} />
      <SegmentedSetting label="Default goal category" onChange={(next) => onChange("category", next)} options={["Academic", "Career", "Personal development"]} value={value.category} />
      <SegmentedSetting label="Preferred goal breakdown method" onChange={(next) => onChange("breakdown", next)} options={["Major milestones", "Daily", "Weekly", "Manual"]} value={value.breakdown} />
      <SegmentedSetting label="Default priority level" onChange={(next) => onChange("priority", next)} options={["Low", "Medium", "High"]} value={value.priority} />
      <SegmentedSetting label="Goal completion celebration preferences" onChange={(next) => onChange("celebration", next)} options={["Message", "Animation", "Turn off"]} value={value.celebration} />
      <SegmentedSetting label="Progress tracking preferences" onChange={(next) => onChange("progress", next)} options={["% complete", "Tasks completed", "Milestones completed", "Time spent"]} value={value.progress} />
    </SettingsPanel>
  );
}

type UnfinishedValues = SettingsValues["unfinished"];
type UnfinishedProperty = keyof UnfinishedValues;

function UnfinishedTaskSettings({
  value,
  onChange,
}: {
  value: UnfinishedValues;
  onChange: <Property extends UnfinishedProperty>(
    property: Property,
    nextValue: UnfinishedValues[Property],
  ) => void;
}) {
  return (
    <SettingsPanel title="Unfinished task behavior" description="Decide what happens to incomplete tasks at the end of the day.">
      <div className="settings-choice-grid">
        <ChoiceSetting label="Unfinished task behavior" name="unfinished-behavior" onChange={(next) => onChange("behavior", next)} options={["Ask me what to do", "Automatically move to the next day", "Keep on the original date", "Move to a task backlog for later scheduling"]} value={value.behavior} />
        <ChoiceSetting label="Review time" name="unfinished-review-time" onChange={(next) => onChange("reviewTime", next)} options={["End of each day", "Start of the next day", "During my weekly review", "Never remind me"]} value={value.reviewTime} />
        <ChoiceSetting label="Deadline management" name="unfinished-deadline" onChange={(next) => onChange("deadline", next)} options={["Automatically update the deadline when rescheduling", "Keep the original deadline visible", "Ask me to set a new deadline"]} value={value.deadline} />
        <div className="settings-choice-box">
          <h3>Automatic rescheduling</h3>
          <ToggleSetting checked={value.autoReschedule} label="Enable automatic rescheduling" onChange={(next) => onChange("autoReschedule", next)} />
          <ToggleSetting checked={value.highPriorityOnly} disabled={!value.autoReschedule} label="Only reschedule high-priority tasks" onChange={(next) => onChange("highPriorityOnly", next)} />
          <ToggleSetting checked={value.excludeOverdue} disabled={!value.autoReschedule} label="Exclude overdue tasks from automatic rescheduling" onChange={(next) => onChange("excludeOverdue", next)} />
        </div>
      </div>
      <div className="settings-daily-limit">
        <div className="settings-field">
          <span className="settings-field__label">Daily task limit</span>
          <small>Maximum number of tasks to carry over</small>
          <label className="settings-input-suffix">
            <input max="20" min="0" onChange={(event) => onChange("dailyLimit", Number(event.target.value))} type="number" value={value.dailyLimit} />
            <span>tasks</span>
          </label>
        </div>
        <ToggleSetting checked={value.warnOverload} label="Warn me when my daily schedule is overloaded" onChange={(next) => onChange("warnOverload", next)} />
        <ToggleSetting checked={value.reprioritizeWhenFull} label="Ask me to reprioritize tasks when my schedule is full" onChange={(next) => onChange("reprioritizeWhenFull", next)} />
      </div>
    </SettingsPanel>
  );
}

type WeeklyValues = SettingsValues["weekly"];
type WeeklyProperty = keyof WeeklyValues;

/** Monday-first order for the review day picker. */
const REVIEW_DAY_OPTIONS = [...WEEKDAYS.slice(1), WEEKDAYS[0]];

function WeeklySettings({
  value,
  onChange,
}: {
  value: WeeklyValues;
  onChange: <Property extends WeeklyProperty>(
    property: Property,
    nextValue: WeeklyValues[Property],
  ) => void;
}) {
  return (
    <SettingsPanel title="Weekly progress review settings" description="Configure the cadence, reminders, and content for your weekly review.">
      <SegmentedSetting label="Review day" onChange={(next) => onChange("reviewDay", next)} options={REVIEW_DAY_OPTIONS} value={value.reviewDay} />
      <div className="settings-weekly-reminder">
        <ToggleSetting checked={value.reminder} label="Review reminder" onChange={(next) => onChange("reminder", next)} />
        <label className="settings-time-input">
          <span className="visually-hidden">Reminder time</span>
          <input disabled={!value.reminder} onChange={(event) => onChange("reminderTime", event.target.value)} required type="time" value={value.reminderTime} />
        </label>
      </div>
      <div className="settings-field">
        <span className="settings-field__label">Weekly summary</span>
        <div className="settings-chip-list">
          {SUMMARY_LABELS.map((summary) => {
            const selected = value.summary.includes(summary);
            return (
              <button
                aria-pressed={selected}
                className={selected ? "is-selected" : ""}
                key={summary}
                onClick={() =>
                  onChange(
                    "summary",
                    selected
                      ? value.summary.filter((item) => item !== summary)
                      : SUMMARY_LABELS.filter((item) => item === summary || value.summary.includes(item)),
                  )
                }
                type="button"
              >
                {summary}
              </button>
            );
          })}
        </div>
      </div>
      <ToggleSetting checked={value.reflectionQuestions} label="Reflection questions" onChange={(next) => onChange("reflectionQuestions", next)} />
      <SegmentedSetting label="Missed-goal handling" onChange={(next) => onChange("missedGoal", next)} options={["Keep", "Reschedule", "Revise", "Archive"]} value={value.missedGoal} />
      <SegmentedSetting label="Progress visualization" onChange={(next) => onChange("visualization", next)} options={["Charts", "Progress bars", "Percentages"]} value={value.visualization} />
    </SettingsPanel>
  );
}

type StudyProperty = keyof StudyPreferences;

const hourOptions = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => {
    const hour = from + index;
    return { value: String(hour), label: formatHourLabel(hour) };
  });

function formatHourLabel(hour: number) {
  if (hour === 0 || hour === 24) return "12 AM (midnight)";
  if (hour === 12) return "12 PM (noon)";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function StudySettings({
  value,
  onChange,
}: {
  value: StudyPreferences;
  onChange: <Property extends StudyProperty>(
    property: Property,
    nextValue: StudyPreferences[Property],
  ) => void;
}) {
  const problem = validateStudyPreferences(value);
  const windowHours = value.windowEndHour - value.windowStartHour;
  // How many sessions fit in the window, allowing a one-hour break between sessions.
  const fitPerDay = Math.max(0, Math.floor((windowHours + 1) / (value.sessionHours + 1)));
  const tight = !problem && value.sessionsPerDay > fitPerDay;

  return (
    <SettingsPanel
      title="Study time before exams"
      description="Mark a task as an exam in the To-do list or Priority setter, and Kadence adds study sessions to your planner in the days before it."
    >
      <div className="settings-form-grid">
        <SelectSetting
          label="Start studying"
          onChange={(next) => onChange("daysBeforeExam", Number(next))}
          options={Array.from({ length: 30 }, (_, index) => ({
            value: String(index + 1),
            label: `${plural(index + 1, "day")} before the exam`,
          }))}
          value={String(value.daysBeforeExam)}
        />
        <SelectSetting
          label="Session length"
          onChange={(next) => onChange("sessionHours", Number(next))}
          options={Array.from({ length: 8 }, (_, index) => ({
            value: String(index + 1),
            label: plural(index + 1, "hour"),
          }))}
          value={String(value.sessionHours)}
        />
      </div>
      <SegmentedSetting
        label="Sessions per study day"
        onChange={(next) => onChange("sessionsPerDay", Number(next))}
        options={["1", "2", "3", "4", "5", "6"]}
        value={String(value.sessionsPerDay)}
      />
      <div className="settings-form-grid">
        <SelectSetting
          label="Study hours · From"
          onChange={(next) => onChange("windowStartHour", Number(next))}
          options={hourOptions(0, 23)}
          value={String(value.windowStartHour)}
        />
        <SelectSetting
          label="Study hours · Until"
          onChange={(next) => onChange("windowEndHour", Number(next))}
          options={hourOptions(1, 24)}
          value={String(value.windowEndHour)}
        />
      </div>
      <p
        className={`settings-study-preview${problem ? " is-error" : ""}`}
        role={problem ? "alert" : undefined}
      >
        {problem ??
          `Kadence will schedule ${plural(value.sessionsPerDay, "session")} of ${plural(value.sessionHours, "hour")} on each of the ${plural(value.daysBeforeExam, "day")} before an exam, between ${formatHourLabel(value.windowStartHour)} and ${formatHourLabel(value.windowEndHour)}, around what's already in your planner.`}
        {tight &&
          ` Your study hours only fit ${plural(fitPerDay, "session")} with a break between them, so sessions may run back to back.`}
      </p>
    </SettingsPanel>
  );
}

type PrivacyValues = SettingsValues["privacy"];
type PrivacyProperty = keyof PrivacyValues;

function PrivacySettings({
  value,
  onChange,
  onExport,
  onReviewDelete,
}: {
  value: PrivacyValues;
  onChange: <Property extends PrivacyProperty>(
    property: Property,
    nextValue: PrivacyValues[Property],
  ) => void;
  onExport: () => void;
  onReviewDelete: () => void;
}) {
  return (
    <SettingsPanel title="Account security and data" description="Export planner data and choose how your account data is handled.">
      <div className="settings-field">
        <span className="settings-field__label">Export planner and goal data</span>
        <div className="settings-export-row">
          <div>
            <strong>Export planner and goal data</strong>
            <p>Download a copy of your planner, goals, and progress history for personal records or migration.</p>
          </div>
          <button className="settings-button settings-button--primary" onClick={onExport} type="button">Export data</button>
        </div>
      </div>
      <SegmentedSetting label="Data backup preferences" onChange={(next) => onChange("backup", next)} options={["Automatic", "Manual", "Off"]} value={value.backup} />
      <div className="settings-privacy-toggle">
        <div>
          <strong>{value.deleteCompleted ? "On" : "Off"}</strong>
          <p>Automatically remove completed tasks after a set period to keep your planner tidy.</p>
        </div>
        <ToggleSetting checked={value.deleteCompleted} label="Delete completed tasks automatically" onChange={(next) => onChange("deleteCompleted", next)} />
      </div>
      <div className="settings-danger-card">
        <span aria-hidden="true">!</span>
        <div>
          <strong>Delete account</strong>
          <p>This action permanently removes your account, planner data, goals, and backups. This cannot be undone.</p>
          <button className="settings-button settings-button--secondary" onClick={onReviewDelete} type="button">Review account deletion</button>
        </div>
      </div>
    </SettingsPanel>
  );
}

const timeOptions = [
  { value: "", label: "Select a time" },
  ...Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = index % 2 === 0 ? "00" : "30";
    const value = `${String(hour).padStart(2, "0")}:${minute}`;
    return { value, label: formatTime(value) };
  }),
];

function formatTime(value: string) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-panel">
      <header>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      <div className="settings-panel__body">{children}</div>
    </section>
  );
}

function TextSetting({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="settings-text-field">
      <span>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  );
}

function SegmentedSetting<Option extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: readonly Option[];
  value: Option;
  onChange: (value: Option) => void;
  compact?: boolean;
}) {
  return (
    <div className={`settings-field${compact ? " settings-field--compact" : ""}`}>
      {!compact && <span className="settings-field__label">{label}</span>}
      <div
        aria-label={label}
        className="settings-segmented"
        role="group"
        style={{ "--settings-option-count": options.length } as CSSProperties}
      >
        {options.map((option) => (
          <button
            aria-pressed={value === option}
            className={value === option ? "is-selected" : ""}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectSetting({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[] | { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </label>
  );
}

function ChoiceSetting<Option extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: readonly Option[];
  value: Option;
  onChange: (value: Option) => void;
}) {
  return (
    <fieldset className="settings-choice-box">
      <legend>{label}</legend>
      {options.map((option) => (
        <label className="settings-radio-option" key={option}>
          <input checked={value === option} name={name} onChange={() => onChange(option)} type="radio" />
          <span>{option}</span>
        </label>
      ))}
    </fieldset>
  );
}

function ToggleSetting({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`settings-toggle${disabled ? " is-disabled" : ""}`}>
      <span>{label}</span>
      <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" />
      <span aria-hidden="true" className="settings-toggle__track" />
    </label>
  );
}

export default Settings;
