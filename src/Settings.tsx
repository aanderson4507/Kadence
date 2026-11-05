import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./Settings.css";

type SettingsSection =
  | "profile"
  | "planner"
  | "notifications"
  | "goals"
  | "unfinished"
  | "weekly"
  | "privacy";

type SettingsValues = {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    school: string;
    major: string;
    graduationDate: string;
    careerInterests: string;
    careerGoals: string;
    avatar: string | null;
  };
  planner: {
    theme: "Light mode" | "Dark mode" | "System default";
    accent: string;
    view: "Daily" | "Weekly" | "Monthly";
    startWeek: string;
    timeFormat: "12-hour clock" | "24-hour clock";
    landingPage: "Dashboard" | "Planner" | "Goals";
  };
  notifications: {
    reminders: Record<string, boolean>;
    quietStart: string;
    quietEnd: string;
  };
  goals: {
    timeframe: "Daily" | "Weekly" | "Monthly" | "Yearly";
    category: "Academic" | "Career" | "Personal development";
    breakdown: "Major milestones" | "Daily" | "Weekly" | "Manual";
    priority: "Low" | "Medium" | "High";
    celebration: "Message" | "Animation" | "Turn off";
    progress: "% complete" | "Tasks completed" | "Milestones completed" | "Time spent";
  };
  unfinished: {
    behavior:
      | "Ask me what to do"
      | "Automatically move to the next day"
      | "Keep on the original date"
      | "Move to a task backlog for later scheduling";
    reviewTime:
      | "End of each day"
      | "Start of the next day"
      | "During my weekly review"
      | "Never remind me";
    deadline:
      | "Automatically update the deadline when rescheduling"
      | "Keep the original deadline visible"
      | "Ask me to set a new deadline";
    autoReschedule: boolean;
    highPriorityOnly: boolean;
    excludeOverdue: boolean;
    dailyLimit: number;
    warnOverload: boolean;
    reprioritizeWhenFull: boolean;
  };
  weekly: {
    reviewDay: string;
    reminder: boolean;
    reminderTime: string;
    summary: string[];
    reflectionQuestions: boolean;
    missedGoal: "Keep" | "Reschedule" | "Revise" | "Archive";
    visualization: "Charts" | "Progress bars" | "Percentages";
  };
  privacy: {
    backup: "Automatic" | "Manual" | "Off";
    deleteCompleted: boolean;
  };
};

const initialSettings: SettingsValues = {
  profile: {
    firstName: "",
    lastName: "",
    email: "",
    school: "",
    major: "",
    graduationDate: "",
    careerInterests: "",
    careerGoals: "",
    avatar: null,
  },
  planner: {
    theme: "Light mode",
    accent: "#406b51",
    view: "Daily",
    startWeek: "Sunday",
    timeFormat: "12-hour clock",
    landingPage: "Dashboard",
  },
  notifications: {
    reminders: {
      "Daily planning reminder": true,
      "Upcoming task reminders": true,
      "Deadline notifications": true,
      "Goal progress reminders": true,
      "Weekly review reminder": true,
      "Missed-goal notifications": true,
    },
    quietStart: "",
    quietEnd: "",
  },
  goals: {
    timeframe: "Daily",
    category: "Academic",
    breakdown: "Major milestones",
    priority: "Medium",
    celebration: "Message",
    progress: "% complete",
  },
  unfinished: {
    behavior: "Ask me what to do",
    reviewTime: "Start of the next day",
    deadline: "Keep the original deadline visible",
    autoReschedule: false,
    highPriorityOnly: false,
    excludeOverdue: false,
    dailyLimit: 3,
    warnOverload: true,
    reprioritizeWhenFull: true,
  },
  weekly: {
    reviewDay: "Friday",
    reminder: true,
    reminderTime: "16:30",
    summary: [
      "Tasks completed",
      "Goals completed",
      "Milestones reached",
      "Time spent",
    ],
    reflectionQuestions: true,
    missedGoal: "Keep",
    visualization: "Charts",
  },
  privacy: {
    backup: "Automatic",
    deleteCompleted: true,
  },
};

type ThemePreference = SettingsValues["planner"]["theme"];

function createInitialSettings(themePreference: ThemePreference): SettingsValues {
  return {
    ...initialSettings,
    planner: { ...initialSettings.planner, theme: themePreference },
  };
}

