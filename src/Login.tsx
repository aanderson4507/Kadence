import { useState, type FormEvent } from "react";
import "./Login.css";
import { errorMessage } from "./http";
import { login, register } from "./session";

type Mode = "login" | "register";

function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "register" && password.length < 8) {
      setStatusMessage("Choose a password with at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setStatusMessage("");
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register({ username: username.trim(), email: email.trim(), password, firstName: firstName.trim() || undefined });
      window.location.assign("/dashboard");
    } catch (error) {
      setStatusMessage(errorMessage(error));
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatusMessage("");
  }

  return (
    <main className="login-page">
      <section aria-labelledby="login-heading" className="login-panel">
        <header className="login-welcome">
          <a aria-label="Kadence home" className="login-brand" href="/">
            <span aria-hidden="true" className="login-brand__mark">
              <img src="/assets/brand-sprout-login.svg" alt="" />
            </span>
            <span className="login-brand__name">Kadence</span>
          </a>

          <div className="login-introduction">
            <h1 id="login-heading">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>{mode === "login" ? "Log in to your Kadence account." : "Start planning your week in a few minutes."}</p>
          </div>
        </header>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="login-credentials">
            <div className="login-field">
              <label htmlFor="username">{mode === "login" ? "Username or email" : "Username"}</label>
              <input
                autoComplete="username"
                id="username"
                maxLength={mode === "login" ? 255 : 50}
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                required
                value={username}
              />
            </div>

            {mode === "register" && (
              <>
                <div className="login-field">
                  <label htmlFor="email">Email</label>
                  <input
                    autoComplete="email"
                    id="email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@university.edu"
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="first-name">First name (optional)</label>
                  <input
                    autoComplete="given-name"
                    id="first-name"
                    maxLength={100}
                    name="firstName"
                    onChange={(event) => setFirstName(event.target.value)}
                    value={firstName}
                  />
                </div>
              </>
            )}

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-password-input">
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  id="password"
                  maxLength={72}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
                  required
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                  className="password-visibility"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  <img src="/assets/password-visibility.svg" alt="" />
                </button>
              </div>
            </div>
          </div>

          <button aria-busy={submitting} className="login-submit" disabled={submitting} type="submit">
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>

          {mode === "login" && (
            <button
              className="login-link"
              onClick={() => setStatusMessage("Password changes aren't available yet. Ask your team lead to reset it.")}
              type="button"
            >
              Change password
            </button>
          )}

          {statusMessage && (
            <p aria-live="polite" className="login-status" role="alert">
              {statusMessage}
            </p>
          )}
        </form>

        <p className="login-signup">
          <span>{mode === "login" ? "New to Kadence?" : "Already have an account?"}</span>
          <button
            className="login-link login-signup__link"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            type="button"
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
      </section>

      <footer className="login-footer">© 2026 Kadence</footer>
    </main>
  );
}

export default Login;
