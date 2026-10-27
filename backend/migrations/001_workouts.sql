CREATE TABLE exercises (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120)
);
CREATE TABLE workouts (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text GENERATED ALWAYS AS (CASE WHEN completed_at IS NULL THEN 'active' ELSE 'completed' END) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX workouts_user_started_idx ON workouts(user_id, started_at DESC, id DESC);
CREATE TABLE workout_exercises (
  user_id text NOT NULL,
  id uuid NOT NULL,
  workout_id uuid NOT NULL,
  exercise_id text NOT NULL REFERENCES exercises(id),
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workout_id) REFERENCES workouts(user_id, id) ON DELETE CASCADE,
  UNIQUE (user_id, workout_id, position),
  UNIQUE (user_id, workout_id, exercise_id)
);
CREATE INDEX workout_exercises_lookup_idx ON workout_exercises(user_id, exercise_id, workout_id);
CREATE TABLE workout_sets (
  user_id text NOT NULL,
  id uuid NOT NULL,
  workout_exercise_id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  weight_kg numeric NOT NULL CHECK (weight_kg >= 0 AND weight_kg != 'NaN'::numeric AND weight_kg != 'Infinity'::numeric),
  reps bigint NOT NULL CHECK (reps BETWEEN 1 AND 9007199254740991),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workout_exercise_id) REFERENCES workout_exercises(user_id, id) ON DELETE CASCADE,
  UNIQUE (user_id, workout_exercise_id, position)
);
