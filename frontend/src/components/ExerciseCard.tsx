import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { WorkoutExercise, WorkoutSet } from "../types/workout";
import type { PreviousSession } from "../utils/workoutHistory";

type Props = {
  exercise: WorkoutExercise;
  previousSession: PreviousSession | null;
  onSaveSet: (exerciseId: string, set: WorkoutSet) => Promise<boolean>;
  onDeleteSet: (exerciseId: string, setId: string) => Promise<boolean>;
};

export default function ExerciseCard({
  exercise,
  previousSession,
  onSaveSet,
  onDeleteSet
}: Props) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const weightInput = useRef<HTMLInputElement>(null);

  const weightId = `${exercise.id}-weight`;
  const repsId = `${exercise.id}-reps`;
  const errorId = `${exercise.id}-error`;

  function resetForm() {
    setWeight("");
    setReps("");
    setEditingId(null);
    setError("");
  }

  async function saveSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const weightKg = Number(weight);
    const repetitions = Number(reps);

    if (
      weight.trim() === "" ||
      reps.trim() === "" ||
      !Number.isFinite(weightKg) ||
      weightKg < 0 ||
      !Number.isSafeInteger(repetitions) ||
      repetitions < 1
    ) {
      setError("Enter a weight of 0 or more and a whole-number rep count of 1 or more.");
      return;
    }

    const saved = await onSaveSet(exercise.id, {
      id: editingId ?? crypto.randomUUID(),
      weightKg,
      reps: repetitions
    });

    if (saved) {
      resetForm();
      weightInput.current?.focus();
    }
  }

  function editSet(set: WorkoutSet) {
    setEditingId(set.id);
    setWeight(String(set.weightKg));
    setReps(String(set.reps));
    setError("");
    weightInput.current?.focus();
  }

  function useLastSet() {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    if (!lastSet) return;

    fillFromSet(lastSet);
  }

  function fillFromSet(set: WorkoutSet) {
    setWeight(String(set.weightKg));
    setReps(String(set.reps));
    setError("");
    weightInput.current?.focus();
  }

  async function deleteSet(setId: string) {
    if (!window.confirm("Delete this set?")) return;

    const saved = await onDeleteSet(exercise.id, setId);

    if (saved && editingId === setId) {
      resetForm();
    }
  }

  return (
    <section className="exercise-card" aria-labelledby={`${exercise.id}-title`}>
      <div className="card-heading">
        <h2 id={`${exercise.id}-title`}>{exercise.name}</h2>
        <span className="badge">
          {exercise.sets.length} {exercise.sets.length === 1 ? "set" : "sets"}
        </span>
      </div>

      <section className="previous-session" aria-labelledby={`${exercise.id}-previous-title`}>
        <h3 id={`${exercise.id}-previous-title`}>Previous session</h3>
        {previousSession ? (
          <>
            <p className="muted">
              <time dateTime={previousSession.completedAt}>
                {new Date(previousSession.completedAt).toLocaleString([], {
                  dateStyle: "medium", timeStyle: "short"
                })}
              </time>
            </p>
            <ol className="set-list previous-set-list">
              {previousSession.sets.map((set, index) => (
                <li className="set-row" key={set.id}>
                  <div>
                    <span className="muted">Set {index + 1}</span>
                    <strong>{set.weightKg} kg × {set.reps} reps</strong>
                  </div>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => fillFromSet(set)}
                    disabled={editingId !== null}
                    aria-label={`Use ${exercise.name} previous session set ${index + 1}`}
                  >
                    Use set {index + 1}
                  </button>
                </li>
              ))}
            </ol>
            <p className="muted previous-hint">
              {editingId
                ? "Save or cancel your edit to use a previous set."
                : "Choose a set to fill the form, adjust it, then press Add set to log it."}
            </p>
          </>
        ) : (
          <p className="muted">No previous session for this exercise yet.</p>
        )}
      </section>

      {exercise.sets.length === 0 ? (
        <p className="muted">No sets logged yet. Add your first set below.</p>
      ) : (
        <ol className="set-list">
          {exercise.sets.map((set, index) => (
            <li className="set-row" key={set.id}>
              <div>
                <span className="muted">Set {index + 1}</span>
                <strong>{set.weightKg} kg × {set.reps} reps</strong>
              </div>

              <div className="row-actions">
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => editSet(set)}
                  aria-label={`Edit ${exercise.name} set ${index + 1}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="danger small"
                  onClick={() => deleteSet(set.id)}
                  aria-label={`Delete ${exercise.name} set ${index + 1}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {exercise.sets.length > 0 && editingId === null ? (
        <button
          type="button"
          className="secondary"
          onClick={useLastSet}
        >
          Use last set
        </button>
      ) : null}

      <form onSubmit={saveSet} noValidate>
        <p className="form-heading">
          {editingId ? "Edit selected set" : "Log a set"}
        </p>

        <div className="input-grid">
          <label htmlFor={weightId}>
            Weight (kg)
            <input
              ref={weightInput}
              id={weightId}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              required
              placeholder="60"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </label>

          <label htmlFor={repsId}>
            Reps
            <input
              id={repsId}
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              placeholder="8"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </label>
        </div>

        {error ? <p id={errorId} className="error" role="alert">{error}</p> : null}

        <div className="form-actions">
          <button type="submit">
            {editingId ? "Save changes" : "Add set"}
          </button>

          {editingId ? (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
