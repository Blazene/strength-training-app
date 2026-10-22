import { useState } from "react";

function App() {
  const [status, setStatus] = useState("Not checked yet");
  const [checking, setChecking] = useState(false);

  async function checkBackend() {
    setChecking(true);
    setStatus("Connecting...");

    try {
      const response = await fetch("/api/health", {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "ok") {
        throw new Error("Unexpected server response");
      }

      setStatus("Connected! The backend is running.");
    } catch {
      setStatus("Cannot reach the backend. Check that it is running.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="container">
      <p className="eyebrow">DAY 1 · PROJECT SETUP</p>

      <h1>Strength Training</h1>

      <p className="description">
        Log sets quickly. See your previous lifts. Keep your progress.
      </p>

      <section className="card" aria-labelledby="connection-heading">
        <h2 id="connection-heading">Backend connection</h2>

        <p role="status">{status}</p>

        <button onClick={checkBackend} disabled={checking}>
          {checking ? "Checking..." : "Check connection"}
        </button>
      </section>

      <p className="note">
        Workout logging and offline saving are coming next.
      </p>
    </main>
  );
}

export default App;
