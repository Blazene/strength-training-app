import { useState } from "react";
import ExerciseCard from "./components/ExerciseCard";
import { exercises } from "./data/exercises";
import type {
  CompletedWorkout,
  Workout,
  WorkoutExercise,
  WorkoutSet
} from "./types/workout";

export default function App() {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [completed, setCompleted] = useState<CompletedWorkout | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const availableExercises = exercises.filter(
    (exercise) =>
      !workout?.exercises.some((item) => item.exerciseId === exercise.id)
  );

  const totalSets =
    workout?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    ?? 0;

  const completedSets =
    completed?.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0
    ) ?? 0;

  const completedMinutes = completed
    ? Math.max(
        1,
        Math.ceil(
          (Date.parse(completed.completedAt) - Date.parse(completed.startedAt))
          / 60000
        )
      )
    : 0;

  function startWorkout() {
    if (
      completed &&
      !window.confirm(
        "Start another workout? This temporary summary will be cleared."
      )
    ) {
      return;
    }

    setCompleted(null);
    setSelectedExerciseId("");
    setWorkout({
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      exercises: []
    });
  }

  function addExercise() {
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

    setWorkout((current) => {
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

    setSelectedExerciseId("");
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
    setWorkout((current) => {
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
    setWorkout((current) => {
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

  function finishWorkout() {
    if (!workout || totalSets === 0) return;

    if (
      !window.confirm(
        "Finish this workout? Only logged sets will be included. Save any unfinished set or edit before continuing."
      )
    ) {
      return;
    }

    setCompleted({
      ...workout,
      completedAt: new Date().toISOString(),
      exercises: workout.exercises.filter(
        (exercise) => exercise.sets.length > 0
      )
    });

    setWorkout(null);
    setSelectedExerciseId("");
    window.scrollTo({ top: 0 });
  }

  const heading = workout
    ? "Your workout"
    : completed
      ? "Workout complete"
      : "Ready to train?";

  return (
    <main className="container">
      <header>
        <p className="eyebrow">STRENGTH TRAINING</p>
        <h1>{heading}</h1>
        <p className="muted">Keep your focus on the next set.</p>
      </header>

      <p className="notice">
        Early version: workouts and summaries are temporary.
        Refreshing or closing this page clears them.
      </p>

      {completed ? (
        <section className="exercise-card" aria-labelledby="summary-title">
          <p className="eyebrow">SESSION FINISHED</p>
          <h2 id="summary-title">Session summary</h2>

          <div className="workout-summary">
            <div>
              <span className="muted">Duration</span>
              <strong>{completedMinutes} min</strong>
            </div>
            <div>
              <span className="muted">Exercises</span>
              <strong>{completed.exercises.length}</strong>
            </div>
            <div>
              <span className="muted">Sets logged</span>
              <strong>{completedSets}</strong>
            </div>
          </div>

          {completed.exercises.map((exercise) => (
            <div className="summary-exercise" key={exercise.id}>
              <h3>{exercise.name}</h3>
              <ol>
                {exercise.sets.map((set) => (
                  <li key={set.id}>
                    {set.weightKg} kg × {set.reps} reps
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <p className="muted">
            This summary is shown for this visit only. Workout history
            and persistent saving are coming next.
          </p>

          <button type="button" onClick={startWorkout}>
            Start another workout
          </button>
        </section>
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
    </main>
  );
}
