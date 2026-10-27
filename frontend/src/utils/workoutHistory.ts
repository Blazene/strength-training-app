import type { CompletedWorkout, WorkoutSet } from "../types/workout";

export type PreviousSession = {
  workoutId: string;
  completedAt: string;
  sets: WorkoutSet[];
};

export function findPreviousSession(
  history: CompletedWorkout[],
  exerciseId: string,
  activeWorkoutId: string
): PreviousSession | null {
  let previous: PreviousSession | null = null;

  for (const workout of history) {
    if (workout.id === activeWorkoutId) continue;
    const exercise = workout.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise || exercise.sets.length === 0) continue;
    const completedAt = Date.parse(workout.completedAt);
    if (!Number.isFinite(completedAt)) continue;
    if (previous && completedAt <= Date.parse(previous.completedAt)) continue;

    previous = {
      workoutId: workout.id,
      completedAt: workout.completedAt,
      sets: exercise.sets
    };
  }

  return previous;
}
