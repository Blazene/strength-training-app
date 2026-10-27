import test from 'node:test';
import assert from 'node:assert/strict';
import { latestOperations, retryDelay } from '../src/sync/model.ts';
import type { PendingOperation } from '../src/sync/model.ts';

test('newest snapshot covers earlier edits and deletions without crossing workouts', () => {
  const operation = (workoutId: string, sequence: number, kind: 'put' | 'delete' = 'put') => ({ workoutId, sequence, kind }) as PendingOperation;
  const pending = [operation('bench', 1), operation('squat', 3), operation('bench', 2), operation('bench', 4, 'delete')];
  const before = structuredClone(pending);
  assert.deepEqual(latestOperations(pending).map(item => [item.workoutId, item.sequence, item.kind]), [['squat', 3, 'put'], ['bench', 4, 'delete']]);
  assert.deepEqual(pending, before);
});
test('retry delay grows with failures and is capped with bounded jitter', () => {
  assert.equal(retryDelay(1, 0), 1000);
  assert.equal(retryDelay(3, 0), 4000);
  assert.equal(retryDelay(1000, 0), 60000);
  assert(retryDelay(1000, 0.999) < 60500);
});
