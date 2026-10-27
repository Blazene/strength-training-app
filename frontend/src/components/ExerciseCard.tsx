import { useEffect, useRef, useState } from "react";
import { markDraft } from "../sync/drafts";
import type { FormEvent } from "react";
import type { WorkoutExercise, WorkoutSet } from "../types/workout";
import type { PreviousSession } from "../utils/workoutHistory";
import { parseSetInput } from "../utils/setInput";
import type { SetInputError } from "../utils/setInput";

type Props = {
  workoutId: string;
  exercise: WorkoutExercise;
  previousSession: PreviousSession | null;
  focusEntry?: boolean;
  onSaveSet: (exerciseId: string, set: WorkoutSet) => Promise<boolean>;
  onDeleteSet: (exerciseId: string, setId: string) => Promise<boolean>;
};

export default function ExerciseCard({
  workoutId,
  exercise,
  previousSession,
  focusEntry = false,
  onSaveSet,
  onDeleteSet
}: Props) {
  const [weight, setWeight] = useState(() => String(exercise.sets.at(-1)?.weightKg ?? ""));
  const [reps, setReps] = useState(() => String(exercise.sets.at(-1)?.reps ?? ""));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<SetInputError | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const submitting = useRef(false);
  const weightInput = useRef<HTMLInputElement>(null);
  const repsInput = useRef<HTMLInputElement>(null);

  const weightId = `${exercise.id}-weight`;
  const repsId = `${exercise.id}-reps`;
  const errorId = `${exercise.id}-error`;
  const previousIndex = previousSession
    ? Math.min(exercise.sets.length, previousSession.sets.length - 1)
    : -1;
  const previousSet = previousSession?.sets[previousIndex];
  const lastSaved = exercise.sets.at(-1);
  const template = JSON.stringify([lastSaved?.id,lastSaved?.weightKg,lastSaved?.reps]);
  const [previousTemplate,setPreviousTemplate] = useState(template);
  // Keep a clean entry aligned with downloaded sets. Unsaved values and edits
  // remain controlled by the person using the form.
  if (previousTemplate!==template) {
    setPreviousTemplate(template);
    if (!dirty && !savingSet && editingId===null) {
      setWeight(String(lastSaved?.weightKg??""));setReps(String(lastSaved?.reps??""));
    }
  }


  useEffect(() => {
    if (focusEntry && !weightInput.current?.closest("[hidden]")) {
      weightInput.current?.focus();
      weightInput.current?.select();
    }
  }, [focusEntry]);

  function focusWeight() {
    // A pending save must not steal focus after the user switches to History.
    requestAnimationFrame(() => {
      if (!weightInput.current?.closest("[hidden]")) {
        weightInput.current?.focus();
        weightInput.current?.select();
      }
    });
  }

  useEffect(() => () => markDraft(exercise.id,workoutId,false), [exercise.id,workoutId]);

  function setDraft(value: boolean) { markDraft(exercise.id,workoutId,value);setDirty(value); }

  function resetForm(template: WorkoutSet | null) {
    setWeight(template ? String(template.weightKg) : "");
    setReps(template ? String(template.reps) : "");
    setEditingId(null);
    setError(null);
    setDraft(false);
  }

  async function saveSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const parsed = parseSetInput(weight, reps);
    if (parsed.error) {
      setError(parsed.error);
      const input = parsed.error.field === "weight" ? weightInput.current : repsInput.current;
      input?.focus();
      input?.select();
      return;
    }

    submitting.current = true;
    setSavingSet(true);
    setError(null);
    const savedSet: WorkoutSet = {
      id: editingId ?? crypto.randomUUID(),
      ...parsed.value
    };

    try {
      const saved = await onSaveSet(exercise.id, savedSet);
      if (saved) {
        const lastSet = exercise.sets.at(-1);
        const nextTemplate = editingId && lastSet && lastSet.id !== editingId ? lastSet : savedSet;
        resetForm(nextTemplate);
        focusWeight();
      } else {
        setError({ message: "Could not save this set. Your entries are still here. Try again." });
      }
    } catch {
      setError({ message: "Could not save this set. Your entries are still here. Try again." });
    } finally {
      submitting.current = false;
      setSavingSet(false);
    }
  }

  function editSet(set: WorkoutSet) {
    setEditingId(set.id);
    fillFromSet(set);
  }

  function fillFromSet(set: WorkoutSet) {
    setDraft(true);
    setWeight(String(set.weightKg));
    setReps(String(set.reps));
    setError(null);
    focusWeight();
  }

  async function deleteSet(setId: string) {
    if (!window.confirm("Delete this set?")) return;
    const saved = await onDeleteSet(exercise.id, setId);
    if (saved && editingId === setId) {
      resetForm(exercise.sets.filter((set) => set.id !== setId).at(-1) ?? null);
      focusWeight();
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
            <p className="previous-overview">
              {previousSession.sets.map((set) => `${set.weightKg} kg × ${set.reps}`).join(" · ")}
            </p>
            <details className="previous-details">
              <summary>View previous sets ({previousSession.sets.length})</summary>
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
            </details>
          </>
        ) : <p className="muted">No previous session for this exercise yet.</p>}
      </section>

      <form className="set-entry" onSubmit={saveSet} noValidate aria-busy={savingSet}>
        <p className="form-heading">
          {editingId ? "Edit selected set" : `Log set ${exercise.sets.length + 1}`}
        </p>

        <div className="entry-shortcuts">
          {previousSet ? (
            <button
              type="button"
              className="secondary"
              disabled={editingId !== null}
              aria-label={`Copy ${exercise.name} previous session set ${previousIndex + 1}`}
              onClick={() => fillFromSet(previousSet)}
            >
              Copy previous set
            </button>
          ) : null}
          {exercise.sets.length > 0 && editingId === null ? (
            <button
              type="button"
              className="secondary"
              onClick={() => fillFromSet(exercise.sets[exercise.sets.length - 1])}
            >
              Use last set
            </button>
          ) : null}
        </div>
        {previousSet ? (
          <p className="muted copy-source">
            {editingId ? "Save or cancel your edit to copy a previous set." :
              `Last session, set ${previousIndex + 1}: ${previousSet.weightKg} kg × ${previousSet.reps} reps`}
          </p>
        ) : null}

        <div className="input-grid">
          <label htmlFor={weightId}>
            Weight (kg)
            <input
              ref={weightInput}
              id={weightId}
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              required
              placeholder="60"
              value={weight}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => {
                const input = event.currentTarget;
                // Safari may place the caret after its native tap handling.
                requestAnimationFrame(() => { if (document.activeElement === input) input.select(); });
              }}
              onChange={(event) => { setDraft(true); setWeight(event.target.value); setError(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  repsInput.current?.focus();
                  repsInput.current?.select();
                }
              }}
              aria-invalid={error?.field === "weight"}
              aria-describedby={error?.field === "weight" ? errorId : undefined}
            />
          </label>

          <label htmlFor={repsId}>
            Reps
            <input
              ref={repsInput}
              id={repsId}
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              pattern="[0-9]*"
              autoComplete="off"
              required
              placeholder="8"
              value={reps}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => {
                const input = event.currentTarget;
                // Safari may place the caret after its native tap handling.
                requestAnimationFrame(() => { if (document.activeElement === input) input.select(); });
              }}
              onChange={(event) => { setDraft(true); setReps(event.target.value); setError(null); }}
              aria-invalid={error?.field === "reps"}
              aria-describedby={error?.field === "reps" ? errorId : undefined}
            />
          </label>
        </div>

        {error ? <p id={errorId} className="error" role="alert">{error.message}</p> : null}

        <div className="form-actions">
          <button type="submit" disabled={savingSet}>
            {savingSet ? "Saving…" : editingId ? "Save changes" : "Add set"}
          </button>
          {dirty && !editingId ? <button type="button" className="secondary" onClick={()=>{resetForm(exercise.sets.at(-1)??null);focusWeight();}}>Reset entry</button> : null}
          {editingId ? (
            <button
              type="button"
              className="secondary"
              onClick={() => { resetForm(exercise.sets.at(-1) ?? null); focusWeight(); }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {dirty ? <p className="muted" role="status">Unsaved entry · Tap Add set or Save changes to keep it.</p> : null}
        {!editingId && exercise.sets.length > 0 ? (
          <p className="muted entry-hint">Values are ready for your next set. Adjust them or tap Add set again.</p>
        ) : null}
      </form>

      {exercise.sets.length === 0 ? (
        <p className="muted">No sets logged yet. Add your first set above.</p>
      ) : (
        <section aria-labelledby={`${exercise.id}-logged-title`}>
          <h3 className="logged-title" id={`${exercise.id}-logged-title`}>Logged sets</h3>
          <ol className="set-list">
            {exercise.sets.map((set, index) => (
              <li className="set-row" key={set.id}>
                <div>
                  <span className="muted">Set {index + 1}</span>
                  <strong>{set.weightKg} kg × {set.reps} reps</strong>
                </div>
                <div className="row-actions">
                  <button type="button" className="secondary small" onClick={() => editSet(set)}
                    aria-label={`Edit ${exercise.name} set ${index + 1}`}>
                    Edit
                  </button>
                  <button type="button" className="danger small" onClick={() => deleteSet(set.id)}
                    aria-label={`Delete ${exercise.name} set ${index + 1}`}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
