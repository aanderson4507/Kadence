import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import Login from "./Login";
import "./theme.css";

type ThemePreference = "Light mode" | "Dark mode" | "System default";

function resolveTheme(themePreference: ThemePreference): "light" | "dark" {
  if (themePreference === "System default") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return themePreference === "Dark mode" ? "dark" : "light";
}

function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const savedPreference = window.localStorage.getItem("kadence-theme");
    const preference: ThemePreference =
      savedPreference === "Dark mode" || savedPreference === "System default"
        ? savedPreference
        : "Light mode";
    document.documentElement.dataset.theme = resolveTheme(preference);
    return preference;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(themePreference);
    window.localStorage.setItem("kadence-theme", themePreference);
  }, [themePreference]);

  return window.location.pathname === "/dashboard" ? (
    <Dashboard
      themePreference={themePreference}
      onThemeChange={setThemePreference}
    />
  ) : (
    <Login />
  );
}

export default App;
