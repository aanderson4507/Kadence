import { useEffect, useState, type ReactNode } from "react";
import {
  fetchAvailability,
  fetchReminderRules,
  saveAvailability,
  saveReminderRules,
  type AvailabilityWindow,
  type ReminderRule,
} from "./api";
import { errorMessage } from "./http";
import { WEEKDAYS } from "./settingsApi";

// Two Settings panels that save to their own tables (not UserSettings), each with its own Save:
//   - Reminder frequency by priority (user story 2.6, issue #13) -> priority_reminder_rules
//   - Open time slots for rescheduling missed tasks (user story 1.2, issue #3) -> availability_windows

type Status = { kind: "error" | "success" | "info"; text: string } | null;

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
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

function SaveRow({
  status,
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  status: Status;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const isError = status?.kind === "error";
  return (
    <footer className="settings-save-row">
      <p
        className={`settings-save-message${isError ? " is-error" : ""}${status?.kind === "success" ? " is-success" : ""}`}
        role={isError ? "alert" : "status"}
      >
        {status?.text ?? (dirty ? "You have unsaved changes." : "All changes saved.")}
      </p>
      <div>
        <button className="settings-button settings-button--secondary" disabled={!dirty || saving} onClick={onDiscard} type="button">
          Discard
        </button>
        <button
          aria-busy={saving}
          className="settings-button settings-button--primary"
          disabled={!dirty || saving}
          onClick={onSave}
          type="button"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </footer>
  );
}

const reminderOptions = Array.from({ length: 9 }, (_, count) => count);

export function ReminderFrequencySettings({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [saved, setSaved] = useState<ReminderRule[] | null>(null);
  const [draft, setDraft] = useState<ReminderRule[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReminderRules(userId)
      .then((rules) => {
        setSaved(rules);
        setDraft(rules);
      })
      .catch((error) => setStatus({ kind: "error", text: errorMessage(error) }));
  }, [userId]);

  const dirty = saved !== null && JSON.stringify(saved) !== JSON.stringify(draft);

  async function save() {
    setSaving(true);
    setStatus({ kind: "info", text: "Saving…" });
    try {
      const stored = await saveReminderRules(userId, draft);
      setSaved(stored);
      setDraft(stored);
      setStatus({ kind: "success", text: "Reminder frequency saved." });
      onSaved();
    } catch (error) {
      setStatus({ kind: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Panel
        title="Reminder frequency by priority"
        description="How many reminders a day you get for tasks due within a week. More important work reminds you more often. Any single task can override this in the Priority setter."
      >
        {saved === null && !status && <p>Loading your reminder frequency…</p>}
        <div className="settings-form-grid">
          {draft.map((rule) => (
            <label className="settings-text-field" key={rule.priority}>
              <span>{rule.priority} priority</span>
              <select
                onChange={(event) => {
                  const remindersPerDay = Number(event.target.value);
                  setDraft((current) =>
                    current.map((item) => (item.priority === rule.priority ? { ...item, remindersPerDay } : item)),
                  );
                  setStatus(null);
                }}
                value={rule.remindersPerDay}
              >
                {reminderOptions.map((count) => (
                  <option key={count} value={count}>
                    {count === 0 ? "No reminders" : `${count} a day`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="settings-study-preview">Reminders are spread between 9 AM and 9 PM and skip your Do Not Disturb hours.</p>
      </Panel>
      <SaveRow dirty={dirty} onDiscard={() => saved && setDraft(saved)} onSave={() => void save()} saving={saving} status={status} />
    </>
  );
}

function minutesToTime(minutes: number) {
  if (minutes >= 1440) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/** Checks what the server checks, so problems show before saving. */
export function validateWindows(windows: AvailabilityWindow[]): string | null {
  for (const window of windows) {
    if (window.endMinute <= window.startMinute) return `${WEEKDAYS[window.weekday]}: the end time must be after the start time.`;
    if (window.endMinute - window.startMinute < 60) return `${WEEKDAYS[window.weekday]}: each open time slot must be at least an hour.`;
  }
  const sorted = [...windows].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].weekday === sorted[index - 1].weekday && sorted[index].startMinute < sorted[index - 1].endMinute) {
      return `${WEEKDAYS[sorted[index].weekday]}: two open time slots overlap.`;
    }
  }
  return null;
}

type DraftWindow = AvailabilityWindow & { key: string };

export function AvailabilitySettings({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [saved, setSaved] = useState<AvailabilityWindow[] | null>(null);
  const [draft, setDraft] = useState<DraftWindow[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [saving, setSaving] = useState(false);

  const withKeys = (windows: AvailabilityWindow[]) => windows.map((window) => ({ ...window, key: crypto.randomUUID() }));
  const strip = (windows: DraftWindow[]) => windows.map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute }));

  useEffect(() => {
    fetchAvailability(userId)
      .then((windows) => {
        setSaved(windows);
        setDraft(withKeys(windows));
      })
      .catch((error) => setStatus({ kind: "error", text: errorMessage(error) }));
  }, [userId]);

  const dirty = saved !== null && JSON.stringify(saved) !== JSON.stringify(strip(draft));
  const problem = validateWindows(draft);

  function update(key: string, changes: Partial<AvailabilityWindow>) {
    setDraft((current) => current.map((window) => (window.key === key ? { ...window, ...changes } : window)));
    setStatus(null);
  }

  async function save() {
    if (problem) {
      setStatus({ kind: "error", text: problem });
      return;
    }
    setSaving(true);
    setStatus({ kind: "info", text: "Saving…" });
    try {
      const stored = await saveAvailability(userId, strip(draft));
      setSaved(stored);
      setDraft(withKeys(stored));
      setStatus({ kind: "success", text: "Open time slots saved." });
      onSaved();
    } catch (error) {
      setStatus({ kind: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const timeChoices = Array.from({ length: 49 }, (_, index) => index * 30);

  return (
    <>
      <Panel
        title="Open time slots"
        description="When you miss a task, Kadence can move it into the next free hour inside these windows, without overlapping anything already in your planner."
      >
        {saved === null && !status && <p>Loading your open time slots…</p>}
        {draft.length === 0 && saved !== null && <p>No open time slots yet. Add the times you usually have free.</p>}
        <ul className="settings-availability">
          {draft.map((window) => (
            <li key={window.key}>
              <label>
                <span className="visually-hidden">Day</span>
                <select onChange={(event) => update(window.key, { weekday: Number(event.target.value) })} value={window.weekday}>
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="visually-hidden">From</span>
                <select
                  onChange={(event) => update(window.key, { startMinute: timeToMinutes(event.target.value) })}
                  value={minutesToTime(window.startMinute)}
                >
                  {timeChoices.slice(0, -1).map((minutes) => (
                    <option key={minutes} value={minutesToTime(minutes)}>
                      {minutesToTime(minutes)}
                    </option>
                  ))}
                </select>
              </label>
              <span>to</span>
              <label>
                <span className="visually-hidden">Until</span>
                <select
                  onChange={(event) => update(window.key, { endMinute: timeToMinutes(event.target.value) })}
                  value={minutesToTime(window.endMinute)}
                >
                  {timeChoices.slice(1).map((minutes) => (
                    <option key={minutes} value={minutesToTime(minutes)}>
                      {minutesToTime(minutes)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                aria-label={`Remove ${WEEKDAYS[window.weekday]} slot`}
                className="settings-button settings-button--secondary"
                onClick={() => setDraft((current) => current.filter((item) => item.key !== window.key))}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button
          className="settings-button settings-button--secondary"
          onClick={() => {
            setDraft((current) => [...current, { key: crypto.randomUUID(), weekday: 1, startMinute: 18 * 60, endMinute: 21 * 60 }]);
            setStatus(null);
          }}
          type="button"
        >
          + Add an open time slot
        </button>
        {problem && (
          <p className="settings-study-preview is-error" role="alert">
            {problem}
          </p>
        )}
      </Panel>
      <SaveRow
        dirty={dirty}
        onDiscard={() => saved && setDraft(withKeys(saved))}
        onSave={() => void save()}
        saving={saving}
        status={status}
      />
    </>
  );
}
