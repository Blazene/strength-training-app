export type Exercise = {
  id: string;
  name: string;
};

export type WorkoutSet = {
  id: string;
  weightKg: number;
  reps: number;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  name: string;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  startedAt: string;
  exercises: WorkoutExercise[];
};

export type CompletedWorkout = Workout & {
  completedAt: string;
};
