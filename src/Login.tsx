import { useState, type FormEvent } from "react";
import "./Login.css";

function Login() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.assign("/dashboard");
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
            <h1 id="login-heading">Welcome back</h1>
            <p>Log in to your Kadence account.</p>
          </div>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-credentials">
            <div className="login-field">
              <label htmlFor="username">Username</label>
              <input
                autoComplete="username"
                id="username"
                name="username"
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="login-password-input">
                <input
                  autoComplete="current-password"
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  required
                  type={passwordVisible ? "text" : "password"}
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

          <button className="login-submit" type="submit">
            Log in
          </button>

          <button
            className="login-link"
            onClick={() =>
              setStatusMessage("Password changes are not configured yet.")
            }
            type="button"
          >
            Change password
          </button>

          {statusMessage && (
            <p aria-live="polite" className="login-status" role="status">
              {statusMessage}
            </p>
          )}
        </form>

        <p className="login-signup">
          <span>New to Kadence?</span>
          <button
            className="login-link login-signup__link"
            onClick={() =>
              setStatusMessage("Account creation is not configured yet.")
            }
            type="button"
          >
            Create an account
          </button>
        </p>
      </section>

      <footer className="login-footer">© 2026 Kadence</footer>
    </main>
  );
}

export default Login;