const sectionItems: {
  id: SettingsSection;
  label: string;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    id: "profile",
    label: "Personal and career profile",
    icon: "◎",
    title: "Personal and career profile",
    description: "Update the details that shape your planner, career goals, and weekly reviews.",
  },
  {
    id: "planner",
    label: "Planner appearance and layout",
    icon: "▦",
    title: "Planner appearance and layout",
    description: "Customize the look, layout, and defaults for your daily planner experience.",
  },
  {
    id: "notifications",
    label: "Notifications and reminders",
    icon: "☷",
    title: "Notifications and reminders",
    description: "Control when Kadence sends planning reminders, task alerts, and progress updates.",
  },
  {
    id: "goals",
    label: "Goal-setting preferences",
    icon: "□",
    title: "Goal-setting preferences",
    description: "Choose the defaults and tracking behaviors that help you set, structure, and celebrate goals.",
  },
  {
    id: "unfinished",
    label: "Unfinished task management",
    icon: "◉",
    title: "Unfinished task management",
    description: "Choose how Kadence handles incomplete tasks, reminders, deadlines, and daily carryover.",
  },
  {
    id: "weekly",
    label: "Weekly progress reviews",
    icon: "⚑",
    title: "Weekly progress reviews",
    description: "Choose the defaults and tracking behaviors that help you set, structure, and celebrate goals.",
  },
  {
    id: "privacy",
    label: "Privacy and account management",
    icon: "⚙",
    title: "Privacy and account management",
    description: "Manage passwords, data exports, backups, completed task cleanup, and account access.",
  },
];

const accentOptions = [
  { value: "#406b51", label: "Green", icon: "/assets/settings-accent-green.svg" },
  { value: "#5477a7", label: "Blue", icon: "/assets/settings-accent-blue.svg" },
  { value: "#8270a6", label: "Purple", icon: "/assets/settings-accent-purple.svg" },
  { value: "#b66d80", label: "Rose", icon: "/assets/settings-accent-rose.svg" },
  { value: "#c18b52", label: "Amber", icon: "/assets/settings-accent-amber.svg" },
];

type SettingsProps = {
  isDarkMode: boolean;
  onThemeChange: (theme: ThemePreference) => void;
  onExport: (preferences: object) => void;
  themePreference: ThemePreference;
};

