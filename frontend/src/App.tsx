import { useState } from "react";
import { useWorkoutSync } from "./hooks/useWorkoutSync";
import SyncStatus from "./components/SyncStatus";
import { useWorkouts } from "./hooks/useWorkouts";
import ExerciseCard from "./components/ExerciseCard";
import OfflineStatus from "./components/OfflineStatus";
import AccountPanel from "./components/AccountPanel";
import WorkoutHistory from "./components/WorkoutHistory";
import WorkoutSummary from "./components/WorkoutSummary";
import { exercises } from "./data/exercises";
import { findPreviousSession } from "./utils/workoutHistory";
import type {
  Workout,
  WorkoutExercise,
  WorkoutSet
} from "./types/workout";

export default function App() {
  const { state, ready, saving, error, commit, retry } = useWorkouts();
  const sync = useWorkoutSync(ready);
  const workout = state.active;
  const [view, setView] = useState<"workout" | "history">("workout");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [entryFocusId, setEntryFocusId] = useState<string | null>(null);
  const completed = workout ? null : state.history[0] ?? null;

  function setWorkout(update: (current: Workout | null) => Workout | null) {
    return commit((current) => ({ ...current, active: update(current.active) }));
  }

  const availableExercises = exercises.filter(
    (exercise) =>
      !workout?.exercises.some((item) => item.exerciseId === exercise.id)
  );

  const totalSets =
    workout?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    ?? 0;

  async function startWorkout() {
    const saved = await setWorkout(() => ({
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      exercises: []
    }));
    if (saved) {
      setSelectedExerciseId("");
      setView("workout");
    }
  }

  async function addExercise() {
    const selected = exercises.find(
      (exercise) => exercise.id === selectedExerciseId
    );

    if (!selected) return;

    const newExercise: WorkoutExercise = {
      id: crypto.randomUUID(),
      exerciseId: selected.id,
      name: selected.name,
      sets: []
    };

    const saved = await setWorkout((current) => {
      if (
        !current ||
        current.exercises.some((item) => item.exerciseId === selected.id)
      ) {
        return current;
      }

      return {
        ...current,
        exercises: [...current.exercises, newExercise]
      };
    });

    if (saved) {
      setSelectedExerciseId("");
      setEntryFocusId(newExercise.id);
    }
  }

  function removeExercise(exerciseId: string) {
    const exercise = workout?.exercises.find(
      (item) => item.id === exerciseId
    );

    if (!exercise) return;

    if (
      !window.confirm(
        `Remove ${exercise.name}? Its logged sets and unfinished inputs will be discarded.`
      )
    ) {
      return;
    }

    setWorkout((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.filter(
              (item) => item.id !== exerciseId
            )
          }
        : current
    );
  }

  function saveSet(exerciseId: string, savedSet: WorkoutSet) {
    return setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;

          const alreadyExists = exercise.sets.some(
            (set) => set.id === savedSet.id
          );

          return {
            ...exercise,
            sets: alreadyExists
              ? exercise.sets.map((set) =>
                  set.id === savedSet.id ? savedSet : set
                )
              : [...exercise.sets, savedSet]
          };
        })
      };
    });
  }

  function deleteSet(exerciseId: string, setId: string) {
    return setWorkout((current) => {
      if (!current) return current;

      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.filter((set) => set.id !== setId)
              }
            : exercise
        )
      };
    });
  }

  async function finishWorkout() {
    if (!workout || totalSets === 0) return;

    if (
      !window.confirm(
        "Finish this workout? Only logged sets will be included. Save any unfinished set or edit before continuing."
      )
    ) {
      return;
    }

    const completedAt = new Date().toISOString();
    const saved = await commit((current) => {
      if (!current.active) return current;
      const finished = {
        ...current.active,
        completedAt,
        exercises: current.active.exercises.filter((exercise) => exercise.sets.length > 0)
      };
      return { ...current, active: null, history: [finished, ...current.history] };
    });
    if (saved) {
      setView("workout");
      setSelectedExerciseId("");
      window.scrollTo({ top: 0 });
    }
  }

  if (!ready) {
    return (
      <main className="container">
        <h1>Strength training</h1>
        {error ? (
          <>
            <p className="error" role="alert">{error}</p>
            <button type="button" onClick={retry}>Retry loading workouts</button>
          </>
        ) : <p role="status">Loading saved workouts…</p>}
      </main>
    );
  }

  const heading = view === "history" ? "Workout history" : workout
    ? "Your workout"
    : completed
      ? "Workout complete"
      : "Ready to train?";

  return (
    <main className="container">
      <header>
        <p className="eyebrow">STRENGTH TRAINING</p>
        <h1>{heading}</h1>
        <p className="muted">{view === "history" ? "Review your completed sessions." : "Keep your focus on the next set."}</p>
      </header>

      <nav className="app-navigation" aria-label="App navigation">
        <button
          type="button"
          className="secondary"
          aria-current={view === "workout" ? "page" : undefined}
          onClick={() => setView("workout")}
        >
          {workout ? "Current workout" : "Home"}
        </button>
        <button
          type="button"
          className="secondary"
          aria-current={view === "history" ? "page" : undefined}
          onClick={() => setView("history")}
        >
          History ({state.history.length})
        </button>
      </nav>

      <AccountPanel sync={sync} />
      <SyncStatus sync={sync} />
      <OfflineStatus />

      <p className="notice">
        Workouts are saved in this browser on this device. Logged sets survive
        refreshes; unfinished form inputs are not saved. Clearing browser data
        removes your local workouts. When sync is enabled, saved changes upload while the app is open and connected.
      </p>
      <p className="muted" role="status">
        {saving ? "Saving… Keep this page open." : error ? "Changes were not saved." : "Saved on this device"}
      </p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div hidden={view !== "workout"}>
        <fieldset className="workout-controls" disabled={saving}>

          {completed ? (
            <WorkoutSummary workout={completed} title="Session summary">
              <p className="muted">
                This session is saved in your workout history. You can start another
                workout and come back to it later.
              </p>
              <button type="button" onClick={startWorkout}>
                Start another workout
              </button>
            </WorkoutSummary>
          ) : null}

          {!workout && !completed ? (
            <section className="exercise-card">
              <h2>Start a session</h2>
              <p className="muted">
                Choose your exercises and record the weight and reps for each set.
              </p>
              <button type="button" onClick={startWorkout}>
                Start workout
              </button>
            </section>
          ) : null}

          {workout ? (
            <>
              <section className="workout-summary" aria-label="Workout summary">
                <div>
                  <span className="muted">Started</span>
                  <strong>
                    {new Date(workout.startedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </strong>
                </div>
                <div>
                  <span className="muted">Exercises</span>
                  <strong>{workout.exercises.length}</strong>
                </div>
                <div>
                  <span className="muted">Sets logged</span>
                  <strong aria-live="polite">{totalSets}</strong>
                </div>
              </section>

              <section className="exercise-card" aria-labelledby="add-exercise-title">
                <h2 id="add-exercise-title">Add an exercise</h2>

                {availableExercises.length > 0 ? (
                  <div className="exercise-picker">
                    <label htmlFor="exercise">
                      Exercise
                      <select
                        id="exercise"
                        value={selectedExerciseId}
                        onChange={(event) => setSelectedExerciseId(event.target.value)}
                      >
                        <option value="">Choose an exercise</option>
                        {availableExercises.map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={addExercise}
                      disabled={!selectedExerciseId}
                    >
                      Add exercise
                    </button>
                  </div>
                ) : (
                  <p className="muted">All available exercises have been added.</p>
                )}
              </section>

              {workout.exercises.map((exercise) => (
                <div key={exercise.id}>
                  <ExerciseCard
                    exercise={exercise}
                    focusEntry={entryFocusId === exercise.id}
                    previousSession={findPreviousSession(state.history, exercise.exerciseId, workout.id)}
                    onSaveSet={saveSet}
                    onDeleteSet={deleteSet}
                  />
                  <button
                    type="button"
                    className="danger small remove-exercise"
                    onClick={() => removeExercise(exercise.id)}
                    aria-label={`Remove ${exercise.name} from workout`}
                  >
                    Remove exercise
                  </button>
                </div>
              ))}

              <section className="finish-panel">
                <button
                  type="button"
                  onClick={finishWorkout}
                  disabled={totalSets === 0}
                >
                  Finish workout
                </button>
                <p className="muted">
                  {totalSets === 0
                    ? "Log at least one set to finish."
                    : "Save your final set or edit before finishing."}
                </p>
              </section>
            </>
          ) : null}

        </fieldset>
      </div>
      <div hidden={view !== "history"}>
        <WorkoutHistory history={state.history} saving={saving} onDelete={(id) => commit((current) => ({ ...current, history: current.history.filter((session) => session.id !== id) }))} />
      </div>
    </main>
  );
}
