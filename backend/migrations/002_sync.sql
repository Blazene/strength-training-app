-- Receipts are kept for the lifetime of the account so a late retry remains safe.
CREATE TABLE sync_operations (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  request_hash text NOT NULL,
  workout_id uuid NOT NULL,
  device_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK (sequence BETWEEN 1 AND 9007199254740991),
  outcome text NOT NULL CHECK (outcome IN ('applied', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);
CREATE TABLE workout_sync_state (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL,
  device_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK (sequence BETWEEN 1 AND 9007199254740991),
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workout_id)
);
-- No FK to workouts: deletion markers must survive deleting the parent workout.
