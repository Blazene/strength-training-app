ALTER TABLE workout_sync_state
  ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 9007199254740991);
ALTER TABLE workout_sync_state ALTER COLUMN device_id DROP NOT NULL;
ALTER TABLE sync_operations ADD COLUMN version bigint CHECK (version BETWEEN 1 AND 9007199254740991);
-- Cover pre-sync API workouts so downloads and later deletions have versions too.
INSERT INTO workout_sync_state(user_id,workout_id,device_id,sequence,deleted,version)
  SELECT user_id,id,NULL,1,false,1 FROM workouts
  ON CONFLICT(user_id,workout_id) DO NOTHING;
