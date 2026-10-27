import assert from "node:assert/strict";
import test from "node:test";
import { findPreviousSession } from "../src/utils/workoutHistory.ts";
import type { CompletedWorkout } from "../src/types/workout.ts";

function session(id: string, completedAt: string, exerciseId = "bench-press"): CompletedWorkout {
  return {
    id,
    startedAt: "2026-10-20T10:00:00Z",
    completedAt,
    exercises: [{
      id: `${id}-exercise`, exerciseId, name: "Exercise",
      sets: [
        { id: `${id}-set-1`, weightKg: 62.5, reps: 8 },
        { id: `${id}-set-2`, weightKg: 60, reps: 10 }
      ]
    }]
  };
}

test("first-time exercises and empty history have no previous session", () => {
  assert.equal(findPreviousSession([], "bench-press", "active"), null);
  assert.equal(findPreviousSession([session("squat", "2026-10-21", "squat")], "bench-press", "active"), null);
});

test("uses the most recent completion containing the exercise regardless of history order", () => {
  const older = session("older", "2026-10-21T10:00:00Z");
  const recent = session("recent", "2026-10-23T10:00:00Z");
  const unrelated = session("unrelated", "2026-10-24T10:00:00Z", "squat");
  assert.equal(findPreviousSession([older, unrelated, recent], "bench-press", "active")?.workoutId, "recent");
});

test("excludes the active workout and skips sessions without logged sets", () => {
  const empty = session("empty", "2026-10-25");
  empty.exercises[0].sets = [];
  const active = session("active", "2026-10-26");
  const previous = session("previous", "2026-10-24");
  assert.equal(findPreviousSession([active, empty, previous], "bench-press", "active")?.workoutId, "previous");
});

test("preserves saved set order, zero weight, and decimal weights without modifying history", () => {
  const previous = session("previous", "2026-10-24");
  previous.exercises[0].sets[1].weightKg = 0;
  const before = structuredClone(previous);
  const result = findPreviousSession([previous], "bench-press", "active");
  assert.deepEqual(result?.sets, [
    { id: "previous-set-1", weightKg: 62.5, reps: 8 },
    { id: "previous-set-2", weightKg: 0, reps: 10 }
  ]);
  assert.deepEqual(previous, before);
});

test("invalid completion dates cannot displace a valid previous session", () => {
  assert.equal(findPreviousSession([
    session("invalid", "bad-date"), session("valid", "2026-10-24")
  ], "bench-press", "active")?.workoutId, "valid");
});
