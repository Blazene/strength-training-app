import assert from "node:assert/strict";
import test from "node:test";
import { parseSetInput } from "../src/utils/setInput.ts";

test("accepts zero weight and decimal keyboard input with either decimal separator", () => {
  assert.deepEqual(parseSetInput("0", "10").value, { weightKg: 0, reps: 10 });
  assert.deepEqual(parseSetInput("62.5", "8").value, { weightKg: 62.5, reps: 8 });
  assert.deepEqual(parseSetInput("62,5", "8").value, { weightKg: 62.5, reps: 8 });
  assert.deepEqual(parseSetInput(" .5 ", " 8 ").value, { weightKg: 0.5, reps: 8 });
});

test("rejects empty, negative, nonnumeric, nonfinite and malformed weight input", () => {
  for (const weight of ["", " ", "-1", "Infinity", "NaN", "abc", "1e2", "1,2,3", ".", "9".repeat(400)]) {
    assert.equal(parseSetInput(weight, "8").error?.field, "weight", weight);
  }
});

test("rejects blank, zero, fractional, negative and unsafe rep counts", () => {
  for (const reps of ["", " ", "0", "-1", "1.5", "1,5", "1e2", "abc", "9007199254740992"]) {
    assert.equal(parseSetInput("60", reps).error?.field, "reps", reps);
  }
});

test("reports the first invalid field so the form can focus the correction", () => {
  assert.equal(parseSetInput("", "").error?.field, "weight");
  assert.equal(parseSetInput("60", "").error?.field, "reps");
  assert.equal(parseSetInput("60", "8").error, undefined);
});
