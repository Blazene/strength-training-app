import { useId } from "react";
import type { ReactNode } from "react";
import type { CompletedWorkout } from "../types/workout";

type Props = {
  workout: CompletedWorkout;
  title: string;
  children?: ReactNode;
};

export default function WorkoutSummary({ workout, title, children }: Props) {
  const titleId = useId();
  const totalSets = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const minutes = Math.max(1, Math.ceil(
    (Date.parse(workout.completedAt) - Date.parse(workout.startedAt)) / 60000
  ));

  return (
    <article className="exercise-card" aria-labelledby={titleId}>
      <p className="eyebrow">SESSION FINISHED</p>
      <h2 id={titleId}>{title}</h2>
      <p className="muted">
        <time dateTime={workout.completedAt}>
          {new Date(workout.completedAt).toLocaleString([], {
            dateStyle: "medium", timeStyle: "short"
          })}
        </time>
      </p>

      <div className="workout-summary">
        <div><span className="muted">Duration</span><strong>{minutes} min</strong></div>
        <div><span className="muted">Exercises</span><strong>{workout.exercises.length}</strong></div>
        <div><span className="muted">Sets logged</span><strong>{totalSets}</strong></div>
      </div>

      {workout.exercises.map((exercise) => (
        <div className="summary-exercise" key={exercise.id}>
          <h3>{exercise.name}</h3>
          <ol>
            {exercise.sets.map((set) => (
              <li key={set.id}>{set.weightKg} kg × {set.reps} reps</li>
            ))}
          </ol>
        </div>
      ))}
      {children}
    </article>
  );
}
