import { useState, type FormEvent } from "react";
import "./QuickSetup.css";
import { errorMessage } from "./http";
import { PRIORITY_LEVELS, type Priority } from "./taskPriority";

// User story 1.1 (issue #2): set up the week in a couple of minutes from the dashboard.

export type QuickTask = { title: string; date: string; startHour: number; duration: number; priority: Priority };

type Row = { id: string; title: string; day: number; startHour: number; duration: number; priority: Priority };

const newRow = (): Row => ({ id: crypto.randomUUID(), title: "", day: 0, startHour: 9, duration: 1, priority: "None" });

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function QuickSetup({
  onSave,
  onCancel,
}: {
  /** Saves every row in one request; rejects (and keeps the rows) if any of them is invalid. */
  onSave: (tasks: QuickTask[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [week, setWeek] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return dateKey(today);
  });
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const days = Array.from({ length: 7 }, (_, day) => {
    const date = new Date(`${week}T12:00:00`);
    date.setDate(date.getDate() + day);
    return date;
  });

  function updateRow(id: string, changes: Partial<Row>) {
    setRows((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rows.some((row) => !row.title.trim())) {
      setError("Give each task a name, or remove the empty row.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(
        rows.map((row) => ({
          title: row.title.trim(),
          date: dateKey(days[row.day]),
          startHour: row.startHour,
          duration: row.duration,
          priority: row.priority,
        })),
      );
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form aria-labelledby="quick-setup-title" className="quick-setup" onSubmit={(event) => void submit(event)}>
      <header>
        <h1 id="quick-setup-title">Quick Setup</h1>
        <p>Plan your week in a few minutes. Add tasks, pick their days, and you’re ready.</p>
      </header>
      <label>
        Week starting
        <input
          onChange={(event) => {
            if (!event.target.value) return;
            const date = new Date(`${event.target.value}T12:00:00`);
            date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
            setWeek(dateKey(date));
          }}
          required
          type="date"
          value={week}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {rows.map((row, index) => (
        <fieldset key={row.id}>
          <legend>Task {index + 1}</legend>
          <label>
            Task name
            <input
              autoFocus={index === 0}
              maxLength={200}
              onChange={(event) => updateRow(row.id, { title: event.target.value })}
              placeholder="e.g. Review lecture notes"
              required
              value={row.title}
            />
          </label>
          <label>
            Day
            <select onChange={(event) => updateRow(row.id, { day: Number(event.target.value) })} value={row.day}>
              {days.map((date, day) => (
                <option key={day} value={day}>
                  {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <select
              onChange={(event) => {
                const startHour = Number(event.target.value);
                updateRow(row.id, { startHour, duration: Math.min(row.duration, 24 - startHour) });
              }}
              value={row.startHour}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {hour % 12 || 12}:00 {hour < 12 ? "AM" : "PM"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Duration
            <select onChange={(event) => updateRow(row.id, { duration: Number(event.target.value) })} value={row.duration}>
              {Array.from({ length: 24 - row.startHour }, (_, i) => i + 1).map((hours) => (
                <option key={hours} value={hours}>
                  {hours} {hours === 1 ? "hour" : "hours"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select onChange={(event) => updateRow(row.id, { priority: event.target.value as Priority })} value={row.priority}>
              {PRIORITY_LEVELS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label={`Remove task ${index + 1}`}
            disabled={rows.length === 1}
            onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
            type="button"
          >
            Remove
          </button>
        </fieldset>
      ))}
      <button onClick={() => setRows((current) => [...current, newRow()])} type="button">
        + Add another task
      </button>
      <p>Tasks start as Work · Not started. You can edit their details in the planner.</p>
      <footer>
        <button disabled={saving} onClick={onCancel} type="button">
          Cancel
        </button>
        <button aria-busy={saving} className="quick-setup-primary" disabled={saving} type="submit">
          {saving ? "Saving…" : `Save ${rows.length} ${rows.length === 1 ? "task" : "tasks"} & view week`}
        </button>
      </footer>
    </form>
  );
}
