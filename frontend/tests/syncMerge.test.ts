import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRemote, allWorkouts } from '../src/sync/merge.ts';
import type { WorkoutState } from '../src/storage/workouts.ts';
import type { PendingOperation, RemoteWorkout, SyncMetadata, WorkoutSnapshot } from '../src/sync/model.ts';

const workout=(id:string,completedAt:string|null=null):WorkoutSnapshot=>({id,startedAt:'2026-10-27T09:00:00.000Z',completedAt,exercises:[{id:'exercise-'+id,exerciseId:'bench-press',name:'Bench Press',sets:[{id:'set-'+id,weightKg:60,reps:8}]}]});
const entry=(id:string,version=1):RemoteWorkout=>({id,version,deviceId:'other-device',sequence:version,deleted:false,workout:workout(id)});
const metadata=():SyncMetadata=>({version:1,owner:{id:'alice',name:'Alice',email:'alice@example.test'},deviceId:'local-device',nextSequence:4,snapshots:{},serverVersions:{},lastSyncedAt:null});
const state=():WorkoutState=>({revision:4,active:null,history:[]});
const operation=(id:string,sequence=4):PendingOperation=>({id:'operation',ownerId:'alice',deviceId:'local-device',sequence,workoutId:id,kind:'put',workout:workout(id),createdAt:'2026-10-27T09:00:00.000Z',attempts:0,nextAttemptAt:0,blocked:false,error:'',baseVersion:1});

test('downloads completed history and all unfinished sessions without replacing the current session',()=>{
 const current=state();current.active=workout('local');const original=structuredClone(current);
 const history=entry('history');history.workout=workout('history','2026-10-27T10:00:00.000Z');
 const merged=mergeRemote(current,metadata(),[],[entry('remote'),history],new Set());
 assert.equal(merged.state.active?.id,'local');assert.equal(merged.state.otherActive?.[0].id,'remote');assert.equal(merged.state.history[0].id,'history');assert.equal(merged.state.revision,5);assert.deepEqual(current,original);
});
test('pending edits and pending deletion survive a newer remote version',()=>{
 const current=state();current.active=workout('active');const meta=metadata();meta.serverVersions={active:1,removed:1};
 const deleted={...operation('removed'),kind:'delete' as const,workout:null};
 const merged=mergeRemote(current,meta,[operation('active'),deleted],[entry('active',2),entry('removed',2)],new Set());
 assert.deepEqual(merged.state,current);assert.deepEqual(Object.keys(merged.metadata.conflicts??{}).sort(),['active','removed']);assert.equal(merged.metadata.serverVersions?.active,1);
});
test('a fresh downloaded base permits a device handoff while older versions cannot replace it',()=>{
 const current=state();current.active=workout('active');const meta=metadata();meta.serverVersions={active:2};
 const merged=mergeRemote(current,meta,[{...operation('active'),baseVersion:2}],[entry('active',2)],new Set());
 assert.equal(Object.keys(merged.metadata.conflicts??{}).length,0);
 const old=entry('active',1);old.workout!.exercises=[];
 assert.deepEqual(mergeRemote(current,meta,[],[old],new Set()).state,current);
});
test('remote deletion removes clean local data but retains pending edits and unfinished inputs',()=>{
 const remote={...entry('active',2),deleted:true,workout:null};const current=state();current.active=workout('active');
 assert.equal(mergeRemote(current,metadata(),[],[remote],new Set()).state.active,null);
 assert.equal(mergeRemote(current,metadata(),[operation('active')],[remote],new Set()).state.active?.id,'active');
 const deferred=mergeRemote(current,metadata(),[],[remote],new Set(['active']));assert.deepEqual(deferred.metadata.deferred,['active']);assert.equal(deferred.state.active?.id,'active');
});
test('repeated downloads make no local revision change or duplicate workout',()=>{
 const first=mergeRemote(state(),metadata(),[],[entry('active')],new Set());
 const second=mergeRemote(first.state,first.metadata,[],[entry('active')],new Set());
 assert.equal(second.changed,false);assert.equal(second.state.revision,first.state.revision);assert.equal(allWorkouts(second.state).length,1);
});
test('no deletion is inferred from a workout absent from this download',()=>{
 const current=state();current.active=workout('local');
 const merged=mergeRemote(current,metadata(),[],[],new Set());assert.deepEqual(merged.state,current);
});
