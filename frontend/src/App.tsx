import { useState } from "react";
import ExerciseCard from "./components/ExerciseCard";
import { exercises } from "./data/exercises";
import type { Workout, WorkoutExercise, WorkoutSet } from "./types/workout";

export default function App() {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const availableExercises = exercises.filter(
    (exercise) =>
      !workout?.exercises.some((item) => item.exerciseId === exercise.id)
  );

  const totalSets =
    workout?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    ?? 0;

  function startWorkout() {
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

  return (
    <main className="container">
      <header>
        <p className="eyebrow">STRENGTH TRAINING</p>
        <h1>{workout ? "Your workout" : "Ready to train?"}</h1>
        <p className="muted">Keep your focus on the next set.</p>
      </header>

      <p className="notice">
        Early version: entries are temporary and will clear on refresh.
      </p>

      {!workout ? (
        <section className="exercise-card">
          <h2>Start a session</h2>
          <p className="muted">
            Choose your exercises and record the weight and reps for each set.
          </p>
          <button type="button" onClick={startWorkout}>
            Start workout
          </button>
        </section>
      ) : (
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
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onSaveSet={saveSet}
              onDeleteSet={deleteSet}
            />
          ))}
        </>
      )}
    </main>
  );
}
