import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { accountRequest } from "../utils/accountApi";
import type { WorkoutSync } from "../hooks/useWorkoutSync";

export default function AccountPanel({ sync }: { sync: WorkoutSync }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const user = sync.user;
  const status = sync.accountStatus;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await accountRequest(mode === "signup" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email", {
        email: email.trim(), password, ...(mode === "signup" ? { name: name.trim() } : {})
      });
      if (!result?.user) throw new Error("Account could not be confirmed. Try again.");
      sync.sessionChanged(result.user); setPassword("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in. Try again."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function signOut() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await accountRequest("/api/auth/sign-out", {}); sync.sessionChanged(null); setPassword(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign out. Try again when connected."); }
    finally { pending.current = false; setBusy(false); }
  }

  return (
    <details className="account-panel" onToggle={(event) => { if (!event.currentTarget.open) { setPassword(""); setError(""); } }}>
      <summary>Account{user && status === "ready" ? ` · ${user.name}` : ""}</summary>
      <section aria-label="Account settings">
        {status === "checking" ? <p role="status">Checking your account…</p> : null}
        {status === "unavailable" ? (
          <>
            <p>Account service is unavailable. You can keep logging on this device.</p>
            <button type="button" className="secondary" onClick={sync.retry}>Retry account connection</button>
          </>
        ) : null}
        {status === "ready" && user ? (
          <>
            <p>Signed in as <strong>{user.name}</strong> ({user.email}).</p>
            <button type="button" className="secondary" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
          </>
        ) : null}
        {status === "ready" && !user ? (
          <form onSubmit={authenticate}>
            <h2>{mode === "signup" ? "Create account" : "Sign in"}</h2>
            <fieldset className="account-fields" disabled={busy}>
              {mode === "signup" ? <label htmlFor="account-name">Name<input id="account-name" autoComplete="name" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /></label> : null}
              <label htmlFor="account-email">Email<input id="account-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label htmlFor="account-password">Password<input id="account-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="password-help" /></label>
              <p className="muted" id="password-help">Use at least 12 characters.</p>
              <div className="form-actions">
                <button type="submit">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
                <button type="button" className="secondary" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setPassword(""); }}>
                  {mode === "signup" ? "Use an existing account" : "Create an account"}
                </button>
              </div>
            </fieldset>
          </form>
        ) : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
        <p className="muted">Workouts save on this device first. With sync enabled, changes upload and your account workouts download while the app is open and connected. Saved changes resume next time you open it online.</p>
      </section>
    </details>
  );
}
