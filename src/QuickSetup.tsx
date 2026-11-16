import { useState, type FormEvent } from "react";
import "./QuickSetup.css";

export type QuickTask = { title: string; date: string; startHour: number; duration: number };

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function QuickSetup({ onSave, onCancel }: {
  onSave: (tasks: QuickTask[]) => void;
  onCancel: () => void;
}) {
  const [week, setWeek] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return dateKey(today);
  });
  const [rows, setRows] = useState(() => [{ id: crypto.randomUUID(), title: "", day: 0, startHour: 9, duration: 1 }]);
  const [error, setError] = useState("");
  const days = Array.from({ length: 7 }, (_, day) => {
    const date = new Date(`${week}T12:00:00`);
    date.setDate(date.getDate() + day);
    return date;
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rows.some((row) => !row.title.trim())) {
      setError("Give each task a name, or remove the empty row.");
      return;
    }
    onSave(rows.map((row) => ({ title: row.title.trim(), date: dateKey(days[row.day]), startHour: row.startHour, duration: row.duration })));
  }

  return <form className="quick-setup" onSubmit={submit} aria-labelledby="quick-setup-title">
    <header><h1 id="quick-setup-title">Quick Setup</h1><p>Plan your week in a few minutes. Add tasks, pick their days, and you’re ready.</p></header>
    <label>Week starting
      <input type="date" required value={week} onChange={(event) => {
        if (!event.target.value) return;
        const date = new Date(`${event.target.value}T12:00:00`);
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        setWeek(dateKey(date));
      }} />
    </label>
    {error && <p role="alert">{error}</p>}
    {rows.map((row, index) => <fieldset key={row.id}>
      <legend>Task {index + 1}</legend>
      <label>Task name<input autoFocus={index === 0} required maxLength={200} placeholder="e.g. Review lecture notes" value={row.title} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, title: event.target.value } : item))} /></label>
      <label>Day<select value={row.day} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, day: Number(event.target.value) } : item))}>
        {days.map((date, day) => <option key={day} value={day}>{date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</option>)}
      </select></label>
      <label>Start time<select value={row.startHour} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, startHour: Number(event.target.value), duration: Math.min(item.duration, 24 - Number(event.target.value)) } : item))}>
        {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hour % 12 || 12}:00 {hour < 12 ? "AM" : "PM"}</option>)}
      </select></label>
      <label>Duration<select value={row.duration} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, duration: Number(event.target.value) } : item))}>
        {Array.from({ length: 24 - row.startHour }, (_, i) => i + 1).map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? "hour" : "hours"}</option>)}
      </select></label>
      <button type="button" disabled={rows.length === 1} aria-label={`Remove task ${index + 1}`} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Remove</button>
    </fieldset>)}
    <button type="button" onClick={() => setRows((current) => [...current, { id: crypto.randomUUID(), title: "", day: 0, startHour: 9, duration: 1 }])}>+ Add another task</button>
    <p>Tasks start as Work · Not started. You can edit their details in the planner.</p>
    <footer><button type="button" onClick={onCancel}>Cancel</button><button className="quick-setup-primary" type="submit">Save {rows.length} {rows.length === 1 ? "task" : "tasks"} & view week</button></footer>
  </form>;
}
