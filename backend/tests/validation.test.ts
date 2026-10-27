import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseWorkout, pagination } from "../src/validation.js";
function workout() { return { id: randomUUID(), startedAt: "2026-10-27T10:00:00.000Z", completedAt: "2026-10-27T11:00:00.000Z", exercises: [
  { id: randomUUID(), exerciseId: "bench-press", name: "Bench Press", sets: [{ id: randomUUID(), weightKg: 0, reps: 10 }] }
] }; }
test("accepts client snapshots, zero weight and empty active workouts", () => {
  const value = workout(); assert.equal(parseWorkout(value, value.id).exercises[0].sets[0].weightKg, 0);
  assert.deepEqual(parseWorkout({ id: value.id, startedAt: value.startedAt, exercises: [] }, value.id).exercises, []);
});
test("rejects owner injection, mismatched IDs, invalid dates and impossible completion", () => {
  const value = workout();
  for(const invalid of [{...value,userId:"other"},{...value,startedAt:"2026-02-30T10:00:00Z"},{...value,completedAt:"2026-10-26T00:00:00Z"},{...value,exercises:[]}])assert.throws(()=>parseWorkout(invalid,value.id));
  assert.throws(()=>parseWorkout(value,randomUUID()));
});
test("rejects invalid sets, unknown exercises, duplicate IDs and oversized lists", () => {
  for (const bad of [{weightKg:-1}, {weightKg:Infinity}, {weightKg:"60"}, {reps:0}, {reps:1.5}, {reps:9007199254740992}]) {
    const value = workout(); Object.assign(value.exercises[0].sets[0], bad); assert.throws(() => parseWorkout(value, value.id));
  }
  let value=workout(); value.exercises[0].exerciseId="unknown"; assert.throws(() => parseWorkout(value,value.id));
  value=workout(); value.exercises[0].sets.push({...value.exercises[0].sets[0]}); assert.throws(() => parseWorkout(value,value.id));
  value=workout(); value.exercises=Array.from({length:31},()=>value.exercises[0]); assert.throws(() => parseWorkout(value,value.id));
});
test("bounds pagination and rejects query injection", () => {
  assert.deepEqual(pagination({}),{limit:50,offset:0});assert.deepEqual(pagination({limit:"10",offset:"20"}),{limit:10,offset:20});
  for(const query of [{limit:"101"},{offset:"-1"},{limit:"1;drop table workouts"},{limit:["1","2"]}])assert.throws(()=>pagination(query));
});
