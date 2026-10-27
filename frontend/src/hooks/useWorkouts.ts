import { useEffect, useRef, useState } from "react";
import { loadWorkouts, saveWorkouts } from "../storage/workouts";
import type { WorkoutState } from "../storage/workouts";

export function useWorkouts() {
  const [state, setState] = useState<WorkoutState>({ revision: 0, active: null, history: [] });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const current = useRef(state);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkouts().then((loaded) => {
      if (cancelled) return;
      current.current = loaded;
      setState(loaded);
      setReady(true);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(message(cause, "Could not open local workout storage."));
    });
    return () => { cancelled = true; };
  }, [attempt]);

  async function commit(update: (state: WorkoutState) => WorkoutState): Promise<boolean> {
    if (!ready || busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const next = { ...update(current.current), revision: current.current.revision + 1 };
      await saveWorkouts(next);
      current.current = next;
      setState(next);
      return true;
    } catch (cause) {
      setError(message(cause, "Could not save. Your last saved workout is unchanged. Try the action again."));
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function retry() {
    setError("");
    setAttempt((value) => value + 1);
  }

  return { state, ready, saving, error, commit, retry };
}

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? `${fallback} ${cause.message}` : fallback;
}
