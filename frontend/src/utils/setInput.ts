type SetInput = { weightKg: number; reps: number };
export type SetInputError = { field?: "weight" | "reps"; message: string };

export function parseSetInput(weight: string, reps: string):
  { value: SetInput; error?: never } | { value?: never; error: SetInputError } {
  const weightText = weight.trim();
  const weightKg = Number(weightText.replace(",", "."));
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(weightText) || !Number.isFinite(weightKg)) {
    return { error: { field: "weight", message: "Enter a weight of 0 or more, such as 60 or 62.5." } };
  }

  const repsText = reps.trim();
  const repetitions = Number(repsText);
  if (!/^\d+$/.test(repsText) || !Number.isSafeInteger(repetitions) || repetitions < 1) {
    return { error: { field: "reps", message: "Enter a whole-number rep count of 1 or more." } };
  }

  return { value: { weightKg, reps: repetitions } };
}
