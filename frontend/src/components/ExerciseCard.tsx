import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { WorkoutExercise, WorkoutSet } from "../types/workout";

type Props = {
  exercise: WorkoutExercise;
  onSaveSet: (exerciseId: string, set: WorkoutSet) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
};

export default function ExerciseCard({
  exercise,
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

  function saveSet(event: FormEvent<HTMLFormElement>) {
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

    onSaveSet(exercise.id, {
      id: editingId ?? crypto.randomUUID(),
      weightKg,
      reps: repetitions
    });

    resetForm();
    weightInput.current?.focus();
  }

  function editSet(set: WorkoutSet) {
    setEditingId(set.id);
    setWeight(String(set.weightKg));
    setReps(String(set.reps));
    setError("");
    weightInput.current?.focus();
  }

  function deleteSet(setId: string) {
    if (!window.confirm("Delete this set?")) return;

    onDeleteSet(exercise.id, setId);

    if (editingId === setId) {
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
