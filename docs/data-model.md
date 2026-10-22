# Initial data model

## User
- id: UUID
- email: unique account email
- password_hash: stored password hash, never a plain-text password

## Exercise
- id: UUID
- name: exercise name
- Initial version uses a shared exercise list.

## Workout
- id: UUID
- user_id: owner
- started_at: timestamp
- completed_at: nullable timestamp
- status: active or completed

## WorkoutExercise
- id: UUID
- workout_id: parent workout
- exercise_id: selected exercise
- position: display order within the workout

## Set
- id: UUID
- workout_exercise_id: parent workout exercise
- position: set order
- weight_kg: non-negative decimal
- reps: positive integer

## Offline synchronization design
- Generate workout, workout-exercise, and set UUIDs on the client.
- Save local changes and pending operations in one IndexedDB transaction.
- Each pending operation has its own UUID.
- Server retries must not apply the same operation twice.
- Deletions must remain represented until the server acknowledges them.
- Initial version assumes one active logging device per user.
- Exact synchronization payloads and conflict rules will be defined later.

## Previous-session lookup
Find the most recent completed workout containing the exercise.
Exclude the currently active workout.
Show that exercise's sets in their saved order.

## Storage responsibilities
- IndexedDB: local workouts, cached history, and pending operations.
- PostgreSQL: server-side account and workout data.
- React state: values currently displayed or edited on screen.