function Settings({
  isDarkMode,
  onExport,
  onThemeChange,
  themePreference,
}: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [savedSettings, setSavedSettings] = useState(() =>
    createInitialSettings(themePreference),
  );
  const [draft, setDraft] = useState(() =>
    createInitialSettings(themePreference),
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [deleteReviewOpen, setDeleteReviewOpen] = useState(false);

  const activeSectionInfo = sectionItems.find((item) => item.id === activeSection)!;

  useEffect(() => {
    setSavedSettings((current) => ({
      ...current,
      planner: { ...current.planner, theme: themePreference },
    }));
    setDraft((current) => ({
      ...current,
      planner: { ...current.planner, theme: themePreference },
    }));
  }, [themePreference]);

  function updateSetting<
    Section extends keyof SettingsValues,
    Property extends keyof SettingsValues[Section],
  >(section: Section, property: Property, value: SettingsValues[Section][Property]) {
    setDraft((current) => ({
      ...current,
      [section]: { ...current[section], [property]: value },
    }));
    setStatusMessage("");
  }

  function saveSettings() {
    setSavedSettings(draft);
    setStatusMessage("Changes saved.");
  }

  function discardSettings() {
    setDraft(savedSettings);
    setStatusMessage("Unsaved changes discarded.");
  }

  function downloadSettingsData() {
    onExport(savedSettings);
    setStatusMessage("Your data export is ready.");
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

  function updatePrivacySetting<
    Property extends keyof SettingsValues["privacy"],
  >(property: Property, value: SettingsValues["privacy"][Property]) {
    setDraft((current) => ({
      ...current,
      privacy: { ...current.privacy, [property]: value },
    }));
    setSavedSettings((current) => ({
      ...current,
      privacy: { ...current.privacy, [property]: value },
    }));
    setStatusMessage("Privacy preferences updated.");
  }

  function renderSaveRow() {
    return (
      <footer className="settings-save-row">
        <p aria-live="polite">{statusMessage || "Save your changes to update your preferences."}</p>
        <div>
          <button className="settings-button settings-button--secondary" onClick={discardSettings} type="button">
            Discard
          </button>
          <button className="settings-button settings-button--primary" onClick={saveSettings} type="button">
            Save changes
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
              onClick={() => {
                setActiveSection(item.id);
                setStatusMessage("");
              }}
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

        <div className="settings-card">
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
          {activeSection === "privacy" && (
            <PrivacySettings
              value={draft.privacy}
              onChange={updatePrivacySetting}
              onExport={downloadSettingsData}
              onReviewDelete={() => setDeleteReviewOpen(true)}
            />
          )}
          {activeSection !== "privacy" && renderSaveRow()}
          {activeSection === "privacy" && statusMessage && (
            <p aria-live="polite" className="settings-save-status">
              {statusMessage}
            </p>
          )}
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
                  setStatusMessage("Account deletion is not available in this demo.");
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
  const initials = `${value.firstName[0] ?? "A"}${value.lastName[0] ?? "L"}`.toUpperCase();
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
        <small>Recommended 320 × 320 or larger.</small>
      </div>
      <div className="settings-form-grid">
        <TextSetting label="First name" onChange={(next) => onChange("firstName", next)} placeholder="Enter first name" value={value.firstName} />
        <TextSetting label="Last name" onChange={(next) => onChange("lastName", next)} placeholder="Enter last name" value={value.lastName} />
        <TextSetting label="Email address" onChange={(next) => onChange("email", next)} placeholder="name@university.edu" type="email" value={value.email} />
        <TextSetting label="College/university" onChange={(next) => onChange("school", next)} placeholder="Enter college or university" value={value.school} />
        <TextSetting label="Major or field of study" onChange={(next) => onChange("major", next)} placeholder="Enter major or field" value={value.major} />
        <TextSetting label="Expected graduation date" onChange={(next) => onChange("graduationDate", next)} placeholder="MM / YYYY" value={value.graduationDate} />
        <TextSetting label="Career interests" onChange={(next) => onChange("careerInterests", next)} placeholder="e.g. cybersecurity, software engineering, data science" value={value.careerInterests} />
        <TextSetting label="Current career goal(s)" onChange={(next) => onChange("careerGoals", next)} placeholder="Enter current career goals" value={value.careerGoals} />
      </div>
    </SettingsPanel>
  );
}

type PlannerValues = SettingsValues["planner"];
type PlannerProperty = keyof PlannerValues;

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
      <div className="settings-field">
        <span className="settings-field__label">Accent color</span>
        <div className="settings-color-picker">
          <span className="settings-color-picker__preview" style={{ backgroundColor: value.accent }} />
          <span>Choose a color theme</span>
          <div>
            {accentOptions.map((option) => (
              <button
                aria-label={`${option.label} accent${value.accent === option.value ? ", selected" : ""}`}
                aria-pressed={value.accent === option.value}
                className={value.accent === option.value ? "is-selected" : ""}
                key={option.value}
                onClick={() => onChange("accent", option.value)}
                type="button"
              >
                <img alt="" src={option.icon} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <SegmentedSetting label="Planner view" options={["Daily", "Weekly", "Monthly"]} onChange={(next) => onChange("view", next)} value={value.view} />
      <SelectSetting label="Start of the week" onChange={(next) => onChange("startWeek", next)} options={["Sunday", "Monday", "Saturday"]} value={value.startWeek} />
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
  function setReminder(name: string, enabled: boolean) {
    onChange("reminders", { ...value.reminders, [name]: enabled });
  }
  return (
    <SettingsPanel title="Reminder and notification defaults" description="Turn each reminder on or off, then set quiet hours for when you prefer fewer interruptions.">
      <div className="settings-reminders">
        {Object.keys(value.reminders).map((name) => (
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
  const summaries = ["Tasks completed", "Goals completed", "Milestones reached", "Time spent", "Completion rate"];
  return (
    <SettingsPanel title="Weekly progress review settings" description="Configure the cadence, reminders, and content for your weekly review.">
      <SegmentedSetting label="Review day" onChange={(next) => onChange("reviewDay", next)} options={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]} value={value.reviewDay} />
      <div className="settings-weekly-reminder">
        <ToggleSetting checked={value.reminder} label="Review reminder" onChange={(next) => onChange("reminder", next)} />
        <label className="settings-time-input">
          <span className="visually-hidden">Reminder time</span>
          <input disabled={!value.reminder} onChange={(event) => onChange("reminderTime", event.target.value)} type="time" value={value.reminderTime} />
        </label>
      </div>
      <div className="settings-field">
        <span className="settings-field__label">Weekly summary</span>
        <div className="settings-chip-list">
          {summaries.map((summary) => {
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
                      : [...value.summary, summary],
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
    <>
      <SettingsPanel title="Account security and data" description="Update your password, export planner data, and choose how your account data is handled.">
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
    </>
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
