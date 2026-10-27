import { useEffect, useRef, useState } from "react";
import type { CompletedWorkout } from "../types/workout";
import WorkoutSummary from "./WorkoutSummary";

export default function WorkoutHistory({ history, saving, onDelete }: {
  history: CompletedWorkout[];
  saving: boolean;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const details = useRef<HTMLDivElement>(null);
  const selected = history.find((session) => session.id === selectedId);
  const ordered = [...history].sort((left, right) =>
    Date.parse(right.completedAt) - Date.parse(left.completedAt)
  );

  useEffect(() => {
    if (selectedId) {
      details.current?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [selectedId]);

  return (
    <section aria-label="Completed workout history">
      {selected ? (
        <div className="history-details" ref={details} tabIndex={-1}>
          <WorkoutSummary workout={selected} title="Workout details" />
          <button type="button" className="danger" disabled={saving} onClick={async () => {
            if (!window.confirm("Delete this completed workout? If sync is enabled, its server copy will also be deleted when connected.")) return;
            if (await onDelete(selected.id)) setSelectedId(null);
          }}>Delete workout</button>
        </div>
      ) : null}

      <div className="exercise-card">
        <h2>Completed sessions</h2>
        {ordered.length === 0 ? (
          <p className="muted">No completed workouts yet. Finish a workout with at least one logged set to see it here.</p>
        ) : (
          <>
            <p className="muted">Choose a session to see its exercises and sets.</p>
            <ol className="history-list">
              {ordered.map((session) => {
                const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
                return (
                <li key={session.id}>
                  <button
                    type="button"
                    className="secondary history-button"
                    aria-pressed={selectedId === session.id}
                    onClick={() => setSelectedId(session.id)}
                  >
                    <strong>{new Date(session.completedAt).toLocaleString([], {
                      dateStyle: "medium", timeStyle: "short"
                    })}</strong>
                    <span>
                      {session.exercises.length} {session.exercises.length === 1 ? "exercise" : "exercises"}
                      {" · "}{setCount} {setCount === 1 ? "set" : "sets"}
                    </span>
                    <span>{session.exercises.map((exercise) => exercise.name).join(", ")}</span>
                  </button>
                </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
